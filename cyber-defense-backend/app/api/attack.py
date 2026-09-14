"""Attack endpoints: launch simulations, upload captures, list types, get results."""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from api.deps import get_current_user
from core.config import get_settings
from database.db import get_store
from schemas.attack import (
    AttackLaunchResponse,
    AttackListOut,
    AttackOut,
    LaunchAttackRequest,
)
from services.orchestrator import get_orchestrator
from services.pcap import PcapParseError, MAX_FILE_BYTES, flows_from_packets, parse_traffic
from services.templates import ATTACK_TYPES, INTENSITY_FACTOR

logger = logging.getLogger("cyber.api.attack")
router = APIRouter(prefix="/attack", tags=["attack"])

settings = get_settings()

_ALLOWED_CAPTURE_EXTENSIONS = (".pcap", ".pcapng")


async def _visible_attacks(store, user: dict, limit: int) -> List[Dict[str, Any]]:
    """Blue-team members see the red team's adversarial feed; everyone sees their own."""
    team_scope = user.get("role") == "blue"
    return await store.list_attacks(user["id"], limit=limit, team_scope=team_scope)


def _can_view(user: dict, attack: Dict[str, Any]) -> bool:
    if attack.get("user_id") == user["id"]:
        return True
    # blue team can open any red-team incident (shared SOC view)
    return user.get("role") == "blue" and True


@router.get("/types")
async def attack_types():
    return {
        "attacks": [
            {
                "id": t,
                "intensities": list(INTENSITY_FACTOR.keys()),
                "description": t.replace("_", " ").title(),
            }
            for t in ATTACK_TYPES
        ],
        "defaults": {
            "intensity": "medium",
            "duration_sec": 5.0,
            "packets_per_sec": 500.0,
            "target": "10.0.0.10",
        },
    }


@router.post("/launch", response_model=AttackLaunchResponse)
async def launch_attack(
    body: LaunchAttackRequest,
    user: dict = Depends(get_current_user),
):
    if body.attack not in ATTACK_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown attack '{body.attack}'")

    orchestrator = get_orchestrator()
    attack_id = orchestrator.launch({**body.model_dump(), "user_id": user["id"]})
    return AttackLaunchResponse(
        attack_id=attack_id,
        attack=body.attack,
        status="running",
        message="Attack simulation launched; listening on WebSocket",
        websocket_url=f"{settings.api_prefix}/ws/dashboard/{attack_id}",
    )


@router.post("/launch-pcap", response_model=AttackLaunchResponse)
async def launch_pcap_attack(
    file: UploadFile = File(...),
    attack: str = Form(...),
    intensity: str = Form("medium"),
    target: str = Form("10.0.0.10"),
    user: dict = Depends(get_current_user),
):
    """Parse a real .pcap/.pcapng capture and run every flow through the ML pipeline."""
    if attack not in ATTACK_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown attack '{attack}'")

    filename = (file.filename or "capture.pcap").strip()
    if not filename.lower().endswith(_ALLOWED_CAPTURE_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Upload a .pcap or .pcapng traffic capture file",
        )
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Capture file exceeds the 25MB limit")
    try:
        packets = parse_traffic(data)
    except PcapParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if not packets:
        raise HTTPException(
            status_code=422,
            detail="No decodable IP packets found in the capture",
        )
    flows = flows_from_packets(packets)
    if not flows:
        raise HTTPException(
            status_code=422,
            detail="No usable flows could be extracted from the capture",
        )

    orchestrator = get_orchestrator()
    attack_id = orchestrator.launch_pcap(
        {"attack": attack, "intensity": intensity, "target": target, "user_id": user["id"]},
        flows,
        {"filename": filename, "packet_count": len(packets), "packet_bytes": len(data)},
    )
    return AttackLaunchResponse(
        attack_id=attack_id,
        attack=attack,
        status="running",
        message=f"Parsed {len(packets)} packets / {len(flows)} flows from {filename}; pipeline running",
        websocket_url=f"{settings.api_prefix}/ws/dashboard/{attack_id}",
    )


@router.get("/{attack_id}", response_model=AttackOut)
async def attack_result(
    attack_id: str,
    user: dict = Depends(get_current_user),
):
    store = get_store()
    attack = await store.get_attack(attack_id)
    if attack is None or not _can_view(user, attack):
        raise HTTPException(status_code=404, detail="Attack not found")
    return AttackOut(**attack)


@router.get("", response_model=AttackListOut)
async def list_attacks(
    limit: int = Query(default=50, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    store = get_store()
    rows = await _visible_attacks(store, user, limit)
    return AttackListOut(total=len(rows), attacks=[AttackOut(**r) for r in rows])
