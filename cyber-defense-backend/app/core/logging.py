"""
Structured logging setup for the whole application.
"""

import logging
import sys

from .config import get_settings


def setup_logging() -> None:
    settings = get_settings()
    level = logging.DEBUG if settings.env == "development" else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    for noisy in ("uvicorn.access", "asyncio", "numba", "xgboost"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
