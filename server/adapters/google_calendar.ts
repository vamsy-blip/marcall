/**
 * Google Calendar adapter — OAuth2 authorization-code flow + Calendar API.
 *
 * Uses raw HTTPS fetch (no googleapis SDK dependency) to keep the bundle slim.
 * Refresh tokens are encrypted at rest via crypto.ts before persisting.
 *
 * Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI env vars
 * to enable live mode. Without these, the MockGoogleCalendarClient is used.
 */
import { INTEGRATION_MODE } from './index';

export interface IGoogleCalendarClient {
  getAuthUrl(tenantId: number, state?: string): string;
  exchangeCode(tenantId: number, code: string): Promise<{
    refreshToken: string;
    accessToken: string;
    expiresAt: Date;
    scopes: string;
    googleAccountId?: string;
  }>;
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }>;
  listFreeSlots(refreshToken: string, fromIso: string, toIso: string): Promise<string[]>;
  createEvent(refreshToken: string, evt: {
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
    timeZone?: string;
    attendees?: { email: string; displayName?: string }[];
  }): Promise<{ eventId: string; htmlLink?: string }>;
  isLive(): boolean;
}

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_CAL_API = 'https://www.googleapis.com/calendar/v3';

// Scopes required: read calendar list + read/write events.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
].join(' ');

export class MockGoogleCalendarClient implements IGoogleCalendarClient {
  isLive() { return false; }
  getAuthUrl(tenantId: number) { return `#/onboarding?gcal=mock&tenant_id=${tenantId}`; }
  async exchangeCode() {
    return {
      refreshToken: 'rt_mock_xxx',
      accessToken: 'at_mock_xxx',
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: SCOPES,
    };
  }
  async refreshAccessToken() {
    return { accessToken: 'at_mock_refreshed', expiresAt: new Date(Date.now() + 3600_000) };
  }
  async listFreeSlots(_t: string, fromIso: string) {
    const base = new Date(fromIso);
    return Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(base.getTime() + (i + 1) * 60 * 60 * 1000);
      return d.toISOString();
    });
  }
  async createEvent() { return { eventId: `evt_mock_${Date.now()}` }; }
}

export class LiveGoogleCalendarClient implements IGoogleCalendarClient {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
  ) {}
  isLive() { return true; }

  getAuthUrl(tenantId: number, state?: string) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      scope: SCOPES,
      state: state || `tenant=${tenantId}`,
    });
    return `${GOOGLE_AUTH}?${params.toString()}`;
  }

  async exchangeCode(_tenantId: number, code: string) {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    const r = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) throw new Error(`Google token exchange failed (${r.status}): ${await r.text()}`);
    const json: any = await r.json();
    if (!json.refresh_token) {
      throw new Error('Google did not return refresh_token. User must remove the app at myaccount.google.com/permissions and retry.');
    }
    let accountId: string | undefined;
    if (json.id_token) {
      try {
        const payloadB64 = String(json.id_token).split('.')[1];
        const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
        const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
        accountId = decoded.email || decoded.sub;
      } catch {}
    }
    return {
      refreshToken: json.refresh_token,
      accessToken: json.access_token,
      expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000),
      scopes: json.scope || SCOPES,
      googleAccountId: accountId,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });
    const r = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) throw new Error(`Google refresh failed (${r.status}): ${await r.text()}`);
    const json: any = await r.json();
    return {
      accessToken: json.access_token,
      expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000),
    };
  }

  async listFreeSlots(refreshToken: string, fromIso: string, toIso: string) {
    const { accessToken } = await this.refreshAccessToken(refreshToken);
    const r = await fetch(`${GOOGLE_CAL_API}/freeBusy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: fromIso,
        timeMax: toIso,
        items: [{ id: 'primary' }],
      }),
    });
    if (!r.ok) throw new Error(`Google freeBusy failed (${r.status})`);
    const json: any = await r.json();
    const busy = json?.calendars?.primary?.busy || [];
    // Return suggested 30-min slots that don't overlap busy ranges.
    const slots: string[] = [];
    const start = new Date(fromIso).getTime();
    const end = new Date(toIso).getTime();
    for (let t = start; t < end && slots.length < 8; t += 30 * 60 * 1000) {
      const slotEnd = t + 30 * 60 * 1000;
      const overlaps = busy.some((b: any) => {
        const bs = new Date(b.start).getTime();
        const be = new Date(b.end).getTime();
        return bs < slotEnd && be > t;
      });
      if (!overlaps) slots.push(new Date(t).toISOString());
    }
    return slots;
  }

  async createEvent(refreshToken: string, evt: {
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
    timeZone?: string;
    attendees?: { email: string; displayName?: string }[];
  }) {
    const { accessToken } = await this.refreshAccessToken(refreshToken);
    const r = await fetch(`${GOOGLE_CAL_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: evt.summary,
        description: evt.description,
        start: { dateTime: evt.startIso, timeZone: evt.timeZone || 'America/Monterrey' },
        end: { dateTime: evt.endIso, timeZone: evt.timeZone || 'America/Monterrey' },
        attendees: evt.attendees,
      }),
    });
    if (!r.ok) throw new Error(`Google events.insert failed (${r.status}): ${await r.text()}`);
    const json: any = await r.json();
    return { eventId: json.id, htmlLink: json.htmlLink };
  }
}

const cid = process.env.GOOGLE_CLIENT_ID;
const csecret = process.env.GOOGLE_CLIENT_SECRET;
const credUri = process.env.GOOGLE_REDIRECT_URI || 'https://marcall.careofaddress.com/api/integrations/google/callback';

export const googleCalendar: IGoogleCalendarClient =
  INTEGRATION_MODE === 'live' && cid && csecret
    ? new LiveGoogleCalendarClient(cid, csecret, credUri)
    : new MockGoogleCalendarClient();

export const googleCalendarMode = googleCalendar.isLive() ? 'live' : 'mock';
export const googleCalendarConfigured = !!(cid && csecret);
