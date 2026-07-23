import { db } from "@crikket/db"
import { invitation } from "@crikket/db/schema/auth"
import { projectGuestGrant } from "@crikket/db/schema/guest-access"
import { and, eq, gt, isNull, sql } from "drizzle-orm"

export function normalizeGuestEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * True when this email has an invitation waiting for it.
 *
 * Used to let invited people past the ALLOWED_SIGNUP_DOMAINS gate: guests are
 * clients on their own email domains, so the allowlist would otherwise block
 * every guest signup in production.
 */
export async function hasPendingInvitation(email: string): Promise<boolean> {
  const normalizedEmail = normalizeGuestEmail(email)
  if (!normalizedEmail) {
    return false
  }

  const pending = await db.query.invitation.findFirst({
    where: and(
      sql`lower(${invitation.email}) = ${normalizedEmail}`,
      eq(invitation.status, "pending"),
      gt(invitation.expiresAt, new Date())
    ),
    columns: { id: true },
  })

  return Boolean(pending)
}

/**
 * Project names a pending guest has been granted, for the invitation email.
 *
 * Raw SQL with an explicit `public.` qualifier — the app connects with
 * search_path=crikket, so this is how the Paper Tiger dashboard tables are read
 * (see packages/bug-reports/src/procedures/people.ts).
 */
export async function listPendingGuestProjectNames(input: {
  organizationId: string
  email: string
}): Promise<string[]> {
  const normalizedEmail = normalizeGuestEmail(input.email)

  const result = await db.execute(sql`
    select p."name"
    from "project_guest_grant" g
    join "public"."projects" p on g."project_id" = p."id"
    where g."organization_id" = ${input.organizationId}
      and g."email" = ${normalizedEmail}
    order by p."name" asc
  `)

  return (result.rows as unknown as { name: string | null }[])
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name))
}

/**
 * Attach a newly accepted guest's grants to their user row. Grants are created
 * at invite time keyed only by email, because the user may not exist yet.
 */
export async function bindGuestGrantsToUser(input: {
  organizationId: string
  email: string
  userId: string
}): Promise<void> {
  const normalizedEmail = normalizeGuestEmail(input.email)
  if (!normalizedEmail) {
    return
  }

  await db
    .update(projectGuestGrant)
    .set({ userId: input.userId })
    .where(
      and(
        eq(projectGuestGrant.organizationId, input.organizationId),
        eq(projectGuestGrant.email, normalizedEmail),
        isNull(projectGuestGrant.userId)
      )
    )
}

/**
 * Drop every project grant a user holds in an organization. Called when they
 * are removed from the organization, so a re-invite starts from zero access.
 */
export async function deleteGuestGrantsForUser(input: {
  organizationId: string
  userId: string
}): Promise<void> {
  await db
    .delete(projectGuestGrant)
    .where(
      and(
        eq(projectGuestGrant.organizationId, input.organizationId),
        eq(projectGuestGrant.userId, input.userId)
      )
    )
}
