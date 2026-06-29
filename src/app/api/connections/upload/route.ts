import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createConnection, deleteConnection, getPgPool } from '@/lib/db/app-db';
import { getConnector } from '@/lib/db/connectors';
import { UPLOADS_DIR, ensureDataDirs, IS_SERVERLESS_DB } from '@/lib/paths';
import { jsonError, toSafeConnection } from '@/lib/api-utils';
import { parseExcelBuffer } from '@/lib/excel';
import {
  materializeTablesToSqlite,
  materializeTablesToPostgresSchema,
  readSqliteBufferAsTables,
  TabularTable,
} from '@/lib/tabular-import';
import { newImportSchemaName } from '@/lib/db/identifier';
import type { ConnectionSourceKind, ConnectionSourceMeta } from '@/types';

const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return jsonError('Expected multipart/form-data.');

  const file = form.get('file');
  const name = (form.get('name') as string) || 'My database';
  if (!(file instanceof Blob)) return jsonError('A "file" field is required.');

  const safeBase = path.basename((file as any).name || 'database.sqlite3').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safeBase).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (EXCEL_EXTENSIONS.includes(ext)) {
    let tables: TabularTable[];
    try {
      tables = parseExcelBuffer(buffer);
    } catch (err) {
      return jsonError(`Couldn't read that Excel file: ${(err as Error).message}`, 422);
    }

    if (IS_SERVERLESS_DB) {
      return importTablesToPostgres(tables, name, 'excel', { fileName: safeBase }, "Couldn't import that Excel file");
    }

    ensureDataDirs();
    const destPath = path.join(UPLOADS_DIR, `${uuidv4()}.sqlite3`);
    try {
      materializeTablesToSqlite(destPath, tables);
    } catch (err) {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      return jsonError(`Couldn't import that Excel file: ${(err as Error).message}`, 422);
    }

    const connection = await createConnection(name, 'sqlite', { filePath: destPath }, false, {
      kind: 'excel',
      meta: { fileName: safeBase },
    });

    try {
      const connector = getConnector(connection);
      await connector.testConnection();
      await connector.close();
    } catch (err) {
      await deleteConnection(connection.id);
      fs.unlinkSync(destPath);
      return jsonError(`Couldn't import that Excel file: ${(err as Error).message}`, 422);
    }

    return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
  }

  if (IS_SERVERLESS_DB) {
    let tables: TabularTable[];
    let warnings: string[];
    try {
      const result = readSqliteBufferAsTables(buffer);
      tables = result.tables;
      warnings = result.warnings;
    } catch (err) {
      return jsonError(`That file doesn't look like a valid SQLite database: ${(err as Error).message}`, 422);
    }

    return importTablesToPostgres(
      tables,
      name,
      undefined,
      undefined,
      "That file doesn't look like a valid SQLite database",
      warnings
    );
  }

  ensureDataDirs();
  const destPath = path.join(UPLOADS_DIR, `${uuidv4()}-${safeBase}`);
  fs.writeFileSync(destPath, buffer);

  const connection = await createConnection(name, 'sqlite', { filePath: destPath }, false);

  try {
    const connector = getConnector(connection);
    await connector.testConnection();
    await connector.close();
  } catch (err) {
    await deleteConnection(connection.id);
    fs.unlinkSync(destPath);
    return jsonError(`That file doesn't look like a valid SQLite database: ${(err as Error).message}`, 422);
  }

  return NextResponse.json({ connection: toSafeConnection(connection) }, { status: 201 });
}

async function importTablesToPostgres(
  tables: TabularTable[],
  name: string,
  sourceKind: ConnectionSourceKind | undefined,
  sourceMeta: ConnectionSourceMeta | undefined,
  errorPrefix: string,
  warnings?: string[]
) {
  const pool = getPgPool()!;
  const schema = newImportSchemaName();
  try {
    await materializeTablesToPostgresSchema(pool, schema, tables);
  } catch (err) {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    return jsonError(`${errorPrefix}: ${(err as Error).message}`, 422);
  }

  const connection = await createConnection(
    name,
    'postgres',
    { useAppDatabase: true, schema },
    false,
    sourceKind ? { kind: sourceKind, meta: sourceMeta } : undefined
  );

  try {
    const connector = getConnector(connection);
    await connector.testConnection();
    await connector.close();
  } catch (err) {
    await deleteConnection(connection.id);
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    return jsonError(`${errorPrefix}: ${(err as Error).message}`, 422);
  }

  return NextResponse.json(
    { connection: toSafeConnection(connection), ...(warnings && warnings.length > 0 ? { warnings } : {}) },
    { status: 201 }
  );
}
