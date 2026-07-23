import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import { ORPCError } from "@orpc/server"
import { and, eq, inArray, type SQL } from "drizzle-orm"
import { z } from "zod"
import { findForbiddenGuestFields } from "../lib/guest-write-policy"
import { buildProjectScopeFilter } from "../lib/project-scope"
import {
  categoryValues,
  isCategory,
  isStatus,
  isVisibility,
  optionalText,
  statusValues,
  visibilityValues,
} from "../lib/utils"
import { protectedProcedure } from "./context"
import {
  normalizeTags,
  type ProjectViewer,
  requireOrgMember,
  requireProjectViewer,
} from "./helpers"

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]

const tagsInputSchema = z.array(z.string().trim().min(1).max(40)).max(20)

// A public.people id (Paper Tiger dashboard). `null` clears the assignee.
const assigneeIdInputSchema = z.string().min(1).nullable()

const bugReportUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    title: optionalText(200),
    status: z.enum(statusValues).optional(),
    priority: z.enum(priorityValues).optional(),
    category: z.enum(categoryValues).optional(),
    visibility: z.enum(visibilityValues).optional(),
    tags: tagsInputSchema.optional(),
    assigneeId: assigneeIdInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.title === undefined &&
      value.status === undefined &&
      value.priority === undefined &&
      value.category === undefined &&
      value.visibility === undefined &&
      value.tags === undefined &&
      value.assigneeId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required",
      })
    }
  })

const bugReportBulkUpdateInputSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    status: z.enum(statusValues).optional(),
    priority: z.enum(priorityValues).optional(),
    visibility: z.enum(visibilityValues).optional(),
    tags: tagsInputSchema.optional(),
    assigneeId: assigneeIdInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === undefined &&
      value.priority === undefined &&
      value.visibility === undefined &&
      value.tags === undefined &&
      value.assigneeId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required",
      })
    }
  })

function assertViewerMayUpdate(
  viewer: ProjectViewer,
  input: Record<string, unknown>
): SQL[] {
  if (!viewer.isGuest) {
    return []
  }

  const forbiddenFields = findForbiddenGuestFields(input)

  if (forbiddenFields.length > 0) {
    throw new ORPCError("FORBIDDEN", {
      message: `Guests can only change status and priority (attempted: ${forbiddenFields.join(", ")}).`,
    })
  }

  return [buildProjectScopeFilter(viewer.guestProjectIds ?? [])]
}

function buildUpdateValues(input: {
  title?: string
  status?: (typeof statusValues)[number]
  priority?: Priority
  category?: (typeof categoryValues)[number]
  visibility?: (typeof visibilityValues)[number]
  tags?: string[]
  assigneeId?: string | null
}) {
  const values: {
    title?: string
    status?: string
    priority?: string
    category?: string
    visibility?: string
    tags?: string[]
    assigneeId?: string | null
  } = {}

  if (input.title !== undefined) {
    values.title = input.title
  }

  if (input.status !== undefined) {
    values.status = input.status
  }

  if (input.priority !== undefined) {
    values.priority = input.priority
  }

  if (input.category !== undefined) {
    values.category = input.category
  }

  if (input.visibility !== undefined) {
    values.visibility = input.visibility
  }

  if (input.tags !== undefined) {
    values.tags = normalizeTags(input.tags) ?? []
  }

  if (input.assigneeId !== undefined) {
    values.assigneeId = input.assigneeId
  }

  return values
}

export const updateBugReport = protectedProcedure
  .input(bugReportUpdateInputSchema)
  .handler(async ({ context, input }) => {
    const viewer = await requireProjectViewer(context.session)
    const viewerFilters = assertViewerMayUpdate(viewer, input)
    const values = buildUpdateValues(input)

    const updated = await db
      .update(bugReport)
      .set(values)
      .where(
        and(
          eq(bugReport.id, input.id),
          eq(bugReport.organizationId, viewer.organizationId),
          ...viewerFilters
        )
      )
      .returning({
        id: bugReport.id,
        title: bugReport.title,
        status: bugReport.status,
        priority: bugReport.priority,
        category: bugReport.category,
        visibility: bugReport.visibility,
        tags: bugReport.tags,
      })

    const report = updated[0]
    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

    return {
      id: report.id,
      title: report.title,
      status: isStatus(report.status) ? report.status : statusValues[0],
      priority: priorityValues.includes(report.priority as Priority)
        ? (report.priority as Priority)
        : PRIORITY_OPTIONS.none,
      category: isCategory(report.category) ? report.category : null,
      visibility: isVisibility(report.visibility)
        ? report.visibility
        : visibilityValues[1],
      tags: Array.isArray(report.tags) ? report.tags : [],
    }
  })

export const updateBugReportsBulk = protectedProcedure
  .input(bugReportBulkUpdateInputSchema)
  .handler(async ({ context, input }) => {
    const viewer = await requireProjectViewer(context.session)
    const viewerFilters = assertViewerMayUpdate(viewer, input)
    const values = buildUpdateValues(input)
    const uniqueIds = Array.from(new Set(input.ids))

    const updated = await db
      .update(bugReport)
      .set(values)
      .where(
        and(
          eq(bugReport.organizationId, viewer.organizationId),
          inArray(bugReport.id, uniqueIds),
          ...viewerFilters
        )
      )
      .returning({ id: bugReport.id })

    return {
      updatedCount: updated.length,
      ids: updated.map((row) => row.id),
    }
  })

export const updateBugReportVisibility = protectedProcedure
  .input(
    z.object({
      id: z.string().min(1),
      visibility: z.enum(visibilityValues),
    })
  )
  .handler(async ({ context, input }) => {
    // Visibility controls public share links — organization members only.
    const activeOrgId = await requireOrgMember(context.session)

    const updated = await db
      .update(bugReport)
      .set({ visibility: input.visibility })
      .where(
        and(
          eq(bugReport.id, input.id),
          eq(bugReport.organizationId, activeOrgId)
        )
      )
      .returning({ id: bugReport.id, visibility: bugReport.visibility })

    const report = updated[0]
    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Bug report not found" })
    }

    return {
      id: report.id,
      visibility: isVisibility(report.visibility)
        ? report.visibility
        : visibilityValues[1],
    }
  })
