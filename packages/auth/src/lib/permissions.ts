import { createAccessControl } from "better-auth/plugins/access"
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access"

/**
 * Organization roles.
 *
 * `owner` / `admin` / `member` keep better-auth's stock permissions. `guest` is
 * a client we invited to follow along on specific projects: it holds no
 * organization permissions at all, so better-auth itself rejects every
 * organization mutation a guest could attempt.
 *
 * Which projects a guest can actually see is a separate question, answered by
 * the `project_guest_grant` table — see packages/bug-reports/src/lib/project-scope.ts.
 */
export const ORGANIZATION_ROLE = {
  owner: "owner",
  admin: "admin",
  member: "member",
  guest: "guest",
} as const

export type OrganizationRole =
  (typeof ORGANIZATION_ROLE)[keyof typeof ORGANIZATION_ROLE]

export function isGuestRole(role: string | null | undefined): boolean {
  return role === ORGANIZATION_ROLE.guest
}

export const statement = {
  ...defaultStatements,
} as const

export const ac = createAccessControl(statement)

export const roles = {
  [ORGANIZATION_ROLE.owner]: ac.newRole(ownerAc.statements),
  [ORGANIZATION_ROLE.admin]: ac.newRole(adminAc.statements),
  [ORGANIZATION_ROLE.member]: ac.newRole(memberAc.statements),
  // Deliberately empty permission lists — a guest can do nothing at the
  // organization level. The resource keys are named only because a fully empty
  // role infers as `Role<never>`, which better-auth's role map rejects.
  [ORGANIZATION_ROLE.guest]: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
    team: [],
    ac: [],
  }),
}
