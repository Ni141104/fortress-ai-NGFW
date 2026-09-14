"""Loads the trained models once at startup, keeps them in RAM."""

import logging
import os
import pickle
from typing import Any, Optional

from core.config import BASE_DIR, settings

logger = logging.getLogger("cyber.ml.loader")

MODEL_FILES = {
    "isolation_forest": "isolation_forest_model.pkl",
    "if_scaler": "if_scaler.pkl",
    "xgboost": "tier2_xgboost.pkl",
    "preprocess_scaler": "preprocess_scaler.pkl",
}

_MISSING_GO_TO_LEFT = b"missing_go_to_left"
_PATCHED = b"cyber_patched_tree"


class _PatchedTree:
    """Stubs modern sklearn Tree attributes missing from old pickles."""

    def __init__(self, tree):
        self.tree = tree
        self.missing_go_to_left = None

    def __getattr__(self, item):
        return getattr(self.tree, item)


class _Pickler(pickle.Pickler):
    """Serializes sklearn Trees with missing_go_to_left present."""

    def reducer_override(self, obj):
        if type(obj).__name__ == "Tree" and hasattr(obj, "node_count"):
            return (_unpickle_patched_tree, (_PatchedTree(obj),))
        return NotImplemented


def _unpickle_patched_tree(patched):
    return patched


def _convert_old_tree_pickle(path: str, target: str) -> None:
    """Convert a pre-sklearn-1.0 pickle to modern format."""
    with open(path, "rb") as f:
        obj = pickle.load(f)
    logger.info("Converting old pickle (sklearn<1.0 tree format) -> %s", target)
    with open(target, "wb") as f:
        _Pickler(f).dump(obj)


def _load_pickle(path: str) -> Any:
    import warnings

    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Trying to unpickle estimator .* from version .*",
            category=Warning,
        )
        warnings.filterwarnings(
            "ignore", message="If you are loading a serialized model.*"
        )
        with open(path, "rb") as f:
            return pickle.load(f)


class ModelManager:
    """Holds all loaded models. Instantiated once at startup."""

    def __init__(self, model_dir: Optional[str] = None):
        configured_dir = model_dir or settings.model_dir
        self.model_dir = (
            configured_dir
            if os.path.isabs(configured_dir)
            else os.path.join(str(BASE_DIR), configured_dir)
        )
        self.models: dict[str, Any] = {}
        self.errors: dict[str, str] = {}

    def load(self) -> dict[str, str]:
        """Load every model file; return a status summary."""
        for name, fname in MODEL_FILES.items():
            path = os.path.join(self.model_dir, fname)
            if not os.path.exists(path):
                self.errors[name] = "file not found"
                logger.error("Model file missing: %s", path)
                continue
            try:
                self.models[name] = _load_pickle(path)
                logger.info(
                    "Loaded %s (%s)",
                    name,
                    getattr(self.models[name], "__class__", type(self.models[name])),
                )
            except Exception as exc:  # noqa: BLE001
                self.errors[name] = str(exc)
                logger.exception("Failed to load %s: %s", name, exc)
        return self.errors

    def get(self, name: str) -> Any:
        return self.models.get(name)

    @property
    def ready(self) -> bool:
        required = {"isolation_forest", "xgboost"}
        return required.issubset(self.models.keys())

    def status(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for name in MODEL_FILES:
            if name in self.models:
                out[name] = "loaded"
            elif name in self.errors:
                out[name] = f"error: {self.errors[name]}"
            else:
                out[name] = "missing"
        return out


_model_manager: Optional[ModelManager] = None


def init_models() -> ModelManager:
    global _model_manager
    _model_manager = ModelManager()
    _model_manager.load()
    return _model_manager


def get_models() -> ModelManager:
    assert _model_manager is not None, "models not initialized"
    return _model_manager
