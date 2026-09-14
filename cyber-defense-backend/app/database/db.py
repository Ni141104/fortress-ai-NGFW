"""
Database layer.

Two backends with the same async repository API:
  - PostgresStore  : SQLAlchemy 2.0 async + asyncpg (Supabase / any Postgres)
  - MemoryStore    : in-process fallback when DATABASE_URL is not set
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    func,
    or_,
    select,
    text,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from core.config import get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="blue", server_default="blue")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Attack(Base):
    __tablename__ = "attacks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    attack_type: Mapped[str] = mapped_column(String(50))
    intensity: Mapped[str] = mapped_column(String(20), default="medium")
    duration_sec: Mapped[float] = mapped_column(Float, default=5.0)
    packets_per_sec: Mapped[float] = mapped_column(Float, default=100.0)
    target: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="running")  # running|completed
    verdict: Mapped[str] = mapped_column(String(20), default="pending")  # allow|block|quarantine|rate_limit|honeypot|redirect
    action: Mapped[str] = mapped_column(String(30), default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0)
    xgb_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    attack_class: Mapped[str] = mapped_column(String(50), default="")
    severity: Mapped[str] = mapped_column(String(20), default="info")
    source: Mapped[str] = mapped_column(String(20), default="rl")
    mitre_techniques: Mapped[list] = mapped_column(JSON, default=list)
    flow: Mapped[dict] = mapped_column(JSON, default=dict)
    summary: Mapped[str] = mapped_column(Text, default="")
    rule_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attack_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, default=0)
    stage: Mapped[str] = mapped_column(String(50), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(20))  # allow|block|quarantine|rate_limit|honeypot
    attack_type: Mapped[str] = mapped_column(String(50), default="")
    src_ip: Mapped[str] = mapped_column(String(64), default="")
    dst_ip: Mapped[str] = mapped_column(String(64), default="")
    dst_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    signature: Mapped[str] = mapped_column(String(128), default="", index=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # baseline|learned|manual|rl
    description: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    ttl_sec: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class PolicyVersion(Base):
    __tablename__ = "policy_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(Integer, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(30), default="rl")  # rl|federated|manual
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class FederatedRound(Base):
    __tablename__ = "federated_rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_no: Mapped[int] = mapped_column(Integer, index=True)
    model_type: Mapped[str] = mapped_column(String(30), default="rl")
    clients: Mapped[list] = mapped_column(JSON, default=list)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LogEntry(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[str] = mapped_column(String(20), default="info")
    message: Mapped[str] = mapped_column(Text, default="")
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


def _async_sqlite_url(url: str) -> str:
    """Translate common Postgres URL forms into one asyncpg accepts."""
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    # Supabase pooler (PgBouncer transaction mode) requires no prepared statements
    return url


class PostgresStore:
    """SQLAlchemy async repository backed by PostgreSQL."""

    def __init__(self, url: str, echo: bool = False):
        self.engine: AsyncEngine = create_async_engine(
            _async_sqlite_url(url), echo=echo, pool_pre_ping=True
        )
        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def init(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'blue'"))
        logger.info("PostgreSQL schema ready")

    async def close(self) -> None:
        await self.engine.dispose()

    # --- users ---
    async def create_user(self, username: str, email: str, password_hash: str, role: str = "blue") -> dict:
        async with self.session_factory() as s:
            u = User(username=username, email=email, password_hash=password_hash, role=role)
            s.add(u)
            await s.commit()
            await s.refresh(u)
            return {"id": u.id, "username": u.username, "email": u.email, "role": u.role}

    async def get_user_by_username(self, username: str) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(select(User).where(User.username == username))
            u = res.scalar_one_or_none()
            if not u:
                return None
            return {
                "id": u.id, "username": u.username, "email": u.email,
                "password_hash": u.password_hash, "role": u.role or "blue",
            }

    async def get_user_by_email(self, email: str) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(select(User).where(User.email == email))
            u = res.scalar_one_or_none()
            if not u:
                return None
            return {
                "id": u.id, "username": u.username, "email": u.email,
                "password_hash": u.password_hash, "role": u.role or "blue",
            }

    async def get_user_by_id(self, user_id: int) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(select(User).where(User.id == user_id))
            u = res.scalar_one_or_none()
            if not u:
                return None
            return {
                "id": u.id, "username": u.username, "email": u.email,
                "password_hash": u.password_hash, "role": u.role or "blue",
            }

    async def list_users(self) -> list[dict]:
        async with self.session_factory() as s:
            res = await s.execute(select(User).order_by(User.id.asc()))
            return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role or "blue"} for u in res.scalars()]

    # --- attacks ---
    _ATTACK_COLUMNS = {
        "id", "user_id", "attack_type", "intensity", "duration_sec",
        "packets_per_sec", "target", "status", "verdict", "action",
        "confidence", "anomaly_score", "xgb_confidence", "attack_class",
        "mitre_techniques", "flow", "summary", "rule_id", "error",
        "created_at", "completed_at", "severity", "source",
    }
    async def create_attack(self, data: dict) -> dict:
        clean = {k: v for k, v in data.items() if k in self._ATTACK_COLUMNS}
        clean.setdefault("user_id", 0)
        clean.setdefault("intensity", "medium")
        clean.setdefault("duration_sec", 5.0)
        clean.setdefault("packets_per_sec", 100.0)
        clean.setdefault("target", "")
        clean.setdefault("status", "completed")
        clean.setdefault("verdict", "pending")
        clean.setdefault("action", "")
        clean.setdefault("confidence", 0.0)
        clean.setdefault("anomaly_score", 0.0)
        clean.setdefault("xgb_confidence", 0.0)
        clean.setdefault("attack_class", "")
        clean.setdefault("mitre_techniques", [])
        clean.setdefault("flow", {})
        clean.setdefault("summary", "")
        clean.setdefault("error", "")
        async with self.session_factory() as s:
            a = Attack(**clean)
            s.add(a)
            await s.commit()
            await s.refresh(a)
            return self._attack_dict(a)

    async def update_attack(self, attack_id: str, fields: dict) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(select(Attack).where(Attack.id == attack_id))
            a = res.scalar_one_or_none()
            if not a:
                return None
            for k, v in fields.items():
                setattr(a, k, v)
            await s.commit()
            await s.refresh(a)
            return self._attack_dict(a)

    async def get_attack(self, attack_id: str) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(select(Attack).where(Attack.id == attack_id))
            a = res.scalar_one_or_none()
            return self._attack_dict(a) if a else None

    async def list_red_user_ids(self) -> list[int]:
        """All red-team user ids (whoever owns the adversarial traffic feed)."""
        async with self.session_factory() as s:
            res = await s.execute(select(User.id).where(User.role == "red"))
            return [int(r) for r in res.scalars()]

    async def list_attacks(
        self,
        user_id: int,
        limit: int = 50,
        team_scope: bool = False,
    ) -> list[dict]:
        async with self.session_factory() as s:
            stmt = select(Attack).where(Attack.user_id == user_id)
            if team_scope:
                red_ids = await self.list_red_user_ids()
                stmt = select(Attack).where(
                    or_(Attack.user_id == user_id, Attack.user_id.in_(red_ids))
                )
            stmt = stmt.order_by(Attack.created_at.desc()).limit(limit)
            res = await s.execute(stmt)
            return [self._attack_dict(a) for a in res.scalars()]

    async def count_attacks(self, user_id: int) -> int:
        async with self.session_factory() as s:
            res = await s.execute(
                select(func.count()).select_from(Attack).where(Attack.user_id == user_id)
            )
            return int(res.scalar_one())

    @staticmethod
    def _attack_dict(a: Attack) -> dict:
        return {
            "id": a.id,
            "user_id": a.user_id,
            "attack_type": a.attack_type,
            "intensity": a.intensity,
            "duration_sec": a.duration_sec,
            "packets_per_sec": a.packets_per_sec,
            "target": a.target,
            "status": a.status,
            "verdict": a.verdict,
            "action": a.action,
            "confidence": a.confidence,
            "anomaly_score": a.anomaly_score,
            "xgb_confidence": a.xgb_confidence,
            "attack_class": a.attack_class,
            "severity": a.severity,
            "source": a.source,
            "mitre_techniques": a.mitre_techniques or [],
            "flow": a.flow or {},
            "summary": a.summary,
            "rule_id": a.rule_id,
            "error": a.error,
            "created_at": a.created_at,
            "completed_at": a.completed_at,
        }

    # --- events ---
    async def create_event(self, data: dict) -> dict:
        async with self.session_factory() as s:
            e = Event(**data)
            s.add(e)
            await s.commit()
            return {"id": e.id, **data}

    async def list_events(self, attack_id: str, limit: int = 200) -> list[dict]:
        async with self.session_factory() as s:
            res = await s.execute(
                select(Event)
                .where(Event.attack_id == attack_id)
                .order_by(Event.id.asc())
                .limit(limit)
            )
            return [
                {
                    "id": e.id,
                    "attack_id": e.attack_id,
                    "stage": e.stage,
                    "payload": e.payload or {},
                    "created_at": e.created_at,
                }
                for e in res.scalars()
            ]

    # --- rules ---
    async def create_rule(self, data: dict) -> dict:
        async with self.session_factory() as s:
            r = Rule(**data)
            s.add(r)
            await s.commit()
            await s.refresh(r)
            return self._rule_dict(r)

    async def list_rules(self, active_only: bool = True, limit: int = 200) -> list[dict]:
        async with self.session_factory() as s:
            q = select(Rule).order_by(Rule.priority.asc(), Rule.id.desc())
            if active_only:
                q = q.where(Rule.active.is_(True))
            res = await s.execute(q.limit(limit))
            return [self._rule_dict(r) for r in res.scalars()]

    async def find_rule_by_signature(self, signature: str) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(
                select(Rule).where(Rule.signature == signature, Rule.active.is_(True))
            )
            r = res.scalar_one_or_none()
            return self._rule_dict(r) if r else None

    async def deactivate_rule(self, rule_id: int) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(select(Rule).where(Rule.id == rule_id))
            r = res.scalar_one_or_none()
            if not r:
                return None
            r.active = False
            await s.commit()
            return self._rule_dict(r)

    async def count_rules(self) -> int:
        async with self.session_factory() as s:
            res = await s.execute(
                select(func.count()).select_from(Rule).where(Rule.active.is_(True))
            )
            return int(res.scalar_one())

    @staticmethod
    def _rule_dict(r: Rule) -> dict:
        return {
            "id": r.id,
            "action": r.action,
            "attack_type": r.attack_type,
            "src_ip": r.src_ip,
            "dst_ip": r.dst_ip,
            "dst_port": r.dst_port,
            "signature": r.signature,
            "priority": r.priority,
            "source": r.source,
            "description": r.description,
            "active": r.active,
            "ttl_sec": r.ttl_sec,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
        }

    # --- policy versions ---
    async def create_policy_version(self, data: dict) -> dict:
        async with self.session_factory() as s:
            p = PolicyVersion(**data)
            s.add(p)
            await s.commit()
            await s.refresh(p)
            return {
                "id": p.id, "version": p.version, "description": p.description,
                "source": p.source, "params": p.params or {}, "created_at": p.created_at,
            }

    async def list_policy_versions(self, limit: int = 50) -> list[dict]:
        async with self.session_factory() as s:
            res = await s.execute(
                select(PolicyVersion).order_by(PolicyVersion.id.desc()).limit(limit)
            )
            return [
                {
                    "id": p.id, "version": p.version, "description": p.description,
                    "source": p.source, "params": p.params or {}, "created_at": p.created_at,
                }
                for p in res.scalars()
            ]

    async def latest_policy_version(self) -> Optional[dict]:
        async with self.session_factory() as s:
            res = await s.execute(
                select(PolicyVersion).order_by(PolicyVersion.id.desc()).limit(1)
            )
            p = res.scalar_one_or_none()
            return {
                "id": p.id, "version": p.version, "description": p.description,
                "source": p.source, "params": p.params or {}, "created_at": p.created_at,
            } if p else None

    # --- federated rounds ---
    async def create_federated_round(self, data: dict) -> dict:
        async with self.session_factory() as s:
            fr = FederatedRound(**data)
            s.add(fr)
            await s.commit()
            await s.refresh(fr)
            return {
                "id": fr.id, "round_no": fr.round_no, "model_type": fr.model_type,
                "clients": fr.clients or [], "metrics": fr.metrics or {},
                "created_at": fr.created_at,
            }

    async def list_federated_rounds(self, limit: int = 50) -> list[dict]:
        async with self.session_factory() as s:
            res = await s.execute(
                select(FederatedRound).order_by(FederatedRound.id.desc()).limit(limit)
            )
            return [
                {
                    "id": fr.id, "round_no": fr.round_no, "model_type": fr.model_type,
                    "clients": fr.clients or [], "metrics": fr.metrics or {},
                    "created_at": fr.created_at,
                }
                for fr in res.scalars()
            ]

    # --- logs ---
    async def create_log(self, level: str, message: str, data: Optional[dict] = None) -> None:
        async with self.session_factory() as s:
            s.add(LogEntry(level=level, message=message, data=data or {}))
            await s.commit()

    async def list_logs(self, limit: int = 100) -> list[dict]:
        async with self.session_factory() as s:
            res = await s.execute(
                select(LogEntry).order_by(LogEntry.id.desc()).limit(limit)
            )
            return [
                {
                    "id": l.id, "level": l.level, "message": l.message,
                    "data": l.data or {}, "created_at": l.created_at,
                }
                for l in res.scalars()
            ]


class MemoryStore:
    """In-process fallback store with the same async API as PostgresStore.

    Data is lost on restart. Used only when DATABASE_URL is not configured
    (local demo / quick start).
    """

    def __init__(self):
        self._users: dict[int, dict] = {}
        self._users_by_name: dict[str, dict] = {}
        self._users_by_email: dict[str, dict] = {}
        self._user_seq = 0
        self._attacks: dict[str, dict] = {}
        self._events: list[dict] = []
        self._rules: list[dict] = []
        self._rule_seq = 0
        self._policy_versions: list[dict] = []
        self._policy_seq = 0
        self._fed_rounds: list[dict] = []
        self._logs: list[dict] = []

    async def init(self) -> None:
        logger.info("Using in-memory store (DATABASE_URL not configured)")

    async def close(self) -> None:
        pass

    # --- users ---
    async def create_user(self, username: str, email: str, password_hash: str, role: str = "blue") -> dict:
        self._user_seq += 1
        u = {"id": self._user_seq, "username": username, "email": email, "password_hash": password_hash, "role": role}
        self._users[u["id"]] = u
        self._users_by_name[username] = u
        self._users_by_email[email] = u
        return {"id": u["id"], "username": u["username"], "email": u["email"], "role": u["role"]}

    async def list_users(self) -> list[dict]:
        return [{"id": u["id"], "username": u["username"], "email": u["email"], "role": u.get("role", "blue")} for u in self._users.values()]

    async def get_user_by_username(self, username: str) -> Optional[dict]:
        return self._users_by_name.get(username)

    async def get_user_by_email(self, email: str) -> Optional[dict]:
        return self._users_by_email.get(email)

    async def get_user_by_id(self, user_id: int) -> Optional[dict]:
        return self._users.get(user_id)

    # --- attacks ---
    async def create_attack(self, data: dict) -> dict:
        now = datetime.now(timezone.utc)
        data.setdefault("created_at", now)
        self._attacks[data["id"]] = dict(data)
        return dict(data)

    async def update_attack(self, attack_id: str, fields: dict) -> Optional[dict]:
        a = self._attacks.get(attack_id)
        if not a:
            return None
        a.update(fields)
        return dict(a)

    async def get_attack(self, attack_id: str) -> Optional[dict]:
        a = self._attacks.get(attack_id)
        return dict(a) if a else None

    async def list_red_user_ids(self) -> list[int]:
        return [u["id"] for u in self._users.values() if u.get("role") == "red"]

    async def list_attacks(
        self,
        user_id: int,
        limit: int = 50,
        team_scope: bool = False,
    ) -> list[dict]:
        rows = [a for a in self._attacks.values() if a.get("user_id") == user_id]
        if team_scope:
            red_ids = set(await self.list_red_user_ids())
            rows = [
                a
                for a in self._attacks.values()
                if a.get("user_id") == user_id or a.get("user_id") in red_ids
            ]
        rows.sort(key=lambda a: a.get("created_at") or datetime.min, reverse=True)
        return [dict(r) for r in rows[:limit]]

    async def count_attacks(self, user_id: int) -> int:
        return sum(1 for a in self._attacks.values() if a.get("user_id") == user_id)

    # --- events ---
    async def create_event(self, data: dict) -> dict:
        e = {"id": len(self._events) + 1, **data}
        self._events.append(e)
        return dict(e)

    async def list_events(self, attack_id: str, limit: int = 200) -> list[dict]:
        rows = [e for e in self._events if e.get("attack_id") == attack_id]
        return [dict(r) for r in rows[:limit]]

    # --- rules ---
    async def create_rule(self, data: dict) -> dict:
        self._rule_seq += 1
        r = {"id": self._rule_seq, "active": True, "created_at": datetime.now(timezone.utc), **data}
        self._rules.append(r)
        return dict(r)

    async def list_rules(self, active_only: bool = True, limit: int = 200) -> list[dict]:
        rows = [r for r in self._rules if (not active_only or r.get("active"))]
        rows.sort(key=lambda r: (r.get("priority") or 100, -(r.get("id") or 0)))
        return [dict(r) for r in rows[:limit]]

    async def find_rule_by_signature(self, signature: str) -> Optional[dict]:
        for r in self._rules:
            if r.get("signature") == signature and r.get("active"):
                return dict(r)
        return None

    async def deactivate_rule(self, rule_id: int) -> Optional[dict]:
        for r in self._rules:
            if r.get("id") == rule_id:
                r["active"] = False
                return dict(r)
        return None

    async def count_rules(self) -> int:
        return sum(1 for r in self._rules if r.get("active"))

    # --- policy versions ---
    async def create_policy_version(self, data: dict) -> dict:
        self._policy_seq += 1
        p = {"id": self._policy_seq, "created_at": datetime.now(timezone.utc), **data}
        self._policy_versions.append(p)
        return dict(p)

    async def list_policy_versions(self, limit: int = 50) -> list[dict]:
        rows = sorted(self._policy_versions, key=lambda p: -(p.get("id") or 0))
        return [dict(r) for r in rows[:limit]]

    async def latest_policy_version(self) -> Optional[dict]:
        if not self._policy_versions:
            return None
        return dict(sorted(self._policy_versions, key=lambda p: p.get("id") or 0)[-1])

    # --- federated rounds ---
    async def create_federated_round(self, data: dict) -> dict:
        fr = {"id": len(self._fed_rounds) + 1, "created_at": datetime.now(timezone.utc), **data}
        self._fed_rounds.append(fr)
        return dict(fr)

    async def list_federated_rounds(self, limit: int = 50) -> list[dict]:
        rows = sorted(self._fed_rounds, key=lambda r: -(r.get("id") or 0))
        return [dict(r) for r in rows[:limit]]

    # --- logs ---
    async def create_log(self, level: str, message: str, data: Optional[dict] = None) -> None:
        self._logs.append(
            {"id": len(self._logs) + 1, "level": level, "message": message,
             "data": data or {}, "created_at": datetime.now(timezone.utc)}
        )

    async def list_logs(self, limit: int = 100) -> list[dict]:
        rows = sorted(self._logs, key=lambda l: -(l.get("id") or 0))
        return [dict(r) for r in rows[:limit]]


_store: Any = None


def get_store() -> Any:
    """Global store instance (Postgres or memory fallback)."""
    global _store
    if _store is None:
        settings = get_settings()
        if settings.has_database:
            _store = PostgresStore(settings.database_url, echo=settings.database_echo)
            logger.info("Using PostgreSQL store (Supabase)")
        else:
            _store = MemoryStore()
    return _store


async def init_db() -> None:
    """Create schema (idempotent). Call from app lifespan.

    When PostgreSQL is configured but unreachable (deploy egress blocked, bad
    DATABASE_URL, migration host name string, ...) fall back to the ephemeral
    in-memory store instead of crashing startup. The app stays up; data is
    lost on restart and the warning below points at the root cause.
    """
    global _store
    store = get_store()
    try:
        await store.init()
    except Exception as exc:  # noqa: BLE001
        if isinstance(store, PostgresStore):
            logger.warning(
                "PostgreSQL unreachable (%s). Falling back to in-memory store; "
                "data will not persist. Check DATABASE_URL on the host.",
                exc,
            )
            await store.close()
            reset_store()
            _store = MemoryStore()
            await _store.init()
        else:
            raise


async def close_db() -> None:
    global _store
    if _store is not None:
        await _store.close()
        _store = None


def reset_store() -> None:
    global _store
    _store = None
