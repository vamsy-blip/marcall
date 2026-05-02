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

export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret, algorithm: ALGORITHM, digits: DIGITS, period: PERIOD });
    // otplib v2 returns { valid: boolean, ... }
    if (result && typeof result === 'object' && 'valid' in (result as any)) {
      return !!(result as any).valid;
    }
    return !!result;
  } catch {
    return false;
  }
}
