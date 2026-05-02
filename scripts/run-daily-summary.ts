#!/usr/bin/env tsx
/**
 * MARCALL — Manual daily summary trigger
 *
 * Usage:
 *   npx tsx scripts/run-daily-summary.ts
 *
 * This script loads the database, computes yesterday's KPIs for every active
 * tenant, enqueues the daily_summary rows, then runs the email worker once
 * to drain the outbox immediately.
 *
 * Production: this is replaced by the HTTP cron endpoint
 *   POST /api/cron/daily-summary (gated by X-Cron-Token)
 * The external scheduler (Vercel Cron or GitHub Actions) hits that endpoint
 * every day at 08:00 America/Monterrey.
 *
 * GitHub Actions example (.github/workflows/daily-summary.yml):
 *   on:
 *     schedule:
 *       - cron: '0 14 * * *'   # 14:00 UTC = 08:00 CST
 *   jobs:
 *     trigger:
 *       steps:
 *         - name: Trigger daily summary
 *           run: |
 *             curl -X POST https://marcall.careofaddress.com/api/cron/daily-summary \
 *               -H "X-Cron-Token: ${{ secrets.MARCALL_CRON_SECRET }}"
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();
import { enqueueDailySummaries } from '../server/lib/daily-summary';

async function main() {
  console.log('[run-daily-summary] Starting...');
  const count = await enqueueDailySummaries();
  console.log(`[run-daily-summary] Enqueued ${count} daily summary email(s).`);

  if (count === 0) {
    console.log('[run-daily-summary] Nothing to send. Check that tenants have owner users with emails.');
    process.exit(0);
  }

  // Drain outbox immediately (import worker and run one pass)
  console.log('[run-daily-summary] Draining outbox...');
  // Dynamic import to avoid circular dependency issues
  const { storage } = await import('../server/storage');
  const { sendEmail } = await import('../server/lib/email');

  const pending = await storage.getPendingEmails(100);
  console.log(`[run-daily-summary] ${pending.length} email(s) in outbox`);

  let sent = 0;
  let failed = 0;
  for (const row of pending) {
    const { to, lang, data } = row.payload as { to: string; lang: 'es' | 'en'; data: Record<string, unknown> };
    const result = await sendEmail(row.type as any, { to, lang, data });
    if ('id' in result) {
      await storage.markEmailSent(row.id, result.id);
      console.log(`  ✓ Sent ${row.type} to ${to} (id=${result.id})`);
      sent++;
    } else {
      await storage.markEmailFailed(row.id, result.error);
      console.warn(`  ✗ Failed ${row.type} to ${to}: ${result.error}`);
      failed++;
    }
  }

  console.log(`[run-daily-summary] Done: ${sent} sent, ${failed} failed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[run-daily-summary] Fatal error:', err);
  process.exit(1);
});
