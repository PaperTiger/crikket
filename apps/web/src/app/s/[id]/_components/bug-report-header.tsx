import { Button } from "@crikket/ui/components/ui/button"
import { Separator } from "@crikket/ui/components/ui/separator"
import { Home } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { PaperTigerWordmark } from "@/components/paper-tiger-wordmark"
import type { SharedBugReport } from "./types"

interface BugReportHeaderProps {
  data: SharedBugReport
}

/**
 * Links to the report's project — the org dashboard for staff, the portal for
 * guests. Two branches rather than a ternary href: typed routes reject a union
 * of route literals.
 */
function ProjectNameLink({
  project,
  isGuest,
}: {
  project: { id: string; name: string }
  isGuest: boolean
}) {
  const className =
    "truncate font-medium text-sm text-foreground underline underline-offset-4 hover:opacity-70"

  if (isGuest) {
    return (
      <Link
        className={className}
        href={`/portal/projects/${project.id}`}
        title={project.name}
      >
        {project.name}
      </Link>
    )
  }

  return (
    <Link
      className={className}
      href={`/projects/${project.id}`}
      title={project.name}
    >
      {project.name}
    </Link>
  )
}

export function BugReportHeader({
  data,
  sidebarTrigger,
}: BugReportHeaderProps & { sidebarTrigger?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="md:hidden">{sidebarTrigger}</div>
        <Link
          aria-label="Paper Tiger — back to dashboard"
          className="shrink-0 text-foreground transition-opacity hover:opacity-70"
          href="/"
        >
          <PaperTigerWordmark className="h-4 w-auto" />
        </Link>
        <Separator className="h-5 shrink-0" orientation="vertical" />
        {data.project ? (
          <ProjectNameLink isGuest={data.isGuest} project={data.project} />
        ) : (
          <span
            className="truncate font-medium text-sm"
            title={data.title ?? "Untitled"}
          >
            {data.title ?? "Untitled Bug Report"}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          nativeButton={false}
          render={
            <Link href="/">
              <Home />
              <span className="sr-only">Dashboard</span>
            </Link>
          }
          size="sm"
          variant="ghost"
        />
      </div>
    </header>
  )
}
