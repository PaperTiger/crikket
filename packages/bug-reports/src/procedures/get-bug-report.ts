import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import { ORPCError } from "@orpc/server"
import { eq, sql } from "drizzle-orm"
import { resolveCaptureUrl } from "../lib/storage"
import {
  assertBugReportAccessById,
  assertVisibilityAccess,
  bugReportIdInputSchema,
  isStatus,
  statusValues,
} from "../lib/utils"
import { o } from "./context"

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]

export interface ReportProject {
  id: string
  name: string
}

/**
 * Resolve the project a report belongs to, via its capture key.
 *
 * Raw SQL with an explicit `public.` qualifier — see people.ts for why.
 * `capture_public_key` is unqualified so it resolves to the crikket schema.
 */
async function findReportProject(
  capturePublicKeyId: string | null
): Promise<ReportProject | null> {
  if (!capturePublicKeyId) {
    return null
  }

  const result = await db.execute(sql`
    select p."id", p."name"
    from "capture_public_key" k
    join "public"."projects" p on k."project_id" = p."id"
    where k."id" = ${capturePublicKeyId} and k."project_id" is not null
    limit 1
  `)

  const row = (result.rows as unknown as ReportProject[])[0]
  if (!row) {
    return null
  }

  return { id: row.id, name: row.name ?? "Untitled project" }
}

export const getBugReportById = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const report = await db.query.bugReport.findFirst({
      where: eq(bugReport.id, input.id),
      with: {
        reporter: true,
        organization: true,
      },
    })

    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

    const visibility = assertVisibilityAccess({
      organizationId: report.organizationId,
      session: context.session,
      visibility: report.visibility,
    })
    const activeOrgId = context.session?.session.activeOrganizationId
    const canEdit =
      Boolean(context.session?.user) &&
      Boolean(activeOrgId) &&
      activeOrgId === report.organizationId

    const status = isStatus(report.status) ? report.status : statusValues[0]
    const priority = priorityValues.includes(report.priority as Priority)
      ? (report.priority as Priority)
      : PRIORITY_OPTIONS.none
    const attachmentUrl = await resolveCaptureUrl({
      captureKey: report.captureKey,
    })

    // Only for org members: /projects/[id] is behind auth, so exposing it to
    // public share viewers would leak the project name and give them a link
    // that just bounces to login.
    const project = canEdit
      ? await findReportProject(report.capturePublicKeyId)
      : null

    return {
      id: report.id,
      title: report.title,
      description: report.description,
      status,
      priority,
      tags: Array.isArray(report.tags) ? report.tags : [],
      url: report.url,
      attachmentUrl,
      attachmentType: report.attachmentType,
      submissionStatus: report.submissionStatus,
      debuggerIngestionStatus: report.debuggerIngestionStatus,
      debuggerIngestionError: report.debuggerIngestionError,
      visibility,
      canEdit,
      deviceInfo: report.deviceInfo,
      metadata: report.metadata,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      reporter: report.reporter
        ? {
            name: report.reporter.name,
            image: report.reporter.image,
          }
        : null,
      organization: {
        name: report.organization.name,
        logo: report.organization.logo,
      },
      project,
    }
  })
