import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import type { Metadata } from "next"
import type { Route } from "next"
import Link from "next/link"

import { client } from "@/utils/orpc"

const META = {
  title: "Your projects",
  description: "Projects you've been given access to",
}

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
}

export default async function PortalHomePage() {
  const projects = await client.project.listForGuest().catch(() => [])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 pt-4">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">{META.title}</h1>
        <p className="mt-1 text-muted-foreground">{META.description}</p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No projects yet</CardTitle>
            <CardDescription>
              Once you're added to a project it will show up here. If you were
              expecting one, check with the person who invited you.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={`/portal/projects/${project.id}` as Route}
              key={project.id}
            >
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <CardTitle className="truncate text-base">
                    {project.name}
                  </CardTitle>
                  {project.clientName ? (
                    <CardDescription className="truncate">
                      {project.clientName}
                    </CardDescription>
                  ) : null}
                  <p className="pt-2 text-muted-foreground text-sm tabular-nums">
                    {project.openCount} open
                    <span className="px-1.5 text-muted-foreground/50">·</span>
                    {project.totalCount}{" "}
                    {project.totalCount === 1 ? "issue" : "issues"} total
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
