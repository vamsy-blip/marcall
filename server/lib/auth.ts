import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Password hashing & verification.
 *
 * - New writes use bcrypt (cost 12).
 * - Verification accepts BOTH bcrypt and a legacy sha256 format used by the
 *   v0 seed (so existing demo accounts keep working). Legacy hits return
 *   `{ ok: true, needsRehash: true }` so the caller can transparently
 *   upgrade the stored hash.
 */
const BCRYPT_COST = 12;
const LEGACY_SALT = ':marcall_salt';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

function legacyHash(plain: string): string {
  return crypto.createHash('sha256').update(plain + LEGACY_SALT).digest('hex');
}

export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) {
    // Constant-ish time: still hash to avoid leaking "user not found".
    await bcrypt.hash(plain || '_', 4).catch(() => undefined);
    return { ok: false, needsRehash: false };
  }
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    const ok = await bcrypt.compare(plain, stored).catch(() => false);
    return { ok, needsRehash: false };
  }
  // Legacy sha256 hex
  const candidate = legacyHash(plain);
  const ok =
    stored.length === candidate.length &&
    crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(candidate, 'hex'));
  return { ok, needsRehash: ok };
}

/**
 * Lightweight password-strength gate. Requires \u2265 12 chars and at least
 * 3 of: lowercase, uppercase, digit, symbol. Reject the most common patterns.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'passw0rd', '123456789012', 'qwerty123456', 'admin1234567',
  'marcall12345', 'iloveyou1234', 'letmein12345',
]);

export function checkPasswordStrength(pw: string): { ok: boolean; reason?: string } {
  if (!pw || pw.length < 12) {
    return { ok: false, reason: 'min_length' };
  }
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return { ok: false, reason: 'too_common' };
  }
  let categories = 0;
  if (/[a-z]/.test(pw)) categories++;
  if (/[A-Z]/.test(pw)) categories++;
  if (/\d/.test(pw)) categories++;
  if (/[^A-Za-z0-9]/.test(pw)) categories++;
  if (categories < 3) {
    return { ok: false, reason: 'too_simple' };
  }
  return { ok: true };
}
