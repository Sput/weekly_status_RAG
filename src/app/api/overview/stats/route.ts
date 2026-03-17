import { NextResponse } from 'next/server';

type UpdateRow = {
  user_id: string;
  created_at: string;
};

export async function GET() {
  try {
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authHeaders = {
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'apikey': SERVICE_ROLE,
      'Accept': 'application/json'
    };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [totalRes, last7Res, activeUsersRes, lastUpdateRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/updates?select=id`, {
        method: 'GET',
        headers: { ...authHeaders, Prefer: 'count=exact', Range: '0-0' },
        cache: 'no-store'
      }),
      fetch(`${SUPABASE_URL}/rest/v1/updates?select=id&created_at=gte.${encodeURIComponent(sevenDaysAgo)}`, {
        method: 'GET',
        headers: { ...authHeaders, Prefer: 'count=exact', Range: '0-0' },
        cache: 'no-store'
      }),
      fetch(`${SUPABASE_URL}/rest/v1/updates?select=user_id,created_at&created_at=gte.${encodeURIComponent(thirtyDaysAgo)}&limit=10000`, {
        method: 'GET',
        headers: authHeaders,
        cache: 'no-store'
      }),
      fetch(`${SUPABASE_URL}/rest/v1/updates?select=created_at&order=created_at.desc&limit=1`, {
        method: 'GET',
        headers: authHeaders,
        cache: 'no-store'
      })
    ]);

    if (!totalRes.ok || !last7Res.ok || !activeUsersRes.ok || !lastUpdateRes.ok) {
      return NextResponse.json({ error: 'Failed to load overview stats' }, { status: 502 });
    }

    const totalUpdates = Number(totalRes.headers.get('content-range')?.split('/')[1] ?? '0');
    const updates7d = Number(last7Res.headers.get('content-range')?.split('/')[1] ?? '0');
    const recentUsers = (await activeUsersRes.json()) as UpdateRow[];
    const lastUpdateRows = (await lastUpdateRes.json()) as Array<{ created_at: string }>;

    const activeUsers30d = new Set((recentUsers || []).map((row) => row.user_id)).size;
    const lastUpdateAt = lastUpdateRows[0]?.created_at ?? null;

    return NextResponse.json(
      { totalUpdates, updates7d, activeUsers30d, lastUpdateAt },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'server error' }, { status: 500 });
  }
}
