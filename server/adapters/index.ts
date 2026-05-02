export const INTEGRATION_MODE = (process.env.MARCALL_INTEGRATION_MODE || 'mock') as 'mock' | 'live';

// VAPI tool callback secret. NO fallback — if not set, all /api/tools/* calls
// are rejected. Server boot logs a warning when this happens in production.
export const VAPI_TOOL_SECRET: string | null = process.env.VAPI_TOOL_SECRET || null;

if (!VAPI_TOOL_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[adapters] VAPI_TOOL_SECRET not set — all /api/tools/* calls will be rejected.');
}
