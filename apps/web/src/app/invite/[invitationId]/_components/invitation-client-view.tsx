"use client"

import { authClient } from "@crikket/auth/client"
import { env } from "@crikket/env/web"
import { Button } from "@crikket/ui/components/ui/button"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "nextjs-toploader/app"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"

interface InvitationClientViewProps {
  invitationId: string
}

export function InvitationClientView({
  invitationId,
}: InvitationClientViewProps) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  const callbackUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${invitationId}`
  const loginHref = `/login?callbackURL=${encodeURIComponent(callbackUrl)}`
  const registerHref = `/register?callbackURL=${encodeURIComponent(callbackUrl)}`

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      })

      if (error) {
        throw error
      }

      const organizationId = data?.invitation?.organizationId

      if (organizationId) {
        const { error: setActiveError } =
          await authClient.organization.setActive({
            organizationId,
          })

        if (setActiveError) {
          throw setActiveError
        }
      }

      return data?.invitation?.role ?? null
    },
    onSuccess: (role) => {
      toast.success("Invitation accepted")
      // Guests have no dashboard — send them to their portal instead.
      router.push(role === "guest" ? "/portal" : "/settings/organization")
      router.refresh()
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to accept invitation")
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      toast.success("Invitation declined")
      router.push("/settings/user")
      router.refresh()
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to reject invitation")
    },
  })

  return (
    <main className="flex min-h-svh items-center justify-center">
      <AuthShell
        description="Review and respond to this invitation."
        title="Organization Invitation"
      >
        {isPending ? (
          <p className="text-muted-foreground text-sm">Loading session...</p>
        ) : null}

        {isPending || session ? null : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Create an account or sign in to accept this invitation.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="sm:flex-1"
                onClick={() => {
                  router.push(registerHref as never)
                }}
                size="lg"
              >
                Create an account
              </Button>
              <Button
                className="sm:flex-1"
                onClick={() => {
                  router.push(loginHref as never)
                }}
                size="lg"
                variant="outline"
              >
                Sign in
              </Button>
            </div>
          </div>
        )}

        {!isPending && session ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="sm:flex-1"
              disabled={acceptMutation.isPending || rejectMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              size="lg"
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept invitation"}
            </Button>
            <Button
              className="sm:flex-1"
              disabled={acceptMutation.isPending || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
              size="lg"
              variant="outline"
            >
              {rejectMutation.isPending ? "Declining..." : "Decline"}
            </Button>
          </div>
        ) : null}
      </AuthShell>
    </main>
  )
}
