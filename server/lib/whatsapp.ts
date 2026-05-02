/**
 * MARCALL WhatsApp Business notification shell
 *
 * Status: PLACEHOLDER — requires a verified WhatsApp Business Account and
 * the Meta Graph API credentials (WHATSAPP_TOKEN + WHATSAPP_PHONE_ID).
 *
 * Once Vamsy completes the WhatsApp Business verification:
 * 1. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_ID to .env.local
 * 2. Add them to config.ts ConfigSchema
 * 3. Add them to secrets.ts initSecrets() defs
 * 4. Replace the mock return in sendWhatsApp() with the real Graph API call
 * 5. Register the three templates in Meta's template manager (call_landed,
 *    appointment_booked, lead_captured) with approval before going live.
 *
 * Integration point:
 * After a call_log is inserted via POST /api/webhooks/vapi with
 * outcome !== 'transferred', call sendWhatsApp to notify the tenant owner.
 */

import { getSecret } from './secrets';

// ── Template definitions ────────────────────────────────────────────────────
export type WhatsAppTemplate =
  | 'call_landed'          // owner alert: a customer just called
  | 'appointment_booked'   // owner alert: appointment was scheduled
  | 'lead_captured';       // owner alert: new lead captured

// ── Meta Graph API constants ─────────────────────────────────────────────────
const GRAPH_API_BASE = 'https://graph.facebook.com/v17.0';

// ── Send function ─────────────────────────────────────────────────────────────
export async function sendWhatsApp(opts: {
  to: string;               // E.164 without the leading '+'
  template: WhatsAppTemplate;
  variables: Record<string, string>;
}): Promise<{ id: string } | { error: string }> {
  const token = getSecret('WHATSAPP_TOKEN');
  const phoneId = getSecret('WHATSAPP_PHONE_ID');

  if (!token || !phoneId) {
    console.info('[whatsapp] WhatsApp not configured — skipping notification');
    return { error: 'WhatsApp not configured' };
  }

  // Build template component parameters
  const params = Object.values(opts.variables).map((val) => ({
    type: 'text',
    text: val,
  }));

  const body = {
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'template',
    template: {
      name: opts.template,
      language: { code: 'es_MX' },
      components: params.length > 0
        ? [{ type: 'body', parameters: params }]
        : [],
    },
  };

  try {
    // TODO: replace with actual fetch once credentials are ready
    // const response = await fetch(`${GRAPH_API_BASE}/${phoneId}/messages`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${token}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(body),
    // });
    // const data = await response.json() as any;
    // if (!response.ok) return { error: data?.error?.message || 'Graph API error' };
    // return { id: data.messages?.[0]?.id || 'unknown' };

    // ── Mock response (placeholder) ──────────────────────────────────────────
    const mockId = `mock-${opts.template}-${Date.now()}`;
    console.log(`[whatsapp] MOCK send template=${opts.template} to=${opts.to} id=${mockId}`);
    return { id: mockId };

  } catch (err: unknown) {
    const msg = (err as Error).message || 'Unknown WhatsApp error';
    console.error(`[whatsapp] error sending ${opts.template}: ${msg}`);
    return { error: msg };
  }
}

// ── Owner alert helpers (called from webhook handler) ─────────────────────────

/**
 * Notify tenant owner that a call just landed.
 * @param ownerPhone  Owner's phone in E.164 format without '+'
 * @param callerPhone Caller's phone number
 * @param outcome     Call outcome string from Vapi
 * @param tenantName  Business name
 */
export async function notifyCallLanded(
  ownerPhone: string,
  callerPhone: string,
  outcome: string,
  tenantName: string,
): Promise<void> {
  const result = await sendWhatsApp({
    to: ownerPhone,
    template: 'call_landed',
    variables: {
      business: tenantName,
      caller: callerPhone,
      outcome,
    },
  });
  if ('error' in result) {
    console.warn(`[whatsapp] call_landed notification failed: ${result.error}`);
  }
}

/**
 * Notify tenant owner that an appointment was booked.
 */
export async function notifyAppointmentBooked(
  ownerPhone: string,
  customerName: string,
  appointmentTime: string,
  tenantName: string,
): Promise<void> {
  const result = await sendWhatsApp({
    to: ownerPhone,
    template: 'appointment_booked',
    variables: {
      business: tenantName,
      customer: customerName,
      time: appointmentTime,
    },
  });
  if ('error' in result) {
    console.warn(`[whatsapp] appointment_booked notification failed: ${result.error}`);
  }
}

/**
 * Notify tenant owner that a lead was captured.
 */
export async function notifyLeadCaptured(
  ownerPhone: string,
  leadName: string,
  leadPhone: string,
  tenantName: string,
): Promise<void> {
  const result = await sendWhatsApp({
    to: ownerPhone,
    template: 'lead_captured',
    variables: {
      business: tenantName,
      lead: leadName,
      phone: leadPhone,
    },
  });
  if ('error' in result) {
    console.warn(`[whatsapp] lead_captured notification failed: ${result.error}`);
  }
}
