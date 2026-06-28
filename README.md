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
- **Bring your own AI** — use OpenAI, Anthropic, or any OpenAI-compatible endpoint (e.g. a local model via Ollama/LM Studio). API keys are encrypted at rest.
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

1. **Connect a database** — try the built-in sample database, upload a SQLite file, or connect to PostgreSQL/MySQL.
2. **Configure an AI provider** — enter an API key for OpenAI or Anthropic, or point at any OpenAI-compatible endpoint (including a local model server). You can skip this step and configure it later from Settings.
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

## Data and storage

- App data (your saved connections, chat history, encrypted provider settings, and uploaded/sample SQLite files) lives in a local `data/` directory created next to the project, and is never sent anywhere except to the AI provider you configure.
- Database passwords are masked in the UI and API responses.
- AI provider API keys are encrypted at rest (AES-256-GCM) using a key generated on first run and stored locally.
- Connecting to your own PostgreSQL/MySQL/SQLite database only grants ChatData read access at the application layer (the SQL guard) — for full protection, also use a database role with read-only permissions.

## Project structure

```
src/
  app/                  Next.js App Router pages and API routes
    api/connections/    Manage database connections (CRUD, sample DB, file upload, schema)
    api/settings/       AI provider configuration and connectivity test
    api/chat/           Chat sessions and messages
    onboarding/         Setup wizard
    chat/               Main chat UI
    settings/           Manage connections and AI provider after setup
  components/           UI components (chat, onboarding, settings, shared ui/)
  lib/
    db/                 App-local storage (better-sqlite3) and database connectors (SQLite/Postgres/MySQL)
    llm/                AI provider clients (OpenAI, Anthropic, OpenAI-compatible) and prompt building
    chat-engine.ts      Orchestrates the question -> SQL -> execution -> answer flow
    sql-guard.ts        Read-only SQL enforcement
    crypto.ts           Secret encryption at rest
  types/                Shared TypeScript types
```

## Relationship to DB-GPT

DB-GPT is a full-featured, self-hosted platform with multi-agent workflows, RAG, fine-tuning support, and many data source integrations. ChatData borrows its core idea — natural-language chat over your own database — and re-implements just that slice as a small, easy-to-run web app with a guided setup, so it's approachable for people who just want to ask their database a question without standing up a large platform.
