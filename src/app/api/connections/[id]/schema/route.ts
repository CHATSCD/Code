import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db/app-db';
import { getConnector } from '@/lib/db/connectors';
import { jsonError } from '@/lib/api-utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const connection = getConnection(id);
  if (!connection) return jsonError('Connection not found.', 404);

  const connector = getConnector(connection);
  try {
    const schema = await connector.getSchema();
    return NextResponse.json({ schema });
  } catch (err) {
    return jsonError(`Could not read schema: ${(err as Error).message}`, 502);
  } finally {
    await connector.close();
  }
}
