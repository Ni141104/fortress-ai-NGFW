"""
Attack templates: flow signatures grounded in real training data.

Profiles are median feature vectors extracted from the real datasets:
  - benign        : median of testData/flows (1).csv (CIC-IDS2017 traffic)
  - attack styles : medians of testData/synthetic_attacks.csv per dst_port

Flow dicts use snake_case keys that FeatureMapper.NAME_MAPPING maps to the
CIC training column names. IAT values are in MICROSECONDS (CIC convention).
"""

import random
from typing import Any, Dict

INTENSITY_FACTOR = {
    "low": 0.4,
    "medium": 1.0,
    "high": 2.2,
}

ATTACK_TYPES = [
    "sql_injection",
    "xss",
    "port_scan",
    "ddos",
    "brute_force",
    "zero_day",
    "dns_tunneling",
    "mitm",
    "ransomware",
]

ATTACK_LABELS = {
    "sql_injection": "SQL Injection",
    "xss": "Cross-Site Scripting",
    "port_scan": "Port Scan",
    "ddos": "DDoS Flood",
    "brute_force": "Brute Force",
    "zero_day": "Zero-Day Exploit",
    "dns_tunneling": "DNS Tunneling",
    "mitm": "Man-in-the-Middle",
    "ransomware": "Ransomware",
}

# Src/Dst port pairs that XGBoost learned during training (CIC-IDS2017)
ATTACK_PORTS = {
    "sql_injection": 80,
    "xss": 80,
    "port_scan": 80,
    "ddos": 443,
    "brute_force": 22,
    "zero_day": 80,
    "dns_tunneling": 53,
    "mitm": 80,
    "ransomware": 445,
}

# Realistic "started from build_flow base" keys shared by every flow
_BASE_FLOW: Dict[str, Any] = {
    "src_ip": "192.168.1.100",
    "dst_ip": "10.0.0.10",
    "src_port": 45123,
    "protocol": "TCP",
    "fin_flag_cnt": 0,
    "urg_flag_cnt": 0,
    "cwe_flag_count": 0,
    "ece_flag_cnt": 0,
    "bwd_urg_flags": 0,
    "fwd_urg_flags": 0,
    "bwd_psh_flags": 0,
    "fwd_psh_flags": 0,
    "pkt_len_var": 0.0,
    "fwd_byts_b_avg": 0.0,
    "fwd_pkts_b_avg": 0.0,
    "fwd_blk_rate_avg": 0.0,
    "bwd_byts_b_avg": 0.0,
    "bwd_pkts_b_avg": 0.0,
    "bwd_blk_rate_avg": 0.0,
    "inbound": 1,
    "simillar_http": 0,
    "timestamp": 1765190000,
}


def _host_to_port(target: str, default_port: int) -> int:
    if ":" in target:
        try:
            return int(target.rsplit(":", 1)[1])
        except ValueError:
            return default_port
    return default_port


