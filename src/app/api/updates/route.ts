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
      const json = JSON.parse(text);
      return NextResponse.json(json[0] ?? null, { status: 201 });
    } catch {
      return new NextResponse(text, { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'server error' }, { status: 500 });
  }
}
