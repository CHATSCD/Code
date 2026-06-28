'use client';

import Link from 'next/link';
import type { ChatSession, Connection } from '@/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface SidebarProps {
  connections: Connection[];
  selectedConnectionId: string | null;
  onSelectConnection: (id: string) => void;
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  connections,
  selectedConnectionId,
  onSelectConnection,
  sessions,
  selectedSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <span className="text-lg font-bold text-slate-900">ChatData</span>
          <Link href="/settings" className="text-xs font-medium text-slate-500 hover:text-brand-600">
            Settings
          </Link>
        </div>

        <div className="border-b border-slate-200 p-3">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Databases</p>
          <div className="flex flex-col gap-1">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectConnection(c.id)}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  c.id === selectedConnectionId ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{c.name}</span>
                {c.isSample && <Badge tone="blue">sample</Badge>}
              </button>
            ))}
            <Link
              href="/settings"
              className="mt-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              + Add database
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chats</p>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onNewSession}>
            + New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {sessions.length === 0 && <p className="px-2 py-1 text-sm text-slate-400">No chats yet.</p>}
          <div className="flex flex-col gap-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                  s.id === selectedSessionId ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <button onClick={() => onSelectSession(s.id)} className="flex-1 truncate text-left">
                  {s.title}
                </button>
                <button
                  onClick={() => onDeleteSession(s.id)}
                  className="ml-2 hidden text-slate-400 hover:text-red-500 group-hover:block"
                  aria-label="Delete chat"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
