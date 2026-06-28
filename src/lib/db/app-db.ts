import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { APP_DB_PATH, ensureDataDirs } from '../paths';
import { encryptSecret, decryptSecret } from '../crypto';
import type {
  Connection,
  ConnectionConfig,
  DbType,
  ChatSession,
  ChatMessage,
  ChatRole,
  QueryResult,
  ProviderSettings,
  LlmProviderKind,
} from '@/types';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  ensureDataDirs();
  db = new Database(APP_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
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
  `);
  return db;
}

// ---------- Connections ----------

export function listConnections(): Connection[] {
  const rows = getDb()
    .prepare('SELECT * FROM connections ORDER BY created_at DESC')
    .all() as any[];
  return rows.map(rowToConnection);
}

export function getConnection(id: string): Connection | null {
  const row = getDb().prepare('SELECT * FROM connections WHERE id = ?').get(id) as any;
  return row ? rowToConnection(row) : null;
}

export function createConnection(
  name: string,
  type: DbType,
  config: ConnectionConfig,
  isSample = false
): Connection {
  const conn: Connection = {
    id: uuidv4(),
    name,
    type,
    config,
    isSample,
    createdAt: new Date().toISOString(),
  };
  getDb()
    .prepare(
      'INSERT INTO connections (id, name, type, config, is_sample, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(conn.id, conn.name, conn.type, JSON.stringify(conn.config), isSample ? 1 : 0, conn.createdAt);
  return conn;
}

export function deleteConnection(id: string): void {
  const d = getDb();
  const sessions = d.prepare('SELECT id FROM chat_sessions WHERE connection_id = ?').all(id) as any[];
  for (const s of sessions) {
    d.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(s.id);
  }
  d.prepare('DELETE FROM chat_sessions WHERE connection_id = ?').run(id);
  d.prepare('DELETE FROM connections WHERE id = ?').run(id);
}

function rowToConnection(row: any): Connection {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    config: JSON.parse(row.config),
    isSample: !!row.is_sample,
    createdAt: row.created_at,
  };
}

// ---------- Settings (LLM provider) ----------

const SETTINGS_KEY = 'llm_provider';

export function getProviderSettings(): ProviderSettings {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
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

export function saveProviderSettings(settings: {
  provider: LlmProviderKind;
  apiKey: string;
  baseUrl?: string;
  model: string;
}): void {
  const toStore = {
    provider: settings.provider,
    apiKey: settings.apiKey ? encryptSecret(settings.apiKey) : '',
    baseUrl: settings.baseUrl ?? '',
    model: settings.model,
  };
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(SETTINGS_KEY, JSON.stringify(toStore));
}

// ---------- Chat sessions & messages ----------

export function listSessions(connectionId?: string): ChatSession[] {
  const d = getDb();
  const rows = connectionId
    ? (d
        .prepare('SELECT * FROM chat_sessions WHERE connection_id = ? ORDER BY created_at DESC')
        .all(connectionId) as any[])
    : (d.prepare('SELECT * FROM chat_sessions ORDER BY created_at DESC').all() as any[]);
  return rows.map(rowToSession);
}

export function getSession(id: string): ChatSession | null {
  const row = getDb().prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as any;
  return row ? rowToSession(row) : null;
}

export function createSession(connectionId: string, title: string): ChatSession {
  const session: ChatSession = {
    id: uuidv4(),
    connectionId,
    title,
    createdAt: new Date().toISOString(),
  };
  getDb()
    .prepare('INSERT INTO chat_sessions (id, connection_id, title, created_at) VALUES (?, ?, ?, ?)')
    .run(session.id, session.connectionId, session.title, session.createdAt);
  return session;
}

export function deleteSession(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(id);
  d.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
}

export function renameSession(id: string, title: string): void {
  getDb().prepare('UPDATE chat_sessions SET title = ? WHERE id = ?').run(title, id);
}

function rowToSession(row: any): ChatSession {
  return {
    id: row.id,
    connectionId: row.connection_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

export function listMessages(sessionId: string): ChatMessage[] {
  const rows = getDb()
    .prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as any[];
  return rows.map(rowToMessage);
}

export function addMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
  extra?: { sql?: string | null; result?: QueryResult | null; error?: string | null }
): ChatMessage {
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
  getDb()
    .prepare(
      'INSERT INTO chat_messages (id, session_id, role, content, sql, result, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      msg.sql,
      msg.result ? JSON.stringify(msg.result) : null,
      msg.error,
      msg.createdAt
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
