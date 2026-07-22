"use client"

import { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportsGridView } from "./bug-reports-grid-view"
import { BugReportsGroupedTable } from "./bug-reports-grouped-table"
import { BugReportsIssuesTable } from "./bug-reports-issues-table"
import { BugReportsViewToggle } from "./bug-reports-view-toggle"
import { VIEW_OPTIONS } from "./filters"

interface BugReportsListProps {
  /** When set, pins every view to a single project (project detail page). */
  forcedProjectId?: string
}

export function BugReportsList({ forcedProjectId }: BugReportsListProps = {}) {
  const filtersState = useBugReportsFilters({ forcedProjectId })

  const viewToggle = (
    <BugReportsViewToggle
      onViewChange={filtersState.setView}
      view={filtersState.view}
    />
  )

  if (filtersState.view === VIEW_OPTIONS.grid) {
    return (
      <BugReportsGridView filtersState={filtersState} viewToggle={viewToggle} />
    )
  }

  // On a project page the project is fixed, so the "table" is the list of that
  // project's issues (sorted by status). The cross-project dashboard keeps the
  // grouped rollup as its table.
  if (forcedProjectId) {
    return (
      <BugReportsIssuesTable
        filtersState={filtersState}
        viewToggle={viewToggle}
      />
    )
  }

  return (
    <BugReportsGroupedTable
      filtersState={filtersState}
      viewToggle={viewToggle}
    />
  )
}
