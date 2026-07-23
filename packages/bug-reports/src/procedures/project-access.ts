import { auth } from "@crikket/auth"
import { db } from "@crikket/db"
import { invitation, member, user } from "@crikket/db/schema/auth"
import { projectGuestGrant } from "@crikket/db/schema/guest-access"
import { ORPCError } from "@orpc/server"
import { and, asc, eq, sql } from "drizzle-orm"
import { z } from "zod"

import { protectedProcedure } from "./context"
import { requireActiveOrgAdmin, requireProjectViewer } from "./helpers"

const GUEST_ROLE = "guest"

const projectIdInputSchema = z.object({
  projectId: z.string().min(1),
})

const grantIdInputSchema = z.object({
  grantId: z.string().min(1),
})

const inviteGuestInputSchema = z.object({
  projectId: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(320),
})

export interface ProjectOrgMember {
  id: string
  userId: string
  name: string
  email: string
  image: string | null
  role: string
}

export interface ProjectGuest {
  grantId: string
  email: string
  name: string | null
  image: string | null
  userId: string | null
  invitationId: string | null
  status: "active" | "pending"
}

export interface ProjectAccess {
  orgMembers: ProjectOrgMember[]
  guests: ProjectGuest[]
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Confirm the project belongs to the organization — i.e. it has at least one
 * capture key assigned to it. Without this, any public.projects id could be
 * used to attach a guest to a project the organization does not own.
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

async function findGrantForAdmin(input: {
  organizationId: string
  grantId: string
}) {
  const grant = await db.query.projectGuestGrant.findFirst({
    where: and(
      eq(projectGuestGrant.id, input.grantId),
      eq(projectGuestGrant.organizationId, input.organizationId)
    ),
  })

  if (!grant) {
    throw new ORPCError("NOT_FOUND", { message: "Guest access not found." })
  }

  return grant
}

/**
 * Everyone with access to a project: organization members (who always see
 * everything) followed by the guests explicitly granted this project.
 */
export const listProjectAccess = protectedProcedure
  .input(projectIdInputSchema)
  .handler(async ({ context, input }): Promise<ProjectAccess> => {
    const organizationId = await requireActiveOrgAdmin(context.session)
    await assertProjectBelongsToOrg({
      organizationId,
      projectId: input.projectId,
    })

    const [members, grants] = await Promise.all([
      db
        .select({
          id: member.id,
          userId: member.userId,
          role: member.role,
          name: user.name,
          email: user.email,
          image: user.image,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, organizationId))
        .orderBy(asc(member.createdAt)),
      db
        .select({
          grantId: projectGuestGrant.id,
          email: projectGuestGrant.email,
          userId: projectGuestGrant.userId,
          invitationId: projectGuestGrant.invitationId,
          name: user.name,
          image: user.image,
        })
        .from(projectGuestGrant)
        .leftJoin(user, eq(projectGuestGrant.userId, user.id))
        .where(
          and(
            eq(projectGuestGrant.organizationId, organizationId),
            eq(projectGuestGrant.projectId, input.projectId)
          )
        )
        .orderBy(asc(projectGuestGrant.createdAt)),
    ])

    return {
      orgMembers: members
        .filter((row) => row.role !== GUEST_ROLE)
        .map((row) => ({
          id: row.id,
          userId: row.userId,
          name: row.name,
          email: row.email,
          image: row.image,
          role: row.role,
        })),
      guests: grants.map((row) => ({
        grantId: row.grantId,
        email: row.email,
        name: row.name,
        image: row.image,
        userId: row.userId,
        invitationId: row.invitationId,
        status: row.userId ? ("active" as const) : ("pending" as const),
      })),
    }
  })

/**
 * Grant a guest access to a project, inviting them if they are new.
 *
 * A guest already in the organization (because they are on another project)
 * just gets the extra grant — no second invitation email.
 */
export const inviteProjectGuest = protectedProcedure
  .input(inviteGuestInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = await requireActiveOrgAdmin(context.session)
    await assertProjectBelongsToOrg({
      organizationId,
      projectId: input.projectId,
    })

    const email = input.email

    const existingUser = await db.query.user.findFirst({
      where: sql`lower(${user.email}) = ${email}`,
      columns: { id: true },
    })

    const existingMembership = existingUser
      ? await db.query.member.findFirst({
          where: and(
            eq(member.organizationId, organizationId),
            eq(member.userId, existingUser.id)
          ),
          columns: { role: true },
        })
      : undefined

    if (existingMembership && existingMembership.role !== GUEST_ROLE) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "That person is already a member of this organization and can see every project.",
      })
    }

    const existingGrant = await db.query.projectGuestGrant.findFirst({
      where: and(
        eq(projectGuestGrant.organizationId, organizationId),
        eq(projectGuestGrant.projectId, input.projectId),
        eq(projectGuestGrant.email, email)
      ),
      columns: { id: true },
    })

    if (existingGrant) {
      throw new ORPCError("BAD_REQUEST", {
        message: "That guest already has access to this project.",
      })
    }

    // Write the grant first: the invitation email names the projects, and it
    // reads them back out of this table.
    const grantId = newId()
    await db.insert(projectGuestGrant).values({
      id: grantId,
      organizationId,
      projectId: input.projectId,
      email,
      userId: existingMembership ? (existingUser?.id ?? null) : null,
      invitedBy: context.session.user.id,
    })

    if (existingMembership) {
      // Already a guest here — the new project simply appears in their portal.
      return { grantId, invitationId: null, invited: false }
    }

    const invitationId = await createGuestInvitation({
      email,
      organizationId,
      headers: context.headers,
    })

    await db
      .update(projectGuestGrant)
      .set({ invitationId })
      .where(eq(projectGuestGrant.id, grantId))

    return { grantId, invitationId, invited: true }
  })

