import { NextResponse } from 'next/server';

export async function GET() {
  const hasDirectChat = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
  );

  return NextResponse.json(
    {
      ok: hasDirectChat,
      mode: 'next-direct',
      hasDirectChat
    },
    { status: hasDirectChat ? 200 : 502 }
  );
}
