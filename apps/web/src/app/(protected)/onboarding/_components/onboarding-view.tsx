"use client"

import { authClient } from "@crikket/auth/client"
import { Button } from "@crikket/ui/components/ui/button"
import { Building2, Loader2, LogOut, Plus } from "lucide-react"
import { useRouter } from "nextjs-toploader/app"
import { useState } from "react"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"
import { CreateOrganizationForm } from "./create-organization-onboarding-form"

export interface OnboardingOrganization {
  id: string
  name: string
  slug: string
}

interface OnboardingViewProps {
  organizations: OnboardingOrganization[]
  userEmail: string
}

/**
 * The organization gate a user reaches when they have no active organization.
 * Lists the organizations they already belong to, lets them create a new one,
 * and always offers a way out (log out) so nobody gets stranded here.
 */
export function OnboardingView({
  organizations,
  userEmail,
}: OnboardingViewProps) {
  const router = useRouter()
  const hasOrganizations = organizations.length > 0
  // With no organizations, creating one is the only path forward, so show the
  // form straight away. Otherwise it's a secondary action behind a button.
  const [isCreating, setIsCreating] = useState(!hasOrganizations)
  const [pendingOrganizationId, setPendingOrganizationId] = useState<
    string | null
  >(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const isBusy = pendingOrganizationId !== null || isSigningOut

  const handleOpenOrganization = async (organizationId: string) => {
    setPendingOrganizationId(organizationId)
    const { error } = await authClient.organization.setActive({
      organizationId,
    })

    if (error) {
      toast.error(error.message ?? "Could not open that organization")
      setPendingOrganizationId(null)
      return
    }

    router.push("/")
    router.refresh()
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login"
        },
        onError: () => {
          toast.error("Could not sign out. Please try again.")
          setIsSigningOut(false)
        },
      },
    })
  }

  return (
    <AuthShell
      description={
        hasOrganizations
          ? "Open one of your organizations, or create a new one."
          : "You need an organization before you can access your dashboard."
      }
      title={hasOrganizations ? "Choose an organization" : "Create your organization"}
    >
      {hasOrganizations ? (
        <div className="grid gap-2">
          {organizations.map((organization) => (
            <button
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy}
              key={organization.id}
              onClick={() => handleOpenOrganization(organization.id)}
              type="button"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-sm">
                  {organization.name}
                </span>
                <span className="block truncate text-muted-foreground text-xs">
                  {organization.slug}
                </span>
              </span>
              {pendingOrganizationId === organization.id ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {hasOrganizations && !isCreating ? (
        <Button
          className="w-full"
          disabled={isBusy}
          onClick={() => setIsCreating(true)}
          variant="outline"
        >
          <Plus className="size-4" />
          Create a new organization
        </Button>
      ) : null}

      {isCreating ? (
        <div className="grid gap-4">
          {hasOrganizations ? (
            <p className="font-medium text-muted-foreground text-xs">
              Or create a new organization
            </p>
          ) : null}
          <CreateOrganizationForm />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <span className="truncate text-muted-foreground text-xs">
          Signed in as {userEmail}
        </span>
        <button
          className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground disabled:opacity-60"
          disabled={isBusy}
          onClick={handleSignOut}
          type="button"
        >
          <LogOut className="size-3.5" />
          Log out
        </button>
      </div>
    </AuthShell>
  )
}
