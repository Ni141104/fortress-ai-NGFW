"""
Application configuration.

All settings are read from environment variables (never hardcoded).
See .env.example for the full list.

Database: PostgreSQL (Supabase recommended). If DATABASE_URL is missing
the app falls back to an in-memory store so it still runs locally.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "AI Cyber Defense Platform"
    app_version: str = "1.0.0"
    env: str = "development"  # development | production
    api_prefix: str = "/api"

    # --- Security ---
    jwt_secret: str = "change-me-in-production-9f8a7b6c5d4e3f2a1b0c"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # --- CORS ---
    cors_origins: str = "*"  # comma separated list of origins

    # --- Database (PostgreSQL / Supabase) ---
    database_url: str = ""
    database_echo: bool = False

    # --- Models ---
    model_dir: str = str(BASE_DIR / "models")

    # --- Tier-2 calibration (Platt-style on raw XGBoost margins) ---
    # Calibrated on real data: benign margins ~ -13, synthetic attacks ~ -9
    xgb_cal_shift: float = -10.25
    xgb_cal_scale: float = 1.0
    xgb_conf_threshold: float = 0.5
    xgb_high_conf_threshold: float = 0.75

    # --- Tier-1 ---
    tier1_threshold: float = 0.6

    # --- RL ---
    rl_min_confidence: float = 0.55
    rl_epsilon: float = 0.15
    rl_gamma: float = 0.9
    rl_lr: float = 0.1
    rl_epsilon_decay: float = 0.95
    rl_model_path: str = ""  # optional SB3 policy zip; skipped when empty

    # --- Tier-0 rule cache ---
    rule_cache_ttl: float = 10.0
    learned_rule_ttl_sec: int = 3600

    # --- Zero-day ---
    zero_day_threat_floor: float = 0.7

    # --- Pipeline pacing (seconds between live stages) ---
    stage_delay: float = 0.35

    # --- Honeypot ---
    honeypot_api_url: str = ""

    # --- Seed data ---
    seed_rules: bool = True
    seed_accounts: bool = True
    seed_account_password: str = "Admin123"

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return ["*"] if "*" in origins else origins

    @property
    def has_database(self) -> bool:
        return bool(self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
