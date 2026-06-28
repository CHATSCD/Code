'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ConnectStep } from '../onboarding/ConnectStep';
import type { Connection } from '@/types';

export function ConnectionsCard() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await fetch('/api/connections');
    const data = await res.json();
    setConnections(data.connections || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(id: string) {
    if (!confirm('Remove this database connection? Its chat history will be deleted too.')) return;
    await fetch(`/api/connections/${id}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Databases</h2>
          <p className="mt-1 text-sm text-slate-500">Connections ChatData can query.</p>
        </div>
        <Button variant="secondary" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Cancel' : '+ Add database'}
        </Button>
      </div>

      {!loading && (
        <div className="mt-4 flex flex-col gap-2">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{c.name}</span>
                <Badge tone="slate">{c.type}</Badge>
                {c.isSample && <Badge tone="blue">sample</Badge>}
              </div>
              <button onClick={() => remove(c.id)} className="text-sm text-slate-400 hover:text-red-600">
                Remove
              </button>
            </div>
          ))}
          {connections.length === 0 && <p className="text-sm text-slate-400">No databases connected yet.</p>}
        </div>
      )}

      {showAdd && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <ConnectStep
            onConnected={() => {
              setShowAdd(false);
              refresh();
            }}
          />
        </div>
      )}
    </Card>
  );
}
