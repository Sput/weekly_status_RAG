-- Supabase schema for weekly status + RAG chat
-- Creates roles, users, updates tables and required extensions/policies

-- Enable required extensions
create extension if not exists vector; -- pgvector for embeddings
create extension if not exists http;   -- for outbound HTTP (used in functions)

-- Roles table
create table if not exists public.roles (
  id bigserial primary key,
  name text not null unique
);

-- Users table (application-level users; separate from auth.users)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role_id bigint references public.roles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.updates (
  id bigserial primary key,
  -- Link updates to app-level users table for admin assignment
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Helpful index for vector similarity
create index if not exists updates_embedding_idx on public.updates using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RLS policies
alter table public.updates enable row level security;

-- Policy: all authenticated users can read all updates
drop policy if exists updates_read_all on public.updates;
create policy updates_read_all on public.updates
  for select
  to authenticated
  using (true);

-- Policy: only authenticated users can insert their own updates
drop policy if exists updates_insert_any on public.updates;
create policy updates_insert_any on public.updates
  for insert
  to authenticated
  with check (true);

-- View to expose the latest update per user
create or replace view public.latest_updates_per_user as
with ranked as (
  select u.*, row_number() over (partition by user_id order by created_at desc) as rn
  from public.updates u
)
select * from ranked where rn = 1;

-- Basic seeds (optional)
insert into public.roles (name)
  values ('member') on conflict do nothing;
