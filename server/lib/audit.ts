import crypto from 'node:crypto';
import type { Request } from 'express';
import { db } from '../storage';
import { auditLogs } from '@shared/schema';
import { desc } from 'drizzle-orm';

export type AuditEntry = {
  action: string;
  result?: 'success' | 'denied' | 'error';
  actorUserId?: number | null;
  actorIp?: string | null;
  tenantId?: number | null;
  targetKind?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Compute the hash for a new audit row (Control 8 — tamper-evident chain).
 *
 * Formula: sha256(prevHash + JSON.stringify(rowData))
 * The prevHash is null for the first row.
 */
function computeAuditHash(prevHash: string | null, rowData: Record<string, unknown>): string {
  const data = (prevHash ?? '') + JSON.stringify(rowData);
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Get the hash of the most recent audit log row (the chain head).
 */
function getLatestAuditHash(): string | null {
  try {
    const latest = db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(1).get();
    return (latest as any)?.hash ?? null;
  } catch {
    return null;
  }
}

/**
 * Append a tamper-evident record to the audit_logs table.
 * Best-effort: failures here never block the request flow.
 */
export function logAudit(req: Request | null, entry: AuditEntry): void {
  try {
    const ip = req
      ? ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        null)
      : entry.actorIp ?? null;
    const actorUserId = entry.actorUserId ?? (req?.user?.id ?? null);

    // Build the row data for hashing (before insert)
    const at = new Date();
    const rowData = {
      at: at.toISOString(),
      actorUserId: actorUserId ?? null,
      actorIp: ip,
      tenantId: entry.tenantId ?? null,
      action: entry.action,
      targetKind: entry.targetKind ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      result: entry.result ?? 'success',
    };

    const prevHash = getLatestAuditHash();
    const hash = computeAuditHash(prevHash, rowData);

    db.insert(auditLogs)
      .values({
        ...rowData,
        at,
        prevHash,
        hash,
      } as any)
      .run();
  } catch (e) {
    // Never throw from audit
    console.error('[audit] failed to record event:', (e as Error).message);
  }
}

export function listRecentAudit(limit = 50) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(limit).all();
}

const REDACT_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cardnumber',
  'card_number',
  'cvv',
  'rfc',
  'curp',
  'ine',
]);

export function redactPII<T = unknown>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(redactPII) as any;
  if (typeof obj !== 'object') return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redactPII(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
