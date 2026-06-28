import { NextResponse } from 'next/server';
import { disconnectGoogle } from '@/lib/google/oauth';

export async function POST() {
  disconnectGoogle();
  return NextResponse.json({ ok: true });
}
