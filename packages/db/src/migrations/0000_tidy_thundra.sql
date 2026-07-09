CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider" text DEFAULT 'polar' NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"status" text DEFAULT 'received' NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"error_message" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_event_provider_event_id_unique" UNIQUE("provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "organization_billing_account" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'polar' NOT NULL,
	"polar_customer_id" text,
	"polar_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"subscription_status" text DEFAULT 'none' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"last_webhook_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_billing_account_polar_subscription_id_unique" UNIQUE("polar_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "organization_entitlement" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"entitlements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_computed_at" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'reconciliation' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bug_report" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"reporter_id" text,
	"title" text,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"tags" text[],
	"url" text,
	"attachment_type" text,
	"capture_key" text,
	"capture_content_type" text,
	"capture_size_bytes" bigint,
	"capture_uploaded_at" timestamp,
	"thumbnail_key" text,
	"thumbnail_content_type" text,
	"debugger_key" text,
	"debugger_content_encoding" text,
	"debugger_size_bytes" bigint,
	"debugger_uploaded_at" timestamp,
	"debugger_ingestion_status" text DEFAULT 'completed' NOT NULL,
	"debugger_ingestion_error" text,
	"debugger_ingested_at" timestamp,
	"submission_status" text DEFAULT 'ready' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"metadata" jsonb,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bug_report_action" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_report_id" text NOT NULL,
	"type" text NOT NULL,
	"target" text,
	"timestamp" timestamp NOT NULL,
	"offset" integer,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "bug_report_artifact_cleanup" (
	"id" text PRIMARY KEY NOT NULL,
	"artifact_kind" text NOT NULL,
	"object_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bug_report_artifact_cleanup_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "bug_report_ingestion_job" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_report_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bug_report_log" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_report_id" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"offset" integer,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "bug_report_network_request" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_report_id" text NOT NULL,
	"method" text NOT NULL,
	"url" text NOT NULL,
	"status" integer,
	"duration" integer,
	"request_headers" jsonb,
	"response_headers" jsonb,
	"request_body" text,
	"response_body" text,
	"timestamp" timestamp NOT NULL,
	"offset" integer
);
--> statement-breakpoint
CREATE TABLE "bug_report_upload_session" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"reporter_id" text,
	"title" text,
	"description" text,
	"priority" text DEFAULT 'none' NOT NULL,
	"tags" text[],
	"url" text,
	"attachment_type" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"capture_key" text NOT NULL,
	"capture_content_type" text NOT NULL,
	"debugger_key" text,
	"metadata" jsonb,
	"device_info" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capture_public_key" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"allowed_origins" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"rotated_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capture_public_key_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_billing_account" ADD CONSTRAINT "organization_billing_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_entitlement" ADD CONSTRAINT "organization_entitlement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_action" ADD CONSTRAINT "bug_report_action_bug_report_id_bug_report_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "bug_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_ingestion_job" ADD CONSTRAINT "bug_report_ingestion_job_bug_report_id_bug_report_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "bug_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_ingestion_job" ADD CONSTRAINT "bug_report_ingestion_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_log" ADD CONSTRAINT "bug_report_log_bug_report_id_bug_report_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "bug_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_network_request" ADD CONSTRAINT "bug_report_network_request_bug_report_id_bug_report_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "bug_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD CONSTRAINT "bug_report_upload_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD CONSTRAINT "bug_report_upload_session_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_public_key" ADD CONSTRAINT "capture_public_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_public_key" ADD CONSTRAINT "capture_public_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "billing_webhook_event_type_idx" ON "billing_webhook_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "billing_webhook_status_idx" ON "billing_webhook_event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "org_billing_plan_idx" ON "organization_billing_account" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "org_billing_polar_customer_idx" ON "organization_billing_account" USING btree ("polar_customer_id");--> statement-breakpoint
CREATE INDEX "org_entitlement_plan_idx" ON "organization_entitlement" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "bug_report_organizationId_idx" ON "bug_report" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bug_report_reporterId_idx" ON "bug_report" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "bug_report_submissionStatus_idx" ON "bug_report" USING btree ("submission_status");--> statement-breakpoint
CREATE INDEX "bug_report_debuggerIngestionStatus_idx" ON "bug_report" USING btree ("debugger_ingestion_status");--> statement-breakpoint
CREATE INDEX "bug_report_action_bugReportId_idx" ON "bug_report_action" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "bug_report_artifact_cleanup_nextAttemptAt_idx" ON "bug_report_artifact_cleanup" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "bug_report_ingestion_job_bugReportId_idx" ON "bug_report_ingestion_job" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "bug_report_ingestion_job_status_idx" ON "bug_report_ingestion_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bug_report_ingestion_job_nextAttemptAt_idx" ON "bug_report_ingestion_job" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "bug_report_log_bugReportId_idx" ON "bug_report_log" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "bug_report_network_request_bugReportId_idx" ON "bug_report_network_request" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "bug_report_upload_session_organizationId_idx" ON "bug_report_upload_session" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bug_report_upload_session_expiresAt_idx" ON "bug_report_upload_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "capture_public_key_organizationId_idx" ON "capture_public_key" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "capture_public_key_status_idx" ON "capture_public_key" USING btree ("status");