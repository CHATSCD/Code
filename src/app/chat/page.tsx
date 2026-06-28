'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/components/chat/Sidebar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import type { ChatMessage, ChatSession, Connection } from '@/types';

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [connRes, settingsRes] = await Promise.all([fetch('/api/connections'), fetch('/api/settings')]);
      const connData = await connRes.json();
      const settingsData = await settingsRes.json();
      setProviderConfigured(!!settingsData.configured);

      const conns: Connection[] = connData.connections || [];
      setConnections(conns);
      if (conns.length === 0) {
        router.replace('/onboarding');
        return;
      }
      const fromQuery = searchParams.get('connection');
      const initial = (fromQuery && conns.find((c) => c.id === fromQuery)) || conns[0];
      setSelectedConnectionId(initial.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessions = useCallback(async (connectionId: string, preferSessionId?: string) => {
    const res = await fetch(`/api/chat/sessions?connectionId=${connectionId}`);
    const data = await res.json();
    const list: ChatSession[] = data.sessions || [];
    setSessions(list);
    const next = preferSessionId && list.find((s) => s.id === preferSessionId) ? preferSessionId : list[0]?.id ?? null;
    setSelectedSessionId(next);
  }, []);

  useEffect(() => {
    if (selectedConnectionId) loadSessions(selectedConnectionId);
  }, [selectedConnectionId, loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }
    (async () => {
      const res = await fetch(`/api/chat/sessions/${selectedSessionId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    })();
  }, [selectedSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function newSession() {
    if (!selectedConnectionId) return;
    const res = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: selectedConnectionId }),
    });
    const data = await res.json();
    await loadSessions(selectedConnectionId, data.session.id);
    setSidebarOpen(false);
  }

  async function deleteSession(id: string) {
    await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
    if (selectedConnectionId) await loadSessions(selectedConnectionId);
  }

  async function sendMessage(text: string) {
    if (!selectedConnectionId) return;
    setSending(true);
    try {
      let sessionId = selectedSessionId;
      if (!sessionId) {
        const res = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: selectedConnectionId }),
        });
        const data = await res.json();
        sessionId = data.session.id;
        setSelectedSessionId(sessionId);
      }

      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
      }
      if (selectedConnectionId) await loadSessions(selectedConnectionId, sessionId ?? undefined);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        connections={connections}
        selectedConnectionId={selectedConnectionId}
        onSelectConnection={(id) => {
          setSelectedConnectionId(id);
          setSidebarOpen(false);
        }}
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={(id) => {
          setSelectedSessionId(id);
          setSidebarOpen(false);
        }}
        onNewSession={newSession}
        onDeleteSession={deleteSession}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white p-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="font-semibold text-slate-900">ChatData</span>
        </header>

        {providerConfigured === false && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            No AI provider configured yet.{' '}
            <Link href="/settings" className="font-medium underline">
              Add one in Settings
            </Link>{' '}
            to start chatting.
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
                Ask anything about your data — e.g. &quot;How many orders were placed last month?&quot;
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Spinner /> Thinking...
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <ChatInput onSend={sendMessage} disabled={sending || !selectedConnectionId} />
        </div>
      </div>
    </div>
  );
}
