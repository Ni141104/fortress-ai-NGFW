# Deployment Guide — Railway + Supabase

## 1. Create a Supabase project (database)

1. Go to https://supabase.com → New project (free tier is fine).
2. In **Project Settings → Database → Connection string**, copy the
   **Transaction pooler** connection string (PgBouncer, port 6543), e.g.:

   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

   (Do **not** use the direct connection string with `supabase.co:5432` —
   the app adds `statement_cache_size=0` automatically for the pooler.)

## 2. Deploy the backend to Railway

1. Push this folder to a GitHub repository.
2. https://railway.app → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects `railway.json` + `Dockerfile` (Docker build,
   `uvicorn main:app --port $PORT`).
4. Under **Variables** add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your Supabase pooler connection string (above) |
   | `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `CORS_ORIGINS` | your Vercel frontend URL, e.g. `https://my-dashboard.vercel.app` (or `*` for demo) |
   | `ENV` | `production` |

5. **Settings → Networking**: a public domain is generated, e.g.
   `https://cyber-defense.up.railway.app`. The app URL for the frontend
   is this base URL.

> Railway free tier (~300 MB RAM) is enough: FastAPI + IsolationForest
> (~30–40 MB) + XGBoost (~4 MB) + scalers. The app loads models once at
> startup and keeps them in RAM.

## 3. Verify

```
curl https://<your-app>.railway.app/health
# {"status":"ok","models_ready":true}
```

First request: register a user, then `POST /api/attack/launch` with
`{"attack":"zero_day"}` and connect to the returned WebSocket URL to watch
the live pipeline.

## 4. Connect the frontend (Vercel)

- API base URL: `https://<your-app>.railway.app`
- Live events: `wss://<your-app>.railway.app/api/ws/dashboard/{attack_id}`
- Set the API base URL env var in Vercel (`NEXT_PUBLIC_API_URL` / `VITE_API_URL`).
- CORS: add the Vercel origin to `CORS_ORIGINS` in Railway.

## 5. Optional: local run with Supabase

```bash
export DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
uvicorn main:app --reload --port 8000
```

Tables are created automatically at startup (`create_all`).

## Troubleshooting

- **`connection is closed` / pool errors** — make sure you used the
  *transaction pooler* (port 6543), not the direct connection (5432).
- **Models not loaded** (`models_ready: false`) — confirm the `models/`
  folder is committed (3 files, ~50 MB total; Railway git deploys include it).
- **WebSocket connects but no events** — launch the attack *after* the
  frontend has subscribed, or lower `STAGE_DELAY` so the pipeline lasts
  long enough to be observed.
