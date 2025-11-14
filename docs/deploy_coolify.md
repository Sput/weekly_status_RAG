# Deploy on Coolify

This repo contains a Next.js frontend and a FastAPI backend. You can deploy them on Coolify in two ways:

- Recommended: Two separate apps (simplest)
- Alternative: Single Docker Compose app (internal networking)

---

## 1) Prerequisites

1. A running Coolify instance with access to your Git repository.
2. Supabase project credentials:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend)
3. Optional but recommended: `OPENAI_API_KEY` for full RAG answers.

---

## 2) Two‑App Deploy (Recommended)

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

Smoke test: open the Chat page, submit a question. Watch frontend logs for `[api/chat]` and backend logs for `[chat]`.

Hardening (optional): Set backend `CORS_ALLOW_ORIGINS` to the exact frontend URL, then redeploy backend.

Custom domains later: When you assign domains, update `NEXT_PUBLIC_BACKEND_URL` on the frontend to the backend domain; redeploy frontend. If you tightened CORS, update it to the new frontend domain and redeploy backend.

---

## 3) Single Docker Compose App (Alternative)

This repo includes `Dockerfile`, `api/Dockerfile`, and `docker-compose.yml`.

Benefits:
- Frontend calls backend via the internal Docker network (`http://api:8787`).
- You don’t need to copy the backend URL into the frontend env.

Steps:
1. New → Docker Compose → connect this repo → pick `docker-compose.yml`.
2. Set environment variables for the app:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (optional)
   - Optional `CORS_ALLOW_ORIGINS=*`
   - You can leave `NEXT_PUBLIC_BACKEND_URL` unset; it defaults to `http://api:8787` in `docker-compose.yml`.
3. Deploy. Map the `web` service to a public URL in Coolify (the `api` service can remain internal or be exposed too if desired).

Smoke tests:
- `<frontend-url>/` loads app.
- `<frontend-url>/dashboard/chat` can POST to `/api/chat`.
- Optional: expose API and open `<backend-url>/healthz` → `{ "status": "ok" }`.

---

## 4) Troubleshooting

- Frontend 500 on `/api/chat` with `fetch failed`:
  - Two‑App: `NEXT_PUBLIC_BACKEND_URL` incorrect or backend not running. Verify `<backend-url>/healthz`.
  - Compose: Check both services are healthy; `web` should reach `http://api:8787`.
- Backend 502/500:
  - Check backend logs; verify `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; set `OPENAI_API_KEY` for model answers.
- Empty context:
  - Ensure Supabase vars are set and your DB has updates.

---

## 5) Reference: Ports & Paths

- Frontend container port: `3000` → serves Next.js
- Backend container port: `8787` → serves FastAPI (`/chat`, `/healthz`)
- Frontend → Backend:
  - Two‑App: `NEXT_PUBLIC_BACKEND_URL=https://<backend-host>`
  - Compose: `NEXT_PUBLIC_BACKEND_URL=http://api:8787`

