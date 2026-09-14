"""
Feature mapping between flow dictionaries and model training features.

The trained models were fit on CIC-IDS2017 column names ("Fwd IAT Mean").
Flow dictionaries use lowercase snake_case keys ("fwd_iat_mean").

  - XGBoost (Tier-2): 79 features, exact order from model.feature_names_in_
  - IsolationForest (Tier-1): 78 features, exact training order
"""

import numpy as np
from typing import Any, Dict, List

PROTOCOL_MAP = {"TCP": 6, "UDP": 17, "ICMP": 1, "tcp": 6, "udp": 17, "icmp": 1}

# 79 features, exact order of the trained XGBoost model (feature_names_in_)
XGBOOST_MODEL_FEATURES = [
    "Fwd IAT Mean", "Bwd Pkt Len Std", "Fwd Pkt Len Min", "Idle Mean",
    "Flow IAT Max", "PSH Flag Cnt", "Subflow Fwd Byts", "Bwd Pkt Len Max",
    "Flow Duration", "Fwd URG Flags", "Fwd Blk Rate Avg", "Fwd Pkt Len Max",
    "Flow IAT Min", "Fwd Header Len", "Flow Pkts/s", "Idle Min",
    "Pkt Len Std", "Bwd IAT Max", "Fwd Byts/b Avg", "Bwd IAT Min",
    "Pkt Size Avg", "Bwd PSH Flags", "Flow IAT Mean", "TotLen Fwd Pkts",
    "Fwd IAT Max", "Bwd URG Flags", "RST Flag Cnt", "Fwd Pkt Len Std",
    "Fwd Act Data Pkts", "Pkt Len Max", "Fwd Pkts/s", "Dst Port",
    "Init Bwd Win Byts", "Bwd IAT Mean", "ACK Flag Cnt", "Bwd IAT Std",
    "Down/Up Ratio", "Bwd Pkts/b Avg", "Fwd Seg Size Min", "Fwd Pkts/b Avg",
    "Bwd Blk Rate Avg", "Pkt Len Mean", "Fwd IAT Min", "Active Max",
    "Flow Byts/s", "Idle Std", "Bwd Header Len", "TotLen Bwd Pkts",
    "Pkt Len Min", "Tot Fwd Pkts", "SYN Flag Cnt", "Bwd Pkt Len Min",
    "Fwd Seg Size Avg", "Fwd IAT Tot", "Fwd Pkt Len Mean", "Protocol",
    "Init Fwd Win Byts", "Fwd PSH Flags", "Subflow Bwd Byts", "Bwd Pkt Len Mean",
    "FIN Flag Cnt", "Idle Max", "ECE Flag Cnt", "Bwd Byts/b Avg",
    "Bwd Pkts/s", "URG Flag Cnt", "Pkt Len Var", "Src Port",
    "Subflow Fwd Pkts", "Fwd IAT Std", "Flow IAT Std", "Active Mean",
    "Active Min", "Subflow Bwd Pkts", "Bwd IAT Tot", "Bwd Seg Size Avg",
    "Active Std", "Tot Bwd Pkts", "CWE Flag Count",
]

