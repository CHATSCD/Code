import type { ChatMessage, QueryResult, TableSchema } from '@/types';
import type { ChatTurn } from './types';

export function formatSchema(tables: TableSchema[]): string {
  if (tables.length === 0) return '(no tables found)';
  return tables
    .map((t) => {
      const cols = t.columns
        .map((c) => `${c.name} ${c.type}${c.isPrimaryKey ? ' PRIMARY KEY' : ''}`)
        .join(', ');
      return `${t.name}(${cols})`;
    })
    .join('\n');
}

export function buildPlanningMessages(
  dialect: string,
  schema: TableSchema[],
  history: ChatMessage[],
  question: string
): ChatTurn[] {
  const system = `You are a helpful data analyst assistant embedded in a database chat app.
You answer questions about the user's ${dialect} database.

Database schema:
${formatSchema(schema)}

Rules:
- If the question requires looking at data, respond with a single read-only SQL SELECT query that answers it. Never write INSERT/UPDATE/DELETE/DDL.
- Use only tables/columns that exist in the schema above.
- Keep queries reasonably scoped (add LIMIT for "list"/"show" style questions unless the user asks for everything).
- If the question does not require data (greetings, capability questions, clarifications), don't write a query.
- Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{"needs_query": boolean, "sql": string | null, "message": string}
"message" is a short direct answer when needs_query is false, or a brief one-line note about what you're about to look up when needs_query is true.`;

  const turns: ChatTurn[] = [{ role: 'system', content: system }];
  for (const m of history.slice(-8)) {
    turns.push({ role: m.role, content: m.content });
  }
  turns.push({ role: 'user', content: question });
  return turns;
}

export function buildSummaryMessages(question: string, sql: string, result: QueryResult): ChatTurn[] {
  const preview = result.rows.slice(0, 30);
  const system = `You are a helpful data analyst. Explain query results in clear, concise natural language for a non-technical user.
- Reference concrete numbers/names from the data when relevant.
- If the result is empty, say so plainly.
- Do not invent data that isn't present in the results.
- Keep it brief: a sentence or two, plus a short bullet list only if it materially helps.`;

  const user = `Question: ${question}

SQL used: ${sql}

Result (${result.rowCount} row${result.rowCount === 1 ? '' : 's'}${result.truncated ? ', truncated preview' : ''}):
${JSON.stringify(preview, null, 0)}

Answer the question using this data.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function parsePlanningResponse(raw: string): { needsQuery: boolean; sql: string | null; message: string } {
  const cleaned = stripCodeFence(raw.trim());
  try {
    const parsed = JSON.parse(cleaned);
    return {
      needsQuery: !!parsed.needs_query,
      sql: typeof parsed.sql === 'string' ? parsed.sql : null,
      message: typeof parsed.message === 'string' ? parsed.message : '',
    };
  } catch {
    // Model didn't follow the JSON contract; fall back to treating the
    // whole reply as a direct answer rather than failing the request.
    return { needsQuery: false, sql: null, message: cleaned };
  }
}

function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : text;
}
