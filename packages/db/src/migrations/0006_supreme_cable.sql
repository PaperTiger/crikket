CREATE TABLE "bug_report_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_report_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'everyone' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bug_report_comment" ADD CONSTRAINT "bug_report_comment_bug_report_id_bug_report_id_fk" FOREIGN KEY ("bug_report_id") REFERENCES "bug_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_comment" ADD CONSTRAINT "bug_report_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_report_comment_bugReportId_idx" ON "bug_report_comment" USING btree ("bug_report_id");--> statement-breakpoint
CREATE INDEX "bug_report_comment_authorId_idx" ON "bug_report_comment" USING btree ("author_id");