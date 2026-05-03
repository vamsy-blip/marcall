/**
 * SQLite-backed session store (Control 3).
 *
 * Replaces the in-memory Map. Sessions survive process restarts.
 *
 * Production path:
 *   - Replace `db` import with a Postgres/Supabase drizzle instance.
 *   - Or swap to @upstash/redis with a simple adapter.
 *   - The interface below is intentionally compatible with both.
 *
 * Session security:
 *   - 12h sliding window, 7-day absolute max.
 *   - IP stored as sha256 (never raw).
 *   - Session ID rotated on each login (prevents fixation).
 *   - Cookie name: `__Host-marcall_sid` in prod (same for now; prefix enforced via opts).
 */

import crypto from 'node:crypto';
import { db } from '../storage';
import { sessions } from '@shared/schema';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { isProduction } from '../config';

// 12-hour sliding window, 7-day absolute cap
const SESSION_SLIDING_MS = 12 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip, 'utf8').digest('hex');
}

export function hashUa(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return crypto.createHash('sha256').update(ua, 'utf8').digest('hex');
}

export interface SessionData {
  userId: number;
  tenantId?: number | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
}

/**
 * Create a new session. Returns the session ID.
 */
export function createSession(data: SessionData): string {
  const id = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SLIDING_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  db.insert(sessions).values({
    id,
    userId: data.userId,
    tenantId: data.tenantId ?? null,
    ipHash: data.ipHash ?? null,
    userAgentHash: data.userAgentHash ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    absoluteExpiresAt,
    revokedAt: null,
  } as any).run();
  return id;
}

/**
 * Look up a session. Returns the session record if valid, null otherwise.
 * Extends the sliding window on each access.
 */
export function getSession(id: string): (typeof sessions.$inferSelect) | null {
  if (!id) return null;
  try {
    const rec = db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!rec) return null;
    const now = new Date();
    // Check absolute expiry first
    if (rec.absoluteExpiresAt && new Date(rec.absoluteExpiresAt as any) < now) {
      db.delete(sessions).where(eq(sessions.id, id)).run();
      return null;
    }
    // Check revoked
    if (rec.revokedAt) return null;
    // Check sliding expiry
    if (rec.expiresAt && new Date(rec.expiresAt as any) < now) {
      db.delete(sessions).where(eq(sessions.id, id)).run();
      return null;
    }
    // Extend sliding window
    const newExpiry = new Date(now.getTime() + SESSION_SLIDING_MS);
    db.update(sessions).set({ lastSeenAt: now, expiresAt: newExpiry } as any)
      .where(eq(sessions.id, id)).run();
    return rec;
  } catch {
    return null;
  }
}

/**
 * Destroy (hard-delete) a session by ID.
 */
export function destroySession(id: string): void {
  try {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  } catch {}
}

/**
 * Revoke a session (soft — marks revokedAt, row kept for audit trail).
 */
export function revokeSession(id: string): void {
  try {
    db.update(sessions).set({ revokedAt: new Date() } as any)
      .where(eq(sessions.id, id)).run();
  } catch {}
}

/**
 * List active sessions for a user.
 */
export function listUserSessions(userId: number): (typeof sessions.$inferSelect)[] {
  try {
    const now = new Date();
    return db.select().from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
        )
      )
      .all()
      .filter(s =>
        s.expiresAt && new Date(s.expiresAt as any) > now &&
        s.absoluteExpiresAt && new Date(s.absoluteExpiresAt as any) > now
      );
  } catch {
    return [];
  }
}

/**
 * Sweep expired/revoked sessions older than 7 days (call periodically).
 */
export function purgeStaleSessions(): void {
  try {
    const cutoff = new Date(Date.now() - SESSION_ABSOLUTE_MS);
    db.delete(sessions).where(lt(sessions.absoluteExpiresAt, cutoff) as any).run();
  } catch {}
}

/**
 * Cookie options for the session cookie.
 */
export function sessionCookieOpts() {
  return {
    // httpOnly prevents JavaScript from reading the session cookie (XSS
    // mitigation). Required.
    httpOnly: true,
    // SameSite=strict keeps the session cookie out of any cross-origin
    // request, including top-level navigation initiated by another origin.
    // We do not rely on cross-site links to surface authenticated content,
    // so 'strict' is safe and gives the strongest CSRF defense alongside
    // the explicit double-submit token cookie.
    sameSite: 'strict' as const,
    secure: isProduction,
    maxAge: SESSION_SLIDING_MS,
    path: '/',
    // In production use __Host- prefix; for dev, plain name works.
    // The cookie name itself is set in the caller.
  };
}

/**
 * The cookie name to use.
 * In production: __Host-marcall_sid (enforces Secure + path=/ + no Domain).
 * In dev: marcall_sid.
 */
export const SESSION_COOKIE_NAME = isProduction ? '__Host-marcall_sid' : 'marcall_sid';
