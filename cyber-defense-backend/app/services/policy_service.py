"""Policy service: Tier-0 rule cache, learning feedback loop."""

import logging
import time
from typing import Any, Dict, List, Optional

from core.config import settings
from database.db import get_store
from ml.mitre_mapping import get_attack_severity
from ml.rl import get_policy

logger = logging.getLogger("cyber.services.policy")

SEVERITY_ACTION = {
    "critical": "block",
    "high": "block",
    "medium": "quarantine",
    "low": "rate_limit",
    "info": "allow",
}


def _fingerprint(flow: Dict[str, Any], attack_type: str) -> str:
    port = flow.get("dst_port", "*")
    proto = flow.get("protocol", "*")
    return f"{attack_type}|{proto}|{port}"


def _matches(rule: Dict[str, Any], flow: Dict[str, Any], attack_type: str) -> bool:
    if rule.get("attack_type") and rule["attack_type"] != attack_type:
        return False
    src = rule.get("src_ip")
    if src and src != "*" and src != flow.get("src_ip"):
        return False
    dst = rule.get("dst_ip")
    if dst and dst != "*" and dst != flow.get("dst_ip"):
        return False
    port = rule.get("dst_port")
    if port is not None and port != flow.get("dst_port"):
        return False
    return True


class PolicyService:
    """Manages Tier-0 fast rules; exposes the learning loop for the RL policy."""

    def __init__(self) -> None:
        self.rules_cache: List[Dict[str, Any]] = []
        self._cache_ts = 0.0

    async def _refresh_cache(self) -> None:
        if time.time() - self._cache_ts < settings.rule_cache_ttl:
            return
        store = get_store()
        try:
            self.rules_cache = await store.list_rules(active_only=True)
            self._cache_ts = time.time()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Rule cache refresh failed: %s", exc)

    # ------------------------------------------------------------------ #
    # matching (Tier-0)
    # ------------------------------------------------------------------ #
    async def check_tier0(self, flow: Dict[str, Any], attack_type: str) -> Dict[str, Any]:
        """Fast rule lookup. Returns a hit dict or miss."""
        await self._refresh_cache()
        for rule in self.rules_cache:
            if _matches(rule, flow, attack_type):
                return {
                    "hit": True,
                    "rule_id": rule.get("id"),
                    "action": rule.get("action"),
                    "signature": rule.get("signature"),
                    "source": rule.get("source", "manual"),
                    "message": f"Matched Tier-0 rule #{rule.get('id')}",
                }
        return {"hit": False, "message": "No Tier-0 rule matched"}

    async def add_rule(
        self,
        attack_type: str,
        action: str,
        flow: Optional[Dict[str, Any]] = None,
        source: str = "rl",
        priority: int = 90,
        description: str = "",
        ttl_sec: Optional[int] = None,
    ) -> Optional[int]:
        """Add a rule (RL-learned or manual). Returns rule id or None."""
        store = get_store()
        signature = _fingerprint(flow or {}, attack_type)
        if source == "rl":
            # learned rules must generalize: do not pin the (random) IPs
            rule_src, rule_dst = "*", "*"
        else:
            rule_src = (flow or {}).get("src_ip", "*")
            rule_dst = (flow or {}).get("dst_ip", "*")
        rule = {
            "action": action,
            "attack_type": attack_type,
            "src_ip": rule_src,
            "dst_ip": rule_dst,
            "dst_port": (flow or {}).get("dst_port"),
            "signature": signature,
            "priority": priority,
            "source": source,
            "description": description
            or f"{source}: learned rule for {attack_type} ({action})",
            "active": True,
            "ttl_sec": ttl_sec,
        }
        try:
            rule = await store.create_rule(rule)
            rule_id = rule.get("id") if isinstance(rule, dict) else rule
            self._cache_ts = 0.0  # force refresh
            logger.info("Added Tier-0 rule #%s (%s -> %s)", rule_id, attack_type, action)
            return rule_id
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to persist rule: %s", exc)
            return None

    # ------------------------------------------------------------------ #
    # feedback loop (used after a verdict)
    # ------------------------------------------------------------------ #
    async def learn_from_outcome(
        self,
        flow: Dict[str, Any],
        attack_type: str,
        verdict: str,
        action: str,
        outcome: str,
        confidence: float,
    ) -> Dict[str, Any]:
        """
        Called when an event resolves. If the RL policy chose an action and
        it resolved successfully, record a learning signal and optionally
        add a Tier-0 rule so the next identical attack is caught instantly.
        """
        result: Dict[str, Any] = {"learned": False}
        if verdict == "benign":
            return result
        action_outcome = {
            "block": "blocked",
            "quarantine": "quarantined",
            "redirect": "redirected",
            "rate_limit": "rate_limited",
            "allow": "allowed",
        }
        if action_outcome.get(action) != outcome:
            return result
        severity = get_attack_severity(attack_type)
        if verdict == "redirected":
            # honeypot containment: harden against this attack class
            rule_action = "block"
            description = "Learned from honeypot containment (zero-day)"
        else:
            rule_action = SEVERITY_ACTION.get(severity, "block")
            description = f"Learned after {action} resolved as {outcome}"
        rule_id = await self.add_rule(
            attack_type=attack_type,
            action=rule_action,
            flow=flow,
            source="rl",
            priority=90,
            description=description,
            ttl_sec=settings.learned_rule_ttl_sec,
        )
        result = {
            "learned": rule_id is not None,
            "rule_id": rule_id,
            "rule_action": rule_action,
            "message": "Policy Updated -> Tier-0 rule added"
            if rule_id
            else "Policy update skipped (persist failed)",
        }
        return result

    async def list_rules(self) -> List[Dict[str, Any]]:
        await self._refresh_cache()
        return self.rules_cache

    async def reset_learned_rules(self) -> int:
        """Deactivate only rules produced by the adaptive learning loop."""
        store = get_store()
        rules = await store.list_rules(active_only=True)
        count = 0
        for rule in rules:
            if rule.get("source") in {"rl", "learned"}:
                if await store.deactivate_rule(int(rule["id"])):
                    count += 1
        self._cache_ts = 0.0
        return count

    async def rollback_latest(self) -> Dict[str, Any]:
        """Revert the most recent adaptive learn: deactivate the newest learned
        Tier-0 rule and publish a new policy version documenting the rollback."""
        store = get_store()
        rules = await store.list_rules(active_only=True)
        learned = [r for r in rules if r.get("source") in {"rl", "learned"}]
        learned.sort(key=lambda r: r.get("id", 0), reverse=True)
        rolled: List[Dict[str, Any]] = []
        if learned:
            newest = learned[0]
            if await store.deactivate_rule(int(newest["id"])):
                rolled.append(newest)
        self._cache_ts = 0.0

        policy = get_policy()
        version_result = policy.policy_update(0.5, source="rollback")
        await store.create_policy_version(
            {
                "version": version_result["version"],
                "description": "Rollback: reverted the latest learned Tier-0 rule",
                "source": version_result["source"],
                "params": version_result["params"],
            }
        )
        if rolled:
            message = (
                f"Deactivated learned rule #{rolled[0].get('id')} "
                f"({rolled[0].get('attack_type')} -> {rolled[0].get('action')}); policy v{version_result['version']} published"
            )
        else:
            message = f"No learned rules to roll back; policy v{version_result['version']} published"
        return {
            "rolled_back_rules": len(rolled),
            "rule_id": rolled[0].get("id") if rolled else None,
            "version": version_result["version"],
            "message": message,
        }
