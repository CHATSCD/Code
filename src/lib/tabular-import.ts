import Database from 'better-sqlite3';

export interface TabularTable {
  name: string;
  header: string[];
  rows: unknown[][];
}

type ColumnType = 'INTEGER' | 'REAL' | 'TEXT';

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
