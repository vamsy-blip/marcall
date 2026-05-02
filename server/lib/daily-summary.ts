/**
 * MARCALL Daily Summary — enqueue logic
 *
 * Called by POST /api/cron/daily-summary and by scripts/run-daily-summary.ts.
 * For each active tenant, computes yesterday's KPIs from the database and
 * enqueues a daily_summary email_outbox row.
 *
 * Scheduling: External cron fires at 08:00 America/Monterrey (UTC-6 / UTC-5 DST).
 * Example Vercel cron expression: 0 14 * * * (14:00 UTC = 08:00 CST)
 */

import { storage, sqlite } from '../storage';

export interface DailySummaryKpis {
  calls_count: number;
  minutes_total: number;
  appointments_count: number;
  leads_count: number;
  messages_count: number;
  top_callers: string;
  date: string;
  business_name: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Monterrey',
  });
}

function yesterdayRange(): { start: Date; end: Date } {
  const now = new Date();
  // Compute yesterday midnight in America/Monterrey (UTC-6)
  const tz = 'America/Monterrey';
  const todayMidnight = new Date(
    new Date().toLocaleDateString('en-CA', { timeZone: tz }) + 'T00:00:00-06:00',
  );
  const yesterdayMidnight = new Date(todayMidnight.getTime() - 86_400_000);
  return { start: yesterdayMidnight, end: todayMidnight };
}

function computeKpis(tenantId: number, start: Date, end: Date): DailySummaryKpis {
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Calls in the window
  const calls = sqlite
    .prepare(
      `SELECT caller_phone, duration_sec FROM call_logs
       WHERE tenant_id = ? AND started_at >= ? AND started_at < ?`,
    )
    .all(tenantId, startMs, endMs) as Array<{ caller_phone: string; duration_sec: number }>;

  const calls_count = calls.length;
  const minutes_total = Math.round(calls.reduce((s, r) => s + (r.duration_sec || 0), 0) / 60);

  // Top 3 callers by frequency
  const callerFreq: Record<string, number> = {};
  for (const c of calls) {
    const ph = c.caller_phone || 'desconocido';
    callerFreq[ph] = (callerFreq[ph] || 0) + 1;
  }
  const top_callers = Object.entries(callerFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ph, n]) => `${ph} (${n}x)`)
    .join(', ') || '—';

  // Appointments
  const appointments_count = (
    sqlite
      .prepare(
        `SELECT COUNT(*) as n FROM appointments
         WHERE tenant_id = ? AND created_at >= ? AND created_at < ?`,
      )
      .get(tenantId, startMs, endMs) as any
  )?.n ?? 0;

  // Leads
  const leads_count = (
    sqlite
      .prepare(
        `SELECT COUNT(*) as n FROM leads
         WHERE tenant_id = ? AND created_at >= ? AND created_at < ?`,
      )
      .get(tenantId, startMs, endMs) as any
  )?.n ?? 0;

  // Messages
  const messages_count = (
    sqlite
      .prepare(
        `SELECT COUNT(*) as n FROM messages
         WHERE tenant_id = ? AND created_at >= ? AND created_at < ?`,
      )
      .get(tenantId, startMs, endMs) as any
  )?.n ?? 0;

  return {
    calls_count,
    minutes_total,
    appointments_count,
    leads_count,
    messages_count,
    top_callers,
    date: formatDate(start),
    business_name: '', // filled below
  };
}

/**
 * Iterates all active tenants, computes yesterday's KPIs, and enqueues
 * a daily_summary row for each tenant owner.
 * @returns number of rows enqueued
 */
export async function enqueueDailySummaries(): Promise<number> {
  const { start, end } = yesterdayRange();
  const tenants = await storage.listTenants();
  const activeTenants = tenants.filter(
    (t) => t.status === 'active' || t.status === 'trial',
  );

  let enqueued = 0;

  for (const tenant of activeTenants) {
    try {
      // Resolve the tenant owner email
      const ownerUser = (tenant as any).ownerUserId
        ? await storage.getUser((tenant as any).ownerUserId).catch(() => null)
        : null;

      if (!ownerUser?.email) {
        console.warn(`[daily-summary] tenant ${tenant.id} has no owner with email — skipping`);
        continue;
      }

      const kpis = computeKpis(tenant.id, start, end);
      kpis.business_name = tenant.name;

      const lang = (tenant.defaultLanguage as 'es' | 'en') || 'es';

      await storage.enqueueEmail({
        tenantId: tenant.id,
        userId: ownerUser.id,
        type: 'daily_summary',
        payload: {
          to: ownerUser.email,
          lang,
          data: {
            ...kpis,
            name: ownerUser.name,
            cta_url: `https://marcall.careofaddress.com/dashboard`,
            unsubscribe_url: `https://marcall.careofaddress.com/preferences`,
          },
        },
      });

      enqueued++;
      console.log(`[daily-summary] enqueued for tenant=${tenant.id} (${tenant.name})`);
    } catch (err) {
      console.error(
        `[daily-summary] error for tenant ${tenant.id}: ${(err as Error).message}`,
      );
    }
  }

  return enqueued;
}
