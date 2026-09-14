# Frontend Integration Guide

**AI Cyber Defense Platform — Backend API + WebSocket reference for the frontend team**

Everything you need to connect the Next.js dashboard to the Railway backend:
base URL, auth, every endpoint (input → output), the live WebSocket protocol,
example code, and TypeScript types.

---

## 1. Quick facts

| Item | Value |
|---|---|
| Base URL (Railway) | `https://<your-app>.railway.app` |
| Interactive API docs | `https://<your-app>.railway.app/docs` (Swagger UI — try every call there) |
| Health check | `GET /health` |
| Auth | JWT Bearer token (`Authorization: Bearer <token>`) |
| Live events | WebSocket, no polling |
| Local dev URL | `http://127.0.0.1:8000` |

> **CORS**: in Railway env vars set `CORS_ORIGINS=https://yourproject.vercel.app`
> (comma-separated for multiple origins). `*` works for demos.

---

## 2. What the backend is (2-minute summary)

A FastAPI service with a real ML detection pipeline. The frontend *launches*
simulated attacks, the backend runs them through the pipeline and streams
every stage live over WebSocket, then persists results.

```
POST /api/attack/launch  ──►  Tier-0 fast rules
                                │
                              Tier-1 IsolationForest (anomaly score)
                                │
                              Tier-2 XGBoost (attack probability)
                                │
                              Collision avoidance → RL decision (block/allow/quarantine/redirect/rate_limit)
                                │
                              Zero-day? → honeypot + behaviour analysis
                                │
                              Policy update → Tier-0 rule learned
                                │
                              Persist → WebSocket events → final result
```

- **9 attack types**: `sql_injection`, `xss`, `port_scan`, `ddos`,
  `brute_force`, `zero_day`, `dns_tunneling`, `mitm`, `ransomware`
- **3 intensities**: `low`, `medium`, `high`
- **Learning loop**: the first time an attack is seen, the full ML pipeline
  runs; the firewall "learns" a Tier-0 rule, so a *second* identical attack
  is blocked instantly (`source: "tier0"`).
- Pipeline takes ~4 s per attack (10 live stages × 0.35 s). Watch it over WS.

---

## 3. Deploy on Railway (frontend devs don't need this, but know it exists)

Push the backend folder to GitHub → Railway → **Deploy from GitHub**.
Add env vars: `DATABASE_URL` (Supabase), `JWT_SECRET`, `CORS_ORIGINS`,
`ENV=production`. Full walkthrough in [`SETUP.md`](./SETUP.md).

---

## 4. Authentication

All endpoints except `/register`, `/login`, `/health`, `/docs` require a
Bearer token.

**Register**

```http
POST /api/auth/register
Content-Type: application/json

{ "username": "alice", "email": "alice@example.com", "password": "secret123" }
```

**Login**

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "alice", "password": "secret123" }
```

**Response (both)** — store `access_token` and send it on every request:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": { "id": 1, "username": "alice", "email": "alice@example.com", "created_at": null }
}
```

**Get current user**

```http
GET /api/auth/me
Authorization: Bearer <token>
```

```json
{ "id": 1, "username": "alice", "email": "alice@example.com", "created_at": null }
```

**Errors**: `409 { "detail": "Username already taken" }` · `401 { "detail": "Invalid credentials" }`

```js
// Frontend: after login, keep the token in memory + localStorage
const login = async (username, password) => {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail);
  localStorage.setItem("token", data.access_token);
  return data;
};

const api = (path, options = {}) =>
  fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...(options.headers || {}),
    },
  });
```

---

## 5. Endpoint reference

### 5.1 Get supported attacks

```http
GET /api/attack/types
```

```json
{
  "attacks": [
    { "id": "sql_injection", "intensities": ["low", "medium", "high"], "description": "Sql Injection" },
    { "id": "xss", "intensities": ["low", "medium", "high"], "description": "Xss" }
  ],
  "defaults": {
    "intensity": "medium",
    "duration_sec": 5.0,
    "packets_per_sec": 500.0,
    "target": "10.0.0.10"
  }
}
```

