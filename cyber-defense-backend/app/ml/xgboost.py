"""Tier-2: XGBoost attack classification with margin calibration.

The trained XGBClassifier's probabilities are crushed (max ~0.04), so
we calibrate on the raw margin (decision function) instead:
    p = sigmoid((margin - XGB_CAL_SHIFT) / XGB_CAL_SCALE)
"""

import logging
from typing import Any, Dict

import numpy as np

from core.config import settings
from ml.feature_mapping import extract_xgboost_features

logger = logging.getLogger("cyber.ml.xgboost")

_XGB_CLASSES = None


def _sigmoid(x: float) -> float:
    if x >= 0:
        return 1.0 / (1.0 + np.exp(-x))
    ex = np.exp(x)
    return ex / (1.0 + ex)


def xgb_score(model: Any, flow: Dict[str, Any]) -> Dict[str, Any]:
    """Return calibrated attack probability + raw margin."""
    features = extract_xgboost_features(flow)
    if model is None:
        return {"probability": 0.0, "raw_margin": 0.0, "raw_probability": 0.0}

    global _XGB_CLASSES
    try:
        X = features.reshape(1, -1)
        margin = float(model.predict(X, output_margin=True)[0])

        cal_shift = settings.xgb_cal_shift
        cal_scale = settings.xgb_cal_scale
        probability = _sigmoid((margin - cal_shift) / cal_scale)
        probability = float(np.clip(probability, 0.0, 1.0))

        if _XGB_CLASSES is None:
            _XGB_CLASSES = list(getattr(model, "classes_", [0, 1]))
        proba = model.predict_proba(X)[0]
        raw_probability = float(proba[1] if len(proba) > 1 else proba[0])

        return {
            "probability": round(probability, 4),
            "raw_margin": round(margin, 4),
            "raw_probability": round(raw_probability, 6),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("XGBoost inference failed: %s", exc)
        return {"probability": 0.0, "raw_margin": 0.0, "raw_probability": 0.0}


def tier2_verdict(
    model: Any, flow: Dict[str, Any], threshold: float | None = None
) -> Dict[str, Any]:
    threshold = settings.xgb_conf_threshold if threshold is None else threshold
    scores = xgb_score(model, flow)
    is_attack = scores["probability"] >= threshold
    return {
        "attack_probability": scores["probability"],
        "raw_margin": scores["raw_margin"],
        "threshold": threshold,
        "is_attack": is_attack,
        "verdict": "attack" if is_attack else "benign",
    }
