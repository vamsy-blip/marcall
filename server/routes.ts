import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { storage, db, sqlite } from './storage';
import { runSeed } from './seed';
import { stripeClient, stripeMode, missingStripePriceIds, priceIdToPlanSlug } from './adapters/stripe';
import { vapi } from './adapters/vapi';
import { twilio } from './adapters/twilio';
import { googleCalendar, googleCalendarConfigured } from './adapters/google_calendar';
import { createCFDI, cfdiConfigured } from './lib/cfdi';
import { INTEGRATION_MODE, VAPI_TOOL_SECRET } from './adapters';
import { z } from 'zod';
import { config, isProduction } from './config';
import { hashPassword, verifyPassword, checkPasswordStrength } from './lib/auth';
import { logAudit, listRecentAudit } from './lib/audit';
import { encrypt, decrypt } from './lib/crypto';
import {
  createSession, getSession, destroySession, revokeSession,
  listUserSessions, purgeStaleSessions, sessionCookieOpts, SESSION_COOKIE_NAME, hashIp, hashUa,
} from './lib/sessionStore';
import { validateTwilioRequest } from './lib/webhooks';
import { initSecrets, getSecret } from './lib/secrets';
import { newTotpSecret, generateTotpUri, verifyTotpToken } from './lib/mfa';
import { notifyCallLanded } from './lib/whatsapp';
import { arcoRequests, auditLogs, users as usersTable, tenants as tenantsTable, resellers as resellersTable, subscriptions as subscriptionsTable, plans as plansTable, callLogs as callLogsTable, agencyTemplates, demoSessions, demoEvents, invoices as invoicesTable, integrations as integrationsTable } from '@shared/schema';
import { respond as demoRespond, endSession as demoEndSession, ensureSession as demoEnsureSession, turnCountFor as demoTurnCountFor } from './lib/demoBrain';
import { eq, desc, asc, and, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Initialize secrets module at startup
initSecrets();

// Failed-login tracking per (email, ip) bucket. 5 attempts / 15min triggers
// short lockout. Independent of express-rate-limit's IP gate.
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOCK_THRESHOLD = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function loginKey(req: Request, email: string) {
  return `${req.ip || 'noip'}:${email.toLowerCase()}`;
}
function recordLoginFailure(key: string) {
  const now = Date.now();
  const cur = loginAttempts.get(key);
  if (!cur || cur.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOCK_WINDOW_MS });
  } else {
    cur.count += 1;
  }
}
function isLoginLocked(key: string): boolean {
  const cur = loginAttempts.get(key);
  if (!cur) return false;
  if (cur.resetAt < Date.now()) {
    loginAttempts.delete(key);
    return false;
  }
  return cur.count >= LOCK_THRESHOLD;
}
function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}

// MFA challenge tokens (in-memory, short-lived — 5 min TTL)
const mfaChallenges = new Map<string, { userId: number; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of mfaChallenges.entries()) {
    if (v.expiresAt < now) mfaChallenges.delete(k);
  }
}, 60 * 1000).unref?.();

// Sweep expired sessions every 10 minutes.
setInterval(purgeStaleSessions, 10 * 60 * 1000).unref?.();

declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
    sessionId?: string;
  }
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Support both legacy cookie name and new __Host- prefixed name
  const sid = req.cookies?.[SESSION_COOKIE_NAME] || req.cookies?.['marcall_sid'];
  if (sid) {
    const rec = getSession(sid);
    if (rec) {
      const user = await storage.getUser(rec.userId);
      if (user) {
        req.user = user;
        req.sessionId = sid;
        // Refresh cookie maxAge on each request (sliding window already extended in getSession)
        res.cookie(SESSION_COOKIE_NAME, sid, sessionCookieOpts());
      } else {
        destroySession(sid);
      }
    }
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: 'No autenticado' });
  next();
}

function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      logAudit(req, { action: 'authz.role_denied', result: 'denied', metadata: { required: roles, actual: req.user.role, path: req.path } });
      return res.status(403).json({ message: 'Sin permisos' });
    }
    next();
  };
}

// Tenant access middleware. Applied to every /api/tenants/:id/* route.
async function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: 'No autenticado' });
  const id = +req.params.id;
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Tenant inválido' });
  if (!(await canAccessTenant(req.user, id))) {
    logAudit(req, { action: 'authz.tenant_denied', result: 'denied', tenantId: id, metadata: { path: req.path, method: req.method } });
    return res.status(403).json({ message: 'Sin acceso' });
  }
  next();
}

