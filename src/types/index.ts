export type DbType = 'sqlite' | 'postgres' | 'mysql';

export interface SqliteConfig {
  filePath: string;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface MysqlConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export type ConnectionConfig = SqliteConfig | PostgresConfig | MysqlConfig;

export interface Connection {
  id: string;
  name: string;
  type: DbType;
  config: ConnectionConfig;
  isSample: boolean;
  createdAt: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

export type LlmProviderKind = 'openai' | 'anthropic' | 'mistral' | 'openai-compatible';

export interface ProviderSettings {
  provider: LlmProviderKind;
  apiKey: string;
  baseUrl?: string;
  model: string;
  configured: boolean;
}

export interface ChatSession {
  id: string;
  connectionId: string;
  title: string;
  createdAt: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  sql: string | null;
  result: QueryResult | null;
  error: string | null;
  createdAt: string;
}
