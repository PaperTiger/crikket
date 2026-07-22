import { boolean, numeric, pgSchema, text } from "drizzle-orm/pg-core"

/**
 * Read-only references to the Paper Tiger dashboard tables in the `public`
 * schema. Crikket does NOT own or migrate these — they are the single source
 * of truth for projects and people, synced by the dashboard app. Defined here
 * (outside `src/schema/`, and `crikket`-scoped in drizzle.config) so drizzle-kit
 * never tries to manage them; used only for cross-schema joins.
 *
 * Only the columns Crikket needs are declared.
 */
const paperTiger = pgSchema("public")

export const ptProjects = paperTiger.table("projects", {
  id: text("id").primaryKey(),
  name: text("name"),
  clientName: text("client_name"),
  companyId: text("company_id"),
  status: text("status"),
  projectStatus: text("project_status"),
})

export const ptPeople = paperTiger.table("people", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  discipline: text("discipline"),
  avatarUrl: text("avatar_url"),
  role: text("role"),
  status: text("status"),
  former: boolean("former"),
  dailyCapacity: numeric("daily_capacity"),
})
