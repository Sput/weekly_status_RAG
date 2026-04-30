# Deploy on Coolify

This repo now deploys as one Next.js application. The legacy `api/` FastAPI service remains in the repository for reference or experimentation, but the production app does not need a second backend application.

## Prerequisites

1. A running Coolify instance with access to your Git repository.
2. Supabase project credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Optional but recommended: `OPENAI_API_KEY` for full RAG answers.

## Docker Compose App

This repo includes a single-service `docker-compose.yml`.

1. New application -> Git Repository.
2. Choose Docker Compose and point it at `docker-compose.yml`.
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL=<your supabase url>`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>`
   - `SUPABASE_URL=<your supabase url>`
   - `SUPABASE_SERVICE_ROLE_KEY=<your service role key>`
   - `OPENAI_API_KEY=<your openai key>` optional
   - `EMBEDDING_MODEL=text-embedding-3-small` optional
   - `LLM_MODEL=gpt-4o-mini` optional
4. Deploy.
5. Map the `web` service on port `3000` to a public URL.

Important:

- Do not set `NEXT_PUBLIC_BACKEND_URL` for the single-app deployment.
- `/api/chat` runs inside the Next.js app and uses Supabase/OpenAI directly from the server route.
- Supported service-key names are `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`; prefer `SUPABASE_SERVICE_ROLE_KEY`.

## Smoke Tests

- `<frontend-url>/` loads the app.
- `<frontend-url>/api/chat/healthz` returns JSON with `mode: "next-direct"` and `ok: true`.
- Post an update on `/dashboard/updates`.
- Ask a question on `/dashboard/updates`; confirm context appears before answer.

## Troubleshooting

- `/api/chat/healthz` returns `ok: false`: verify `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, plus `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`.
- Chat answers only by recency: set `OPENAI_API_KEY` and confirm the `match_latest_updates` SQL function exists.
- Empty context: confirm Supabase vars are set and the database has updates.

## Optional External Backend

If you intentionally deploy a compatible external chat backend, set `EXTERNAL_CHAT_BACKEND_URL` on the Next.js app. The app will try that backend first and fall back to the built-in Next.js chat path if it is unavailable.
