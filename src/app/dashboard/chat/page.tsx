"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase';

type Snippet = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  similarity: number;
};

const API_PROXY = '/api/chat';

type DebugInfo = {
  mode?: string; // 'similarity' | 'recency'
  reason?: string; // 'ok' | 'openai_key_missing' | 'rpc_failed' | 'no_similarity_results'
  source?: string; // 'rpc' | 'rest'
  context_count?: number;
} | null;

export default function ChatPage() {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const canAsk = useMemo(() => query.trim().length > 0 && !loading, [query, loading]);

  // Load user names for mapping user_id -> name
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id,name,email')
          .order('name', { ascending: true })
          .limit(500);
        if (error) {
          console.warn('[chat] failed to load users', error);
          return;
        }
        const map: Record<string, string> = {};
        (data || []).forEach((u: any) => {
          map[u.id] = u.name || u.email || u.id;
        });
        setUserNames(map);
        console.log('[chat] loaded users', Object.keys(map).length);
      } catch (e) {
        console.warn('[chat] users load error', e);
      }
    };
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAsk) {
      console.warn('[chat] Submit blocked', {
        reason: query.trim().length === 0 ? 'empty_query' : loading ? 'loading' : 'unknown'
      });
      return;
    }
    console.log('[chat] Ask submit', { queryLength: query.trim().length, topK });
    setLoading(true);
    console.debug('[chat] loading -> true');
    setAnswer(null);
    setSnippets(null);
    try {
      console.log('[chat] POST', { url: API_PROXY, topK });
      const r = await fetch(`${API_PROXY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), top_k: topK })
      });
      const status = r.status;
      const contentType = r.headers.get('content-type') || '';
      console.log('[chat] Response', { status, contentType });
      const text = await r.text();
      if (!r.ok) {
        console.error('[chat] Non-OK response', { status, text });
        throw new Error(text || `HTTP ${status}`);
      }
      let data: any;
      try {
        data = contentType.includes('application/json') ? JSON.parse(text) : JSON.parse(text);
      } catch (parseErr) {
        console.error('[chat] Failed to parse JSON', { parseErr, text });
        throw new Error('Invalid JSON from backend');
      }
      console.log('[chat] Parsed payload', {
        keys: Object.keys(data || {}),
        contextCount: Array.isArray(data?.context) ? data.context.length : null,
        answerLen: typeof data?.answer === 'string' ? data.answer.length : null
      });
      setSnippets(data.context as Snippet[]);
      setAnswer(data.answer as string);
      setDebugInfo((data.debug ?? null) as DebugInfo);
      // Log the full answer content for debugging
      try {
        console.log('[chat] Answer', data.answer);
      } catch {}
      // Log the full snippets for debugging
      try {
        console.log('[chat] Snippets', data.context);
      } catch {}
      // Log debug info
      try {
        console.log('[chat] Debug', data.debug);
      } catch {}
    } catch (err: any) {
      console.error('[chat] Error during ask', err);
      setAnswer(`Error: ${err?.message || 'failed to fetch'}`);
    } finally {
      setLoading(false);
      console.debug('[chat] loading -> false');
    }
  };

  // Debug: log state transitions that affect rendering
  // eslint-disable-next-line no-console
  console.debug('[chat] render', {
    loading,
    hasSnippets: Array.isArray(snippets) ? snippets.length : null,
    hasAnswer: !!answer && answer.length
  });

  return (
    <div className='container mx-auto grid max-w-3xl gap-6 p-4'>
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
            <div className='flex items-center gap-2'>
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
              <Button type='submit' disabled={!canAsk}>{loading ? 'Thinking…' : 'Ask'}</Button>
              <div className='text-sm text-muted-foreground'>
                K: <span className='font-medium'>{topK}</span>
                {' • '}Snippets: <span className='font-medium'>{Array.isArray(snippets) ? snippets.length : '-'}</span>
              </div>
            </div>
          </form>
          {/* Empty state message when no snippets are returned */}
          {snippets && snippets.length === 0 && (
            <div className='mt-3 text-sm text-muted-foreground'>
              No updates found — add some on the <a href='/updates' className='underline'>Updates</a> page.
            </div>
          )}
          {/* Debug banner for retrieval mode */}
          {debugInfo && (
            <div className='mt-3 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground'>
              Mode: <span className='font-medium'>{debugInfo.mode || 'n/a'}</span>
              {' • '}Source: <span className='font-medium'>{debugInfo.source || 'n/a'}</span>
              {' • '}Reason: <span className='font-medium'>{debugInfo.reason || 'n/a'}</span>
              {' • '}Context: <span className='font-medium'>{typeof debugInfo.context_count === 'number' ? debugInfo.context_count : 'n/a'}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show context snippets before the model reply */}
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
                    {new Date(s.created_at).toLocaleString()} · sim {s.similarity?.toFixed(3)} · {userNames[s.user_id] || s.user_id}
                  </div>
                  <div className='mt-1 whitespace-pre-wrap'>{s.content}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {answer && (
        <Card>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
            <CardDescription>Model response</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='whitespace-pre-wrap'>{answer}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
