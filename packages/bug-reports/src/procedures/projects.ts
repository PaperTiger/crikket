import { db } from "@crikket/db"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure } from "./context"
import { requireOrgMember } from "./helpers"

export interface CrikketProject {
  id: string
  name: string
  clientName: string | null
  keyCount: number
  /** User ids of the organization members working on this project. */
  teamUserIds: string[]
}

const listCrikketProjectsInputSchema = z
  .object({
    /** Only projects the caller is on — powers "My Projects" in the sidebar. */
    mineOnly: z.boolean().default(false),
    /** Only projects any of these members are on — the team filter. */
    teamMemberIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .optional()

/**
 * Projects (from public.projects) that have at least one Crikket capture key in
 * the active org. Powers the Projects nav + project pages.
 *
 * `mineOnly` and `teamMemberIds` narrow the list, but neither is a permission
 * boundary: an org member can always ask for the full list ("All Projects") and
 * can always open any project. See packages/db/src/schema/project-team.ts.
 *
 * Raw SQL with an explicit `public.` qualifier — see people.ts for why.
 * `capture_public_key` is unqualified so it resolves to the crikket schema.
 */
export const listCrikketProjects = protectedProcedure
  .input(listCrikketProjectsInputSchema)
  .handler(async ({ context, input }): Promise<CrikketProject[]> => {
    const activeOrgId = await requireOrgMember(context.session)

    const teamFilterIds = input?.teamMemberIds ?? []
    const mineOnly = input?.mineOnly ?? false

    // Built as an explicit parameter list: binding a JS array as one value makes
    // Postgres try to parse the id as an array literal.
    const teamFilterList =
      teamFilterIds.length > 0
        ? sql.join(
            teamFilterIds.map((userId) => sql`${userId}`),
            sql`, `
          )
        : null

    const havingClauses: ReturnType<typeof sql>[] = []
    if (mineOnly) {
      havingClauses.push(sql`bool_or(t."user_id" = ${context.session.user.id})`)
    }
    if (teamFilterList) {
      havingClauses.push(sql`bool_or(t."user_id" in (${teamFilterList}))`)
    }

    const result = await db.execute(sql`
      select p."id", p."name", p."client_name" as "clientName",
        count(distinct k."id")::int as "keyCount",
        coalesce(
          array_agg(distinct t."user_id") filter (where t."user_id" is not null),
          '{}'
        ) as "teamUserIds"
      from "capture_public_key" k
      join "public"."projects" p on k."project_id" = p."id"
      left join "project_team_member" t
        on t."project_id" = p."id" and t."organization_id" = ${activeOrgId}
      where k."organization_id" = ${activeOrgId} and k."project_id" is not null
      group by p."id", p."name", p."client_name"
      ${
        havingClauses.length > 0
          ? sql`having ${sql.join(havingClauses, sql` and `)}`
          : sql``
      }
      order by p."name" asc
    `)

    return (result.rows as unknown as CrikketProject[]).map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled project",
      clientName: row.clientName,
      keyCount: Number(row.keyCount ?? 0),
      teamUserIds: Array.isArray(row.teamUserIds) ? row.teamUserIds : [],
    }))
  })

export interface ProjectOption {
  id: string
  name: string
  clientName: string | null
}

const searchProjectsInputSchema = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(50).default(25),
})

/**
 * Search all public.projects by name — used by the key → project picker in
 * capture key settings.
 */
export const searchProjects = protectedProcedure
  .input(searchProjectsInputSchema)
  .handler(async ({ input }): Promise<ProjectOption[]> => {
    const term = input.query ? `%${input.query}%` : undefined
    const result = await db.execute(sql`
      select "id", "name", "client_name" as "clientName"
      from "public"."projects"
      ${term ? sql`where "name" ilike ${term}` : sql``}
      order by "project_status" desc nulls last, "name" asc
      limit ${input.limit}
    `)

    return (result.rows as unknown as ProjectOption[]).map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled project",
      clientName: row.clientName,
    }))
  })
