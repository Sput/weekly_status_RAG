import { NextRequest, NextResponse } from 'next/server';

type ChatSnippet = {
  id: number | string;
  user_id: string;
  content: string;
  created_at: string;
  similarity: number;
};

type ChatDebug = {
  mode: 'similarity' | 'recency';
  reason: string;
  source: string;
  context_count: number;
};

type ServerConfig = {
  backendBase: string;
  supabaseUrl?: string;
  serviceKey?: string;
  openAiKey?: string;
  embeddingModel: string;
  llmModel: string;
};

function getConfig(): ServerConfig {
  return {
    backendBase: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    openAiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini'
  };
}

async function proxyToBackend(backendBase: string, body: unknown) {
  const res = await fetch(`${backendBase.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function fetchLatestUpdates(config: ServerConfig, topK: number): Promise<ChatSnippet[]> {
  if (!config.supabaseUrl || !config.serviceKey) {
    return [];
  }

  const url =
    `${config.supabaseUrl}/rest/v1/latest_updates_per_user?` +
    `select=id,user_id,content,created_at&order=created_at.desc&limit=${Math.max(1, topK)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.serviceKey}`,
      'apikey': config.serviceKey,
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    return [];
  }

  const rows = (await res.json()) as Array<Omit<ChatSnippet, 'similarity'>>;
  return rows.map((row) => ({ ...row, similarity: 0 }));
}

async function createEmbedding(config: ServerConfig, query: string): Promise<number[] | null> {
  if (!config.openAiKey) {
    return null;
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openAiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: query,
      model: config.embeddingModel
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI embeddings error: ${await res.text()}`);
  }

  const data = await res.json();
  return data?.data?.[0]?.embedding ?? null;
}

async function matchLatestUpdates(
  config: ServerConfig,
  embedding: number[],
  topK: number
): Promise<ChatSnippet[]> {
  if (!config.supabaseUrl || !config.serviceKey) {
    return [];
  }

  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/match_latest_updates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.serviceKey}`,
      'apikey': config.serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: topK
    }),
    cache: 'no-store'
  });

  if (!res.ok) {
    return [];
  }

  return (await res.json()) as ChatSnippet[];
}

async function createAnswer(
  config: ServerConfig,
  snippets: ChatSnippet[],
  query: string
): Promise<string> {
  if (!config.openAiKey) {
    return (
      'Here are the latest updates by recency:\n\n' +
      snippets.map((s) => `- (${s.created_at || '?'}) ${s.content || ''}`).join('\n')
    );
  }

  const contextText = snippets
    .map(
      (s) =>
        `- (${s.created_at || '?'}) sim=${Number(s.similarity || 0).toFixed(3)}: ${s.content || ''}`
    )
    .join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openAiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.llmModel,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are an assistant summarizing weekly team updates. Use the provided context snippets to answer the user concisely, citing relevant updates.'
        },
        {
          role: 'user',
          content: `Context:\n${contextText}\n\nQuestion: ${query}`
        }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI chat error: ${await res.text()}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function handleDirectChat(config: ServerConfig, query: string, topK: number) {
  if (!config.supabaseUrl || !config.serviceKey) {
    throw new Error('Chat server is not configured');
  }

  let snippets: ChatSnippet[] = [];
  let debug: ChatDebug = {
    mode: 'recency',
    reason: 'backend_unreachable',
    source: 'next-rest',
    context_count: 0
  };

  if (config.openAiKey) {
    const embedding = await createEmbedding(config, query);
    if (embedding) {
      snippets = await matchLatestUpdates(config, embedding, topK);
      if (snippets.length > 0) {
        debug = {
          mode: 'similarity',
          reason: 'backend_unreachable',
          source: 'next-rpc',
          context_count: snippets.length
        };
      }
    }
  }

  if (snippets.length === 0) {
    snippets = await fetchLatestUpdates(config, topK);
    debug = {
      mode: 'recency',
      reason: config.openAiKey ? 'no_similarity_results' : 'openai_key_missing',
      source: 'next-rest',
      context_count: snippets.length
    };
  }

  const answer = await createAnswer(config, snippets, query);
  return { query, context: snippets, answer, debug };
}

export async function POST(request: NextRequest) {
  const config = getConfig();

  try {
    const body = await request.json();
    const query = typeof body?.query === 'string' ? body.query : '';
    const topK = typeof body?.top_k === 'number' ? body.top_k : 5;

    console.log('[api/chat] incoming', {
      backendBase: config.backendBase,
      queryLen: query.length,
      top_k: topK
    });

    try {
      const proxied = await proxyToBackend(config.backendBase, body);
      console.log('[api/chat] backend response', { status: proxied.status });

      if (proxied.ok) {
        return NextResponse.json(JSON.parse(proxied.text), { status: 200 });
      }

      console.warn('[api/chat] backend unavailable, falling back', {
        status: proxied.status,
        body: proxied.text.slice(0, 300)
      });
    } catch (err: any) {
      console.warn('[api/chat] backend fetch failed, falling back', {
        err: err?.message || 'fetch failed'
      });
    }

    const fallback = await handleDirectChat(config, query, topK);
    return NextResponse.json(fallback, { status: 200 });
  } catch (err: any) {
    console.error('[api/chat] route error', { err: err?.message || 'unknown error' });
    return NextResponse.json(
      { error: err?.message || 'proxy error' },
      { status: 500 }
    );
  }
}