Use this to populate the Red Team launch form.

### 5.2 Launch an attack ⭐ (the main call)

```http
POST /api/attack/launch
Authorization: Bearer <token>
Content-Type: application/json

{
  "attack": "sql_injection",      // one of the 9 types
  "intensity": "high",            // low | medium | high
  "duration_sec": 3,              // 1..120
  "packets_per_sec": 500,         // 10..1_000_000
  "target": "10.0.0.10"           // host or host:port
}
```

**Response (immediately, ~50 ms):**

```json
{
  "attack_id": "44cc77b3167c4bef",
  "attack": "sql_injection",
  "status": "running",
  "message": "Attack simulation launched; listening on WebSocket",
  "websocket_url": "/api/ws/dashboard/44cc77b3167c4bef"
}
```

> The `wait` field in the schema is ignored — attacks are **always async**.
> Build the WebSocket URL as `wss://<host>` + `websocket_url` and subscribe
> **immediately**, then animate the pipeline live (Section 6).

### 5.3 Attack result (poll/refresh path)

```http
GET /api/attack/{attack_id}
```

```json
{
  "id": "44cc77b3167c4bef",
  "attack_type": "sql_injection",
  "intensity": "high",
  "duration_sec": 3.0,
  "packets_per_sec": 500.0,
  "target": "10.0.0.10",
  "status": "completed",
  "verdict": "blocked",
  "action": "block",
  "confidence": 0.75,
  "anomaly_score": 0.8147,
  "xgb_confidence": 0.6501,
  "attack_class": "sql_injection",
  "severity": "critical",
  "source": "rl",
  "mitre_techniques": ["T1190", "T1059.001"],
  "summary": "SQL Injection flow blocked (75% confidence)",
  "rule_id": null,
  "error": "",
  "created_at": "2026-08-02T14:22:31.123Z",
  "completed_at": null
}
```

**Verdict → action mapping** (drives the badge color in your UI):

| verdict | action | meaning |
|---|---|---|
| `allowed` | `allow` | benign traffic, let through |
| `blocked` | `block` | malicious, dropped |
| `quarantined` | `quarantine` | isolated for inspection |
| `rate_limited` | `rate_limit` | throttled (port scan / low severity) |
| `redirected` | `redirect` | unknown/zero-day → honeypot |

- `source: "tier0"` ⇒ the firewall **already learned** this attack — hit
  instantly, no ML stages.
- `attack_class` is the MITRE-mapped class; `severity` ∈
  `info | low | medium | high | critical`.

### 5.4 Attack history

```http
GET /api/attack?limit=50
```

```json
{
  "total": 10,
  "attacks": [ { /* same shape as 5.3 */ } ]
}
```

Also available as a lighter list: `GET /api/history?limit=50`
(each row: `id, attack_type, status, verdict, action, confidence,
anomaly_score, xgb_confidence, attack_class, severity, mitre_techniques,
summary, created_at`).

### 5.5 Dashboard (Blue Team home)

```http
GET /api/dashboard
```

```json
{
  "total_attacks": 10,
  "attacks_blocked": 8,
  "attacks_redirected": 1,
  "attacks_allowed": 0,
  "active_rules": 12,
  "policy_version": 10,
  "model_status": {
    "isolation_forest": "loaded",
    "if_scaler": "loaded",
    "xgboost": "loaded",
    "preprocess_scaler": "loaded"
  },
  "recent_attacks": [ { "id": "...", "verdict": "blocked", "severity": "critical", "mitre_techniques": ["T1498"] } ],
  "recent_events": [ { "id": 1, "attack_id": "...", "stage": "tier2", "payload": {}, "created_at": "..." } ],
  "recent_logs":   [ { "id": 1, "level": "info", "message": "POST /api/attack/launch -> 200", "data": { "method": "POST", "path": "/api/attack/launch", "status": 200, "duration_ms": 12.3, "user_id": 1 }, "created_at": "..." } ]
}
```

Feed the stat cards, the MITRE/technique chips, and the activity feed from this.

### 5.6 Tier-0 rules

```http
GET /api/rules
```

