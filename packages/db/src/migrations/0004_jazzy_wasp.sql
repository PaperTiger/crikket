CREATE TABLE "project_guest_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"invitation_id" text,
	"invited_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_guest_grant" ADD CONSTRAINT "project_guest_grant_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_guest_grant" ADD CONSTRAINT "project_guest_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_guest_grant" ADD CONSTRAINT "project_guest_grant_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "invitation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_guest_grant" ADD CONSTRAINT "project_guest_grant_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_guest_grant_org_project_email_uidx" ON "project_guest_grant" USING btree ("organization_id","project_id","email");--> statement-breakpoint
CREATE INDEX "project_guest_grant_userId_idx" ON "project_guest_grant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_guest_grant_organizationId_projectId_idx" ON "project_guest_grant" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "project_guest_grant_invitationId_idx" ON "project_guest_grant" USING btree ("invitation_id");