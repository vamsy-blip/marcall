import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["superadmin", "reseller", "tenant_owner", "tenant_staff"] }).notNull(),
  resellerId: integer("reseller_id"),
  currentTenantId: integer("current_tenant_id"),
  preferredLanguage: text("preferred_language").notNull().default("es"),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  // MFA (TOTP) fields — Control 2
  mfaEnabled: integer("mfa_enabled", { mode: "boolean" }).notNull().default(false),
  mfaSecret: text("mfa_secret"),   // AES-256-GCM encrypted TOTP secret
  mfaBackupCodes: text("mfa_backup_codes"), // JSON array of bcrypt-hashed single-use codes
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Resellers
export const resellers = sqliteTable("resellers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  customDomain: text("custom_domain"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  brandName: text("brand_name").notNull(),
  commissionPct: integer("commission_pct").notNull().default(25),
  hideMarcallBranding: integer("hide_marcall_branding", { mode: "boolean" }).notNull().default(false),
  ownerUserId: integer("owner_user_id"),
  contactEmail: text("contact_email"),
  status: text("status", { enum: ["active", "paused", "terminated"] }).notNull().default("active"),
  brandingLogoUrl: text("branding_logo_url"),
  brandingPrimaryColor: text("branding_primary_color"),
  customSubdomain: text("custom_subdomain"),
  commissionRate: integer("commission_rate_bps").notNull().default(2000), // basis points = 20.00%
  payoutClabe: text("payout_clabe"), // AES-encrypted
  payoutAccountHolder: text("payout_account_holder"),
  payoutRfc: text("payout_rfc"),
  apiKey: text("api_key"),
  whiteLabelAllowed: integer("white_label_allowed", { mode: "boolean" }).notNull().default(false),
});
export const insertResellerSchema = createInsertSchema(resellers).omit({ id: true });
export type InsertReseller = z.infer<typeof insertResellerSchema>;
export type Reseller = typeof resellers.$inferSelect;

// Plans
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  priceMxnCents: integer("price_mxn_cents").notNull(),
  includedMinutes: integer("included_minutes").notNull(),
  overagePerMinMxnCents: integer("overage_per_min_mxn_cents").notNull(),
  maxAssistants: integer("max_assistants").notNull(),
  maxNumbers: integer("max_numbers").notNull(),
  features: text("features").notNull(), // JSON array
  voiceTier: text("voice_tier").notNull(),
});
export const insertPlanSchema = createInsertSchema(plans).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

// Tenants
export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry"),
  resellerId: integer("reseller_id").notNull(),
  planId: integer("plan_id").notNull(),
  status: text("status", { enum: ["trial", "active", "suspended", "churned"] }).notNull().default("trial"),
  timezone: text("timezone").notNull().default("America/Monterrey"),
  addressLine: text("address_line"),
  transferNumber: text("transfer_number"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  defaultLanguage: text("default_language").notNull().default("es"),
  recordingEnabled: integer("recording_enabled", { mode: "boolean" }).notNull().default(true),
  recordingRetentionDays: integer("recording_retention_days").notNull().default(90),
  suspended: integer("suspended", { mode: "boolean" }).notNull().default(false),
  suspendedReason: text("suspended_reason"),
  suspendedAt: integer("suspended_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  // Stripe customer ID — created on first checkout, reused for portal + invoices
  stripeCustomerId: text("stripe_customer_id"),
  // Mexican fiscal data (CFDI / SAT)
  rfc: text("rfc"),
  razonSocial: text("razon_social"),
  regimenFiscal: text("regimen_fiscal").default("601"),
  usoCfdi: text("uso_cfdi").default("G03"),
});
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Subscriptions
export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  planId: integer("plan_id").notNull(),
  stripeSubId: text("stripe_sub_id"),
  // Newer canonical names (Stripe spec)
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  status: text("status").notNull(),
  currentPeriodStart: integer("current_period_start", { mode: "timestamp" }),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
  trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  canceledAt: integer("canceled_at", { mode: "timestamp" }),
});
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Usage events
export const usageEvents = sqliteTable("usage_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  callId: integer("call_id"),
  kind: text("kind", { enum: ["call_minute", "overage"] }).notNull(),
  amount: integer("amount").notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertUsageEventSchema = createInsertSchema(usageEvents).omit({ id: true });
export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;
export type UsageEvent = typeof usageEvents.$inferSelect;

// Business hours
export const businessHours = sqliteTable("business_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6
  openTime: text("open_time").notNull(), // HH:mm
  closeTime: text("close_time").notNull(),
  closed: integer("closed", { mode: "boolean" }).notNull().default(false),
});
export const insertBusinessHoursSchema = createInsertSchema(businessHours).omit({ id: true });
export type InsertBusinessHours = z.infer<typeof insertBusinessHoursSchema>;
export type BusinessHours = typeof businessHours.$inferSelect;

