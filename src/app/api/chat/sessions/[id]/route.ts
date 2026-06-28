import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, getSession, listMessages, renameSession } from '@/lib/db/app-db';
import { jsonError } from '@/lib/api-utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return jsonError('Session not found.', 404);
  const messages = listMessages(id);
  return NextResponse.json({ session, messages });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return jsonError('Session not found.', 404);
  const body = await req.json().catch(() => null);
  if (!body?.title) return jsonError('title is required.');
  renameSession(id, body.title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return jsonError('Session not found.', 404);
  deleteSession(id);
  return NextResponse.json({ ok: true });
}
