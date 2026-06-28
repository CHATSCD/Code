import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthClientConfig, saveGoogleOAuthClientConfig } from '@/lib/db/app-db';
import { getGoogleAccountStatus } from '@/lib/google/oauth';
import { jsonError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
  return NextResponse.json(getGoogleAccountStatus(redirectUri));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Invalid JSON body.');

  const { clientId, clientSecret } = body as { clientId: string; clientSecret: string };
  if (!clientId?.trim()) return jsonError('clientId is required.');

  const existing = getGoogleOAuthClientConfig();
  const finalSecret = clientSecret?.trim() ? clientSecret.trim() : existing.clientSecret;
  if (!finalSecret) return jsonError('clientSecret is required.');

  saveGoogleOAuthClientConfig({ clientId: clientId.trim(), clientSecret: finalSecret });

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
  return NextResponse.json(getGoogleAccountStatus(redirectUri));
}
