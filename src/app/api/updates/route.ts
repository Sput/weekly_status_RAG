import { NextRequest, NextResponse } from 'next/server';

// Server-side insert into updates using Supabase service role.
// Accepts JSON: { user_id: string, content: string }

export async function POST(request: NextRequest) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { user_id, content } = await request.json();
    if (!user_id || !content || typeof user_id !== 'string' || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/updates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'apikey': SERVICE_ROLE,
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

