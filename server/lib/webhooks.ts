/**
 * Webhook signature validation helpers (Control 1).
 *
 * Twilio uses HMAC-SHA1 of the full request URL + sorted POST params, base64.
 * We delegate to the official `twilio` SDK's `validateRequest()` which handles
 * all edge cases (including URL normalization, chunked encoding, etc.).
 */

import twilio from 'twilio';
import type { Request } from 'express';

/**
 * Validate a Twilio webhook request using the official SDK.
 *
 * @param req - Express request (needs rawBody or parsed body)
 * @param authToken - Twilio auth token for the account/sub-account
 * @returns true if signature is valid
 */
export function validateTwilioRequest(req: Request, authToken: string): boolean {
  const signature = req.headers['x-twilio-signature'] as string | undefined;
  if (!signature || !authToken) return false;

  // Build the full URL Twilio signed — prefer x-forwarded headers from proxy
  const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
  const fullUrl = `${proto}://${host}${req.originalUrl || req.url}`;

  // POST params: Twilio sends form-encoded bodies for most webhook types
  const params: Record<string, string> = {};
  if (req.body && typeof req.body === 'object' && !(req.body instanceof Buffer)) {
    for (const [k, v] of Object.entries(req.body)) {
      params[k] = String(v);
    }
  }

  try {
    return twilio.validateRequest(authToken, signature, fullUrl, params);
  } catch {
    return false;
  }
}
