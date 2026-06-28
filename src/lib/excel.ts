import * as XLSX from 'xlsx';
import type { TabularTable } from './tabular-import';

export function parseExcelBuffer(buffer: Buffer): TabularTable[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: null });
    const header = (grid[0] || []).map((h) => (h === null || h === undefined ? '' : String(h)));
    const rows = grid.slice(1);
    return { name, header, rows };
  });
}

export function buildExcelBuffer(sheetName: string, columns: string[], rows: Record<string, unknown>[]): Buffer {
  const aoa = [columns, ...rows.map((r) => columns.map((c) => formatCell(r[c])))];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  const safeName = sheetName.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function formatCell(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
