import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/google/oauth';

export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
  try {
    const url = buildAuthUrl(redirectUri);
    return NextResponse.redirect(url);
  } catch (err) {
    const settingsUrl = new URL('/settings', req.nextUrl.origin);
    settingsUrl.searchParams.set('googleError', (err as Error).message);
    return NextResponse.redirect(settingsUrl);
  }
}
