import { relations } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { invitation, organization, user } from "./auth"

/**
 * One guest's access to one project.
 *
 * Guests are organization members with `role = 'guest'`; this table is what
 * narrows them down from "the whole org" to a specific set of projects. A guest
 * on three projects has three rows here and a single `member` row.
 *
 * Rows are created at invite time with `userId` null (pending) and bound to the
 * user once they accept — see the `afterAcceptInvitation` hook in
 * packages/auth/src/index.ts.
 */
export const projectGuestGrant = pgTable(
  "project_guest_grant",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // A public.projects id (Paper Tiger dashboard). Loose reference, same
    // convention as capture_public_key.project_id.
    projectId: text("project_id").notNull(),
    // Always set and always lowercase — it is how a pending grant finds its
    // user at accept time, and it keeps the row meaningful before signup.
    email: text("email").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    invitationId: text("invitation_id").references(() => invitation.id, {
      onDelete: "set null",
    }),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_guest_grant_org_project_email_uidx").on(
      table.organizationId,
      table.projectId,
      table.email
    ),
    index("project_guest_grant_userId_idx").on(table.userId),
    index("project_guest_grant_organizationId_projectId_idx").on(
      table.organizationId,
      table.projectId
    ),
    index("project_guest_grant_invitationId_idx").on(table.invitationId),
  ]
)

export const projectGuestGrantRelations = relations(
  projectGuestGrant,
  ({ one }) => ({
    organization: one(organization, {
      fields: [projectGuestGrant.organizationId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [projectGuestGrant.userId],
      references: [user.id],
    }),
    invitation: one(invitation, {
      fields: [projectGuestGrant.invitationId],
      references: [invitation.id],
    }),
  })
)
