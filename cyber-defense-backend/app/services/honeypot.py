"""Honeypot + behaviour analysis for unknown (zero-day) traffic."""

import logging
from typing import Any, Dict, List

logger = logging.getLogger("cyber.services.honeypot")

DECOY_SERVICES = {
    22: "fake-ssh",
    80: "fake-http",
    443: "fake-tls",
    3306: "fake-mysql",
    53: "fake-dns",
    445: "fake-smb",
}

BEHAVIOUR_SIGNALS = {
    "recon": ("Reconnaissance: repeated probing of multiple ports", 0.6),
    "http_exploit": ("HTTP exploit payload patterns detected", 0.75),
    "brute_force": ("Repeated authentication failures", 0.8),
    "lateral": ("Post-exploitation lateral movement attempt", 0.85),
    "exfil": ("High volume outbound transfer", 0.7),
    "cmd_inject": ("Command injection signature matched", 0.9),
}


def redirect_to_honeypot(flow: Dict[str, Any]) -> Dict[str, Any]:
    """Redirect unknown traffic to the decoy service; return honeypot event."""
    dst_port = flow.get("dst_port", 0)
    service = DECOY_SERVICES.get(dst_port, "fake-service")
    return {
        "service": service,
        "target": flow.get("dst_ip", ""),
        "redirected": True,
        "message": f"Traffic redirected to honeypot:{service}",
    }


def behaviour_analysis(flow: Dict[str, Any], attack_type: str) -> Dict[str, Any]:
    """Heuristic behaviour profile of an unknown flow."""
    fwd = flow.get("tot_fwd_pkts", 0) or 0
    bwd = flow.get("tot_bwd_pkts", 0) or 0
    pkt_rate = flow.get("flow_pkts_per_s", 0) or 0
    ports_hit = flow.get("ports_hit", [flow.get("dst_port")])
    bwd_bytes = flow.get("totlen_bwd_pkts", 0) or 0
    psh = flow.get("psh_flag_cnt", 0) or 0

    signals: List[str] = []
    confidence = 0.5
    if len(ports_hit) >= 3:
        signals.append("recon")
        confidence = max(confidence, BEHAVIOUR_SIGNALS["recon"][1])
    if attack_type == "zero_day":
        signals.append("http_exploit")
        confidence = max(confidence, BEHAVIOUR_SIGNALS["http_exploit"][1])
    if fwd > 200 and bwd < fwd / 10:
        signals.append("brute_force")
        confidence = max(confidence, BEHAVIOUR_SIGNALS["brute_force"][1])
    if psh > 100 and pkt_rate > 50:
        signals.append("cmd_inject")
        confidence = max(confidence, BEHAVIOUR_SIGNALS["cmd_inject"][1])
    if bwd_bytes > 5_000_000:
        signals.append("exfil")
        confidence = max(confidence, BEHAVIOUR_SIGNALS["exfil"][1])
    if not signals:
        signals.append("recon")
        confidence = 0.55

    analysis = {
        "signals": signals,
        "details": [BEHAVIOUR_SIGNALS[s][0] for s in signals],
        "confidence": round(confidence, 4),
        "classification": "zero_day_payload" if confidence > 0.7 else "suspicious_unknown",
    }
    logger.info(
        "Behaviour analysis (%s): %s (conf=%.2f)",
        attack_type,
        analysis["classification"],
        confidence,
    )
    return analysis


def quench_attack(attack_type: str, threat: float) -> Dict[str, Any]:
    """Simulated containment of a honeypot-captured threat."""
    return {
        "contained": True,
        "attack_type": attack_type,
        "threat_level": round(threat, 4),
        "artifacts": {
            "payloads": 2,
            "c2_beacons": 1 if threat > 0.7 else 0,
            "ioes": ["fake-backdoor", "suspicious-dns-query"],
        },
        "message": "Threat contained in honeypot; artefacts captured",
    }
