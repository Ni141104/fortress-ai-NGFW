"""API module entry point."""

from fastapi import APIRouter

from api.auth import router as auth_router
from api.attack import router as attack_router
from api.dashboard import router as dashboard_router
from api.websocket import router as ws_router
from api.intelligence import router as intelligence_router
from api.admin import router as admin_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(attack_router)
api_router.include_router(dashboard_router)
api_router.include_router(ws_router)
api_router.include_router(intelligence_router)
api_router.include_router(admin_router)
