import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { APP_DB_PATH, ensureDataDirs } from '../paths';
import { encryptSecret, decryptSecret } from '../crypto';
import type {
  Connection,
  ConnectionConfig,
  ConnectionSourceKind,
  ConnectionSourceMeta,
  DbType,
  ChatSession,
  ChatMessage,
  ChatRole,
  QueryResult,
  ProviderSettings,
  LlmProviderKind,
} from '@/types';

interface SqlDriver {
  all<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = any>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
}

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'native',
    source_meta TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sql TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  );
`;

class SqliteDriver implements SqlDriver {
  private db: Database.Database | null = null;

  private getDb(): Database.Database {
    if (this.db) return this.db;
    ensureDataDirs();
    const db = new Database(APP_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA_DDL);

    const connectionCols = db.prepare('PRAGMA table_info(connections)').all() as { name: string }[];
    const colNames = new Set(connectionCols.map((c) => c.name));
    if (!colNames.has('source_kind')) {
      db.exec("ALTER TABLE connections ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'native'");
    }
    if (!colNames.has('source_meta')) {
      db.exec('ALTER TABLE connections ADD COLUMN source_meta TEXT');
    }

    this.db = db;
    return db;
  }

  async all<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.getDb().prepare(sql).all(...params) as T[];
  }

  async get<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.getDb().prepare(sql).get(...params) as T | undefined;
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    this.getDb().prepare(sql).run(...params);
  }
}

class PgDriver implements SqlDriver {
  readonly pool: Pool;
  private ready: Promise<void>;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10_000 });
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.pool.query(SCHEMA_DDL);
    } catch (err: any) {
      if (err?.code !== '42P07') throw err;
    }
  }

  private rewrite(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  async all<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.ready;
    const result = await this.pool.query(this.rewrite(sql), params as any[]);
    return result.rows as T[];
  }

  async get<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    await this.ready;
    const result = await this.pool.query(this.rewrite(sql), params as any[]);
    return result.rows[0] as T | undefined;
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.ready;
    await this.pool.query(this.rewrite(sql), params as any[]);
  }
}

const driver: SqlDriver = process.env.DATABASE_URL ? new PgDriver() : new SqliteDriver();

export function getPgPool(): Pool | null {
  return driver instanceof PgDriver ? driver.pool : null;
}

// ---------- Connections ----------

export async function listConnections(): Promise<Connection[]> {
  const rows = await driver.all('SELECT * FROM connections ORDER BY created_at DESC');
  return rows.map(rowToConnection);
}

export async function getConnection(id: string): Promise<Connection | null> {
  const row = await driver.get('SELECT * FROM connections WHERE id = ?', [id]);
  return row ? rowToConnection(row) : null;
}

export async function createConnection(
  name: string,
  type: DbType,
  config: ConnectionConfig,
  isSample = false,
  source?: { kind: ConnectionSourceKind; meta?: ConnectionSourceMeta }
): Promise<Connection> {
  const conn: Connection = {
    id: uuidv4(),
    name,
    type,
    config,
    isSample,
    createdAt: new Date().toISOString(),
    sourceKind: source?.kind ?? 'native',
    sourceMeta: source?.meta ?? null,
  };
  await driver.run(
    'INSERT INTO connections (id, name, type, config, is_sample, created_at, source_kind, source_meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      conn.id,
      conn.name,
      conn.type,
      JSON.stringify(conn.config),
      isSample ? 1 : 0,
      conn.createdAt,
      conn.sourceKind,
      conn.sourceMeta ? JSON.stringify(conn.sourceMeta) : null,
    ]
  );
  return conn;
}

export async function deleteConnection(id: string): Promise<void> {
  const sessions = await driver.all<{ id: string }>('SELECT id FROM chat_sessions WHERE connection_id = ?', [id]);
  for (const s of sessions) {
    await driver.run('DELETE FROM chat_messages WHERE session_id = ?', [s.id]);
  }
  await driver.run('DELETE FROM chat_sessions WHERE connection_id = ?', [id]);
  await driver.run('DELETE FROM connections WHERE id = ?', [id]);
}

function rowToConnection(row: any): Connection {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    config: JSON.parse(row.config),
    isSample: !!row.is_sample,
    createdAt: row.created_at,
    sourceKind: (row.source_kind as ConnectionSourceKind) || 'native',
    sourceMeta: row.source_meta ? JSON.parse(row.source_meta) : null,
  };
}

// ---------- Settings (LLM provider) ----------

const SETTINGS_KEY = 'llm_provider';

export async function getProviderSettings(): Promise<ProviderSettings> {
  const row = await driver.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTINGS_KEY]);
  if (!row) {
    return { provider: 'openai', apiKey: '', model: '', configured: false };
  }
  const parsed = JSON.parse(row.value);
  const apiKey = parsed.apiKey ? decryptSecret(parsed.apiKey) : '';
  const hasKeyIfNeeded = parsed.provider === 'openai-compatible' || !!apiKey;
  return {
    provider: parsed.provider,
    apiKey,
    baseUrl: parsed.baseUrl,
    model: parsed.model,
    configured: hasKeyIfNeeded && !!parsed.model,
  };
}

export async function saveProviderSettings(settings: {
  provider: LlmProviderKind;
  apiKey: string;
  baseUrl?: string;
  model: string;
}): Promise<void> {
  const toStore = {
    provider: settings.provider,
    apiKey: settings.apiKey ? encryptSecret(settings.apiKey) : '',
    baseUrl: settings.baseUrl ?? '',
    model: settings.model,
  };
  await driver.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [SETTINGS_KEY, JSON.stringify(toStore)]
  );
}

// ---------- Chat sessions & messages ----------

export async function listSessions(connectionId?: string): Promise<ChatSession[]> {
  const rows = connectionId
    ? await driver.all('SELECT * FROM chat_sessions WHERE connection_id = ? ORDER BY created_at DESC', [
        connectionId,
      ])
    : await driver.all('SELECT * FROM chat_sessions ORDER BY created_at DESC');
  return rows.map(rowToSession);
}

export async function getSession(id: string): Promise<ChatSession | null> {
  const row = await driver.get('SELECT * FROM chat_sessions WHERE id = ?', [id]);
  return row ? rowToSession(row) : null;
}

export async function createSession(connectionId: string, title: string): Promise<ChatSession> {
  const session: ChatSession = {
    id: uuidv4(),
    connectionId,
    title,
    createdAt: new Date().toISOString(),
  };
  await driver.run('INSERT INTO chat_sessions (id, connection_id, title, created_at) VALUES (?, ?, ?, ?)', [
    session.id,
    session.connectionId,
    session.title,
    session.createdAt,
  ]);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  await driver.run('DELETE FROM chat_messages WHERE session_id = ?', [id]);
  await driver.run('DELETE FROM chat_sessions WHERE id = ?', [id]);
}

export async function renameSession(id: string, title: string): Promise<void> {
  await driver.run('UPDATE chat_sessions SET title = ? WHERE id = ?', [title, id]);
}

function rowToSession(row: any): ChatSession {
  return {
    id: row.id,
    connectionId: row.connection_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await driver.all('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', [
    sessionId,
  ]);
  return rows.map(rowToMessage);
}

export async function addMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
  extra?: { sql?: string | null; result?: QueryResult | null; error?: string | null }
): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: uuidv4(),
    sessionId,
    role,
    content,
    sql: extra?.sql ?? null,
    result: extra?.result ?? null,
    error: extra?.error ?? null,
    createdAt: new Date().toISOString(),
  };
  await driver.run(
    'INSERT INTO chat_messages (id, session_id, role, content, sql, result, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [msg.id, msg.sessionId, msg.role, msg.content, msg.sql, msg.result ? JSON.stringify(msg.result) : null, msg.error, msg.createdAt]
  );
  return msg;
}

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    sql: row.sql,
    result: row.result ? JSON.parse(row.result) : null,
    error: row.error,
    createdAt: row.created_at,
  };
}

// ---------- Google OAuth (Sheets access) ----------

const GOOGLE_CLIENT_KEY = 'google_oauth_client';
const GOOGLE_TOKENS_KEY = 'google_oauth_tokens';

export interface GoogleOAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  email: string;
}

async function readSetting(key: string): Promise<any | null> {
  const row = await driver.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : null;
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  await driver.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)]
  );
}

export async function getGoogleOAuthClientConfig(): Promise<GoogleOAuthClientConfig> {
  const parsed = await readSetting(GOOGLE_CLIENT_KEY);
  if (!parsed) return { clientId: '', clientSecret: '' };
  return {
    clientId: parsed.clientId || '',
    clientSecret: parsed.clientSecret ? decryptSecret(parsed.clientSecret) : '',
  };
}

export async function saveGoogleOAuthClientConfig(config: { clientId: string; clientSecret: string }): Promise<void> {
  await writeSetting(GOOGLE_CLIENT_KEY, {
    clientId: config.clientId,
    clientSecret: config.clientSecret ? encryptSecret(config.clientSecret) : '',
  });
}

export async function getGoogleTokens(): Promise<GoogleTokens> {
  const parsed = await readSetting(GOOGLE_TOKENS_KEY);
  if (!parsed) return { accessToken: '', refreshToken: '', expiryDate: 0, email: '' };
  return {
    accessToken: parsed.accessToken ? decryptSecret(parsed.accessToken) : '',
    refreshToken: parsed.refreshToken ? decryptSecret(parsed.refreshToken) : '',
    expiryDate: parsed.expiryDate || 0,
    email: parsed.email || '',
  };
}

export async function saveGoogleTokens(tokens: GoogleTokens): Promise<void> {
  await writeSetting(GOOGLE_TOKENS_KEY, {
    accessToken: tokens.accessToken ? encryptSecret(tokens.accessToken) : '',
    refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : '',
    expiryDate: tokens.expiryDate,
    email: tokens.email,
  });
}

export async function clearGoogleTokens(): Promise<void> {
  await driver.run('DELETE FROM settings WHERE key = ?', [GOOGLE_TOKENS_KEY]);
}
