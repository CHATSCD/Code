import { NextRequest, NextResponse } from 'next/server';
import { buildExcelBuffer } from '@/lib/excel';
import { jsonError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Invalid JSON body.');

  const { sheetName, columns, rows } = body as {
    sheetName?: string;
    columns: string[];
    rows: Record<string, unknown>[];
  };
  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return jsonError('columns and rows arrays are required.');
  }

  const buffer = buildExcelBuffer(sheetName || 'Results', columns, rows);
  const safeName = (sheetName || 'results').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'results';

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
    },
  });
}
