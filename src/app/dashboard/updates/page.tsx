"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
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
  const supabase = useMemo(() => createClient(), []);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
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

  // Load session and initial updates
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setSessionUserId(data.user?.id ?? null);
      await loadUsers();
      await refreshUpdates();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshUpdates = async () => {
    const { data, error } = await supabase
      .from('updates')
      .select('id,user_id,content,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setUpdates(data as UpdateRow[]);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id,name,email')
      .order('name', { ascending: true })
      .limit(200);
    if (!error && data) {
      const rows = data as AppUser[];
      setUsers(rows);
      // Default selection: session user if exists in users, else first user
      const defaultId = rows.find((u) => u.id === sessionUserId)?.id ?? rows[0]?.id;
      setSelectedUserId(defaultId);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!sessionUserId) {
      alert('Please sign in first.');
      return;
    }
    if (!content.trim()) return;
    setPosting(true);
    try {
      // Always insert via Supabase client; RLS currently allows authenticated inserts for any user_id
      const { data, error } = await supabase
        .from('updates')
        .insert([{ user_id: selectedUserId, content: content.trim() }])
        .select('id,user_id,content,created_at')
        .single();
      if (error) throw error;
      if (data) {
        // Add the new update to the beginning of the list
        setUpdates((prev) => [data as UpdateRow, ...prev]);
        // Invoke Edge Function to process the update (e.g., create embedding)
        try {
          await supabase.functions.invoke('user_status_to_vector', {
            body: { update_id: (data as UpdateRow).id, user_id: (data as UpdateRow).user_id, content: (data as UpdateRow).content }
          });
        } catch (fnErr) {
          // Non-blocking: log function errors but don't interrupt UX
          console.error('Edge function invocation failed:', fnErr);
        }
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
    return updates.filter((u) => u.content.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q));
  }, [filter, updates]);

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
              <Button type='submit' disabled={posting || !content.trim()}>
                {posting ? 'Posting…' : 'Post Update'}
              </Button>
              <Input
                placeholder='Filter by text or user id'
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
