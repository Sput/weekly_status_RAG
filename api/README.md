# Weekly Status RAG API

- Runs a FastAPI server that exposes `/chat` and `/healthz`.
- Uses Supabase REST RPC to call `match_latest_updates`.
- Uses OpenAI for embeddings and chat completion.

Quickstart

- Create `.env` (or use root `.env.example`):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`, `EMBEDDING_MODEL`, `LLM_MODEL`
  - `CORS_ALLOW_ORIGINS`
- Install: `pip install -r requirements.txt`
- Run: `uvicorn main:app --reload --port 8787`

Environments

- dev: local `.env`, run on `http://localhost:8787`
- staging/prod: set env vars via your host (Render/Fly.io). Never expose service role keys publicly.

Security

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Frontend reads `NEXT_PUBLIC_BACKEND_URL` to reach this API.

