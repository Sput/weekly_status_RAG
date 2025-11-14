"""
FastAPI backend for RAG chat over weekly updates.

Responsibilities:
- Generate embeddings for user queries using OpenAI
- Retrieve most relevant latest-per-user updates via Supabase RPC
- Compose RAG context and call LLM to answer

Environment variables (see .env.example):
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY, EMBEDDING_MODEL, LLM_MODEL
- CORS_ALLOW_ORIGINS (comma-separated)

Run: uvicorn main:app --reload --port 8787
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
import logging
import time

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# Load environment (optional in prod)
try:
    from dotenv import load_dotenv  # type: ignore
    import pathlib

    # Load .env from this folder
    load_dotenv()
    # Also try loading env from repo root to ease local dev (Next.js .env.local)
    repo_root = pathlib.Path(__file__).resolve().parents[1]
    load_dotenv(repo_root.joinpath('.env'))
    load_dotenv(repo_root.joinpath('.env.local'))
except Exception:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Allow server to boot even if some env vars are missing; endpoints will report helpful errors.


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=8000)
    top_k: int = Field(5, ge=1, le=20)


class ChatResponseDebug(BaseModel):
    mode: str  # "similarity" | "recency"
    reason: Optional[str] = None  # e.g., openai_key_missing, rpc_failed, no_similarity_results, ok
    source: Optional[str] = None  # "rpc" | "rest"
    context_count: int = 0


class ChatResponse(BaseModel):
    query: str
    context: List[Dict[str, Any]]
    answer: str
    debug: Optional[ChatResponseDebug] = None


app = FastAPI(title="Weekly Status RAG API", version="0.1.0")

# Basic logger (avoid logging secrets)
logger = logging.getLogger("rag")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

allow_origins = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def create_embedding(text: str) -> List[float]:
    """Call OpenAI embeddings API and return the vector.

    Uses the model in EMBEDDING_MODEL. Errors raise HTTPException.
    """
    payload = {"input": text, "model": EMBEDDING_MODEL}
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post("https://api.openai.com/v1/embeddings", headers=headers, json=payload)
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"OpenAI embeddings error: {r.text}")
        data = r.json()
        try:
            vec = data["data"][0]["embedding"]
            logger.info("[embed] ok model=%s dur_ms=%d len=%d", EMBEDDING_MODEL, int((time.monotonic()-t0)*1000), len(text or ""))
            return vec
        except Exception as e:  # pragma: no cover - defensive
            raise HTTPException(status_code=500, detail=f"Malformed embeddings response: {e}")


async def match_latest_updates(embedding: List[float], top_k: int) -> List[Dict[str, Any]]:
    """Call Supabase RPC to fetch most similar latest-per-user updates.

    Relies on the SQL function public.match_latest_updates(query_embedding, match_count).
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        # Fallback to empty list if Supabase is not configured
        return []
    rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/match_latest_updates"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }
    payload = {"query_embedding": embedding, "match_count": top_k}
    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(rpc_url, headers=headers, json=payload)
        if r.status_code >= 400:
            # Fall back to recency-based latest updates when embeddings are not available
            logger.warning("[rpc] match_latest_updates failed status=%d; falling back", r.status_code)
            return await fetch_latest_updates(top_k)
        data = r.json()
        if not data:
            logger.info("[rpc] match_latest_updates returned 0 rows; falling back")
            return await fetch_latest_updates(top_k)
        logger.info("[rpc] match_latest_updates ok rows=%d dur_ms=%d", len(data), int((time.monotonic()-t0)*1000))
        return data


async def fetch_latest_updates(top_k: int) -> List[Dict[str, Any]]:
    """Fallback: fetch latest-per-user updates by recency if similarity RPC fails.

    Reads from the view `public.latest_updates_per_user` using Supabase REST.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []
    url = (
        f"{SUPABASE_URL}/rest/v1/latest_updates_per_user?"
        "select=id,user_id,content,created_at&order=created_at.desc&limit="
        f"{max(1, top_k)}"
    )
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=headers)
        if r.status_code >= 400:
            logger.error("[rest] latest_updates_per_user failed status=%d", r.status_code)
            return []
        rows = r.json()
        # Normalize shape to include similarity placeholder for UI
        for row in rows:
            row["similarity"] = 0.0
        logger.info("[rest] latest_updates_per_user ok rows=%d dur_ms=%d", len(rows), int((time.monotonic()-t0)*1000))
        return rows


async def chat_completion(context_snippets: List[Dict[str, Any]], query: str) -> str:
    """Call OpenAI Chat Completions with the provided context and query."""
    system_prompt = (
        "You are an assistant summarizing weekly team updates. Use the provided "
        "context snippets to answer the user concisely, citing relevant updates."
    )
    # Format context as a bullet list with dates and similarity.
    context_text = "\n".join(
        f"- ({s.get('created_at','?')}) sim={round(float(s.get('similarity', 0.0)), 3)}: {s.get('content','')}"
        for s in context_snippets
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {query}"},
    ]

    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": LLM_MODEL, "messages": messages, "temperature": 0.2}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"OpenAI chat error: {r.text}")
        data = r.json()
        return data["choices"][0]["message"]["content"].strip()


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    """Entry point for RAG chat.

    - Embeds the query
    - Fetches top-k similar latest-per-user updates
    - Calls Chat Completions with context
    - Returns context and answer
    """
    # Create embedding; if missing API key, fall back to recency-only context.
    logger.info("[chat] incoming query_len=%d top_k=%d", len(req.query or ""), req.top_k)
    snippets: List[Dict[str, Any]]
    if not OPENAI_API_KEY:
        logger.warning("[chat] OPENAI_API_KEY missing; using recency fallback")
        snippets = await fetch_latest_updates(req.top_k)
        answer = "Here are the latest updates by recency:\n\n" + "\n".join(
            f"- ({s.get('created_at','?')}) {s.get('content','')}" for s in snippets
        )
        logger.info("[chat] returning recency-only response snippets=%d answer_len=%d", len(snippets), len(answer))
        return ChatResponse(
            query=req.query,
            context=snippets,
            answer=answer,
            debug=ChatResponseDebug(mode="recency", reason="openai_key_missing", source="rest", context_count=len(snippets)),
        )

    embedding = await create_embedding(req.query)
    snippets = await match_latest_updates(embedding, req.top_k)
    debug = ChatResponseDebug(mode="similarity", reason="ok", source="rpc", context_count=len(snippets))
    # If no snippets found, try fallback recency
    if not snippets:
        logger.info("[chat] similarity returned no results; using recency fallback")
        snippets = await fetch_latest_updates(req.top_k)
        debug = ChatResponseDebug(mode="recency", reason="no_similarity_results", source="rest", context_count=len(snippets))
    t0 = time.monotonic()
    answer = await chat_completion(snippets, req.query)
    logger.info("[chat] completed snippets=%d gen_ms=%d answer_len=%d", len(snippets), int((time.monotonic()-t0)*1000), len(answer))
    return ChatResponse(query=req.query, context=snippets, answer=answer, debug=debug)


@app.get("/healthz")
async def healthz() -> Dict[str, str]:
    return {"status": "ok"}
