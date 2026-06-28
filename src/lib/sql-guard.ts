/**
 * Guards against destructive or multi-statement SQL before it is executed
 * against a user's database. This is intentionally conservative: the app
 * only ever needs to run read-only SELECT queries on behalf of the AI, so
 * anything else is rejected rather than "sanitized".
 */

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'REPLACE',
  'GRANT',
  'REVOKE',
  'ATTACH',
  'DETACH',
  'PRAGMA',
  'VACUUM',
  'EXEC',
  'EXECUTE',
  'CALL',
  'MERGE',
  'COPY',
  'INTO OUTFILE',
];

export interface SqlGuardResult {
  safe: boolean;
  reason?: string;
}

export function assertReadOnlySql(sql: string): SqlGuardResult {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { safe: false, reason: 'No SQL was provided.' };
  }

  // Strip a single trailing semicolon, then reject if more statements follow.
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    return { safe: false, reason: 'Only a single SQL statement is allowed.' };
  }

  const startsWithReadKeyword = /^\s*(SELECT|WITH)\b/i.test(withoutTrailingSemicolon);
  if (!startsWithReadKeyword) {
    return { safe: false, reason: 'Only SELECT queries are allowed.' };
  }

  const upper = withoutTrailingSemicolon.toUpperCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(upper)) {
      return { safe: false, reason: `Statement contains a forbidden keyword: ${keyword}.` };
    }
  }

  if (/--|\/\*/.test(withoutTrailingSemicolon)) {
    return { safe: false, reason: 'Inline comments are not allowed in generated SQL.' };
  }

  return { safe: true };
}
