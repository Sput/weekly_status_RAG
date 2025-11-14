import { NextRequest, NextResponse } from 'next/server';

// Proxies chat requests to the FastAPI backend for same-origin access from the Next.js app.
// Reads backend base URL from NEXT_PUBLIC_BACKEND_URL.

export async function POST(request: NextRequest) {
  try {
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
    const started = Date.now();
    const body = await request.json();
    console.log('[api/chat] incoming', {
      backendBase,
      queryLen: typeof body?.query === 'string' ? body.query.length : null,
      top_k: body?.top_k
    });

    const res = await fetch(`${backendBase}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    const durMs = Date.now() - started;
    console.log('[api/chat] backend response', { status: res.status, durMs });
    if (!res.ok) {
      console.error('[api/chat] backend error', { status: res.status, text: text?.slice(0, 500) });
      return NextResponse.json({ error: text || 'backend error' }, { status: 502 });
    }
    try {
      const json = JSON.parse(text);
      console.log('[api/chat] ok', {
        keys: Object.keys(json || {}),
        contextCount: Array.isArray(json?.context) ? json.context.length : null,
        answerLen: typeof json?.answer === 'string' ? json.answer.length : null
      });
      return NextResponse.json(json, { status: 200 });
    } catch {
      console.warn('[api/chat] non-JSON payload from backend');
      return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    console.error('[api/chat] proxy error', { err: err?.message });
    return NextResponse.json({ error: err?.message || 'proxy error' }, { status: 500 });
  }
}
