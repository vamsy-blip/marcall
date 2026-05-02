CREATE TABLE `agency_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reseller_id` integer NOT NULL,
	`name` text NOT NULL,
	`industry` text NOT NULL,
	`greeting_es` text NOT NULL,
	`greeting_en` text NOT NULL,
	`system_prompt_es` text NOT NULL,
	`system_prompt_en` text NOT NULL,
	`default_services` text DEFAULT '[]' NOT NULL,
	`default_faqs` text DEFAULT '[]' NOT NULL,
	`default_hours` text DEFAULT '[]' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`service_id` integer,
	`caller_name` text NOT NULL,
	`caller_phone` text NOT NULL,
	`caller_email` text,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`google_event_id` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`notes` text,
	`caller_language` text DEFAULT 'es' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `arco_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`tenant_id` integer,
	`kind` text NOT NULL,
	`request_text` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer,
	`fulfilled_at` integer,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `assistants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`vapi_assistant_id` text,
	`name` text DEFAULT 'Sofía' NOT NULL,
	`voice_id` text DEFAULT 'adri-chilanga' NOT NULL,
	`voice_provider` text DEFAULT 'elevenlabs' NOT NULL,
	`language_code` text DEFAULT 'es-MX' NOT NULL,
	`system_prompt` text NOT NULL,
	`formality` text DEFAULT 'usted' NOT NULL,
	`greeting` text NOT NULL,
	`languages` text DEFAULT '["es-MX","en-US"]' NOT NULL,
	`default_language` text DEFAULT 'es-MX' NOT NULL,
	`code_switching` integer DEFAULT true NOT NULL,
	`greeting_en` text,
	`system_prompt_en` text,
	`voice_id_en` text
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer,
	`actor_user_id` integer,
	`actor_ip` text,
	`tenant_id` integer,
	`action` text NOT NULL,
	`target_kind` text,
	`target_id` text,
	`metadata` text,
	`result` text DEFAULT 'success' NOT NULL,
	`prev_hash` text,
	`hash` text
);
--> statement-breakpoint
CREATE TABLE `business_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`open_time` text NOT NULL,
	`close_time` text NOT NULL,
	`closed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `call_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`vapi_call_id` text,
	`caller_phone` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_sec` integer,
	`transcript` text,
	`outcome` text,
	`cost_mxn_cents` integer DEFAULT 0 NOT NULL,
	`recording_url` text,
	`language` text DEFAULT 'es' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contact_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`business_name` text,
	`plan` text,
	`message` text,
	`source` text DEFAULT 'pricing_page' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `demo_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `demo_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`lang` text NOT NULL,
	`scenario` text NOT NULL,
	`turn_count` integer DEFAULT 0 NOT NULL,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`completed_signup` integer DEFAULT false NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_sessions_session_id_unique` ON `demo_sessions` (`session_id`);--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer,
	`user_id` integer,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`created_at` integer,
	`sent_at` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `email_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_verifications_token_unique` ON `email_verifications` (`token`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`question_en` text,
	`answer_en` text,
	`keywords` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`provider` text,
	`external_id` text,
	`access_token_enc` text,
	`refresh_token_enc` text,
	`expires_at` integer,
	`scopes` text,
	`status` text DEFAULT 'connected',
	`config` text,
	`connected` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`stripe_invoice_id` text,
	`period_start` integer,
	`period_end` integer,
	`amount_mxn_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`pdf_url` text,
	`hosted_invoice_url` text,
	`cfdi_pdf_url` text,
	`cfdi_xml_url` text,
	`cfdi_id` text,
	`cfdi_error` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `kyc_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone_number_id` integer NOT NULL,
	`kind` text NOT NULL,
	`file_url` text NOT NULL,
	`uploaded_at` integer,
	`reviewer_notes` text
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text,
	`phone` text,
	`email` text,
	`company` text,
	`interest` text,
	`budget` text,
	`timeline` text,
	`qualification_score` integer DEFAULT 0 NOT NULL,
	`transcript_excerpt` text,
	`caller_language` text DEFAULT 'es' NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`source` text,
	`notes` text,
	`assigned_user_id` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`caller_name` text,
	`caller_phone` text,
	`subject` text,
	`body` text NOT NULL,
	`urgency` text DEFAULT 'normal' NOT NULL,
	`delivered` integer DEFAULT false NOT NULL,
	`caller_language` text DEFAULT 'es' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`intent` text,
	`audio_url` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_resets_token_unique` ON `password_resets` (`token`);--> statement-breakpoint
CREATE TABLE `phone_numbers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`e164` text NOT NULL,
	`country` text NOT NULL,
	`twilio_sid` text,
	`vapi_phone_id` text,
	`kind` text NOT NULL,
	`kyc_status` text DEFAULT 'na' NOT NULL,
	`kyc_docs_url` text
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`price_mxn_cents` integer NOT NULL,
	`included_minutes` integer NOT NULL,
	`overage_per_min_mxn_cents` integer NOT NULL,
	`max_assistants` integer NOT NULL,
	`max_numbers` integer NOT NULL,
	`features` text NOT NULL,
	`voice_tier` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_slug_unique` ON `plans` (`slug`);--> statement-breakpoint
CREATE TABLE `resellers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`custom_domain` text,
	`logo_url` text,
	`primary_color` text,
	`accent_color` text,
	`brand_name` text NOT NULL,
	`commission_pct` integer DEFAULT 25 NOT NULL,
	`hide_marcall_branding` integer DEFAULT false NOT NULL,
	`owner_user_id` integer,
	`contact_email` text,
	`status` text DEFAULT 'active' NOT NULL,
	`branding_logo_url` text,
	`branding_primary_color` text,
	`custom_subdomain` text,
	`commission_rate_bps` integer DEFAULT 2000 NOT NULL,
	`payout_clabe` text,
	`payout_account_holder` text,
	`payout_rfc` text,
	`api_key` text,
	`white_label_allowed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resellers_slug_unique` ON `resellers` (`slug`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`duration_min` integer NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`tenant_id` integer,
	`ip_hash` text,
	`user_agent_hash` text,
	`created_at` integer,
	`last_seen_at` integer,
	`expires_at` integer NOT NULL,
	`absolute_expires_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`stripe_sub_id` text,
	`stripe_subscription_id` text,
	`stripe_price_id` text,
	`status` text NOT NULL,
	`current_period_start` integer,
	`current_period_end` integer,
	`trial_ends_at` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`canceled_at` integer
);
--> statement-breakpoint
CREATE TABLE `tenant_api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`scope` text DEFAULT 'read' NOT NULL,
	`created_at` integer,
	`last_used_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`industry` text,
	`reseller_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`status` text DEFAULT 'trial' NOT NULL,
	`timezone` text DEFAULT 'America/Monterrey' NOT NULL,
	`address_line` text,
	`transfer_number` text,
	`logo_url` text,
	`primary_color` text,
	`default_language` text DEFAULT 'es' NOT NULL,
	`recording_enabled` integer DEFAULT true NOT NULL,
	`recording_retention_days` integer DEFAULT 90 NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`suspended_reason` text,
	`suspended_at` integer,
	`created_at` integer,
	`stripe_customer_id` text,
	`rfc` text,
	`razon_social` text,
	`regimen_fiscal` text DEFAULT '601',
	`uso_cfdi` text DEFAULT 'G03'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`call_id` integer,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`occurred_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`reseller_id` integer,
	`current_tenant_id` integer,
	`preferred_language` text DEFAULT 'es' NOT NULL,
	`last_login_at` integer,
	`failed_login_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`mfa_enabled` integer DEFAULT false NOT NULL,
	`mfa_secret` text,
	`mfa_backup_codes` text,
	`email_verified_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);