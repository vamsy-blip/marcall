#!/usr/bin/env tsx
/**
 * Audit log tamper-detection script (Control 8).
 *
 * Walks every row in audit_logs in insertion order and recomputes the hash chain.
 * Reports any rows where the stored hash does not match the computed hash, or where
 * prevHash does not match the prior row's hash.
 *
 * Usage:
 *   npm run audit:verify
 *   npx tsx scripts/verify-audit-chain.ts
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

function computeHash(prevHash: string | null, rowData: Record<string, unknown>): string {
  const data = (prevHash ?? '') + JSON.stringify(rowData);
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function rowToData(row: any): Record<string, unknown> {
  return {
    at: row.at ? new Date(row.at * 1000).toISOString() : null,
    actorUserId: row.actor_user_id ?? null,
    actorIp: row.actor_ip ?? null,
    tenantId: row.tenant_id ?? null,
    action: row.action,
    targetKind: row.target_kind ?? null,
    targetId: row.target_id ?? null,
    metadata: row.metadata ?? null,
    result: row.result ?? 'success',
  };
}

async function main() {
  const dbPath = process.env.SQLITE_PATH || 'data.db';
  let sqlite: Database.Database;
  try {
    sqlite = new Database(dbPath, { readonly: true });
  } catch (e) {
    console.error(`[audit:verify] Cannot open database at ${dbPath}:`, (e as Error).message);
    process.exit(1);
  }

  let rows: any[];
  try {
    rows = sqlite.prepare('SELECT * FROM audit_logs ORDER BY id ASC').all();
  } catch (e: any) {
    // Table doesn't exist yet (pre-migration state) — honest empty result.
    if (e?.message?.includes('no such table')) {
      console.log('[audit:verify] audit_logs table does not exist yet — nothing to verify.');
      console.log(JSON.stringify({ verified: true, rowCount: 0, message: 'No entries to verify' }));
      process.exit(0);
    }
    throw e;
  }

  // Honest empty-table result — do NOT fabricate a 'chain intact' message on
  // zero rows; simply report that there is nothing to check.
  if (rows.length === 0) {
    console.log('[audit:verify] audit_logs is empty — nothing to verify.');
    console.log(JSON.stringify({ verified: true, rowCount: 0, message: 'No entries to verify' }));
    process.exit(0);
  }

  console.log(`[audit:verify] Checking ${rows.length} audit log rows...`);

  let prevHash: string | null = null;
  let errors = 0;

  for (const row of rows as any[]) {
    const data = rowToData(row);
    const expectedHash = computeHash(prevHash, data);
    const storedHash = row.hash as string | null;

    if (!storedHash) {
      // Rows written before v2 hash chain don't have a hash — skip
      prevHash = null;
      continue;
    }

    // Verify prevHash pointer
    if (row.prev_hash !== prevHash) {
      console.error(`[audit:verify] Row ${row.id}: prevHash mismatch. Expected: ${prevHash}, Got: ${row.prev_hash}`);
      errors++;
    }

    // Verify hash
    if (storedHash !== expectedHash) {
      console.error(`[audit:verify] Row ${row.id}: hash mismatch. Expected: ${expectedHash}, Got: ${storedHash}`);
      errors++;
    }

    prevHash = storedHash;
  }

  if (errors === 0) {
    console.log('[audit:verify] ✓ Audit chain intact. No tampering detected.');
    console.log(JSON.stringify({ verified: true, rowCount: rows.length, message: 'Audit chain intact' }));
    process.exit(0);
  } else {
    console.error(`[audit:verify] ✗ Found ${errors} hash chain violation(s). Potential tampering detected!`);
    console.log(JSON.stringify({ verified: false, rowCount: rows.length, violations: errors, message: `${errors} hash chain violation(s) found` }));
    process.exit(1);
  }
}

main().catch(e => {
  console.error('[audit:verify] Fatal error:', e);
  process.exit(1);
});
