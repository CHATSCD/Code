import { NextRequest, NextResponse } from 'next/server';
import { deleteConnection, getConnection } from '@/lib/db/app-db';
import { jsonError, toSafeConnection } from '@/lib/api-utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const connection = await getConnection(id);
  if (!connection) return jsonError('Connection not found.', 404);
  return NextResponse.json({ connection: toSafeConnection(connection) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const connection = await getConnection(id);
  if (!connection) return jsonError('Connection not found.', 404);
  await deleteConnection(id);
  return NextResponse.json({ ok: true });
}
