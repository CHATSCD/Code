import { NextResponse } from 'next/server';
import { createConnection } from '@/lib/db/app-db';
import { ensureSampleDatabase } from '@/lib/db/sample-data';
import { toSafeConnection } from '@/lib/api-utils';

export async function POST() {
  const filePath = ensureSampleDatabase();
  const connection = createConnection('Sample shop database', 'sqlite', { filePath }, true);
  return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
}
