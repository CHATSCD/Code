import { Pool } from 'pg';
import type { PostgresConfig, QueryResult, TableSchema, ColumnSchema } from '@/types';
import { DEFAULT_MAX_ROWS, type DbConnector } from './types';
import { assertSafeIdentifier } from '@/lib/db/identifier';

export class PostgresConnector implements DbConnector {
  private pool: Pool;
  private schema: string;

  constructor(config: PostgresConfig) {
    this.schema = assertSafeIdentifier(config.schema || 'public');
    this.pool = config.useAppDatabase
      ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3, statement_timeout: 15_000 })
      : new Pool({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
          max: 3,
          statement_timeout: 15_000,
        });
  }

  dialect(): 'postgresql' {
    return 'postgresql';
  }

  async testConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async getSchema(): Promise<TableSchema[]> {
    const tablesRes = await this.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [this.schema]
    );

    const tables: TableSchema[] = [];
    for (const { table_name } of tablesRes.rows) {
      const colsRes = await this.pool.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [this.schema, table_name]
      );
      const pkRes = await this.pool.query<{ column_name: string }>(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'`,
        [this.schema, table_name]
      );
      const pkSet = new Set(pkRes.rows.map((r) => r.column_name));
      const columns: ColumnSchema[] = colsRes.rows.map((c) => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
        isPrimaryKey: pkSet.has(c.column_name),
      }));
      const name = this.schema === 'public' ? table_name : `"${this.schema}"."${table_name}"`;
      tables.push({ name, columns });
    }
    return tables;
  }

  async runQuery(sql: string, maxRows = DEFAULT_MAX_ROWS): Promise<QueryResult> {
    const res = await this.pool.query(sql);
    const truncated = res.rows.length > maxRows;
    const limited = truncated ? res.rows.slice(0, maxRows) : res.rows;
    const columns = res.fields.map((f) => f.name);
    return { columns, rows: limited, rowCount: res.rows.length, truncated };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
