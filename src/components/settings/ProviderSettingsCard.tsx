'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Label } from '../ui/Input';
import type { LlmProviderKind } from '@/types';

const PROVIDER_LABELS: Record<LlmProviderKind, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  mistral: 'Mistral',
  'openai-compatible': 'Local / custom (OpenAI-compatible)',
};

export function ProviderSettingsCard() {
  const [provider, setProvider] = useState<LlmProviderKind>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setProvider(data.provider || 'openai');
      setModel(data.model || '');
      setBaseUrl(data.baseUrl || '');
      setConfigured(!!data.configured);
      setApiKeyMasked(data.apiKeyMasked || '');
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model, baseUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApiKey('');
      setConfigured(true);
      setStatus({ ok: true, message: 'Saved.' });
    } catch (err) {
      setStatus({ ok: false, message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings/test', { method: 'POST' });
      const data = await res.json();
      setStatus(data.ok ? { ok: true, message: 'Connected successfully.' } : { ok: false, message: data.error });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-slate-900">AI provider</h2>
      <p className="mt-1 text-sm text-slate-500">Used to turn your questions into SQL and summarize results.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(PROVIDER_LABELS) as LlmProviderKind[]).map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              provider === p ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <Label>API key {configured && <span className="text-slate-400">(leave blank to keep current)</span>}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeyMasked || 'sk-...'}
          />
        </div>
        <div>
          <Label>Model</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o-mini" />
        </div>
        {provider === 'openai-compatible' && (
          <div>
            <Label>Server URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" />
          </div>
        )}
      </div>

      {status && <p className={`mt-3 text-sm ${status.ok ? 'text-emerald-600' : 'text-red-600'}`}>{status.message}</p>}

      <div className="mt-4 flex gap-2">
        <Button onClick={save} loading={saving}>
          Save
        </Button>
        <Button variant="secondary" onClick={test} loading={saving} disabled={!configured && !apiKey}>
          Test connection
        </Button>
      </div>
    </Card>
  );
}
