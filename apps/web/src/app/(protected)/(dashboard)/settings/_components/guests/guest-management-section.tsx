"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Badge } from "@crikket/ui/components/ui/badge"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { Input } from "@crikket/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crikket/ui/components/ui/table"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, X } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

import { orpc } from "@/utils/orpc"

import { getRequestErrorMessage } from "../../_lib/get-request-error-message"

interface GuestManagementSectionProps {
  canManage: boolean
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

function formatDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString()
}

export function GuestManagementSection({
  canManage,
}: GuestManagementSectionProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = React.useState("")
  const [projectId, setProjectId] = React.useState("")

  const guestsQueryOptions = orpc.project.access.listOrgGuests.queryOptions()
  const guestsQuery = useQuery({ ...guestsQueryOptions, enabled: canManage })
  const projectsQuery = useQuery({
    ...orpc.project.list.queryOptions(),
    enabled: canManage,
  })

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: guestsQueryOptions.queryKey,
    })
  }, [queryClient, guestsQueryOptions.queryKey])

  const inviteMutation = useMutation(
    orpc.project.access.inviteGuest.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          result.invited
            ? "Invitation sent"
            : "Project added — they already have an account"
        )
        setEmail("")
        await refresh()
      },
      onError: (error) => toast.error(getRequestErrorMessage(error)),
    })
  )

  const removeProjectMutation = useMutation(
    orpc.project.access.removeGuest.mutationOptions({
      onSuccess: async () => {
        toast.success("Project access removed")
        await refresh()
      },
      onError: (error) => toast.error(getRequestErrorMessage(error)),
    })
  )

  const removeGuestMutation = useMutation(
    orpc.project.access.removeOrgGuest.mutationOptions({
      onSuccess: async () => {
        toast.success("Guest removed")
        await refresh()
      },
      onError: (error) => toast.error(getRequestErrorMessage(error)),
    })
  )

  const resendMutation = useMutation(
    orpc.project.access.resendGuestInvite.mutationOptions({
      onSuccess: async () => {
        toast.success("Invitation sent again")
        await refresh()
      },
      onError: (error) => toast.error(getRequestErrorMessage(error)),
    })
  )

  const guests = guestsQuery.data ?? []
  const projects = projectsQuery.data ?? []
  const isBusy =
    inviteMutation.isPending ||
    removeProjectMutation.isPending ||
    removeGuestMutation.isPending ||
    resendMutation.isPending

  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!(trimmed && projectId)) {
      return
    }

    inviteMutation.mutate({ email: trimmed, projectId })
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Guests</CardTitle>
          <CardDescription>
            Only organization admins and owners can manage guest access.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite a guest</CardTitle>
          <CardDescription>
            Pick the project they should follow. A guest can be on more than one
            project — invite them again for each.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={handleInvite}
          >
            <Input
              autoComplete="off"
              className="sm:flex-1"
              disabled={isBusy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="client@example.com"
              type="email"
              value={email}
            />
            <Select
              disabled={isBusy || projects.length === 0}
              onValueChange={(value) => setProjectId(value ?? "")}
              value={projectId}
            >
              <SelectTrigger className="sm:w-[220px]">
                <SelectValue placeholder="Select a project">
                  {projects.find((project) => project.id === projectId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={isBusy || email.trim().length === 0 || !projectId}
              type="submit"
            >
              {inviteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Invite"
              )}
            </Button>
          </form>
          {projects.length === 0 && !projectsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">
              No projects yet. A project appears once one of its capture keys is
              assigned to it in Public Keys.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Guests
            {guests.length > 0 ? (
              <span className="pl-2 font-normal text-muted-foreground text-sm tabular-nums">
                {guests.length}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>
            Guests don't use a paid seat and never see projects they weren't
            given.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {guestsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {guestsQuery.isError ? (
            <p className="text-destructive text-sm">
              {getRequestErrorMessage(guestsQuery.error)}
            </p>
          ) : null}

          {!guestsQuery.isLoading && guests.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              No guests yet. Invite a client above and they'll show up here.
            </p>
          ) : null}

          {guests.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guests.map((guest) => (
                    <TableRow key={guest.email}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-8" isGuest>
                            <AvatarImage
                              alt={guest.name ?? guest.email}
                              src={guest.image ?? undefined}
                            />
                            <AvatarFallback className="text-xs">
                              {initials(guest.name ?? guest.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-sm">
                              {guest.name ?? guest.email}
                            </p>
                            {guest.name ? (
                              <p className="truncate text-muted-foreground text-xs">
                                {guest.email}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {guest.projects.map((project) => (
                            <Badge
                              className="gap-1 pr-1"
                              key={project.grantId}
                              variant="outline"
                            >
                              {project.projectName}
                              <button
                                aria-label={`Remove ${guest.email} from ${project.projectName}`}
                                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                disabled={isBusy}
                                onClick={() =>
                                  removeProjectMutation.mutate({
                                    grantId: project.grantId,
                                  })
                                }
                                type="button"
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            guest.status === "active" ? "secondary" : "outline"
                          }
                        >
                          {guest.status === "active" ? "Active" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                        {formatDate(guest.invitedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {guest.status === "pending" && guest.projects[0] ? (
                            <Button
                              disabled={isBusy}
                              onClick={() =>
                                resendMutation.mutate({
                                  grantId: guest.projects[0]?.grantId ?? "",
                                })
                              }
                              size="sm"
                              variant="ghost"
                            >
                              Resend
                            </Button>
                          ) : null}
                          <Button
                            disabled={isBusy}
                            onClick={() =>
                              removeGuestMutation.mutate({
                                email: guest.email,
                              })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