# ---------------------------------------------------------------------- #
# median profiles from the real datasets
# ---------------------------------------------------------------------- #
_BENIGN_PROFILE: Dict[str, float] = {
    "flow_duration": 135445.0, "tot_fwd_pkts": 2.0, "tot_bwd_pkts": 1.0,
    "totlen_fwd_pkts": 104.0, "totlen_bwd_pkts": 60.0,
    "fwd_pkt_len_max": 78.0, "fwd_pkt_len_min": 52.0, "fwd_pkt_len_mean": 78.0,
    "fwd_pkt_len_std": 10.0, "bwd_pkt_len_max": 78.0, "bwd_pkt_len_min": 52.0,
    "bwd_pkt_len_mean": 60.0, "bwd_pkt_len_std": 8.0,
    "flow_byts_per_s": 1.23, "flow_pkts_per_s": 0.027,
    "flow_iat_mean": 19389.68, "flow_iat_std": 6000.0, "flow_iat_max": 122865.87,
    "flow_iat_min": 500.0, "fwd_iat_tot": 19389.0, "fwd_iat_mean": 19389.68,
    "fwd_iat_std": 6000.0, "fwd_iat_max": 122865.87, "fwd_iat_min": 500.0,
    "bwd_iat_tot": 9000.0, "bwd_iat_mean": 9000.0, "bwd_iat_std": 3000.0,
    "bwd_iat_max": 40000.0, "bwd_iat_min": 100.0,
    "fwd_header_len": 48.0, "bwd_header_len": 48.0,
    "fwd_pkts_per_s": 0.027, "bwd_pkts_per_s": 0.01,
    "pkt_len_min": 52.0, "pkt_len_max": 78.0, "pkt_len_mean": 78.0,
    "pkt_len_std": 8.0, "pkt_size_avg": 78.0,
    "syn_flag_cnt": 1.0, "ack_flag_cnt": 1.0, "psh_flag_cnt": 0.0,
    "rst_flag_cnt": 0.0,
    "down_up_ratio": 0.5, "fwd_seg_size_avg": 78.0, "bwd_seg_size_avg": 60.0,
    "subflow_fwd_pkts": 2.0, "subflow_fwd_byts": 104.0,
    "subflow_bwd_pkts": 1.0, "subflow_bwd_byts": 60.0,
    "init_fwd_win_byts": 2048.0, "init_bwd_win_byts": 2048.0,
    "fwd_act_data_pkts": 1.0, "fwd_seg_size_min": 20.0,
    "active_mean": 100.0, "active_std": 50.0, "active_max": 500.0,
    "active_min": 0.0, "idle_mean": 50.0, "idle_std": 25.0,
    "idle_max": 500.0, "idle_min": 0.0,
}

