import type { Connection } from '@/types';
import type { DbConnector } from './types';
import { SqliteConnector } from './sqlite';
import { PostgresConnector } from './postgres';
import { MysqlConnector } from './mysql';

export type { DbConnector } from './types';
export { DEFAULT_MAX_ROWS } from './types';

export function getConnector(connection: Connection): DbConnector {
  switch (connection.type) {
    case 'sqlite':
      return new SqliteConnector(connection.config as any);
    case 'postgres':
      return new PostgresConnector(connection.config as any);
    case 'mysql':
      return new MysqlConnector(connection.config as any);
    default:
      throw new Error(`Unsupported database type: ${connection.type}`);
  }
}
