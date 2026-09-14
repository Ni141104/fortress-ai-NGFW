"""
AI Cyber Defense Platform - API entry point.

Run locally:  uvicorn main:app --reload --port 8000
Deploy:       Railway (see railway.json / Dockerfile)
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
APP_DIR = BASE_DIR / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from contextlib import asynccontextmanager  # noqa: E402

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from api import api_router  # noqa: E402
from core.config import get_settings  # noqa: E402
from core.logging import setup_logging  # noqa: E402
from database.db import close_db, get_store, init_db  # noqa: E402
from ml.loader import init_models  # noqa: E402
from ml.rl import init_policy  # noqa: E402
from services.federated import init_federated  # noqa: E402
from services.orchestrator import init_orchestrator  # noqa: E402

settings = get_settings()
setup_logging()


async def _seed_rules() -> None:
    """Inert baseline rules (never match real traffic; visible in the UI)."""
    if not settings.seed_rules:
        return
    store = get_store()
    try:
        if await store.count_rules() > 0:
            return
    except Exception:  # noqa: BLE001
        return
    from services.orchestrator import get_orchestrator

    policy = get_orchestrator().policy_service
    for attack_type, action, desc in [
        ("ddos", "block", "Baseline: mitigate volumetric floods"),
        ("port_scan", "rate_limit", "Baseline: throttle port scanning"),
        ("dns_tunneling", "block", "Baseline: block DNS tunnelling"),
    ]:
        await policy.add_rule(
            attack_type=attack_type,
            action=action,
            flow={"src_ip": "10.0.0.0/8", "dst_ip": "*", "dst_port": None},
            source="baseline",
            priority=50,
            description=desc,
        )
    # force the tier-0 cache to see the seeds
    policy._cache_ts = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    init_models()
    init_policy()
    init_orchestrator()
    init_federated()
    await _seed_rules()
    yield
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Interactive AI Cyber Defense Platform (Red Team simulator + Blue Team live dashboard)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    """Spec: every request lands in the logs collection for the dashboard."""
    import time as _time

    start = _time.monotonic()
    response = await call_next(request)
    duration_ms = round((_time.monotonic() - start) * 1000, 2)
    user = request.scope.get("user") or {}
    user_id = user.get("id", 0) if isinstance(user, dict) else 0
    data = {
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "duration_ms": duration_ms,
        "user_id": user_id,
    }
    try:
        import asyncio

        from database.db import get_store

        async def _write() -> None:
            try:
                await get_store().create_log(
                    "info",
                    f"{request.method} {request.url.path} -> {response.status_code}",
                    data,
                )
            except Exception:  # noqa: BLE001
                pass

        asyncio.create_task(_write())
    except Exception:  # noqa: BLE001
        pass
    return response


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "api": settings.api_prefix,
    }


@app.get("/health")
async def health_public():
    from ml.loader import get_models

    return {"status": "ok", "models_ready": get_models().ready}
