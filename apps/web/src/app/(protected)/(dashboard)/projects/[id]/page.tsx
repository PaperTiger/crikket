import type { Metadata } from "next"

import { client } from "@/utils/orpc"

import { BugReportsList } from "../../_components/bug-reports/bug-reports-list"
import { ProjectAccessAvatars } from "./_components/project-access-avatars"

export const metadata: Metadata = {
  title: "Project",
  description: "Bug reports for a single project",
}

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params

  const projects = await client.project.list().catch(() => [])
  const project = projects.find((item) => item.id === id)
  const heading = project?.name ?? "Project"

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">{heading}</h1>
          <p className="mt-1 text-muted-foreground">
            {project?.clientName ?? "Bug reports for this project"}
          </p>
        </div>
        <ProjectAccessAvatars projectId={id} projectName={heading} />
      </div>
      <BugReportsList forcedProjectId={id} />
    </div>
  )
}
