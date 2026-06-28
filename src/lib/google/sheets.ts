import { google } from 'googleapis';
import type { TabularTable } from '@/lib/tabular-import';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function fetchSpreadsheetTabs(
  auth: OAuth2Client,
  spreadsheetId: string
): Promise<{ title: string; tables: TabularTable[] }> {
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,sheets.properties.title',
  });
  const title = meta.data.properties?.title || 'Google Sheet';
  const tabTitles = (meta.data.sheets || [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);

  const tables: TabularTable[] = [];
  for (const tabTitle of tabTitles) {
    const valuesRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: tabTitle });
    const grid = (valuesRes.data.values || []) as unknown[][];
    const header = (grid[0] || []).map((h) => (h === null || h === undefined ? '' : String(h)));
    const rows = grid.slice(1);
    tables.push({ name: tabTitle, header, rows });
  }
  return { title, tables };
}

export async function createSpreadsheetWithData(
  auth: OAuth2Client,
  title: string,
  columns: string[],
  rows: Record<string, unknown>[]
): Promise<{ spreadsheetId: string; url: string }> {
  const sheets = google.sheets({ version: 'v4', auth });
  const created = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error('Google Sheets did not return a spreadsheet ID.');

  const values = [columns, ...rows.map((r) => columns.map((c) => formatCellForSheets(r[c])))];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  return {
    spreadsheetId,
    url: created.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

function formatCellForSheets(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