/**
 * better-auth authorizes these calls from the caller's own session, so the
 * request headers have to be present.
 */
function requireHeaders(headers?: Headers): Headers {
  if (!headers) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Missing request headers.",
    })
  }

  return headers
}

async function createGuestInvitation(input: {
  email: string
  organizationId: string
  headers?: Headers
}): Promise<string> {
  const created = await auth.api.createInvitation({
    body: {
      email: input.email,
      role: GUEST_ROLE,
      organizationId: input.organizationId,
      resend: true,
    },
    headers: requireHeaders(input.headers),
  })

  if (!created?.id) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Could not create the guest invitation.",
    })
  }

  return created.id
}

/**
 * Revoke one project from a guest. When it was their last project in the
 * organization they lose their membership too, so a future invite starts clean.
 */
export const removeProjectGuest = protectedProcedure
  .input(grantIdInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = await requireActiveOrgAdmin(context.session)
    const grant = await findGrantForAdmin({
      organizationId,
      grantId: input.grantId,
    })

    await db.delete(projectGuestGrant).where(eq(projectGuestGrant.id, grant.id))

    const remaining = await db
      .select({ id: projectGuestGrant.id })
      .from(projectGuestGrant)
      .where(
        and(
          eq(projectGuestGrant.organizationId, organizationId),
          eq(projectGuestGrant.email, grant.email)
        )
      )
      .limit(1)

    if (remaining.length > 0) {
      return { removed: true, membershipRemoved: false }
    }

    if (grant.invitationId) {
      await cancelInvitationQuietly({
        invitationId: grant.invitationId,
        headers: context.headers,
      })
    }

    const membershipRemoved = await removeGuestMembership({
      organizationId,
      userId: grant.userId,
    })

    return { removed: true, membershipRemoved }
  })

/**
 * Withdraw a pending invitation and the access it would have granted.
 */
export const cancelProjectGuestInvite = protectedProcedure
  .input(grantIdInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = await requireActiveOrgAdmin(context.session)
    const grant = await findGrantForAdmin({
      organizationId,
      grantId: input.grantId,
    })

    if (grant.userId) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "That guest has already accepted — remove their access instead.",
      })
    }

    if (grant.invitationId) {
      await cancelInvitationQuietly({
        invitationId: grant.invitationId,
        headers: context.headers,
      })
    }

    await db.delete(projectGuestGrant).where(eq(projectGuestGrant.id, grant.id))

    return { canceled: true }
  })

/**
 * Send the invitation again. better-auth's `resend` reuses the pending
 * invitation when one is still live, so the old link keeps working.
 */