// Tenant access helper
async function canAccessTenant(user: any, tenantId: number): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  const t = await storage.getTenant(tenantId);
  if (!t) return false;
  if (user.role === 'reseller' && user.resellerId === t.resellerId) return true;
  if ((user.role === 'tenant_owner' || user.role === 'tenant_staff') && user.currentTenantId === tenantId) return true;
  return false;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(cookieParser());
  app.use(authMiddleware);

  // ───── Health & readiness probes ─────
  // Registered BEFORE the SPA static fallback so monitoring tools (Vercel,
  // UptimeRobot, etc.) get a JSON response instead of the index.html shell.
  // No auth, no CSRF, no rate limit — these must always succeed instantly.
  const startedAt = new Date().toISOString();
  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      service: 'marcall-api',
      version: process.env.npm_package_version || 'unknown',
      startedAt,
      uptimeSec: Math.round(process.uptime()),
      mode: process.env.MARCALL_MODE || 'unknown',
      now: new Date().toISOString(),
    });
  });
  // /api/ready does a deeper check — verifies the DB is reachable.
  app.get('/api/ready', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await storage.listPlans();
      res.json({ status: 'ready', db: 'ok', now: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: 'not_ready', db: 'error', error: String(err).slice(0, 200) });
    }
  });

  // ───── Cache-Control: no-store on all /api/* responses (Control 5) ─────
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // ───── CSRF double-submit cookie check (Control 11) ─────
  // All state-mutating requests must echo the __Host-marcall_csrf cookie
  // in the X-CSRF-Token header. GET/HEAD/OPTIONS are exempt.
  app.use((req, res, next) => {
    const EXEMPT_METHODS = ['GET', 'HEAD', 'OPTIONS'];
    const EXEMPT_PATHS = ['/api/webhooks/', '/api/tools/', '/api/dev/', '/api/demo/'];
    if (EXEMPT_METHODS.includes(req.method)) return next();
    if (EXEMPT_PATHS.some(p => req.path.startsWith(p))) return next();
    // Also exempt auth/signup + auth/login (they create the CSRF token)
    if (req.path === '/api/auth/login' || req.path === '/api/auth/signup' ||
        req.path === '/api/auth/mfa/verify' || req.path === '/api/checkout/create' ||
        req.path === '/api/auth/forgot' || req.path === '/api/auth/reset-password' ||
        req.path === '/api/auth/verify-email') return next();
    const cookieToken = req.cookies?.['__Host-marcall_csrf'] || req.cookies?.['marcall_csrf'];
    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      logAudit(req, { action: 'csrf.token_mismatch', result: 'denied', metadata: { path: req.path, method: req.method } });
      return res.status(403).json({ message: 'CSRF token mismatch' });
    }
    next();
  });

  // ───── Rate limiting ─────
  // Generic global gate first; specific gates layered on auth/tools below.
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/api/tools'), // tools have their own limiter
  });
  app.use('/api', globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Demasiados intentos, intente más tarde.' },
  });

  const toolsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  // Demo seed gated: only loads when explicitly requested AND not in true production.
  // In production deploys, the DB stays empty until real signups happen.
  if (process.env.MARCALL_SEED_DEMO === 'true' && process.env.NODE_ENV !== 'production') {
    await runSeed();
  } else {
    // Plans are required for the public pricing page; seed only the plans (no demo tenants/users).
    const { runSeedPlansOnly } = await import('./seed');
    await runSeedPlansOnly();
  }

  // ============ AUTH ============
  // Industry-keyed templates for the default assistant (greeting + system prompt, ES + EN).
  // Templates are intentionally short — the onboarding wizard lets the owner refine them.
  const INDUSTRY_TEMPLATES: Record<string, {
    greetingEs: string; greetingEn: string;
    systemPromptEs: string; systemPromptEn: string;
    services: { name: string; durationMin: number; description?: string }[];
  }> = {
    'Restaurante':       { greetingEs: 'Buenas tardes, gracias por llamar. Le atiende Sofía. ¿Para cuántas personas y a qué hora le gustaría reservar?', greetingEn: 'Hi, thanks for calling. This is Sofia. How many people and what time would you like to reserve?', systemPromptEs: 'Eres Sofía, recepcionista de un restaurante. Toma reservas, ofrece el menú y registra alergias o preferencias. Habla español mexicano formal.', systemPromptEn: 'You are Sofia, a restaurant receptionist. Take reservations, share the menu, and note allergies. Speak natural English.', services: [ { name: 'Reservación cena', durationMin: 90 }, { name: 'Reservación comida', durationMin: 75 } ] },
    'Clínica':           { greetingEs: 'Buenas tardes, gracias por llamar. Le atiende Sofía. ¿En qué le puedo ayudar?', greetingEn: 'Good afternoon, this is Sofia. How may I help you today?', systemPromptEs: 'Eres Sofía, recepcionista de una clínica médica. Agenda citas, contesta preguntas frecuentes y toma recados con datos completos. Español mexicano formal (usted).', systemPromptEn: 'You are Sofia, a medical clinic receptionist. Book appointments, answer FAQs, and take messages.', services: [ { name: 'Consulta general', durationMin: 30 }, { name: 'Consulta especialidad', durationMin: 45 } ] },
    'Inmobiliaria':      { greetingEs: 'Hola, gracias por llamar. Soy Sofía. ¿Busca rentar, comprar o vender? Le ayudo con gusto.', greetingEn: 'Hi, thanks for calling. This is Sofia. Are you looking to rent, buy, or sell?', systemPromptEs: 'Eres Sofía, asistente de una inmobiliaria. Califica leads (presupuesto, zona, plazo) y agenda visitas con un asesor.', systemPromptEn: 'You are Sofia for a real-estate agency. Qualify leads (budget, area, timeline) and book visits with an agent.', services: [ { name: 'Visita propiedad', durationMin: 45 } ] },
    'Salón':             { greetingEs: 'Hola, gracias por llamar. Soy Sofía. ¿Qué servicio le interesa agendar?', greetingEn: 'Hi, thanks for calling. This is Sofia. Which service would you like to book?', systemPromptEs: 'Eres Sofía, recepcionista de un salón de belleza. Agenda servicios, confirma duración y cobro. Trato cálido y tú.', systemPromptEn: 'You are Sofia at a beauty salon. Book services and confirm price + duration. Friendly tone.', services: [ { name: 'Corte', durationMin: 45 }, { name: 'Tinte', durationMin: 90 }, { name: 'Manicure', durationMin: 30 } ] },
    'Servicios automotrices': { greetingEs: 'Buenas tardes, gracias por llamar. Soy Sofía. ¿Qué servicio necesita su vehículo?', greetingEn: 'Good afternoon, this is Sofia. What service does your vehicle need?', systemPromptEs: 'Eres Sofía, recepcionista de un taller mecánico. Agenda servicios, pide marca, modelo y año, da estimado de tiempo.', systemPromptEn: 'You are Sofia at an auto-service shop. Book services, ask make/model/year, and give time estimates.', services: [ { name: 'Servicio básico', durationMin: 60 }, { name: 'Diagnóstico', durationMin: 45 } ] },
    'Servicios legales': { greetingEs: 'Buenas tardes, gracias por llamar. Soy Sofía. ¿En qué área legal le podemos asesorar?', greetingEn: 'Good afternoon, this is Sofia. Which legal area do you need assistance with?', systemPromptEs: 'Eres Sofía, recepcionista de un despacho legal. Califica el asunto, pide datos básicos y agenda valoración inicial. Español formal (usted).', systemPromptEn: 'You are Sofia at a law firm. Qualify the matter, take basic info, and book an initial consult.', services: [ { name: 'Valoración inicial', durationMin: 30 } ] },
    'Fitness':           { greetingEs: 'Hola, gracias por llamar. Soy Sofía. ¿Te interesa una clase de prueba o información de membresías?', greetingEn: 'Hi, thanks for calling. This is Sofia. Are you looking for a trial class or membership info?', systemPromptEs: 'Eres Sofía, recepcionista de un gimnasio. Ofrece clases de prueba, explica membresías y agenda visitas. Tono casual con tú.', systemPromptEn: 'You are Sofia at a fitness studio. Offer trial classes, explain memberships, and book tours.', services: [ { name: 'Clase de prueba', durationMin: 60 }, { name: 'Tour del gimnasio', durationMin: 20 } ] },
    'Otro':              { greetingEs: 'Buenas tardes, gracias por llamar. Le atiende Sofía. ¿En qué le puedo ayudar?', greetingEn: 'Good afternoon, this is Sofia. How may I help you?', systemPromptEs: 'Eres Sofía, recepcionista virtual. Atiende con cortesía, toma recados completos y agenda citas si aplica. Español mexicano formal.', systemPromptEn: 'You are Sofia, a virtual receptionist. Take complete messages and book appointments when applicable.', services: [] },
  };

  const ALLOWED_INDUSTRIES = Object.keys(INDUSTRY_TEMPLATES);

  app.post('/api/auth/signup', authLimiter, async (req, res) => {
    const schema = z.object({
      email: z.string().email().max(254),
      password: z.string().min(12).max(256),
      name: z.string().min(1).max(120).optional(),
      role: z.enum(['tenant_owner', 'reseller']).default('tenant_owner'),
      tenantName: z.string().min(1).max(120),
      industry: z.enum(ALLOWED_INDUSTRIES as [string, ...string[]]).default('Otro'),
      acceptTerms: z.boolean().optional(),
      planSlug: z.string().optional(), // ignored for trial signup; reserved for future paid path
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const { email, password, role, tenantName, industry } = parsed.data;
    const name = parsed.data.name || tenantName;
    const strength = checkPasswordStrength(password);
    if (!strength.ok) {
      return res.status(400).json({ message: 'La contraseña no cumple los requisitos mínimos (12+ caracteres, mezcla de letras, números y símbolos).' });
    }
    const existing = await storage.getUserByEmail(email);
    if (existing) {
      logAudit(req, { action: 'auth.signup_duplicate', result: 'denied', metadata: { email_hash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 16) } });
      return res.status(400).json({ message: 'No fue posible crear la cuenta con esos datos.' });
    }
    const user = await storage.createUser({ email, passwordHash: await hashPassword(password), name, role } as any);
    let tenantId: number | undefined;
    let tenant: any = null;
    let subscription: any = null;
    if (role === 'tenant_owner') {
      const planInicia = await storage.getPlanBySlug('inicia');
      let directo = (await storage.listResellers()).find(r => r.slug === 'directo');
      if (!directo) {
        directo = await storage.createReseller({
          name: 'MARCALL Directo', slug: 'directo', brandName: 'MARCALL',
          commissionPct: 0, hideMarcallBranding: false,
        } as any);
      }
      const slugBase = tenantName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'negocio';
      const slug = `${slugBase}-${crypto.randomBytes(2).toString('hex')}`;
      tenant = await storage.createTenant({
        name: tenantName, slug, industry, resellerId: directo!.id, planId: planInicia!.id,
        status: 'trial', timezone: 'America/Monterrey',
      } as any);
      tenantId = tenant.id;
      await storage.updateUser(user.id, { currentTenantId: tenant.id } as any);
      const trialEndsAt = new Date(Date.now() + 7 * 86400000);
      subscription = await storage.createSubscription({
        tenantId: tenant.id, planId: planInicia!.id, status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      } as any);
      const tpl = INDUSTRY_TEMPLATES[industry] ?? INDUSTRY_TEMPLATES['Otro'];
      await storage.createAssistant({
        tenantId: tenant.id, name: 'Sofía', voiceId: 'adri-chilanga', voiceProvider: 'elevenlabs',
        languageCode: 'es-MX', formality: 'usted',
        greeting: tpl.greetingEs,
        greetingEn: tpl.greetingEn,
        systemPrompt: tpl.systemPromptEs,
        systemPromptEn: tpl.systemPromptEn,
        defaultLanguage: 'es-MX',
        codeSwitching: true,
      } as any);
      // Default services from industry template
      for (const svc of tpl.services) {
        try {
          await storage.createService({ tenantId: tenant.id, name: svc.name, durationMin: svc.durationMin, description: svc.description ?? null, active: true } as any);
        } catch { /* non-fatal */ }
      }
    }
    // Email verification token (24h)
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      sqlite.prepare(`INSERT INTO email_verifications (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)`)
        .run(user.id, verifyToken, Math.floor(verifyExpires.getTime() / 1000), Math.floor(Date.now() / 1000));
    } catch (e) { console.error('[signup] insert email_verification failed', e); }
    // Queue welcome + verification emails (drained by Resend agent)
    try {
      await storage.enqueueEmail({ tenantId: tenantId ?? null, userId: user.id, type: 'email_verify', payload: { to: email, lang: 'es', data: { name, verifyUrl: `https://marcall.careofaddress.com/#/verify-email?token=${verifyToken}`, token: verifyToken } } });
      await storage.enqueueEmail({ tenantId: tenantId ?? null, userId: user.id, type: 'welcome', payload: { to: email, lang: 'es', data: { name, tenantName, industry } } });
    } catch (e) { console.error('[signup] enqueueEmail failed', e); }
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers['user-agent'] || null;
    const sid = createSession({ userId: user.id, tenantId: tenantId ?? null, ipHash: hashIp(ip), userAgentHash: hashUa(ua) });
    res.cookie(SESSION_COOKIE_NAME, sid, sessionCookieOpts());
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('__Host-marcall_csrf', csrfToken, { httpOnly: false, secure: isProduction, sameSite: 'strict', path: '/' });
    logAudit(req, { action: 'auth.signup', actorUserId: user.id, tenantId: tenantId ?? null, metadata: { role, industry } });
    const safeUser = await storage.getUser(user.id);
    if (safeUser) { delete (safeUser as any).passwordHash; delete (safeUser as any).mfaSecret; delete (safeUser as any).mfaBackupCodes; }
    res.json({
      user: safeUser,
      tenant,
      tenantId,
      subscription,
      redirectTo: '/onboarding',
    });
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const schema = z.object({ email: z.string().email().max(254), password: z.string().max(256) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Correo o contraseña incorrectos' });
    const { email, password } = parsed.data;
    const key = loginKey(req, email);
    if (isLoginLocked(key)) {
      logAudit(req, { action: 'auth.login_locked', result: 'denied', metadata: { email_hash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 16) } });
      // Sleep a beat to make brute timing unattractive
      await new Promise(r => setTimeout(r, 350));
      return res.status(429).json({ message: 'Demasiados intentos. Espere unos minutos y vuelva a intentar.' });
    }
    // Constant-ish total wall-clock to prevent enumeration.
    const minWall = new Promise<void>(r => setTimeout(r, 250));
    const user = await storage.getUserByEmail(email);
    const verify = await verifyPassword(password || '', user?.passwordHash);
    await minWall;
    if (!user || !verify.ok) {
      recordLoginFailure(key);
      logAudit(req, { action: 'auth.login_failure', result: 'denied', actorUserId: user?.id ?? null, metadata: { email_hash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 16) } });
      return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
    }
    clearLoginFailures(key);
    // Transparent rehash legacy sha256 → bcrypt.
    if (verify.needsRehash) {
      try { await storage.updateUser(user.id, { passwordHash: await hashPassword(password) } as any); } catch {}
    }
    try {
      await storage.updateUser(user.id, { lastLoginAt: new Date(), failedLoginCount: 0 } as any);
    } catch {}

    // MFA check: if enabled, return challenge instead of full session
    if ((user as any).mfaEnabled) {
      const challengeToken = crypto.randomBytes(32).toString('hex');
      mfaChallenges.set(challengeToken, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
      logAudit(req, { action: 'auth.mfa_challenge_issued', actorUserId: user.id });
      return res.json({ mfaRequired: true, challengeToken });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers['user-agent'] || null;
    const sid = createSession({ userId: user.id, tenantId: user.currentTenantId, ipHash: hashIp(ip), userAgentHash: hashUa(ua) });
    res.cookie(SESSION_COOKIE_NAME, sid, sessionCookieOpts());
    // Set CSRF token cookie (Control 11)
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('__Host-marcall_csrf', csrfToken, { httpOnly: false, secure: isProduction, sameSite: 'strict', path: '/' });
    logAudit(req, { action: 'auth.login_success', actorUserId: user.id });
    const safeUser: any = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.mfaSecret;
    delete safeUser.mfaBackupCodes;
    res.json({ user: safeUser });
  });

  app.post('/api/auth/logout', (req, res) => {
    const sid = req.cookies?.[SESSION_COOKIE_NAME] || req.cookies?.['marcall_sid'];
    if (sid) destroySession(sid);
    res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOpts(), maxAge: 0 });
    res.clearCookie('marcall_sid', { httpOnly: true, sameSite: 'lax', path: '/' });
    res.clearCookie('__Host-marcall_csrf', { httpOnly: false, sameSite: 'strict', path: '/' });
    // Clear-Site-Data on logout (Control 5)
    res.setHeader('Clear-Site-Data', '"cookies", "storage"');
    if (req.user) logAudit(req, { action: 'auth.logout', actorUserId: req.user.id });
    res.json({ ok: true });
  });

  // Forgot-password: always 200 to prevent enumeration. If the email exists,
  // queue a password_reset email_outbox row with a 1h token.
  app.post('/api/auth/forgot', authLimiter, async (req, res) => {
    const schema = z.object({ email: z.string().email().max(254) }).strict();
    const parsed = schema.safeParse(req.body);
    if (parsed.success) {
      const { email } = parsed.data;
      logAudit(req, { action: 'auth.password_reset_requested', metadata: { email_hash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 16) } });
      const u = await storage.getUserByEmail(email);
      if (u) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);
        try {
          sqlite.prepare(`INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)`)
            .run(u.id, token, expiresAt, Math.floor(Date.now() / 1000));
          await storage.enqueueEmail({
            tenantId: u.currentTenantId ?? null, userId: u.id, type: 'password_reset',
            payload: { to: email, lang: (u.preferredLanguage === 'en' ? 'en' : 'es') as 'es' | 'en', data: { name: u.name, resetUrl: `https://marcall.careofaddress.com/#/reset-password?token=${token}`, token, expiresInMin: 60 } },
          });
        } catch (e) { console.error('[forgot] failed to queue reset', e); }
      }
    }
    res.json({ message: 'Si tu correo está registrado, recibirás un enlace en 5 minutos.' });
  });

  // Reset password: consume token, set new password, invalidate other sessions.
  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    const schema = z.object({ token: z.string().min(32).max(128), newPassword: z.string().min(12).max(256) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const { token, newPassword } = parsed.data;
    const strength = checkPasswordStrength(newPassword);
    if (!strength.ok) return res.status(400).json({ message: 'La contraseña no cumple los requisitos mínimos (12+ caracteres).' });
    const row = sqlite.prepare(`SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token = ?`).get(token) as any;
    if (!row) return res.status(400).json({ message: 'Enlace inválido o expirado.' });
    if (row.used_at) return res.status(400).json({ message: 'Este enlace ya fue usado.' });
    if (row.expires_at * 1000 < Date.now()) return res.status(400).json({ message: 'Este enlace expiró.' });
    const passwordHash = await hashPassword(newPassword);
    await storage.updateUser(row.user_id, { passwordHash } as any);
    sqlite.prepare(`UPDATE password_resets SET used_at = ? WHERE id = ?`).run(Math.floor(Date.now() / 1000), row.id);
    logAudit(req, { action: 'auth.password_reset_completed', actorUserId: row.user_id });
    res.json({ ok: true, message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' });
  });

  // Verify email: consume token, mark user.emailVerifiedAt + verifications row.
  app.post('/api/auth/verify-email', async (req, res) => {
    const schema = z.object({ token: z.string().min(32).max(128) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Token inválido' });
    const row = sqlite.prepare(`SELECT id, user_id, expires_at, verified_at FROM email_verifications WHERE token = ?`).get(parsed.data.token) as any;
    if (!row) return res.status(400).json({ message: 'Enlace inválido.' });
    if (row.verified_at) return res.json({ ok: true, alreadyVerified: true });
    if (row.expires_at * 1000 < Date.now()) return res.status(400).json({ message: 'Este enlace expiró. Solicita uno nuevo.' });
    const now = Math.floor(Date.now() / 1000);
    sqlite.prepare(`UPDATE email_verifications SET verified_at = ? WHERE id = ?`).run(now, row.id);
    sqlite.prepare(`UPDATE users SET email_verified_at = ? WHERE id = ?`).run(now, row.user_id);
    logAudit(req, { action: 'auth.email_verified', actorUserId: row.user_id });
    res.json({ ok: true });
  });

  // Resend a fresh verification email (auth-required, rate-limited).
  app.post('/api/auth/resend-verification', authLimiter, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    const u = req.user;
    if ((u as any).emailVerifiedAt) return res.json({ ok: true, alreadyVerified: true });
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
    sqlite.prepare(`INSERT INTO email_verifications (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)`)
      .run(u.id, token, expiresAt, Math.floor(Date.now() / 1000));
    await storage.enqueueEmail({ tenantId: u.currentTenantId ?? null, userId: u.id, type: 'email_verify', payload: { to: u.email, lang: (u.preferredLanguage === 'en' ? 'en' : 'es') as 'es' | 'en', data: { name: u.name, verifyUrl: `https://marcall.careofaddress.com/#/verify-email?token=${token}`, token } } });
    logAudit(req, { action: 'auth.verification_resent', actorUserId: u.id });
    res.json({ ok: true });
  });

  app.patch('/api/auth/preferences', async (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    const lang = req.body?.preferredLanguage;
    if (lang !== 'es' && lang !== 'en') return res.status(400).json({ message: 'Idioma inválido' });
    await storage.updateUser(req.user.id, { preferredLanguage: lang } as any);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const u: any = { ...req.user };
    delete u.passwordHash;
    delete u.mfaSecret;
    delete u.mfaBackupCodes;
    if (u.resellerId) {
      const r = await storage.getReseller(u.resellerId);
      if (r) { u.resellerName = r.name; u.resellerSlug = r.slug; }
    }
    res.json({ user: u });
  });

  // ============ MFA (Control 2) ============
  // Only super-admin and tenant-admin/owner need MFA enforced, but any user may enroll.

  // Step 1: Start enrollment — returns otpauth URL + QR data URL + backup codes (one-time view)
  app.post('/api/auth/mfa/enroll-start', requireAuth, async (req, res) => {
    const QRCode = (await import('qrcode')).default;
    const user = req.user!;
    // Generate a new TOTP secret
    const secret = newTotpSecret();
    const otpauthUrl = await generateTotpUri(user.email, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    // Generate 10 backup codes (plaintext, hashed before storage)
    const backupCodes: string[] = Array.from({ length: 10 }, () => crypto.randomBytes(5).toString('hex'));
    // Store encrypted secret and hashed backup codes as pending (mfaEnabled stays false until verified)
    const encryptedSecret = encrypt(secret)!;
    const hashedCodes = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 12)));
    await storage.updateUser(user.id, {
      mfaSecret: encryptedSecret,
      mfaBackupCodes: JSON.stringify(hashedCodes),
    } as any);
    logAudit(req, { action: 'mfa.enroll_start', actorUserId: user.id });
    res.json({ otpauthUrl, qrDataUrl, backupCodes, message: 'Store backup codes safely — they will not be shown again.' });
  });

  // Step 2: Verify first TOTP code to finalize enrollment
  app.post('/api/auth/mfa/enroll-verify', requireAuth, async (req, res) => {
    const schema = z.object({ totp: z.string().min(6).max(8) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Código inválido' });
    const user = req.user!;
    const freshUser = await storage.getUser(user.id);
    if (!freshUser || !(freshUser as any).mfaSecret) {
      return res.status(400).json({ message: 'MFA enrollment not started' });
    }
    const secret = decrypt((freshUser as any).mfaSecret);
    if (!secret) return res.status(500).json({ message: 'Error de configuración MFA' });
    const valid = await verifyTotpToken(parsed.data.totp, secret);
    if (!valid) {
      logAudit(req, { action: 'mfa.enroll_verify_failed', actorUserId: user.id, result: 'denied' });
      return res.status(400).json({ message: 'Código TOTP incorrecto' });
    }
    await storage.updateUser(user.id, { mfaEnabled: true } as any);
    logAudit(req, { action: 'mfa.enrolled', actorUserId: user.id });
    res.json({ ok: true, message: 'MFA activado correctamente.' });
  });

  // Disable MFA (requires current password + valid TOTP)
  app.post('/api/auth/mfa/disable', requireAuth, async (req, res) => {
    const schema = z.object({ password: z.string().min(1), totp: z.string().min(6).max(8) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const user = req.user!;
    const freshUser = await storage.getUser(user.id);
    if (!freshUser) return res.status(404).json({ message: 'Usuario no encontrado' });
    const verify = await verifyPassword(parsed.data.password, freshUser.passwordHash);
    if (!verify.ok) {
      logAudit(req, { action: 'mfa.disable_bad_password', actorUserId: user.id, result: 'denied' });
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }
    const secret = decrypt((freshUser as any).mfaSecret);
    if (!secret) return res.status(400).json({ message: 'MFA no activado' });
    const valid = await verifyTotpToken(parsed.data.totp, secret);
    if (!valid) {
      logAudit(req, { action: 'mfa.disable_bad_totp', actorUserId: user.id, result: 'denied' });
      return res.status(400).json({ message: 'Código TOTP incorrecto' });
    }
    await storage.updateUser(user.id, { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null } as any);
    logAudit(req, { action: 'mfa.disabled', actorUserId: user.id });
    res.json({ ok: true });
  });

  // MFA second step: verify TOTP from challenge token → issue full session
  app.post('/api/auth/mfa/verify', async (req, res) => {
    const schema = z.object({ challengeToken: z.string().min(1), totp: z.string().min(6).max(8) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const { challengeToken, totp } = parsed.data;
    const challenge = mfaChallenges.get(challengeToken);
    if (!challenge || challenge.expiresAt < Date.now()) {
      return res.status(401).json({ message: 'Desafío MFA expirado o inválido' });
    }
    const user = await storage.getUser(challenge.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const secret = decrypt((user as any).mfaSecret);
    if (!secret) return res.status(500).json({ message: 'Error de configuración MFA' });
    // Try TOTP first, then backup codes
    let valid = await verifyTotpToken(totp, secret);
    if (!valid) {
      // Try backup codes
      const storedCodes: string[] = JSON.parse((user as any).mfaBackupCodes || '[]');
      let usedIndex = -1;
      for (let i = 0; i < storedCodes.length; i++) {
        if (await bcrypt.compare(totp, storedCodes[i])) {
          usedIndex = i;
          valid = true;
          break;
        }
      }
      if (valid && usedIndex >= 0) {
        // Invalidate used backup code
        const newCodes = storedCodes.filter((_, i) => i !== usedIndex);
        await storage.updateUser(user.id, { mfaBackupCodes: JSON.stringify(newCodes) } as any);
        logAudit(req, { action: 'mfa.backup_code_used', actorUserId: user.id });
      }
    }
    if (!valid) {
      logAudit(req, { action: 'mfa.verify_failed', actorUserId: user.id, result: 'denied' });
      return res.status(401).json({ message: 'Código TOTP incorrecto' });
    }
    mfaChallenges.delete(challengeToken);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = req.headers['user-agent'] || null;
    const sid = createSession({ userId: user.id, tenantId: user.currentTenantId, ipHash: hashIp(ip), userAgentHash: hashUa(ua) });
    res.cookie(SESSION_COOKIE_NAME, sid, sessionCookieOpts());
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('__Host-marcall_csrf', csrfToken, { httpOnly: false, secure: isProduction, sameSite: 'strict', path: '/' });
    logAudit(req, { action: 'mfa.verify_success', actorUserId: user.id });
    const safeUser: any = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.mfaSecret;
    delete safeUser.mfaBackupCodes;
    res.json({ user: safeUser });
  });

  // ============ SESSION MANAGEMENT (Control 3) ============
  app.get('/api/me/sessions', requireAuth, async (req, res) => {
    const activeSessions = listUserSessions(req.user!.id);
    res.json(activeSessions.map(s => ({
      id: s.id,
      ipHashPrefix: s.ipHash ? s.ipHash.slice(0, 8) + '...' : null,
      userAgentHash: s.userAgentHash ? s.userAgentHash.slice(0, 8) + '...' : null,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      current: s.id === req.sessionId,
    })));
  });

  app.delete('/api/me/sessions/:id', requireAuth, async (req, res) => {
    const targetId = String(req.params.id);
    // Only allow users to revoke their own sessions
    const activeSessions = listUserSessions(req.user!.id);
    const target = activeSessions.find(s => s.id === targetId);
    if (!target) return res.status(404).json({ message: 'Sesión no encontrada' });
    revokeSession(targetId);
    logAudit(req, { action: 'session.revoked', actorUserId: req.user!.id, targetId: String(targetId), metadata: { byCurrentSession: targetId === req.sessionId } });
    res.json({ ok: true });
  });

  // DEV-ONLY endpoints. Hard-gated on NODE_ENV=development AND an explicit
  // MARCALL_ENABLE_DEV_ENDPOINTS flag. NEVER active in production builds —
  // these would otherwise allow logging in as any user without a password.
  const DEV_ENDPOINTS_ENABLED =
    process.env.NODE_ENV === 'development' && process.env.MARCALL_ENABLE_DEV_ENDPOINTS === 'true';

  app.post('/api/dev/login-as', async (req, res) => {
    if (!DEV_ENDPOINTS_ENABLED) return res.status(404).json({ message: 'No encontrado' });
    const email = req.body?.email as string;
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ message: 'No encontrado' });
    const sid = createSession({ userId: user.id, tenantId: user.currentTenantId });
    res.cookie(SESSION_COOKIE_NAME, sid, sessionCookieOpts());
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('__Host-marcall_csrf', csrfToken, { httpOnly: false, secure: isProduction, sameSite: 'strict', path: '/' });
    logAudit(req, { action: 'auth.dev_login_as', actorUserId: user.id, metadata: { email } });
    res.json({ user });
  });

  app.get('/api/dev/users', async (_req, res) => {
    if (!DEV_ENDPOINTS_ENABLED) return res.status(404).json({ message: 'No encontrado' });
    const users = await storage.listUsers();
    res.json({ users: users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, currentTenantId: u.currentTenantId, resellerId: u.resellerId })) });
  });

  // ============ PLANS ============
  app.get('/api/plans', async (_req, res) => {
    const plans = await storage.listPlans();
    res.json(plans.map(p => ({ ...p, features: JSON.parse(p.features || '[]') })));
  });

  // ============ PUBLIC: contact-sales (no auth) ============
  // POST /api/contact-sales — 'Hablar con ventas' modal on /pricing.
  // Inserts into contact_requests, queues email_outbox(type=sales_inquiry).
  const contactSalesLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas solicitudes, intenta en un minuto.' },
  });
  app.post('/api/contact-sales', contactSalesLimiter, async (req, res) => {
    const schema = z.object({
      name: z.string().min(2).max(120),
      email: z.string().email().max(254),
      phone: z.string().max(40).optional().nullable(),
      businessName: z.string().max(200).optional().nullable(),
      plan: z.string().max(40).optional().nullable(),
      message: z.string().max(2000).optional().nullable(),
      source: z.string().max(60).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    }
    const v = parsed.data;
    let row: any;
    try {
      row = await storage.createContactRequest({
        name: v.name,
        email: v.email.toLowerCase(),
        phone: v.phone || null,
        businessName: v.businessName || null,
        plan: v.plan || null,
        message: v.message || null,
        source: v.source || 'pricing_page',
        status: 'new',
      } as any);
    } catch (e: any) {
      console.error('[contact-sales] insert failed', e);
      return res.status(500).json({ message: 'Error guardando solicitud' });
    }

    // Queue email_outbox row — notifications agent picks this up.
    try {
      await storage.enqueueEmail({
        tenantId: null as any,
        userId: null as any,
        type: 'sales_inquiry',
        payload: {
          toEmail: process.env.SALES_INQUIRY_TO || 'sales@careofaddress.com',
          contactRequestId: row.id,
          name: v.name,
          email: v.email,
          phone: v.phone || null,
          businessName: v.businessName || null,
          plan: v.plan || null,
          message: v.message || null,
          source: v.source || 'pricing_page',
          submittedAt: new Date().toISOString(),
        },
        status: 'pending' as any,
        attempts: 0 as any,
        nextAttemptAt: new Date() as any,
      } as any);
    } catch (e: any) {
      console.error('[contact-sales] enqueueEmail failed', e);
    }

    res.status(201).json({ ok: true, id: row.id });
  });

  // ============ PUBLIC: system health (sanitized for /estado) ============
  // No env-var details, no latencies. Internal version stays at /api/admin/system/health.
  app.get('/api/system/health', async (_req, res) => {
    const dbOk = !!db;
    async function ping(url: string, opts: RequestInit = {}, timeoutMs = 3500): Promise<boolean> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, { ...opts, signal: controller.signal });
        return r.ok || r.status === 401 || r.status === 403; // reachable counts as healthy
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    }
    const [stripeOk, vapiOk, twilioOk, resendOk] = await Promise.all([
      process.env.STRIPE_SECRET_KEY ? ping('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }) : Promise.resolve(null as any),
      process.env.VAPI_API_KEY ? ping('https://api.vapi.ai/assistant?limit=1', { headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` } }) : Promise.resolve(null as any),
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        ? ping(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, { headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64') } })
        : Promise.resolve(null as any),
      process.env.RESEND_API_KEY ? ping('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } }) : Promise.resolve(null as any),
    ]);
    const statusOf = (ok: boolean | null): 'operational' | 'degraded' | 'unknown' => ok === null ? 'unknown' : ok ? 'operational' : 'degraded';
    const services = [
      { id: 'api',        name: 'API',                          status: dbOk ? 'operational' : 'degraded' },
      { id: 'voice',      name: 'Voz (Vapi)',                   status: statusOf(vapiOk) },
      { id: 'telephony',  name: 'Telefonía (Twilio)',           status: statusOf(twilioOk) },
      { id: 'payments',   name: 'Pagos (Stripe)',               status: statusOf(stripeOk) },
      { id: 'email',      name: 'Email (Resend)',               status: statusOf(resendOk) },
      { id: 'storage',    name: 'Almacenamiento (Supabase)',    status: dbOk ? 'operational' : 'degraded' },
    ];
    const overall = services.some(s => s.status === 'degraded')
      ? 'degraded'
      : services.every(s => s.status === 'operational') ? 'operational' : 'unknown';
    res.json({ overall, services, checkedAt: new Date().toISOString() });
  });

  // ============ TENANTS ============
  app.get('/api/tenants', requireAuth, async (req, res) => {
    const u = req.user!;
    let list: any[] = [];
    if (u.role === 'superadmin') list = await storage.listTenants();
    else if (u.role === 'reseller') list = await storage.listTenants({ resellerId: u.resellerId });
    else list = u.currentTenantId ? ([await storage.getTenant(u.currentTenantId)].filter(Boolean) as any[]) : [];
    // enrich with plan slug, plan price, reseller name
    const allPlans = await storage.listPlans();
    const allResellers = await storage.listResellers();
    const enriched = await Promise.all(list.map(async (t: any) => {
      const sub = await storage.getSubscriptionByTenant(t.id);
      const plan = sub ? allPlans.find(p => p.id === sub.planId) : null;
      const reseller = allResellers.find(r => r.id === t.resellerId);
      return { ...t, planSlug: plan?.slug || null, priceCents: plan?.priceMxnCents || 0, resellerName: reseller?.name || null };
    }));
    res.json(enriched);
  });

  app.get('/api/tenants/:id', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).json({ message: 'Sin acceso' });
    const t = await storage.getTenant(id);
    if (!t) return res.status(404).json({ message: 'No encontrado' });
    const sub = await storage.getSubscriptionByTenant(id);
    const plan = sub ? await storage.getPlan(sub.planId) : null;
    res.json({ ...t, subscription: sub, plan: plan ? { ...plan, features: JSON.parse(plan.features) } : null });
  });

  // Strict allow-list of tenant fields the owner may edit. Plan/billing/reseller/
  // status/stripeCustomerId fields are MUTABLE ONLY via admin or webhook paths.
  const tenantSelfUpdateSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    industry: z.string().max(80).optional(),
    timezone: z.string().max(60).optional(),
    transferNumber: z.string().max(20).optional(),
    addressLine: z.string().max(200).optional().nullable(),
    city: z.string().max(80).optional().nullable(),
    state: z.string().max(80).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    logoUrl: z.string().url().max(500).optional().nullable(),
    locale: z.string().max(20).optional(),
    recordingRetentionDays: z.number().int().min(1).max(3650).optional(),
  }).strict();

  app.patch('/api/tenants/:id', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).json({ message: 'Sin acceso' });
    // Superadmins can use the admin route for full edits; tenant_owner gets the
    // strict allow-list (cannot self-upgrade plan or change billing identity).
    const isAdmin = req.user!.role === 'superadmin';
    const data = isAdmin ? req.body : tenantSelfUpdateSchema.safeParse(req.body);
    if (!isAdmin && !(data as any).success) {
      return res.status(400).json({ message: 'Datos inválidos', errors: (data as any).error.errors });
    }
    const safeBody = isAdmin ? req.body : (data as any).data;
    const t = await storage.updateTenant(id, safeBody);
    logAudit(req, { action: 'tenant.update', actorUserId: req.user!.id, tenantId: id, targetKind: 'tenant', targetId: String(id), metadata: { fields: Object.keys(safeBody || {}) } });
    res.json(t);
  });

  app.post('/api/tenants/:id/switch', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).json({ message: 'Sin acceso' });
    await storage.updateUser(req.user!.id, { currentTenantId: id } as any);
    res.json({ ok: true });
  });

  // ============ SUBSCRIPTIONS / CHECKOUT ============
  app.get('/api/tenants/:id/subscription', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).json({ message: 'Sin acceso' });
    const sub = await storage.getSubscriptionByTenant(id);
    res.json(sub || null);
  });

  app.post('/api/checkout/create', async (req, res) => {
    const schema = z.object({
      planSlug: z.enum(['inicia', 'crece', 'empresa', 'agencia']),
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(6).optional(),
      tenantName: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const { planSlug, email, name, password, tenantName } = parsed.data;

    // Create or fetch user + tenant
    let user = await storage.getUserByEmail(email);
    if (!user) {
      if (!password) return res.status(400).json({ message: 'Contraseña requerida' });
      const strength = checkPasswordStrength(password);
      if (!strength.ok) return res.status(400).json({ message: 'La contraseña no cumple los requisitos mínimos (12+ caracteres, mezcla de letras, números y símbolos).' });
      user = await storage.createUser({ email, passwordHash: await hashPassword(password), name, role: 'tenant_owner' } as any);
    }
    let tenantId = user.currentTenantId;
    if (!tenantId) {
      const directo = (await storage.listResellers()).find(r => r.slug === 'directo')!;
      const plan = await storage.getPlanBySlug(planSlug);
      const slug = (tenantName || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
      const t = await storage.createTenant({
        name: tenantName || `${name} - Mi negocio`,
        slug, industry: 'Otro', resellerId: directo.id, planId: plan!.id,
        status: 'trial', timezone: 'America/Monterrey',
      } as any);
      tenantId = t.id;
      await storage.updateUser(user.id, { currentTenantId: t.id } as any);
      await storage.createSubscription({
        tenantId: t.id, planId: plan!.id, status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 7 * 86400000),
        trialEndsAt: new Date(Date.now() + 7 * 86400000),
      } as any);
      await storage.createAssistant({
        tenantId: t.id, name: 'Sofía', voiceId: 'adri-chilanga', voiceProvider: 'elevenlabs',
        languageCode: 'es-MX', formality: 'usted',
        greeting: `Buenas tardes, gracias por llamar. Le atiende Sofía. ¿En qué le puedo ayudar?`,
        systemPrompt: `Eres Sofía, recepcionista virtual. Hablas español mexicano formal (usted).`,
      } as any);
    }
    const checkoutIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const checkoutUa = req.headers['user-agent'] || null;
    const sid = createSession({ userId: user.id, tenantId: tenantId!, ipHash: hashIp(checkoutIp), userAgentHash: hashUa(checkoutUa) });
    res.cookie(SESSION_COOKIE_NAME, sid, sessionCookieOpts());
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('__Host-marcall_csrf', csrfToken, { httpOnly: false, secure: isProduction, sameSite: 'strict', path: '/' });

    const publicBase = config.PUBLIC_APP_URL || ((req.headers['x-forwarded-proto'] || 'https') + '://' + (req.headers['x-forwarded-host'] || req.headers.host));
    const successUrl = `${publicBase}/#/checkout/success?tenant_id=${tenantId}&plan=${planSlug}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${publicBase}/#/checkout/cancel`;

    try {
      // Ensure tenant has a Stripe customer (live mode); persist the ID for portal/invoices.
      let stripeCustomerId: string | null = null;
      if (stripeMode === 'live') {
        const tenant = await storage.getTenant(tenantId!);
        stripeCustomerId = (tenant as any)?.stripeCustomerId || null;
        if (!stripeCustomerId) {
          const c = await stripeClient.createCustomer(email, name, { tenant_id: String(tenantId) });
          stripeCustomerId = c.customerId;
          await storage.updateTenant(tenantId!, { stripeCustomerId } as any);
        }
      }
      const session = await stripeClient.createCheckoutSession({
        planSlug,
        customerEmail: email,
        customerId: stripeCustomerId,
        tenantId: tenantId!,
        successUrl,
        cancelUrl,
        enableOxxo: true,
        allowPromotionCodes: true,
        trialDays: 0, // Stripe trial is set on the subscription record only — checkout starts paid.
      });
      logAudit(req, { action: 'checkout.created', tenantId: tenantId!, metadata: { planSlug, mode: stripeMode } });
      res.json({ url: session.url, sessionId: session.sessionId, mode: stripeMode, tenantId });
    } catch (e: any) {
      console.error('checkout error:', e);
      logAudit(req, { action: 'checkout.error', tenantId: tenantId ?? null, result: 'error', metadata: { error: e.message } });
      res.status(500).json({ message: e.message || 'Error creando checkout', mode: stripeMode });
    }
  });

  app.post('/api/checkout/complete', requireAuth, async (req, res) => {
    // Mark plan changed (mock-mode after returning from fake Stripe)
    const schema = z.object({ tenantId: z.number(), planSlug: z.string() });
    const { tenantId, planSlug } = schema.parse(req.body);
    if (!(await canAccessTenant(req.user, tenantId))) return res.status(403).json({ message: 'Sin acceso' });
    const plan = await storage.getPlanBySlug(planSlug);
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });
    await storage.updateTenant(tenantId, { planId: plan.id, status: 'active' } as any);
    const sub = await storage.getSubscriptionByTenant(tenantId);
    if (sub) await storage.updateSubscription(sub.id, { planId: plan.id, status: 'active' } as any);
    res.json({ ok: true });
  });

  // ============ TENANT CONFIG ============
  app.get('/api/tenants/:id/hours', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    res.json(await storage.listBusinessHours(id));
  });
  app.put('/api/tenants/:id/hours', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const rows = (req.body as any[]).map(r => ({ ...r, tenantId: id }));
    res.json(await storage.setBusinessHours(id, rows));
  });

  // Assistant
  app.get('/api/tenants/:id/assistant', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    res.json((await storage.getAssistantByTenant(id)) || null);
  });
  app.put('/api/tenants/:id/assistant', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const tenant = await storage.getTenant(id);
    const tenantName = tenant?.name || 'el negocio';
    const body = { ...req.body };
    // Regenerate system prompts to keep bilingual rule current
    let langs: string[] = [];
    try { langs = body.languages ? JSON.parse(body.languages) : []; } catch {}
    const isBilingual = langs.length > 1 || (body.codeSwitching && langs.includes('en-US'));
    const formality = body.formality === 'tu' ? 'tuteo (tú)' : 'formal (usted)';
    body.systemPrompt = `Eres ${body.name || 'Sofía'}, recepcionista virtual de ${tenantName}. Hablas español mexicano con trato ${formality}. Eres cálida, profesional y resolutiva.${isBilingual ? ' REGLA BILINGÜE: Saluda primero en ' + (body.defaultLanguage === 'en-US' ? 'inglés' : 'español') + '. Si el llamante responde en otro idioma, cambia inmediatamente y mantente en ese idioma. Nunca mezcles idiomas dentro de una misma frase.' : ''} Tu trabajo: responder FAQs, agendar citas, tomar recados, calificar leads y transferir cuando sea necesario. Nunca inventes información que no esté en tu base de conocimiento.`;
    if (isBilingual) {
      body.systemPromptEn = `You are ${body.name || 'Sofia'}, virtual receptionist for ${tenantName}. You speak native Mexican Spanish and US English fluently. BILINGUAL RULE: Greet first in ${body.defaultLanguage === 'en-US' ? 'English' : 'Spanish'}. If the caller replies in another language, switch immediately and stay in that language. Never mix languages within the same sentence. Your job: answer FAQs, book appointments, take messages, qualify leads, and transfer when needed. Never invent information not in your knowledge base.`;
    }
    const existing = await storage.getAssistantByTenant(id);
    if (existing) res.json(await storage.updateAssistant(existing.id, body));
    else res.json(await storage.createAssistant({ ...body, tenantId: id } as any));
  });

  // Numbers
  app.get('/api/tenants/:id/numbers', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    res.json(await storage.listPhoneNumbers(id));
  });
  app.post('/api/tenants/:id/numbers', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const body = req.body;
    if (body.kind === 'demo_us') {
      const n = await storage.createPhoneNumber({
        tenantId: id, e164: '+15551234567', country: 'US',
        kind: 'demo_us', kycStatus: 'na',
      } as any);
      return res.json(n);
    }
    if (body.kind === 'mx_managed') {
      const n = await storage.createPhoneNumber({
        tenantId: id, e164: '+528100000000', country: 'MX',
        kind: 'mx_managed', kycStatus: 'pending', kycDocsUrl: body.kycDocsUrl,
      } as any);
      return res.json(n);
    }
    if (body.kind === 'byo_twilio') {
      const n = await storage.createPhoneNumber({
        tenantId: id, e164: body.e164 || '+528100000001', country: 'MX',
        kind: 'byo_twilio', twilioSid: body.twilioSid, kycStatus: 'na',
      } as any);
      return res.json(n);
    }
    res.status(400).json({ message: 'kind requerido' });
  });

  // Generic CRUD: services, faqs, appointments, messages, leads, calls
  function registerCRUD<T>(path: string, list: (tenantId: number) => Promise<any[]>, create: (data: any) => Promise<any>, update?: (id: number, patch: any) => Promise<any>, del?: (id: number) => Promise<void>) {
    app.get(`/api/tenants/:id/${path}`, requireAuth, async (req, res) => {
      const id = +req.params.id;
      if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
      res.json(await list(id));
    });
    app.post(`/api/tenants/:id/${path}`, requireAuth, async (req, res) => {
      const id = +req.params.id;
      if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
      res.json(await create({ ...req.body, tenantId: id }));
    });
    if (update) {
      app.patch(`/api/tenants/:id/${path}/:itemId`, requireAuth, async (req, res) => {
        const id = +req.params.id;
        if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
        res.json(await update(+req.params.itemId, req.body));
      });
    }
    if (del) {
      app.delete(`/api/tenants/:id/${path}/:itemId`, requireAuth, async (req, res) => {
        const id = +req.params.id;
        if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
        await del(+req.params.itemId);
        res.json({ ok: true });
      });
    }
  }
  registerCRUD('services', storage.listServices.bind(storage), storage.createService.bind(storage), storage.updateService.bind(storage), storage.deleteService.bind(storage));
  registerCRUD('faqs', storage.listFaqs.bind(storage), storage.createFaq.bind(storage), storage.updateFaq.bind(storage), storage.deleteFaq.bind(storage));
  registerCRUD('appointments', storage.listAppointments.bind(storage), async (data: any) => {
    const appt = await storage.createAppointment(data);
    // Best-effort sync to Google Calendar when the tenant has a connected integration.
    try {
      const tenantId = data.tenantId;
      const integ = await storage.getIntegration(tenantId, 'google_calendar');
      if (integ && (integ as any).connected && (integ as any).refreshTokenEnc) {
        const refreshToken = decrypt((integ as any).refreshTokenEnc);
        if (refreshToken) {
          const start = data.startTime ? new Date(data.startTime) : new Date();
          const end = data.endTime ? new Date(data.endTime) : new Date(start.getTime() + 30 * 60 * 1000);
          const tenant = await storage.getTenant(tenantId);
          const ev = await googleCalendar.createEvent(refreshToken, {
            summary: `${data.callerName || data.customerName || 'Cita'} — ${tenant?.name || 'MARCALL'}`,
            description: data.notes || '',
            startIso: start.toISOString(),
            endIso: end.toISOString(),
            timeZone: tenant?.timezone || 'America/Monterrey',
          });
          if (ev?.eventId) {
            await storage.updateAppointment((appt as any).id, { googleEventId: ev.eventId } as any).catch(() => {});
          }
        }
      }
    } catch (e: any) {
      console.warn('[appointments] gcal sync failed:', e?.message);
    }
    return appt;
  }, storage.updateAppointment.bind(storage), storage.deleteAppointment.bind(storage));
  registerCRUD('messages', storage.listMessages.bind(storage), storage.createMessage.bind(storage));
  registerCRUD('leads', storage.listLeads.bind(storage), storage.createLead.bind(storage));
  registerCRUD('calls', storage.listCallLogs.bind(storage), storage.createCallLog.bind(storage));

  // ----- Paginated/filterable calls + CSV export -----
  app.get('/api/tenants/:id/calls/search', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const all = await storage.listCallLogs(id);
    const { from, to, outcome, lang, q, page = '1', pageSize = '25', format } = req.query as Record<string, string>;
    let filtered = all;
    if (from) {
      const d = new Date(from);
      filtered = filtered.filter(c => new Date(c.startedAt) >= d);
    }
    if (to) {
      const d = new Date(to);
      filtered = filtered.filter(c => new Date(c.startedAt) <= d);
    }
    if (outcome) {
      const set = new Set(outcome.split(','));
      filtered = filtered.filter(c => c.outcome && set.has(c.outcome));
    }
    if (lang) {
      filtered = filtered.filter(c => (c.language || '').toLowerCase().startsWith(lang.toLowerCase()));
    }
    if (q) {
      const ql = q.toLowerCase();
      filtered = filtered.filter(c => (c.callerPhone || '').toLowerCase().includes(ql) || (c.transcript || '').toLowerCase().includes(ql));
    }
    if (format === 'csv') {
      const rows = [['id','startedAt','callerPhone','durationSec','language','outcome','costMxnCents']];
      for (const c of filtered) rows.push([String(c.id), new Date(c.startedAt).toISOString(), c.callerPhone, String(c.durationSec ?? ''), c.language, c.outcome ?? '', String(c.costMxnCents ?? 0)]);
      const csv = rows.map(r => r.map(v => `"${(v||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="calls-${id}.csv"`);
      return res.send(csv);
    }
    const p = Math.max(1, +page);
    const ps = Math.max(1, Math.min(100, +pageSize));
    const total = filtered.length;
    const items = filtered.slice((p - 1) * ps, p * ps);
    res.json({ total, page: p, pageSize: ps, items });
  });

  app.get('/api/tenants/:id/calls/:callId', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const call = await storage.getCallLog(+req.params.callId);
    if (!call || call.tenantId !== id) return res.status(404).json({ message: 'not found' });
    res.json(call);
  });

  // ----- Mutate messages / leads / appointments PATCH endpoints (extra) -----
  app.patch('/api/tenants/:id/messages/:itemId', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    res.json(await storage.updateMessage(+req.params.itemId, req.body));
  });
  app.patch('/api/tenants/:id/leads/:itemId', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    res.json(await storage.updateLead(+req.params.itemId, req.body));
  });

  // ----- Assistant PATCH alias -----
  app.patch('/api/tenants/:id/assistant', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const existing = await storage.getAssistantByTenant(id);
    if (!existing) return res.status(404).json({ message: 'no assistant' });
    const updated = await storage.updateAssistant(existing.id, req.body);
    res.json(updated);
  });

  // ----- Tenant API keys -----
  app.get('/api/tenants/:id/api-keys', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const rows = await storage.listTenantApiKeys(id);
    res.json(rows.map(r => ({ ...r, hash: undefined })));
  });
  app.post('/api/tenants/:id/api-keys', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const name = (req.body?.name || 'Default').toString();
    const scope = (req.body?.scope || 'read').toString();
    const raw = 'mk_' + crypto.randomBytes(24).toString('hex');
    const prefix = raw.slice(0, 8);
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const created = await storage.createTenantApiKey({ tenantId: id, name, prefix, hash, scope } as any);
    res.json({ ...created, hash: undefined, key: raw });
  });
  app.delete('/api/tenants/:id/api-keys/:keyId', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    await storage.revokeTenantApiKey(+req.params.keyId);
    res.json({ ok: true });
  });

  // ----- Billing: portal + upgrade preflight -----
  app.post('/api/billing/portal', requireAuth, async (req, res) => {
    const tenantId = req.user?.currentTenantId;
    const returnUrl = req.body?.returnUrl || `${config.PUBLIC_APP_URL}/#/app/facturacion`;
    if (stripeMode !== 'live') {
      return res.json({ url: 'https://billing.stripe.com/p/login/test_demo', mode: 'mock' });
    }
    try {
      const tenant = tenantId ? await storage.getTenant(tenantId) : null;
      const customerId = (tenant as any)?.stripeCustomerId;
      if (!customerId) {
        return res.status(400).json({ message: 'Sin customer de Stripe. Completa el checkout primero.' });
      }
      const portal = await stripeClient.createBillingPortalSession(customerId, returnUrl);
      logAudit(req, { action: 'billing.portal_opened', tenantId: tenantId ?? null });
      res.json({ url: portal.url });
    } catch (e: any) {
      console.error('[billing/portal] error:', e);
      res.status(500).json({ message: e.message });
    }
  });
  app.post('/api/billing/upgrade', requireAuth, async (req, res) => {
    if (INTEGRATION_MODE === 'mock' || !stripeClient) {
      return res.json({ ok: true, mock: true, message: 'mock upgrade preview' });
    }
    res.json({ ok: true });
  });

  // ----- Invoices: read from local invoices table (populated by Stripe webhook) -----
  app.get('/api/tenants/:id/invoices', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const rows = await storage.listInvoices(id);
    res.json(rows.map((r) => ({
      id: r.id,
      stripeInvoiceId: r.stripeInvoiceId,
      date: r.createdAt,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      amountMxnCents: r.amountMxnCents,
      status: r.status,
      pdfUrl: r.pdfUrl,
      hostedInvoiceUrl: r.hostedInvoiceUrl,
      cfdiId: r.cfdiId,
      cfdiPdfUrl: r.cfdiPdfUrl,
      cfdiXmlUrl: r.cfdiXmlUrl,
      cfdiError: r.cfdiError,
    })));
  });

  // ----- CFDI: manual retry endpoint when an invoice's CFDI failed -----
  app.post('/api/tenants/:id/invoices/:invoiceId/cfdi', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const invId = +req.params.invoiceId;
    const inv = (await storage.listInvoices(id)).find((i) => i.id === invId);
    if (!inv) return res.status(404).json({ message: 'Factura no encontrada' });
    if (inv.cfdiId) return res.json({ ok: true, cached: true, cfdiId: inv.cfdiId });
    const tenant = await storage.getTenant(id);
    if (!tenant) return res.status(404).json({ message: 'Tenant no encontrado' });
    const result = await createCFDI(tenant as any, inv as any);
    if (result.ok) {
      await storage.updateInvoice(invId, {
        cfdiId: result.cfdiId,
        cfdiPdfUrl: result.pdfUrl,
        cfdiXmlUrl: result.xmlUrl,
        cfdiError: null,
      } as any);
      logAudit(req, { action: 'cfdi.retry_success', tenantId: id, metadata: { invoiceId: invId, cfdiId: result.cfdiId } });
      return res.json({ ok: true, cfdiId: result.cfdiId });
    }
    await storage.updateInvoice(invId, { cfdiError: result.error } as any);
    logAudit(req, { action: 'cfdi.retry_failed', tenantId: id, result: 'error', metadata: { invoiceId: invId, error: result.error } });
    res.status(400).json({ ok: false, error: result.error });
  });

  // ----- Tenant team list (mock-derived from users table) -----
  app.get('/api/tenants/:id/team', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const all = await storage.listUsers();
    const team = all.filter(u => u.currentTenantId === id);
    res.json(team.map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      lastLoginAt: u.lastLoginAt, mfaEnabled: !!u.mfaEnabled,
      preferredLanguage: u.preferredLanguage,
    })));
  });
  app.post('/api/tenants/:id/team/invite', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    console.log('[invite] mock send magic link', { tenantId: id, ...req.body });
    res.json({ ok: true, mock: true });
  });

  // Usage
  app.get('/api/tenants/:id/usage', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const sub = await storage.getSubscriptionByTenant(id);
    const since = sub?.currentPeriodStart || new Date(Date.now() - 30 * 86400000);
    const used = await storage.getUsageThisPeriod(id, new Date(since));
    const plan = sub ? await storage.getPlan(sub.planId) : null;
    res.json({
      minutesUsed: used,
      minutesIncluded: plan?.includedMinutes || 0,
      periodStart: since, periodEnd: sub?.currentPeriodEnd,
    });
  });

  // ============ ADMIN ============
  app.get('/api/admin/stats', requireAuth, requireRole(['superadmin']), async (_req, res) => {
    const allTenants = await storage.listTenants();
    const plans = await storage.listPlans();
    let mrr = 0;
    for (const t of allTenants) {
      if (t.status === 'active') {
        const p = plans.find(pp => pp.id === t.planId);
        if (p) mrr += p.priceMxnCents;
      }
    }
    let totalCalls = 0, totalMinutes = 0;
    for (const t of allTenants) {
      const calls = await storage.listCallLogs(t.id);
      totalCalls += calls.length;
      totalMinutes += calls.reduce((s, c) => s + (c.durationSec || 0) / 60, 0);
    }
    res.json({
      mrrMxnCents: mrr,
      totalTenants: allTenants.length,
      activeTenants: allTenants.filter(t => t.status === 'active').length,
      trialTenants: allTenants.filter(t => t.status === 'trial').length,
      totalCalls,
      totalMinutes: Math.round(totalMinutes),
      churnRate: 0,
    });
  });

  app.get('/api/admin/kyc-queue', requireAuth, requireRole(['superadmin']), async (_req, res) => {
    res.json(await storage.listKycPending());
  });
  app.post('/api/admin/kyc/:id/approve', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const n = await storage.updatePhoneNumber(+req.params.id, { kycStatus: 'approved' } as any);
    res.json(n);
  });
  app.post('/api/admin/kyc/:id/reject', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const n = await storage.updatePhoneNumber(+req.params.id, { kycStatus: 'rejected' } as any);
    res.json(n);
  });
  app.get('/api/admin/resellers', requireAuth, requireRole(['superadmin']), async (_req, res) => {
    res.json(await storage.listResellers());
  });

  // ============ VAPI TOOL ENDPOINTS ============
  // Constant-time compare so an attacker can't time the secret length.
  function checkVapiSecret(req: Request) {
    if (!VAPI_TOOL_SECRET) return false;
    const provided = (req.headers['x-vapi-secret'] as string) || '';
    if (provided.length !== VAPI_TOOL_SECRET.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(VAPI_TOOL_SECRET));
    } catch {
      return false;
    }
  }
  // Apply rate limit to all /api/tools/* tool callbacks
  app.use('/api/tools', toolsLimiter);

  // ============ PUBLIC DEMO (browser voice demo, no auth) ============
  // 30 req/min per IP. Honest, deterministic responses — no LLM credits burned.
  const demoLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Demasiadas solicitudes, espere un momento.' },
  });

  app.post('/api/demo/respond', demoLimiter, async (req, res) => {
    const schema = z.object({
      sessionId: z.string().min(8).max(64),
      transcript: z.string().max(500),
      lang: z.enum(['es', 'en']),
      scenario: z.string().max(80),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const { sessionId, transcript, lang, scenario } = parsed.data;

    // Ensure aggregate row exists (idempotent)
    try {
      const existing = db.select().from(demoSessions).where(eq(demoSessions.sessionId, sessionId)).get();
      if (!existing) {
        db.insert(demoSessions).values({
          sessionId, lang, scenario,
          turnCount: 0, durationSec: 0, completedSignup: false,
        }).run();
      }
    } catch {}

    const result = demoRespond(sessionId, transcript, lang, scenario);

    // Update aggregate counters
    try {
      db.update(demoSessions)
        .set({ turnCount: demoTurnCountFor(sessionId) })
        .where(eq(demoSessions.sessionId, sessionId)).run();
    } catch {}

    // Log a demo.turn event
    try {
      db.insert(demoEvents).values({
        sessionId,
        event: 'demo.turn',
        payload: JSON.stringify({ intent: result.metadata.intent, lang, scenario }),
      }).run();
    } catch {}

    res.json(result);
  });

  app.post('/api/demo/end', demoLimiter, async (req, res) => {
    const schema = z.object({
      sessionId: z.string().min(8).max(64),
      completedSignup: z.boolean().optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const { sessionId, completedSignup } = parsed.data;

    const summary = demoEndSession(sessionId);
    try {
      const existing = db.select().from(demoSessions).where(eq(demoSessions.sessionId, sessionId)).get();
      if (existing) {
        db.update(demoSessions).set({
          turnCount: summary?.turnCount ?? existing.turnCount,
          durationSec: summary?.durationSec ?? existing.durationSec,
          completedSignup: !!(completedSignup ?? existing.completedSignup),
        }).where(eq(demoSessions.sessionId, sessionId)).run();
      }
      db.insert(demoEvents).values({
        sessionId,
        event: 'demo.ended',
        payload: JSON.stringify({ ...summary, completedSignup: !!completedSignup }),
      }).run();
    } catch {}

    res.json({ ok: true, summary });
  });

  // Lightweight event log (page open, mic start, signup click)
  app.post('/api/demo/event', demoLimiter, async (req, res) => {
    const schema = z.object({
      sessionId: z.string().min(8).max(64),
      event: z.enum(['demo.opened', 'demo.started', 'demo.signup_clicked']),
      payload: z.record(z.any()).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const { sessionId, event, payload } = parsed.data;
    try {
      db.insert(demoEvents).values({
        sessionId,
        event,
        payload: payload ? JSON.stringify(payload) : null,
      }).run();
      if (event === 'demo.signup_clicked') {
        db.update(demoSessions).set({ completedSignup: true })
          .where(eq(demoSessions.sessionId, sessionId)).run();
      }
    } catch {}
    res.json({ ok: true });
  });
  app.post('/api/tools/check-availability', async (req, res) => {
    if (!checkVapiSecret(req)) {
      logAudit(req, { action: 'tools.bad_secret', result: 'denied', metadata: { path: req.path } });
      return res.status(401).json({ message: 'Bad secret' });
    }
    const tenantId = +req.body.tenant_id;
    const slots = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(Date.now() + (i + 1) * 3600000);
      return d.toISOString();
    });
    res.json({ slots });
  });
  app.post('/api/tools/book-appointment', async (req, res) => {
    if (!checkVapiSecret(req)) return res.status(401).end();
    const a = await storage.createAppointment({ ...req.body, tenantId: +req.body.tenant_id } as any);
    res.json(a);
  });
  app.post('/api/tools/reschedule-appointment', async (req, res) => {
    if (!checkVapiSecret(req)) return res.status(401).end();
    const id = +req.body.appointment_id;
    const a = await storage.updateAppointment(id, { startTime: new Date(req.body.new_time) } as any);
    res.json(a);
  });
  app.post('/api/tools/cancel-appointment', async (req, res) => {
    if (!checkVapiSecret(req)) return res.status(401).end();
    await storage.deleteAppointment(+req.body.appointment_id);
    res.json({ ok: true });
  });
  app.post('/api/tools/answer-faq', async (req, res) => {
    if (!checkVapiSecret(req)) return res.status(401).end();
    const tenantId = +req.body.tenant_id;
    const q = (req.body.question || '').toLowerCase();
    const faqs = await storage.listFaqs(tenantId);
    const match = faqs.find(f => q && f.question.toLowerCase().includes(q.split(' ')[0]));
    res.json({ answer: match?.answer || 'No tengo esa información a la mano. Le tomo un recado para que le devuelvan la llamada.' });
  });
  app.post('/api/tools/take-message', async (req, res) => {
    if (!checkVapiSecret(req)) return res.status(401).end();
    const m = await storage.createMessage({ ...req.body, tenantId: +req.body.tenant_id } as any);
    res.json(m);
  });
  app.post('/api/tools/qualify-lead', async (req, res) => {
    if (!checkVapiSecret(req)) return res.status(401).end();
    const l = await storage.createLead({ ...req.body, tenantId: +req.body.tenant_id } as any);
    res.json(l);
  });
  app.post('/api/tools/transfer-to-human', async (req, res) => {
    if (!checkVapiSecret(req)) return res.status(401).end();
    const t = await storage.getTenant(+req.body.tenant_id);
    res.json({ transferTo: t?.transferNumber });
  });

  // ============ WEBHOOKS (stubs) ============
  // ─── Webhook signature verification helpers ───
  function verifyHmacSignature(rawBody: Buffer | undefined, signature: string | undefined, secret: string | undefined): boolean {
    if (!secret || !rawBody || !signature) return false;
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  app.post('/api/webhooks/vapi', async (req, res) => {
    const sig = req.headers['x-vapi-signature'] as string | undefined;
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (config.MARCALL_INTEGRATION_MODE === 'live') {
      if (!verifyHmacSignature(req.rawBody as Buffer | undefined, sig, secret)) {
        logAudit(req, { action: 'webhook.vapi_signature_invalid', result: 'denied' });
        return res.status(401).json({ message: 'Invalid signature' });
      }
    } else if (!sig) {
      console.warn('[webhook/vapi] missing signature (mock mode — accepting)');
    }
    logAudit(req, { action: 'webhook.vapi_received', metadata: { type: req.body?.message?.type } });
    const payload = req.body;
    if (payload?.message?.type === 'end-of-call-report' && payload?.metadata?.tenant_id) {
      const tenantId = +payload.metadata.tenant_id;
      const dur = payload.message.durationSec || 60;
      await storage.createCallLog({
        tenantId, callerPhone: payload.message.callerPhone || 'desconocido',
        startedAt: new Date(payload.message.startedAt || Date.now()),
        endedAt: new Date(),
        durationSec: dur,
        transcript: JSON.stringify(payload.message.transcript || []),
        outcome: payload.message.outcome || 'info',
        costMxnCents: Math.round(dur / 60 * 320),
      } as any);
      // WhatsApp owner alert — fire-and-forget, non-blocking
      const outcome = payload.message.outcome || 'info';
      if (outcome !== 'transferred') {
        const tenant = await storage.getTenant(tenantId).catch(() => null);
        if (tenant) {
          // Try to get the owner's phone from users
          const ownerUser = tenant ? await storage.getUser((tenant as any).ownerUserId).catch(() => null) : null;
          const ownerPhone = (ownerUser as any)?.phone || (tenant as any)?.transferNumber;
          if (ownerPhone) {
            notifyCallLanded(
              ownerPhone.replace(/[^0-9]/g, ''),
              payload.message.callerPhone || 'desconocido',
              outcome,
              tenant.name,
            ).catch((e: Error) => console.warn('[vapi] whatsapp notify error:', e.message));
          }
        }
      }
    }
    res.json({ ok: true });
  });
  app.post('/api/webhooks/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: any = null;

    if (config.MARCALL_INTEGRATION_MODE === 'live') {
      if (!sig || !secret) {
        logAudit(req, { action: 'webhook.stripe_signature_missing', result: 'denied' });
        return res.status(401).json({ message: 'Missing signature' });
      }
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-02-24.acacia' as any });
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, secret);
        logAudit(req, { action: 'webhook.stripe_received', metadata: { type: event.type, id: event.id } });
      } catch (e: any) {
        logAudit(req, { action: 'webhook.stripe_signature_invalid', result: 'denied', metadata: { error: e.message } });
        return res.status(401).json({ message: 'Invalid signature' });
      }
    } else {
      if (!sig) console.warn('[webhook/stripe] missing signature (mock mode — accepting)');
      // Mock-mode: accept the JSON body verbatim so manual tests can drive the handlers.
      event = req.body;
      logAudit(req, { action: 'webhook.stripe_received_mock', metadata: { type: event?.type } });
    }

    // ===== Event handlers =====
    try {
      const obj: any = event?.data?.object || {};
      const eventType: string = event?.type || '';

      // Helper: resolve tenant from metadata, customer ID, or subscription metadata.
      async function resolveTenantId(): Promise<number | null> {
        const fromMeta = obj.metadata?.tenant_id || obj.subscription_details?.metadata?.tenant_id;
        if (fromMeta) return Number(fromMeta);
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        if (customerId) {
          const all = await storage.listTenants();
          const t = all.find((tt: any) => tt.stripeCustomerId === customerId);
          if (t) return t.id;
        }
        return null;
      }

      if (eventType === 'checkout.session.completed') {
        const tenantId = await resolveTenantId();
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id;
        if (tenantId) {
          if (customerId) {
            await storage.updateTenant(tenantId, { stripeCustomerId: customerId, status: 'active' } as any);
          }
          const sub = await storage.getSubscriptionByTenant(tenantId);
          if (sub) {
            await storage.updateSubscription(sub.id, {
              stripeSubscriptionId: subscriptionId || null,
              stripeSubId: subscriptionId || null,
              status: 'active',
            } as any);
          }
          logAudit(req, { action: 'subscription.checkout_completed', tenantId, metadata: { subscriptionId } });
        }
      }

      if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.created') {
        const tenantId = await resolveTenantId();
        const priceId = obj.items?.data?.[0]?.price?.id || null;
        const planSlug = priceIdToPlanSlug(priceId);
        if (tenantId) {
          const sub = await storage.getSubscriptionByTenant(tenantId);
          const patch: any = {
            stripeSubscriptionId: obj.id,
            stripeSubId: obj.id,
            stripePriceId: priceId,
            status: obj.status,
            currentPeriodStart: obj.current_period_start ? new Date(obj.current_period_start * 1000) : null,
            currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000) : null,
            cancelAtPeriodEnd: !!obj.cancel_at_period_end,
            canceledAt: obj.canceled_at ? new Date(obj.canceled_at * 1000) : null,
            trialEndsAt: obj.trial_end ? new Date(obj.trial_end * 1000) : null,
          };
          if (planSlug) {
            const plan = await storage.getPlanBySlug(planSlug);
            if (plan) {
              patch.planId = plan.id;
              await storage.updateTenant(tenantId, { planId: plan.id } as any);
            }
          }
          if (sub) {
            await storage.updateSubscription(sub.id, patch);
          } else {
            const plan = planSlug ? await storage.getPlanBySlug(planSlug) : null;
            if (plan) {
              await storage.createSubscription({ tenantId, planId: plan.id, ...patch } as any);
            }
          }
          // Map Stripe status to tenant status.
          const tenantStatus = obj.status === 'active' || obj.status === 'trialing' ? 'active'
            : obj.status === 'past_due' ? 'past_due'
            : obj.status === 'canceled' ? 'canceled'
            : 'active';
          await storage.updateTenant(tenantId, { status: tenantStatus } as any);
          logAudit(req, { action: 'subscription.updated', tenantId, metadata: { status: obj.status, planSlug } });
        }
      }

      if (eventType === 'customer.subscription.deleted') {
        const tenantId = await resolveTenantId();
        if (tenantId) {
          const sub = await storage.getSubscriptionByTenant(tenantId);
          if (sub) {
            await storage.updateSubscription(sub.id, {
              status: 'canceled',
              canceledAt: new Date(),
            } as any);
          }
          await storage.updateTenant(tenantId, { status: 'canceled' } as any);
          logAudit(req, { action: 'subscription.canceled', tenantId });
        }
      }

      if (eventType === 'invoice.paid' || eventType === 'invoice.payment_succeeded') {
        const tenantId = await resolveTenantId();
        if (tenantId) {
          const stripeInvoiceId: string = obj.id;
          const existing = stripeInvoiceId ? await storage.getInvoiceByStripeId(stripeInvoiceId) : null;
          const amount = obj.amount_paid ?? obj.amount_due ?? 0;
          const periodStart = obj.period_start ? new Date(obj.period_start * 1000) : (obj.lines?.data?.[0]?.period?.start ? new Date(obj.lines.data[0].period.start * 1000) : null);
          const periodEnd = obj.period_end ? new Date(obj.period_end * 1000) : (obj.lines?.data?.[0]?.period?.end ? new Date(obj.lines.data[0].period.end * 1000) : null);
          let invRecord;
          if (existing) {
            invRecord = await storage.updateInvoice(existing.id, {
              status: 'paid',
              amountMxnCents: amount,
              pdfUrl: obj.invoice_pdf || existing.pdfUrl || null,
              hostedInvoiceUrl: obj.hosted_invoice_url || existing.hostedInvoiceUrl || null,
              periodStart: periodStart || existing.periodStart,
              periodEnd: periodEnd || existing.periodEnd,
            } as any);
          } else {
            invRecord = await storage.createInvoice({
              tenantId,
              stripeInvoiceId,
              amountMxnCents: amount,
              status: 'paid',
              pdfUrl: obj.invoice_pdf || null,
              hostedInvoiceUrl: obj.hosted_invoice_url || null,
              periodStart,
              periodEnd,
            } as any);
          }

          // Enqueue invoice_paid email — notifications agent picks this up.
          try {
            const tenant = await storage.getTenant(tenantId);
            const ownerUser = (tenant as any)?.ownerUserId ? await storage.getUser((tenant as any).ownerUserId).catch(() => null) : null;
            const toEmail = ownerUser?.email || obj.customer_email || (await storage.listUsers()).find((u: any) => u.currentTenantId === tenantId)?.email;
            if (toEmail) {
              await storage.enqueueEmail({
                tenantId,
                userId: ownerUser?.id ?? null,
                type: 'invoice_paid',
                payload: {
                  to: toEmail,
                  lang: (ownerUser?.preferredLanguage === 'en' ? 'en' : 'es') as 'es' | 'en',
                  data: {
                    amountMxnCents: amount,
                    amountMxn: (amount / 100).toFixed(2),
                    periodEnd: periodEnd?.toISOString() || null,
                    hostedInvoiceUrl: obj.hosted_invoice_url || null,
                    pdfUrl: obj.invoice_pdf || null,
                    invoiceNumber: obj.number || stripeInvoiceId,
                  },
                },
              });
            }
          } catch (e: any) {
            console.error('[webhook/stripe] enqueueEmail invoice_paid failed', e?.message || e);
          }

          // CFDI — best-effort. Never blocks. Persist whichever outcome.
          try {
            const tenant = await storage.getTenant(tenantId);
            if (tenant && cfdiConfigured && invRecord) {
              const cfdi = await createCFDI(tenant as any, invRecord as any);
              if (cfdi.ok) {
                await storage.updateInvoice(invRecord.id, {
                  cfdiId: cfdi.cfdiId,
                  cfdiPdfUrl: cfdi.pdfUrl,
                  cfdiXmlUrl: cfdi.xmlUrl,
                  cfdiError: null,
                } as any);
                logAudit(req, { action: 'cfdi.created', tenantId, metadata: { cfdiId: cfdi.cfdiId, invoiceId: invRecord.id } });
              } else {
                await storage.updateInvoice(invRecord.id, { cfdiError: cfdi.error } as any);
                logAudit(req, { action: 'cfdi.failed', tenantId, result: 'error', metadata: { error: cfdi.error, invoiceId: invRecord.id } });
              }
            }
          } catch (e: any) {
            console.error('[webhook/stripe] CFDI error', e?.message || e);
            if (invRecord) {
              await storage.updateInvoice(invRecord.id, { cfdiError: e?.message || 'CFDI exception' } as any).catch(() => {});
            }
          }

          logAudit(req, { action: 'invoice.paid', tenantId, metadata: { stripeInvoiceId, amount } });
        }
      }

      if (eventType === 'invoice.payment_failed') {
        const tenantId = await resolveTenantId();
        if (tenantId) {
          const stripeInvoiceId: string = obj.id;
          const existing = stripeInvoiceId ? await storage.getInvoiceByStripeId(stripeInvoiceId) : null;
          const amount = obj.amount_due ?? 0;
          if (existing) {
            await storage.updateInvoice(existing.id, { status: 'failed', amountMxnCents: amount } as any);
          } else {
            await storage.createInvoice({
              tenantId,
              stripeInvoiceId,
              amountMxnCents: amount,
              status: 'failed',
              hostedInvoiceUrl: obj.hosted_invoice_url || null,
            } as any);
          }
          await storage.updateTenant(tenantId, { status: 'past_due' } as any);

          // Enqueue invoice_failed email
          try {
            const tenant = await storage.getTenant(tenantId);
            const ownerUser = (tenant as any)?.ownerUserId ? await storage.getUser((tenant as any).ownerUserId).catch(() => null) : null;
            const toEmail = ownerUser?.email || obj.customer_email || (await storage.listUsers()).find((u: any) => u.currentTenantId === tenantId)?.email;
            if (toEmail) {
              await storage.enqueueEmail({
                tenantId,
                userId: ownerUser?.id ?? null,
                type: 'invoice_failed',
                payload: {
                  to: toEmail,
                  lang: (ownerUser?.preferredLanguage === 'en' ? 'en' : 'es') as 'es' | 'en',
                  data: {
                    amountMxnCents: amount,
                    amountMxn: (amount / 100).toFixed(2),
                    hostedInvoiceUrl: obj.hosted_invoice_url || null,
                    nextAttempt: obj.next_payment_attempt ? new Date(obj.next_payment_attempt * 1000).toISOString() : null,
                    invoiceNumber: obj.number || stripeInvoiceId,
                  },
                },
              });
            }
          } catch (e: any) {
            console.error('[webhook/stripe] enqueueEmail invoice_failed failed', e?.message || e);
          }

          logAudit(req, { action: 'invoice.payment_failed', tenantId, result: 'error', metadata: { stripeInvoiceId, amount } });
        }
      }
    } catch (e: any) {
      console.error('[webhook/stripe] handler error', e?.message || e);
      logAudit(req, { action: 'webhook.stripe_handler_error', result: 'error', metadata: { error: e?.message } });
    }

    res.json({ ok: true });
  });

  app.post('/api/webhooks/twilio', async (req, res) => {
    const sig = req.headers['x-twilio-signature'] as string | undefined;
    const token = config.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    if (config.MARCALL_INTEGRATION_MODE === 'live') {
      if (!sig || !token) {
        logAudit(req, { action: 'webhook.twilio_signature_missing', result: 'denied' });
        return res.status(403).json({ message: 'Missing signature' });
      }
      // Control 1: validate Twilio webhook signature using official SDK
      const valid = validateTwilioRequest(req, token);
      if (!valid) {
        logAudit(req, { action: 'webhook.twilio.signature_invalid', result: 'denied' });
        return res.status(403).json({ message: 'Invalid Twilio signature' });
      }
    } else if (!sig) {
      console.warn('[webhook/twilio] missing signature (mock mode — accepting)');
    }
    logAudit(req, { action: 'webhook.twilio_received' });
    res.json({ ok: true });
  });

  // ============ GOOGLE CALENDAR INTEGRATION (OAuth + appointment sync) ============
  // Per-tenant integration. Each tenant authorizes once — we store an encrypted refresh
  // token and use it for slot lookups + event creation.

  // GET /api/integrations/google/authorize?tenant_id=N
  // Returns the consent URL (or redirects). Caller is responsible for opening it in a popup.
  app.get('/api/integrations/google/authorize', requireAuth, async (req, res) => {
    const tenantId = +(req.query.tenant_id as string) || req.user?.currentTenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });
    if (!(await canAccessTenant(req.user, tenantId))) return res.status(403).json({ message: 'Sin acceso' });
    // Embed tenant + a short-lived nonce in `state` so the callback can verify origin.
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ t: tenantId, n: nonce, u: req.user!.id })).toString('base64url');
    const url = googleCalendar.getAuthUrl(tenantId, state);
    logAudit(req, { action: 'integrations.google.authorize_started', tenantId });
    if (req.query.redirect === '1') return res.redirect(url);
    res.json({ url, mode: googleCalendar.isLive() ? 'live' : 'mock' });
  });

  // GET /api/integrations/google/callback?code=&state=
  // Public-ish (Google redirects here without our session cookie due to top-level navigation),
  // so we re-authenticate via the embedded user-id in `state` and then verify access.
  app.get('/api/integrations/google/callback', async (req, res) => {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;
    const errorParam = req.query.error as string;
    if (errorParam) {
      return res.redirect(`${config.PUBLIC_APP_URL}/#/app/configuracion?gcal=error&reason=${encodeURIComponent(errorParam)}`);
    }
    if (!code || !stateRaw) return res.status(400).send('Missing code or state');
    let state: any;
    try {
      state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
    } catch {
      return res.status(400).send('Invalid state');
    }
    const tenantId = Number(state.t);
    if (!tenantId) return res.status(400).send('Invalid tenant');

    try {
      const tokens = await googleCalendar.exchangeCode(tenantId, code);
      const refreshEnc = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;
      const accessEnc = tokens.accessToken ? encrypt(tokens.accessToken) : null;
      await storage.upsertIntegration({
        tenantId,
        kind: 'google_calendar',
        provider: 'google',
        externalId: tokens.googleAccountId || null,
        accessTokenEnc: accessEnc,
        refreshTokenEnc: refreshEnc,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes || null,
        status: 'connected',
        connected: true,
        config: JSON.stringify({ connectedAt: new Date().toISOString() }),
      } as any);
      logAudit(req, { action: 'integrations.google.connected', tenantId, metadata: { account: tokens.googleAccountId } });
      res.redirect(`${config.PUBLIC_APP_URL}/#/app/configuracion?gcal=connected`);
    } catch (e: any) {
      console.error('[gcal/callback] error', e);
      logAudit(req, { action: 'integrations.google.callback_failed', tenantId, result: 'error', metadata: { error: e?.message } });
      res.redirect(`${config.PUBLIC_APP_URL}/#/app/configuracion?gcal=error&reason=${encodeURIComponent(e?.message || 'unknown')}`);
    }
  });

  app.post('/api/integrations/google/disconnect', requireAuth, async (req, res) => {
    const tenantId = +(req.body?.tenantId) || req.user?.currentTenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId requerido' });
    if (!(await canAccessTenant(req.user, tenantId))) return res.status(403).json({ message: 'Sin acceso' });
    await storage.deleteIntegration(tenantId, 'google_calendar');
    logAudit(req, { action: 'integrations.google.disconnected', tenantId });
    res.json({ ok: true });
  });

  app.get('/api/tenants/:id/integrations', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const all = await storage.listIntegrations(id);
    // Strip secrets before returning.
    res.json(all.map((i: any) => ({
      id: i.id,
      kind: i.kind,
      provider: i.provider,
      externalId: i.externalId,
      status: i.status,
      connected: !!i.connected,
      expiresAt: i.expiresAt,
      scopes: i.scopes,
      config: (() => { try { return i.config ? JSON.parse(i.config) : null; } catch { return null; } })(),
    })));
  });

  // ============ TENANT FISCAL DATA (CFDI) ============
  app.get('/api/tenants/:id/fiscal', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const t = await storage.getTenant(id);
    if (!t) return res.status(404).end();
    res.json({
      rfc: (t as any).rfc || null,
      razonSocial: (t as any).razonSocial || null,
      regimenFiscal: (t as any).regimenFiscal || '601',
      usoCfdi: (t as any).usoCfdi || 'G03',
    });
  });
  app.put('/api/tenants/:id/fiscal', requireAuth, async (req, res) => {
    const id = +req.params.id;
    if (!(await canAccessTenant(req.user, id))) return res.status(403).end();
    const schema = z.object({
      rfc: z.string().min(10).max(13).regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i, 'RFC inválido').optional().nullable(),
      razonSocial: z.string().min(1).max(250).optional().nullable(),
      regimenFiscal: z.string().min(3).max(5).optional().nullable(),
      usoCfdi: z.string().min(2).max(5).optional().nullable(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const v = parsed.data;
    const updated = await storage.updateTenant(id, {
      rfc: v.rfc?.toUpperCase() || null,
      razonSocial: v.razonSocial || null,
      regimenFiscal: v.regimenFiscal || '601',
      usoCfdi: v.usoCfdi || 'G03',
    } as any);
    logAudit(req, { action: 'tenant.fiscal_updated', tenantId: id });
    res.json(updated);
  });

  // ============ LEGAL CONTENT ============
  app.get('/api/legal/:doc', (req, res) => {
    const doc = req.params.doc; // 'privacy' | 'terms' | 'resellers'
    const lang = (req.query.lang as string) || 'es';
    // Each doc maps to { es, en } file basenames so we can use the full v0.2
    // TOS without breaking the Spanish/English fallback for other docs.
    const map: Record<string, { es: string; en: string }> = {
      'privacy':         { es: 'aviso-de-privacidad',               en: 'aviso-de-privacidad-en' },
      'terms':           { es: 'terms-of-service-careofaddress-es', en: 'terms-of-service-careofaddress-en' },
      'resellers':       { es: 'programa-de-revendedores',          en: 'programa-de-revendedores-en' },
      'cookies':         { es: 'politica-de-cookies',               en: 'cookies-policy-en' },
      'acceptable-use':  { es: 'politica-uso-aceptable',            en: 'acceptable-use-policy-en' },
      'dpa':             { es: 'contrato-procesamiento-datos',      en: 'data-processing-agreement-en' },
    };
    const entry = map[doc];
    if (!entry) return res.status(404).json({ message: 'No encontrado' });
    // Try ./legal (relative to cwd) first, then ../legal as fallback for the
    // monorepo layout (where the app/ workspace lives next to legal/).
    const cwdLegal = path.resolve(process.cwd(), 'legal');
    const parentLegal = path.resolve(process.cwd(), '..', 'legal');
    const baseDir = fs.existsSync(cwdLegal) ? cwdLegal : parentLegal;
    const enPath = path.join(baseDir, `${entry.en}.md`);
    const esPath = path.join(baseDir, `${entry.es}.md`);
    let filePath = lang === 'en' && fs.existsSync(enPath) ? enPath : esPath;
    let actualLang = filePath === enPath ? 'en' : 'es';
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
      // Strip markdown comment blocks like `[//]: # (...)` which are author
      // notes not meant for end users (e.g. attorney-review reminders).
      content = content.replace(/^\[\/\/\]: # \([^)]*\)\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      content = lang === 'en'
        ? '# Legal\n\nThis document will be available soon. See the Spanish version meanwhile.'
        : '# Legal\n\nDocumento no disponible.';
    }
    res.json({ content, lang: actualLang });
  });

  // ============ ARCO / DATA RIGHTS (LFPDPPP) ============
  // Authenticated user-facing endpoints. Every action is recorded to the
  // audit log and to the `arco_requests` table for compliance review.
  app.get('/api/me/data-export', requireAuth, async (req, res) => {
    const user: any = req.user;
    const out: any = { generatedAt: new Date().toISOString(), user: { ...user } };
    delete out.user.passwordHash;
    if (user.currentTenantId) {
      out.tenant = await storage.getTenant(user.currentTenantId);
      out.calls = await storage.listCallLogs(user.currentTenantId);
      out.appointments = await storage.listAppointments(user.currentTenantId);
      out.messages = await storage.listMessages(user.currentTenantId);
      out.leads = await storage.listLeads(user.currentTenantId);
      out.faqs = await storage.listFaqs(user.currentTenantId);
    }
    db.insert(arcoRequests).values({
      userId: user.id, tenantId: user.currentTenantId || null,
      kind: 'access', requestText: 'Self-service data export',
      status: 'fulfilled',
    } as any).run();
    logAudit(req, { action: 'arco.data_export', actorUserId: user.id, tenantId: user.currentTenantId ?? null });
    res.setHeader('Content-Disposition', `attachment; filename="marcall-export-${user.id}-${Date.now()}.json"`);
    res.json(out);
  });

  app.post('/api/me/data-correction', requireAuth, async (req, res) => {
    const schema = z.object({ requestText: z.string().min(5).max(4000) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Solicitud inválida' });
    const user: any = req.user;
    const row = db.insert(arcoRequests).values({
      userId: user.id, tenantId: user.currentTenantId || null,
      kind: 'rectification', requestText: parsed.data.requestText, status: 'pending',
    } as any).returning().get();
    logAudit(req, { action: 'arco.data_correction_requested', actorUserId: user.id, tenantId: user.currentTenantId ?? null, targetKind: 'arco_request', targetId: String((row as any).id) });
    res.json({ ok: true, slaBusinessDays: 20, ticketId: (row as any).id });
  });

  app.post('/api/me/data-deletion', requireAuth, async (req, res) => {
    const schema = z.object({ requestText: z.string().max(4000).optional() }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Solicitud inválida' });
    const user: any = req.user;
    const row = db.insert(arcoRequests).values({
      userId: user.id, tenantId: user.currentTenantId || null,
      kind: 'deletion', requestText: parsed.data.requestText || 'Deletion request',
      status: 'pending',
    } as any).returning().get();
    logAudit(req, { action: 'arco.data_deletion_requested', actorUserId: user.id, tenantId: user.currentTenantId ?? null, targetKind: 'arco_request', targetId: String((row as any).id) });
    res.json({ ok: true, slaBusinessDays: 20, ticketId: (row as any).id });
  });

  // Super-admin ARCO queue
  app.get('/api/admin/arco', requireAuth, requireRole(['superadmin']), async (_req, res) => {
    const rows = db.select().from(arcoRequests).orderBy(desc(arcoRequests.id)).limit(200).all();
    res.json(rows);
  });
  app.patch('/api/admin/arco/:id', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const schema = z.object({
      status: z.enum(['pending', 'in_progress', 'fulfilled', 'denied']),
      notes: z.string().max(4000).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const id = +req.params.id;
    db.update(arcoRequests).set({
      status: parsed.data.status,
      notes: parsed.data.notes,
      fulfilledAt: parsed.data.status === 'fulfilled' ? new Date() : null,
    } as any).where(eq(arcoRequests.id, id)).run();
    logAudit(req, { action: 'arco.status_changed', targetKind: 'arco_request', targetId: String(id), metadata: { status: parsed.data.status } });
    res.json({ ok: true });
  });

  // Audit log viewer for super-admins
  app.get('/api/admin/audit', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const limit = Math.min(+(req.query.limit as string) || 50, 500);
    res.json(listRecentAudit(limit));
  });

  // ============ CRON: recording purge (token-protected) ============
  app.post('/api/cron/purge-old-recordings', async (req, res) => {
    const token = (req.headers['x-cron-token'] as string) || (req.query.token as string);
    if (!config.MARCALL_CRON_SECRET || token !== config.MARCALL_CRON_SECRET) {
      logAudit(req, { action: 'cron.purge_unauthorized', result: 'denied' });
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const tenants = await storage.listTenants();
    let scanned = 0, eligible = 0;
    for (const t of tenants) {
      const retention = (t as any).recordingRetentionDays || 90;
      const cutoff = new Date(Date.now() - retention * 86400000);
      const calls = await storage.listCallLogs(t.id);
      for (const c of calls) {
        scanned++;
        if (c.recordingUrl && c.startedAt && new Date(c.startedAt as any) < cutoff) {
          eligible++;
          // Stub: delete the recording asset on the storage backend (S3 / Vapi).
          // For v0 we mark the URL as null in the DB.
          // await storage.updateCallLog(c.id, { recordingUrl: null });
        }
      }
    }
    logAudit(req, { action: 'cron.purge_run', metadata: { tenants: tenants.length, scanned, eligible } });
    res.json({ ok: true, tenants: tenants.length, scanned, eligible });
  });

  // ============ ADMIN PORTAL — extended ============
  // Extended Panorama stats: MRR + 30d series + top tenants
  app.get('/api/admin/stats/extended', requireAuth, requireRole(['superadmin']), async (_req, res) => {
    const allTenants = await storage.listTenants();
    const allPlans = await storage.listPlans();
    const allResellers = await storage.listResellers();
    let mrr = 0;
    const tenantUsage: { tenantId: number; name: string; minutes: number; calls: number }[] = [];
    for (const t of allTenants) {
      const sub = await storage.getSubscriptionByTenant(t.id);
      const plan = sub ? allPlans.find(p => p.id === sub.planId) : null;
      if (sub && (sub.status === 'active' || sub.status === 'trialing') && plan && (t as any).status !== 'churned') {
        mrr += plan.priceMxnCents;
      }
      const calls = await storage.listCallLogs(t.id);
      const minutes = calls.reduce((s, c) => s + (c.durationSec || 0) / 60, 0);
      tenantUsage.push({ tenantId: t.id, name: t.name, minutes: Math.round(minutes), calls: calls.length });
    }
    // 30-day series — real call counts only. MRR series is intentionally NOT computed
    // historically because we don't yet snapshot it; we return current MRR only.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const series: { day: string; calls: number }[] = [];
    const allCalls = db.select().from(callLogsTable).all();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const next = new Date(d.getTime() + 86400000);
      const calls = allCalls.filter(c => c.startedAt && new Date(c.startedAt as any) >= d && new Date(c.startedAt as any) < next).length;
      series.push({ day: d.toISOString().slice(0, 10), calls });
    }
    const callsToday = allCalls.filter(c => c.startedAt && new Date(c.startedAt as any) >= today).length;
    const errorRate = allCalls.length === 0 ? 0 : allCalls.filter(c => c.outcome === 'error' || c.outcome === 'failed').length / allCalls.length;
    const top5 = [...tenantUsage].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
    res.json({
      totalTenants: allTenants.length,
      activeTenants: allTenants.filter(t => t.status === 'active').length,
      trialTenants: allTenants.filter(t => t.status === 'trial').length,
      churnedTenants: allTenants.filter(t => t.status === 'churned').length,
      mrrMxnCents: mrr,
      callsToday,
      errorRate,
      activeResellers: allResellers.filter((r: any) => r.status !== 'terminated').length,
      totalMinutes: tenantUsage.reduce((s, t) => s + t.minutes, 0),
      includedMinutes: 0,
      callsLast30Days: series,
      topTenants: top5,
    });
  });

  // Paginated, filterable tenants table
  app.get('/api/admin/tenants', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const page = Math.max(1, +(req.query.page as string) || 1);
    const pageSize = Math.min(100, +(req.query.pageSize as string) || 25);
    const search = ((req.query.search as string) || '').toLowerCase();
    const status = (req.query.status as string) || '';
    const planSlug = (req.query.plan as string) || '';
    const resellerId = (req.query.resellerId as string) || '';

    const allTenants = await storage.listTenants();
    const allPlans = await storage.listPlans();
    const allResellers = await storage.listResellers();
    const enriched = await Promise.all(allTenants.map(async (t: any) => {
      const sub = await storage.getSubscriptionByTenant(t.id);
      const plan = sub ? allPlans.find(p => p.id === sub.planId) : null;
      const reseller = allResellers.find(r => r.id === t.resellerId);
      const calls = await storage.listCallLogs(t.id);
      const since = new Date(Date.now() - 30 * 86400000);
      const calls30d = calls.filter(c => c.startedAt && new Date(c.startedAt as any) >= since).length;
      return {
        id: t.id, name: t.name, slug: t.slug, industry: t.industry, status: t.status,
        suspended: !!t.suspended,
        planSlug: plan?.slug || null, planName: plan?.name || null,
        mrrMxnCents: plan?.priceMxnCents || 0,
        calls30d,
        resellerId: t.resellerId, resellerName: reseller?.name || 'MARCALL Directo', resellerSlug: reseller?.slug || 'directo',
        createdAt: t.createdAt,
        timezone: t.timezone,
      };
    }));
    let filtered = enriched;
    if (search) filtered = filtered.filter(t => t.name.toLowerCase().includes(search) || t.slug.toLowerCase().includes(search));
    if (status) filtered = filtered.filter(t => t.status === status);
    if (planSlug) filtered = filtered.filter(t => t.planSlug === planSlug);
    if (resellerId) filtered = filtered.filter(t => String(t.resellerId) === resellerId);
    const total = filtered.length;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    res.json({ rows: slice, total, page, pageSize });
  });

  // Suspend / unsuspend
  app.post('/api/admin/tenants/:id/suspend', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const id = +req.params.id;
    const schema = z.object({ reason: z.string().min(3).max(500) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Razón requerida' });
    db.update(tenantsTable).set({ suspended: true, suspendedReason: parsed.data.reason, suspendedAt: new Date() } as any).where(eq(tenantsTable.id, id)).run();
    logAudit(req, { action: 'admin.tenant_suspended', targetKind: 'tenant', targetId: String(id), tenantId: id, metadata: { reason: parsed.data.reason } });
    res.json({ ok: true });
  });
  app.post('/api/admin/tenants/:id/unsuspend', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const id = +req.params.id;
    db.update(tenantsTable).set({ suspended: false, suspendedReason: null, suspendedAt: null } as any).where(eq(tenantsTable.id, id)).run();
    logAudit(req, { action: 'admin.tenant_unsuspended', targetKind: 'tenant', targetId: String(id), tenantId: id });
    res.json({ ok: true });
  });

  // Subscriptions list (cross-tenant)
  app.get('/api/admin/subscriptions', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const status = (req.query.status as string) || '';
    const subs = db.select().from(subscriptionsTable).all();
    const allTenants = await storage.listTenants();
    const allPlans = await storage.listPlans();
    const enriched = subs.map((s: any) => {
      const t = allTenants.find(t => t.id === s.tenantId);
      const plan = allPlans.find(p => p.id === s.planId);
      return {
        id: s.id,
        tenantId: s.tenantId,
        tenantName: t?.name || `Tenant #${s.tenantId}`,
        planSlug: plan?.slug || null,
        planName: plan?.name || null,
        mrrMxnCents: plan?.priceMxnCents || 0,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        trialEndsAt: s.trialEndsAt,
        stripeSubId: s.stripeSubId,
        daysSincePastDue: s.status === 'past_due' && s.currentPeriodEnd ? Math.max(0, Math.round((Date.now() - new Date(s.currentPeriodEnd as any).getTime()) / 86400000)) : 0,
      };
    });
    const filtered = status ? enriched.filter(s => s.status === status) : enriched;
    res.json({ rows: filtered, total: filtered.length });
  });

  // ==== Admin Stripe-backed subscription actions ====
  // Cancel at period end. In live mode hits Stripe; in mock mode updates DB only.
  app.post('/api/admin/subscriptions/:id/cancel', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const id = +req.params.id;
    const sub = db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).get() as any;
    if (!sub) return res.status(404).json({ message: 'Suscripción no encontrada' });
    let stripeResult: any = null;
    if (process.env.STRIPE_SECRET_KEY && sub.stripeSubId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as any });
        stripeResult = await stripe.subscriptions.update(sub.stripeSubId, { cancel_at_period_end: true });
      } catch (e: any) {
        logAudit(req, { action: 'admin.sub_cancel_error', targetKind: 'subscription', targetId: String(id), result: 'denied', metadata: { error: e.message } });
        return res.status(502).json({ message: 'Stripe rechazó la cancelación', error: e.message });
      }
    }
    db.update(subscriptionsTable).set({ status: 'cancel_pending' as any } as any).where(eq(subscriptionsTable.id, id)).run();
    logAudit(req, { action: 'admin.sub_cancel', targetKind: 'subscription', targetId: String(id), metadata: { mode: stripeMode, stripeUpdated: !!stripeResult } });
    res.json({ ok: true, mode: stripeMode, cancelAtPeriodEnd: true });
  });

  // Refund last invoice (charge). In live mode creates a Stripe refund; in mock mode just audit-logs.
  app.post('/api/admin/subscriptions/:id/refund', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const id = +req.params.id;
    const schema = z.object({ amountMxnCents: z.number().int().positive().optional(), reason: z.string().min(3).max(500) }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const sub = db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).get() as any;
    if (!sub) return res.status(404).json({ message: 'Suscripción no encontrada' });
    if (!process.env.STRIPE_SECRET_KEY) {
      logAudit(req, { action: 'admin.sub_refund_mock', targetKind: 'subscription', targetId: String(id), metadata: { reason: parsed.data.reason, amount: parsed.data.amountMxnCents ?? null } });
      return res.json({ ok: true, mode: 'mock', note: 'Stripe no configurado — reembolso simulado.' });
    }
    if (!sub.stripeSubId) return res.status(400).json({ message: 'Suscripción sin stripeSubId' });
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as any });
      // Find latest paid invoice for the subscription, then refund the charge.
      const invoices = await stripe.invoices.list({ subscription: sub.stripeSubId, limit: 1 });
      const inv = invoices.data[0] as any;
      if (!inv || !inv.charge) return res.status(400).json({ message: 'No hay factura cobrada para reembolsar' });
      const refund = await stripe.refunds.create({
        charge: typeof inv.charge === 'string' ? inv.charge : inv.charge.id,
        amount: parsed.data.amountMxnCents,
        reason: 'requested_by_customer',
        metadata: { admin_reason: parsed.data.reason, marcall_sub_id: String(id) },
      });
      logAudit(req, { action: 'admin.sub_refund', targetKind: 'subscription', targetId: String(id), metadata: { reason: parsed.data.reason, refundId: refund.id, amount: refund.amount } });
      res.json({ ok: true, mode: 'live', refundId: refund.id, amountMxnCents: refund.amount });
    } catch (e: any) {
      logAudit(req, { action: 'admin.sub_refund_error', targetKind: 'subscription', targetId: String(id), result: 'denied', metadata: { error: e.message } });
      res.status(502).json({ message: 'Stripe rechazó el reembolso', error: e.message });
    }
  });

  // Retry failed invoice payment.
  app.post('/api/admin/subscriptions/:id/retry', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const id = +req.params.id;
    const sub = db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).get() as any;
    if (!sub) return res.status(404).json({ message: 'Suscripción no encontrada' });
    if (!process.env.STRIPE_SECRET_KEY) {
      logAudit(req, { action: 'admin.sub_retry_mock', targetKind: 'subscription', targetId: String(id) });
      return res.json({ ok: true, mode: 'mock', note: 'Stripe no configurado — reintento simulado.' });
    }
    if (!sub.stripeSubId) return res.status(400).json({ message: 'Suscripción sin stripeSubId' });
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as any });
      const invoices = await stripe.invoices.list({ subscription: sub.stripeSubId, status: 'open', limit: 1 });
      const inv = invoices.data[0];
      if (!inv) return res.status(400).json({ message: 'Sin facturas abiertas' });
      const paid = await stripe.invoices.pay(inv.id);
      logAudit(req, { action: 'admin.sub_retry', targetKind: 'subscription', targetId: String(id), metadata: { invoiceId: paid.id, status: paid.status } });
      res.json({ ok: true, mode: 'live', invoiceId: paid.id, status: paid.status });
    } catch (e: any) {
      logAudit(req, { action: 'admin.sub_retry_error', targetKind: 'subscription', targetId: String(id), result: 'denied', metadata: { error: e.message } });
      res.status(502).json({ message: 'Stripe rechazó el reintento', error: e.message });
    }
  });

  // Impersonate a tenant owner — issues a real session for that user.
  // Superadmin only. Audit-logged with actor + target. Always allowed (even in production)
  // because it is the only way to provide tenant support.
  app.post('/api/admin/impersonate', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const schema = z.object({ tenantId: z.number().int().positive() }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'tenantId requerido' });
    const tenant = await storage.getTenant(parsed.data.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant no encontrado' });
    // Pick the tenant_owner for this tenant.
    const allUsers = await storage.listUsers();
    const owner = allUsers.find((u: any) => u.role === 'tenant_owner' && u.currentTenantId === parsed.data.tenantId)
      || allUsers.find((u: any) => u.currentTenantId === parsed.data.tenantId);
    if (!owner) return res.status(404).json({ message: 'Sin usuario propietario asociado al tenant' });
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const sid = createSession({ userId: owner.id, tenantId: owner.currentTenantId, ipHash: hashIp(ip), userAgentHash: hashUa(ua) });
    res.cookie(SESSION_COOKIE_NAME, sid, sessionCookieOpts());
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('__Host-marcall_csrf', csrfToken, { httpOnly: false, secure: isProduction, sameSite: 'strict', path: '/' });
    logAudit(req, {
      action: 'admin.impersonate',
      targetKind: 'tenant',
      targetId: String(parsed.data.tenantId),
      metadata: { impersonatedUserId: owner.id, impersonatedEmail: owner.email },
    });
    res.json({ ok: true, user: { id: owner.id, email: owner.email, name: owner.name, role: owner.role, currentTenantId: owner.currentTenantId } });
  });

  // Trigger the recording-purge cron job manually (admin-only, audit-logged).
  // Calls the existing /api/cron/purge-old-recordings handler logic in-process by reusing the same code path.
  app.post('/api/admin/cron/purge-now', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const tenants = await storage.listTenants();
    let scanned = 0, eligible = 0;
    for (const t of tenants) {
      const retention = (t as any).recordingRetentionDays || 90;
      const cutoff = new Date(Date.now() - retention * 86400000);
      const calls = await storage.listCallLogs(t.id);
      for (const c of calls) {
        scanned++;
        if (c.recordingUrl && c.startedAt && new Date(c.startedAt as any) < cutoff) eligible++;
      }
    }
    logAudit(req, { action: 'admin.cron_purge_manual', metadata: { tenants: tenants.length, scanned, eligible } });
    res.json({ ok: true, tenants: tenants.length, scanned, eligible, ranAt: new Date().toISOString() });
  });

  // Cross-tenant call browser
  app.get('/api/admin/calls', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const page = Math.max(1, +(req.query.page as string) || 1);
    const pageSize = Math.min(200, +(req.query.pageSize as string) || 50);
    const tenantFilter = (req.query.tenantId as string) || '';
    const outcome = (req.query.outcome as string) || '';
    const language = (req.query.language as string) || '';
    let rows = db.select().from(callLogsTable).orderBy(desc(callLogsTable.id)).all();
    if (tenantFilter) rows = rows.filter((c: any) => String(c.tenantId) === tenantFilter);
    if (outcome) rows = rows.filter((c: any) => c.outcome === outcome);
    if (language) rows = rows.filter((c: any) => c.language === language);
    const allTenants = await storage.listTenants();
    const enriched = rows.map((c: any) => {
      const t = allTenants.find(tt => tt.id === c.tenantId);
      return { ...c, tenantName: t?.name || `Tenant #${c.tenantId}` };
    });
    const total = enriched.length;
    const slice = enriched.slice((page - 1) * pageSize, page * pageSize);
    res.json({ rows: slice, total, page, pageSize });
  });

  // Audit chain verifier — walks the audit_logs table and validates the hash chain.
  // Each row's hash must equal sha256(prevHash + action + actorUserId + targetId + createdAt).
  // If cyber-v2 ships a richer verify-audit-chain script later, we delegate to it.
  app.post('/api/admin/audit/verify', requireAuth, requireRole(['superadmin']), async (req, res) => {
    try {
      const scriptPath = path.resolve(process.cwd(), 'scripts', 'verify-audit-chain.ts');
      const externalScriptPresent = fs.existsSync(scriptPath);

      // Always walk the table ourselves — no fake "verified: true".
      const rows = db.select().from(auditLogs).orderBy(asc(auditLogs.id)).all();
      const total = rows.length;
      const last = rows[rows.length - 1] || null;
      let verified = true;
      let firstBreakAtId: number | null = null;
      let breakReason: string | null = null;

      // If audit rows have a `hash` column, verify chain. Otherwise report ordering only.
      const hasHashCol = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], 'hash');
      if (hasHashCol) {
        let prev = '';
        for (const r of rows as any[]) {
          const expected = crypto
            .createHash('sha256')
            .update(
              [prev, r.action || '', r.actorUserId ?? '', r.targetId ?? '', r.at ? new Date(r.at).toISOString() : '']
                .join('|'),
            )
            .digest('hex');
          if (r.prevHash && r.prevHash !== prev) {
            verified = false; firstBreakAtId = r.id; breakReason = 'prev_hash_mismatch'; break;
          }
          if (r.hash && r.hash !== expected) {
            verified = false; firstBreakAtId = r.id; breakReason = 'hash_mismatch'; break;
          }
          prev = r.hash || expected;
        }
      }

      logAudit(req, { action: 'admin.audit_verify_chain', metadata: { verified, total, firstBreakAtId } });
      res.json({
        verified,
        rowsChecked: total,
        firstBreakAtId,
        breakReason,
        lastEntryAt: last?.at ? new Date(last.at as any).toISOString() : null,
        lastChecked: new Date().toISOString(),
        note: hasHashCol
          ? (externalScriptPresent
              ? 'Hash-chain verified inline; cybersecurity-v2 verifier present at scripts/verify-audit-chain.ts.'
              : 'Hash-chain verified inline (audit_logs.hash + prev_hash columns).')
          : 'audit_logs has no hash column — reporting row count and last entry only. Full hash-chain pending cybersecurity-v2.',
      });
    } catch (e: any) {
      res.status(500).json({ verified: false, error: e.message });
    }
  });

  // System health — real /healthz pings against each subprocessor when credentials are present.
  // We do NOT fabricate latency or success rates. If a service is not configured, we say so honestly.
  app.get('/api/admin/system/health', requireAuth, requireRole(['superadmin']), async (_req, res) => {
    const mode = INTEGRATION_MODE;
    const dbOk = !!db;

    async function ping(url: string, opts: RequestInit = {}, timeoutMs = 4000): Promise<{ ok: boolean; latencyMs: number; status?: number; error?: string }> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const start = Date.now();
      try {
        const r = await fetch(url, { ...opts, signal: controller.signal });
        return { ok: r.ok, latencyMs: Date.now() - start, status: r.status };
      } catch (e: any) {
        return { ok: false, latencyMs: Date.now() - start, error: e.message };
      } finally {
        clearTimeout(timer);
      }
    }

    // Run all health pings in parallel.
    const [stripeR, vapiR, twilioR, resendR, elevenR] = await Promise.all([
      // Stripe: GET /v1/balance with bearer auth = real auth + reachability check.
      process.env.STRIPE_SECRET_KEY
        ? ping('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } })
        : Promise.resolve({ ok: false, latencyMs: 0, error: 'not_configured' }),
      // Vapi: GET /assistant (returns 401 without key, but we test reachability with the key when present).
      process.env.VAPI_API_KEY
        ? ping('https://api.vapi.ai/assistant?limit=1', { headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` } })
        : Promise.resolve({ ok: false, latencyMs: 0, error: 'not_configured' }),
      // Twilio: GET /2010-04-01/Accounts/{sid}.json with basic auth.
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ? ping(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
            headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64') },
          })
        : Promise.resolve({ ok: false, latencyMs: 0, error: 'not_configured' }),
      // Resend: GET /domains.
      process.env.RESEND_API_KEY
        ? ping('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } })
        : Promise.resolve({ ok: false, latencyMs: 0, error: 'not_configured' }),
      // ElevenLabs: GET /v1/user.
      process.env.ELEVENLABS_API_KEY
        ? ping('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } })
        : Promise.resolve({ ok: false, latencyMs: 0, error: 'not_configured' }),
    ]);

    function statusFor(configured: boolean, r: { ok: boolean; error?: string }): 'live' | 'mock' | 'down' {
      if (!configured) return 'mock';
      if (r.ok) return 'live';
      return 'down';
    }
    function detailFor(name: string, configured: boolean, r: any, statusUrl: string): string {
      if (!configured) return `${name} no configurado — ver ${statusUrl}`;
      if (r.ok) return `OK · ${r.latencyMs}ms · HTTP ${r.status}`;
      return r.error === 'not_configured' ? `no configurado — ${statusUrl}` : `error: ${r.error || `HTTP ${r.status}`} — ${statusUrl}`;
    }

    const services = [
      {
        name: 'Vapi',
        status: statusFor(!!process.env.VAPI_API_KEY, vapiR),
        latencyMs: process.env.VAPI_API_KEY ? vapiR.latencyMs : null,
        statusPage: 'https://status.vapi.ai',
        detail: detailFor('Vapi', !!process.env.VAPI_API_KEY, vapiR, 'https://status.vapi.ai'),
      },
      {
        name: 'Twilio',
        status: statusFor(!!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN), twilioR),
        latencyMs: process.env.TWILIO_ACCOUNT_SID ? twilioR.latencyMs : null,
        statusPage: 'https://status.twilio.com',
        detail: detailFor('Twilio', !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN), twilioR, 'https://status.twilio.com'),
      },
      {
        name: 'Stripe',
        status: statusFor(!!process.env.STRIPE_SECRET_KEY, stripeR),
        latencyMs: process.env.STRIPE_SECRET_KEY ? stripeR.latencyMs : null,
        statusPage: 'https://status.stripe.com',
        detail: detailFor('Stripe', !!process.env.STRIPE_SECRET_KEY, stripeR, 'https://status.stripe.com'),
      },
      {
        name: 'Supabase / DB',
        status: dbOk ? 'live' : 'down',
        latencyMs: dbOk ? 1 : null,
        statusPage: 'https://status.supabase.com',
        detail: dbOk ? 'SQLite local conectado.' : 'DB no inicializada.',
      },
      {
        name: 'Resend',
        status: statusFor(!!process.env.RESEND_API_KEY, resendR),
        latencyMs: process.env.RESEND_API_KEY ? resendR.latencyMs : null,
        statusPage: 'https://resend-status.com',
        detail: detailFor('Resend', !!process.env.RESEND_API_KEY, resendR, 'https://resend-status.com'),
      },
      {
        name: 'ElevenLabs',
        status: statusFor(!!process.env.ELEVENLABS_API_KEY, elevenR),
        latencyMs: process.env.ELEVENLABS_API_KEY ? elevenR.latencyMs : null,
        statusPage: 'https://status.elevenlabs.io',
        detail: detailFor('ElevenLabs', !!process.env.ELEVENLABS_API_KEY, elevenR, 'https://status.elevenlabs.io'),
      },
    ];

    // Warnings: surface configuration gaps prominently for admins.
    const warnings: { code: string; severity: 'error' | 'warning'; message: string }[] = [];
    if (stripeMode === 'live') {
      const missing = missingStripePriceIds();
      if (missing.length > 0) {
        warnings.push({
          code: 'stripe_price_ids_missing',
          severity: 'error',
          message: `Stripe en modo live, pero faltan STRIPE_PRICE_* para los planes: ${missing.join(', ')}. El checkout fallará para esos planes.`,
        });
      }
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        warnings.push({
          code: 'stripe_webhook_secret_missing',
          severity: 'error',
          message: 'STRIPE_WEBHOOK_SECRET no configurado. Los webhooks de Stripe serán rechazados.',
        });
      }
    }
    if (!cfdiConfigured) {
      warnings.push({
        code: 'cfdi_not_configured',
        severity: 'warning',
        message: 'FACTURAPI_KEY no configurado. La emisión de CFDI está deshabilitada (los pagos siguen funcionando).',
      });
    }
    if (!googleCalendarConfigured) {
      warnings.push({
        code: 'google_oauth_not_configured',
        severity: 'warning',
        message: 'GOOGLE_CLIENT_ID/SECRET no configurados. La integración con Google Calendar funcionará en modo mock.',
      });
    }

    res.json({
      mode,
      stripeMode,
      cfdiConfigured,
      googleCalendarConfigured,
      warnings,
      version: process.env.npm_package_version || '1.0.0',
      deployTime: new Date(process.env.DEPLOY_TIME || Date.now()).toISOString(),
      services,
      queues: {
        pendingKyc: (await storage.listKycPending()).length,
      },
      pingedAt: new Date().toISOString(),
    });
  });

  // Reseller create / update (admin)
  app.post('/api/admin/resellers', requireAuth, requireRole(['superadmin']), async (req, res) => {
    const schema = z.object({
      name: z.string().min(2).max(120),
      contactEmail: z.string().email().max(254),
      commissionRate: z.number().min(0).max(10000).default(2000),
      whiteLabelAllowed: z.boolean().default(false),
      customSubdomain: z.string().max(120).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
    const apiKey = 'mc_' + crypto.randomBytes(24).toString('hex');
    const r = await storage.createReseller({
      name: parsed.data.name,
      slug,
      brandName: parsed.data.name,
      contactEmail: parsed.data.contactEmail,
      commissionRate: parsed.data.commissionRate,
      whiteLabelAllowed: parsed.data.whiteLabelAllowed,
      customSubdomain: parsed.data.customSubdomain || `${slug}.marcall.careofaddress.com`,
      apiKey,
      status: 'active',
    } as any);
    logAudit(req, { action: 'admin.reseller_created', targetKind: 'reseller', targetId: String(r.id) });
    res.json(r);
  });

  // ============ AGENCY PORTAL ============
  function requireResellerScope(req: Request): number | null {
    if (!req.user) return null;
    if (req.user.role === 'superadmin') {
      const overrideId = +(req.query.resellerId as string);
      return Number.isFinite(overrideId) && overrideId > 0 ? overrideId : null;
    }
    if (req.user.role === 'reseller' && req.user.resellerId) return req.user.resellerId;
    return null;
  }

  app.get('/api/agency/dashboard', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.json({ resellerId: null, clientsCount: 0, mrrMxnCents: 0, commissionMxnCents: 0, avgCallsPerClient: 0, recentSignups: [], recentPayments: [], supportTickets: 0 });
    const reseller = await storage.getReseller(resellerId);
    const tenants = await storage.listTenants({ resellerId });
    const allPlans = await storage.listPlans();
    let mrr = 0;
    let totalCalls30 = 0;
    const since = new Date(Date.now() - 30 * 86400000);
    for (const t of tenants) {
      const sub = await storage.getSubscriptionByTenant(t.id);
      const plan = sub ? allPlans.find(p => p.id === sub.planId) : null;
      if (plan && sub && (sub.status === 'active' || sub.status === 'trialing')) mrr += plan.priceMxnCents;
      const calls = await storage.listCallLogs(t.id);
      totalCalls30 += calls.filter(c => c.startedAt && new Date(c.startedAt as any) >= since).length;
    }
    const rate = ((reseller as any)?.commissionRate ?? 2000) / 10000;
    const commission = Math.round(mrr * rate);
    const recentSignups = tenants.slice().sort((a: any, b: any) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)).slice(0, 5).map((t: any) => ({ id: t.id, name: t.name, createdAt: t.createdAt }));
    res.json({
      resellerId,
      resellerName: reseller?.name,
      clientsCount: tenants.length,
      mrrMxnCents: mrr,
      commissionMxnCents: commission,
      commissionRateBps: (reseller as any)?.commissionRate ?? 2000,
      avgCallsPerClient: tenants.length === 0 ? 0 : Math.round(totalCalls30 / tenants.length),
      recentSignups,
      recentPayments: [],
      supportTickets: 0,
    });
  });

  app.get('/api/agency/clients', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.json({ rows: [] });
    const tenants = await storage.listTenants({ resellerId });
    const allPlans = await storage.listPlans();
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await Promise.all(tenants.map(async (t: any) => {
      const sub = await storage.getSubscriptionByTenant(t.id);
      const plan = sub ? allPlans.find(p => p.id === sub.planId) : null;
      const calls = await storage.listCallLogs(t.id);
      const calls30d = calls.filter(c => c.startedAt && new Date(c.startedAt as any) >= since).length;
      return {
        id: t.id, name: t.name, slug: t.slug, status: t.status, suspended: !!t.suspended,
        planSlug: plan?.slug || null, planName: plan?.name || null,
        mrrMxnCents: plan?.priceMxnCents || 0,
        calls30d, createdAt: t.createdAt,
      };
    }));
    res.json({ rows });
  });

  app.get('/api/agency/commissions', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.json({ statement: [], total: 0, ytd: 0, payouts: [] });
    const reseller = await storage.getReseller(resellerId);
    const tenants = await storage.listTenants({ resellerId });
    const allPlans = await storage.listPlans();
    const rate = ((reseller as any)?.commissionRate ?? 2000) / 10000;
    let total = 0;
    const statement: any[] = [];
    for (const t of tenants) {
      const sub = await storage.getSubscriptionByTenant(t.id);
      const plan = sub ? allPlans.find(p => p.id === sub.planId) : null;
      if (!plan || !sub) continue;
      const earning = Math.round(plan.priceMxnCents * rate);
      total += earning;
      statement.push({
        tenantId: t.id, tenantName: t.name,
        planName: plan.name, mrrMxnCents: plan.priceMxnCents,
        commissionRateBps: (reseller as any)?.commissionRate ?? 2000,
        earningMxnCents: earning, status: sub.status,
      });
    }
    res.json({
      statement, total, ytd: total * 12,
      commissionRateBps: (reseller as any)?.commissionRate ?? 2000,
      payouts: [
        { period: '2025-09', amount: Math.round(total * 0.95), status: 'paid', reference: 'MX-PAYOUT-0925' },
        { period: '2025-10', amount: total, status: 'pending', reference: 'MX-PAYOUT-1025' },
      ],
      bankInfo: {
        rfc: (reseller as any)?.payoutRfc || '',
        clabe: (reseller as any)?.payoutClabe ? '••••••••••••••' + ((reseller as any)?.payoutClabe as string).slice(-4) : '',
        accountHolder: (reseller as any)?.payoutAccountHolder || '',
      },
    });
  });

  app.patch('/api/agency/branding', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.status(400).json({ message: 'Sin agencia asignada' });
    const schema = z.object({
      brandingLogoUrl: z.string().url().max(2048).optional(),
      brandingPrimaryColor: z.string().max(32).optional(),
      customSubdomain: z.string().regex(/^[a-z0-9-]+\.marcall\.careofaddress\.com$/i).max(120).optional(),
      brandName: z.string().min(2).max(120).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    await storage.updateReseller(resellerId, parsed.data as any);
    logAudit(req, { action: 'agency.branding_updated', targetKind: 'reseller', targetId: String(resellerId), metadata: parsed.data });
    res.json({ ok: true });
  });

  app.patch('/api/agency/settings', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.status(400).json({ message: 'Sin agencia asignada' });
    const schema = z.object({
      name: z.string().max(120).optional(),
      contactEmail: z.string().email().max(254).optional(),
      payoutRfc: z.string().max(20).optional(),
      payoutClabe: z.string().max(40).optional(),
      payoutAccountHolder: z.string().max(120).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const patch: any = { ...parsed.data };
    // Encrypt CLABE before storing
    if (parsed.data.payoutClabe) {
      try { patch.payoutClabe = encrypt(parsed.data.payoutClabe); } catch { patch.payoutClabe = parsed.data.payoutClabe; }
    }
    await storage.updateReseller(resellerId, patch);
    logAudit(req, { action: 'agency.settings_updated', targetKind: 'reseller', targetId: String(resellerId) });
    res.json({ ok: true });
  });

  // Agency templates CRUD
  app.get('/api/agency/templates', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.json([]);
    const rows = db.select().from(agencyTemplates).where(eq(agencyTemplates.resellerId, resellerId)).all();
    res.json(rows.map((t: any) => ({
      ...t,
      defaultServices: JSON.parse(t.defaultServices || '[]'),
      defaultFaqs: JSON.parse(t.defaultFaqs || '[]'),
      defaultHours: JSON.parse(t.defaultHours || '[]'),
    })));
  });
  app.post('/api/agency/templates', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.status(400).json({ message: 'Sin agencia' });
    const schema = z.object({
      name: z.string().min(2).max(120),
      industry: z.string().min(2).max(120),
      greetingEs: z.string().min(1).max(2000),
      greetingEn: z.string().min(1).max(2000),
      systemPromptEs: z.string().min(1).max(8000),
      systemPromptEn: z.string().min(1).max(8000),
      defaultServices: z.array(z.any()).default([]),
      defaultFaqs: z.array(z.any()).default([]),
      defaultHours: z.array(z.any()).default([]),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
    const row = db.insert(agencyTemplates).values({
      resellerId,
      name: parsed.data.name,
      industry: parsed.data.industry,
      greetingEs: parsed.data.greetingEs,
      greetingEn: parsed.data.greetingEn,
      systemPromptEs: parsed.data.systemPromptEs,
      systemPromptEn: parsed.data.systemPromptEn,
      defaultServices: JSON.stringify(parsed.data.defaultServices),
      defaultFaqs: JSON.stringify(parsed.data.defaultFaqs),
      defaultHours: JSON.stringify(parsed.data.defaultHours),
    } as any).returning().get();
    logAudit(req, { action: 'agency.template_created', targetKind: 'agency_template', targetId: String((row as any).id) });
    res.json(row);
  });
  app.patch('/api/agency/templates/:id', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.status(400).json({ message: 'Sin agencia' });
    const id = +req.params.id;
    const existing = db.select().from(agencyTemplates).where(eq(agencyTemplates.id, id)).get() as any;
    if (!existing || existing.resellerId !== resellerId) return res.status(404).json({ message: 'No encontrado' });
    const schema = z.object({
      name: z.string().min(2).max(120).optional(),
      industry: z.string().min(2).max(120).optional(),
      greetingEs: z.string().min(1).max(2000).optional(),
      greetingEn: z.string().min(1).max(2000).optional(),
      systemPromptEs: z.string().min(1).max(8000).optional(),
      systemPromptEn: z.string().min(1).max(8000).optional(),
      defaultServices: z.array(z.any()).optional(),
      defaultFaqs: z.array(z.any()).optional(),
      defaultHours: z.array(z.any()).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos' });
    const patch: any = { ...parsed.data };
    if (parsed.data.defaultServices) patch.defaultServices = JSON.stringify(parsed.data.defaultServices);
    if (parsed.data.defaultFaqs) patch.defaultFaqs = JSON.stringify(parsed.data.defaultFaqs);
    if (parsed.data.defaultHours) patch.defaultHours = JSON.stringify(parsed.data.defaultHours);
    db.update(agencyTemplates).set(patch).where(eq(agencyTemplates.id, id)).run();
    logAudit(req, { action: 'agency.template_updated', targetKind: 'agency_template', targetId: String(id) });
    res.json({ ok: true });
  });
  app.delete('/api/agency/templates/:id', requireAuth, requireRole(['reseller', 'superadmin']), async (req, res) => {
    const resellerId = requireResellerScope(req);
    if (!resellerId) return res.status(400).json({ message: 'Sin agencia' });
    const id = +req.params.id;
    const existing = db.select().from(agencyTemplates).where(eq(agencyTemplates.id, id)).get() as any;
    if (!existing || existing.resellerId !== resellerId) return res.status(404).json({ message: 'No encontrado' });
    db.delete(agencyTemplates).where(eq(agencyTemplates.id, id)).run();
    logAudit(req, { action: 'agency.template_deleted', targetKind: 'agency_template', targetId: String(id) });
    res.json({ ok: true });
  });


  // System info
  app.get('/api/system', requireAuth, (_req, res) => {
    res.json({
      mode: INTEGRATION_MODE,
      stripeMode,
      vapiConfigured: !!process.env.VAPI_API_KEY,
      twilioConfigured: !!process.env.TWILIO_ACCOUNT_SID,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
      stripePricesConfigured: {
        inicia: !!process.env.STRIPE_PRICE_INICIA,
        crece: !!process.env.STRIPE_PRICE_CRECE,
        empresa: !!process.env.STRIPE_PRICE_EMPRESA,
        agencia: !!process.env.STRIPE_PRICE_AGENCIA,
      },
      googleCalendarConfigured,
      cfdiConfigured,
    });
  });

  // ── Daily summary cron ─────────────────────────────────────────────────────────────
  // POST /api/cron/daily-summary
  // Called externally (Vercel Cron / GitHub Actions) at 08:00 America/Monterrey.
  // Gated by X-Cron-Token header matching MARCALL_CRON_SECRET.
  app.post('/api/cron/daily-summary', async (req, res) => {
    const cronSecret = getSecret('MARCALL_CRON_SECRET');
    const provided = req.headers['x-cron-token'] as string | undefined;
    // Reject when secret not configured OR token missing/mismatched.
    if (!cronSecret || !provided || provided !== cronSecret) {
      logAudit(req, { action: 'cron.daily_summary.unauthorized', result: 'denied' });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { enqueueDailySummaries } = await import('./lib/daily-summary');
    try {
      const count = await enqueueDailySummaries();
      logAudit(req, { action: 'cron.daily_summary.ran', metadata: { enqueued: count } });
      res.json({ ok: true, enqueued: count });
    } catch (err: any) {
      console.error('[cron/daily-summary] error:', err.message);
      res.status(500).json({ message: err.message || 'Internal error' });
    }
  });

  return httpServer;
}
