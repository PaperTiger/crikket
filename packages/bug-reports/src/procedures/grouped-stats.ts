import { db } from "@crikket/db"
import { BUG_REPORT_STATUS_OPTIONS } from "@crikket/shared/constants/bug-report"
import { type SQL, sql } from "drizzle-orm"
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
  /** Raw group id (project id / assignee people id / page url); null = ungrouped. */
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
  projectId: z.string().min(1).optional(),
})

interface RawGroupRow {
  groupKey: string | null
  groupLabel: string | null
  toDo: number
  inProgress: number
  clientReview: number
  blocked: number
  done: number
  closed: number
  total: number
}

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
  return key && key.length > 0 ? key : "Unknown page"
}

// Cross-schema reads use raw SQL with an explicit `public.` qualifier (the app
// connects with search_path=crikket). See people.ts for the rationale.
export const getBugReportGroupedStats = protectedProcedure
  .input(getBugReportGroupedStatsInputSchema)
  .handler(async ({ context, input }): Promise<BugReportGroupedStats> => {
    const activeOrgId = requireActiveOrgId(context.session)
    const term = input.search ? `%${input.search}%` : undefined

    // Reports whose capture key is assigned to this project, via the same
    // bug_report -> capture_public_key -> project chain used elsewhere. A
    // subquery rather than a join, so it applies to every grouping (only the
    // project grouping joins capture_public_key).
    const projectSql = input.projectId
      ? sql`and b."capture_public_key_id" in (
          select pk."id" from "capture_public_key" pk
          where pk."project_id" = ${input.projectId}
        )`
      : sql``

    const whereSql = sql`b."organization_id" = ${activeOrgId}
      ${input.includeClosed ? sql`` : sql`and b."status" <> ${BUG_REPORT_STATUS_OPTIONS.closed}`}
      ${
        term
          ? sql`and (b."title" ilike ${term} or b."description" ilike ${term} or b."url" ilike ${term})`
          : sql``
      }
      ${projectSql}`

    const countCols = sql`
      sum(case when b."status" = ${BUG_REPORT_STATUS_OPTIONS.toDo} then 1 else 0 end)::int as "toDo",
      sum(case when b."status" = ${BUG_REPORT_STATUS_OPTIONS.inProgress} then 1 else 0 end)::int as "inProgress",
      sum(case when b."status" = ${BUG_REPORT_STATUS_OPTIONS.clientReview} then 1 else 0 end)::int as "clientReview",
      sum(case when b."status" = ${BUG_REPORT_STATUS_OPTIONS.blocked} then 1 else 0 end)::int as "blocked",
      sum(case when b."status" = ${BUG_REPORT_STATUS_OPTIONS.done} then 1 else 0 end)::int as "done",
      sum(case when b."status" = ${BUG_REPORT_STATUS_OPTIONS.closed} then 1 else 0 end)::int as "closed",
      count(*)::int as "total"`

    let query: SQL
    if (input.groupBy === "assignee") {
      query = sql`
        select b."assignee_id" as "groupKey", pe."name" as "groupLabel", ${countCols}
        from "bug_report" b
        left join "public"."people" pe on b."assignee_id" = pe."id"
        where ${whereSql}
        group by b."assignee_id", pe."name"`
    } else if (input.groupBy === "page") {
      const pageKey = sql`split_part(coalesce(b."url", ''), '?', 1)`
      query = sql`
        select ${pageKey} as "groupKey", ${pageKey} as "groupLabel", ${countCols}
        from "bug_report" b
        where ${whereSql}
        group by ${pageKey}`
    } else {
      query = sql`
        select k."project_id" as "groupKey", p."name" as "groupLabel", ${countCols}
        from "bug_report" b
        left join "capture_public_key" k on b."capture_public_key_id" = k."id"
        left join "public"."projects" p on k."project_id" = p."id"
        where ${whereSql}
        group by k."project_id", p."name"`
    }

    const result = await db.execute(query)
    const rawRows = result.rows as unknown as RawGroupRow[]

    const rows: BugReportGroupRow[] = rawRows
      .map((row) => ({
        groupKey: row.groupKey,
        groupLabel: resolveLabel(input.groupBy, row.groupKey, row.groupLabel),
        toDo: Number(row.toDo ?? 0),
        inProgress: Number(row.inProgress ?? 0),
        clientReview: Number(row.clientReview ?? 0),
        blocked: Number(row.blocked ?? 0),
        done: Number(row.done ?? 0),
        closed: Number(row.closed ?? 0),
        total: Number(row.total ?? 0),
      }))
      .sort((a, b) => b.total - a.total)

    return { groupBy: input.groupBy, rows }
  })
