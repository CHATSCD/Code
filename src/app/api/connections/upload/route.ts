import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createConnection, deleteConnection } from '@/lib/db/app-db';
import { getConnector } from '@/lib/db/connectors';
import { UPLOADS_DIR, ensureDataDirs } from '@/lib/paths';
import { jsonError, toSafeConnection } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return jsonError('Expected multipart/form-data.');

  const file = form.get('file');
  const name = (form.get('name') as string) || 'My database';
  if (!(file instanceof Blob)) return jsonError('A "file" field is required.');

  ensureDataDirs();
  const safeBase = path.basename((file as any).name || 'database.sqlite3').replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = path.join(UPLOADS_DIR, `${uuidv4()}-${safeBase}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  const connection = createConnection(name, 'sqlite', { filePath: destPath }, false);

  try {
    const connector = getConnector(connection);
    await connector.testConnection();
    await connector.close();
  } catch (err) {
    deleteConnection(connection.id);
    fs.unlinkSync(destPath);
    return jsonError(`That file doesn't look like a valid SQLite database: ${(err as Error).message}`, 422);
  }

  return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
}
