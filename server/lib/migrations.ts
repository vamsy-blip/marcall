import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Idempotent runtime schema migrations for SQLite.
 *
 * On first boot (empty DB), apply the Drizzle-generated initial migration
 * which CREATEs every table from `shared/schema.ts`. Then run the additive
 * ALTER TABLE / CREATE TABLE IF NOT EXISTS statements below to bring older
 * databases up to the current schema. Both phases are idempotent.
 *
 * Production note: with Postgres + Drizzle migrations these are formal SQL
 * files; SQLite's looser DDL lets us apply them at startup safely.
 */
function applyInitialDrizzleMigration(sqlite: Database.Database) {
  // Skip if the schema already has the core tables (db was created by an
  // earlier `drizzle-kit push` during local development).
  const hasUsers = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  if (hasUsers) return;

  // Look for the migration file in a few locations: bundled into the runner
  // image at /app/migrations, alongside cwd in dev, or two dirs up if cwd is
  // /app/server.
  const candidates = [
    path.resolve(process.cwd(), 'migrations', '0000_initial.sql'),
    path.resolve(process.cwd(), '..', 'migrations', '0000_initial.sql'),
    path.resolve('/app/migrations/0000_initial.sql'),
  ];
  const file = candidates.find(p => fs.existsSync(p));
  if (!file) {
    console.error('[migrations] initial bootstrap file not found in', candidates);
    return;
  }
  const sql = fs.readFileSync(file, 'utf-8');
  // Drizzle uses `--> statement-breakpoint` between statements.
  const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  console.log(`[migrations] applying initial schema (${stmts.length} statements) from ${file}`);
  for (const stmt of stmts) {
    try {
      sqlite.exec(stmt);
    } catch (e) {
      // Tolerate "already exists" — some dev DBs may have a few tables.
      const msg = (e as Error).message || '';
      if (!/already exists/i.test(msg)) {
        console.error('[migrations] initial-stmt failed:', msg, stmt.slice(0, 80));
      }
    }
  }
}

