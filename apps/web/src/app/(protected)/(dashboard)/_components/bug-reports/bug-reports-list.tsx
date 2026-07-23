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
  /**
   * Guest portal mode. Drops everything a guest has no rights to — assignees,
   * visibility, bulk actions — and leaves search, filters and triage.
   */
  guestMode?: boolean
}

export function BugReportsList({
  forcedProjectId,
  guestMode = false,
}: BugReportsListProps = {}) {
  const filtersState = useBugReportsFilters({ forcedProjectId })

  const viewToggle = guestMode ? null : (
    <BugReportsViewToggle
      onViewChange={filtersState.setView}
      view={filtersState.view}
    />
  )

  // Guests get the issues table only — the grid and the cross-project rollup
  // both surface organization-wide context they should not have.
  if (guestMode) {
    return (
      <BugReportsIssuesTable
        filtersState={filtersState}
        guestMode
        viewToggle={viewToggle}
      />
    )
  }

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
