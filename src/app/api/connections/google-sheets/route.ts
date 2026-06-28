import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createConnection, deleteConnection } from '@/lib/db/app-db';
import { getConnector } from '@/lib/db/connectors';
import { getAuthorizedClient } from '@/lib/google/oauth';
import { parseSpreadsheetId, fetchSpreadsheetTabs } from '@/lib/google/sheets';
import { materializeTablesToSqlite } from '@/lib/tabular-import';
import { UPLOADS_DIR, ensureDataDirs } from '@/lib/paths';
import { jsonError, toSafeConnection } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Invalid JSON body.');

  const { url, name } = body as { url: string; name?: string };
  if (!url?.trim()) return jsonError('A Google Sheets URL or ID is required.');

  const spreadsheetId = parseSpreadsheetId(url.trim());
  if (!spreadsheetId) return jsonError("That doesn't look like a valid Google Sheets URL or ID.");

  let client;
  try {
    client = await getAuthorizedClient();
  } catch (err) {
    return jsonError((err as Error).message, 422);
  }

  let title: string;
  let tables;
  try {
    const result = await fetchSpreadsheetTabs(client, spreadsheetId);
    title = result.title;
    tables = result.tables;
  } catch (err) {
    return jsonError(`Couldn't read that spreadsheet: ${(err as Error).message}`, 422);
  }

  ensureDataDirs();
  const destPath = path.join(UPLOADS_DIR, `${uuidv4()}.sqlite3`);
  try {
    materializeTablesToSqlite(destPath, tables);
  } catch (err) {
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    return jsonError(`Couldn't import that spreadsheet: ${(err as Error).message}`, 422);
  }

  const connection = createConnection(name?.trim() || title, 'sqlite', { filePath: destPath }, false, {
    kind: 'google-sheets',
    meta: {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    },
  });

  try {
    const connector = getConnector(connection);
    await connector.testConnection();
    await connector.close();
  } catch (err) {
    deleteConnection(connection.id);
    fs.unlinkSync(destPath);
    return jsonError(`Couldn't import that spreadsheet: ${(err as Error).message}`, 422);
  }

  return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
}
