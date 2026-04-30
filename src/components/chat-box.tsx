"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Snippet = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  similarity: number;
};

type DebugInfo = {
  mode?: string;
  reason?: string;
  source?: string;
  context_count?: number;
} | null;

const API_PROXY = '/api/chat';

export function ChatBox() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const canAsk = useMemo(() => query.trim().length > 0 && !loading, [query, loading]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch('/api/users', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const map: Record<string, string> = {};
        (data || []).forEach((u: any) => {
          map[u.id] = u.name || u.email || u.id;
        });
        setUserNames(map);
      } catch {
        setUserNames({});
      }
    };
    loadUsers();
  }, []);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAsk) {
      return;
    }

    setLoading(true);
    setAnswer(null);
    setSnippets(null);
    setDebugInfo(null);

    try {
      const r = await fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), top_k: topK })
      });
      const status = r.status;
      const text = await r.text();
      if (!r.ok) {
        throw new Error(text || `HTTP ${status}`);
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON from backend');
      }

      setSnippets(data.context as Snippet[]);
      setAnswer(data.answer as string);
      setDebugInfo((data.debug ?? null) as DebugInfo);
    } catch (err: any) {
      setAnswer(`Error: ${err?.message || 'failed to fetch'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>RAG Chat</CardTitle>
          <CardDescription>Ask questions grounded in the latest team updates.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={ask} className='grid gap-3'>
            <Textarea
              placeholder='Ask a question here about what people on your team are working on. Some topics might be ice cream, cereal, marathons, and hotdogs'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
            />
            <div className='flex flex-wrap items-center gap-2'>
              <label htmlFor='topk' className='text-sm text-muted-foreground'>
                Top k results to augment
              </label>
              <Input
                type='number'
                min={1}
                max={20}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                id='topk'
                className='w-24'
              />
              <Button type='submit' disabled={!canAsk}>
                {loading ? 'Thinking...' : 'Ask'}
              </Button>
              <div className='text-sm text-muted-foreground'>
                K: <span className='font-medium'>{topK}</span>
                {' | '}Snippets:{' '}
                <span className='font-medium'>{Array.isArray(snippets) ? snippets.length : '-'}</span>
              </div>
            </div>
          </form>

          {snippets && snippets.length === 0 && (
            <div className='mt-3 text-sm text-muted-foreground'>
              No updates found. Add a weekly update below.
            </div>
          )}

          {debugInfo && (
            <div className='mt-3 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground'>
              Mode: <span className='font-medium'>{debugInfo.mode || 'n/a'}</span>
              {' | '}Source: <span className='font-medium'>{debugInfo.source || 'n/a'}</span>
              {' | '}Reason: <span className='font-medium'>{debugInfo.reason || 'n/a'}</span>
              {' | '}Context:{' '}
              <span className='font-medium'>
                {typeof debugInfo.context_count === 'number' ? debugInfo.context_count : 'n/a'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {snippets && (
        <Card>
          <CardHeader>
            <CardTitle>Context</CardTitle>
            <CardDescription>Most relevant latest-per-user updates</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='grid gap-3'>
              {snippets.map((s) => (
                <li key={s.id} className='rounded-md border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    {new Date(s.created_at).toLocaleString()} | sim {s.similarity?.toFixed(3)} |{' '}
                    {userNames[s.user_id] || s.user_id}
                  </div>
                  <div className='mt-1 whitespace-pre-wrap'>{s.content}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {answer && (
        <Card className='border-green-200 bg-green-50 text-green-950 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-50'>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
            <CardDescription className='text-green-800/80 dark:text-green-100/80'>
              Model response
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='whitespace-pre-wrap'>{answer}</div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