export function runMigrations(sqlite: Database.Database) {
  applyInitialDrizzleMigration(sqlite);

  const exec = (sql: string) => {
    try {
      sqlite.exec(sql);
    } catch (e) {
      // Ignore "duplicate column" errors from ALTER TABLE retries
      const msg = (e as Error).message || '';
      if (!/duplicate column|already exists/i.test(msg)) {
        console.error('[migrations] error running:', sql, msg);
      }
    }
  };

  // audit_logs
  exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER,
    actor_user_id INTEGER,
    actor_ip TEXT,
    tenant_id INTEGER,
    action TEXT NOT NULL,
    target_kind TEXT,
    target_id TEXT,
    metadata TEXT,
    result TEXT NOT NULL DEFAULT 'success'
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs(at)`);
  exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id)`);

  // v2: tamper-evident hash chain columns
  exec(`ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT`);
  exec(`ALTER TABLE audit_logs ADD COLUMN hash TEXT`);

  // arco_requests
  exec(`CREATE TABLE IF NOT EXISTS arco_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER,
    kind TEXT NOT NULL,
    request_text TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER,
    fulfilled_at INTEGER,
    notes TEXT
  )`);

  // users column adds
  exec(`ALTER TABLE users ADD COLUMN last_login_at INTEGER`);
  exec(`ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0`);

  // v2: MFA columns
  exec(`ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0`);
  exec(`ALTER TABLE users ADD COLUMN mfa_secret TEXT`);
  exec(`ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT`);

  // tenants column adds
  exec(`ALTER TABLE tenants ADD COLUMN recording_enabled INTEGER NOT NULL DEFAULT 1`);
  exec(`ALTER TABLE tenants ADD COLUMN recording_retention_days INTEGER NOT NULL DEFAULT 90`);

  // v2: SQLite-backed sessions table (Control 3)
  exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER,
    ip_hash TEXT,
    user_agent_hash TEXT,
    created_at INTEGER,
    last_seen_at INTEGER,
    expires_at INTEGER NOT NULL,
    absolute_expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);

  // tenant_api_keys
  exec(`CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    hash TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'read',
    created_at INTEGER,
    last_used_at INTEGER,
    revoked_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tid ON tenant_api_keys(tenant_id)`);

  // messages: status, intent, audio_url
  exec(`ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new'`);
  exec(`ALTER TABLE messages ADD COLUMN intent TEXT`);
  exec(`ALTER TABLE messages ADD COLUMN audio_url TEXT`);

  // leads: stage, source, notes, assigned_user_id
  exec(`ALTER TABLE leads ADD COLUMN stage TEXT NOT NULL DEFAULT 'new'`);
  exec(`ALTER TABLE leads ADD COLUMN source TEXT`);
  exec(`ALTER TABLE leads ADD COLUMN notes TEXT`);
  exec(`ALTER TABLE leads ADD COLUMN assigned_user_id INTEGER`);

  // Tenant suspension columns (admin portal)
  exec(`ALTER TABLE tenants ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0`);
  exec(`ALTER TABLE tenants ADD COLUMN suspended_reason TEXT`);
  exec(`ALTER TABLE tenants ADD COLUMN suspended_at INTEGER`);

  // Reseller white-label / payout columns (agency portal)
  exec(`ALTER TABLE resellers ADD COLUMN contact_email TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  exec(`ALTER TABLE resellers ADD COLUMN branding_logo_url TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN branding_primary_color TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN custom_subdomain TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN commission_rate_bps INTEGER NOT NULL DEFAULT 2000`);
  exec(`ALTER TABLE resellers ADD COLUMN payout_clabe TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN payout_account_holder TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN payout_rfc TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN api_key TEXT`);
  exec(`ALTER TABLE resellers ADD COLUMN white_label_allowed INTEGER NOT NULL DEFAULT 0`);

  // email_outbox (notifications layer)
  exec(`CREATE TABLE IF NOT EXISTS email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    user_id INTEGER,
    type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER,
    created_at INTEGER,
    sent_at INTEGER,
    last_error TEXT
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status, next_attempt_at)`);
  exec(`CREATE INDEX IF NOT EXISTS idx_email_outbox_tenant ON email_outbox(tenant_id)`);

  // agency_templates table
  exec(`CREATE TABLE IF NOT EXISTS agency_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reseller_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    greeting_es TEXT NOT NULL,
    greeting_en TEXT NOT NULL,
    system_prompt_es TEXT NOT NULL,
    system_prompt_en TEXT NOT NULL,
    default_services TEXT NOT NULL DEFAULT '[]',
    default_faqs TEXT NOT NULL DEFAULT '[]',
    default_hours TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_agency_templates_reseller ON agency_templates(reseller_id)`);

  // demo_sessions — aggregate counter for /demo funnel analytics
  exec(`CREATE TABLE IF NOT EXISTS demo_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    lang TEXT NOT NULL,
    scenario TEXT NOT NULL,
    turn_count INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    completed_signup INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_demo_sessions_created ON demo_sessions(created_at)`);

  // demo_events — per-event funnel log
  exec(`CREATE TABLE IF NOT EXISTS demo_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_demo_events_session ON demo_events(session_id)`);
  exec(`CREATE INDEX IF NOT EXISTS idx_demo_events_event ON demo_events(event)`);

  // contact_requests — 'Hablar con ventas' modal on /pricing
  exec(`CREATE TABLE IF NOT EXISTS contact_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    business_name TEXT,
    plan TEXT,
    message TEXT,
    source TEXT NOT NULL DEFAULT 'pricing_page',
    status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status, created_at)`);

  // === Auth + Signup overhaul ===

  // users.email_verified_at — set when user clicks verification link
  exec(`ALTER TABLE users ADD COLUMN email_verified_at INTEGER`);

  // email_verifications: 32-byte hex token, 24h expiry, marked verified once used
  exec(`CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    verified_at INTEGER,
    created_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token)`);
  exec(`CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id)`);

  // password_resets: random token, 1h expiry, marked used after consumption
  exec(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)`);
  exec(`CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)`);

  // tenants: stripe customer + Mexican fiscal data (CFDI)
  exec(`ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT`);
  exec(`ALTER TABLE tenants ADD COLUMN rfc TEXT`);
  exec(`ALTER TABLE tenants ADD COLUMN razon_social TEXT`);
  exec(`ALTER TABLE tenants ADD COLUMN regimen_fiscal TEXT DEFAULT '601'`);
  exec(`ALTER TABLE tenants ADD COLUMN uso_cfdi TEXT DEFAULT 'G03'`);

  // subscriptions: stripe subscription/price IDs + cancel state
  exec(`ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT`);
  exec(`ALTER TABLE subscriptions ADD COLUMN stripe_price_id TEXT`);
  exec(`ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0`);
  exec(`ALTER TABLE subscriptions ADD COLUMN canceled_at INTEGER`);

  // invoices table
  exec(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    stripe_invoice_id TEXT,
    period_start INTEGER,
    period_end INTEGER,
    amount_mxn_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    pdf_url TEXT,
    hosted_invoice_url TEXT,
    cfdi_pdf_url TEXT,
    cfdi_xml_url TEXT,
    cfdi_id TEXT,
    cfdi_error TEXT,
    created_at INTEGER
  )`);
  exec(`CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id)`);
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id)`);

  // integrations: OAuth token columns + status
  exec(`ALTER TABLE integrations ADD COLUMN provider TEXT`);
  exec(`ALTER TABLE integrations ADD COLUMN external_id TEXT`);
  exec(`ALTER TABLE integrations ADD COLUMN access_token_enc TEXT`);
  exec(`ALTER TABLE integrations ADD COLUMN refresh_token_enc TEXT`);
  exec(`ALTER TABLE integrations ADD COLUMN expires_at INTEGER`);
  exec(`ALTER TABLE integrations ADD COLUMN scopes TEXT`);
  exec(`ALTER TABLE integrations ADD COLUMN status TEXT DEFAULT 'connected'`);
}
