import { db } from "@crikket/db"
import { member } from "@crikket/db/schema/auth"
import {
  organizationBillingAccount,
  organizationEntitlement,
} from "@crikket/db/schema/billing"
import { env } from "@crikket/env/server"
import { and, count, eq, ne } from "drizzle-orm"

import {
  BILLING_PLAN,
  type BillingPlan,
  type BillingPlanLimitSnapshot,
  deserializeEntitlements,
  type EntitlementSnapshot,
  getBillingDisabledEntitlements,
  getBillingDisabledPlanLimitsSnapshot,
  getBillingPlanLimitsSnapshot,
  normalizeBillingPlan,
  normalizeBillingSubscriptionStatus,
  resolveEntitlements,
} from "../../model"

export async function getOrganizationEntitlements(
  organizationId: string
): Promise<EntitlementSnapshot> {
  if (!env.ENABLE_PAYMENTS) {
    return getBillingDisabledEntitlements()
  }

  const [billingRow, row] = await Promise.all([
    db.query.organizationBillingAccount.findFirst({
      where: eq(organizationBillingAccount.organizationId, organizationId),
      columns: {
        plan: true,
        subscriptionStatus: true,
      },
    }),
    db.query.organizationEntitlement.findFirst({
      where: eq(organizationEntitlement.organizationId, organizationId),
      columns: {
        entitlements: true,
      },
    }),
  ])
  const effectiveEntitlements = resolveEntitlements({
    plan: normalizeBillingPlan(billingRow?.plan),
    subscriptionStatus: normalizeBillingSubscriptionStatus(
      billingRow?.subscriptionStatus
    ),
  })

  if (row) {
    return deserializeEntitlements(effectiveEntitlements.plan, row.entitlements)
  }

  return effectiveEntitlements
}

export function getBillingPlanLimits(): Record<
  BillingPlan,
  BillingPlanLimitSnapshot
> {
  if (!env.ENABLE_PAYMENTS) {
    return getBillingDisabledPlanLimitsSnapshot()
  }

  return getBillingPlanLimitsSnapshot()
}

export async function assertOrganizationCanAddMembers(
  organizationId: string,
  incomingMembers = 1
): Promise<void> {
  const entitlements = await getOrganizationEntitlements(organizationId)
  const memberCap = entitlements.memberCap

  if (memberCap === null) {
    return
  }

  // Guests are clients invited to follow specific projects. They are not
  // teammates and do not consume a paid seat.
  const memberCountResult = await db
    .select({ value: count() })
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), ne(member.role, "guest"))
    )
  const memberCount = memberCountResult[0]?.value ?? 0

  if (memberCount + incomingMembers <= memberCap) {
    return
  }

  if (entitlements.plan === BILLING_PLAN.pro) {
    throw new Error(
      `Pro plan supports up to ${memberCap} members. Upgrade to Studio to add more teammates.`
    )
  }

  if (entitlements.plan === BILLING_PLAN.free) {
    throw new Error("Upgrade to Pro to invite teammates to this organization.")
  }

  throw new Error("Organization member limit reached.")
}
