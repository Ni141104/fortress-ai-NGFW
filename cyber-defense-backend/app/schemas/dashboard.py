"""Schemas for dashboard, rules, federated endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_attacks: int = 0
    attacks_blocked: int = 0
    attacks_redirected: int = 0
    attacks_allowed: int = 0
    active_rules: int = 0
    policy_version: int = 0
    model_status: dict[str, Any] = {}
    recent_attacks: list[dict[str, Any]] = []
    recent_events: list[dict[str, Any]] = []
    recent_logs: list[dict[str, Any]] = []


class RuleOut(BaseModel):
    id: int
    action: str
    attack_type: str = ""
    src_ip: str = ""
    dst_ip: str = ""
    dst_port: int | None = None
    signature: str = ""
    priority: int = 100
    source: str = "manual"
    description: str = ""
    active: bool = True
    ttl_sec: int | None = None
    created_at: datetime | None = None
    expires_at: datetime | None = None


class RuleUpdateRequest(BaseModel):
    description: str = "Simulated RL policy update"
    params: dict[str, Any] = {}


class RuleUpdateResponse(BaseModel):
    version: int
    source: str = "rl"
    params: dict[str, Any] = {}
    message: str = ""


class FederatedStatus(BaseModel):
    enabled: bool = True
    global_round: int = 0
    clients: list[dict[str, Any]] = []
    last_round: dict[str, Any] | None = None
    history: list[dict[str, Any]] = []


class FederatedRoundResponse(BaseModel):
    round_no: int
    model_type: str = "rl"
    clients: list[dict[str, Any]] = []
    metrics: dict[str, Any] = {}
    message: str = ""
