import fs from 'fs';
import path from 'path';

export const IS_SERVERLESS_DB = !!process.env.DATABASE_URL;

export const DATA_DIR = path.join(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const APP_DB_PATH = path.join(DATA_DIR, 'chatdata.sqlite3');
export const SECRET_KEY_PATH = path.join(DATA_DIR, 'secret.key');

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, UPLOADS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
