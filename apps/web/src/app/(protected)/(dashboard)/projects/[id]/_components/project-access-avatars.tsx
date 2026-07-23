"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"

import { TeamAvatars } from "@/components/team-avatars"
import { orpc } from "@/utils/orpc"

import { ProjectAccessDialog } from "./project-access-dialog"

interface ProjectAccessAvatarsProps {
  projectId: string
  projectName: string
}

/**
 * The avatar stack and "Manage access" button in the project page header.
 * Shows the project's team first, then its guests.
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
    const team = (accessQuery.data?.teamMembers ?? []).map((teamMember) => ({
      key: teamMember.id,
      label: teamMember.name || teamMember.email,
      image: teamMember.image,
    }))
    const guests = (accessQuery.data?.guests ?? []).map((guest) => ({
      key: guest.grantId,
      label: guest.name ?? guest.email,
      image: guest.image,
    }))

    return [...team, ...guests]
  }, [accessQuery.data])

  return (
    <div className="flex items-center gap-3">
      {people.length > 0 ? (
        <button
          className="flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setIsDialogOpen(true)}
          type="button"
        >
          <TeamAvatars people={people} />
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
