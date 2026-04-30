import { NextRequest, NextResponse } from 'next/server';

// Server-side insert into updates using Supabase service role.
// Accepts JSON: { user_id: string, content: string }

function getServerConfig() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return null;
  }

  return { SUPABASE_URL, SERVICE_ROLE };
}

type UpdateRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  embedding?: string | null;
};

const VECTOR_FUNCTION_NAME = 'user_status_to_vector';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeVectorFunction(
  config: NonNullable<ReturnType<typeof getServerConfig>>,
  update: UpdateRow
) {
  const response = await fetch(
    `${config.SUPABASE_URL}/functions/v1/${VECTOR_FUNCTION_NAME}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.SERVICE_ROLE}`,
        'apikey': config.SERVICE_ROLE,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'INSERT',
        table: 'updates',
        schema: 'public',
        record: update,
        old_record: null,
        id: update.id,
        update_id: update.id,
        content: update.content
      })
    }
  );

  return {
    ok: response.ok,
    status: response.status,
    body: await response.text()
  };
}

async function fetchUpdateEmbedding(
  config: NonNullable<ReturnType<typeof getServerConfig>>,
  updateId: string
) {
  const response = await fetch(
    `${config.SUPABASE_URL}/rest/v1/updates?select=id,embedding&id=eq.${encodeURIComponent(updateId)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.SERVICE_ROLE}`,
        'apikey': config.SERVICE_ROLE,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as Array<{ id: string; embedding: string | null }>;
  return rows[0]?.embedding ?? null;
}

async function waitForEmbeddingAfterVectorFunction(
  config: NonNullable<ReturnType<typeof getServerConfig>>,
  update: UpdateRow
) {
  let lastVectorFunction = {
    ok: false,
    status: 0
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const vectorFunction = await invokeVectorFunction(config, update).catch((err: any) => ({
      ok: false,
      status: 0,
      body: err?.message || 'Vector function request failed'
    }));
    lastVectorFunction = {
      ok: vectorFunction.ok,
      status: vectorFunction.status
    };

    const embedding = await fetchUpdateEmbedding(config, update.id);
    if (embedding) {
      return { embedding, vectorFunction: lastVectorFunction };
    }
    await sleep(1000);
  }

  return { embedding: null, vectorFunction: lastVectorFunction };
}

export async function GET(request: NextRequest) {
  try {
    const config = getServerConfig();
    if (!config) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get('limit') ?? '50') || 50, 1),
      200
    );

    const res = await fetch(
      `${config.SUPABASE_URL}/rest/v1/updates?select=id,user_id,content,created_at&order=created_at.desc&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.SERVICE_ROLE}`,
          'apikey': config.SERVICE_ROLE,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      }
    );

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: text || 'Fetch failed' }, { status: 502 });
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: 200 });
    } catch {
      return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = getServerConfig();
    if (!config) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { user_id, content } = await request.json();
    if (!user_id || !content || typeof user_id !== 'string' || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const res = await fetch(`${config.SUPABASE_URL}/rest/v1/updates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.SERVICE_ROLE}`,
        'apikey': config.SERVICE_ROLE,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([{ user_id, content }])
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: text || 'Insert failed' }, { status: 502 });
    }
    try {
      const json = JSON.parse(text) as UpdateRow[];
      const inserted = json[0] ?? null;
      if (!inserted) {
        return NextResponse.json(null, { status: 201 });
      }

      const { embedding, vectorFunction } = await waitForEmbeddingAfterVectorFunction(
        config,
        inserted
      );

      return NextResponse.json(
        {
          ...inserted,
          embedding: embedding ?? inserted.embedding ?? null,
          embedding_status: embedding ? 'ready' : 'missing',
          vector_function: {
            name: VECTOR_FUNCTION_NAME,
            ok: vectorFunction.ok,
            status: vectorFunction.status
          }
        },
        { status: 201 }
      );
    } catch {
      return new NextResponse(text, { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'server error' }, { status: 500 });
  }
}
