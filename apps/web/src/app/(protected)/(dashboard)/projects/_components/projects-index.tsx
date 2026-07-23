"use client"

import { Badge } from "@crikket/ui/components/ui/badge"
import { Button } from "@crikket/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crikket/ui/components/ui/table"
import { useQuery } from "@tanstack/react-query"
import { Loader2, UsersRound, X } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import * as React from "react"

import { TeamAvatars } from "@/components/team-avatars"
import { orpc } from "@/utils/orpc"

export function ProjectsIndex() {
  const router = useRouter()
  const [teamMemberIds, setTeamMemberIds] = React.useState<string[]>([])

  const teammatesQuery = useQuery(
    orpc.project.team.listTeammates.queryOptions()
  )
  const projectsQuery = useQuery(
    orpc.project.list.queryOptions({
      input: {
        teamMemberIds: teamMemberIds.length > 0 ? teamMemberIds : undefined,
      },
    })
  )

  const teammates = teammatesQuery.data ?? []
  const projects = projectsQuery.data ?? []

  const teammateById = React.useMemo(() => {
    const map = new Map<string, (typeof teammates)[number]>()
    for (const teammate of teammates) {
      map.set(teammate.userId, teammate)
    }
    return map
  }, [teammates])

  const toggleTeamMember = (userId: string) => {
    setTeamMemberIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <p className="text-muted-foreground text-sm">
          Every project in this workspace. You can open any of them whether or
          not you're on the team.
        </p>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline">
                  <UsersRound className="size-4" />
                  Team
                  {teamMemberIds.length > 0 ? ` (${teamMemberIds.length})` : ""}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter by team member</DropdownMenuLabel>
              {teammates.map((teammate) => (
                <DropdownMenuCheckboxItem
                  checked={teamMemberIds.includes(teammate.userId)}
                  key={teammate.userId}
                  onCheckedChange={() => toggleTeamMember(teammate.userId)}
                >
                  {teammate.name || teammate.email}
                </DropdownMenuCheckboxItem>
              ))}
              {teammates.length === 0 ? (
                <p className="px-2 py-1.5 text-muted-foreground text-xs">
                  No teammates yet.
                </p>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {teamMemberIds.length > 0 ? (
            <Button
              onClick={() => setTeamMemberIds([])}
              size="sm"
              variant="ghost"
            >
              <X className="size-4" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {projectsQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!projectsQuery.isLoading && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border py-16">
          <h2 className="font-semibold text-lg">
            {teamMemberIds.length > 0 ? "No matching projects" : "No projects"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {teamMemberIds.length > 0
              ? "Nobody selected is on a project yet."
              : "A project appears once one of its capture keys is assigned to it."}
          </p>
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Keys</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  className="cursor-pointer"
                  key={project.id}
                  onClick={() =>
                    router.push(`/projects/${project.id}` as Route)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      router.push(`/projects/${project.id}` as Route)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {project.clientName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {project.teamUserIds.length > 0 ? (
                      <TeamAvatars
                        people={project.teamUserIds.map((userId) => {
                          const teammate = teammateById.get(userId)
                          return {
                            key: userId,
                            label: teammate?.name || teammate?.email || "?",
                            image: teammate?.image ?? null,
                          }
                        })}
                        size="sm"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Nobody yet
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{project.keyCount}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
