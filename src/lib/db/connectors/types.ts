import type { QueryResult, TableSchema } from '@/types';

export interface DbConnector {
  testConnection(): Promise<void>;
  getSchema(): Promise<TableSchema[]>;
  runQuery(sql: string, maxRows?: number): Promise<QueryResult>;
  dialect(): 'sqlite' | 'postgresql' | 'mysql';
  close(): Promise<void>;
}

export const DEFAULT_MAX_ROWS = 200;
