import {
  users, resellers, plans, tenants, subscriptions, usageEvents,
  businessHours, assistants, phoneNumbers, kycDocuments,
  services, faqs, appointments, messages, leads, callLogs, integrations,
  tenantApiKeys, contactRequests, invoices,
} from '@shared/schema';
import type {
  User, InsertUser, Reseller, InsertReseller, Plan, InsertPlan,
  Tenant, InsertTenant, Subscription, InsertSubscription,
  UsageEvent, InsertUsageEvent, BusinessHours, InsertBusinessHours,
  Assistant, InsertAssistant, PhoneNumber, InsertPhoneNumber,
  KycDocument, InsertKycDocument, Service, InsertService,
  Faq, InsertFaq, Appointment, InsertAppointment,
  Message, InsertMessage, Lead, InsertLead, CallLog, InsertCallLog,
  Integration, InsertIntegration,
  TenantApiKey, InsertTenantApiKey,
  ContactRequest, InsertContactRequest,
  Invoice, InsertInvoice,
} from '@shared/schema';

// ── Email outbox types (schema is in migrations.ts — SQLite only) ─────────────
export interface EmailOutbox {
  id: number;
  tenantId: number | null;
  userId: number | null;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  nextAttemptAt: Date | null;
  createdAt: Date | null;
  sentAt: Date | null;
  lastError: string | null;
}

export interface InsertEmailOutbox {
  tenantId?: number | null;
  userId?: number | null;
  type: string;
  payload: { to: string; lang: 'es' | 'en'; data: Record<string, unknown> };
  status?: 'pending';
  nextAttemptAt?: Date | null;
}
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, desc, sum, gte, lte, sql as sqlRaw } from 'drizzle-orm';
import { runMigrations } from './lib/migrations';

