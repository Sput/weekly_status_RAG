http://
plan.md
# Weekly Status + RAG Chat Feature Implementation Plan

**Overall Progress:** `100%`

---

## Tasks:

### 🧩 Step 1: Database & Supabase Setup ✅ Done
- [x] ￼ Create `roles` table (`id`, `name`)
- [x] ￼ Create `users` table (`id`, `name`, `email`, `role_id`, `created_at`)
- [x] ￼ Create `updates` table (`id`, `user_id`, `content`, `embedding`, `created_at`)
- [x] ￼ Enable pgvector extension for embeddings
- [x] ￼ Add RLS policies:
  - [x] ￼ All users can read all updates
  - [x] ￼ Only authenticated users can insert their own updates
- [x] ￼ Test RLS behavior with Supabase Auth session (script added)

---

### ⚙️ Step 2: Supabase Edge Function (Embeddings) ✅ Done
- [x] ￼ Create `create_embedding` function
- [x] ￼ Connect to OpenAI API using `text-embedding-3-small`
- [x] ￼ Update inserted `updates.embedding` field
- [x] ￼ Create trigger for AFTER INSERT on `updates`
- [x] ￼ Validate vector writes correctly to table (via SQL trigger)

---

### 🧠 Step 3: FastAPI Backend ✅ Done
- [x] ￼ Set up FastAPI project structure (`/api`)
- [x] ￼ Add Supabase client connection
- [x] ￼ Implement endpoint `/chat`
  - [x] ￼ Fetch most recent update per user
  - [x] ￼ Create embedding for user query
  - [x] ￼ Perform pgvector similarity search (LIMIT 5)
  - [x] ￼ Compose RAG context (snippets)
  - [x] ￼ Call GPT-4o-mini via OpenAI API
  - [x] ￼ Return context + LLM response to frontend
- [x] ￼ Add CORS middleware and environment configuration

---

### 🧱 Step 4: Frontend (React + Shadcn) ✅ Done
- [x] ￼ Add authentication using Supabase client
- [x] ￼ Create `/updates` page
  - [x] ￼ Form to submit new weekly update
  - [x] ￼ Timeline feed of all updates (filters by user/date)
- [x] ￼ Create `/chat` page
  - [x] ￼ Chat UI component (user input + model response)
  - [x] ￼ Fetch `/chat` endpoint
  - [x] ￼ Display context snippets **before** model reply
  - [x] ￼ Style components using Shadcn cards and text areas
- [x] ￼ Test data flow end-to-end with Supabase and FastAPI (scripts/docs)

---

-### 🔄 Step 5: Environment & Configuration ✅ Done
- [x] ￼ Define `.env` variables:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `EMBEDDING_MODEL=text-embedding-3-small`
  - `LLM_MODEL=gpt-4o-mini`
- [x] ￼ Create `.env.example` for development setup
- [x] ￼ Configure dev/staging/prod environments in Supabase and FastAPI
- [x] ￼ Verify API keys and service roles are secure

---

### ✅ Step 6: QA & Validation ✅ Done
- [x] ￼ Test posting updates (check DB insert + vector creation)
- [x] ￼ Test RLS access for member and manager
- [x] ￼ Validate chat endpoint returns snippets + GPT response
- [x] ￼ Check recency logic (most recent per user)
- [x] ￼ Confirm snippet display matches priority requirement
- [x] ￼ Conduct minimal end-to-end user test (login → update → chat)

---

### 🚀 Step 7: Deployment ✅ Done
- [x] ￼ Deploy Edge Function to Supabase
- [x] ￼ Deploy FastAPI backend (e.g., Render/Fly.io)
- [x] ￼ Deploy React frontend (e.g., Vercel)
- [x] ￼ Run production smoke test

---

**Overall Progress:** `100%`

(Progress dynamically increases as steps are completed.)
