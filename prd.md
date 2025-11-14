🧾 Product Requirements Document (PRD)

1. Introduction

This application enables teams to track and access weekly project status updates. It leverages Retrieval Augmented Generation (RAG) to surface relevant, up-to-date work information within a chat interface powered by GPT-4o-mini. The system integrates Supabase, FastAPI, and React (with shadcn UI) for authentication, data storage, and intelligent retrieval.

⸻

2. Objectives and Goals
	•	Allow team members to log weekly project status updates.
	•	Enable all users to view updates from every team member.
	•	Use RAG to automatically include the most recent updates from all users when generating chat responses.
	•	Provide a visible, context-rich chat experience showing snippets from recent updates.
	•	Streamline collaboration and awareness of ongoing work.

⸻

3. Target Users and Roles

Role	Description	Permissions
Team Member	Regular user who provides weekly updates and views team progress.	Can log their own updates, view all updates, and use the chat.
Manager	Oversees all team members and monitors progress.	Can view all updates and use chat (same permissions as Team Members for MVP).

For MVP: There is one manager; all other users are team members.

⸻

4. Core Features (MVP)
	1.	Authentication
	•	User login via Supabase Auth.
	•	Roles managed in a separate roles table.
	2.	Update Submission
	•	Weekly form to submit project updates (single text field, immutable).
	3.	Update Feed
	•	Timeline view of all team members’ updates with filters by user or date.
	4.	Chat Interface
	•	GPT-4o-mini chat augmented by RAG retrieval of the latest team updates.
	•	Context snippets displayed before the LLM’s response.
	5.	Automatic Embedding
	•	Supabase Edge Function triggers OpenAI embeddings for new updates.
	6.	Data Persistence
	•	Supabase Postgres for structured data and vector storage.

⸻

5. Future Scope (Not in MVP)

Feature	Deferred Reason
Multi-team and multi-manager support	Out of scope for MVP
Structured project tracking (projects table)	Simplified to text field for MVP
Editing or deleting updates	Not required for audit simplicity
Chat persistence/history	Ephemeral chat for MVP
Advanced analytics or audit trail	Future enhancement
Notifications or reminders	Not included in MVP


⸻

6. User Journey

Team Member
	1.	Logs in using Supabase Auth.
	2.	Sees a form to post a weekly update.
	3.	Submits new update → triggers embedding creation.
	4.	Sees timeline feed of all updates (own + teammates).
	5.	Opens chat page → RAG includes recent updates from all users.
	6.	Chat displays retrieved snippets, then LLM’s response.

Manager
	1.	Logs in (same process).
	2.	Views all updates across users.
	3.	Accesses chat page → sees same RAG-enhanced context for full team.

⸻

7. Technical Architecture

Layer	Component	Technology	Description
Frontend	UI Components	React + Shadcn	Forms, list view, and chat interface
Auth	Authentication	Supabase Auth	Role-based access (via roles table)
Backend	Business Logic	FastAPI	Handles chat, RAG pipeline, data aggregation
Database	Data & Vectors	Supabase Postgres (pgvector)	Stores users, roles, updates, embeddings
Edge Functions	Embedding Creation	Supabase Edge Function	Creates embeddings from OpenAI model
LLM	Conversational AI	GPT-4o-mini via OpenAI API	Generates responses augmented by recent updates
Hosting	Cloud	Supabase + FastAPI deployment	Unified environment for data and logic


⸻

8. Data Flow (Pipeline)

1️⃣ User submits weekly update
    ↓
2️⃣ Supabase INSERT → Trigger Edge Function
    ↓
3️⃣ Edge Function calls OpenAI embeddings API
    ↓
4️⃣ Vector stored in `updates.embedding`
    ↓
5️⃣ User opens chat → FastAPI retrieves:
        - Latest update per user
        - Embeddings from Supabase
    ↓
6️⃣ Query embedded → pgvector similarity search
    ↓
7️⃣ Context snippets selected → sent to GPT-4o-mini
    ↓
8️⃣ GPT reply returned to frontend with visible context


⸻

9. Data Model

roles

Column	Type	Description
id	uuid (PK)	Unique identifier
name	text	"manager", "member"

users

Column	Type	Description
id	uuid (PK)	Supabase Auth user id
name	text	Display name
email	text	Email address
role_id	uuid (FK → roles.id)	Role assignment
created_at	timestamp	Date added

updates

Column	Type	Description
id	uuid (PK)	Unique identifier
user_id	uuid (FK → users.id)	Author
content	text	Weekly update content
embedding	vector(1536)	OpenAI text-embedding-3-small
created_at	timestamp	Submission date


⸻

10. Environments and Configuration

Environment	Purpose	Notes
Development	Local testing (React + FastAPI + Supabase CLI)	Edge Functions deployed locally with Supabase emulator
Staging	Pre-production integration	Hosted Supabase project with staging keys
Production	Live environment	Supabase hosted database, FastAPI deployed (e.g., Fly.io/Render), OpenAI API live

Key Configuration Variables

Variable	Description
SUPABASE_URL	Supabase project URL
SUPABASE_ANON_KEY	Public client key
SUPABASE_SERVICE_ROLE_KEY	Used by backend for full access
OPENAI_API_KEY	For embeddings and GPT-4o-mini queries
VECTOR_TABLE	Name of the pgvector table (updates)
EMBEDDING_MODEL	Default: text-embedding-3-small
LLM_MODEL	Default: gpt-4o-mini