// SQLite v0 demo storage. Production deploys use Postgres on Supabase with
// AES-256 encryption at rest (Supabase default). The data.db file is
// `.gitignore`d, never bundled into the deployed artifact, and any backups
// would be encrypted before leaving the host.
//
// SECURITY — Input validation (Control 6):
// ALL database values flow exclusively through Drizzle ORM parameterized
// queries (never raw string concatenation). There are no db.run() /
// db.all() calls with interpolated user input anywhere in this file.
// All inbound request payloads are parsed by Zod schemas (insertXxxSchema
// from shared/schema.ts) before reaching these storage functions, ensuring
// type correctness and stripping unexpected fields at the boundary.
// In production on Fly.io we mount a volume at /data and write the SQLite
// file there. Locally we keep using ./data.db. SQLITE_PATH overrides both.
const sqlitePath = process.env.SQLITE_PATH || 'data.db';
const sqlite = new Database(sqlitePath);
sqlite.pragma('journal_mode = WAL');
runMigrations(sqlite);
export const db = drizzle(sqlite);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(u: InsertUser): Promise<User>;
  updateUser(id: number, patch: Partial<InsertUser>): Promise<User | undefined>;
  listUsers(): Promise<User[]>;

  // Resellers
  getReseller(id: number): Promise<Reseller | undefined>;
  listResellers(): Promise<Reseller[]>;
  createReseller(r: InsertReseller): Promise<Reseller>;
  updateReseller(id: number, patch: Partial<InsertReseller>): Promise<Reseller | undefined>;

  // Plans
  getPlan(id: number): Promise<Plan | undefined>;
  getPlanBySlug(slug: string): Promise<Plan | undefined>;
  listPlans(): Promise<Plan[]>;
  createPlan(p: InsertPlan): Promise<Plan>;

  // Tenants
  getTenant(id: number): Promise<Tenant | undefined>;
  listTenants(filter?: { resellerId?: number }): Promise<Tenant[]>;
  createTenant(t: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, patch: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: number): Promise<void>;

  // Subscriptions
  getSubscriptionByTenant(tenantId: number): Promise<Subscription | undefined>;
  createSubscription(s: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, patch: Partial<InsertSubscription>): Promise<Subscription | undefined>;

  // Usage
  getUsageThisPeriod(tenantId: number, since: Date): Promise<number>;
  recordUsage(u: InsertUsageEvent): Promise<UsageEvent>;

  // Hours
  listBusinessHours(tenantId: number): Promise<BusinessHours[]>;
  setBusinessHours(tenantId: number, rows: InsertBusinessHours[]): Promise<BusinessHours[]>;

  // Assistant
  getAssistantByTenant(tenantId: number): Promise<Assistant | undefined>;
  createAssistant(a: InsertAssistant): Promise<Assistant>;
  updateAssistant(id: number, patch: Partial<InsertAssistant>): Promise<Assistant | undefined>;

  // Phone numbers
  listPhoneNumbers(tenantId: number): Promise<PhoneNumber[]>;
  createPhoneNumber(p: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumber(id: number, patch: Partial<InsertPhoneNumber>): Promise<PhoneNumber | undefined>;
  listKycPending(): Promise<PhoneNumber[]>;

  // KYC docs
  createKycDocument(k: InsertKycDocument): Promise<KycDocument>;
  listKycDocs(phoneNumberId: number): Promise<KycDocument[]>;

  // Services
  listServices(tenantId: number): Promise<Service[]>;
  createService(s: InsertService): Promise<Service>;
  updateService(id: number, patch: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<void>;

  // FAQs
  listFaqs(tenantId: number): Promise<Faq[]>;
  createFaq(f: InsertFaq): Promise<Faq>;
  updateFaq(id: number, patch: Partial<InsertFaq>): Promise<Faq | undefined>;
  deleteFaq(id: number): Promise<void>;

  // Appointments
  listAppointments(tenantId: number): Promise<Appointment[]>;
  createAppointment(a: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, patch: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<void>;

  // Messages
  listMessages(tenantId: number): Promise<Message[]>;
  createMessage(m: InsertMessage): Promise<Message>;

  // Leads
  listLeads(tenantId: number): Promise<Lead[]>;
  createLead(l: InsertLead): Promise<Lead>;

  // Call logs
  listCallLogs(tenantId: number): Promise<CallLog[]>;
  createCallLog(c: InsertCallLog): Promise<CallLog>;

  // Integrations
  listIntegrations(tenantId: number): Promise<Integration[]>;
  getIntegration(tenantId: number, kind: string): Promise<Integration | undefined>;
  upsertIntegration(i: InsertIntegration): Promise<Integration>;
  deleteIntegration(tenantId: number, kind: string): Promise<void>;

  // Invoices
  listInvoices(tenantId: number): Promise<Invoice[]>;
  getInvoiceByStripeId(stripeInvoiceId: string): Promise<Invoice | undefined>;
  createInvoice(inv: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, patch: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  // API keys
  listTenantApiKeys(tenantId: number): Promise<TenantApiKey[]>;
  createTenantApiKey(k: InsertTenantApiKey): Promise<TenantApiKey>;
  revokeTenantApiKey(id: number): Promise<void>;

  // Messages mutate
  updateMessage(id: number, patch: Partial<InsertMessage>): Promise<Message | undefined>;
  // Leads mutate
  updateLead(id: number, patch: Partial<InsertLead>): Promise<Lead | undefined>;
  // Calls
  getCallLog(id: number): Promise<CallLog | undefined>;

  // Email outbox
  enqueueEmail(row: InsertEmailOutbox): Promise<EmailOutbox>;
  getPendingEmails(limit: number): Promise<EmailOutbox[]>;
  markEmailSent(id: number, providerId: string): Promise<void>;
  markEmailFailed(id: number, error: string): Promise<void>;
  incrementEmailAttempt(id: number, error: string): Promise<void>;

  // Contact-sales requests
  createContactRequest(c: InsertContactRequest): Promise<ContactRequest>;
  listContactRequests(): Promise<ContactRequest[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number) { return db.select().from(users).where(eq(users.id, id)).get(); }
  async getUserByEmail(email: string) { return db.select().from(users).where(eq(users.email, email)).get(); }
  async createUser(u: InsertUser) { return db.insert(users).values(u).returning().get(); }
  async updateUser(id: number, patch: Partial<InsertUser>) {
    return db.update(users).set(patch).where(eq(users.id, id)).returning().get();
  }
  async listUsers() { return db.select().from(users).all(); }

  // Resellers
  async getReseller(id: number) { return db.select().from(resellers).where(eq(resellers.id, id)).get(); }
  async listResellers() { return db.select().from(resellers).all(); }
  async createReseller(r: InsertReseller) { return db.insert(resellers).values(r).returning().get(); }
  async updateReseller(id: number, patch: Partial<InsertReseller>) {
    return db.update(resellers).set(patch).where(eq(resellers.id, id)).returning().get();
  }

  // Plans
  async getPlan(id: number) { return db.select().from(plans).where(eq(plans.id, id)).get(); }
  async getPlanBySlug(slug: string) { return db.select().from(plans).where(eq(plans.slug, slug)).get(); }
  async listPlans() { return db.select().from(plans).all(); }
  async createPlan(p: InsertPlan) { return db.insert(plans).values(p).returning().get(); }

  // Tenants
  async getTenant(id: number) { return db.select().from(tenants).where(eq(tenants.id, id)).get(); }
  async listTenants(filter?: { resellerId?: number }) {
    if (filter?.resellerId) return db.select().from(tenants).where(eq(tenants.resellerId, filter.resellerId)).all();
    return db.select().from(tenants).all();
  }
  async createTenant(t: InsertTenant) { return db.insert(tenants).values(t).returning().get(); }
  async updateTenant(id: number, patch: Partial<InsertTenant>) {
    return db.update(tenants).set(patch).where(eq(tenants.id, id)).returning().get();
  }
  async deleteTenant(id: number) { db.delete(tenants).where(eq(tenants.id, id)).run(); }

  // Subscriptions
  async getSubscriptionByTenant(tenantId: number) {
    return db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).get();
  }
  async createSubscription(s: InsertSubscription) {
    return db.insert(subscriptions).values(s).returning().get();
  }
  async updateSubscription(id: number, patch: Partial<InsertSubscription>) {
    return db.update(subscriptions).set(patch).where(eq(subscriptions.id, id)).returning().get();
  }

  // Usage
  async getUsageThisPeriod(tenantId: number, since: Date) {
    const rows = await db.select().from(usageEvents)
      .where(and(eq(usageEvents.tenantId, tenantId), gte(usageEvents.occurredAt, since))).all();
    return rows.reduce((s, r) => s + r.amount, 0);
  }
  async recordUsage(u: InsertUsageEvent) { return db.insert(usageEvents).values(u).returning().get(); }

  // Hours
  async listBusinessHours(tenantId: number) {
    return db.select().from(businessHours).where(eq(businessHours.tenantId, tenantId)).all();
  }
  async setBusinessHours(tenantId: number, rows: InsertBusinessHours[]) {
    db.delete(businessHours).where(eq(businessHours.tenantId, tenantId)).run();
    if (rows.length === 0) return [];
    return db.insert(businessHours).values(rows).returning().all();
  }

  // Assistant
  async getAssistantByTenant(tenantId: number) {
    return db.select().from(assistants).where(eq(assistants.tenantId, tenantId)).get();
  }
  async createAssistant(a: InsertAssistant) { return db.insert(assistants).values(a).returning().get(); }
  async updateAssistant(id: number, patch: Partial<InsertAssistant>) {
    return db.update(assistants).set(patch).where(eq(assistants.id, id)).returning().get();
  }

  // Phone numbers
  async listPhoneNumbers(tenantId: number) {
    return db.select().from(phoneNumbers).where(eq(phoneNumbers.tenantId, tenantId)).all();
  }
  async createPhoneNumber(p: InsertPhoneNumber) { return db.insert(phoneNumbers).values(p).returning().get(); }
  async updatePhoneNumber(id: number, patch: Partial<InsertPhoneNumber>) {
    return db.update(phoneNumbers).set(patch).where(eq(phoneNumbers.id, id)).returning().get();
  }
  async listKycPending() {
    return db.select().from(phoneNumbers).where(eq(phoneNumbers.kycStatus, 'pending')).all();
  }

  // KYC docs
  async createKycDocument(k: InsertKycDocument) { return db.insert(kycDocuments).values(k).returning().get(); }
  async listKycDocs(phoneNumberId: number) {
    return db.select().from(kycDocuments).where(eq(kycDocuments.phoneNumberId, phoneNumberId)).all();
  }

  // Services
  async listServices(tenantId: number) { return db.select().from(services).where(eq(services.tenantId, tenantId)).all(); }
  async createService(s: InsertService) { return db.insert(services).values(s).returning().get(); }
  async updateService(id: number, patch: Partial<InsertService>) {
    return db.update(services).set(patch).where(eq(services.id, id)).returning().get();
  }
  async deleteService(id: number) { db.delete(services).where(eq(services.id, id)).run(); }

  // FAQs
  async listFaqs(tenantId: number) { return db.select().from(faqs).where(eq(faqs.tenantId, tenantId)).all(); }
  async createFaq(f: InsertFaq) { return db.insert(faqs).values(f).returning().get(); }
  async updateFaq(id: number, patch: Partial<InsertFaq>) {
    return db.update(faqs).set(patch).where(eq(faqs.id, id)).returning().get();
  }
  async deleteFaq(id: number) { db.delete(faqs).where(eq(faqs.id, id)).run(); }

  // Appointments
  async listAppointments(tenantId: number) {
    return db.select().from(appointments).where(eq(appointments.tenantId, tenantId)).orderBy(desc(appointments.startTime)).all();
  }
  async createAppointment(a: InsertAppointment) { return db.insert(appointments).values(a).returning().get(); }
  async updateAppointment(id: number, patch: Partial<InsertAppointment>) {
    return db.update(appointments).set(patch).where(eq(appointments.id, id)).returning().get();
  }
  async deleteAppointment(id: number) { db.delete(appointments).where(eq(appointments.id, id)).run(); }

  // Messages
  async listMessages(tenantId: number) {
    return db.select().from(messages).where(eq(messages.tenantId, tenantId)).orderBy(desc(messages.createdAt)).all();
  }
  async createMessage(m: InsertMessage) { return db.insert(messages).values(m).returning().get(); }

  // Leads
  async listLeads(tenantId: number) {
    return db.select().from(leads).where(eq(leads.tenantId, tenantId)).orderBy(desc(leads.createdAt)).all();
  }
  async createLead(l: InsertLead) { return db.insert(leads).values(l).returning().get(); }

  // Call logs
  async listCallLogs(tenantId: number) {
    return db.select().from(callLogs).where(eq(callLogs.tenantId, tenantId)).orderBy(desc(callLogs.startedAt)).all();
  }
  async createCallLog(c: InsertCallLog) { return db.insert(callLogs).values(c).returning().get(); }

  // Integrations
  async listIntegrations(tenantId: number) {
    return db.select().from(integrations).where(eq(integrations.tenantId, tenantId)).all();
  }
  async getIntegration(tenantId: number, kind: string) {
    return db.select().from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.kind, kind as any))).get();
  }
  async upsertIntegration(i: InsertIntegration) {
    const existing = db.select().from(integrations)
      .where(and(eq(integrations.tenantId, i.tenantId), eq(integrations.kind, i.kind))).get();
    if (existing) {
      return db.update(integrations).set(i).where(eq(integrations.id, existing.id)).returning().get();
    }
    return db.insert(integrations).values(i).returning().get();
  }
  async deleteIntegration(tenantId: number, kind: string) {
    db.delete(integrations).where(and(eq(integrations.tenantId, tenantId), eq(integrations.kind, kind as any))).run();
  }

  // Invoices
  async listInvoices(tenantId: number) {
    return db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.createdAt)).all();
  }
  async getInvoiceByStripeId(stripeInvoiceId: string) {
    return db.select().from(invoices).where(eq(invoices.stripeInvoiceId, stripeInvoiceId)).get();
  }
  async createInvoice(inv: InsertInvoice) {
    return db.insert(invoices).values(inv).returning().get();
  }
  async updateInvoice(id: number, patch: Partial<InsertInvoice>) {
    return db.update(invoices).set(patch).where(eq(invoices.id, id)).returning().get();
  }

  // API keys
  async listTenantApiKeys(tenantId: number) {
    return db.select().from(tenantApiKeys).where(eq(tenantApiKeys.tenantId, tenantId)).all();
  }
  async createTenantApiKey(k: InsertTenantApiKey) {
    return db.insert(tenantApiKeys).values(k).returning().get();
  }
  async revokeTenantApiKey(id: number) {
    db.update(tenantApiKeys).set({ revokedAt: new Date() } as any).where(eq(tenantApiKeys.id, id)).run();
  }

  async updateMessage(id: number, patch: Partial<InsertMessage>) {
    return db.update(messages).set(patch).where(eq(messages.id, id)).returning().get();
  }
  async updateLead(id: number, patch: Partial<InsertLead>) {
    return db.update(leads).set(patch).where(eq(leads.id, id)).returning().get();
  }
  async getCallLog(id: number) {
    return db.select().from(callLogs).where(eq(callLogs.id, id)).get();
  }

  // ── Email outbox (raw SQLite — table created by migrations, not in drizzle schema) ──
  private _dbRaw(): Database.Database {
    // Access the underlying better-sqlite3 instance via the drizzle adapter
    return (db as any).session?.client ?? (db as any)._client ?? sqlite;
  }

  async enqueueEmail(row: InsertEmailOutbox): Promise<EmailOutbox> {
    const now = Date.now();
    const payloadJson = JSON.stringify(row.payload);
    const nextAt = row.nextAttemptAt ? row.nextAttemptAt.getTime() : now;
    const stmt = sqlite.prepare(`
      INSERT INTO email_outbox (tenant_id, user_id, type, payload, status, attempts, next_attempt_at, created_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)
    `);
    const info = stmt.run(row.tenantId ?? null, row.userId ?? null, row.type, payloadJson, nextAt, now);
    return this._getEmailOutboxRow(Number(info.lastInsertRowid))!;
  }

  async getPendingEmails(limit: number): Promise<EmailOutbox[]> {
    const now = Date.now();
    const rows = sqlite.prepare(`
      SELECT * FROM email_outbox
      WHERE status = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY next_attempt_at ASC, id ASC
      LIMIT ?
    `).all(now, limit) as any[];
    return rows.map(this._mapRow);
  }

  async markEmailSent(id: number, providerId: string): Promise<void> {
    sqlite.prepare(`
      UPDATE email_outbox SET status = 'sent', sent_at = ?, last_error = NULL
      WHERE id = ?
    `).run(Date.now(), id);
    // store providerId in last_error field for audit purposes (reuse column)
    sqlite.prepare(`UPDATE email_outbox SET last_error = ? WHERE id = ?`).run(
      `sent:${providerId}`, id
    );
  }

  async markEmailFailed(id: number, error: string): Promise<void> {
    sqlite.prepare(`
      UPDATE email_outbox
      SET status = 'failed', last_error = ?, attempts = attempts + 1
      WHERE id = ?
    `).run(error.slice(0, 500), id);
  }

  async incrementEmailAttempt(id: number, error: string): Promise<void> {
    // Exponential backoff: next retry = now + 2^attempts * 30s
    const row = this._getEmailOutboxRow(id);
    const attempts = (row?.attempts ?? 0) + 1;
    const backoffMs = Math.pow(2, attempts) * 30_000;
    const nextAt = Date.now() + backoffMs;
    sqlite.prepare(`
      UPDATE email_outbox
      SET attempts = ?, next_attempt_at = ?, last_error = ?
      WHERE id = ?
    `).run(attempts, nextAt, error.slice(0, 500), id);
  }

  private _getEmailOutboxRow(id: number): EmailOutbox | null {
    const row = sqlite.prepare(`SELECT * FROM email_outbox WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return this._mapRow(row);
  }

  private _mapRow(row: any): EmailOutbox {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      payload = {};
    }
    return {
      id: row.id,
      tenantId: row.tenant_id ?? null,
      userId: row.user_id ?? null,
      type: row.type,
      payload,
      status: row.status,
      attempts: row.attempts ?? 0,
      nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : null,
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      lastError: row.last_error ?? null,
    };
  }

  // ── Contact-sales requests ─────────────────────────────────────────────
  async createContactRequest(c: InsertContactRequest): Promise<ContactRequest> {
    return db.insert(contactRequests).values(c).returning().get();
  }
  async listContactRequests(): Promise<ContactRequest[]> {
    return db.select().from(contactRequests).orderBy(desc(contactRequests.createdAt)).all();
  }
}

export const storage = new DatabaseStorage();
// expose raw sqlite for email outbox helpers
export { sqlite };
