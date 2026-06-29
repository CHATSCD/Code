import crypto from 'crypto';
import fs from 'fs';
import { ensureDataDirs, SECRET_KEY_PATH, IS_SERVERLESS_DB } from './paths';

const ALGO = 'aes-256-gcm';

function getKeyFromEnv(): Buffer {
  const key = Buffer.from(process.env.ENCRYPTION_KEY as string, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY must be a base64-encoded 32-byte key. Generate one with `openssl rand -base64 32`.'
    );
  }
  return key;
}

function getKey(): Buffer {
  if (process.env.ENCRYPTION_KEY) return getKeyFromEnv();
  if (IS_SERVERLESS_DB) {
    throw new Error('ENCRYPTION_KEY is required when DATABASE_URL is set. Generate one with `openssl rand -base64 32`.');
  }
  ensureDataDirs();
  if (!fs.existsSync(SECRET_KEY_PATH)) {
    const key = crypto.randomBytes(32);
    fs.writeFileSync(SECRET_KEY_PATH, key, { mode: 0o600 });
    return key;
  }
  return fs.readFileSync(SECRET_KEY_PATH);
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  if (!payload) return '';
  const key = getKey();
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
