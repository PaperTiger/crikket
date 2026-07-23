import { ArrowLeft } from "lucide-react"
import type { Metadata, Route } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BugReportsList } from "@/app/(protected)/(dashboard)/_components/bug-reports/bug-reports-list"
import { client } from "@/utils/orpc"

export const metadata: Metadata = {
  title: "Project",
  description: "Issues on a project you have access to",
}

interface PortalProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function PortalProjectPage({
  params,
}: PortalProjectPageProps) {
  const { id } = await params

  // Guests only get projects they were granted — this throws otherwise.
  const project = await client.project
    .getForGuest({ projectId: id })
    .catch(() => null)

  if (!project) {
    notFound()
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 pt-4">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        href={"/portal" as Route}
      >
        <ArrowLeft className="size-4" />
        All projects
      </Link>
      <div>
        <h1 className="font-bold text-3xl tracking-tight">{project.name}</h1>
        {project.clientName ? (
          <p className="mt-1 text-muted-foreground">{project.clientName}</p>
        ) : null}
      </div>
      <BugReportsList forcedProjectId={id} guestMode />
    </div>
  )
}
