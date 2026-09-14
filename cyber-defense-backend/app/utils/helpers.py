"""Small shared helpers used across the app."""

import uuid
from datetime import datetime, timezone


def new_id() -> str:
    """Short unique id for attacks/rooms."""
    return uuid.uuid4().hex[:16]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def safe_round(value: float, digits: int = 4) -> float:
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return 0.0
