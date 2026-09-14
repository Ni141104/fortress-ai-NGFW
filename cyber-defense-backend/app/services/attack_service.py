"""
Attack Service (spec name): builds the simulated flow for a launched attack.

Thin facade over services.templates so callers can rely on the
spec-folder contract (`app/services/attack_service.py`). If real packet
ingestion (e.g. Suricata) replaces the simulator later, only this module
changes - the orchestrator and the rest of the pipeline stay identical.
"""

from services.templates import (  # noqa: F401
    ATTACK_LABELS,
    ATTACK_PORTS,
    ATTACK_TYPES,
    INTENSITY_FACTOR,
    benign_flow,
    build_flow,
)

__all__ = [
    "build_flow",
    "benign_flow",
    "ATTACK_TYPES",
    "ATTACK_LABELS",
    "ATTACK_PORTS",
    "INTENSITY_FACTOR",
]