# 78 features, exact order the IsolationForest was trained on
IF_FEATURE_NAMES = [
    "Flow Duration", "Tot Fwd Pkts", "Tot Bwd Pkts", "TotLen Fwd Pkts",
    "TotLen Bwd Pkts", "Fwd Pkt Len Max", "Fwd Pkt Len Min", "Fwd Pkt Len Mean",
    "Fwd Pkt Len Std", "Bwd Pkt Len Max", "Bwd Pkt Len Min", "Bwd Pkt Len Mean",
    "Bwd Pkt Len Std", "Flow Byts/s", "Flow Pkts/s", "Flow IAT Mean",
    "Flow IAT Std", "Flow IAT Max", "Flow IAT Min", "Fwd IAT Tot",
    "Fwd IAT Mean", "Fwd IAT Std", "Fwd IAT Max", "Fwd IAT Min",
    "Bwd IAT Tot", "Bwd IAT Mean", "Bwd IAT Std", "Bwd IAT Max",
    "Bwd IAT Min", "Fwd PSH Flags", "Bwd PSH Flags", "Fwd URG Flags",
    "Bwd URG Flags", "Fwd Header Len", "Bwd Header Len", "Fwd Pkts/s",
    "Bwd Pkts/s", "Pkt Len Min", "Pkt Len Max", "Pkt Len Mean",
    "Pkt Len Std", "Pkt Len Var", "FIN Flag Cnt", "SYN Flag Cnt",
    "RST Flag Cnt", "PSH Flag Cnt", "ACK Flag Cnt", "URG Flag Cnt",
    "CWE Flag Count", "ECE Flag Cnt", "Down/Up Ratio", "Pkt Size Avg",
    "Fwd Seg Size Avg", "Bwd Seg Size Avg", "Fwd Byts/b Avg", "Fwd Pkts/b Avg",
    "Fwd Blk Rate Avg", "Bwd Byts/b Avg", "Bwd Pkts/b Avg", "Bwd Blk Rate Avg",
    "Subflow Fwd Pkts", "Subflow Fwd Byts", "Subflow Bwd Pkts", "Subflow Bwd Byts",
    "Init Fwd Win Byts", "Init Bwd Win Byts", "Fwd Act Data Pkts", "Fwd Seg Size Min",
    "Active Mean", "Active Std", "Active Max", "Active Min",
    "Idle Mean", "Idle Std", "Idle Max", "Idle Min",
    "SimillarHTTP", "Inbound",
]

NAME_MAPPING = {
    "Flow Duration": "flow_duration",
    "Tot Fwd Pkts": "tot_fwd_pkts",
    "Tot Bwd Pkts": "tot_bwd_pkts",
    "TotLen Fwd Pkts": "totlen_fwd_pkts",
    "TotLen Bwd Pkts": "totlen_bwd_pkts",
    "Fwd Pkt Len Max": "fwd_pkt_len_max",
    "Fwd Pkt Len Min": "fwd_pkt_len_min",
    "Fwd Pkt Len Mean": "fwd_pkt_len_mean",
    "Fwd Pkt Len Std": "fwd_pkt_len_std",
    "Bwd Pkt Len Max": "bwd_pkt_len_max",
    "Bwd Pkt Len Min": "bwd_pkt_len_min",
    "Bwd Pkt Len Mean": "bwd_pkt_len_mean",
    "Bwd Pkt Len Std": "bwd_pkt_len_std",
    "Flow Byts/s": "flow_byts_per_s",
    "Flow Pkts/s": "flow_pkts_per_s",
    "Flow IAT Mean": "flow_iat_mean",
    "Flow IAT Std": "flow_iat_std",
    "Flow IAT Max": "flow_iat_max",
    "Flow IAT Min": "flow_iat_min",
    "Fwd IAT Tot": "fwd_iat_tot",
    "Fwd IAT Mean": "fwd_iat_mean",
    "Fwd IAT Std": "fwd_iat_std",
    "Fwd IAT Max": "fwd_iat_max",
    "Fwd IAT Min": "fwd_iat_min",
    "Bwd IAT Tot": "bwd_iat_tot",
    "Bwd IAT Mean": "bwd_iat_mean",
    "Bwd IAT Std": "bwd_iat_std",
    "Bwd IAT Max": "bwd_iat_max",
    "Bwd IAT Min": "bwd_iat_min",
    "Fwd PSH Flags": "fwd_psh_flags",
    "Bwd PSH Flags": "bwd_psh_flags",
    "Fwd URG Flags": "fwd_urg_flags",
    "Bwd URG Flags": "bwd_urg_flags",
    "Fwd Header Len": "fwd_header_len",
    "Bwd Header Len": "bwd_header_len",
    "Fwd Pkts/s": "fwd_pkts_per_s",
    "Bwd Pkts/s": "bwd_pkts_per_s",
    "Pkt Len Min": "pkt_len_min",
    "Pkt Len Max": "pkt_len_max",
    "Pkt Len Mean": "pkt_len_mean",
    "Pkt Len Std": "pkt_len_std",
    "Pkt Len Var": "pkt_len_var",
    "FIN Flag Cnt": "fin_flag_cnt",
    "SYN Flag Cnt": "syn_flag_cnt",
    "RST Flag Cnt": "rst_flag_cnt",
    "PSH Flag Cnt": "psh_flag_cnt",
    "ACK Flag Cnt": "ack_flag_cnt",
    "URG Flag Cnt": "urg_flag_cnt",
    "CWE Flag Count": "cwe_flag_count",
    "ECE Flag Cnt": "ece_flag_cnt",
    "Down/Up Ratio": "down_up_ratio",
    "Pkt Size Avg": "pkt_size_avg",
    "Fwd Seg Size Avg": "fwd_seg_size_avg",
    "Bwd Seg Size Avg": "bwd_seg_size_avg",
    "Fwd Byts/b Avg": "fwd_byts_b_avg",
    "Fwd Pkts/b Avg": "fwd_pkts_b_avg",
    "Fwd Blk Rate Avg": "fwd_blk_rate_avg",
    "Bwd Byts/b Avg": "bwd_byts_b_avg",
    "Bwd Pkts/b Avg": "bwd_pkts_b_avg",
    "Bwd Blk Rate Avg": "bwd_blk_rate_avg",
    "Subflow Fwd Pkts": "subflow_fwd_pkts",
    "Subflow Fwd Byts": "subflow_fwd_byts",
    "Subflow Bwd Pkts": "subflow_bwd_pkts",
    "Subflow Bwd Byts": "subflow_bwd_byts",
    "Init Fwd Win Byts": "init_fwd_win_byts",
    "Init Bwd Win Byts": "init_bwd_win_byts",
    "Fwd Act Data Pkts": "fwd_act_data_pkts",
    "Fwd Seg Size Min": "fwd_seg_size_min",
    "Active Mean": "active_mean",
    "Active Std": "active_std",
    "Active Max": "active_max",
    "Active Min": "active_min",
    "Idle Mean": "idle_mean",
    "Idle Std": "idle_std",
    "Idle Max": "idle_max",
    "Idle Min": "idle_min",
    "SimillarHTTP": "simillar_http",
    "Inbound": "inbound",
    "Dst Port": "dst_port",
    "Src Port": "src_port",
    "Protocol": "protocol",
}

