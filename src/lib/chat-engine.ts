import type { Connection, ChatMessage, ProviderSettings, QueryResult } from '@/types';
import { getConnector } from './db/connectors';
import { getLlmClient, LlmError } from './llm';
import { buildPlanningMessages, buildSummaryMessages, parsePlanningResponse } from './llm/prompts';
import { assertReadOnlySql } from './sql-guard';

export interface AnswerOutcome {
  content: string;
  sql: string | null;
  result: QueryResult | null;
  error: string | null;
}

export async function answerQuestion(
  connection: Connection,
  settings: ProviderSettings,
  history: ChatMessage[],
  question: string
): Promise<AnswerOutcome> {
  if (!settings.configured) {
    return {
      content: 'No AI provider is configured yet. Add an API key in Settings to start chatting.',
      sql: null,
      result: null,
      error: 'not_configured',
    };
  }

  const connector = getConnector(connection);
  const llm = getLlmClient(settings);

  try {
    const schema = await connector.getSchema();
    const planningRaw = await llm.complete(buildPlanningMessages(connector.dialect(), schema, history, question));
    const plan = parsePlanningResponse(planningRaw);

    if (!plan.needsQuery || !plan.sql) {
      return { content: plan.message || "I'm not sure how to answer that.", sql: null, result: null, error: null };
    }

    const guard = assertReadOnlySql(plan.sql);
    if (!guard.safe) {
      return {
        content: `I generated a query but it didn't pass the safety check (${guard.reason}). Could you rephrase your question?`,
        sql: plan.sql,
        result: null,
        error: guard.reason ?? 'unsafe_sql',
      };
    }

    let result: QueryResult;
    try {
      result = await connector.runQuery(plan.sql);
    } catch (err) {
      return {
        content: `The query failed to run: ${(err as Error).message}`,
        sql: plan.sql,
        result: null,
        error: (err as Error).message,
      };
    }

    const summaryRaw = await llm.complete(buildSummaryMessages(question, plan.sql, result));
    return { content: summaryRaw.trim(), sql: plan.sql, result, error: null };
  } catch (err) {
    const message = err instanceof LlmError ? err.message : `Something went wrong: ${(err as Error).message}`;
    return { content: message, sql: null, result: null, error: message };
  } finally {
    await connector.close();
  }
}