export const resendProjectGuestInvite = protectedProcedure
  .input(grantIdInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = await requireActiveOrgAdmin(context.session)
    const grant = await findGrantForAdmin({
      organizationId,
      grantId: input.grantId,
    })

    if (grant.userId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "That guest has already accepted their invitation.",
      })
    }

    const invitationId = await createGuestInvitation({
      email: grant.email,
      organizationId,
      headers: context.headers,
    })

    // Every pending grant for this email now points at the live invitation, so
    // cancelling any one of them cancels the right thing.
    await db
      .update(projectGuestGrant)
      .set({ invitationId })
      .where(
        and(
          eq(projectGuestGrant.organizationId, organizationId),
          eq(projectGuestGrant.email, grant.email),
          sql`${projectGuestGrant.userId} is null`
        )
      )

    return { invitationId, resent: true }
  })

async function cancelInvitationQuietly(input: {
  invitationId: string
  headers?: Headers
}): Promise<void> {
  const pending = await db.query.invitation.findFirst({
    where: and(
      eq(invitation.id, input.invitationId),
      eq(invitation.status, "pending")
    ),
    columns: { id: true },
  })

  if (!pending) {
    return
  }

  await auth.api.cancelInvitation({
    body: { invitationId: input.invitationId },
    headers: requireHeaders(input.headers),
  })
}

async function removeGuestMembership(input: {
  organizationId: string
  userId: string | null
}): Promise<boolean> {
  if (!input.userId) {
    return false
  }

  const deleted = await db
    .delete(member)
    .where(
      and(
        eq(member.organizationId, input.organizationId),
        eq(member.userId, input.userId),
        eq(member.role, GUEST_ROLE)
      )
    )
    .returning({ id: member.id })

  return deleted.length > 0
}

export interface OrgGuestProject {
  grantId: string
  projectId: string
  projectName: string
}

export interface OrgGuest {
  email: string
  name: string | null
  image: string | null
  userId: string | null
  invitationId: string | null
  status: "active" | "pending"
  invitedAt: string
  projects: OrgGuestProject[]
}

/**
 * Every guest in the organization, one row per person with the projects they
 * hold. Powers Settings -> Guest Management.
 *
 * Grants are keyed by email (a guest may not have an account yet), so the
 * grouping key is the email rather than the user id.
 *
 * Raw SQL with an explicit `public.` qualifier — see people.ts for why.
 */
export const listOrgGuests = protectedProcedure.handler(
  async ({ context }): Promise<OrgGuest[]> => {
    const organizationId = await requireActiveOrgAdmin(context.session)

    const result = await db.execute(sql`
      select
        g."id" as "grantId",
        g."email",
        g."project_id" as "projectId",
        g."user_id" as "userId",
        g."invitation_id" as "invitationId",
        g."created_at" as "createdAt",
        u."name",
        u."image",
        p."name" as "projectName"
      from "project_guest_grant" g
      left join "user" u on u."id" = g."user_id"
      left join "public"."projects" p on p."id" = g."project_id"
      where g."organization_id" = ${organizationId}
      order by g."created_at" asc
    `)

    type Row = {
      grantId: string
      email: string
      projectId: string
      userId: string | null
      invitationId: string | null
      createdAt: Date | string
      name: string | null
      image: string | null
      projectName: string | null
    }

    const byEmail = new Map<string, OrgGuest>()

    for (const row of result.rows as unknown as Row[]) {
      const existing = byEmail.get(row.email)
      const project: OrgGuestProject = {
        grantId: row.grantId,
        projectId: row.projectId,
        projectName: row.projectName ?? "Untitled project",
      }

      if (existing) {
        existing.projects.push(project)
        // A guest is active as soon as any one of their grants is bound.
        if (row.userId && existing.status === "pending") {
          existing.status = "active"
          existing.userId = row.userId
          existing.name = row.name
          existing.image = row.image
        }
        continue
      }

      byEmail.set(row.email, {
        email: row.email,
        name: row.name,
        image: row.image,
        userId: row.userId,
        invitationId: row.invitationId,
        status: row.userId ? "active" : "pending",
        invitedAt: new Date(row.createdAt).toISOString(),
        projects: [project],
      })
    }

    return Array.from(byEmail.values())
  }
)

