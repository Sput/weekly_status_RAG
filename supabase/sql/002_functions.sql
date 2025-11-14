-- Postgres functions and triggers for embeddings and similarity search

-- Function: create_embedding
-- On insert into public.updates, call OpenAI embeddings API and store vector
-- Note: Requires http extension and OPENAI_API_KEY configured as a vault secret
--       For local dev, you can update via your backend instead of DB trigger.
create or replace function public.create_embedding()
returns trigger
language plpgsql
as $$
declare
  api_url text := 'https://api.openai.com/v1/embeddings';
  api_key text;
  req jsonb;
  resp jsonb;
  vec float4[];
begin
  -- Fetch API key from Vault, fallback to null
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'OPENAI_API_KEY' limit 1),
    null
  ) into api_key;

  if api_key is null then
    -- Skip embedding if no key present; keep row and return
    return new;
  end if;

  req := jsonb_build_object(
    'input', new.content,
    'model', coalesce(current_setting('app.embedding_model', true), 'text-embedding-3-small')
  );

  resp := http( api_url,
    'POST',
    array[http_header('content-type','application/json'), http_header('authorization', concat('Bearer ', api_key))],
    req::text
  )::jsonb;

  -- Expected shape: { data: [ { embedding: [..] } ] }
  vec := (
    select array(select (elem)::float4 from jsonb_array_elements(((resp->'data'->0)->'embedding')) as elem)
  );

  update public.updates set embedding = vec where id = new.id;

  return new;
end;
$$;

-- Trigger: run after insert on updates
drop trigger if exists trg_create_embedding on public.updates;
create trigger trg_create_embedding
after insert on public.updates
for each row execute function public.create_embedding();

-- Function: match_latest_updates
-- Returns the top N most similar latest-per-user updates to the given embedding
create or replace function public.match_latest_updates(query_embedding vector(1536), match_count int)
returns table (
  id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  similarity float4
)
language sql
stable
as $$
  select u.id, u.user_id, u.content, u.created_at,
    1 - (u.embedding <=> query_embedding) as similarity
  from public.latest_updates_per_user u
  where u.embedding is not null
  order by u.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
