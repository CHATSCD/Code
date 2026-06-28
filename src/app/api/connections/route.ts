import { NextRequest, NextResponse } from 'next/server';
import { createConnection, listConnections } from '@/lib/db/app-db';
import { getConnector } from '@/lib/db/connectors';
import { jsonError, toSafeConnection } from '@/lib/api-utils';
import type { DbType } from '@/types';

export async function GET() {
  const connections = listConnections().map(toSafeConnection);
  return NextResponse.json({ connections });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Invalid JSON body.');

  const { name, type, config } = body as { name: string; type: DbType; config: any };
  if (!name || !type || !config) return jsonError('name, type, and config are required.');
  if (type !== 'postgres' && type !== 'mysql') {
    return jsonError('Only postgres and mysql connections can be created via this endpoint.');
  }

  const required = ['host', 'port', 'database', 'user'];
  for (const field of required) {
    if (!config[field]) return jsonError(`Missing field: ${field}`);
  }

  const connection = createConnection(name, type, config, false);

  try {
    const connector = getConnector(connection);
    await connector.testConnection();
    await connector.close();
  } catch (err) {
    const { deleteConnection } = await import('@/lib/db/app-db');
    deleteConnection(connection.id);
    return jsonError(`Could not connect: ${(err as Error).message}`, 422);
  }

  return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
}
