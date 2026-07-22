import { db } from "@crikket/db"
import { ptPeople, ptProjects } from "@crikket/db/external/paper-tiger"
import { bugReport, capturePublicKey } from "@crikket/db/schema/bug-report"
import { BUG_REPORT_STATUS_OPTIONS } from "@crikket/shared/constants/bug-report"
import {
  and,
  count,
  eq,
  ilike,
  inArray,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure } from "./context"
import { requireActiveOrgId } from "./helpers"

export const BUG_REPORT_GROUP_BY_OPTIONS = {
  project: "project",
  assignee: "assignee",
  page: "page",
} as const

export type BugReportGroupBy =
  (typeof BUG_REPORT_GROUP_BY_OPTIONS)[keyof typeof BUG_REPORT_GROUP_BY_OPTIONS]

const groupByValues = Object.values(BUG_REPORT_GROUP_BY_OPTIONS) as [
  BugReportGroupBy,
  ...BugReportGroupBy[],
]

export interface BugReportGroupRow {
  /** Raw group id (capture key id / assignee user id / page url); null = ungrouped. */
  groupKey: string | null
  /** Human label for the group row. */
  groupLabel: string
  toDo: number
  inProgress: number
  clientReview: number
  blocked: number
  done: number
  closed: number
  total: number
}

export interface BugReportGroupedStats {
  groupBy: BugReportGroupBy
  rows: BugReportGroupRow[]
}

const getBugReportGroupedStatsInputSchema = z.object({
  groupBy: z.enum(groupByValues).default(BUG_REPORT_GROUP_BY_OPTIONS.project),
  includeClosed: z.boolean().default(false),
  search: z.string().trim().max(200).optional(),
  // Scope the stats to reports whose capture key is assigned to this project.
  projectId: z.string().min(1).optional(),
})

function normalizeInt(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value
  return Number.isFinite(parsed) ? parsed : 0
}

function statusCount(status: string): SQL<number> {
  return sql<number>`sum(case when ${bugReport.status} = ${status} then 1 else 0 end)`
}

/** Empty-string page urls should read as "Unknown page", null keys as their fallback. */
function resolveLabel(
  groupBy: BugReportGroupBy,
  key: string | null,
  label: string | null
): string {
  if (groupBy === "assignee") {
    return key ? (label ?? "Unknown user") : "Unassigned"
  }
  if (groupBy === "project") {
    return key ? (label ?? "Unknown project") : "No project"
  }
  // page
  return key && key.length > 0 ? key : "Unknown page"
}

export const getBugReportGroupedStats = protectedProcedure
  .input(getBugReportGroupedStatsInputSchema)
  .handler(async ({ context, input }): Promise<BugReportGroupedStats> => {
    const activeOrgId = requireActiveOrgId(context.session)

    const conditions: SQL[] = [eq(bugReport.organizationId, activeOrgId)]
    if (!input.includeClosed) {
      conditions.push(ne(bugReport.status, BUG_REPORT_STATUS_OPTIONS.closed))
    }
    if (input.search) {
      const term = `%${input.search}%`
      const searchCondition = or(
        ilike(bugReport.title, term),
        ilike(bugReport.description, term),
        ilike(bugReport.url, term)
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
    if (input.projectId) {
      conditions.push(
        inArray(
          bugReport.capturePublicKeyId,
          db
            .select({ id: capturePublicKey.id })
            .from(capturePublicKey)
            .where(eq(capturePublicKey.projectId, input.projectId))
        )
      )
    }

    const counts = {
      toDo: statusCount(BUG_REPORT_STATUS_OPTIONS.toDo),
      inProgress: statusCount(BUG_REPORT_STATUS_OPTIONS.inProgress),
      clientReview: statusCount(BUG_REPORT_STATUS_OPTIONS.clientReview),
      blocked: statusCount(BUG_REPORT_STATUS_OPTIONS.blocked),
      done: statusCount(BUG_REPORT_STATUS_OPTIONS.done),
      closed: statusCount(BUG_REPORT_STATUS_OPTIONS.closed),
      total: count(),
    }

    // Page groups on the URL minus its query string so a route batches together.
    const pageKey = sql<string>`split_part(coalesce(${bugReport.url}, ''), '?', 1)`

    let rawRows: Array<{
      groupKey: string | null
      groupLabel: string | null
      toDo: number
      inProgress: number
      clientReview: number
      blocked: number
      done: number
      closed: number
      total: number
    }>

    if (input.groupBy === "assignee") {
      rawRows = await db
        .select({
          groupKey: bugReport.assigneeId,
          groupLabel: ptPeople.name,
          ...counts,
        })
        .from(bugReport)
        .leftJoin(ptPeople, eq(bugReport.assigneeId, ptPeople.id))
        .where(and(...conditions))
        .groupBy(bugReport.assigneeId, ptPeople.name)
    } else if (input.groupBy === "page") {
      rawRows = await db
        .select({
          groupKey: pageKey,
          groupLabel: pageKey,
          ...counts,
        })
        .from(bugReport)
        .where(and(...conditions))
        .groupBy(pageKey)
    } else {
      // Project = the project the report's capture key is assigned to.
      rawRows = await db
        .select({
          groupKey: capturePublicKey.projectId,
          groupLabel: ptProjects.name,
          ...counts,
        })
        .from(bugReport)
        .leftJoin(
          capturePublicKey,
          eq(bugReport.capturePublicKeyId, capturePublicKey.id)
        )
        .leftJoin(ptProjects, eq(capturePublicKey.projectId, ptProjects.id))
        .where(and(...conditions))
        .groupBy(capturePublicKey.projectId, ptProjects.name)
    }

    const rows: BugReportGroupRow[] = rawRows
      .map((row) => ({
        groupKey: row.groupKey,
        groupLabel: resolveLabel(input.groupBy, row.groupKey, row.groupLabel),
        toDo: normalizeInt(row.toDo),
        inProgress: normalizeInt(row.inProgress),
        clientReview: normalizeInt(row.clientReview),
        blocked: normalizeInt(row.blocked),
        done: normalizeInt(row.done),
        closed: normalizeInt(row.closed),
        total: normalizeInt(row.total),
      }))
      .sort((a, b) => b.total - a.total)

    return { groupBy: input.groupBy, rows }
  })
