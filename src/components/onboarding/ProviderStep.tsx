'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Label } from '../ui/Input';
import type { LlmProviderKind } from '@/types';

const PROVIDER_INFO: Record<LlmProviderKind, { label: string; modelPlaceholder: string; defaultModel?: string; keyHint: string; needsKey: boolean }> = {
  openai: {
    label: 'OpenAI',
    modelPlaceholder: 'e.g. gpt-4o-mini',
    keyHint: 'Find your key at platform.openai.com/api-keys',
    needsKey: true,
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    modelPlaceholder: 'e.g. claude-sonnet-4-6',
    defaultModel: 'claude-sonnet-4-6',
    keyHint: 'Find your key at console.anthropic.com',
    needsKey: true,
  },
  mistral: {
    label: 'Mistral',
    modelPlaceholder: 'e.g. mistral-small-latest',
    defaultModel: 'mistral-small-latest',
    keyHint: 'Find your key at console.mistral.ai/api-keys',
    needsKey: true,
  },
  'openai-compatible': {
    label: 'Local / custom (Ollama, LM Studio, etc.)',
    modelPlaceholder: 'e.g. llama3.1',
    keyHint: 'Most local servers do not need a key — leave it blank.',
    needsKey: false,
  },
};

export function ProviderStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [provider, setProvider] = useState<LlmProviderKind>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const info = PROVIDER_INFO[provider];

  function selectProvider(p: LlmProviderKind) {
    setProvider(p);
    setTestResult(null);
    if (PROVIDER_INFO[p].defaultModel && !model) setModel(PROVIDER_INFO[p].defaultModel!);
    if (p === 'openai-compatible' && !baseUrl) setBaseUrl('http://localhost:11434/v1');
  }

  async function save(thenTest: boolean) {
    if (!model.trim()) {
      setError('Enter a model name.');
      return;
    }
    if (info.needsKey && !apiKey.trim()) {
      setError('An API key is required for this provider.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model, baseUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save settings.');

      if (thenTest) {
        const testRes = await fetch('/api/settings/test', { method: 'POST' });
        const testData = await testRes.json();
        setTestResult(
          testData.ok ? { ok: true, message: 'Connected successfully.' } : { ok: false, message: testData.error }
        );
        if (!testData.ok) return;
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Set up your AI</h2>
      <p className="mt-1 text-sm text-slate-500">
        ChatData uses an AI model to turn your questions into SQL. Bring your own API key, or point it at a local model.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(PROVIDER_INFO) as LlmProviderKind[]).map((p) => (
          <button
            key={p}
            onClick={() => selectProvider(p)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              provider === p ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {PROVIDER_INFO[p].label}
          </button>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <div className="grid gap-3">
          {info.needsKey && (
            <div>
              <Label>API key</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
              <p className="mt-1 text-xs text-slate-400">{info.keyHint}</p>
            </div>
          )}
          <div>
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={info.modelPlaceholder} />
          </div>
          {provider === 'openai-compatible' && (
            <div>
              <Label>Server URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" />
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {testResult && (
          <p className={`mt-3 text-sm ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>{testResult.message}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => save(true)} loading={loading}>
            Save &amp; test connection
          </Button>
          <Button variant="secondary" onClick={() => save(false)} loading={loading}>
            Save without testing
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      </Card>
    </div>
  );
}
