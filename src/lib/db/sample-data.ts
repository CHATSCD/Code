import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import { UPLOADS_DIR, ensureDataDirs } from '../paths';
import { assertSafeIdentifier } from './identifier';

export const SAMPLE_DB_FILENAME = 'sample-shop.sqlite3';
export const SAMPLE_SCHEMA = 'sample_shop';

const SAMPLE_CUSTOMERS: [number, string, string, string, string][] = [
  [1, 'Ava Thompson', 'ava@example.com', 'USA', '2024-01-12'],
  [2, 'Liam Chen', 'liam@example.com', 'Canada', '2024-02-03'],
  [3, 'Sofia Rossi', 'sofia@example.com', 'Italy', '2024-02-20'],
  [4, 'Noah Patel', 'noah@example.com', 'India', '2024-03-05'],
  [5, 'Mia Johansson', 'mia@example.com', 'Sweden', '2024-04-18'],
  [6, 'Lucas Garcia', 'lucas@example.com', 'Mexico', '2024-05-01'],
];

const SAMPLE_PRODUCTS: [number, string, string, number][] = [
  [1, 'Wireless Mouse', 'Electronics', 24.99],
  [2, 'Mechanical Keyboard', 'Electronics', 79.99],
  [3, 'Standing Desk', 'Furniture', 349.0],
  [4, 'Ergonomic Chair', 'Furniture', 219.5],
  [5, 'USB-C Hub', 'Electronics', 39.99],
  [6, 'Desk Lamp', 'Furniture', 29.0],
];

const SAMPLE_ORDERS: [number, number, number, number, string, string][] = [
  [1, 1, 1, 2, '2024-03-01', 'delivered'],
  [2, 1, 3, 1, '2024-03-15', 'delivered'],
  [3, 2, 2, 1, '2024-03-20', 'delivered'],
  [4, 3, 5, 3, '2024-04-02', 'shipped'],
  [5, 4, 4, 1, '2024-04-10', 'delivered'],
  [6, 5, 6, 2, '2024-04-22', 'pending'],
  [7, 6, 2, 1, '2024-05-05', 'delivered'],
  [8, 2, 5, 1, '2024-05-12', 'shipped'],
  [9, 3, 1, 1, '2024-05-20', 'delivered'],
  [10, 1, 6, 1, '2024-06-01', 'pending'],
];

/**
 * Creates (or reuses) a small sample SQLite database with a tiny e-commerce
 * schema + seed data, so first-time users can try the app without bringing
 * their own database.
 */
export function ensureSampleDatabase(): string {
  ensureDataDirs();
  const filePath = path.join(UPLOADS_DIR, SAMPLE_DB_FILENAME);
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      country TEXT NOT NULL,
      signed_up_at TEXT NOT NULL
    );

    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      ordered_at TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);

  const insertCustomer = db.prepare(
    'INSERT INTO customers (id, name, email, country, signed_up_at) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of SAMPLE_CUSTOMERS) insertCustomer.run(...c);

  const insertProduct = db.prepare('INSERT INTO products (id, name, category, price) VALUES (?, ?, ?, ?)');
  for (const p of SAMPLE_PRODUCTS) insertProduct.run(...p);

  const insertOrder = db.prepare(
    'INSERT INTO orders (id, customer_id, product_id, quantity, ordered_at, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const o of SAMPLE_ORDERS) insertOrder.run(...o);

  db.close();
  return filePath;
}

/**
 * Postgres equivalent of ensureSampleDatabase(): creates a fixed `sample_shop`
 * schema inside the app's DATABASE_URL database, seeding it only once.
 */
export async function ensureSampleDatabasePostgres(pool: Pool): Promise<string> {
  assertSafeIdentifier(SAMPLE_SCHEMA);
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${SAMPLE_SCHEMA}"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${SAMPLE_SCHEMA}".customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        country TEXT NOT NULL,
        signed_up_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${SAMPLE_SCHEMA}".products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "${SAMPLE_SCHEMA}".orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES "${SAMPLE_SCHEMA}".customers(id),
        product_id INTEGER NOT NULL REFERENCES "${SAMPLE_SCHEMA}".products(id),
        quantity INTEGER NOT NULL,
        ordered_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);

    const { rows } = await client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM "${SAMPLE_SCHEMA}".customers`);
    if (Number(rows[0].count) > 0) {
      return SAMPLE_SCHEMA;
    }

    for (const c of SAMPLE_CUSTOMERS) {
      await client.query(
        `INSERT INTO "${SAMPLE_SCHEMA}".customers (id, name, email, country, signed_up_at) VALUES ($1, $2, $3, $4, $5)`,
        c
      );
    }
    for (const p of SAMPLE_PRODUCTS) {
      await client.query(`INSERT INTO "${SAMPLE_SCHEMA}".products (id, name, category, price) VALUES ($1, $2, $3, $4)`, p);
    }
    for (const o of SAMPLE_ORDERS) {
      await client.query(
        `INSERT INTO "${SAMPLE_SCHEMA}".orders (id, customer_id, product_id, quantity, ordered_at, status) VALUES ($1, $2, $3, $4, $5, $6)`,
        o
      );
    }

    return SAMPLE_SCHEMA;
  } finally {
    client.release();
  }
}
