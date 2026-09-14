# AI Cyber Defense Platform — Backend

FastAPI backend for the Interactive AI Cyber Defense Platform:
Red Team attack simulator + Blue Team live dashboard with a real ML pipeline.

- **Detection pipeline** (inference only): Tier-0 fast rules → Tier-1 IsolationForest → Tier-2 XGBoost → collision avoidance → RL decision → honeypot/behaviour analysis for zero-days → policy update (RL) → persistence.
- **Models**: the real trained models from the NGFW project (`models/`). Training is offline; only inference runs here.
- **Database**: PostgreSQL via Supabase (SQLAlchemy async + asyncpg). Falls back to an in-memory store when `DATABASE_URL` is unset (local demo).
- **Live UI**: each attack streams pipeline stages over WebSocket (`/api/ws/dashboard/{attack_id}`).

## Quick start (local)

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional; DATABASE_URL empty => in-memory store
uvicorn main:app --reload --port 8000
```

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user |
| GET | `/api/attack/types` | Supported attacks + intensity presets |
| POST | `/api/attack/launch` | Launch an attack simulation (returns attack_id + ws URL) |
| GET | `/api/attack/{id}` | Result of one attack |
| GET | `/api/attack` | Attack history |
| GET | `/api/dashboard` | Dashboard stats (totals, rules, policy, model status, recent events) |
| GET | `/api/history` | Recent attacks |
| GET | `/api/rules` | Active Tier-0 rules |
| POST | `/api/rules/update` | Simulated RL policy update |
| GET | `/api/federated` | Federated learning status |
| POST | `/api/federated/round` | Run one FL aggregation round |
| GET | `/api/health` | Health + model status |
| WS | `/api/ws/dashboard/{attack_id}` | Live pipeline stage events |

Supported attacks: `sql_injection`, `xss`, `port_scan`, `ddos`, `brute_force`,
`zero_day`, `dns_tunneling`, `mitm`, `ransomware`.
Intensities: `low`, `medium`, `high`.

## Pipeline (WebSocket stages)

`start → tier0 → tier1 → tier2 → classify → avoid → rl_decision →
[honeypot → behaviour → contain (zero-day only)] → policy_update → end`

- Tier-0 hit ⇒ "the firewall already learned this attack" (blocked instantly, `source=tier0`).
- Zero-day ⇒ never sent to production; redirected to honeypot, behaviour analysis,
  then a Tier-0 rule is learned so the next identical attack is caught at Tier-0.

## Environment (.env.example)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | *(empty)* | Supabase/Postgres URL; empty = in-memory store |
| `JWT_SECRET` | dev-only | JWT signing secret — change in production |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `MODEL_DIR` | `models` | Where the pickle models live |
| `XGB_CAL_SHIFT` / `XGB_CAL_SCALE` | `-10.25` / `1.0` | Platt-style margin calibration |
| `XGB_CONF_THRESHOLD` / `XGB_HIGH_CONF_THRESHOLD` | `0.5` / `0.75` | Tier-2 verdict thresholds |
| `TIER1_THRESHOLD` | `0.6` | Tier-1 anomaly threshold |
| `RL_EPSILON` / `RL_GAMMA` / `RL_LR` / `RL_EPSILON_DECAY` | `0.15` / `0.9` / `0.1` / `0.95` | RL policy params |
| `STAGE_DELAY` | `0.35` | Seconds between live pipeline stages |
| `SEED_RULES` | `true` | Insert inert baseline rules at startup |

## Project layout

```
main.py               # app entry (uvicorn main:app)
app/
  api/                # routers: auth, attack, dashboard, websocket, deps
  core/               # config, logging, security (JWT + bcrypt)
  database/           # SQLAlchemy models + Postgres/Memory stores
  ml/                 # loader, feature_mapping, isolation, xgboost, rl, mitre_mapping
  schemas/            # pydantic request/response models
  services/
    orchestrator.py   # AttackOrchestrator: full pipeline + attack state
    attack_service.py # facade: attack templates/flow generation (swap point for Suricata)
    pipeline.py       # facade: orchestrator access
    mitigation.py     # facade: honeypot/behaviour/severity actions
    templates.py      # data-grounded attack flow profiles
    policy_service.py # Tier-0 rules + RL learning loop
    honeypot.py       # zero-day redirect + behaviour analysis
    federated.py      # FedAvg on RL weights
  utils/              # helpers (new_id, now_utc, ...)
  websocket/          # connection manager (broadcast + stage persistence)
models/               # trained model pickles (do not delete)
```

## For the frontend team

- **`FRONTEND.md`** — full API + WebSocket integration guide: every endpoint
  with input/output examples, the live pipeline stage stream, TypeScript
  types, and sample fetch/WS code.

## Notes

- The XGBoost model's raw probabilities are crushed; verdicts use a calibrated
  sigmoid on the raw margin (`sig((margin - XGB_CAL_SHIFT) / XGB_CAL_SCALE)`),
  tuned on the real CIC-IDS2017 benign flows vs the synthetic attack dataset.
- Attack templates are median feature profiles from those same datasets, so
  simulated traffic lands in the same regions the models were trained on.
- Federated learning shares only RL policy weights + reward stats (no rules,
  no raw traffic).
- **Single uvicorn worker by design**: the pipeline runs in one process and
  WebSocket rooms are in-process; multi-worker would require Redis pub/sub
  to route live events. (Spec's gunicorn `-w 2` was deliberately not applied.)
- Every pipeline stage is persisted to the `events` collection/table and every
  HTTP request is written to `logs`; both surface on the dashboard.
