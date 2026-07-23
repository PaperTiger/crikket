import { db } from "@crikket/db"
import { member } from "@crikket/db/schema/auth"
import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"

import { getGuestProjectIds } from "../lib/project-scope"
import type { SessionContext } from "../lib/utils"

const GUEST_ROLE = "guest"

export function requireActiveOrgId(session: SessionContext): string {
  const activeOrgId = session.session.activeOrganizationId
  if (!activeOrgId) {
    throw new ORPCError("BAD_REQUEST", { message: "No active organization" })
  }

  return activeOrgId
}

async function findActiveMemberRole(
  session: SessionContext
): Promise<{ organizationId: string; role: string }> {
  const organizationId = requireActiveOrgId(session)

  const activeMember = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, organizationId),
      eq(member.userId, session.user.id)
    ),
    columns: { role: true },
  })

  if (!activeMember) {
    throw new ORPCError("FORBIDDEN", {
      message: "You are not a member of this organization.",
    })
  }

  return { organizationId, role: activeMember.role }
}

/**
 * The organization guard for everything a guest must NOT reach.
 *
 * This is deliberately the default: guests are organization members (so that
 * session/org scoping keeps working), which means a plain `activeOrganizationId`
 * check would hand them the whole organization. Procedures opt guests back in
 * explicitly via `requireProjectViewer`.
 */
export async function requireOrgMember(
  session: SessionContext
): Promise<string> {
  const { organizationId, role } = await findActiveMemberRole(session)

  if (role === GUEST_ROLE) {
    throw new ORPCError("FORBIDDEN", {
      message: "Guests do not have access to this.",
    })
  }

  return organizationId
}

export async function requireActiveOrgAdmin(
  session: SessionContext
): Promise<string> {
  const { organizationId, role } = await findActiveMemberRole(session)

  if (!isOrgAdminRole(role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only organization admins or owners can manage this.",
    })
  }

  return organizationId
}

export interface ProjectViewer {
  organizationId: string
  isGuest: boolean
  /**
   * Projects the viewer is limited to, or `null` for an unrestricted
   * organization member. An empty array means no access to anything.
   */
  guestProjectIds: string[] | null
}

/**
 * The guard for the handful of procedures guests are allowed to reach. Returns
 * the project restriction to apply, which callers must actually use.
 */
export async function requireProjectViewer(
  session: SessionContext
): Promise<ProjectViewer> {
  const { organizationId, role } = await findActiveMemberRole(session)

  if (role !== GUEST_ROLE) {
    return { organizationId, isGuest: false, guestProjectIds: null }
  }

  const guestProjectIds = await getGuestProjectIds({
    userId: session.user.id,
    organizationId,
  })

  return { organizationId, isGuest: true, guestProjectIds }
}

function isOrgAdminRole(role: string): boolean {
  return role === "owner" || role === "admin"
}

export function normalizeTags(tags?: string[]): string[] | undefined {
  if (!tags) {
    return undefined
  }

  const uniqueTags = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => tag.slice(0, 40))
    )
  )

  return uniqueTags.length > 0 ? uniqueTags : []
}
