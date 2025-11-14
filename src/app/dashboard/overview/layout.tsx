'use client';

import PageContainer from '@/components/layout/page-container';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [totalUpdates, setTotalUpdates] = useState<number | null>(null);
  const [updates7d, setUpdates7d] = useState<number | null>(null);
  const [activeUsers30d, setActiveUsers30d] = useState<number | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      // Total updates
      const totalRes = await supabase
        .from('updates')
        .select('id', { count: 'exact', head: true });
      if (!totalRes.error) setTotalUpdates(totalRes.count ?? 0);

      // Updates in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const last7Res = await supabase
        .from('updates')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);
      if (!last7Res.error) setUpdates7d(last7Res.count ?? 0);

      // Active users in last 30 days (distinct user_id)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentUsersRes = await supabase
        .from('updates')
        .select('user_id,created_at')
        .gte('created_at', thirtyDaysAgo)
        .limit(10000);
      if (!recentUsersRes.error && recentUsersRes.data) {
        const s = new Set((recentUsersRes.data as { user_id: string }[]).map((r) => r.user_id));
        setActiveUsers30d(s.size);
      } else {
        setActiveUsers30d(0);
      }

      // Latest update time
      const lastRes = await supabase
        .from('updates')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastRes.error && lastRes.data) {
        setLastUpdateAt(new Date(lastRes.data.created_at).toLocaleString());
      } else {
        setLastUpdateAt(null);
      }
    };
    loadStats();
  }, [supabase]);
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Hi, Welcome back 👋
          </h2>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Total Updates</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {totalUpdates ?? '—'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Updates (7 days)</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {updates7d ?? '—'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Active Users (30 days)</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {activeUsers30d ?? '—'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Last Update</CardDescription>
              <CardTitle className='text-base font-normal @[250px]/card:text-lg'>
                {lastUpdateAt ?? 'No updates yet'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        {/* <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-4'>{bar_stats}</div>
          <div className='col-span-4 md:col-span-3'>
            sales parallel routes
            {sales}
          </div>
          <div className='col-span-4'>{area_stats}</div>
          <div className='col-span-4 md:col-span-3'>{pie_stats}</div>
        </div> */}
      </div>
    </PageContainer>
  );
}
