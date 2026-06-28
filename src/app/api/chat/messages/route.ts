import { NextRequest, NextResponse } from 'next/server';
import { addMessage, getConnection, getProviderSettings, getSession, listMessages, renameSession } from '@/lib/db/app-db';
import { answerQuestion } from '@/lib/chat-engine';
import { jsonError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  const message = (body?.message as string | undefined)?.trim();
  if (!sessionId || !message) return jsonError('sessionId and message are required.');

  const session = getSession(sessionId);
  if (!session) return jsonError('Session not found.', 404);
  const connection = getConnection(session.connectionId);
  if (!connection) return jsonError('Connection not found.', 404);

  const priorMessages = listMessages(sessionId);
  const userMessage = addMessage(sessionId, 'user', message);

  if (priorMessages.length === 0) {
    renameSession(sessionId, message.length > 60 ? `${message.slice(0, 57)}...` : message);
  }

  const settings = getProviderSettings();
  const outcome = await answerQuestion(connection, settings, priorMessages, message);

  const assistantMessage = addMessage(sessionId, 'assistant', outcome.content, {
    sql: outcome.sql,
    result: outcome.result,
    error: outcome.error,
  });

  return NextResponse.json({ userMessage, assistantMessage });
}