```json
[
  {
    "id": 4,
    "action": "block",
    "attack_type": "zero_day",
    "src_ip": "*",
    "dst_ip": "*",
    "dst_port": 80,
    "signature": "zero_day|TCP|80",
    "priority": 90,
    "source": "rl",
    "description": "Learned from honeypot containment (zero-day)",
    "active": true,
    "ttl_sec": 3600,
    "created_at": "...",
    "expires_at": null
  }
]
```

`source`: `baseline` (seeded) | `rl` (learned) | `manual`.
Render `source === "rl"` with a "🤖 learned" badge — that's the ML loop made visible.

**Simulate an RL policy update** (for the "Policy Updated" demo button):

```http
POST /api/rules/update
Body: { "description": "Simulated RL policy update", "params": {} }
```

```json
{
  "version": 11,
  "source": "rl",
  "params": { "policy_version": 11, "epsilon": 0.14, "q_table": { "attack": { "block": 0.95 } } },
  "message": "Policy Updated"
}
```

### 5.7 Federated learning (optional demo tab)

```http
GET  /api/federated                 # { enabled, global_round, num_clients, last_round, history }
POST /api/federated/round           # run one aggregation round
```

```json
// POST /api/federated/round →
{
  "round_no": 1,
  "model_type": "rl",
  "clients": [
    { "client_id": "client-1", "weights": { "anomaly_score": 0.35 }, "rewards": { "avg_reward": 0.77 } }
  ],
  "metrics": { "avg_reward": 0.77, "total_events": 3500, "weight_delta": { "attack_probability": 0.23 } },
  "message": ""
}
```

### 5.8 Health

```http
GET /health        # public, no auth → { "status": "ok", "models_ready": true }
GET /api/health    # authed → + model status + running attack count
```

---

## 6. WebSocket — live pipeline ⭐

Connect right after launching (race is fine — the `end` frame + `GET /api/attack/{id}` are your safety net):

```js
const API_URL = "https://<your-app>.railway.app"; // or wss://
const ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}${websocket_url}`); // websocket_url from launch response

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "connected") return; // { type, attack_id }

  // msg = { type: "pipeline", attack_id, stage, payload }
  renderStage(msg.stage, msg.payload);  // see stage table below

  if (msg.stage === "end") {
    const final = msg.payload;          // full result (same shape as GET /api/attack/{id})
    showResult(final);
    ws.close();
  }
};
```

### Stage stream (animate these in order)

| stage | payload keys | UI idea |
|---|---|---|
| `start` | `attack, label, intensity, duration_sec, packets_per_sec, target` | "🎯 Attack launched" banner |
| `tier0` | `hit, message, rule_id?` | "⚡ Fast-rule check…" — if `hit`, pipeline jumps straight to `end` |
| `tier1` | `anomaly_score, outlier_factor, threshold, verdict` | "🧊 Isolation Forest" gauge (score vs threshold) |
| `tier2` | `attack_probability, raw_margin, threshold, verdict` | "🤖 XGBoost" progress bar vs threshold |
| `classify` | `attack_class, confidence, severity, techniques[{id,name,tactic}], attack_label` | MITRE technique chips appear |
| `avoid` | `action, reason` | "🛡 Collision avoidance" |
| `rl_decision` | `state, action, confidence, q_values{block:0.9,...}, source, step` | RL Q-table mini-bars |
| `honeypot` | `service, target, redirected, message` | zero-day only: "🍯 Redirected to honeypot" |
| `behaviour` | `signals[], details[], confidence, classification` | zero-day only: behaviour profile |
| `contain` | `contained, attack_type, threat_level, artifacts, message` | zero-day only: "Threat contained" |
| `policy_update` | `version, message, rule_id?` | "🧠 Policy Updated → Tier-0 updated" |
| `end` | full result (Section 5.3) | Final verdict card + confetti/siren |

Pacing: one stage every ~0.35 s (`STAGE_DELAY`), total ≈ 4 s. The zero-day
run adds 3 extra stages (honeypot/behaviour/contain).

**Zero-day demo flow** (great for the pitch): launch `zero_day` → watch
`redirect → behaviour → contain → policy_update (rule learned)` → launch
`zero_day` again → Tier-0 instantly blocks with `source: "tier0"` →
"the firewall learned it".

---

## 7. Recommended integration flow (Attack page)

```js
// 1. User clicks "Launch SQL Injection (high)"
const launch = await api("/api/attack/launch", {
  method: "POST",
  body: JSON.stringify({ attack, intensity, duration_sec: 3, packets_per_sec: 500, target: "10.0.0.10" }),
}).then(r => r.json());

