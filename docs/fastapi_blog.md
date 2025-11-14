Why A Separate FastAPI Service
  
  - Clear boundary: Next.js owns UX; FastAPI owns retrieval + AI orchestration. That separation keeps UI concerns (routing, forms, caching) cleanly decoupled from data/LLM logic, which evolves
  independently.
  - Secret isolation: OPENAI_API_KEY and Supabase SERVICE_ROLE never touch the browser. They live only in the Python backend, reducing exposure and simplifying audit.
  - Operational flexibility: Scale, rate‑limit, and monitor AI traffic separately from web traffic. Spikes in chat don’t slow page loads.
  - Python ecosystem: Retrieval, evaluation, and data tooling (async, httpx, Pydantic, analytics libs) are mature and fast to iterate on in Python.
  
  What FastAPI Owns
  
  - Embeddings + Retrieval: Creates query embeddings (OpenAI) and retrieves the most similar “latest‑per‑user” updates via Supabase RPC (match_latest_updates), with a recency fallback
  (latest_updates_per_user).
  - Answer generation: Calls GPT‑4o‑mini with an explicit, transparent context payload and returns both context and answer.
  - Defensive fallbacks: If env isn’t fully configured (e.g., missing OPENAI_API_KEY), it degrades gracefully to a recency summary and sets a debug mode for the UI to display.
  - Security boundary: Uses the Supabase Service Role for RPC/REST; keeps it server‑side and out of the Next.js bundle.
  
  How It Connects To Next.js
  
  - Proxy route: The app calls POST /api/chat in Next.js (src/app/api/chat/route.ts), which forwards to the FastAPI service (NEXT_PUBLIC_BACKEND_URL, default http://localhost:8787).
  - Same‑origin UX: The browser never talks cross‑origin to Python; no extra CORS dance in the front end.
  - Debug visibility: FastAPI returns debug metadata (mode, source, reason, context_count) that the UI surfaces for trust and troubleshooting.
  
  Why Not Only Next.js Server Actions
  
  - Secret scope: You can call OpenAI from Next server actions, but you still need the Supabase Service Role for RPC—keeping both secrets in a JS server increases risk and complicates
  least‑privilege design.
  - Team fit: Data/ML folks often prefer Python for experiments, evaluators, and retrieval logic. FastAPI offers a crisp contract and Pydantic models for type‑safe IO.
  - Portability: Switching LLM providers, adding re‑rankers, or moving vector search is easier behind a stable Python API than rewriting Node code paths.
  
  Why Not Only Supabase Functions/Triggers
  
  - Great for ingestion: The provided SQL/trigger (create_embedding) is ideal for on‑insert embeddings.
  - Not ideal for chat orchestration: Multi‑hop calls (embed → retrieve → generate) with robust error handling, timeouts, and retries are clearer in an app server than PL/pgSQL or edge functions.
  
  Resilience And Fallbacks
  
  - Similarity → Recency: If the RPC errors or returns empty, FastAPI falls back to recency retrieval.
  - Keyless mode: Without OPENAI_API_KEY, it returns a plain “latest updates” summary and sets debug.reason = "openai_key_missing".
  - Observability: Centralized logs for OpenAI latency, RPC timings, and failure reasons allow targeted tuning.
  
  Security And Compliance
  
  - Secrets at rest: OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY are only loaded in api/main.py.
  - Narrow surface: The browser only hits Next.js; Next only hits FastAPI; FastAPI is the only process allowed to use service‑level Supabase and LLM credentials.
  - Policy alignment: RLS policies still govern reads/writes for app clients; the backend uses service role only for retrieval RPCs/views designed for this feature.
  
  Performance And Cost
  
  - Right‑sized scaling: Scale FastAPI on CPU/memory tuned to embeddings/chat; scale Next.js on concurrent connections/static delivery.
  - Caching opportunities: Add request/result caching (e.g., for repeated queries) in Python without affecting page cache strategies in Next.js.
  - Model agility: Swap models, add rerankers, or batch embeddings on the Python side to control spend.
  
  Developer Experience
  
  - Simple API: One endpoint (POST /chat) with a small Pydantic contract: { query, top_k } → { context[], answer, debug }.
  - Local dev: Run uvicorn main:app --reload --port 8787 and pnpm dev. The proxy takes care of wiring.
  - Typed models: Pydantic schemas (ChatRequest, ChatResponse) keep integration robust and self‑documenting.
  
  Deployment Model
  
  - FastAPI: Container or process manager hosting on :8787. Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, EMBEDDING_MODEL, LLM_MODEL, and CORS_ALLOW_ORIGINS if needed.
  - Next.js: Uses NEXT_PUBLIC_BACKEND_URL to proxy chat requests to FastAPI.
  - Supabase: Apply supabase/sql/*.sql (tables, view, RPC, optional embedding trigger). Ensure vector extension is enabled.
  
  Trade‑Off Summary
  
  - Pros: Strong separation of concerns, safer secret handling, Python ecosystem, independent scaling, better observability.
  - Cons: Another service to deploy/monitor; a small proxy hop from Next.js.
  - Net: For RAG chat over team updates—with secrets, fallbacks, and rapid iteration needs—the FastAPI tier is the right abstraction line.