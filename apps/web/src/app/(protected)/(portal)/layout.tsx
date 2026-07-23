import { ModeToggle } from "@crikket/ui/components/mode-toggle"
import type { Route } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"
import { UnverifiedEmailBanner } from "@/components/auth/unverified-email-banner"
import { client } from "@/utils/orpc"

import { PortalUserNav } from "./_components/portal-user-nav"

/**
 * The guest portal shell.
 *
 * Deliberately spare: no sidebar, no organization switcher, no billing or
 * settings beyond the guest's own account. Everything a guest can reach lives
 * under /portal.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, isGuest, organizations } = await getProtectedAuthData()

  if (!session) {
    redirect("/login")
  }

  // Organization members belong in the dashboard, not here.
  if (!isGuest) {
    redirect("/")
  }

  const activeOrganization =
    organizations.find(
      (organization) => organization.id === session.session.activeOrganizationId
    ) ?? organizations[0]

  const billingSnapshot = activeOrganization
    ? await client.billing
        .getCurrentOrganizationPlan({
          organizationId: activeOrganization.id,
        })
        .catch(() => null)
    : null

  // The workspace is on a plan that has the product switched off. A guest can't
  // do anything about that, so say so plainly instead of showing pricing.
  const isWorkspaceInactive = billingSnapshot?.plan === "free"

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
        <Link
          className="font-semibold text-sm tracking-tight"
          href={"/portal" as Route}
        >
          {activeOrganization?.name ?? "Crikket"}
        </Link>
        <div className="flex items-center gap-1">
          <ModeToggle />
          <PortalUserNav user={session.user} />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {session.user.emailVerified ? null : <UnverifiedEmailBanner />}
        {isWorkspaceInactive ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="max-w-md space-y-2 text-center">
              <h1 className="font-semibold text-xl">
                This workspace isn't active
              </h1>
              <p className="text-muted-foreground text-sm">
                {activeOrganization?.name ?? "This workspace"} needs an active
                plan before its projects can be viewed. Reach out to your
                contact there and they can sort it out.
              </p>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
