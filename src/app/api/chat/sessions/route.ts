import { NextRequest, NextResponse } from 'next/server';
import { createSession, getConnection, listSessions } from '@/lib/db/app-db';
import { jsonError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const connectionId = req.nextUrl.searchParams.get('connectionId') || undefined;
  const sessions = listSessions(connectionId);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const connectionId = body?.connectionId as string | undefined;
  if (!connectionId) return jsonError('connectionId is required.');
  if (!getConnection(connectionId)) return jsonError('Connection not found.', 404);

  const session = createSession(connectionId, body?.title || 'New chat');
  return NextResponse.json({ session }, { status: 201 });
}
