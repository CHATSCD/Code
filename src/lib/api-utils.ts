import { NextResponse } from 'next/server';
import type { Connection } from '@/types';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function toSafeConnection(conn: Connection): Connection {
  if (conn.type === 'postgres' || conn.type === 'mysql') {
    const cfg = conn.config as any;
    return { ...conn, config: { ...cfg, password: cfg.password ? '••••••••' : '' } };
  }
  return conn;
}
