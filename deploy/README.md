# Deployment Guide

Supabase Database

- Apply SQL: run the files in `supabase/sql` (schema + functions).
- Ensure `OPENAI_API_KEY` is available to the app if you want generated answers.
- The trigger `trg_create_update_embedding` will populate embeddings on insert.

Next.js App

- Deploy the repo root as a single Next.js app.
- Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `OPENAI_API_KEY`, `EMBEDDING_MODEL`, `LLM_MODEL`.
- The app handles chat through `/api/chat`; no separate backend is required.

Smoke Test

- Post an update on `/dashboard/updates`.
- Ask a question on `/dashboard/updates`; confirm context appears before answer.
