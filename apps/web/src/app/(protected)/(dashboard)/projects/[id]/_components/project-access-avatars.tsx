"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Button } from "@crikket/ui/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"

import { orpc } from "@/utils/orpc"

import { ProjectAccessDialog } from "./project-access-dialog"

interface ProjectAccessAvatarsProps {
  projectId: string
  projectName: string
}

const VISIBLE_AVATARS = 3
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

/**
 * The avatar stack and "Manage access" button in the project page header.
 * Shows everyone with access — organization members first, then guests.
 */
export function ProjectAccessAvatars({
  projectId,
  projectName,
}: ProjectAccessAvatarsProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const accessQuery = useQuery(
    orpc.project.access.list.queryOptions({ input: { projectId } })
  )

  const people = React.useMemo(() => {
    const members = (accessQuery.data?.orgMembers ?? []).map((member) => ({
      key: member.id,
      label: member.name || member.email,
      image: member.image,
    }))
    const guests = (accessQuery.data?.guests ?? []).map((guest) => ({
      key: guest.grantId,
      label: guest.name ?? guest.email,
      image: guest.image,
    }))

    return [...members, ...guests]
  }, [accessQuery.data])

  const visible = people.slice(0, VISIBLE_AVATARS)
  const overflow = people.length - visible.length

  return (
    <div className="flex items-center gap-3">
      {people.length > 0 ? (
        <button
          className="flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setIsDialogOpen(true)}
          type="button"
        >
          <div className="-space-x-2 flex items-center">
            {visible.map((person) => (
              <Avatar
                className="size-8 ring-2 ring-background"
                key={person.key}
                title={person.label}
              >
                <AvatarImage
                  alt={person.label}
                  src={person.image ?? undefined}
                />
                <AvatarFallback className="text-xs">
                  {initials(person.label)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {overflow > 0 ? (
            <span className="pl-3 text-muted-foreground text-xs tabular-nums">
              +{overflow}
            </span>
          ) : null}
        </button>
      ) : null}

      <Button onClick={() => setIsDialogOpen(true)} variant="outline">
        Manage access
      </Button>

      <ProjectAccessDialog
        onOpenChange={setIsDialogOpen}
        open={isDialogOpen}
        projectId={projectId}
        projectName={projectName}
      />
    </div>
  )
}
