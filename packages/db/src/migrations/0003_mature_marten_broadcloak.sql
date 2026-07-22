ALTER TABLE "bug_report" DROP CONSTRAINT IF EXISTS "bug_report_assignee_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "capture_public_key" ADD COLUMN IF NOT EXISTS "project_id" text;
