"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type UpdateRow = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
};

type AppUser = {
  id: string;
  name: string;
  email: string;
};

export default function UpdatesPage() {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [filter, setFilter] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  // Load initial updates and available user identities.
  useEffect(() => {
    const init = async () => {
      await Promise.all([loadUsers(), refreshUpdates()]);
    };
    init();
  }, []);

  const refreshUpdates = async () => {
    const response = await fetch('/api/updates?limit=50', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as UpdateRow[];
    setUpdates(data);
  };

  const loadUsers = async () => {
    const response = await fetch('/api/users', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const rows = (await response.json()) as AppUser[];
    setUsers(rows);
    setSelectedUserId((current) => current ?? rows[0]?.id);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !content.trim()) return;
    setPosting(true);
    try {
      const response = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId, content: content.trim() })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to submit');
      }

      if (payload) {
        setUpdates((prev) => [payload as UpdateRow, ...prev]);
      }
      setContent('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit');
    } finally {
      setPosting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return updates;
    return updates.filter((u) => {
      const userName = userNameById.get(u.user_id)?.toLowerCase() ?? '';
      return (
        u.content.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q) ||
        userName.includes(q)
      );
    });
  }, [filter, updates, userNameById]);

  return (
    <div className='container mx-auto grid max-w-3xl gap-6 p-4'>
      <Card>
        <CardHeader>
          <CardTitle>Weekly Updates</CardTitle>
          <CardDescription>Post a new update and browse the team feed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className='grid gap-3'>
            <div className='flex items-center gap-2'>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className='min-w-56'>
                  <SelectValue placeholder='Select user' />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} · {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder='What did you accomplish this week?'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
            <div className='flex items-center gap-2'>
              <Button type='submit' disabled={posting || !selectedUserId || !content.trim()}>
                {posting ? 'Posting…' : 'Post Update'}
              </Button>
              <Input
                placeholder='Filter by text, user, or user id'
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className='grid gap-3'>
        {filtered.map((u) => (
          <Card key={u.id}>
            <CardHeader>
              <CardTitle className='text-sm'>
                User: {userNameById.get(u.user_id) ?? u.user_id}
              </CardTitle>
              <CardDescription>{new Date(u.created_at).toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap'>{u.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
