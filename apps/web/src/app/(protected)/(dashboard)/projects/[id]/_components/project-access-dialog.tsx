"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Badge } from "@crikket/ui/components/ui/badge"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@crikket/ui/components/ui/dialog"
import { Input } from "@crikket/ui/components/ui/input"
import { Separator } from "@crikket/ui/components/ui/separator"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Loader2, X } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

import { getRequestErrorMessage } from "@/app/(protected)/(dashboard)/settings/_lib/get-request-error-message"
import { orpc } from "@/utils/orpc"

interface ProjectAccessDialogProps {
  projectId: string
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WHITESPACE_RE = /\s+/

function initials(value: string): string {
  const source = value.trim() || "?"
  return source
    .split(WHITESPACE_RE)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ProjectAccessDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: ProjectAccessDialogProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = React.useState("")

  const accessQueryOptions = orpc.project.access.list.queryOptions({
    input: { projectId },
  })
  const accessQuery = useQuery({ ...accessQueryOptions, enabled: open })

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: accessQueryOptions.queryKey,
    })
  }, [queryClient, accessQueryOptions.queryKey])

  const inviteMutation = useMutation(
    orpc.project.access.inviteGuest.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          result.invited
            ? "Invitation sent"
            : "Guest added — they already have an account"
        )
        setEmail("")
        await refresh()
      },
      onError: (error) => {
        toast.error(getRequestErrorMessage(error))
      },
    })
  )

  const removeMutation = useMutation(
    orpc.project.access.removeGuest.mutationOptions({
      onSuccess: async () => {
        toast.success("Access removed")
        await refresh()
      },
      onError: (error) => {
        toast.error(getRequestErrorMessage(error))
      },
    })
  )

  const cancelMutation = useMutation(
    orpc.project.access.cancelGuestInvite.mutationOptions({
      onSuccess: async () => {
        toast.success("Invitation canceled")
        await refresh()
      },
      onError: (error) => {
        toast.error(getRequestErrorMessage(error))
      },
    })
  )

  const resendMutation = useMutation(
    orpc.project.access.resendGuestInvite.mutationOptions({
      onSuccess: async () => {
        toast.success("Invitation sent again")
        await refresh()
      },
      onError: (error) => {
        toast.error(getRequestErrorMessage(error))
      },
    })
  )

  const orgMembers = accessQuery.data?.orgMembers ?? []
  const guests = accessQuery.data?.guests ?? []
  const isBusy =
    inviteMutation.isPending ||
    removeMutation.isPending ||
    cancelMutation.isPending ||
    resendMutation.isPending

  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      return
    }

    inviteMutation.mutate({ projectId, email: trimmed })
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Invite clients to follow {projectName}. They'll see this project's
            issues and can update status and priority — nothing else.
          </DialogDescription>
        </DialogHeader>

        <form className="flex items-center gap-2" onSubmit={handleInvite}>
          <Input
            autoComplete="off"
            disabled={isBusy}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Invite people by email"
            type="email"
            value={email}
          />
          <Button disabled={isBusy || email.trim().length === 0} type="submit">
            {inviteMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Invite"
            )}
          </Button>
        </form>

        <div className="space-y-2">
          <div>
            <h3 className="font-medium text-sm">Groups</h3>
            <p className="text-muted-foreground text-xs">
              Give access to multiple members at once.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex size-9 items-center justify-center rounded-full border">
              <Building2 className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">Workspace members</p>
              <p className="text-muted-foreground text-xs">
                {orgMembers.length}{" "}
                {orgMembers.length === 1 ? "member" : "members"}
              </p>
            </div>
            <Badge variant="secondary">Always on</Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div>
            <h3 className="font-medium text-sm">People</h3>
            <p className="text-muted-foreground text-xs">
              Everyone who can see this project's issues. Workspace members
              always have access.
            </p>
          </div>

          {accessQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {accessQuery.isError ? (
            <p className="py-4 text-destructive text-sm">
              {getRequestErrorMessage(accessQuery.error)}
            </p>
          ) : null}

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {orgMembers.map((member) => (
              <div className="flex items-center gap-3 py-1.5" key={member.id}>
                <Avatar className="size-8">
                  <AvatarImage
                    alt={member.name}
                    src={member.image ?? undefined}
                  />
                  <AvatarFallback className="text-xs">
                    {initials(member.name || member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{member.name}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {member.email}
                  </p>
                </div>
              </div>
            ))}

            {guests.map((guest) => (
              <div
                className="flex items-center gap-3 py-1.5"
                key={guest.grantId}
              >
                <Avatar className="size-8">
                  <AvatarImage
                    alt={guest.name ?? guest.email}
                    src={guest.image ?? undefined}
                  />
                  <AvatarFallback className="text-xs">
                    {initials(guest.name ?? guest.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {guest.name ?? guest.email}
                  </p>
                  <p className="truncate text-muted-foreground text-xs">
                    {guest.name ? guest.email : "Hasn't accepted yet"}
                  </p>
                </div>

                <Badge variant="secondary">Guest</Badge>

                {guest.status === "pending" ? (
                  <>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        resendMutation.mutate({ grantId: guest.grantId })
                      }
                      size="sm"
                      variant="ghost"
                    >
                      Resend
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        cancelMutation.mutate({ grantId: guest.grantId })
                      }
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    aria-label={`Remove ${guest.name ?? guest.email}`}
                    disabled={isBusy}
                    onClick={() =>
                      removeMutation.mutate({ grantId: guest.grantId })
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}

            {!accessQuery.isLoading && guests.length === 0 ? (
              <p className="py-2 text-muted-foreground text-xs">
                No guests on this project yet.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
