import 'dotenv/config';
import { z } from 'zod';

/**
 * MARCALL typed runtime configuration.
 * All env access flows through here. Validates at startup.
 *
 * In production (`NODE_ENV=production` AND `MARCALL_INTEGRATION_MODE=live`),
 * required secrets must be present or the process exits.
 * In `mock` mode (default for demos), all secrets are optional.
 */
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MARCALL_INTEGRATION_MODE: z.enum(['mock', 'live']).default('mock'),

  // Auth / crypto
  MARCALL_ENCRYPTION_KEY: z.string().optional(), // 32-byte hex (64 chars). Auto-derived in mock mode.
  MARCALL_CRON_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_INICIA: z.string().optional(),
  STRIPE_PRICE_CRECE: z.string().optional(),
  STRIPE_PRICE_EMPRESA: z.string().optional(),
  STRIPE_PRICE_AGENCIA: z.string().optional(),

  // Vapi
  VAPI_API_KEY: z.string().optional(),
  VAPI_TOOL_SECRET: z.string().optional(),
  VAPI_WEBHOOK_SECRET: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  PRIVACY_EMAIL: z.string().default('privacidad@careofaddress.com'),
  SECURITY_EMAIL: z.string().default('security@careofaddress.com'),

  // WhatsApp Business API (Meta Graph)
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),

  // CFDI / Facturapi (Mexican invoicing — best-effort)
  FACTURAPI_KEY: z.string().optional(),

  // Google OAuth (Calendar integration)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default('https://marcall.careofaddress.com/api/integrations/google/callback'),

  // Public app URL (used for Stripe success/cancel/portal return URLs)
  PUBLIC_APP_URL: z.string().default('https://marcall.careofaddress.com'),
});

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const config = parsed.data;

const isLive = config.MARCALL_INTEGRATION_MODE === 'live';
const isProd = config.NODE_ENV === 'production';

// Any production deployment (mock or live) requires the encryption key and
// the cron secret — the encryption key protects every at-rest secret
// (refresh tokens, MFA secrets) and the cron secret gates the daily-summary
// + recording-purge jobs. Both are non-negotiable in production.
if (isProd) {
  const baseRequired = ['MARCALL_ENCRYPTION_KEY', 'MARCALL_CRON_SECRET'] as const;
  const missingBase = baseRequired.filter((k) => !(config as any)[k]);
  if (missingBase.length) {
    console.error(
      '[config] Production requires (any mode):',
      missingBase.join(', '),
    );
    process.exit(1);
  }
}

// Production + live mode additionally requires every third-party credential.
if (isLive && isProd) {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_INICIA',
    'STRIPE_PRICE_CRECE',
    'STRIPE_PRICE_EMPRESA',
    'STRIPE_PRICE_AGENCIA',
    'VAPI_API_KEY',
    'VAPI_TOOL_SECRET',
    'VAPI_WEBHOOK_SECRET',
  ] as const;
  const missing = required.filter((k) => !(config as any)[k]);
  if (missing.length) {
    console.error('[config] Production + live mode requires:', missing.join(', '));
    process.exit(1);
  }
}

// Encryption key loader. Always require MARCALL_ENCRYPTION_KEY — the
// previous mock fallback was removed after v0.3 deploy proved the env
// var path. Fail fast at boot if missing so we never silently encrypt
// with a known-bad key.
export function getEncryptionKey(): Buffer {
  if (!config.MARCALL_ENCRYPTION_KEY) {
    throw new Error(
      'MARCALL_ENCRYPTION_KEY is required. Generate with: openssl rand -hex 32'
    );
  }
  const buf = Buffer.from(config.MARCALL_ENCRYPTION_KEY, 'hex');
  if (buf.length !== 32) throw new Error('MARCALL_ENCRYPTION_KEY must be 32 bytes hex (64 chars)');
  return buf;
}

export const isProduction = isProd;
export const isLiveMode = isLive;
