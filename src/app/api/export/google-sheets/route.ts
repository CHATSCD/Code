import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedClient } from '@/lib/google/oauth';
import { createSpreadsheetWithData } from '@/lib/google/sheets';
import { jsonError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Invalid JSON body.');

  const { title, columns, rows } = body as {
    title?: string;
    columns: string[];
    rows: Record<string, unknown>[];
  };
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return jsonError('columns and rows arrays are required.');
  }

  let client;
  try {
    client = await getAuthorizedClient();
  } catch (err) {
    return jsonError((err as Error).message, 422);
  }

  try {
    const { url, spreadsheetId } = await createSpreadsheetWithData(client, title || 'ChatData export', columns, rows);
    return NextResponse.json({ url, spreadsheetId });
  } catch (err) {
    return jsonError(`Couldn't create the spreadsheet: ${(err as Error).message}`, 502);
  }
}
