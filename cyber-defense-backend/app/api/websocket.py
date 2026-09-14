"""WebSocket endpoint: live pipeline events per attack."""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.security import decode_access_token
from database.db import get_store
from websocket.manager import manager

logger = logging.getLogger("cyber.api.ws")
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/dashboard/{attack_id}")
async def ws_dashboard(websocket: WebSocket, attack_id: str):
    token = websocket.query_params.get("token")
    payload = decode_access_token(token) if token else None
    if payload is None:
        await websocket.close(code=1008, reason="Authentication required")
        return
    user = await get_store().get_user_by_id(int(payload["sub"]))
    attack = await get_store().get_attack(attack_id)
    owner_id = manager.owners.get(attack_id)
    if user is None or (attack is not None and attack.get("user_id") != user["id"]) or (attack is None and owner_id != user["id"]):
        await websocket.close(code=1008, reason="Attack not found")
        return

    await manager.connect(attack_id, websocket, user["id"])
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(attack_id, websocket)
    except Exception as exc:  # noqa: BLE001
        logger.warning("WS error in %s: %s", attack_id, exc)
        manager.disconnect(attack_id, websocket)
