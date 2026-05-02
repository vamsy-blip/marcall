import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import helmet from 'helmet';
import crypto from 'node:crypto';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { config, isProduction } from "./config";
import { redactPII } from "./lib/audit";
import { startEmailWorker } from "./lib/email-worker";
import { runSeed } from "./seed";
import { initSentry, sentryRequestHandler, sentryErrorHandler } from "./lib/sentry";

// Sentry must be initialized before any other middleware so it can capture
// startup errors and instrument all subsequent handlers. No-op when SENTRY_DSN
// is unset, which is the default for local + mock-mode deployments.
const sentryEnabled = initSentry();

const app = express();
// Trust the deployment proxy (sandbox forwards X-Forwarded-For). Required for
// rate-limit and IP-based audit trails.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Sentry request scope must be the very first middleware (before helmet, body
// parsers, auth) so every error in the chain is captured with full context.
app.use(sentryRequestHandler());

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─────────── CSP nonce middleware (Control 4) ───────────
// Must run BEFORE helmet so helmet can read res.locals.cspNonce
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// ───────── HTTP security headers ─────────
// CSP: use per-request nonce instead of 'unsafe-inline'.
// In dev only, also allow 'unsafe-eval' for Vite HMR.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // CSP nonces (Control 4): per-request nonce generated in middleware above.
        // Directive values must be strings (no arrays in function form).
        scriptSrc: [
          "'self'",
          // Nonce inserted via function — helmet supports function per-directive-value
          (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`,
          "https://js.stripe.com",
          "https://api.fontshare.com",
          // In dev, Vite HMR requires these; gated by NODE_ENV at startup
          ...(isProduction ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://api.fontshare.com", "https://cdn.fontshare.com"],
        fontSrc: ["'self'", "https://cdn.fontshare.com", "https://api.fontshare.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        mediaSrc: ["'self'", "blob:", "https:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", "https://checkout.stripe.com"],
        frameAncestors: ["'self'", "https://*.perplexity.ai"],
      },
    },
    // COEP: use credentialless (safer than require-corp for 3rd-party Stripe iframes)
    crossOriginEmbedderPolicy: { policy: 'credentialless' } as any,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    // Sandbox preview proxies may override; explicit DENY anyway for non-iframe deploys.
    frameguard: { action: 'deny' },
    noSniff: true,
    dnsPrefetchControl: { allow: false },  // X-DNS-Prefetch-Control: off (Control 5)
    permittedCrossDomainPolicies: { permittedPolicies: 'none' }, // X-Permitted-Cross-Domain-Policies: none (Control 5)
  }),
);

// Permissions-Policy: deny camera/mic/geo/usb by default. The marketing demo
// widget plays pre-rendered audio (no mic capture), so mic stays off.
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), usb=(), payment=(self "https://js.stripe.com")',
  );
  next();
});

// ───── security.txt (Control 5) ─────
// Served at /.well-known/security.txt (also via static middleware)
app.get('/.well-known/security.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`Contact: mailto:security@careofaddress.com
Expires: 2027-05-01T00:00:00.000Z
Encryption: https://marcall.careofaddress.com/.well-known/pgp-key.txt
Preferred-Languages: es, en
Policy: https://marcall.careofaddress.com/security#vulnerability-reporting
Acknowledgments: https://marcall.careofaddress.com/security#acknowledgments
`);
});

app.use(
  express.json({
    limit: '256kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Auth endpoints: tighter body size limit (16kb) per Control 6
app.use('/api/auth', (req, res, next) => {
  if (req.headers['content-length']) {
    const len = parseInt(req.headers['content-length'], 10);
    if (len > 16 * 1024) {
      return res.status(413).json({ message: 'Payload too large' });
    }
  }
  next();
});

app.use(express.urlencoded({ extended: false, limit: '256kb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Production-safe logger: redacts PII keys and never logs response bodies for
// auth/PII routes. Dev keeps the verbose body echo for debugging.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const sensitivePath =
        path.startsWith('/api/auth') ||
        path.startsWith('/api/me') ||
        path.startsWith('/api/checkout') ||
        path.startsWith('/api/admin') ||
        path.startsWith('/api/webhooks') ||
        path.startsWith('/api/tools');
      if (capturedJsonResponse && !sensitivePath && !isProduction) {
        logLine += ` :: ${JSON.stringify(redactPII(capturedJsonResponse))}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // First-boot seed. Idempotent — runSeed() short-circuits if plans exist,
  // so this is safe to run on every restart. On Render the SQLite file lives
  // on a persistent disk at /data/data.db, so this only fires the first time
  // a fresh disk comes up.
  if (process.env.MARCALL_AUTOSEED !== 'false') {
    try {
      await runSeed();
      log('seed: ok');
    } catch (err) {
      console.error('seed failed:', err);
      // Don't abort boot — pricing page can still render with empty plans,
      // and login will simply 401 until an operator seeds manually.
    }
  }

  await registerRoutes(httpServer, app);

  // Sentry error capture must run BEFORE the application's own error handler
  // so it sees the unmodified exception (status code, stack trace, etc).
  app.use(sentryErrorHandler());

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Generic error message in production to avoid leaking internals
    const message = isProduction && status >= 500
      ? 'Internal server error'
      : err.message || 'Internal Server Error';

    console.error('Internal Server Error:', isProduction ? err.message : err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(String(config.PORT || process.env.PORT || 5000), 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port} (mode=${config.MARCALL_INTEGRATION_MODE})`);
      log(`sentry ${sentryEnabled ? 'enabled' : 'disabled (no SENTRY_DSN)'}`);
      // Start email outbox worker after server is live
      if (config.RESEND_API_KEY) {
        startEmailWorker();
      } else {
        log('email worker disabled — no RESEND_API_KEY set');
      }
    },
  );
})();
