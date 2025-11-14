# Deployment Guide

Supabase (Database)

- Apply SQL: run the files in `supabase/sql` (schema + functions).
- Ensure `OPENAI_API_KEY` is stored in Vault as `OPENAI_API_KEY`.
- The trigger `trg_create_update_embedding` will populate embeddings on insert.

FastAPI (Backend)

- Containerize or deploy to Render/Fly.io/Cloud Run.
- Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `EMBEDDING_MODEL`, `LLM_MODEL`, `CORS_ALLOW_ORIGINS`.
- Expose `/chat`.

Next.js (Frontend)

- Deploy to Vercel (or similar).
- Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL` (point to backend).

Smoke Test

- Sign in, post an update on `/updates`.
- Ask a question on `/chat`; confirm context appears before answer.

