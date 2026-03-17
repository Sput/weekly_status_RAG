# Deploy on Coolify

This repo contains a Next.js frontend and a FastAPI backend. You can deploy them on Coolify in two ways:

- Recommended: Single Docker Compose app (one deployable artifact)
- Alternative: Two separate apps (independent deploys)

---

## 1) Prerequisites

1. A running Coolify instance with access to your Git repository.
2. Supabase project credentials:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend)
3. Optional but recommended: `OPENAI_API_KEY` for full RAG answers.

---

## 2) Single Docker Compose App (Recommended)

This repo includes `Dockerfile`, `api/Dockerfile`, and `docker-compose.yml`.

1. New → Application → Git Repository
2. Choose Docker Compose and point it at `docker-compose.yml`.
3. Set environment variables for the app:
   - `NEXT_PUBLIC_SUPABASE_URL=<your supabase url>`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (optional)
   - `EMBEDDING_MODEL=text-embedding-3-small` (optional)
   - `LLM_MODEL=gpt-4o-mini` (optional)
   - Optional `CORS_ALLOW_ORIGINS=*`
   - Leave `NEXT_PUBLIC_BACKEND_URL` unset unless you intentionally want to override the internal Compose default of `http://api:8787`.
4. Deploy.
5. Map only the `web` service to a public URL. Keep `api` internal unless you explicitly need direct access.

Important:
- The `web` service needs Supabase server-side credentials too, not just the `api` service. The Next.js server routes read and write updates directly on the server side.
- Supported names are `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, plus `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`.

Smoke tests:
- `<frontend-url>/` loads app.
- `<frontend-url>/dashboard/chat` can POST to `/api/chat`.
- Optional internal verification: inspect Compose healthchecks for both `web` and `api`.

---

## 3) Two‑App Deploy (Alternative)

Deploy backend first, then frontend.

### Backend (FastAPI)
1. New → Application → Git Repository
2. Repository: this repo; Branch: your deploy branch; Base directory: `api`
3. Runtime/Build:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port 8787`
   - Container port: `8787`
4. Environment variables:
   - `SUPABASE_URL=<your supabase rest url>`
   - `SUPABASE_SERVICE_ROLE_KEY=<your service role key>`
   - `OPENAI_API_KEY=<your openai key>` (optional but recommended)
   - `EMBEDDING_MODEL=text-embedding-3-small` (optional)
   - `LLM_MODEL=gpt-4o-mini` (optional)
   - `CORS_ALLOW_ORIGINS=*` (can tighten later)
5. Deploy.

Verify: open `<backend-url>/healthz` → should return `{ "status": "ok" }`.

### Frontend (Next.js)
1. New → Application → Git Repository
2. Repository: this repo; Branch: your deploy branch; Base directory: repo root
3. Runtime/Build:
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start -- -p 3000`
   - Container port: `3000`
4. Environment variables:
   - `NEXT_PUBLIC_BACKEND_URL=<the backend URL from above>` (no trailing slash)
   - `NEXT_PUBLIC_SUPABASE_URL=<your supabase url>`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>`
5. Deploy and open the assigned frontend URL.

---

## 4) Troubleshooting

- Frontend 500 on `/api/chat` with `fetch failed`:
  - Compose: Check both services are healthy; `web` should reach `http://api:8787`.
  - Two‑App: `NEXT_PUBLIC_BACKEND_URL` incorrect or backend not running. Verify `<backend-url>/healthz`.
- Backend 502/500:
  - Check backend logs; verify `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; set `OPENAI_API_KEY` for model answers.
- Empty context:
  - Ensure Supabase vars are set and your DB has updates.

---

## 5) Reference: Ports & Paths

- Frontend container port: `3000` → serves Next.js
- Backend container port: `8787` → serves FastAPI (`/chat`, `/healthz`) inside the deployment artifact
- Frontend → Backend:
  - Compose: `NEXT_PUBLIC_BACKEND_URL=http://api:8787`
  - Two‑App: `NEXT_PUBLIC_BACKEND_URL=https://<backend-host>`
