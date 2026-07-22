ALTER TABLE "bug_report" ALTER COLUMN "status" SET DEFAULT 'to_do';
--> statement-breakpoint
UPDATE "bug_report" SET "status" = 'to_do' WHERE "status" = 'open';
--> statement-breakpoint
UPDATE "bug_report" SET "status" = 'done' WHERE "status" = 'resolved';