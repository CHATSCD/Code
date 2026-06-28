'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input, Label } from '../ui/Input';
import type { GoogleAccountStatus } from '@/types';

export function GoogleAccountCard() {
  const [status, setStatus] = useState<GoogleAccountStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    const res = await fetch('/api/google/status');
    const data = await res.json();
    setStatus(data);
  }

  useEffect(() => {
    refresh();

    const params = new URLSearchParams(window.location.search);
    const connected = params.get('googleConnected');
    const error = params.get('googleError');
    if (connected) setMessage({ ok: true, text: 'Google account connected.' });
    if (error) setMessage({ ok: false, text: error });
    if (connected || error) {
      params.delete('googleConnected');
      params.delete('googleError');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, []);

  async function saveClient() {
    if (!clientId.trim()) {
      setMessage({ ok: false, text: 'Client ID is required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/google/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      setStatus(data);
      setClientSecret('');
      setMessage({ ok: true, text: 'Saved. Now connect your Google account below.' });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await fetch('/api/google/disconnect', { method: 'POST' });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!status) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Google Sheets</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect your Google account to import sheets and export results as new spreadsheets.
          </p>
        </div>
        {status.connected ? <Badge tone="green">Connected as {status.email}</Badge> : <Badge tone="slate">Not connected</Badge>}
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <Label>
            OAuth Client ID{' '}
            {status.configured && <span className="text-slate-400">(leave blank to keep current)</span>}
          </Label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
          />
        </div>
        <div>
          <Label>
            OAuth Client Secret{' '}
            {status.configured && <span className="text-slate-400">(leave blank to keep current)</span>}
          </Label>
          <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">
          Create an OAuth client in Google Cloud Console and add{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">{status.redirectUri}</code> as an authorized redirect
          URI. See the README for step-by-step instructions.
        </p>
      </div>

      {message && <p className={`mt-3 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={saveClient} loading={saving}>
          Save client credentials
        </Button>
        {status.configured && !status.connected && (
          <a href="/api/auth/google">
            <Button variant="secondary" type="button">
              Connect Google account
            </Button>
          </a>
        )}
        {status.connected && (
          <Button variant="secondary" onClick={disconnect} loading={saving}>
            Disconnect
          </Button>
        )}
      </div>
    </Card>
  );
}
