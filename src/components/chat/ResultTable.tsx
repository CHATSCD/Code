import type { QueryResult } from '@/types';

export function ResultTable({ result }: { result: QueryResult }) {
  if (result.rows.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">No rows returned.</p>;
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {result.columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {result.rows.map((row, i) => (
            <tr key={i}>
              {result.columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-3 py-2 text-slate-700">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.truncated && (
        <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          Showing first {result.rows.length} of {result.rowCount} rows.
        </p>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
