'use client';

import PageContainer from '@/components/layout/page-container';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import React, { useEffect, useState } from 'react';

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
  const [totalUpdates, setTotalUpdates] = useState<number | null>(null);
  const [updates7d, setUpdates7d] = useState<number | null>(null);
  const [activeUsers30d, setActiveUsers30d] = useState<number | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const response = await fetch('/api/overview/stats', { cache: 'no-store' });
      if (!response.ok) {
        setTotalUpdates(0);
        setUpdates7d(0);
        setActiveUsers30d(0);
        setLastUpdateAt(null);
        return;
      }

      const data = await response.json();
      setTotalUpdates(data.totalUpdates ?? 0);
      setUpdates7d(data.updates7d ?? 0);
      setActiveUsers30d(data.activeUsers30d ?? 0);
      setLastUpdateAt(
        data.lastUpdateAt ? new Date(data.lastUpdateAt).toLocaleString() : null
      );
    };
    loadStats();
  }, []);
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
