import mysql from 'mysql2/promise';
import type { MysqlConfig, QueryResult, TableSchema, ColumnSchema } from '@/types';
import { DEFAULT_MAX_ROWS, type DbConnector } from './types';

export class MysqlConnector implements DbConnector {
  private pool: mysql.Pool;
  private database: string;

  constructor(config: MysqlConfig) {
    this.database = config.database;
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      connectionLimit: 3,
    });
  }

  dialect(): 'mysql' {
    return 'mysql';
  }

  async testConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async getSchema(): Promise<TableSchema[]> {
    const [tableRows] = await this.pool.query<any[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
      [this.database]
    );

    const tables: TableSchema[] = [];
    for (const row of tableRows as any[]) {
      const tableName = row.table_name ?? row.TABLE_NAME;
      const [colRows] = await this.pool.query<any[]>(
        `SELECT column_name, data_type, is_nullable, column_key
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [this.database, tableName]
      );
      const columns: ColumnSchema[] = (colRows as any[]).map((c) => ({
        name: c.column_name ?? c.COLUMN_NAME,
        type: c.data_type ?? c.DATA_TYPE,
        nullable: (c.is_nullable ?? c.IS_NULLABLE) === 'YES',
        isPrimaryKey: (c.column_key ?? c.COLUMN_KEY) === 'PRI',
      }));
      tables.push({ name: tableName, columns });
    }
    return tables;
  }

  async runQuery(sql: string, maxRows = DEFAULT_MAX_ROWS): Promise<QueryResult> {
    const [rows, fields] = await this.pool.query<any[]>(sql);
    const allRows = rows as Record<string, unknown>[];
    const truncated = allRows.length > maxRows;
    const limited = truncated ? allRows.slice(0, maxRows) : allRows;
    const columns = (fields ?? []).map((f: any) => f.name) || (limited[0] ? Object.keys(limited[0]) : []);
    return { columns, rows: limited, rowCount: allRows.length, truncated };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
