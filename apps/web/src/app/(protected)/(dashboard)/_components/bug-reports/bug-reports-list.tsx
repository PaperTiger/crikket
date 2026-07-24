"use client"

import { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportsGroupedTable } from "./bug-reports-grouped-table"
import { BugReportsIssuesTable } from "./bug-reports-issues-table"

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

  // The grid view has been retired — everything uses the table now, so there is
  // no table/grid toggle.
  if (guestMode) {
    return (
      <BugReportsIssuesTable
        filtersState={filtersState}
        guestMode
        viewToggle={null}
      />
    )
  }

  // On a project page the project is fixed, so the "table" is the list of that
  // project's issues (sorted by status). The cross-project dashboard keeps the
  // grouped rollup as its table.
  if (forcedProjectId) {
    return (
      <BugReportsIssuesTable filtersState={filtersState} viewToggle={null} />
    )
  }

  return (
    <BugReportsGroupedTable filtersState={filtersState} viewToggle={null} />
  )
}
