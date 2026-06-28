import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/google/oauth';

export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
  const settingsUrl = new URL('/settings', req.nextUrl.origin);

  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  if (error) {
    settingsUrl.searchParams.set('googleError', error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set('googleError', 'No authorization code was returned by Google.');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    await exchangeCodeForTokens(code, redirectUri);
    settingsUrl.searchParams.set('googleConnected', '1');
  } catch (err) {
    settingsUrl.searchParams.set('googleError', (err as Error).message);
  }
  return NextResponse.redirect(settingsUrl);
}
