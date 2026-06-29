import Database from 'better-sqlite3';
import type { Pool } from 'pg';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { assertSafeIdentifier } from './db/identifier';

export interface TabularTable {
  name: string;
  header: string[];
  rows: unknown[][];
}

type ColumnType = 'INTEGER' | 'REAL' | 'TEXT';

const PG_BATCH_SIZE = 500;
const SQLITE_REUPLOAD_ROW_LIMIT = 200_000;

export function materializeTablesToSqlite(
  filePath: string,
  tables: TabularTable[]
): { tableCount: number; rowCount: number } {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');

  const usedTableNames = new Set<string>();
  let totalRows = 0;
  let tableCount = 0;

  try {
    for (const table of tables) {
      const dataRows = table.rows.filter((r) =>
        r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
      );
      if (dataRows.length === 0) continue;

      const tableName = uniqueIdent(slugify(table.name, 'sheet'), usedTableNames);
      const columnNames = uniqueColumnNames(table.header, dataRows[0]?.length ?? 0);
      const columnTypes = columnNames.map((_, colIdx) => inferColumnType(dataRows.map((r) => r[colIdx])));

      db.exec(
        `CREATE TABLE ${quote(tableName)} (${columnNames
          .map((c, i) => `${quote(c)} ${columnTypes[i]}`)
          .join(', ')})`
      );

      const placeholders = columnNames.map(() => '?').join(', ');
      const insert = db.prepare(
        `INSERT INTO ${quote(tableName)} (${columnNames.map(quote).join(', ')}) VALUES (${placeholders})`
      );
      const insertMany = db.transaction((rows: unknown[][]) => {
        for (const row of rows) {
          insert.run(...columnNames.map((_, i) => normalizeCell(row[i], columnTypes[i])));
        }
      });
      insertMany(dataRows);

      totalRows += dataRows.length;
      tableCount += 1;
    }
  } finally {
    db.close();
  }

  if (tableCount === 0) {
    throw new Error('No data rows found to import.');
  }

  return { tableCount, rowCount: totalRows };
}

function slugify(name: string, fallback: string): string {
  const cleaned = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = cleaned || fallback;
  return /^[0-9]/.test(base) ? `t_${base}` : base;
}

function uniqueIdent(base: string, used: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${n++}`;
  }
  used.add(candidate);
  return candidate;
}

function uniqueColumnNames(header: string[], minCount: number): string[] {
  const count = Math.max(header.length, minCount);
  const used = new Set<string>();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(uniqueIdent(slugify(header[i] || '', `col_${i + 1}`), used));
  }
  return names;
}

function quote(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function inferColumnType(values: unknown[]): ColumnType {
  let sawInt = false;
  let sawFloat = false;
  let sawText = false;
  for (const v of values) {
    if (v === null || v === undefined || String(v).trim() === '') continue;
    if (typeof v === 'number') {
      if (Number.isInteger(v)) sawInt = true;
      else sawFloat = true;
      continue;
    }
    const s = String(v).trim();
    if (/^-?\d+$/.test(s)) sawInt = true;
    else if (/^-?\d+\.\d+$/.test(s)) sawFloat = true;
    else sawText = true;
  }
  if (sawText) return 'TEXT';
  if (sawFloat) return 'REAL';
  if (sawInt) return 'INTEGER';
  return 'TEXT';
}

function normalizeCell(value: unknown, type: ColumnType): unknown {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (type === 'TEXT') return String(value);
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : n;
}

function pgColumnType(type: ColumnType): string {
  return type === 'REAL' ? 'DOUBLE PRECISION' : type;
}

/**
 * Reads an uploaded raw SQLite file into TabularTable[] via a temp file, so it
 * can be fed into materializeTablesToPostgresSchema() like any other tabular
 * source. BLOB columns are dropped (lossy as text) and reported as warnings;
 * oversized tables are rejected outright given serverless time/memory limits.
 */
export function readSqliteBufferAsTables(buffer: Buffer): { tables: TabularTable[]; warnings: string[] } {
  const tmpPath = path.join(os.tmpdir(), `${randomUUID()}.sqlite3`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    const db = new Database(tmpPath, { readonly: true });
    try {
      const tables: TabularTable[] = [];
      const warnings: string[] = [];

      const tableRows = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      for (const { name } of tableRows) {
        const cols = db.prepare(`PRAGMA table_info(${quote(name)})`).all() as { name: string; type: string }[];

        const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${quote(name)}`).get() as { count: number };
        if (count > SQLITE_REUPLOAD_ROW_LIMIT) {
          throw new Error(
            `Table "${name}" has ${count} rows, which exceeds the ${SQLITE_REUPLOAD_ROW_LIMIT}-row import limit.`
          );
        }

        const blobCols = new Set(cols.filter((c) => /BLOB/i.test(c.type)).map((c) => c.name));
        const keptCols = cols.filter((c) => !blobCols.has(c.name));
        if (blobCols.size > 0) {
          warnings.push(`Dropped BLOB column(s) from "${name}": ${[...blobCols].join(', ')}.`);
        }
        if (keptCols.length === 0) continue;

        const colList = keptCols.map((c) => quote(c.name)).join(', ');
        const rows = db.prepare(`SELECT ${colList} FROM ${quote(name)}`).raw(true).all() as unknown[][];

        tables.push({ name, header: keptCols.map((c) => c.name), rows });
      }

      return { tables, warnings };
    } finally {
      db.close();
    }
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

export async function materializeTablesToPostgresSchema(
  pool: Pool,
  schema: string,
  tables: TabularTable[]
): Promise<{ tableCount: number; rowCount: number }> {
  assertSafeIdentifier(schema);
  const client = await pool.connect();
  const usedTableNames = new Set<string>();
  let totalRows = 0;
  let tableCount = 0;

  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quote(schema)}`);

    for (const table of tables) {
      const dataRows = table.rows.filter((r) =>
        r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
      );
      if (dataRows.length === 0) continue;

      const tableName = uniqueIdent(slugify(table.name, 'sheet'), usedTableNames);
      const columnNames = uniqueColumnNames(table.header, dataRows[0]?.length ?? 0);
      const columnTypes = columnNames.map((_, colIdx) => inferColumnType(dataRows.map((r) => r[colIdx])));
      const qualifiedTable = `${quote(schema)}.${quote(tableName)}`;

      await client.query(
        `CREATE TABLE ${qualifiedTable} (${columnNames
          .map((c, i) => `${quote(c)} ${pgColumnType(columnTypes[i])}`)
          .join(', ')})`
      );

      for (let i = 0; i < dataRows.length; i += PG_BATCH_SIZE) {
        const chunk = dataRows.slice(i, i + PG_BATCH_SIZE);
        const values: unknown[] = [];
        const rowsSql = chunk
          .map((row, rowIdx) => {
            const placeholders = columnNames.map((_, colIdx) => {
              values.push(normalizeCell(row[colIdx], columnTypes[colIdx]));
              return `$${rowIdx * columnNames.length + colIdx + 1}`;
            });
            return `(${placeholders.join(', ')})`;
          })
          .join(', ');
        await client.query(
          `INSERT INTO ${qualifiedTable} (${columnNames.map(quote).join(', ')}) VALUES ${rowsSql}`,
          values
        );
      }

      totalRows += dataRows.length;
      tableCount += 1;
    }

    if (tableCount === 0) {
      throw new Error('No data rows found to import.');
    }

    await client.query('COMMIT');
    return { tableCount, rowCount: totalRows };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
