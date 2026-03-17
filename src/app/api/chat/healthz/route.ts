import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
  const target = `${backendBase.replace(/\/$/, '')}/healthz`;
  const hasDirectFallback = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
  );
  try {
    const res = await fetch(target, { method: 'GET', headers: { 'Accept': 'application/json' } });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return NextResponse.json(
      { ok: res.ok, status: res.status, backendBase, hasDirectFallback, body },
      { status: res.ok ? 200 : 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: hasDirectFallback,
        status: 0,
        backendBase,
        hasDirectFallback,
        error: err?.message || 'fetch failed'
      },
      { status: hasDirectFallback ? 200 : 502 }
    );
  }
}