// Assistants
export const assistants = sqliteTable("assistants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  vapiAssistantId: text("vapi_assistant_id"),
  name: text("name").notNull().default("Sofía"),
  voiceId: text("voice_id").notNull().default("adri-chilanga"),
  voiceProvider: text("voice_provider").notNull().default("elevenlabs"),
  languageCode: text("language_code").notNull().default("es-MX"),
  systemPrompt: text("system_prompt").notNull(),
  formality: text("formality", { enum: ["usted", "tu"] }).notNull().default("usted"),
  greeting: text("greeting").notNull(),
  languages: text("languages").notNull().default('["es-MX","en-US"]'), // JSON array
  defaultLanguage: text("default_language").notNull().default("es-MX"),
  codeSwitching: integer("code_switching", { mode: "boolean" }).notNull().default(true),
  greetingEn: text("greeting_en"),
  systemPromptEn: text("system_prompt_en"),
  voiceIdEn: text("voice_id_en"),
});
export const insertAssistantSchema = createInsertSchema(assistants).omit({ id: true });
export type InsertAssistant = z.infer<typeof insertAssistantSchema>;
export type Assistant = typeof assistants.$inferSelect;

// Phone numbers
export const phoneNumbers = sqliteTable("phone_numbers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  e164: text("e164").notNull(),
  country: text("country").notNull(),
  twilioSid: text("twilio_sid"),
  vapiPhoneId: text("vapi_phone_id"),
  kind: text("kind", { enum: ["demo_us", "mx_managed", "byo_twilio"] }).notNull(),
  kycStatus: text("kyc_status", { enum: ["pending", "approved", "rejected", "na"] }).notNull().default("na"),
  kycDocsUrl: text("kyc_docs_url"),
});
export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({ id: true });
export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;
export type PhoneNumber = typeof phoneNumbers.$inferSelect;

// KYC documents
export const kycDocuments = sqliteTable("kyc_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phoneNumberId: integer("phone_number_id").notNull(),
  kind: text("kind", { enum: ["ine", "constancia", "utility_bill"] }).notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  reviewerNotes: text("reviewer_notes"),
});
export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({ id: true, uploadedAt: true });
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;

// Services
export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  durationMin: integer("duration_min").notNull(),
  description: text("description"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// FAQs
export const faqs = sqliteTable("faqs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  questionEn: text("question_en"),
  answerEn: text("answer_en"),
  keywords: text("keywords"), // JSON array
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
export const insertFaqSchema = createInsertSchema(faqs).omit({ id: true });
export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type Faq = typeof faqs.$inferSelect;

// Appointments
export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  serviceId: integer("service_id"),
  callerName: text("caller_name").notNull(),
  callerPhone: text("caller_phone").notNull(),
  callerEmail: text("caller_email"),
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }).notNull(),
  googleEventId: text("google_event_id"),
  status: text("status").notNull().default("confirmed"),
  notes: text("notes"),
  callerLanguage: text("caller_language").notNull().default("es"),
});
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

