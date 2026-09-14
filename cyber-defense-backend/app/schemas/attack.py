"""Request/response schemas for the attack pipeline."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

ATTACK_TYPES = [
    "sql_injection",
    "xss",
    "port_scan",
    "ddos",
    "brute_force",
    "zero_day",
    "dns_tunneling",
    "mitm",
    "ransomware",
]

INTENSITIES = ["low", "medium", "high"]


class LaunchAttackRequest(BaseModel):
    attack: str = Field(description="Attack type (see GET /attack/types)")
    intensity: str = Field(default="medium", description="low | medium | high")
    duration_sec: float = Field(default=5.0, ge=1.0, le=120.0)
    packets_per_sec: float = Field(default=500.0, ge=10.0, le=1000000.0)
    target: str = Field(default="10.0.0.10", description="Target host or URL")
    wait: bool = Field(default=False, description="Block until pipeline finishes")


class AttackLaunchResponse(BaseModel):
    attack_id: str
    attack: str
    status: str = "running"
    message: str = ""
    websocket_url: str = ""


class PipelineEvent(BaseModel):
    attack_id: str
    stage: str
    timestamp: datetime
    payload: dict[str, Any]


class AttackOut(BaseModel):
    id: str
    attack_type: str
    intensity: str = "medium"
    duration_sec: float = 5.0
    packets_per_sec: float = 100.0
    target: str = ""
    status: str = "completed"
    verdict: str = "pending"
    action: str = ""
    confidence: float = 0.0
    anomaly_score: float = 0.0
    xgb_confidence: float = 0.0
    attack_class: str = ""
    severity: str = "info"
    source: str = "rl"
    mitre_techniques: list[str] = []
    summary: str = ""
    rule_id: int | None = None
    error: str = ""
    created_at: datetime | None = None
    completed_at: datetime | None = None


class AttackListOut(BaseModel):
    total: int
    attacks: list[AttackOut]
