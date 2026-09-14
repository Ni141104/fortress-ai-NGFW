"""ML layer entry point."""

from ml.loader import init_models, get_models, ModelManager
from ml.rl import init_policy, get_policy, state_features
from ml.feature_mapping import (
    extract_xgboost_features,
    extract_if_features,
    XGBOOST_MODEL_FEATURES,
    IF_FEATURE_NAMES,
)
from ml.isolation import if_anomaly_score, tier1_verdict
from ml.xgboost import xgb_score, tier2_verdict
from ml.mitre_mapping import (
    get_techniques,
    get_technique_ids,
    infer_attack_type,
    get_attack_severity,
)

__all__ = [
    "init_models",
    "get_models",
    "ModelManager",
    "init_policy",
    "get_policy",
    "state_features",
    "extract_xgboost_features",
    "extract_if_features",
    "XGBOOST_MODEL_FEATURES",
    "IF_FEATURE_NAMES",
    "if_anomaly_score",
    "tier1_verdict",
    "xgb_score",
    "tier2_verdict",
    "get_techniques",
    "get_technique_ids",
    "infer_attack_type",
    "get_attack_severity",
]
