import { db } from "@crikket/db"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure } from "./context"
import { requireActiveOrgId } from "./helpers"

export interface CrikketProject {
  id: string
  name: string
  clientName: string | null
  keyCount: number
}

/**
 * Projects (from public.projects) that have at least one Crikket capture key in
 * the active org. Powers the Projects nav + project pages.
 *
 * Raw SQL with an explicit `public.` qualifier — see people.ts for why.
 * `capture_public_key` is unqualified so it resolves to the crikket schema.
 */
export const listCrikketProjects = protectedProcedure.handler(
  async ({ context }): Promise<CrikketProject[]> => {
    const activeOrgId = requireActiveOrgId(context.session)

    const result = await db.execute(sql`
      select p."id", p."name", p."client_name" as "clientName",
        count(k."id")::int as "keyCount"
      from "capture_public_key" k
      join "public"."projects" p on k."project_id" = p."id"
      where k."organization_id" = ${activeOrgId} and k."project_id" is not null
      group by p."id", p."name", p."client_name"
      order by p."name" asc
    `)

    return (result.rows as unknown as CrikketProject[]).map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled project",
      clientName: row.clientName,
      keyCount: Number(row.keyCount ?? 0),
    }))
  }
)

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
