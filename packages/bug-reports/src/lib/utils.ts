import type { auth } from "@crikket/auth"
import { db } from "@crikket/db"
import { member } from "@crikket/db/schema/auth"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  BUG_REPORT_STATUS_OPTIONS,
  BUG_REPORT_SUBMISSION_STATUS_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportStatus,
  type BugReportSubmissionStatus,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { findProjectIdForCaptureKey, getGuestProjectIds } from "./project-scope"
import { shouldExposeBugReportToViewer } from "./read-access-policy"

const attachmentTypes = ["video", "screenshot"] as const
export const visibilityValues = Object.values(
  BUG_REPORT_VISIBILITY_OPTIONS
) as [BugReportVisibility, ...BugReportVisibility[]]
export const statusValues = Object.values(BUG_REPORT_STATUS_OPTIONS) as [
  BugReportStatus,
  ...BugReportStatus[],
]
const DEFAULT_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE = 10
const MAX_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE = 200

export type SessionContext = typeof auth.$Infer.Session

export const bugReportIdInputSchema = z.object({
  id: z.string().min(1),
})

export const debuggerNetworkRequestsInputSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().optional(),
  search: z
    .string()
    .max(200)
    .transform((value) => value.trim())
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
})

export const debuggerNetworkRequestPayloadInputSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
})

export const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))

export const metadataInputSchema = z
  .object({
    duration: z.string().max(20).optional(),
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .max(24 * 60 * 60 * 1000)
      .nullable()
      .optional()
      .transform((value) => value ?? undefined),
    thumbnailUrl: z.string().url().optional(),
    pageTitle: z.string().max(300).optional(),
    sdkVersion: z.string().max(40).optional(),
    submittedVia: z.string().max(40).optional(),
  })
  .optional()

export function isAttachmentType(
  value: unknown
): value is (typeof attachmentTypes)[number] {
  return (
    typeof value === "string" &&
    (attachmentTypes as readonly string[]).includes(value)
  )
}

export function isVisibility(
  value: unknown
): value is (typeof visibilityValues)[number] {
  return (
    typeof value === "string" &&
    (visibilityValues as readonly string[]).includes(value)
  )
}

export function isStatus(
  value: unknown
): value is (typeof statusValues)[number] {
  return (
    typeof value === "string" &&
    (statusValues as readonly string[]).includes(value)
  )
}

/**
 * What a viewer is allowed to do with one report.
 *
 * Resolved once per request and threaded through, because the answer for a
 * guest depends on a database lookup (which projects they were granted) rather
 * than on the session alone.
 */
export interface ReportViewerAccess {
  /** Sees the report at all when it is private. */
  canAccessPrivate: boolean
  /** Title, tags, assignee, visibility, delete — organization members only. */
  canEdit: boolean
  /** Status and priority — organization members and granted guests. */
  canTriage: boolean
  /**
   * A guest of this organization. Guests are barred from console and network
   * payloads, which can carry internal API responses and tokens.
   */
  isGuest: boolean
}

/**
 * Anonymous viewers and people outside the organization. `isGuest` is false, so
 * public share links keep their console and network panels — visibility is what
 * gates them, and it only ever lets them reach public reports.
 */
const NO_MEMBERSHIP: ReportViewerAccess = {
  canAccessPrivate: false,
  canEdit: false,
  canTriage: false,
  isGuest: false,
}

/** Console and network panels are hidden from guests only. */
export function canViewDebugger(access: ReportViewerAccess): boolean {
  return !access.isGuest
}

/**
 * Being in the right organization is not enough on its own: guests are
 * organization members too, and are limited to the projects granted to them in
 * `project_guest_grant`.
 */
