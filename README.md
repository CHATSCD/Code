# ChatData — talk to your database

ChatData is a simplified, easy-to-use take on [DB-GPT](https://github.com/eosphoros-ai/DB-GPT): a web app for asking your database questions in plain English and getting back the SQL, the results, and a plain-language explanation. Where DB-GPT is a large multi-agent platform, ChatData focuses on the single workflow most people actually want — connect a database, ask a question, get an answer — with a guided setup and safe-by-default query execution.

## Works everywhere: Android, Mac, Windows

ChatData is a web app, so it runs in any modern browser on any platform. It's also an installable [PWA](https://web.dev/progressive-web-apps/):

- **Mac / Windows**: open the app in Chrome/Edge and use "Install ChatData" (or the install icon in the address bar) to get an app-like window with its own icon.
- **Android**: open the app in Chrome and choose "Add to Home screen" for the same app-like experience.

Nothing platform-specific is required — there's no separate native build.

## Features

- **Zero-config trial** — spin up a bundled sample SQLite shop database and start chatting immediately, no setup required.
- **Bring your own database** — connect PostgreSQL or MySQL, or upload a SQLite file.
- **Excel import & export** — upload an `.xlsx`/`.xls` file (each sheet becomes its own queryable table) and export any chat result back to a downloadable Excel file.
- **Google Sheets import & export** — sign in with your own Google account to import a spreadsheet as a queryable database, or export any chat result as a brand-new Google Sheet.
- **Bring your own AI** — use OpenAI, Anthropic, Mistral, or any OpenAI-compatible endpoint (e.g. a local model via Ollama/LM Studio). API keys are encrypted at rest.
- **Guided onboarding** — a short wizard walks you through connecting a database and configuring an AI provider.
- **Safe by default** — every AI-generated query is validated to be a single read-only `SELECT`/`WITH` statement before it ever touches your data. DDL/DML, multiple statements, and inline comments are rejected.
- **Plain-language answers** — after running a query, the assistant explains the results in natural language, not just a raw table.

## Getting started

### Prerequisites

- Node.js 18.18+ and npm

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first run you'll land in the onboarding wizard:

1. **Connect a database** — try the built-in sample database, upload a SQLite or Excel file, import a Google Sheet, or connect to PostgreSQL/MySQL.
2. **Configure an AI provider** — enter an API key for OpenAI, Anthropic, or Mistral, or point at any OpenAI-compatible endpoint (including a local model server). You can skip this step and configure it later from Settings.
3. **Start chatting** — ask questions about your data in plain English.

### Production build

```bash
npm run build
npm run start
```

### Other scripts

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
```

## How it works

1. **Schema introspection** — when you ask a question, ChatData reads the connected database's schema (tables, columns, types).
2. **Planning** — the schema, recent conversation, and your question are sent to the configured AI provider, which decides whether a query is needed and, if so, what `SELECT` statement answers it.
3. **Safety guard** — any generated SQL passes through a strict guard (`src/lib/sql-guard.ts`) that only allows a single read-only `SELECT`/`WITH` statement. Anything else (writes, schema changes, multiple statements, `PRAGMA`, etc.) is rejected before it reaches your database.
4. **Execution** — the query runs against your database with a row cap (200 rows by default) so large result sets don't overwhelm the chat or the AI provider.
5. **Summarization** — the results are sent back to the AI provider, which explains them in plain language. The full SQL and result table are also shown, so you can verify exactly what ran.

## Excel and Google Sheets

Both work as data sources you can chat against, and as export targets for any chat result. Under the hood, each sheet/tab is converted into a regular table — in a local SQLite file by default, or in a dedicated Postgres schema when running in [serverless mode](#deploying-to-vercel) — so the entire chat → SQL → safety-guard → execution pipeline above works identically regardless of where the data came from.

### Excel

- **Import**: in the connect-a-database step (onboarding or Settings → Databases → Add database), choose "Upload a file" and pick an `.xlsx`/`.xls` file. Each sheet becomes its own table; column types (text/integer/decimal) are inferred automatically.
- **Export**: under any chat result table, click "Export to Excel" to download the visible rows as a `.xlsx` file.

### Google Sheets

Importing/exporting Google Sheets uses your own Google account via OAuth — ChatData never sees your Google password, and only ever requests access to Sheets (no Drive/Gmail/etc. access).

To enable it:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project and enable the **Google Sheets API**.
2. Configure an OAuth consent screen (External is fine for personal use; add yourself as a test user if it stays in "Testing" mode).
3. Create an **OAuth client ID** of type "Web application".
4. Go to ChatData's Settings page — the "Google Sheets" card shows the exact redirect URI to use (it's `<your app's URL>/api/auth/google/callback`, e.g. `http://localhost:3000/api/auth/google/callback` for local dev). Add it under "Authorized redirect URIs" on the OAuth client, then save.
5. Copy the client's ID and secret into the "Google Sheets" card in ChatData Settings and save.
6. Click "Connect Google account" and sign in. You'll be redirected back to Settings showing "Connected as <your email>".

Once connected:

- **Import**: in the connect-a-database step, choose "Google Sheets" and paste the spreadsheet's URL (or just its ID). Each tab becomes its own table.
- **Export**: under any chat result table, click "Export to Google Sheets" to create a brand-new spreadsheet populated with that result and open it in a new tab.

The OAuth client secret and access/refresh tokens are encrypted at rest the same way AI provider API keys are. Disconnect at any time from the same Settings card.

> Note: the OAuth consent screen itself (the page Google shows you to approve access) can only be completed in a real browser with a registered redirect URI — it can't be exercised in an automated/headless test. Everything else — saving client credentials, the authorization redirect, error handling when not configured/connected, importing/exporting spreadsheets once connected, and the full Excel import/export path — has been tested directly.

## Data and storage

ChatData runs in one of two storage modes, chosen automatically by whether a `DATABASE_URL` environment variable is set:

- **Local mode (default, no `DATABASE_URL`)** — the zero-config experience above. App data (your saved connections, chat history, encrypted provider settings, and uploaded/sample SQLite files) lives in a local `data/` directory created next to the project, and is never sent anywhere except to the AI provider you configure. This requires a writable, persistent local disk, so it only works for `npm run dev`/`npm run start` on your own machine or a traditional always-on server — not on serverless platforms like Vercel, whose deployed function bundle is read-only.
- **Serverless mode (`DATABASE_URL` set)** — for deploying to Vercel or any other serverless host. App data and all materialized imports (sample database, Excel/Google Sheets/SQLite uploads) are stored in the Postgres database at `DATABASE_URL` instead of local files: app state lives in a few tables, and each import gets its own Postgres schema (e.g. `imp_<id>`, `sample_shop`). Any standard Postgres connection string works — Supabase, Neon, Vercel Postgres, etc. See [Deploying to Vercel](#deploying-to-vercel) below.

In both modes:

- Database passwords are masked in the UI and API responses.
- AI provider API keys, the Google OAuth client secret, and Google access/refresh tokens are encrypted at rest (AES-256-GCM).
- Connecting to your own PostgreSQL/MySQL/SQLite database only grants ChatData read access at the application layer (the SQL guard) — for full protection, also use a database role with read-only permissions.

## Deploying to Vercel

Vercel's deployed functions run on a read-only filesystem, so local mode's `data/` directory won't work there — you'll see an `ENOENT: no such file or directory, mkdir '/var/task/data'` error if you deploy without configuring serverless mode first. To deploy, set two environment variables in your Vercel project (Settings → Environment Variables):

- **`DATABASE_URL`** — a Postgres connection string (any provider works: [Supabase](https://supabase.com), [Neon](https://neon.tech), Vercel Postgres, etc.). This switches the app into serverless mode automatically.
- **`ENCRYPTION_KEY`** — a base64-encoded 32-byte key used to encrypt secrets at rest, generated with:
  ```bash
  openssl rand -base64 32
  ```

Both are required together in serverless mode — without `ENCRYPTION_KEY`, the app would otherwise try to fall back to writing a key file to local disk, which fails for the same read-only-filesystem reason. Generate your own value; never reuse an example key.

## Project structure

```
src/
  app/                  Next.js App Router pages and API routes
    api/connections/    Manage database connections (CRUD, sample DB, file/Excel upload, Google Sheets import, schema)
    api/settings/       AI provider configuration and connectivity test
    api/google/         Google OAuth client config, account status, disconnect
    api/auth/google/    Google OAuth authorization-code redirect + callback
    api/export/         Export a chat result to .xlsx or a new Google Sheet
    api/chat/           Chat sessions and messages
    onboarding/         Setup wizard
    chat/               Main chat UI
    settings/           Manage connections, AI provider, and Google account after setup
  components/           UI components (chat, onboarding, settings, shared ui/)
  lib/
    db/                 App-local storage (better-sqlite3) and database connectors (SQLite/Postgres/MySQL)
    llm/                AI provider clients (OpenAI, Anthropic, Mistral, OpenAI-compatible) and prompt building
    google/             Google OAuth client and Sheets API helpers
    excel.ts            Excel (.xlsx/.xls) parsing and generation
    tabular-import.ts   Materializes parsed sheets/tabs into a local SQLite file
    chat-engine.ts      Orchestrates the question -> SQL -> execution -> answer flow
    sql-guard.ts        Read-only SQL enforcement
    crypto.ts           Secret encryption at rest
  types/                Shared TypeScript types
```

## Relationship to DB-GPT

DB-GPT is a full-featured, self-hosted platform with multi-agent workflows, RAG, fine-tuning support, and many data source integrations. ChatData borrows its core idea — natural-language chat over your own database — and re-implements just that slice as a small, easy-to-run web app with a guided setup, so it's approachable for people who just want to ask their database a question without standing up a large platform.
