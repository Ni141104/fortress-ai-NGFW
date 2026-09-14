"""
MITRE ATT&CK mapping for detected attack classes.

XGBoost is a binary classifier (benign vs attack); the concrete attack
class is inferred from flow characteristics, then mapped to MITRE
techniques for the dashboard / evidence panels.
"""

from typing import Any, Dict, List, Tuple

ATTACK_TECHNIQUES: Dict[str, List[Tuple[str, str, str]]] = {
    "ddos": [("T1498", "Network Denial of Service", "Impact"), ("T1499", "Endpoint Denial of Service", "Impact")],
    "dos": [("T1499", "Endpoint Denial of Service", "Impact")],
    "brute_force": [("T1110", "Brute Force", "Credential Access")],
    "ssh_patator": [("T1110", "Brute Force", "Credential Access"), ("T1021.004", "SSH", "Lateral Movement")],
    "ftp_patator": [("T1110", "Brute Force", "Credential Access")],
    "web_attack": [("T1190", "Exploit Public-Facing Application", "Initial Access")],
    "sql_injection": [("T1190", "Exploit Public-Facing Application", "Initial Access"), ("T1059.001", "SQL Command", "Execution")],
    "xss": [("T1190", "Exploit Public-Facing Application", "Initial Access"), ("T1185", "Browser Session Hijacking", "Collection")],
    "port_scan": [("T1046", "Network Service Scanning", "Discovery"), ("T1595.001", "Scanning IP Blocks", "Reconnaissance")],
    "portscan": [("T1046", "Network Service Scanning", "Discovery")],
    "bot": [("T1071", "Application Layer Protocol", "Command and Control")],
    "c2": [("T1071", "Application Layer Protocol", "Command and Control")],
    "infiltration": [("T1021", "Remote Services", "Lateral Movement")],
    "ransomware": [("T1486", "Data Encrypted for Impact", "Impact"), ("T1490", "Inhibit System Recovery", "Impact")],
    "exfiltration": [("T1041", "Exfiltration Over C2 Channel", "Exfiltration")],
    "dns_tunneling": [("T1071.004", "DNS", "Command and Control"), ("T1048", "Exfiltration Over Alternative Protocol", "Exfiltration")],
    "mitm": [("T1557", "Adversary-in-the-Middle", "Credential Access")],
    "unknown": [("T1595", "Active Scanning", "Reconnaissance")],
    "attack": [("T1595", "Active Scanning", "Reconnaissance")],
}

PORT_ATTACK_HINTS = {
    21: "ftp_patator",
    22: "ssh_patator",
    23: "brute_force",
    80: "web_attack",
    443: "web_attack",
    3306: "sql_injection",
    3389: "brute_force",
    5432: "sql_injection",
    8080: "web_attack",
    53: "dns_tunneling",
}


def get_techniques(attack_type: str) -> List[Dict[str, str]]:
    normalized = attack_type.lower().replace(" ", "_").replace("-", "_")
    techniques = ATTACK_TECHNIQUES.get(normalized)
    if techniques is None:
        for key in ATTACK_TECHNIQUES:
            if key in normalized or normalized in key:
                techniques = ATTACK_TECHNIQUES[key]
                break
    if techniques is None:
        techniques = ATTACK_TECHNIQUES["unknown"]
    return [
        {"id": t_id, "name": name, "tactic": tactic}
        for t_id, name, tactic in techniques
    ]


def get_technique_ids(attack_type: str) -> List[str]:
    return [t["id"] for t in get_techniques(attack_type)]


def infer_attack_type(
    flow: Dict[str, Any],
    tier1_score: float = 0.5,
    is_attack: bool = True,
    hint: str | None = None,
) -> Tuple[str, float]:
    """Infer the concrete attack class from flow characteristics.

    `hint` is the launched attack type; when the classifiers agree it is
    malicious, the hint is used as the class (the flow was generated as
    that attack). Heuristics are used when no hint is available.
    """
    if not is_attack:
        return "benign", 1.0
    if hint and hint in ATTACK_TECHNIQUES:
        return hint, max(tier1_score, 0.65)

    dst_port = flow.get("dst_port", 0) or 0
    pkt_rate = flow.get("flow_pkts_per_s", 0) or 0
    syn_cnt = flow.get("syn_flag_cnt", 0) or 0
    rst_cnt = flow.get("rst_flag_cnt", 0) or 0
    duration = flow.get("flow_duration", 1000) or 1000
    byte_rate = flow.get("flow_byts_per_s", 0) or 0
    tot_fwd = flow.get("tot_fwd_pkts", 0) or 0
    tot_bwd = flow.get("tot_bwd_pkts", 0) or 0
    fwd_len_max = flow.get("fwd_pkt_len_max", 0) or 0
    psh = flow.get("psh_flag_cnt", 0) or 0

    scores: Dict[str, float] = {}
    if pkt_rate > 800 or byte_rate > 100_000_000:
        scores["ddos"] = 0.9
    elif pkt_rate > 200:
        scores["ddos"] = 0.7
    if "ddos" not in scores and syn_cnt > 5 and rst_cnt > 3:
        scores["port_scan"] = 0.8
    if dst_port == 53:
        if tot_fwd > 500 and byte_rate > 2000:
            scores["dns_tunneling"] = 0.8
        else:
            scores["dns_tunneling"] = 0.55
    if dst_port in (3306, 5432):
        scores["sql_injection"] = 0.7
    elif dst_port in (80, 443, 8080):
        if psh > 0 and psh >= (flow.get("tot_fwd_pkts", 0) or 0) * 0.5:
            scores["xss"] = 0.7
        elif fwd_len_max > 800:
            scores["sql_injection"] = 0.75
        else:
            scores["web_attack"] = 0.6
    if dst_port == 22:
        if duration > 1000 and tot_fwd > 50:
            scores["ssh_patator"] = 0.75
    elif dst_port == 21:
        scores["ftp_patator"] = 0.75
    elif dst_port == 3389:
        scores["brute_force"] = 0.7
    if byte_rate > 1_000_000 and tot_fwd > 2000 and fwd_len_max > 800:
        scores["ransomware"] = 0.8

    if scores:
        best = max(scores, key=scores.get)
        return best, scores[best]
    if dst_port in PORT_ATTACK_HINTS:
        return PORT_ATTACK_HINTS[dst_port], 0.5
    return "unknown", 0.4


def get_attack_severity(attack_type: str) -> str:
    critical = ["ddos", "ransomware", "heartbleed", "sql_injection"]
    high = ["dos", "bot", "c2", "infiltration", "dns_tunneling", "mitm"]
    medium = ["brute_force", "ssh_patator", "ftp_patator", "web_attack", "xss"]
    low = ["port_scan"]
    normalized = attack_type.lower().replace(" ", "_").replace("-", "_")
    if any(a in normalized for a in critical):
        return "critical"
    if any(a in normalized for a in high):
        return "high"
    if any(a in normalized for a in medium):
        return "medium"
    if any(a in normalized for a in low):
        return "low"
    return "info"
