/**
 * MARCALL Email Module — powered by Resend
 *
 * Loads HTML templates from server/lib/email-templates/<type>.<lang>.html
 * and subject lines from <type>.<lang>.subject.txt.
 * Replaces {{variable}} placeholders with values from payload.data.
 *
 * If RESEND_API_KEY is absent the module degrades gracefully:
 * calls log the attempt and return { error: 'Email provider not configured' }.
 *
 * Default sender (after domain verification):
 *   MARCALL <no-reply@careofaddress.com>
 * Fallback while DNS not verified:
 *   onboarding@resend.dev  (delivers ONLY to vamsy@qbridge.ai per Resend test-mode)
 */

import { Resend } from 'resend';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSecret } from './secrets';
import { logAudit } from './audit';

// Resolve __dirname in a way that works in both ESM (dev/tsx) and CJS (esbuild bundle).
const __filenameSafe: string = (() => {
  // CJS bundle: use the global __dirname Node provides
  if (typeof __dirname !== 'undefined') return path.join(__dirname, 'placeholder');
  // ESM
  try { return fileURLToPath((import.meta as any).url); } catch { return process.cwd(); }
})();
const __dirnameSafe: string = path.dirname(__filenameSafe) === '.' ? process.cwd() : path.dirname(__filenameSafe);
const TEMPLATES_DIR = path.join(__dirnameSafe, 'email-templates');

// ── Resend client — lazy-init once ──────────────────────────────────────────
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = getSecret('RESEND_API_KEY');
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

// ── Sender address ───────────────────────────────────────────────────────────
// Switch to "MARCALL <no-reply@careofaddress.com>" once DNS is verified.
// See RESEND_SETUP.md.
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  'MARCALL <onboarding@resend.dev>';

export type EmailType =
  | 'email_verify'
  | 'welcome'
  | 'password_reset'
  | 'trial_ending_2d'
  | 'trial_expired'
  | 'invoice_paid'
  | 'invoice_failed'
  | 'daily_summary'
  | 'sales_inquiry'
  | 'security_alert'
  | 'arco_request_received';

export interface EmailPayload {
  to: string;
  lang: 'es' | 'en';
  data: Record<string, unknown>;
}

// ── Template loader ──────────────────────────────────────────────────────────
function loadTemplate(type: EmailType, lang: 'es' | 'en'): { html: string; subject: string } {
  const htmlPath = path.join(TEMPLATES_DIR, `${type}.${lang}.html`);
  const subjectPath = path.join(TEMPLATES_DIR, `${type}.${lang}.subject.txt`);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Email template not found: ${htmlPath}`);
  }
  if (!fs.existsSync(subjectPath)) {
    throw new Error(`Email subject not found: ${subjectPath}`);
  }

  return {
    html: fs.readFileSync(htmlPath, 'utf-8'),
    subject: fs.readFileSync(subjectPath, 'utf-8').trim(),
  };
}

// ── Variable interpolation ───────────────────────────────────────────────────
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const val = data[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

// ── Main send function ───────────────────────────────────────────────────────
export async function sendEmail(
  type: EmailType,
  payload: EmailPayload,
): Promise<{ id: string } | { error: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] provider not configured — skipping ${type} to ${payload.to}`);
    return { error: 'Email provider not configured' };
  }

  let html: string;
  let subject: string;
  try {
    const tpl = loadTemplate(type, payload.lang);
    html = interpolate(tpl.html, payload.data);
    subject = interpolate(tpl.subject, payload.data);
  } catch (err) {
    const msg = `Template load error: ${(err as Error).message}`;
    console.error(`[email] ${msg}`);
    return { error: msg };
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: payload.to,
      subject,
      html,
      replyTo: type === 'sales_inquiry' ? 'sales@careofaddress.com' : undefined,
    });

    if (result.error) {
      const errMsg = result.error.message || 'Resend API error';
      console.error(`[email] send failed (${type}): ${errMsg}`);
      logAudit(null, {
        action: 'email.failed',
        metadata: { type, to: payload.to, error: errMsg },
      });
      return { error: errMsg };
    }

    const id = result.data?.id || 'unknown';
    console.log(`[email] sent ${type} to ${payload.to} → id=${id}`);
    logAudit(null, {
      action: 'email.sent',
      metadata: { type, to: payload.to, providerId: id },
    });
    return { id };
  } catch (err: unknown) {
    const errMsg = (err as Error).message || 'Unknown send error';
    console.error(`[email] unexpected error (${type}): ${errMsg}`);
    logAudit(null, {
      action: 'email.failed',
      metadata: { type, to: payload.to, error: errMsg },
    });
    return { error: errMsg };
  }
}
