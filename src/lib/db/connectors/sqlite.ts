import Database from 'better-sqlite3';
import type { SqliteConfig, QueryResult, TableSchema, ColumnSchema } from '@/types';
import { DEFAULT_MAX_ROWS, type DbConnector } from './types';

export class SqliteConnector implements DbConnector {
  private db: Database.Database;

  constructor(config: SqliteConfig) {
    this.db = new Database(config.filePath, { readonly: true, fileMustExist: true });
  }

  dialect(): 'sqlite' {
    return 'sqlite';
  }

  async testConnection(): Promise<void> {
    this.db.prepare('SELECT 1').get();
  }

  async getSchema(): Promise<TableSchema[]> {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    return tables.map((t) => {
      const cols = this.db.prepare(`PRAGMA table_info(${quoteIdent(t.name)})`).all() as any[];
      const columns: ColumnSchema[] = cols.map((c) => ({
        name: c.name,
        type: c.type || 'TEXT',
        nullable: c.notnull === 0,
        isPrimaryKey: c.pk > 0,
      }));
      return { name: t.name, columns };
    });
  }

  async runQuery(sql: string, maxRows = DEFAULT_MAX_ROWS): Promise<QueryResult> {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    const truncated = rows.length > maxRows;
    const limited = truncated ? rows.slice(0, maxRows) : rows;
    const columns = limited.length > 0 ? Object.keys(limited[0]) : (stmt.columns?.() ?? []).map((c) => c.name);
    return { columns, rows: limited, rowCount: rows.length, truncated };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
