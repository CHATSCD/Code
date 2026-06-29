import { v4 as uuidv4 } from 'uuid';

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

export function assertSafeIdentifier(name: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Unsafe identifier: ${JSON.stringify(name)}`);
  }
  return name;
}

export function newImportSchemaName(): string {
  return `imp_${uuidv4().replace(/-/g, '')}`;
}
