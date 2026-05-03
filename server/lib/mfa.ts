/**
 * MFA / TOTP helpers using otplib v2 (async API).
 * Wraps the otplib v2 generate/verify/generateURI functions.
 */

import { generate, verify, generateSecret as genSecret, generateURI } from 'otplib';

const ALGORITHM = 'sha1' as const;
const DIGITS = 6;
const PERIOD = 30;
const ISSUER = 'MARCALL';

export function newTotpSecret(): string {
  return genSecret();
}

export async function generateTotpUri(email: string, secret: string): Promise<string> {
  return generateURI({
    issuer: ISSUER,
    label: `${ISSUER}:${email}`,
    secret,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
  });
}

// In-memory replay guard. Each entry is keyed by `${userId}:${token}` and
// expires after one full TOTP period (60s, to also cover ±1 step skew).
// This prevents the same valid TOTP from being accepted twice for the same
// user. Subagents/cluster mode would need a Redis-backed store; in single-
// process mock mode the Map is sufficient.
const usedTotps = new Map<string, number>();
const REPLAY_TTL_MS = 90 * 1000; // ~3x period to cover skew window
setInterval(() => {
  const now = Date.now();
  for (const [k, expiresAt] of usedTotps.entries()) {
    if (expiresAt < now) usedTotps.delete(k);
  }
}, 30 * 1000).unref?.();

export async function verifyTotpToken(
  token: string,
  secret: string,
  userId?: number | string,
): Promise<boolean> {
  try {
    const result = await verify({ token, secret, algorithm: ALGORITHM, digits: DIGITS, period: PERIOD });
    // otplib v2 returns { valid: boolean, ... }
    const ok = result && typeof result === 'object' && 'valid' in (result as any)
      ? !!(result as any).valid
      : !!result;
    if (!ok) return false;
    // Replay guard: only enforce when caller passes a userId.
    if (userId !== undefined && userId !== null) {
      const key = `${userId}:${token}`;
      const now = Date.now();
      const prior = usedTotps.get(key);
      if (prior && prior > now) return false;
      usedTotps.set(key, now + REPLAY_TTL_MS);
    }
    return true;
  } catch {
    return false;
  }
}
