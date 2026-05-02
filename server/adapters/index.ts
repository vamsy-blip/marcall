export const INTEGRATION_MODE = (process.env.MARCALL_INTEGRATION_MODE || 'mock') as 'mock' | 'live';
export const VAPI_TOOL_SECRET = process.env.VAPI_TOOL_SECRET || 'marcall-dev-secret';
