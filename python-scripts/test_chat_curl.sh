#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL=${BACKEND_URL:-http://localhost:8787}

curl -sS -X POST "$BACKEND_URL/chat" \
  -H 'Content-Type: application/json' \
  -d '{"query":"What did the team ship this week?","top_k":5}' | jq .

