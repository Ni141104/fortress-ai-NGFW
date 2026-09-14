"""WebSocket manager: broadcasts pipeline events to dashboard clients."""

import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

logger = logging.getLogger("cyber.ws")

MAX_CONNECTIONS = 64


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: Dict[str, WebSocket] = {}
        self.rooms: Dict[str, List[WebSocket]] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self.owners: Dict[str, int] = {}

    def register_owner(self, room: str, user_id: int) -> None:
        self.owners[room] = user_id

    async def connect(self, room: str, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        if room not in self.rooms:
            self.rooms[room] = []
            self._locks[room] = asyncio.Lock()
        self.rooms[room].append(websocket)
        logger.info("WS connect room=%s clients=%d", room, len(self.rooms[room]))
        await websocket.send_json({"type": "connected", "attack_id": room})
        for event in await self._events(room):
            await websocket.send_json({
                "type": "pipeline",
                "attack_id": room,
                "stage": event["stage"],
                "payload": event.get("payload", {}),
            })

    def disconnect(self, room: str, websocket: WebSocket) -> None:
        if room in self.rooms and websocket in self.rooms[room]:
            self.rooms[room].remove(websocket)
        if room in self.rooms and not self.rooms[room]:
            del self.rooms[room]
            self._locks.pop(room, None)
        if room not in self.rooms:
            self.owners.pop(room, None)

    async def _events(self, room: str) -> List[Dict[str, Any]]:
        from database.db import get_store

        try:
            return await get_store().list_events(room, limit=200)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Event replay failed in %s: %s", room, exc)
            return []

    async def broadcast(self, room: str, message: Dict[str, Any]) -> None:
        clients = list(self.rooms.get(room, []))
        if not clients:
            return
        payload = jsonable_encoder(message)
        for ws in clients:
            try:
                await ws.send_json(payload)
            except Exception as exc:  # noqa: BLE001
                logger.warning("WS send failed in %s: %s", room, exc)
                self.disconnect(room, ws)

    async def send_event(
        self,
        attack_id: str,
        stage: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        message = {
            "type": "pipeline",
            "attack_id": attack_id,
            "stage": stage,
            "payload": payload or {},
        }
        await self.broadcast(attack_id, message)
        self._persist_event(attack_id, stage, payload or {})

    @staticmethod
    def _persist_event(attack_id: str, stage: str, payload: Dict[str, Any]) -> None:
        """Record every pipeline stage (spec: orchestrator records each stage)."""
        from database.db import get_store  # local import to avoid cycles

        async def _write() -> None:
            try:
                await get_store().create_event(
                    {
                        "attack_id": attack_id,
                        "user_id": manager.owners.get(attack_id, 0),
                        "stage": stage,
                        "payload": jsonable_encoder(payload),
                    }
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Event persist failed (%s/%s): %s", attack_id, stage, exc)

        asyncio.create_task(_write())

    async def send_pipeline_start(self, attack_id: str, meta: Dict[str, Any]) -> None:
        await self.send_event(attack_id, "start", meta)

    async def send_pipeline_end(self, attack_id: str, result: Dict[str, Any]) -> None:
        await self.send_event(attack_id, "end", result)


manager = ConnectionManager()


def new_room() -> str:
    return uuid.uuid4().hex[:16]
