"use client"

import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"
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
import { Loader2, X } from "lucide-react"
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const [pendingSelfRemoval, setPendingSelfRemoval] = React.useState(false)

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

  const addTeamMutation = useMutation(
    orpc.project.team.add.mutationOptions({
      onSuccess: async () => {
        toast.success("Added to the project")
        await refresh()
      },
      onError: (error) => {
        toast.error(getRequestErrorMessage(error))
      },
    })
  )

  const removeTeamMutation = useMutation(
    orpc.project.team.remove.mutationOptions({
      onSuccess: async () => {
        toast.success("Removed from the project")
        setPendingSelfRemoval(false)
        await refresh()
      },
      onError: (error) => {
        toast.error(getRequestErrorMessage(error))
      },
    })
  )

  const teamMembers = accessQuery.data?.teamMembers ?? []
  const availableMembers = accessQuery.data?.availableMembers ?? []
  const guests = accessQuery.data?.guests ?? []
  const viewerUserId = accessQuery.data?.viewerUserId ?? ""
  const viewerIsOnProject = accessQuery.data?.viewerIsOnProject ?? false
  const canManageOthers = accessQuery.data?.viewerCanManageOthers ?? false
  const isBusy =
    inviteMutation.isPending ||
    removeMutation.isPending ||
    cancelMutation.isPending ||
    resendMutation.isPending ||
    addTeamMutation.isPending ||
    removeTeamMutation.isPending

  // The one field does double duty: it matches teammates who aren't on the
  // project yet (click to add, no email sent), and failing that it invites the
  // typed address as a guest.
  const suggestions = React.useMemo(() => {
    const term = email.trim().toLowerCase()
    if (term.length === 0) {
      return []
    }

    return availableMembers
      .filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(term) ||
          candidate.email.toLowerCase().includes(term)
      )
      .slice(0, 5)
  }, [availableMembers, email])

  const looksLikeEmail = EMAIL_RE.test(email.trim())

  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      return
    }

    // Enter on an exact teammate match adds them rather than emailing them.
    const exactTeammate = availableMembers.find(
      (candidate) => candidate.email.toLowerCase() === trimmed.toLowerCase()
    )
    if (exactTeammate) {
      addTeamMutation.mutate({ projectId, userId: exactTeammate.userId })
      setEmail("")
      return
    }

    inviteMutation.mutate({ projectId, email: trimmed })
  }

  const addTeammateFromSuggestion = (userId: string) => {
    addTeamMutation.mutate({ projectId, userId })
    setEmail("")
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

        <div className="space-y-1">
          <form className="flex items-center gap-2" onSubmit={handleInvite}>
            <Input
              autoComplete="off"
              disabled={isBusy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Invite people by name or email"
              value={email}
            />
            <Button
              disabled={isBusy || !looksLikeEmail}
              title={
                looksLikeEmail
                  ? undefined
                  : "Enter a full email address to invite someone new"
              }
              type="submit"
            >
              {inviteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Invite"
              )}
            </Button>
          </form>

          {suggestions.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              {suggestions.map((candidate) => (
                <button
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  disabled={isBusy}
                  key={candidate.id}
                  onClick={() => addTeammateFromSuggestion(candidate.userId)}
                  type="button"
                >
                  <Avatar className="size-7">
                    <AvatarImage
                      alt={candidate.name}
                      src={candidate.image ?? undefined}
                    />
                    <AvatarFallback className="text-xs">
                      {initials(candidate.name || candidate.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">
                      {candidate.name}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      {candidate.email}
                    </span>
                  </span>
                  <Badge variant="outline">Add to team</Badge>
                </button>
              ))}
            </div>
          ) : null}

          {email.trim().length > 0 &&
          suggestions.length === 0 &&
          !looksLikeEmail ? (
            <p className="px-1 text-muted-foreground text-xs">
              No teammate matches "{email.trim()}". Type a full email address to
              invite them as a guest.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium text-sm">Team</h3>
              <p className="text-muted-foreground text-xs">
                Who's working on this project. Everyone in the workspace can
                still see it — this decides who follows it.
              </p>
            </div>
            {viewerIsOnProject ? null : (
              <Button
                className="shrink-0"
                disabled={isBusy}
                onClick={() =>
                  addTeamMutation.mutate({ projectId, userId: viewerUserId })
                }
                size="sm"
                variant="outline"
              >
                Add me to this project
              </Button>
            )}
          </div>

          <div className="space-y-1">
            {teamMembers.map((teamMember) => {
              const isSelf = teamMember.userId === viewerUserId
              const canRemove = isSelf || canManageOthers

              return (
                <div
                  className="flex items-center gap-3 py-1.5"
                  key={teamMember.id}
                >
                  <Avatar className="size-8">
                    <AvatarImage
                      alt={teamMember.name}
                      src={teamMember.image ?? undefined}
                    />
                    <AvatarFallback className="text-xs">
                      {initials(teamMember.name || teamMember.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {teamMember.name}
                      {isSelf ? (
                        <span className="pl-1.5 font-normal text-muted-foreground text-xs">
                          You
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {teamMember.email}
                    </p>
                  </div>
                  {canRemove ? (
                    <Button
                      aria-label={`Remove ${teamMember.name} from this project`}
                      disabled={isBusy}
                      onClick={() => {
                        if (isSelf) {
                          setPendingSelfRemoval(true)
                          return
                        }
                        removeTeamMutation.mutate({
                          projectId,
                          userId: teamMember.userId,
                        })
                      }}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              )
            })}

            {teamMembers.length === 0 ? (
              <p className="py-2 text-muted-foreground text-xs">
                Nobody's on this project yet.
              </p>
            ) : null}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div>
            <h3 className="font-medium text-sm">Guests</h3>
            <p className="text-muted-foreground text-xs">
              Clients following this project. They read its issues and can
              change status and priority — nothing else.
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

      <ConfirmationDialog
        confirmText="Yes, remove me"
        description="You'll stop following this project and it will leave your My Projects list. You can still open it from All Projects, and you can add yourself back at any time."
        isLoading={removeTeamMutation.isPending}
        onConfirm={async () => {
          await removeTeamMutation.mutateAsync({
            projectId,
            userId: viewerUserId,
          })
        }}
        onOpenChange={setPendingSelfRemoval}
        open={pendingSelfRemoval}
        title="Are you sure you want to be removed?"
      />
    </Dialog>
  )
}
