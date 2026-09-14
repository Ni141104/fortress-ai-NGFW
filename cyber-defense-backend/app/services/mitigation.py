"""
Mitigation Service (spec name): containment actions for verdicts.

Thin facade over services.honeypot (zero-day redirect, behaviour
analysis, honeypot quenching) plus the severity -> action mapping used
when the RL policy needs a fallback mitigation decision.
"""

from services.honeypot import (  # noqa: F401
    behaviour_analysis,
    quench_attack,
    redirect_to_honeypot,
)
from services.policy_service import SEVERITY_ACTION  # noqa: F401

__all__ = [
    "redirect_to_honeypot",
    "behaviour_analysis",
    "quench_attack",
    "SEVERITY_ACTION",
]