# port -> median attack profile (from synthetic_attacks.csv)
_SYN_PROFILES: Dict[int, Dict[str, float]] = {
    1: {  # extreme SYN flood
        "flow_duration": 1.0, "tot_fwd_pkts": 9900.0, "tot_bwd_pkts": 0.0,
        "totlen_fwd_pkts": 396000.0, "totlen_bwd_pkts": 0.0,
        "fwd_pkt_len_max": 40.0, "fwd_pkt_len_min": 40.0, "fwd_pkt_len_mean": 40.0,
        "fwd_pkt_len_std": 0.0, "bwd_pkt_len_max": 0.0, "bwd_pkt_len_min": 0.0,
        "bwd_pkt_len_mean": 0.0, "bwd_pkt_len_std": 0.0,
        "flow_byts_per_s": 396000000000.0, "flow_pkts_per_s": 9900000000.0,
        "flow_iat_mean": 0.0, "flow_iat_std": 0.0, "flow_iat_max": 0.0,
        "flow_iat_min": 0.0, "fwd_iat_tot": 1.0, "fwd_iat_mean": 0.0,
        "fwd_iat_std": 0.0, "fwd_iat_max": 0.0, "fwd_iat_min": 0.0,
        "bwd_iat_tot": 0.0, "bwd_iat_mean": 0.0, "bwd_iat_std": 0.0,
        "bwd_iat_max": 0.0, "bwd_iat_min": 0.0,
        "fwd_header_len": 396000.0, "bwd_header_len": 0.0,
        "fwd_pkts_per_s": 9900000000.0, "bwd_pkts_per_s": 0.0,
        "pkt_len_min": 40.0, "pkt_len_max": 40.0, "pkt_len_mean": 40.0,
        "pkt_len_std": 0.0, "pkt_size_avg": 40.0,
        "syn_flag_cnt": 9900.0, "ack_flag_cnt": 9900.0, "psh_flag_cnt": 0.0,
        "rst_flag_cnt": 0.0, "down_up_ratio": 0.0,
        "fwd_seg_size_avg": 40.0, "bwd_seg_size_avg": 0.0,
        "subflow_fwd_pkts": 9900.0, "subflow_fwd_byts": 396000.0,
        "subflow_bwd_pkts": 0.0, "subflow_bwd_byts": 0.0,
        "init_fwd_win_byts": 0.0, "init_bwd_win_byts": 0.0,
        "fwd_act_data_pkts": 9900.0, "fwd_seg_size_min": 8.0,
        "active_mean": 0.0, "active_std": 0.0, "active_max": 0.0,
        "active_min": 0.0, "idle_mean": 0.0, "idle_std": 0.0,
        "idle_max": 0.0, "idle_min": 0.0,
    },
    22: {  # SSH brute force
        "flow_duration": 50.0, "tot_fwd_pkts": 1000.0, "tot_bwd_pkts": 0.0,
        "totlen_fwd_pkts": 40000.0, "totlen_bwd_pkts": 0.0,
        "fwd_pkt_len_max": 40.0, "fwd_pkt_len_min": 40.0, "fwd_pkt_len_mean": 40.0,
        "fwd_pkt_len_std": 0.0, "bwd_pkt_len_max": 0.0, "bwd_pkt_len_min": 0.0,
        "bwd_pkt_len_mean": 0.0, "bwd_pkt_len_std": 0.0,
        "flow_byts_per_s": 800000000.0, "flow_pkts_per_s": 20000000.0,
        "flow_iat_mean": 0.05, "flow_iat_std": 0.01, "flow_iat_max": 0.1,
        "flow_iat_min": 0.001, "fwd_iat_tot": 50.0, "fwd_iat_mean": 0.05,
        "fwd_iat_std": 0.01, "fwd_iat_max": 0.1, "fwd_iat_min": 0.001,
        "bwd_iat_tot": 0.0, "bwd_iat_mean": 0.0, "bwd_iat_std": 0.0,
        "bwd_iat_max": 0.0, "bwd_iat_min": 0.0,
        "fwd_header_len": 40000.0, "bwd_header_len": 0.0,
        "fwd_pkts_per_s": 20000000.0, "bwd_pkts_per_s": 0.0,
        "pkt_len_min": 40.0, "pkt_len_max": 40.0, "pkt_len_mean": 40.0,
        "pkt_len_std": 0.0, "pkt_size_avg": 40.0,
        "syn_flag_cnt": 1000.0, "ack_flag_cnt": 1000.0, "psh_flag_cnt": 0.0,
        "rst_flag_cnt": 0.0, "down_up_ratio": 0.0,
        "fwd_seg_size_avg": 40.0, "bwd_seg_size_avg": 0.0,
        "subflow_fwd_pkts": 1000.0, "subflow_fwd_byts": 40000.0,
        "subflow_bwd_pkts": 0.0, "subflow_bwd_byts": 0.0,
        "init_fwd_win_byts": 65535.0, "init_bwd_win_byts": 0.0,
        "fwd_act_data_pkts": 1000.0, "fwd_seg_size_min": 8.0,
        "active_mean": 0.0, "active_std": 0.0, "active_max": 0.0,
        "active_min": 0.0, "idle_mean": 0.0, "idle_std": 0.0,
        "idle_max": 0.0, "idle_min": 0.0,
    },
    80: {  # HTTP web attack / flood
        "flow_duration": 100.0, "tot_fwd_pkts": 50000.0, "tot_bwd_pkts": 0.0,
        "totlen_fwd_pkts": 2500000.0, "totlen_bwd_pkts": 0.0,
        "fwd_pkt_len_max": 50.0, "fwd_pkt_len_min": 40.0, "fwd_pkt_len_mean": 50.0,
        "fwd_pkt_len_std": 2.0, "bwd_pkt_len_max": 0.0, "bwd_pkt_len_min": 0.0,
        "bwd_pkt_len_mean": 0.0, "bwd_pkt_len_std": 0.0,
        "flow_byts_per_s": 25000000000.0, "flow_pkts_per_s": 500000000.0,
        "flow_iat_mean": 0.002, "flow_iat_std": 0.001, "flow_iat_max": 0.005,
        "flow_iat_min": 0.0, "fwd_iat_tot": 100.0, "fwd_iat_mean": 0.002,
        "fwd_iat_std": 0.001, "fwd_iat_max": 0.005, "fwd_iat_min": 0.0,
        "bwd_iat_tot": 0.0, "bwd_iat_mean": 0.0, "bwd_iat_std": 0.0,
        "bwd_iat_max": 0.0, "bwd_iat_min": 0.0,
        "fwd_header_len": 2500000.0, "bwd_header_len": 0.0,
        "fwd_pkts_per_s": 500000000.0, "bwd_pkts_per_s": 0.0,
        "pkt_len_min": 40.0, "pkt_len_max": 50.0, "pkt_len_mean": 50.0,
        "pkt_len_std": 2.0, "pkt_size_avg": 50.0,
        "syn_flag_cnt": 50000.0, "ack_flag_cnt": 50000.0, "psh_flag_cnt": 0.0,
        "rst_flag_cnt": 0.0, "down_up_ratio": 0.0,
        "fwd_seg_size_avg": 50.0, "bwd_seg_size_avg": 0.0,
        "subflow_fwd_pkts": 50000.0, "subflow_fwd_byts": 2500000.0,
        "subflow_bwd_pkts": 0.0, "subflow_bwd_byts": 0.0,
        "init_fwd_win_byts": 65535.0, "init_bwd_win_byts": 0.0,
        "fwd_act_data_pkts": 50000.0, "fwd_seg_size_min": 8.0,
        "active_mean": 0.0, "active_std": 0.0, "active_max": 0.0,
        "active_min": 0.0, "idle_mean": 0.0, "idle_std": 0.0,
        "idle_max": 0.0, "idle_min": 0.0,
    },
    21: {  # FTP brute force (slower, prolonged)
        "flow_duration": 300000.0, "tot_fwd_pkts": 500.0, "tot_bwd_pkts": 100.0,
        "totlen_fwd_pkts": 25000.0, "totlen_bwd_pkts": 5000.0,
        "fwd_pkt_len_max": 50.0, "fwd_pkt_len_min": 40.0, "fwd_pkt_len_mean": 50.0,
        "fwd_pkt_len_std": 3.0, "bwd_pkt_len_max": 50.0, "bwd_pkt_len_min": 40.0,
        "bwd_pkt_len_mean": 50.0, "bwd_pkt_len_std": 3.0,
        "flow_byts_per_s": 100.0, "flow_pkts_per_s": 2.0,
        "flow_iat_mean": 600.0, "flow_iat_std": 300.0, "flow_iat_max": 1500.0,
        "flow_iat_min": 50.0, "fwd_iat_tot": 300000.0, "fwd_iat_mean": 600.0,
        "fwd_iat_std": 300.0, "fwd_iat_max": 1500.0, "fwd_iat_min": 50.0,
        "bwd_iat_tot": 300000.0, "bwd_iat_mean": 3000.0, "bwd_iat_std": 1500.0,
        "bwd_iat_max": 8000.0, "bwd_iat_min": 100.0,
        "fwd_header_len": 25000.0, "bwd_header_len": 5000.0,
        "fwd_pkts_per_s": 1.67, "bwd_pkts_per_s": 0.33,
        "pkt_len_min": 40.0, "pkt_len_max": 50.0, "pkt_len_mean": 50.0,
        "pkt_len_std": 3.0, "pkt_size_avg": 50.0,
        "syn_flag_cnt": 500.0, "ack_flag_cnt": 600.0, "psh_flag_cnt": 0.0,
        "rst_flag_cnt": 0.0, "down_up_ratio": 0.2,
        "fwd_seg_size_avg": 50.0, "bwd_seg_size_avg": 50.0,
        "subflow_fwd_pkts": 500.0, "subflow_fwd_byts": 25000.0,
        "subflow_bwd_pkts": 100.0, "subflow_bwd_byts": 5000.0,
        "init_fwd_win_byts": 65535.0, "init_bwd_win_byts": 65535.0,
        "fwd_act_data_pkts": 450.0, "fwd_seg_size_min": 8.0,
        "active_mean": 50000.0, "active_std": 10000.0, "active_max": 80000.0,
        "active_min": 10000.0, "idle_mean": 100000.0, "idle_std": 20000.0,
        "idle_max": 200000.0, "idle_min": 10000.0,
    },
    445: {  # SMB ransomware-style
        "flow_duration": 5000.0, "tot_fwd_pkts": 100.0, "tot_bwd_pkts": 50.0,
        "totlen_fwd_pkts": 15000.0, "totlen_bwd_pkts": 7500.0,
        "fwd_pkt_len_max": 150.0, "fwd_pkt_len_min": 40.0, "fwd_pkt_len_mean": 150.0,
        "fwd_pkt_len_std": 40.0, "bwd_pkt_len_max": 150.0, "bwd_pkt_len_min": 40.0,
        "bwd_pkt_len_mean": 150.0, "bwd_pkt_len_std": 40.0,
        "flow_byts_per_s": 4500.0, "flow_pkts_per_s": 30.0,
        "flow_iat_mean": 166.67, "flow_iat_std": 80.0, "flow_iat_max": 500.0,
        "flow_iat_min": 10.0, "fwd_iat_tot": 5000.0, "fwd_iat_mean": 166.67,
        "fwd_iat_std": 80.0, "fwd_iat_max": 500.0, "fwd_iat_min": 10.0,
        "bwd_iat_tot": 5000.0, "bwd_iat_mean": 250.0, "bwd_iat_std": 100.0,
        "bwd_iat_max": 800.0, "bwd_iat_min": 20.0,
        "fwd_header_len": 5000.0, "bwd_header_len": 2500.0,
        "fwd_pkts_per_s": 20.0, "bwd_pkts_per_s": 10.0,
        "pkt_len_min": 40.0, "pkt_len_max": 150.0, "pkt_len_mean": 150.0,
        "pkt_len_std": 40.0, "pkt_size_avg": 150.0,
        "syn_flag_cnt": 100.0, "ack_flag_cnt": 150.0, "psh_flag_cnt": 0.0,
        "rst_flag_cnt": 0.0, "down_up_ratio": 0.5,
        "fwd_seg_size_avg": 150.0, "bwd_seg_size_avg": 150.0,
        "subflow_fwd_pkts": 100.0, "subflow_fwd_byts": 15000.0,
        "subflow_bwd_pkts": 50.0, "subflow_bwd_byts": 7500.0,
        "init_fwd_win_byts": 65535.0, "init_bwd_win_byts": 65535.0,
        "fwd_act_data_pkts": 80.0, "fwd_seg_size_min": 8.0,
        "active_mean": 1000.0, "active_std": 300.0, "active_max": 2000.0,
        "active_min": 300.0, "idle_mean": 2000.0, "idle_std": 500.0,
        "idle_max": 5000.0, "idle_min": 300.0,
    },
    53: {  # DNS tunneling (crafted on port 53: high-rate, 512B queries)
        "flow_duration": 500000.0, "tot_fwd_pkts": 2000.0, "tot_bwd_pkts": 2000.0,
        "totlen_fwd_pkts": 1024000.0, "totlen_bwd_pkts": 1024000.0,
        "fwd_pkt_len_max": 512.0, "fwd_pkt_len_min": 64.0, "fwd_pkt_len_mean": 512.0,
        "fwd_pkt_len_std": 60.0, "bwd_pkt_len_max": 512.0, "bwd_pkt_len_min": 64.0,
        "bwd_pkt_len_mean": 512.0, "bwd_pkt_len_std": 60.0,
        "flow_byts_per_s": 4096.0, "flow_pkts_per_s": 8.0,
        "flow_iat_mean": 250.0, "flow_iat_std": 80.0, "flow_iat_max": 600.0,
        "flow_iat_min": 20.0, "fwd_iat_tot": 500000.0, "fwd_iat_mean": 250.0,
        "fwd_iat_std": 80.0, "fwd_iat_max": 600.0, "fwd_iat_min": 20.0,
        "bwd_iat_tot": 500000.0, "bwd_iat_mean": 250.0, "bwd_iat_std": 80.0,
        "bwd_iat_max": 600.0, "bwd_iat_min": 20.0,
        "fwd_header_len": 512000.0, "bwd_header_len": 512000.0,
        "fwd_pkts_per_s": 4.0, "bwd_pkts_per_s": 4.0,
        "pkt_len_min": 64.0, "pkt_len_max": 512.0, "pkt_len_mean": 512.0,
        "pkt_len_std": 60.0, "pkt_size_avg": 512.0,
        "syn_flag_cnt": 0.0, "ack_flag_cnt": 0.0, "psh_flag_cnt": 0.0,
        "rst_flag_cnt": 0.0, "down_up_ratio": 1.0,
        "fwd_seg_size_avg": 512.0, "bwd_seg_size_avg": 512.0,
        "subflow_fwd_pkts": 2000.0, "subflow_fwd_byts": 1024000.0,
        "subflow_bwd_pkts": 2000.0, "subflow_bwd_byts": 1024000.0,
        "init_fwd_win_byts": 65535.0, "init_bwd_win_byts": 65535.0,
        "fwd_act_data_pkts": 2000.0, "fwd_seg_size_min": 8.0,
        "active_mean": 50000.0, "active_std": 10000.0, "active_max": 80000.0,
        "active_min": 20000.0, "idle_mean": 2000.0, "idle_std": 500.0,
        "idle_max": 5000.0, "idle_min": 500.0,
    },
}

