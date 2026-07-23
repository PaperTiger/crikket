import { ArrowLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { SharedBugReport } from "./types"

interface BugReportBreadcrumbsProps {
  data: SharedBugReport
}

/**
 * Left-hand counterpart to the sidebar tab bar: "<- Project / Ticket".
 *
 * Deliberately mirrors the TabButton metrics in bug-report-sidebar.tsx
 * (py-1.5, text-xs, rounded-[4px], muted -> foreground on hover) so both ends
 * of the row read as one strip.
 *
 * Renders nothing when there is no project — public share viewers never get a
 * project, and /projects/[id] is behind auth.
 */
export function BugReportBreadcrumbs({ data }: BugReportBreadcrumbsProps) {
  if (!data.project) {
    return null
  }

  // Inlined below rather than hoisted to a const: typed routes widen a
  // `string` variable and reject it as an href.
  const projectId = data.project.id

  return (
    <nav
      aria-label="breadcrumb"
      className="flex shrink-0 items-center gap-1 border-b px-1 py-1"
    >
      <Link
        aria-label={`Back to ${data.project.name}`}
        className="flex shrink-0 items-center justify-center rounded-[4px] p-1.5 text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
        href={`/projects/${projectId}`}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </Link>
      <ol className="flex min-w-0 items-center gap-1">
        <li className="min-w-0">
          <Link
            className="block truncate rounded-[4px] px-2 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted/50 hover:text-foreground"
            href={`/projects/${projectId}`}
            title={data.project.name}
          >
            {data.project.name}
          </Link>
        </li>
        <li aria-hidden="true" className="shrink-0 text-muted-foreground">
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li className="min-w-0">
          <span
            aria-current="page"
            className="block truncate px-2 py-1.5 font-medium text-foreground text-xs"
            title={data.title ?? "Untitled"}
          >
            {data.title ?? "Untitled Bug Report"}
          </span>
        </li>
      </ol>
    </nav>
  )
}
