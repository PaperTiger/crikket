import { relations } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { organization, user } from "./auth"

/**
 * Which projects an organization member is working on.
 *
 * NOT a permission boundary — this is the important difference from
 * `project_guest_grant`, which the table otherwise mirrors. Org members can see
 * every report in their organization whether or not they are on its team;
 * membership here answers "which projects am I working on", so notifications
 * can be targeted and the sidebar and dashboard can be narrowed to a person's
 * own work.
 *
 * Nothing in the read path may ever consult this table.
 */
export const projectTeamMember = pgTable(
  "project_team_member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // A public.projects id (Paper Tiger dashboard). Loose reference, same
    // convention as capture_public_key.project_id.
    projectId: text("project_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addedBy: text("added_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_team_member_org_project_user_uidx").on(
      table.organizationId,
      table.projectId,
      table.userId
    ),
    index("project_team_member_userId_idx").on(table.userId),
    index("project_team_member_organizationId_projectId_idx").on(
      table.organizationId,
      table.projectId
    ),
  ]
)

export const projectTeamMemberRelations = relations(
  projectTeamMember,
  ({ one }) => ({
    organization: one(organization, {
      fields: [projectTeamMember.organizationId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [projectTeamMember.userId],
      references: [user.id],
    }),
  })
)
