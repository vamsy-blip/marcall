/**
 * Centralized secret access module (Control 7).
 *
 * Rules:
 * - No `process.env.X` outside this module for secrets.
 * - In production + live mode, refuses to start if any required secret is
 *   < 32 chars or matches known dev defaults.
 * - Logs `secret.<name>.loaded` (no value) at startup.
 *
 * Key rotation:
 * - Encryption envelope format: `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>`
 * - Set MARCALL_ENCRYPTION_KEY_ID to track which key is active (default "k1").
 * - To rotate: add new key as MARCALL_ENCRYPTION_KEY_NEXT, set
 *   MARCALL_ENCRYPTION_KEY_NEXT_ID. Re-encrypt all enc:v1:k1:... blobs with
 *   the new key. Once done, promote NEXT → primary. Document in /security page.
 */

import { config, isLiveMode, isProduction } from '../config';

const DEV_DEFAULTS = new Set([
  'test', 'secret', 'changeme', 'dev', 'local', 'demo',
  'marcall-mock-encryption-key-do-not-use-in-prod-32b',
  'mock_secret',
]);

// Stripe keys from the platform connector are typically 100+ chars; webhook
// secrets (whsec_*) are ~100 chars too. We accept any key >= 24 chars so we
// don't block the platform's secret proxy which may deliver slightly shorter
// test-mode keys. All other secrets keep the 32-char floor.
const SHORT_MIN: Record<string, number> = {
  STRIPE_SECRET_KEY: 24,
  STRIPE_WEBHOOK_SECRET: 24,
  STRIPE_PRICE_INICIA: 8,
  STRIPE_PRICE_CRECE: 8,
  STRIPE_PRICE_EMPRESA: 8,
  STRIPE_PRICE_AGENCIA: 8,
};

function assertSecret(name: string, value: string | undefined, required = false): string | undefined {
  if (!value) {
    if (required) throw new Error(`[secrets] Required secret ${name} is missing`);
    return undefined;
  }
  const isProdLive = isProduction && isLiveMode;
  if (isProdLive) {
    const minLen = SHORT_MIN[name] ?? 32;
    if (value.length < minLen) {
      throw new Error(`[secrets] Secret ${name} is too short (< ${minLen} chars) for production`);
    }
    if (DEV_DEFAULTS.has(value.toLowerCase().trim())) {
      throw new Error(`[secrets] Secret ${name} matches a dev default — rotate before going live`);
    }
  }
  // Log load event without value
  console.log(`[secrets] secret.${name}.loaded`);
  return value;
}

// Loaded once at module init
let _initialized = false;
const secrets: Record<string, string | undefined> = {};

export function initSecrets() {
  if (_initialized) return;
  _initialized = true;

  // In production+live mode, Stripe payment keys are required — app cannot
  // accept payments without them. Platform connector provides them at runtime.
  const isProdLive = isProduction && isLiveMode;

  const defs: Array<{ name: string; value: string | undefined; required?: boolean }> = [
    { name: 'MARCALL_ENCRYPTION_KEY', value: config.MARCALL_ENCRYPTION_KEY },
    { name: 'MARCALL_CRON_SECRET', value: config.MARCALL_CRON_SECRET },
    { name: 'STRIPE_SECRET_KEY', value: config.STRIPE_SECRET_KEY, required: isProdLive },
    { name: 'STRIPE_WEBHOOK_SECRET', value: config.STRIPE_WEBHOOK_SECRET, required: isProdLive },
    { name: 'STRIPE_PRICE_INICIA', value: config.STRIPE_PRICE_INICIA, required: isProdLive },
    { name: 'STRIPE_PRICE_CRECE', value: config.STRIPE_PRICE_CRECE, required: isProdLive },
    { name: 'STRIPE_PRICE_EMPRESA', value: config.STRIPE_PRICE_EMPRESA, required: isProdLive },
    { name: 'STRIPE_PRICE_AGENCIA', value: config.STRIPE_PRICE_AGENCIA, required: isProdLive },
    { name: 'VAPI_API_KEY', value: config.VAPI_API_KEY },
    { name: 'VAPI_WEBHOOK_SECRET', value: config.VAPI_WEBHOOK_SECRET },
    { name: 'VAPI_TOOL_SECRET', value: config.VAPI_TOOL_SECRET },
    { name: 'TWILIO_ACCOUNT_SID', value: config.TWILIO_ACCOUNT_SID },
    { name: 'TWILIO_AUTH_TOKEN', value: config.TWILIO_AUTH_TOKEN },
    { name: 'ELEVENLABS_API_KEY', value: config.ELEVENLABS_API_KEY },
    { name: 'RESEND_API_KEY', value: config.RESEND_API_KEY },
    { name: 'WHATSAPP_TOKEN', value: config.WHATSAPP_TOKEN },
    { name: 'WHATSAPP_PHONE_ID', value: config.WHATSAPP_PHONE_ID },
  ];

  for (const def of defs) {
    try {
      secrets[def.name] = assertSecret(def.name, def.value, def.required);
    } catch (e) {
      console.error((e as Error).message);
      if (isProduction && isLiveMode) process.exit(1);
    }
  }
}

export function getSecret(name: string): string | undefined {
  return secrets[name];
}

export function requireSecret(name: string): string {
  const v = secrets[name];
  if (!v) throw new Error(`[secrets] Secret ${name} is required but not available`);
  return v;
}
