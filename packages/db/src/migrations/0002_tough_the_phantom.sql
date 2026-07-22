ALTER TABLE "bug_report" ADD COLUMN IF NOT EXISTS "assignee_id" text;--> statement-breakpoint
ALTER TABLE "bug_report" ADD COLUMN IF NOT EXISTS "capture_public_key_id" text;--> statement-breakpoint
ALTER TABLE "bug_report" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD COLUMN IF NOT EXISTS "capture_public_key_id" text;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_capture_public_key_id_capture_public_key_id_fk" FOREIGN KEY ("capture_public_key_id") REFERENCES "capture_public_key"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_report_upload_session" ADD CONSTRAINT "bug_report_upload_session_capture_public_key_id_capture_public_key_id_fk" FOREIGN KEY ("capture_public_key_id") REFERENCES "capture_public_key"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_report_assigneeId_idx" ON "bug_report" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_report_capturePublicKeyId_idx" ON "bug_report" USING btree ("capture_public_key_id");