# attack type -> (profile port, scale factor for packet counts)
_ATTACK_PROFILE_MAP = {
    "sql_injection": (80, 0.2),
    "xss": (80, 0.15),
    "port_scan": (1, 0.1),
    "ddos": (443, 1.0),
    "brute_force": (22, 1.0),
    "zero_day": (80, 0.5),
    "dns_tunneling": (53, 1.0),
    "mitm": (80, 0.1),
    "ransomware": (445, 1.0),
}

_DDOS_PROFILE: Dict[str, float] = dict(_SYN_PROFILES[80])
_DDOS_PROFILE.update(
    {
        "flow_duration": 1000.0, "tot_fwd_pkts": 100000.0,
        "totlen_fwd_pkts": 5000000.0, "syn_flag_cnt": 100000.0,
        "ack_flag_cnt": 100000.0, "subflow_fwd_pkts": 100000.0,
        "subflow_fwd_byts": 5000000.0, "fwd_act_data_pkts": 100000.0,
        "fwd_header_len": 5000000.0, "fwd_pkts_per_s": 100000000.0,
        "flow_pkts_per_s": 100000000.0, "flow_byts_per_s": 5000000000.0,
    }
)
_SYN_PROFILES[443] = _DDOS_PROFILE


def _profile_to_flow(profile: Dict[str, float], scale: float) -> Dict[str, float]:
    """Copy a profile applying a packet-count scale (keeps IATs intact)."""
    flow: Dict[str, float] = dict(profile)
    flow["tot_fwd_pkts"] *= scale
    flow["tot_bwd_pkts"] *= scale
    flow["totlen_fwd_pkts"] *= scale
    flow["totlen_bwd_pkts"] *= scale
    flow["syn_flag_cnt"] *= scale
    flow["ack_flag_cnt"] *= scale
    flow["psh_flag_cnt"] *= scale
    flow["rst_flag_cnt"] *= scale
    flow["fwd_act_data_pkts"] *= scale
    flow["subflow_fwd_pkts"] *= scale
    flow["subflow_fwd_byts"] *= scale
    flow["subflow_bwd_pkts"] *= scale
    flow["subflow_bwd_byts"] *= scale
    flow["fwd_header_len"] *= scale
    flow["bwd_header_len"] *= scale
    # recompute rates from counts + duration (µs)
    dur_s = max(flow["flow_duration"] / 1_000_000.0, 1e-6)
    flow["flow_pkts_per_s"] = (flow["tot_fwd_pkts"] + flow["tot_bwd_pkts"]) / dur_s
    flow["flow_byts_per_s"] = (flow["totlen_fwd_pkts"] + flow["totlen_bwd_pkts"]) / dur_s
    flow["fwd_pkts_per_s"] = flow["tot_fwd_pkts"] / dur_s
    flow["bwd_pkts_per_s"] = flow["tot_bwd_pkts"] / dur_s
    return flow