/**
 * Revoke a guest from the whole organization: every project grant, any pending
 * invitation, and their membership.
 */
export const removeOrgGuest = protectedProcedure
  .input(z.object({ email: z.string().trim().toLowerCase().min(1).max(320) }))
  .handler(async ({ context, input }) => {
    const organizationId = await requireActiveOrgAdmin(context.session)

    const grants = await db
      .select({
        id: projectGuestGrant.id,
        userId: projectGuestGrant.userId,
        invitationId: projectGuestGrant.invitationId,
      })
      .from(projectGuestGrant)
      .where(
        and(
          eq(projectGuestGrant.organizationId, organizationId),
          eq(projectGuestGrant.email, input.email)
        )
      )

    if (grants.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Guest not found." })
    }

    await db
      .delete(projectGuestGrant)
      .where(
        and(
          eq(projectGuestGrant.organizationId, organizationId),
          eq(projectGuestGrant.email, input.email)
        )
      )

    const invitationIds = Array.from(
      new Set(
        grants
          .map((grant) => grant.invitationId)
          .filter((id): id is string => Boolean(id))
      )
    )

    for (const invitationId of invitationIds) {
      await cancelInvitationQuietly({
        invitationId,
        headers: context.headers,
      })
    }

    const userId = grants.find((grant) => grant.userId)?.userId ?? null
    const membershipRemoved = await removeGuestMembership({
      organizationId,
      userId,
    })

    return { removed: true, membershipRemoved }
  })

export interface GuestProject {
  id: string
  name: string
  clientName: string | null
  openCount: number
  totalCount: number
}

/**
 * The guest portal's home grid: every project this guest was granted, with a
 * count of what is still open.
 *
 * Raw SQL with an explicit `public.` qualifier — see people.ts for why.
 */
export const listGuestProjects = protectedProcedure.handler(
  async ({ context }): Promise<GuestProject[]> => {
    const viewer = await requireProjectViewer(context.session)

    if (!viewer.isGuest) {
      throw new ORPCError("FORBIDDEN", {
        message: "This is the guest project list.",
      })
    }

    const projectIds = viewer.guestProjectIds ?? []
    if (projectIds.length === 0) {
      return []
    }

    // Built as an explicit parameter list: binding the array as one value makes
    // Postgres try to parse the id as an array literal.
    const projectIdList = sql.join(
      projectIds.map((projectId) => sql`${projectId}`),
      sql`, `
    )

    const result = await db.execute(sql`
      select
        p."id",
        p."name",
        p."client_name" as "clientName",
        count(r."id")::int as "totalCount",
        count(r."id") filter (
          where r."status" not in ('done', 'closed')
        )::int as "openCount"
      from "public"."projects" p
      left join "capture_public_key" k
        on k."project_id" = p."id" and k."organization_id" = ${viewer.organizationId}
      left join "bug_report" r
        on r."capture_public_key_id" = k."id"
        and r."organization_id" = ${viewer.organizationId}
      where p."id" in (${projectIdList})
      group by p."id", p."name", p."client_name"
      order by p."name" asc
    `)

    return (result.rows as unknown as GuestProject[]).map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled project",
      clientName: row.clientName,
      openCount: Number(row.openCount ?? 0),
      totalCount: Number(row.totalCount ?? 0),
    }))
  }
)

/** Exported for the guest portal's project page heading. */
export const getGuestProject = protectedProcedure
  .input(projectIdInputSchema)
  .handler(async ({ context, input }): Promise<GuestProject> => {
    const viewer = await requireProjectViewer(context.session)
    const allowed = viewer.isGuest
      ? (viewer.guestProjectIds ?? []).includes(input.projectId)
      : true

    if (!allowed) {
      throw new ORPCError("FORBIDDEN", {
        message: "You do not have access to this project.",
      })
    }

    const result = await db.execute(sql`
      select "id", "name", "client_name" as "clientName"
      from "public"."projects"
      where "id" = ${input.projectId}
      limit 1
    `)

    const row = (result.rows as unknown as GuestProject[])[0]
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Project not found" })
    }

    return {
      id: row.id,
      name: row.name ?? "Untitled project",
      clientName: row.clientName,
      openCount: 0,
      totalCount: 0,
    }
  })
