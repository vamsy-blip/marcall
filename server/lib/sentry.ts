/**
 * Sentry instrumentation for the Express server.
 *
 * Initialization is opt-in: if `SENTRY_DSN` is not set, every export here is
 * a no-op. This keeps local development free of external dependencies and
 * avoids leaking spurious errors during the mock-mode launch period.
 *
 * Usage in server/index.ts:
 *   import { initSentry, sentryRequestHandler, sentryErrorHandler } from './lib/sentry';
 *   initSentry();                          // before any other middleware
 *   app.use(sentryRequestHandler());       // very first middleware
 *   ...your routes...
 *   app.use(sentryErrorHandler());         // before your own error handler
 */
import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.MARCALL_RELEASE || process.env.npm_package_version,
    // Sample 10% of transactions in production; 100% in dev.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // PII is scrubbed at the application layer (see redactPII in lib/audit).
    // We still set sendDefaultPii=false to belt-and-suspender.
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip cookies, auth headers, and request bodies that may contain
      // passwords, MFA tokens, or KYC documents.
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete (event.request.headers as Record<string, unknown>)['authorization'];
          delete (event.request.headers as Record<string, unknown>)['cookie'];
          delete (event.request.headers as Record<string, unknown>)['x-csrf-token'];
        }
        delete event.request.data;
      }
      return event;
    },
  });
  initialized = true;
  return true;
}

/**
 * Express middleware that attaches a Sentry trace to the current request.
 * No-op when SENTRY_DSN is unset.
 */
export function sentryRequestHandler(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!initialized) return next();
    Sentry.withScope((scope) => {
      scope.setTag('http.method', req.method);
      scope.setTag('http.route', req.path);
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (userId) scope.setUser({ id: userId });
      next();
    });
  };
}

/**
 * Express error middleware that captures unhandled exceptions to Sentry.
 * Always re-throws so the next error handler still runs.
 */
export function sentryErrorHandler(): ErrorRequestHandler {
  return (err, _req, _res, next) => {
    if (initialized && err) {
      Sentry.captureException(err);
    }
    next(err);
  };
}

/** Capture a manual exception (use sparingly \u2014 prefer letting Express bubble). */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext('marcall', context);
    Sentry.captureException(err);
  });
}

/** Capture a non-error message (e.g. webhook signature failures). */
export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!initialized) return;
  Sentry.captureMessage(msg, level);
}