def build_flow(
    attack: str,
    intensity: str,
    duration_sec: float,
    packets_per_sec: float,
    target: str,
) -> Dict[str, Any]:
    factor = INTENSITY_FACTOR.get(intensity, 1.0)
    port = ATTACK_PORTS.get(attack, 80)
    dst_port = _host_to_port(target, port)
    profile_port, scale = _ATTACK_PROFILE_MAP[attack]

    flow: Dict[str, Any] = dict(_BASE_FLOW)
    flow.update(_profile_to_flow(_SYN_PROFILES[profile_port], scale * factor))
    flow["src_ip"] = f"192.168.1.{random.randint(2, 250)}"
    flow["src_port"] = random.randint(20000, 65000)
    flow["dst_ip"] = target if ":" not in target else target.split(":")[0]
    flow["dst_port"] = dst_port
    if attack == "dns_tunneling":
        flow["protocol"] = "UDP"
    flow["duration_sec"] = duration_sec

    if attack == "port_scan":
        flow["rst_flag_cnt"] = max(flow["rst_flag_cnt"], flow["tot_fwd_pkts"] * 0.05)
    if attack == "sql_injection":
        flow["psh_flag_cnt"] = flow["tot_fwd_pkts"] * 0.8
        flow["fwd_pkt_len_max"] = 600.0
        flow["fwd_pkt_len_mean"] = 520.0
        flow["totlen_fwd_pkts"] = flow["tot_fwd_pkts"] * 520.0
    if attack == "xss":
        flow["psh_flag_cnt"] = flow["tot_fwd_pkts"] * 0.9
        flow["fwd_pkt_len_max"] = 500.0
        flow["fwd_pkt_len_mean"] = 420.0
        flow["totlen_fwd_pkts"] = flow["tot_fwd_pkts"] * 420.0
    if attack == "mitm":
        flow["psh_flag_cnt"] = flow["tot_fwd_pkts"] * 0.5
    if attack == "zero_day":
        flow["fwd_pkt_len_max"] = 700.0
        flow["fwd_pkt_len_mean"] = 620.0
        flow["totlen_fwd_pkts"] = flow["tot_fwd_pkts"] * 620.0

    flow["attack_label"] = ATTACK_LABELS.get(attack, attack)
    return flow


def benign_flow(target: str = "10.0.0.10", duration_sec: float = 5.0) -> Dict[str, Any]:
    """A normal flow built from the real benign median profile."""
    flow: Dict[str, Any] = dict(_BASE_FLOW)
    flow.update(_BENIGN_PROFILE)
    flow["dst_ip"] = target if ":" not in target else target.split(":")[0]
    flow["dst_port"] = 443
    flow["src_ip"] = f"192.168.1.{random.randint(2, 250)}"
    flow["src_port"] = random.randint(20000, 65000)
    flow["duration_sec"] = duration_sec
    flow["attack_label"] = "Normal Traffic"
    return flow
