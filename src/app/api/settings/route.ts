import { NextRequest, NextResponse } from 'next/server';
import { getProviderSettings, saveProviderSettings } from '@/lib/db/app-db';
import { jsonError } from '@/lib/api-utils';
import type { LlmProviderKind } from '@/types';

export async function GET() {
  const settings = getProviderSettings();
  return NextResponse.json({
    provider: settings.provider,
    baseUrl: settings.baseUrl || '',
    model: settings.model,
    configured: settings.configured,
    apiKeyMasked: settings.apiKey ? `••••${settings.apiKey.slice(-4)}` : '',
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Invalid JSON body.');

  const { provider, apiKey, baseUrl, model } = body as {
    provider: LlmProviderKind;
    apiKey?: string;
    baseUrl?: string;
    model: string;
  };

  if (!provider || !model) return jsonError('provider and model are required.');

  const existing = getProviderSettings();
  const finalApiKey = apiKey && apiKey.trim() ? apiKey.trim() : existing.apiKey;

  if (!finalApiKey && provider !== 'openai-compatible') {
    return jsonError('An API key is required for this provider.');
  }

  saveProviderSettings({ provider, apiKey: finalApiKey, baseUrl: baseUrl?.trim(), model: model.trim() });
  return NextResponse.json({ ok: true });
}
