/**
 * MARCALL Email Outbox Worker
 *
 * Polls the email_outbox table every 30 seconds for pending rows.
 * On success  → marks row sent with provider id.
 * On failure  → increments attempts; schedules exponential-backoff retry.
 * After MAX_ATTEMPTS failures the row is marked permanently failed.
 */

import { storage } from '../storage';
import { sendEmail } from './email';
import type { EmailType } from './email';

const POLL_INTERVAL_MS = 30_000; // 30 s
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

async function processOutbox(): Promise<void> {
  let pending: Awaited<ReturnType<typeof storage.getPendingEmails>>;
  try {
    pending = await storage.getPendingEmails(BATCH_SIZE);
  } catch (err) {
    console.error('[email-worker] error fetching pending emails:', (err as Error).message);
    return;
  }

  if (pending.length === 0) return;
  console.log(`[email-worker] processing ${pending.length} pending email(s)`);

  for (const row of pending) {
    try {
      const { to, lang, data } = row.payload as {
        to: string;
        lang: 'es' | 'en';
        data: Record<string, unknown>;
      };

      const result = await sendEmail(row.type as EmailType, { to, lang, data });

      if ('id' in result) {
        await storage.markEmailSent(row.id, result.id);
        console.log(`[email-worker] ✓ row ${row.id} sent (provider=${result.id})`);
      } else {
        const newAttempts = (row.attempts ?? 0) + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          await storage.markEmailFailed(row.id, result.error);
          console.warn(`[email-worker] ✗ row ${row.id} permanently failed after ${newAttempts} attempts: ${result.error}`);
        } else {
          await storage.incrementEmailAttempt(row.id, result.error);
          console.warn(`[email-worker] ✗ row ${row.id} attempt ${newAttempts}/${MAX_ATTEMPTS} failed: ${result.error}`);
        }
      }
    } catch (err) {
      const errMsg = (err as Error).message || String(err);
      console.error(`[email-worker] unexpected error for row ${row.id}: ${errMsg}`);
      try {
        const newAttempts = (row.attempts ?? 0) + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          await storage.markEmailFailed(row.id, errMsg);
        } else {
          await storage.incrementEmailAttempt(row.id, errMsg);
        }
      } catch (storageErr) {
        console.error('[email-worker] failed to update row status:', (storageErr as Error).message);
      }
    }
  }
}

export function startEmailWorker(): void {
  console.log('[email-worker] email worker started — polling every 30s');
  // Run once immediately at startup to drain any backlog
  processOutbox().catch((err) =>
    console.error('[email-worker] startup drain error:', (err as Error).message),
  );
  // Then poll on interval
  const timer = setInterval(() => {
    processOutbox().catch((err) =>
      console.error('[email-worker] poll error:', (err as Error).message),
    );
  }, POLL_INTERVAL_MS);
  // Prevent the interval from blocking process exit
  timer.unref?.();
}
