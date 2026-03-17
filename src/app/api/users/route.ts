import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id,name,email&order=name.asc&limit=500`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'apikey': SERVICE_ROLE,
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
