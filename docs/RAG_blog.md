RAG In This App
  
  - Goal: Ground chat answers in the team’s freshest, most relevant weekly updates.
  - Approach: Retrieval Augmented Generation (RAG) that embeds both user queries and updates, retrieves the most similar “latest-per-user” snippets, and prompts the LLM with those snippets as
  explicit context.
  - Outcome: Credible, traceable responses with visible sources and graceful fallbacks.
  
  Data + Vectors
  
  - Tables: users, updates with updates.embedding vector(1536) for pgvector.
  - Index: ivfflat index over embedding with cosine distance for efficient ANN search.
  - Freshness: A view latest_updates_per_user ensures exactly one most-recent update per user, avoiding multi-snippet crowding from the same person.
  
  Embedding Pipeline
  
  - On Update: When a user submits an update, it’s stored in public.updates.
  - Embedding Creation: Two supported patterns:
      - DB trigger (supabase/sql/002_functions.sql): create_embedding() calls OpenAI Embeddings and writes back embedding.
      - App‑side (optional): A backend job or edge function computes embeddings after insert.
  - Query Embedding: At chat time, FastAPI embeds the user’s query via OpenAI (text-embedding-3-small by default).
  
  Retrieval Strategy
  
  - Similarity over Latest: The RPC match_latest_updates(query_embedding, match_count) searches only the latest update per user and returns the top‑K by cosine similarity.
  - Diversity by Design: Latest‑per‑user constraint yields team coverage (one update per person) while still ranking by semantic match.
  - Parameters: top_k (1–20) is user‑tunable in the UI; ANN performance tuned by ivfflat lists.
  - Fallback: If embeddings, RPC, or data are unavailable, the backend fetches the recency view (latest_updates_per_user) so users still see context.
  
  Prompt Construction
  
  - Context Formatting: FastAPI converts retrieved rows into a compact bullet list with timestamp and similarity:
      - “(2024‑11‑06) sim=0.842: Shipped feature X …”
  - System Message: “Summarize weekly team updates, cite relevant snippets.”
  - User Message: Includes the formatted context plus the user’s question.
  - Model: GPT‑4o‑mini with low temperature (0.2) for concise, grounded answers.
  
  Service Boundaries
  
  - Next.js Frontend: UI for posting updates and chatting (src/app/updates, src/app/chat).
  - Proxy Route: POST /api/chat forwards to FastAPI (src/app/api/chat/route.ts), keeping the browser same‑origin.
  - FastAPI Backend: Orchestrates embeddings, retrieval, prompting, and fallbacks (api/main.py).
  - Supabase: Postgres + pgvector, RLS for app clients, Service Role used server‑side for RPC/REST.
  
  Observability + Trust
  
  - User‑Visible Context: The chat page shows the exact snippets used before the model’s answer.
  - Debug Telemetry: Backend returns debug with mode (similarity|recency), source (rpc|rest), reason (e.g., openai_key_missing), and context_count.
  - Logging: Timings for embeddings, RPC, and generation inform tuning and capacity planning.
  
  Tuning Levers
  
  - Relevance vs. Coverage: Keep latest‑per‑user for coverage; increase top_k for richer context.
  - Model Choices: Swap embedding or chat models independently to balance cost/quality.
  - Index Settings: Adjust ivfflat lists and reindex cadence as data grows.
  - Future Enhancements: Add MMR/reranking, semantic filters (team/project), or similarity thresholds to trim weak context.
  
  Failure Modes & Fallbacks
  
  - No OpenAI Key: Backend switches to recency mode and marks debug.reason = "openai_key_missing".
  - RPC Error/Empty: Falls back to recency retrieval to avoid blank answers.
  - Missing Embeddings: Rows without vectors are skipped in similarity mode; recency still includes them.
  
  End‑to‑End Sequence
  
  - User submits update → stored in updates → embedding created (DB trigger or job).
  - User asks a question → FastAPI embeds query → RPC retrieves top‑K latest‑per‑user matches → FastAPI prompts GPT with those snippets → UI shows context + answer + debug.