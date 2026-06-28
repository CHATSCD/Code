import { NextResponse } from 'next/server';
import { getProviderSettings } from '@/lib/db/app-db';
import { getLlmClient, LlmError } from '@/lib/llm';
import { jsonError } from '@/lib/api-utils';

export async function POST() {
  const settings = getProviderSettings();
  if (!settings.configured) return jsonError('Provider is not configured yet.');

  const llm = getLlmClient(settings);
  try {
    const reply = await llm.complete([
      { role: 'system', content: 'Reply with exactly one word: ok' },
      { role: 'user', content: 'ping' },
    ]);
    return NextResponse.json({ ok: true, reply: reply.trim().slice(0, 50) });
  } catch (err) {
    const message = err instanceof LlmError ? err.message : (err as Error).message;
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
