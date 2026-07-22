import { boolean, numeric, pgTable, text } from "drizzle-orm/pg-core"

/**
 * Read-only references to the Paper Tiger dashboard tables in the `public`
 * schema. Crikket does NOT own or migrate these — they are the single source
 * of truth for projects and people, synced by the dashboard app. Used only for
 * cross-schema joins.
 *
 * NOTE: these MUST use `pgTable` (not `pgSchema("public")`) — drizzle throws at
 * module load if you pass "public" to pgSchema, which crashes the whole server.
 * The connection's search_path (crikket, public) resolves these unqualified
 * names to `public` because the crikket schema has no projects/people tables.
 *
 * Only the columns Crikket needs are declared.
 */
export const ptProjects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name"),
  clientName: text("client_name"),
  companyId: text("company_id"),
  status: text("status"),
  projectStatus: text("project_status"),
})

export const ptPeople = pgTable("people", {
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
