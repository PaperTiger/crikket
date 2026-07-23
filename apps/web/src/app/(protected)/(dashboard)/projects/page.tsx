import type { Metadata } from "next"

import { ProjectsIndex } from "./_components/projects-index"

const META = {
  title: "All Projects",
  description: "Every project in this workspace and who's working on it",
}

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
}

export default function ProjectsIndexPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">{META.title}</h1>
        <p className="mt-1 text-muted-foreground">{META.description}</p>
      </div>
      <ProjectsIndex />
    </div>
  )
}
