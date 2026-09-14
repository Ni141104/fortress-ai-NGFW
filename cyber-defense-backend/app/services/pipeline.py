"""
Pipeline Service (spec name): the detection pipeline orchestrator.

Thin facade over services.orchestrator (AttackOrchestrator). The
orchestrator executes the full pipeline - Tier-0 -> Tier-1 (Isolation
Forest) -> Tier-2 (XGBoost) -> collision avoidance -> RL decision ->
honeypot/behaviour analysis -> policy update -> persistence + WebSocket
events - and manages the state of every attack run.
"""

from services.orchestrator import (  # noqa: F401
    AttackOrchestrator,
    get_orchestrator,
    init_orchestrator,
)

PipelineService = AttackOrchestrator

__all__ = ["AttackOrchestrator", "PipelineService", "init_orchestrator", "get_orchestrator"]
