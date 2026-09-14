"""
Attack Orchestrator: the detection pipeline.

Tier-0 (fast rules) -> Tier-1 (IsolationForest) -> Tier-2 (XGBoost)
-> Collision Avoidance -> RL decision -> Honeypot/behaviour analysis
for unknowns -> policy update -> persistence -> WebSocket events.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from core.config import settings
from database.db import get_store
from ml.isolation import tier1_verdict
from ml.mitre_mapping import infer_attack_type, get_techniques, get_attack_severity
from ml.rl import get_policy, state_features
from ml.xgboost import tier2_verdict
from ml.loader import get_models
from services.honeypot import behaviour_analysis, redirect_to_honeypot, quench_attack
from services.pcap import summarize_flows
from services.policy_service import PolicyService
from services.templates import build_flow, ATTACK_LABELS
from websocket.manager import manager, new_room

logger = logging.getLogger("cyber.orchestrator")

# Collision avoidance: never contradict Tier-0/severity verdicts with a weaker action
MIN_ACTION_STRENGTH = {
    "allow": 0,
    "rate_limit": 1,
    "quarantine": 2,
    "redirect": 2,
    "block": 3,
}
ACTION_STRENGTH = {v: k for k, v in MIN_ACTION_STRENGTH.items()}

SEVERITY_ACTION_FALLBACK = {
    "info": "allow",
    "low": "rate_limit",
    "medium": "quarantine",
    "high": "block",
    "critical": "block",
}


def _strength(action: str) -> int:
    return MIN_ACTION_STRENGTH.get(action, 0)


class AttackOrchestrator:
    def __init__(self) -> None:
        self.running: Dict[str, asyncio.Task] = {}
        self.policy_service = PolicyService()

    # ------------------------------------------------------------------ #
    # lifecycle
    # ------------------------------------------------------------------ #
    def launch(self, request: Dict[str, Any]) -> str:
        attack_id = uuid.uuid4().hex[:16]
        manager.register_owner(attack_id, int(request.get("user_id", 0)))
        task = asyncio.create_task(self._run(attack_id, request))
        self.running[attack_id] = task
        task.add_done_callback(lambda t: self.running.pop(attack_id, None))
        return attack_id

    def launch_pcap(
        self,
        request: Dict[str, Any],
        flows: List[Dict[str, Any]],
        file_meta: Dict[str, Any],
    ) -> str:
        """Launch the pipeline over flows extracted from a real capture file."""
        attack_id = uuid.uuid4().hex[:16]
        manager.register_owner(attack_id, int(request.get("user_id", 0)))
        task = asyncio.create_task(self._run_pcap(attack_id, request, flows, file_meta))
        self.running[attack_id] = task
        task.add_done_callback(lambda t: self.running.pop(attack_id, None))
        return attack_id

    async def _pace(self) -> None:
        if settings.stage_delay > 0:
            await asyncio.sleep(settings.stage_delay)

    # ------------------------------------------------------------------ #
    # pipeline
    # ------------------------------------------------------------------ #
    async def _run(self, attack_id: str, request: Dict[str, Any]) -> None:
        store = get_store()
        attack = request.get("attack", "sql_injection")
        intensity = request.get("intensity", "medium")
        duration = float(request.get("duration_sec", 5.0))
        pps = float(request.get("packets_per_sec", 500.0))
        target = request.get("target", "10.0.0.10")
        is_zero_day = attack == "zero_day"

        await manager.send_pipeline_start(
            attack_id,
            {
                "attack": attack,
                "label": ATTACK_LABELS.get(attack, attack),
                "intensity": intensity,
                "duration_sec": duration,
                "packets_per_sec": pps,
                "target": target,
            },
        )

        flow = build_flow(attack, intensity, duration, pps, target)
        start_ts = time.time()

        try:
            verdict, result = await self._pipeline(
                attack_id, flow, attack, is_zero_day
            )
            await self._persist(attack_id, request, result, flow, start_ts)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Pipeline failed for %s", attack_id)
            error = {
                "id": attack_id,
                "user_id": int(request.get("user_id", 0)),
                "attack_type": attack,
                "status": "error",
                "error": str(exc),
            }
            await manager.send_pipeline_end(attack_id, error)
            await store.create_attack(error)

    async def _run_pcap(
        self,
        attack_id: str,
        request: Dict[str, Any],
        flows: List[Dict[str, Any]],
        file_meta: Dict[str, Any],
    ) -> None:
        """Real-capture variant: scan every flow, then run the full pipeline on the primary flow."""
        store = get_store()
        attack = request.get("attack", "sql_injection")
        intensity = request.get("intensity", "medium")
        target = request.get("target", "10.0.0.10")
        is_zero_day = attack == "zero_day"
        packets_parsed = file_meta.get("packet_count", 0)
        filename = file_meta.get("filename", "capture.pcap")

        await manager.send_pipeline_start(
            attack_id,
            {
                "attack": attack,
                "label": ATTACK_LABELS.get(attack, attack),
                "intensity": intensity,
                "target": target,
                "source": "pcap",
                "filename": filename,
                "packet_count": packets_parsed,
                "flow_count": len(flows),
            },
        )

        await self._scan_flows(attack_id, flows, attack, is_zero_day, file_meta)

        primary = flows[0]
        start_ts = time.time()
        try:
            verdict, result = await self._pipeline(
                attack_id, primary, attack, is_zero_day
            )
            summary = (
                f"Parsed {packets_parsed} packets / {len(flows)} flows from "
                f"{filename} — {ATTACK_LABELS.get(attack, attack)} {verdict}."
            )
            await self._persist(
                attack_id, request, result, primary, start_ts, source="pcap", summary=summary
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Pipeline failed for %s", attack_id)
            error = {
                "id": attack_id,
                "user_id": int(request.get("user_id", 0)),
                "attack_type": attack,
                "status": "error",
                "error": str(exc),
                "source": "pcap",
            }
            await manager.send_pipeline_end(attack_id, error)
            await store.create_attack(error)

    async def _scan_flows(
        self,
        attack_id: str,
        flows: List[Dict[str, Any]],
        attack: str,
        is_zero_day: bool,
        file_meta: Dict[str, Any],
    ) -> None:
        """Score every extracted flow with the real Tier-1/Tier-2 models and emit a scan table."""
        models = get_models()
        scan: List[Dict[str, Any]] = []
        for index, flow in enumerate(flows[:12]):
            try:
                t1 = tier1_verdict(models.get("isolation_forest"), flow)
                t2 = tier2_verdict(models.get("xgboost"), flow)
                attack_class, class_conf = infer_attack_type(
                    flow, t1["anomaly_score"], t2["is_attack"],
                    hint=attack if not is_zero_day else None,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Flow scan failed for flow %d: %s", index, exc)
                t1 = {"anomaly_score": 0.0}
                t2 = {"attack_probability": 0.0, "is_attack": False}
                attack_class = "unknown"
                class_conf = 0.0
            if is_zero_day and t1["anomaly_score"] >= 0:
                status = "blocked_at_tier1"
            elif t2["is_attack"]:
                status = "attack"
            elif t1["anomaly_score"] > 0.5:
                status = "suspicious"
            else:
                status = "benign"
            scan.append(
                {
                    "index": index,
                    "src_ip": flow.get("src_ip", ""),
                    "dst_ip": flow.get("dst_ip", ""),
                    "dst_port": flow.get("dst_port", 0),
                    "protocol": flow.get("protocol", "TCP"),
                    "packets": flow.get("pkt_count", 0),
                    "bytes": flow.get("bytes", 0),
                    "anomaly_score": round(float(t1.get("anomaly_score", 0.0)), 4),
                    "attack_probability": round(float(t2.get("attack_probability", 0.0)), 4),
                    "attack_class": attack_class,
                    "confidence": round(float(class_conf), 4),
                    "status": status,
                }
            )
        await self._pace()
        await manager.send_event(
            attack_id,
            "flow_scan",
            {
                "filename": file_meta.get("filename", "capture.pcap"),
                "packet_count": file_meta.get("packet_count", 0),
                "flow_count": len(flows),
                "scanned": len(scan),
                "flows": scan,
                "summary": summarize_flows(flows),
            },
        )

    async def _pipeline(
        self,
        attack_id: str,
        flow: Dict[str, Any],
        attack_type: str,
        is_zero_day: bool,
    ) -> tuple[str, Dict[str, Any]]:
        store = get_store()
        # ---------------------------------------------------------------- #
        # Tier-0: fast rule cache
        # ---------------------------------------------------------------- #
        tier0 = await self.policy_service.check_tier0(flow, attack_type)
        await self._pace()
        await manager.send_event(
            attack_id, "tier0",
            {"hit": tier0["hit"], "message": tier0["message"], "rule_id": tier0.get("rule_id")},
        )
        if tier0["hit"]:
            rule_action = tier0.get("action") or "block"
            tier0_verdict = {
                "block": "blocked",
                "quarantine": "quarantined",
                "rate_limit": "rate_limited",
                "redirect": "redirected",
                "allow": "allowed",
            }.get(rule_action, "blocked")
            result = self._compose_result(
                flow, attack_type, tier0_verdict,
                action=rule_action,
                confidence=0.99,
                source="tier0",
                rule_id=tier0.get("rule_id"),
                message=f"The firewall already learned this attack (Tier-0 rule). {tier0['message']}",
            )
            return tier0_verdict, result

        models = get_models()

        # ---------------------------------------------------------------- #
        # Tier-1: IsolationForest anomaly scoring
        # ---------------------------------------------------------------- #
        t1 = tier1_verdict(models.get("isolation_forest"), flow)
        await self._pace()
        await manager.send_event(
            attack_id, "tier1",
            {
                "anomaly_score": t1["anomaly_score"],
                "outlier_factor": t1["outlier_factor"],
                "threshold": t1["tier1_threshold"],
                "verdict": t1["verdict"],
            },
        )

        # ---------------------------------------------------------------- #
        # Tier-2: XGBoost classification
        # ---------------------------------------------------------------- #
        t2 = tier2_verdict(models.get("xgboost"), flow)
        await self._pace()
        await manager.send_event(
            attack_id, "tier2",
            {
                "attack_probability": t2["attack_probability"],
                "raw_margin": t2["raw_margin"],
                "threshold": t2["threshold"],
                "verdict": t2["verdict"],
            },
        )

        # ---------------------------------------------------------------- #
        # Attack class inference + MITRE
        # ---------------------------------------------------------------- #
        attack_class, class_conf = infer_attack_type(
            flow,
            t1["anomaly_score"],
            t2["is_attack"] or is_zero_day,
            hint=attack_type if not is_zero_day else None,
        )
        if is_zero_day:
            attack_class = "zero_day"
        techniques = get_techniques(attack_class)
        severity = get_attack_severity(attack_class)
        await self._pace()
        await manager.send_event(
            attack_id, "classify",
            {"attack_class": attack_class, "confidence": round(class_conf, 4),
             "severity": severity, "techniques": techniques,
             "attack_label": ATTACK_LABELS.get(attack_class, attack_class)},
        )

        # ---------------------------------------------------------------- #
        # Fusion + collision avoidance
        # ---------------------------------------------------------------- #
        is_attack = t2["is_attack"] or is_zero_day
        threat = max(t2["attack_probability"], t1["anomaly_score"])
        if is_zero_day:
            threat = max(threat, settings.zero_day_threat_floor)
        avoid = self._collision_avoidance(threat, is_attack, is_zero_day, severity)
        if avoid:
            await self._pace()
            await manager.send_event(attack_id, "avoid", avoid)

        # ---------------------------------------------------------------- #
        # RL decision
        # ---------------------------------------------------------------- #
        policy = get_policy()
        features = state_features(t1, t2, is_zero_day=is_zero_day)
        forced = avoid.get("action") if avoid else None
        decision = policy.choose_action(features, force_action=forced)
        await self._pace()
        await manager.send_event(
            attack_id, "rl_decision", decision
        )

        # ---------------------------------------------------------------- #
        # Unknown / zero-day -> honeypot + behaviour analysis
        # ---------------------------------------------------------------- #
        if is_zero_day:
            honeypot = redirect_to_honeypot(flow)
            await self._pace()
            await manager.send_event(attack_id, "honeypot", honeypot)
            analysis = behaviour_analysis(flow, attack_type)
            await self._pace()
            await manager.send_event(attack_id, "behaviour", analysis)
            contained = quench_attack(attack_type, threat)
            await self._pace()
            await manager.send_event(attack_id, "contain", contained)
            action = "redirect"
            verdict = "redirected"
        else:
            action = decision["action"]
            verdict = {
                "block": "blocked",
                "quarantine": "quarantined",
                "rate_limit": "rate_limited",
                "redirect": "redirected",
                "allow": "allowed",
            }[action]

        # ---------------------------------------------------------------- #
        # Policy update + Tier-0 learning
        # ---------------------------------------------------------------- #
        update_info: Dict[str, Any] = {}
        if verdict != "allowed":
            policy_result = policy.policy_update(threat, attack_type)
            await store.create_policy_version(
                {
                    "version": policy_result["version"],
                    "description": f"Learned from {attack_type} ({verdict})",
                    "source": policy_result["source"],
                    "params": policy_result["params"],
                }
            )
            update_info = {
                "version": policy_result["version"],
                "message": "Policy Updated -> Tier-0 updated",
            }
            learned = await self.policy_service.learn_from_outcome(
                flow, attack_type, verdict, action, verdict, decision.get("confidence", 0.5)
            )
            if learned["learned"]:
                update_info["rule_id"] = learned["rule_id"]
                update_info["message"] = learned["message"]
            await self._pace()
            await manager.send_event(attack_id, "policy_update", update_info)
        else:
            await self._pace()
            await manager.send_event(
                attack_id, "policy_update", {"message": "Benign traffic; no policy change"}
            )

        # ---------------------------------------------------------------- #
        # Result
        # ---------------------------------------------------------------- #
        result = self._compose_result(
            flow, attack_type, verdict,
            action=action,
            confidence=decision.get("confidence", 0.5),
            source="rl",
            anomaly_score=t1["anomaly_score"],
            xgb_confidence=t2["attack_probability"],
            attack_class=attack_class,
            mitre_techniques=[t["id"] for t in techniques],
            severity=severity,
            decision=decision,
            update=update_info,
        )
        return verdict, result

    # ------------------------------------------------------------------ #
    # helpers
    # ------------------------------------------------------------------ #
    async def _persist(
        self,
        attack_id: str,
        request: Dict[str, Any],
        result: Dict[str, Any],
        flow: Dict[str, Any],
        start_ts: float,
        **meta: Any,
    ) -> None:
        store = get_store()
        result["attack_id"] = attack_id
        result["latency_ms"] = round((time.time() - start_ts) * 1000, 2)
        await manager.send_pipeline_end(attack_id, result)
        result.setdefault("id", attack_id)
        result.setdefault("user_id", int(request.get("user_id", 0)))
        result.setdefault("attack_type", request.get("attack", "sql_injection"))
        result.setdefault("intensity", request.get("intensity", "medium"))
        result.setdefault("duration_sec", float(request.get("duration_sec", 5.0)))
        result.setdefault("packets_per_sec", float(request.get("packets_per_sec", 500.0)))
        result.setdefault("target", request.get("target", "10.0.0.10"))
        result["flow"] = flow
        if meta.get("source"):
            result["source"] = meta["source"]
        if meta.get("summary"):
            result["summary"] = meta["summary"]
        await store.create_attack(result)

    def _collision_avoidance(
        self,
        threat: float,
        is_attack: bool,
        is_zero_day: bool,
        severity: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Never allow/weaken when the evidence says attack; never over-block
        benign traffic; unknown -> redirect to honeypot.
        """
        if is_zero_day:
            return {"action": "redirect", "reason": "unknown payload -> honeypot"}
        if not is_attack:
            return {"action": "allow", "reason": "XGBoost says benign"}
        expected = SEVERITY_ACTION_FALLBACK.get(severity, "block")
        return {"action": expected, "reason": f"collision avoidance -> {expected}"}

    def _compose_result(
        self,
        flow: Dict[str, Any],
        attack_type: str,
        verdict: str,
        **overrides: Any,
    ) -> Dict[str, Any]:
        base: Dict[str, Any] = {
            "status": "completed",
            "attack_type": attack_type,
            "label": ATTACK_LABELS.get(attack_type, attack_type),
            "verdict": verdict,
            "action": overrides.get("action", "allow"),
            "confidence": overrides.get("confidence", 0.5),
            "anomaly_score": overrides.get("anomaly_score", 0.5),
            "xgb_confidence": overrides.get("xgb_confidence", 0.0),
            "attack_class": overrides.get("attack_class", attack_type),
            "mitre_techniques": overrides.get("mitre_techniques", []),
            "severity": overrides.get("severity", "info"),
            "source": overrides.get("source", "rl"),
            "message": overrides.get(
                "message", f"{ATTACK_LABELS.get(attack_type, attack_type)} {verdict}"
            ),
            "summary": overrides.get(
                "summary",
                f"{ATTACK_LABELS.get(attack_type, attack_type)} flow {verdict} "
                f"({overrides.get('confidence', 0.5):.0%} confidence)",
            ),
            "src_ip": flow.get("src_ip", ""),
            "dst_ip": flow.get("dst_ip", ""),
            "dst_port": flow.get("dst_port"),
            "created_at": datetime.now(timezone.utc),
        }
        if overrides.get("rule_id") is not None:
            base["rule_id"] = overrides["rule_id"]
        if overrides.get("decision"):
            base["rl_decision"] = overrides["decision"]
        if overrides.get("update"):
            base["policy_update"] = overrides["update"]
        return base


_orchestrator: Optional[AttackOrchestrator] = None


def init_orchestrator() -> AttackOrchestrator:
    global _orchestrator
    _orchestrator = AttackOrchestrator()
    return _orchestrator


def get_orchestrator() -> AttackOrchestrator:
    assert _orchestrator is not None, "orchestrator not initialized"
    return _orchestrator
