import { db } from "@crikket/db"
import { ptProjects } from "@crikket/db/external/paper-tiger"
import { capturePublicKey } from "@crikket/db/schema/bug-report"
import { and, count, desc, eq, ilike, isNotNull } from "drizzle-orm"
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
 */
export const listCrikketProjects = protectedProcedure.handler(
  async ({ context }): Promise<CrikketProject[]> => {
    const activeOrgId = requireActiveOrgId(context.session)

    const rows = await db
      .select({
        id: ptProjects.id,
        name: ptProjects.name,
        clientName: ptProjects.clientName,
        keyCount: count(capturePublicKey.id),
      })
      .from(capturePublicKey)
      .innerJoin(ptProjects, eq(capturePublicKey.projectId, ptProjects.id))
      .where(
        and(
          eq(capturePublicKey.organizationId, activeOrgId),
          isNotNull(capturePublicKey.projectId)
        )
      )
      .groupBy(ptProjects.id, ptProjects.name, ptProjects.clientName)
      .orderBy(ptProjects.name)

    return rows.map((row) => ({
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
    const rows = await db
      .select({
        id: ptProjects.id,
        name: ptProjects.name,
        clientName: ptProjects.clientName,
      })
      .from(ptProjects)
      .where(
        input.query ? ilike(ptProjects.name, `%${input.query}%`) : undefined
      )
      .orderBy(desc(ptProjects.projectStatus), ptProjects.name)
      .limit(input.limit)

    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled project",
      clientName: row.clientName,
    }))
  })
