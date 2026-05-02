/**
 * Client-side Sentry initialization.
 *
 * Opt-in via VITE_SENTRY_DSN env var. When unset, every export is a no-op so
 * the app behaves identically without external dependencies. The SDK strips
 * cookies and auth headers via `beforeSend`.
 *
 * Note: we deliberately don't wrap the app in Sentry's React ErrorBoundary
 * here \u2014 the SDK already installs window.onerror and unhandledrejection
 * listeners which catch nearly everything. Adding a boundary requires JSX
 * which would force this file to .tsx; keep the surface minimal for v0.3.
 */
import * as Sentry from '@sentry/react';

let initialized = false;

export function initClientSentry(): boolean {
  if (initialized) return true;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_MARCALL_RELEASE as string | undefined,
    // Conservative sampling; bump after we have real traffic data.
    tracesSampleRate: import.meta.env.PROD ? 0.05 : 1.0,
    // Replays cost extra and can capture PII; off by default.
    replaysOnErrorSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_RATE || 0),
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete (event.request.headers as Record<string, unknown>)['authorization'];
          delete (event.request.headers as Record<string, unknown>)['cookie'];
        }
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter((b) => {
          const data = b.data ? JSON.stringify(b.data).toLowerCase() : '';
          return !/password|token|secret|csrf/.test(data);
        });
      }
      return event;
    },
  });
  initialized = true;
  return true;
}

export function captureException(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}
