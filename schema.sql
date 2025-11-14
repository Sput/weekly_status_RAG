-- Schema derived from PRD Section 9: Data Model
-- Tables: roles, users, updates
-- Notes:
-- - UUID primary keys for all entities
-- - pgvector extension for embeddings (1536 dims for text-embedding-3-small)

-- Enable pgvector for embedding column type
create extension if not exists vector;

-- Roles
create table if not exists public.roles (
  id uuid primary key,
  name text not null
);

-- Users (application users, separate from auth.users)
create table if not exists public.users (
  id uuid primary key,
  name text not null,
  email text not null,
  role_id uuid references public.roles(id),
  created_at timestamp not null default now()
);

-- Updates
create table if not exists public.updates (
  id uuid primary key,
  user_id uuid references public.users(id),
  content text not null,
  embedding vector(1536),
  created_at timestamp not null default now()
);

