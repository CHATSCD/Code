'use client';

import { useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Label } from '../ui/Input';
import type { Connection } from '@/types';

type Tab = 'sample' | 'upload' | 'google-sheets' | 'postgres' | 'mysql';

export function ConnectStep({ onConnected }: { onConnected: (connection: Connection) => void }) {
  const [tab, setTab] = useState<Tab>('sample');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pg, setPg] = useState({ name: '', host: 'localhost', port: '5432', database: '', user: '', password: '' });
  const [my, setMy] = useState({ name: '', host: 'localhost', port: '3306', database: '', user: '', password: '' });
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');

  async function useSample() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connections/sample', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create sample database.');
      onConnected(data.connection);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a .sqlite, .db, or .db3 file first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', file.name.replace(/\.(sqlite3?|db3?|xlsx?|xls)$/i, ''));
      const res = await fetch('/api/connections/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      onConnected(data.connection);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function importGoogleSheet() {
    if (!sheetUrl.trim()) {
      setError('Paste a Google Sheets URL or ID first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connections/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl, name: sheetName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      onConnected(data.connection);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function connectServer(type: 'postgres' | 'mysql') {
    const form = type === 'postgres' ? pg : my;
    if (!form.name || !form.database || !form.user) {
      setError('Name, database, and user are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type,
          config: { ...form, port: Number(form.port) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not connect.');
      onConnected(data.connection);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Connect a database</h2>
      <p className="mt-1 text-sm text-slate-500">
        Pick whichever is easiest. You can always add more connections later from Settings.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ['sample', 'Try a sample database'],
            ['upload', 'Upload a file'],
            ['google-sheets', 'Google Sheets'],
            ['postgres', 'PostgreSQL'],
            ['mysql', 'MySQL'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setError(null);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="mt-4 p-5">
        {tab === 'sample' && (
          <div>
            <p className="text-sm text-slate-600">
              A small ready-made shop database (customers, products, orders) so you can try ChatData in seconds
              without setting anything up.
            </p>
            <Button className="mt-4" onClick={useSample} loading={loading}>
              Use sample database
            </Button>
          </div>
        )}

        {tab === 'upload' && (
          <div>
            <p className="text-sm text-slate-600">
              Have a SQLite database (.sqlite, .db) or an Excel spreadsheet (.xlsx, .xls) on this device? Upload it.
              Each sheet in an Excel file becomes its own table you can query.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sqlite,.sqlite3,.db,.db3,.xlsx,.xls"
              className="mt-3 block w-full text-sm text-slate-600"
            />
            <Button className="mt-4" onClick={uploadFile} loading={loading}>
              Upload &amp; connect
            </Button>
          </div>
        )}

        {tab === 'google-sheets' && (
          <div>
            <p className="text-sm text-slate-600">
              Import a Google Sheet as a queryable database. Connect your Google account first in{' '}
              <a href="/settings" className="text-brand-600 hover:underline">
                Settings
              </a>
              , then paste the spreadsheet link below. Each tab becomes its own table.
            </p>
            <div className="mt-3 grid gap-3">
              <div>
                <Label>Connection name (optional)</Label>
                <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="My spreadsheet" />
              </div>
              <div>
                <Label>Google Sheets URL or ID</Label>
                <Input
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
              </div>
            </div>
            <Button className="mt-4" onClick={importGoogleSheet} loading={loading}>
              Import &amp; connect
            </Button>
          </div>
        )}

        {tab === 'postgres' && (
          <ServerForm type="postgres" value={pg} onChange={setPg} onSubmit={() => connectServer('postgres')} loading={loading} />
        )}

        {tab === 'mysql' && (
          <ServerForm type="mysql" value={my} onChange={setMy} onSubmit={() => connectServer('mysql')} loading={loading} />
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>
    </div>
  );
}

interface ServerFormValue {
  name: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

function ServerForm({
  type,
  value,
  onChange,
  onSubmit,
  loading,
}: {
  type: 'postgres' | 'mysql';
  value: ServerFormValue;
  onChange: (v: ServerFormValue) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const set = (key: keyof ServerFormValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Connection name</Label>
        <Input value={value.name} onChange={set('name')} placeholder={type === 'postgres' ? 'Production DB' : 'My MySQL DB'} />
      </div>
      <div>
        <Label>Host</Label>
        <Input value={value.host} onChange={set('host')} placeholder="localhost" />
      </div>
      <div>
        <Label>Port</Label>
        <Input value={value.port} onChange={set('port')} placeholder={type === 'postgres' ? '5432' : '3306'} />
      </div>
      <div>
        <Label>Database</Label>
        <Input value={value.database} onChange={set('database')} />
      </div>
      <div>
        <Label>User</Label>
        <Input value={value.user} onChange={set('user')} />
      </div>
      <div className="sm:col-span-2">
        <Label>Password</Label>
        <Input type="password" value={value.password} onChange={set('password')} />
      </div>
      <div className="sm:col-span-2">
        <Button onClick={onSubmit} loading={loading}>
          Test &amp; connect
        </Button>
      </div>
    </div>
  );
}
