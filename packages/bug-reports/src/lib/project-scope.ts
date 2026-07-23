import { db } from "@crikket/db"
import { bugReport, capturePublicKey } from "@crikket/db/schema/bug-report"
import { projectGuestGrant } from "@crikket/db/schema/guest-access"
import { and, eq, inArray, type SQL, sql } from "drizzle-orm"

/**
 * Projects a guest has been granted in an organization.
 *
 * An empty result means "no access to anything", never "no restriction" —
 * callers must treat `[]` and `null` differently. See `buildProjectScopeFilter`.
 */
export async function getGuestProjectIds(input: {
  userId: string
  organizationId: string
}): Promise<string[]> {
  const grants = await db
    .select({ projectId: projectGuestGrant.projectId })
    .from(projectGuestGrant)
    .where(
      and(
        eq(projectGuestGrant.organizationId, input.organizationId),
        eq(projectGuestGrant.userId, input.userId)
      )
    )

  return Array.from(new Set(grants.map((grant) => grant.projectId)))
}

/**
 * Restrict bug reports to a set of projects.
 *
 * A report belongs to a project transitively: bug_report.capture_public_key_id
 * -> capture_public_key.project_id. Same subquery shape as the `projectId`
 * filter in list-bug-reports.ts.
 *
 * `projectIds` is never allowed to widen access: an empty list yields a filter
 * that matches nothing rather than one that matches everything.
 */
export function buildProjectScopeFilter(projectIds: string[]): SQL {
  if (projectIds.length === 0) {
    return sql`false`
  }

  return inArray(
    bugReport.capturePublicKeyId,
    db
      .select({ id: capturePublicKey.id })
      .from(capturePublicKey)
      .where(inArray(capturePublicKey.projectId, projectIds))
  )
}

/**
 * The project a single report belongs to, or null when its capture key has no
 * project assigned. Used to authorize guest access to one report.
 */
export async function findProjectIdForCaptureKey(
  capturePublicKeyId: string | null
): Promise<string | null> {
  if (!capturePublicKeyId) {
    return null
  }

  const key = await db.query.capturePublicKey.findFirst({
    where: eq(capturePublicKey.id, capturePublicKeyId),
    columns: { projectId: true },
  })

  return key?.projectId ?? null
}
