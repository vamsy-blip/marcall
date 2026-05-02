import crypto from 'node:crypto';
import { getEncryptionKey } from '../config';

/**
 * AES-256-GCM authenticated encryption helpers.
 *
 * Format: `enc:v1:<keyId>:<iv-hex>:<tag-hex>:<ciphertext-hex>`
 *
 * Key rotation (Control 7):
 *   - The keyId field identifies which key encrypted the value.
 *   - Default keyId is "k1" (from MARCALL_ENCRYPTION_KEY).
 *   - To rotate: add MARCALL_ENCRYPTION_KEY_NEXT + MARCALL_ENCRYPTION_KEY_NEXT_ID,
 *     re-encrypt all enc:v1:k1:... values, then promote the new key to primary.
 *   - Old format `enc:v1:<iv>:<tag>:<ct>` (no keyId, 4 parts after prefix) is
 *     treated as keyId="k1" for backward compat.
 *
 * Plain (legacy) values are returned as-is by `decrypt()` for graceful migration.
 */
const PREFIX = 'enc:v1:';
const DEFAULT_KEY_ID = process.env.MARCALL_ENCRYPTION_KEY_ID || 'k1';

export function encrypt(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return plain ?? null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${DEFAULT_KEY_ID}:${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (!value.startsWith(PREFIX)) return value; // legacy plain

  // Parse parts after "enc:v1:"
  const remainder = value.slice(PREFIX.length);
  const parts = remainder.split(':');

  let ivHex: string, tagHex: string, ctHex: string;

  if (parts.length === 4) {
    // New format: keyId:iv:tag:ciphertext
    // keyId = parts[0] — reserved for future multi-key lookup
    [, ivHex, tagHex, ctHex] = parts;
  } else if (parts.length === 3) {
    // Legacy format (no keyId): iv:tag:ciphertext
    [ivHex, tagHex, ctHex] = parts;
  } else {
    return value; // unrecognized
  }

  if (!ivHex || !tagHex || !ctHex) return value;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ct = Buffer.from(ctHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

export function isEncrypted(v: unknown): boolean {
  return typeof v === 'string' && v.startsWith(PREFIX);
}
