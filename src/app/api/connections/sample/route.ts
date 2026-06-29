import { NextResponse } from 'next/server';
import { createConnection, getPgPool } from '@/lib/db/app-db';
import { ensureSampleDatabase, ensureSampleDatabasePostgres } from '@/lib/db/sample-data';
import { toSafeConnection } from '@/lib/api-utils';
import { IS_SERVERLESS_DB } from '@/lib/paths';

export async function POST() {
  if (IS_SERVERLESS_DB) {
    const schema = await ensureSampleDatabasePostgres(getPgPool()!);
    const connection = await createConnection('Sample shop database', 'postgres', { useAppDatabase: true, schema }, true);
    return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
  }

  const filePath = ensureSampleDatabase();
  const connection = await createConnection('Sample shop database', 'sqlite', { filePath }, true);
  return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
}
