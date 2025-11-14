Weekly Status RAG

A lightweight system that turns scattered weekly engineering updates into instant, AI-powered insight. Instead of digging through Slack, docs, or emails, teams can post quick updates and later ask natural-language questions like “What did the backend team ship last week?”—and get grounded, traceable answers backed by real data.

⸻

What It Does (Business Summary)
	•	Creates a central knowledge surface from weekly updates
	•	Lets anyone query team progress using natural language
	•	Generates summaries grounded in real recent updates, not model guessing
	•	Eliminates status-chasing and gives leaders clear visibility across teams
	•	Ensures trust by showing citations, timestamps, and similarity scores for every answer

⸻

How It Works (Technical Overview)
	•	Updates are stored in Supabase and automatically converted into vector embeddings
	•	A Next.js UI provides:
	•	A fast posting interface
	•	A chat interface for questions
	•	Context transparency (citations + scores)
	•	FastAPI handles:
	•	Embedding generation (OpenAI)
	•	pgvector similarity search
	•	RAG orchestration with GPT-4o-mini
	•	Data model includes:
	•	updates table (text + embedding)
	•	latest_updates_per_user view
	•	match_latest_updates() RPC
	•	Indexing via ivfflat ensures fast vector retrieval

⸻

RAG (Retrieval-Augmented Generation)

This app uses a clean, transparent RAG pipeline:

1. Embed
	•	Updates and queries are embedded using OpenAI’s text-embedding-3-small
	•	Stored as 1536-dimensional vectors

2. Retrieve
	•	pgvector searches for the most semantically similar updates
	•	Uses cosine similarity (<=>)
	•	Returns top-K snippets with metadata

3. Generate
	•	Retrieved snippets are fed into GPT-4o-mini
	•	Model produces a concise, grounded answer
	•	Frontend displays:
	•	The answer
	•	The exact snippets used
	•	Similarity scores + timestamps
	•	Debug metadata

This ensures no hallucinations, fully auditable reasoning, and a clear link from "answer" ↔ "evidence."

⸻

## Getting Started

Clone the repo:

```
git clone https://github.com/Sput/weekly_status_RAG.git
```

- `pnpm install` ( we have legacy-peer-deps=true added in the .npmrc)
- Create a `.env.local` file by copying the example environment file:
  `cp env.example.txt .env.local`
- Add the required environment variables to the `.env.local` file.
- `pnpm run dev`

##### Environment Configuration Setup

To configure the environment for this project, refer to the `env.example.txt` file. This file contains the necessary environment variables required for authentication and error tracking.

You should now be able to access the application at http://localhost:3000.

> [!WARNING]
> After cloning or forking the repository, be cautious when pulling or syncing with the latest changes, as this may result in breaking conflicts.

Cheers! 🥂

## Deployment

- Coolify: See `docs/deploy_coolify.md` for step‑by‑step instructions to deploy the FastAPI backend and Next.js frontend (either as two apps or via Docker Compose). Includes required environment variables and smoke tests.
