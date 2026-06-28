'use client';

import { useState } from 'react';
import type { QueryResult } from '@/types';

export function ResultTable({ result }: { result: QueryResult }) {
  const [exporting, setExporting] = useState<'xlsx' | 'sheets' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  if (result.rows.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">No rows returned.</p>;
  }

  async function exportXlsx() {
    setExporting('xlsx');
    setExportError(null);
    try {
      const res = await fetch('/api/export/xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: 'Results', columns: result.columns, rows: result.rows }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'results.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  async function exportGoogleSheets() {
    setExporting('sheets');
    setExportError(null);
    setSheetUrl(null);
    try {
      const res = await fetch('/api/export/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'ChatData export', columns: result.columns, rows: result.rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed.');
      setSheetUrl(data.url);
      window.open(data.url, '_blank');
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(null);
    }
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
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <button
          onClick={exportXlsx}
          disabled={exporting !== null}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          {exporting === 'xlsx' ? 'Exporting…' : 'Export to Excel'}
        </button>
        <button
          onClick={exportGoogleSheets}
          disabled={exporting !== null}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          {exporting === 'sheets' ? 'Creating sheet…' : 'Export to Google Sheets'}
        </button>
        {sheetUrl && (
          <a href={sheetUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline">
            Open sheet ↗
          </a>
        )}
        {exportError && <span className="text-xs text-red-600">{exportError}</span>}
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