// 2. Immediately subscribe
const ws = new WebSocket(`${WS_BASE}${launch.websocket_url}`);

// 3. Animate stages (Section 6); on `end` → show verdict, log to history

// 4. (Optional) refresh guarantee if the WS missed early frames:
const result = await api(`/api/attack/${launch.attack_id}`).then(r => r.json());
```

---

## 8. TypeScript types (copy-paste)

```ts
export type AttackType =
  | "sql_injection" | "xss" | "port_scan" | "ddos" | "brute_force"
  | "zero_day" | "dns_tunneling" | "mitm" | "ransomware";
export type Intensity = "low" | "medium" | "high";
export type Verdict = "allowed" | "blocked" | "quarantined" | "rate_limited" | "redirected";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface User { id: number; username: string; email: string; created_at: string | null; }
export interface AuthResponse { access_token: string; token_type: string; user: User; }

export interface AttackResult {
  id: string; attack_type: AttackType; intensity: Intensity;
  duration_sec: number; packets_per_sec: number; target: string;
  status: "running" | "completed" | "error";
  verdict: Verdict; action: "allow" | "block" | "quarantine" | "rate_limit" | "redirect";
  confidence: number; anomaly_score: number; xgb_confidence: number;
  attack_class: string; severity: Severity; source: "rl" | "tier0" | "manual";
  mitre_techniques: string[]; summary: string; rule_id: number | null;
  error: string; created_at: string | null; completed_at: string | null;
}

export interface LaunchResponse { attack_id: string; attack: AttackType; status: string; message: string; websocket_url: string; }

export interface Rule {
  id: number; action: string; attack_type: string; src_ip: string; dst_ip: string;
  dst_port: number | null; signature: string; priority: number;
  source: "baseline" | "rl" | "manual"; description: string; active: boolean;
  ttl_sec: number | null; created_at: string | null; expires_at: string | null;
}

export interface DashboardStats {
  total_attacks: number; attacks_blocked: number; attacks_redirected: number;
  attacks_allowed: number; active_rules: number; policy_version: number;
  model_status: Record<string, string>;
  recent_attacks: Array<Partial<AttackResult>>;
  recent_events: Array<{ id: number; attack_id: string; stage: string; payload: Record<string, unknown>; created_at: string }>;
  recent_logs: Array<{ id: number; level: string; message: string; data: Record<string, unknown>; created_at: string }>;
}

export interface PipelineEvent {
  type: "connected" | "pipeline";
  attack_id?: string;
  stage?: "start" | "tier0" | "tier1" | "tier2" | "classify" | "avoid"
    | "rl_decision" | "honeypot" | "behaviour" | "contain" | "policy_update" | "end";
  payload?: Record<string, unknown>;
}
```

---

## 9. Gotchas

1. **Connect to WS before/right after launch** — stages fire every 0.35 s and
   are broadcast only to subscribers. If you connect late, you miss early
   frames; recover via `GET /api/attack/{id}`.
2. **All attacks are async** — `launch` returns instantly; never block on it.
3. **Second attack of the same type is instant** — Tier-0 learned rule
   (`source: "tier0"`, confidence 0.99). It's a feature, not a bug.
4. **`websocket_url` is relative** — prefix with your base (`https://` →
   `wss://`).
5. **Auth errors** — always `{ "detail": string }`, statuses 400/401/404/409.
6. **`created_at`** may be `null` on freshly registered users; format defensively.
7. **Local dev** — `DATABASE_URL` empty ⇒ in-memory store ⇒ data resets on
   restart. On Railway with Supabase it persists.