export async function resolveReportViewerAccess(input: {
  organizationId: string
  capturePublicKeyId?: string | null
  session?: SessionContext
}): Promise<ReportViewerAccess> {
  const userId = input.session?.user.id
  const activeOrgId = input.session?.session.activeOrganizationId

  if (!(userId && activeOrgId) || activeOrgId !== input.organizationId) {
    return NO_MEMBERSHIP
  }

  const activeMember = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, input.organizationId),
      eq(member.userId, userId)
    ),
    columns: { role: true },
  })

  if (!activeMember) {
    return NO_MEMBERSHIP
  }

  if (activeMember.role !== "guest") {
    return {
      canAccessPrivate: true,
      canEdit: true,
      canTriage: true,
      isGuest: false,
    }
  }

  const projectId = await findProjectIdForCaptureKey(
    input.capturePublicKeyId ?? null
  )
  const grantedProjectIds = projectId
    ? await getGuestProjectIds({ userId, organizationId: input.organizationId })
    : []

  if (!(projectId && grantedProjectIds.includes(projectId))) {
    // A guest outside their granted projects is treated like an outsider: they
    // still see the report if it is public, and nothing otherwise.
    return { ...NO_MEMBERSHIP, isGuest: true }
  }

  // Guests read and triage; everything else stays with the organization.
  return {
    canAccessPrivate: true,
    canEdit: false,
    canTriage: true,
    isGuest: true,
  }
}

export function assertVisibilityAccess(input: {
  visibility: unknown
  access: ReportViewerAccess
}): "public" | "private" {
  const visibility = isVisibility(input.visibility)
    ? input.visibility
    : "private"
  if (visibility === "public") {
    return visibility
  }

  if (input.access.canAccessPrivate) {
    return visibility
  }

  throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
}

export function isSubmissionStatus(
  value: unknown
): value is BugReportSubmissionStatus {
  return (
    typeof value === "string" &&
    Object.values(BUG_REPORT_SUBMISSION_STATUS_OPTIONS).includes(
      value as BugReportSubmissionStatus
    )
  )
}

export function normalizeDebuggerNetworkRequestPagination(input: {
  page?: number
  perPage?: number
}) {
  const page = input.page ?? 1
  const safePerPage =
    input.perPage ?? DEFAULT_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE
  const perPage = Math.min(
    MAX_DEBUGGER_NETWORK_REQUEST_PAGE_SIZE,
    Math.max(1, safePerPage)
  )
  const offset = (page - 1) * perPage

  return {
    page,
    perPage,
    offset,
    limit: perPage,
  }
}

export function buildFallbackTitle(
  attachmentType: "video" | "screenshot"
): string {
  const now = new Date()
  const label =
    attachmentType === "video" ? "Video Bug Report" : "Screenshot Bug Report"
  const timestamp = now.toISOString().replace("T", " ").slice(0, 16)
  return `${label} - ${timestamp}`
}

export function formatDurationMs(durationMs: number): string {
  const safeDurationMs = Math.max(0, Math.floor(durationMs))
  const totalSeconds = Math.floor(safeDurationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export async function assertBugReportAccessById(input: {
  id: string
  session?: SessionContext
  /** Reject viewers who cannot see console/network payloads. */
  requireDebuggerAccess?: boolean
}): Promise<{
  access: ReportViewerAccess
  canAccessUnready: boolean
  organizationId: string
  submissionStatus: BugReportSubmissionStatus
  visibility: "public" | "private"
}> {
  const report = await db.query.bugReport.findFirst({
    where: eq(bugReport.id, input.id),
    columns: {
      id: true,
      organizationId: true,
      capturePublicKeyId: true,
      submissionStatus: true,
      visibility: true,
    },
  })

  if (!report) {
    throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
  }

  const access = await resolveReportViewerAccess({
    organizationId: report.organizationId,
    capturePublicKeyId: report.capturePublicKeyId,
    session: input.session,
  })
  const visibility = assertVisibilityAccess({
    access,
    visibility: report.visibility,
  })

  if (input.requireDebuggerAccess && !canViewDebugger(access)) {
    throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
  }

  const canAccessUnready = access.canAccessPrivate
  const submissionStatus = isSubmissionStatus(report.submissionStatus)
    ? report.submissionStatus
    : BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready

  if (
    !shouldExposeBugReportToViewer({
      canAccessUnready,
      submissionStatus,
    })
  ) {
    throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
  }

  return {
    access,
    canAccessUnready,
    organizationId: report.organizationId,
    submissionStatus,
    visibility,
  }
}
