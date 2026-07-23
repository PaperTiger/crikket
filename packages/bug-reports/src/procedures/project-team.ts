import { db } from "@crikket/db"
import { member, user } from "@crikket/db/schema/auth"
import { projectTeamMember } from "@crikket/db/schema/project-team"
import { ORPCError } from "@orpc/server"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure } from "./context"
import { requireOrgMember } from "./helpers"

const GUEST_ROLE = "guest"

export interface TeamMemberSummary {
  userId: string
  name: string
  email: string
  image: string | null
  role: string
}

const teamMemberInputSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
})

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Team changes are self-service for your own membership and admin-only for
 * everyone else's. Adding yourself to a project is a personal preference about
 * what you follow; putting someone else on one is a call about their work.
 */
async function assertCanManageTeamFor(input: {
  organizationId: string
  actorUserId: string
  targetUserId: string
}): Promise<void> {
  if (input.actorUserId === input.targetUserId) {
    return
  }

  const actor = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, input.organizationId),
      eq(member.userId, input.actorUserId)
    ),
    columns: { role: true },
  })

  if (!(actor && (actor.role === "owner" || actor.role === "admin"))) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Only organization admins or owners can change someone else's projects.",
    })
  }
}

/** The target has to be a real, non-guest member of this organization. */
async function assertTargetIsTeammate(input: {
  organizationId: string
  userId: string
}): Promise<void> {
  const target = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, input.organizationId),
      eq(member.userId, input.userId)
    ),
    columns: { role: true },
  })

  if (!target) {
    throw new ORPCError("NOT_FOUND", {
      message: "That person is not a member of this organization.",
    })
  }

  if (target.role === GUEST_ROLE) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Guests belong to projects through their guest access, not the team.",
    })
  }
}

/**
 * Confirm the project belongs to the organization — it has at least one capture
 * key assigned to it. Mirrors the check in project-access.ts.
 */
async function assertProjectBelongsToOrg(input: {
  organizationId: string
  projectId: string
}): Promise<void> {
  const result = await db.execute(sql`
    select 1
    from "capture_public_key"
    where "organization_id" = ${input.organizationId}
      and "project_id" = ${input.projectId}
    limit 1
  `)

  if (result.rows.length === 0) {
    throw new ORPCError("NOT_FOUND", {
      message: "Project not found in this organization.",
    })
  }
}

export const addProjectTeamMember = protectedProcedure
  .input(teamMemberInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = await requireOrgMember(context.session)
    const actorUserId = context.session.user.id

    await assertCanManageTeamFor({
      organizationId,
      actorUserId,
      targetUserId: input.userId,
    })
    await Promise.all([
      assertProjectBelongsToOrg({ organizationId, projectId: input.projectId }),
      assertTargetIsTeammate({ organizationId, userId: input.userId }),
    ])

    await db
      .insert(projectTeamMember)
      .values({
        id: newId(),
        organizationId,
        projectId: input.projectId,
        userId: input.userId,
        addedBy: actorUserId,
      })
      .onConflictDoNothing()

    return { added: true }
  })

export const removeProjectTeamMember = protectedProcedure
  .input(teamMemberInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = await requireOrgMember(context.session)

    await assertCanManageTeamFor({
      organizationId,
      actorUserId: context.session.user.id,
      targetUserId: input.userId,
    })

    const deleted = await db
      .delete(projectTeamMember)
      .where(
        and(
          eq(projectTeamMember.organizationId, organizationId),
          eq(projectTeamMember.projectId, input.projectId),
          eq(projectTeamMember.userId, input.userId)
        )
      )
      .returning({ id: projectTeamMember.id })

    // Removing someone who isn't on the project is a no-op, not an error — the
    // UI can race with another tab.
    return { removed: deleted.length > 0 }
  })

/**
 * Teams for many projects in one query, so project lists can render avatar
 * stacks without a request per row.
 */
export const listProjectTeams = protectedProcedure
  .input(
    z
      .object({ projectIds: z.array(z.string().min(1)).max(200).optional() })
      .optional()
  )
  .handler(
    async ({
      context,
      input,
    }): Promise<Record<string, TeamMemberSummary[]>> => {
      const organizationId = await requireOrgMember(context.session)

      const filters = [eq(projectTeamMember.organizationId, organizationId)]
      if (input?.projectIds && input.projectIds.length > 0) {
        filters.push(inArray(projectTeamMember.projectId, input.projectIds))
      }

      const rows = await db
        .select({
          projectId: projectTeamMember.projectId,
          userId: projectTeamMember.userId,
          name: user.name,
          email: user.email,
          image: user.image,
          role: member.role,
        })
        .from(projectTeamMember)
        .innerJoin(user, eq(projectTeamMember.userId, user.id))
        .leftJoin(
          member,
          and(
            eq(member.userId, projectTeamMember.userId),
            eq(member.organizationId, projectTeamMember.organizationId)
          )
        )
        .where(and(...filters))
        .orderBy(asc(projectTeamMember.createdAt))

      const byProject: Record<string, TeamMemberSummary[]> = {}

      for (const row of rows) {
        const summary: TeamMemberSummary = {
          userId: row.userId,
          name: row.name,
          email: row.email,
          image: row.image,
          role: row.role ?? "member",
        }
        const existing = byProject[row.projectId]
        if (existing) {
          existing.push(summary)
        } else {
          byProject[row.projectId] = [summary]
        }
      }

      return byProject
    }
  )

/**
 * The organization's members (never guests), for the team filter and the
 * "add someone" picker.
 */
export const listOrgTeammates = protectedProcedure.handler(
  async ({ context }): Promise<TeamMemberSummary[]> => {
    const organizationId = await requireOrgMember(context.session)

    const rows = await db
      .select({
        userId: member.userId,
        role: member.role,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt))

    return rows
      .filter((row) => row.role !== GUEST_ROLE)
      .map((row) => ({
        userId: row.userId,
        name: row.name,
        email: row.email,
        image: row.image,
        role: row.role,
      }))
  }
)
