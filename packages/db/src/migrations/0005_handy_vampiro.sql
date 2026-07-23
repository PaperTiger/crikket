CREATE TABLE "project_team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_team_member_org_project_user_uidx" ON "project_team_member" USING btree ("organization_id","project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_team_member_userId_idx" ON "project_team_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_team_member_organizationId_projectId_idx" ON "project_team_member" USING btree ("organization_id","project_id");--> statement-breakpoint
-- Backfill: put every existing organization member on every existing project,
-- so nobody silently loses sight of work they were already following. A
-- "project" is one with a capture key in the org, matching listCrikketProjects.
-- Guests are excluded — their access lives in project_guest_grant.
INSERT INTO "project_team_member" ("id","organization_id","project_id","user_id","created_at")
SELECT gen_random_uuid()::text, k."organization_id", k."project_id", m."user_id", now()
FROM (
  SELECT DISTINCT "organization_id", "project_id"
  FROM "capture_public_key"
  WHERE "project_id" IS NOT NULL
) k
JOIN "member" m
  ON m."organization_id" = k."organization_id" AND m."role" <> 'guest'
ON CONFLICT DO NOTHING;