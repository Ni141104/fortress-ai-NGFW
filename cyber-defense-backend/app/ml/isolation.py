"""Tier-1: Isolation Forest anomaly scoring."""

import logging
from typing import Any, Dict, Tuple

import numpy as np

from core.config import settings
from ml.feature_mapping import extract_if_features

logger = logging.getLogger("cyber.ml.isolation")

# benign CIC-IDS2017 samples map to roughly 0.5-0.8 here; attacks
# (tiny SYN-only flows) land higher. Empirically calibrated.
_SCORE_SCALE = 5.0


def if_anomaly_score(model: Any, flow: Dict[str, Any]) -> Tuple[float, float, float]:
    """
    Returns (anomaly_score, raw_outlier_factor, features).
    anomaly_score in [0,1], higher = more anomalous.
    """
    features = extract_if_features(flow)
    if model is None:
        return 0.5, 0.0, 0.0

    try:
        X = features.reshape(1, -1)
        raw = model.decision_function(X)[0]  # negative => anomaly
        outlier_factor = -raw
        anomaly_score = 1.0 / (1.0 + np.exp(raw * _SCORE_SCALE))
        anomaly_score = float(np.clip(anomaly_score, 0.0, 1.0))
        return anomaly_score, float(outlier_factor), 0.0
    except Exception as exc:  # noqa: BLE001
        logger.warning("IsolationForest inference failed: %s", exc)
        return 0.5, 0.0, 0.0


def tier1_verdict(
    model: Any, flow: Dict[str, Any], threshold: float | None = None
) -> Dict[str, Any]:
    threshold = settings.tier1_threshold if threshold is None else threshold
    score, outlier_factor, _ = if_anomaly_score(model, flow)
    is_anomaly = score >= threshold
    return {
        "anomaly_score": round(score, 4),
        "outlier_factor": round(outlier_factor, 4),
        "tier1_threshold": threshold,
        "is_anomaly": is_anomaly,
        "verdict": "suspicious" if is_anomaly else "benign",
    }
