import { db } from "@crikket/db"
import { member } from "@crikket/db/schema/auth"
import { bugReportComment } from "@crikket/db/schema/bug-report"
import {
  BUG_REPORT_COMMENT_VISIBILITY_OPTIONS,
  type BugReportCommentVisibility,
} from "@crikket/shared/constants/bug-report"
import { ORPCError } from "@orpc/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"
import {
  assertBugReportAccessById,
  type ReportViewerAccess,
} from "../lib/utils"
import { o, protectedProcedure } from "./context"

const commentVisibilityValues = Object.values(
  BUG_REPORT_COMMENT_VISIBILITY_OPTIONS
) as [BugReportCommentVisibility, ...BugReportCommentVisibility[]]

const MAX_COMMENT_LENGTH = 10_000

export interface BugReportCommentAuthor {
  id: string
  name: string
  /** Only exposed to organization members — not to guests. */
  email: string | null
  avatarUrl: string | null
  isGuest: boolean
}

export interface BugReportCommentItem {
  id: string
  body: string
  visibility: BugReportCommentVisibility
  authorId: string | null
  author: BugReportCommentAuthor | null
  createdAt: string
  updatedAt: string
  /** The current viewer authored this comment, so may edit/delete it. */
  canModify: boolean
}

/** Only real organization members (not guests, not anonymous) see member-only. */
function canSeeMemberOnly(access: ReportViewerAccess): boolean {
  return access.canAccessPrivate && !access.isGuest
}

const listInputSchema = z.object({ bugReportId: z.string().min(1) })

/**
 * Comments on a bug report. Readable by anyone who can see the report (members,
 * granted guests, and public-share viewers), but member-only comments are
 * filtered out for guests and anonymous viewers.
 */
export const listBugReportComments = o
  .input(listInputSchema)
  .handler(async ({ context, input }): Promise<BugReportCommentItem[]> => {
    const { access, organizationId } = await assertBugReportAccessById({
      id: input.bugReportId,
      session: context.session,
    })

    const memberView = canSeeMemberOnly(access)

    const rows = await db.query.bugReportComment.findMany({
      where: eq(bugReportComment.bugReportId, input.bugReportId),
      orderBy: asc(bugReportComment.createdAt),
      with: {
        author: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
    })

    // Which authors are guests of this org — drives the dashed avatar ring.
    const authorIds = [
      ...new Set(rows.map((row) => row.authorId).filter((id) => id !== null)),
    ] as string[]
    const guestAuthorIds = new Set<string>()
    if (authorIds.length > 0) {
      const memberships = await db.query.member.findMany({
        where: and(
          eq(member.organizationId, organizationId),
          inArray(member.userId, authorIds)
        ),
        columns: { userId: true, role: true },
      })
      for (const m of memberships) {
        if (m.role === "guest") {
          guestAuthorIds.add(m.userId)
        }
      }
    }

    const currentUserId = context.session?.user.id ?? null

    return rows
      .filter(
        (row) =>
          memberView ||
          row.visibility !== BUG_REPORT_COMMENT_VISIBILITY_OPTIONS.memberOnly
      )
      .map((row) => ({
        id: row.id,
        body: row.body,
        visibility: row.visibility as BugReportCommentVisibility,
        authorId: row.authorId,
        author: row.author
          ? {
              id: row.author.id,
              name: row.author.name,
              // Staff emails stay internal: guests never receive them.
              email: memberView ? (row.author.email ?? null) : null,
              avatarUrl: row.author.image ?? null,
              isGuest: guestAuthorIds.has(row.author.id),
            }
          : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        canModify: Boolean(currentUserId && row.authorId === currentUserId),
      }))
  })

const createInputSchema = z.object({
  bugReportId: z.string().min(1),
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
  visibility: z
    .enum(commentVisibilityValues)
    .default(BUG_REPORT_COMMENT_VISIBILITY_OPTIONS.everyone),
})

export const createBugReportComment = protectedProcedure
  .input(createInputSchema)
  .handler(async ({ context, input }): Promise<{ id: string }> => {
    const { access } = await assertBugReportAccessById({
      id: input.bugReportId,
      session: context.session,
    })

    // Members and granted guests may comment; outsiders / anonymous cannot.
    if (!access.canAccessPrivate) {
      throw new ORPCError("FORBIDDEN", {
        message: "You do not have access to comment on this report.",
      })
    }

    // Guests may only post comments visible to everyone.
    if (
      access.isGuest &&
      input.visibility === BUG_REPORT_COMMENT_VISIBILITY_OPTIONS.memberOnly
    ) {
      throw new ORPCError("FORBIDDEN", {
        message: "Guests can only post comments visible to everyone.",
      })
    }

    const id = nanoid(16)
    await db.insert(bugReportComment).values({
      id,
      bugReportId: input.bugReportId,
      authorId: context.session.user.id,
      body: input.body,
      visibility: input.visibility,
    })

    return { id }
  })

const updateInputSchema = z.object({
  id: z.string().min(1),
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
})

export const updateBugReportComment = protectedProcedure
  .input(updateInputSchema)
  .handler(async ({ context, input }): Promise<{ id: string }> => {
    const existing = await db.query.bugReportComment.findFirst({
      where: eq(bugReportComment.id, input.id),
      columns: { id: true, authorId: true, bugReportId: true },
    })

    if (!existing) {
      throw new ORPCError("NOT_FOUND", { message: "Comment not found" })
    }

    // Defense in depth: confirm the viewer can still see the report at all.
    await assertBugReportAccessById({
      id: existing.bugReportId,
      session: context.session,
    })

    if (existing.authorId !== context.session.user.id) {
      throw new ORPCError("FORBIDDEN", {
        message: "You can only edit your own comments.",
      })
    }

    await db
      .update(bugReportComment)
      .set({ body: input.body })
      .where(eq(bugReportComment.id, input.id))

    return { id: input.id }
  })

const deleteInputSchema = z.object({ id: z.string().min(1) })

export const deleteBugReportComment = protectedProcedure
  .input(deleteInputSchema)
  .handler(async ({ context, input }): Promise<{ id: string }> => {
    const existing = await db.query.bugReportComment.findFirst({
      where: eq(bugReportComment.id, input.id),
      columns: { id: true, authorId: true },
    })

    if (!existing) {
      throw new ORPCError("NOT_FOUND", { message: "Comment not found" })
    }

    if (existing.authorId !== context.session.user.id) {
      throw new ORPCError("FORBIDDEN", {
        message: "You can only delete your own comments.",
      })
    }

    await db.delete(bugReportComment).where(eq(bugReportComment.id, input.id))

    return { id: input.id }
  })
