"""Dashboard, rules, federated endpoints."""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_current_user
from database.db import get_store
from ml.loader import get_models
from ml.rl import get_policy
from schemas.dashboard import (
    DashboardStats,
    FederatedRoundResponse,
    FederatedStatus,
    RuleOut,
    RuleUpdateRequest,
    RuleUpdateResponse,
)
from services.federated import get_federated
from services.orchestrator import get_orchestrator

logger = logging.getLogger("cyber.api.dashboard")
router = APIRouter(tags=["dashboard"])


def _attack_to_row(a: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": a.get("id"),
        "attack_type": a.get("attack_type"),
        "status": a.get("status"),
        "verdict": a.get("verdict"),
        "action": a.get("action"),
        "confidence": a.get("confidence"),
        "anomaly_score": a.get("anomaly_score"),
        "xgb_confidence": a.get("xgb_confidence"),
        "attack_class": a.get("attack_class"),
        "severity": a.get("severity"),
        "mitre_techniques": a.get("mitre_techniques") or [],
        "summary": a.get("summary"),
        "created_at": a.get("created_at"),
    }


async def _visible_attacks(store, user: dict, limit: int) -> list[Dict[str, Any]]:
    """Blue-team members see the red team's adversarial feed; everyone sees their own."""
    team_scope = user.get("role") == "blue"
    return await store.list_attacks(user["id"], limit=limit, team_scope=team_scope)


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(user: dict = Depends(get_current_user)):
    store = get_store()
    attacks = await _visible_attacks(store, user, 100)
    rules = await store.list_rules(active_only=True)
    policy = get_policy()
    models = get_models()
    events: list[Dict[str, Any]] = []
    for a in attacks[:5]:
        evs = await store.list_events(a["id"], limit=12)
        events.extend(evs)

    verdicts = [a.get("verdict") for a in attacks]
    stats = DashboardStats(
        total_attacks=len(attacks),
        attacks_blocked=sum(1 for v in verdicts if v in ("blocked", "quarantined", "redirected")),
        attacks_redirected=sum(1 for v in verdicts if v == "redirected"),
        attacks_allowed=sum(1 for v in verdicts if v == "allowed"),
        active_rules=len(rules),
        policy_version=policy.version,
        model_status=models.status(),
        recent_attacks=[_attack_to_row(a) for a in attacks[:10]],
        recent_events=events,
        recent_logs=await store.list_logs(limit=10),
    )
    return stats


@router.get("/history")
async def history(
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    store = get_store()
    rows = await _visible_attacks(store, user, limit)
    return [_attack_to_row(a) for a in rows]


@router.get("/rules", response_model=list[RuleOut])
async def rules(user: dict = Depends(get_current_user)):
    store = get_store()
    rows = await store.list_rules(active_only=True)
    return [RuleOut(**r) for r in rows]


@router.post("/learning/reset")
async def reset_learning(user: dict = Depends(get_current_user)):
    """Clear adaptive Tier-0 rules without deleting attacks, events, or users."""
    removed = await get_orchestrator().policy_service.reset_learned_rules()
    return {"removed_rules": removed, "message": "Learned defense reset"}


@router.post("/rules/update", response_model=RuleUpdateResponse)
async def rules_update(
    body: RuleUpdateRequest,
    user: dict = Depends(get_current_user),
):
    policy = get_policy()
    result = policy.policy_update(0.5, source=body.params.get("source", "rl"))
    store = get_store()
    await store.create_policy_version(
        {
            "version": result["version"],
            "description": body.description,
            "source": result["source"],
            "params": result["params"],
        }
    )
    return RuleUpdateResponse(**result)


@router.post("/policy/rollback")
async def policy_rollback(user: dict = Depends(get_current_user)):
    """Revert the latest adaptive Tier-0 learning (used by the Policy Repository)."""
    return await get_orchestrator().policy_service.rollback_latest()


@router.get("/policy/current")
async def current_policy(user: dict = Depends(get_current_user)):
    current = await get_store().latest_policy_version()
    if current is None:
        policy = get_policy()
        return {"version": policy.version, "source": "rl", "params": {}, "created_at": None}
    return current


@router.get("/policy/history")
async def policy_history(user: dict = Depends(get_current_user)):
    return await get_store().list_policy_versions(limit=100)


@router.get("/federated", response_model=FederatedStatus)
async def federated_status(user: dict = Depends(get_current_user)):
    return get_federated().status()


@router.post("/federated/round", response_model=FederatedRoundResponse)
async def federated_round(user: dict = Depends(get_current_user)):
    data = await get_federated().aggregate()
    return FederatedRoundResponse(**data)


@router.get("/health")
async def health():
    models = get_models()
    return {
        "status": "ok",
        "models": models.status(),
        "models_ready": models.ready,
        "running_attacks": len(get_orchestrator().running),
    }
