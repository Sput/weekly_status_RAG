import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
  const target = `${backendBase.replace(/\/$/, '')}/healthz`;
  try {
    const res = await fetch(target, { method: 'GET', headers: { 'Accept': 'application/json' } });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return NextResponse.json({ ok: res.ok, status: res.status, backendBase, body }, { status: res.ok ? 200 : 502 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, status: 0, backendBase, error: err?.message || 'fetch failed' }, { status: 502 });
  }
}