FEATURE_ALIASES = {
    "flow_byts_per_s": ["flow_byts_s", "Flow Byts/s"],
    "flow_pkts_per_s": ["flow_pkts_s", "Flow Pkts/s"],
    "fwd_pkts_per_s": ["fwd_pkts_s", "Fwd Pkts/s"],
    "bwd_pkts_per_s": ["bwd_pkts_s", "Bwd Pkts/s"],
}


def _flow_value(flow: Dict[str, Any], training_name: str, flow_key: str) -> float:
    """Fetch + sanitize a single feature value from a flow dict."""
    value = flow.get(flow_key, None)
    if value is None and flow_key in FEATURE_ALIASES:
        for alias in FEATURE_ALIASES[flow_key]:
            if alias in flow:
                value = flow[alias]
                break
    if value is None:
        return 0.0
    if training_name == "Protocol" and isinstance(value, str):
        value = PROTOCOL_MAP.get(value, 0)
    try:
        value = float(value)
        if value != value or np.isinf(value):  # NaN / inf
            return 0.0
    except (ValueError, TypeError):
        return 0.0
    return value


def extract_features(flow: Dict[str, Any], names: List[str]) -> np.ndarray:
    """Extract features in the exact order of `names` (training column names)."""
    out = []
    for training_name in names:
        flow_key = NAME_MAPPING.get(
            training_name, training_name.lower().replace(" ", "_")
        )
        out.append(_flow_value(flow, training_name, flow_key))
    return np.array(out, dtype=np.float64)


def extract_xgboost_features(flow: Dict[str, Any]) -> np.ndarray:
    """79 features in exact XGBoost training order."""
    return extract_features(flow, XGBOOST_MODEL_FEATURES)


def extract_if_features(flow: Dict[str, Any]) -> np.ndarray:
    """78 features in exact IsolationForest training order."""
    return extract_features(flow, IF_FEATURE_NAMES)