// Messages
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  callerName: text("caller_name"),
  callerPhone: text("caller_phone"),
  subject: text("subject"),
  body: text("body").notNull(),
  urgency: text("urgency", { enum: ["low", "normal", "high", "urgent"] }).notNull().default("normal"),
  delivered: integer("delivered", { mode: "boolean" }).notNull().default(false),
  callerLanguage: text("caller_language").notNull().default("es"),
  status: text("status", { enum: ["new", "read", "replied", "archived"] }).notNull().default("new"),
  intent: text("intent"),
  audioUrl: text("audio_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Leads
export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  company: text("company"),
  interest: text("interest"),
  budget: text("budget"),
  timeline: text("timeline"),
  qualificationScore: integer("qualification_score").notNull().default(0),
  transcriptExcerpt: text("transcript_excerpt"),
  callerLanguage: text("caller_language").notNull().default("es"),
  stage: text("stage", { enum: ["new", "qualified", "hot", "contacted", "converted", "lost"] }).notNull().default("new"),
  source: text("source"),
  notes: text("notes"),
  assignedUserId: integer("assigned_user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Call logs
export const callLogs = sqliteTable("call_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  vapiCallId: text("vapi_call_id"),
  callerPhone: text("caller_phone").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  durationSec: integer("duration_sec"),
  transcript: text("transcript"), // JSON
  outcome: text("outcome"),
  costMxnCents: integer("cost_mxn_cents").notNull().default(0),
  recordingUrl: text("recording_url"),
  language: text("language").notNull().default("es"),
});
export const insertCallLogSchema = createInsertSchema(callLogs).omit({ id: true });
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type CallLog = typeof callLogs.$inferSelect;

// Integrations
export const integrations = sqliteTable("integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  kind: text("kind", { enum: ["google_calendar", "crm_webhook", "whatsapp"] }).notNull(),
  provider: text("provider"),
  externalId: text("external_id"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  scopes: text("scopes"),
  status: text("status").default("connected"),
  config: text("config"), // JSON
  connected: integer("connected", { mode: "boolean" }).notNull().default(false),
});
export const insertIntegrationSchema = createInsertSchema(integrations).omit({ id: true });
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

// Invoices — Stripe invoice records, optionally CFDI-linked
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  stripeInvoiceId: text("stripe_invoice_id"),
  periodStart: integer("period_start", { mode: "timestamp" }),
  periodEnd: integer("period_end", { mode: "timestamp" }),
  amountMxnCents: integer("amount_mxn_cents").notNull().default(0),
  status: text("status", { enum: ["paid", "open", "failed", "uncollectible", "void"] }).notNull().default("open"),
  pdfUrl: text("pdf_url"),
  hostedInvoiceUrl: text("hosted_invoice_url"),
  cfdiPdfUrl: text("cfdi_pdf_url"),
  cfdiXmlUrl: text("cfdi_xml_url"),
  cfdiId: text("cfdi_id"),
  cfdiError: text("cfdi_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Audit logs — records security-relevant events for compliance review
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: integer("at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  actorUserId: integer("actor_user_id"),
  actorIp: text("actor_ip"),
  tenantId: integer("tenant_id"),
  action: text("action").notNull(),
  targetKind: text("target_kind"),
  targetId: text("target_id"),
  metadata: text("metadata"),
  result: text("result", { enum: ["success", "denied", "error"] }).notNull().default("success"),
  // Tamper-evident hash chain — Control 8
  prevHash: text("prev_hash"),  // sha256 of previous row (null for first row)
  hash: text("hash"),           // sha256(prevHash || JSON.stringify(row))
});
export type AuditLog = typeof auditLogs.$inferSelect;

// Sessions — SQLite-backed session store (Control 3)
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),             // random 32-byte hex
  userId: integer("user_id").notNull(),
  tenantId: integer("tenant_id"),
  ipHash: text("ip_hash"),                 // sha256 of IP, not raw
  userAgentHash: text("user_agent_hash"),  // sha256 of UA
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  absoluteExpiresAt: integer("absolute_expires_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});
export type Session = typeof sessions.$inferSelect;

// Tenant API keys — programmatic access tokens
export const tenantApiKeys = sqliteTable("tenant_api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(), // first 8 chars shown
  hash: text("hash").notNull(),     // sha256 of full key
  scope: text("scope").notNull().default("read"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});
export type TenantApiKey = typeof tenantApiKeys.$inferSelect;
export const insertTenantApiKeySchema = createInsertSchema(tenantApiKeys).omit({ id: true, createdAt: true, lastUsedAt: true, revokedAt: true });
export type InsertTenantApiKey = z.infer<typeof insertTenantApiKeySchema>;

// ARCO requests — LFPDPPP-mandated user data rights tickets
export const arcoRequests = sqliteTable("arco_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  tenantId: integer("tenant_id"),
  kind: text("kind", { enum: ["access", "rectification", "cancellation", "opposition", "deletion"] }).notNull(),
  requestText: text("request_text"),
  status: text("status", { enum: ["pending", "in_progress", "fulfilled", "denied"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  fulfilledAt: integer("fulfilled_at", { mode: "timestamp" }),
  notes: text("notes"),
});
export type ArcoRequest = typeof arcoRequests.$inferSelect;
export const insertArcoRequestSchema = createInsertSchema(arcoRequests).omit({ id: true, createdAt: true, fulfilledAt: true });
export type InsertArcoRequest = z.infer<typeof insertArcoRequestSchema>;

// Agency assistant templates — pre-built configurations resellers can apply to new clients
export const agencyTemplates = sqliteTable("agency_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resellerId: integer("reseller_id").notNull(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  greetingEs: text("greeting_es").notNull(),
  greetingEn: text("greeting_en").notNull(),
  systemPromptEs: text("system_prompt_es").notNull(),
  systemPromptEn: text("system_prompt_en").notNull(),
  defaultServices: text("default_services").notNull().default('[]'), // JSON array
  defaultFaqs: text("default_faqs").notNull().default('[]'),         // JSON array
  defaultHours: text("default_hours").notNull().default('[]'),       // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertAgencyTemplateSchema = createInsertSchema(agencyTemplates).omit({ id: true, createdAt: true });
export type InsertAgencyTemplate = z.infer<typeof insertAgencyTemplateSchema>;
export type AgencyTemplate = typeof agencyTemplates.$inferSelect;

// Email outbox — queue of transactional emails drained by the Resend agent
export const emailOutbox = sqliteTable("email_outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id"),
  userId: integer("user_id"),
  type: text("type").notNull(), // email_verify | password_reset | welcome | trial_ending_2d | ...
  payload: text("payload").notNull().default('{}'), // JSON
  status: text("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  lastError: text("last_error"),
});
// Drizzle ORM mirror of the email_outbox table for queries that prefer the typed builder.
// (server/storage.ts also defines plain interfaces for raw-SQL paths — they describe the same rows.)
export const insertEmailOutboxRowSchema = createInsertSchema(emailOutbox).omit({ id: true, createdAt: true, sentAt: true });
export type EmailOutboxRow = typeof emailOutbox.$inferSelect;

// Email verification tokens (24h)
export const emailVerifications = sqliteTable("email_verifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type EmailVerification = typeof emailVerifications.$inferSelect;

// Password reset tokens (1h)
export const passwordResets = sqliteTable("password_resets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export type PasswordReset = typeof passwordResets.$inferSelect;

// Contact-sales requests from /pricing 'Hablar con ventas' modal.
// Status flow: 'new' → 'contacted' → 'won' | 'lost'.
export const contactRequests = sqliteTable("contact_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  businessName: text("business_name"),
  plan: text("plan"),
  message: text("message"),
  source: text("source").notNull().default('pricing_page'),
  status: text("status").notNull().default('new'),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertContactRequestSchema = createInsertSchema(contactRequests).omit({ id: true, createdAt: true });
export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;
export type ContactRequest = typeof contactRequests.$inferSelect;

// ============ DEMO (browser voice demo, public, ephemeral) ============
// Aggregate per-session counter for funnel analytics.
export const demoSessions = sqliteTable("demo_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull().unique(),
  lang: text("lang", { enum: ["es", "en"] }).notNull(),
  scenario: text("scenario").notNull(),
  turnCount: integer("turn_count").notNull().default(0),
  durationSec: integer("duration_sec").notNull().default(0),
  completedSignup: integer("completed_signup", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertDemoSessionSchema = createInsertSchema(demoSessions).omit({ id: true, createdAt: true });
export type InsertDemoSession = z.infer<typeof insertDemoSessionSchema>;
export type DemoSession = typeof demoSessions.$inferSelect;

// Per-event log for funnel breakdown.
export const demoEvents = sqliteTable("demo_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  event: text("event").notNull(), // demo.opened | demo.started | demo.turn | demo.signup_clicked | demo.ended
  payload: text("payload"),       // JSON
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
export const insertDemoEventSchema = createInsertSchema(demoEvents).omit({ id: true, createdAt: true });
export type InsertDemoEvent = z.infer<typeof insertDemoEventSchema>;
export type DemoEvent = typeof demoEvents.$inferSelect;
