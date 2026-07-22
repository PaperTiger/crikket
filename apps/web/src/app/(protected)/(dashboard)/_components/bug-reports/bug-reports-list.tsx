"use client"

import { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportsGridView } from "./bug-reports-grid-view"
import { BugReportsGroupedTable } from "./bug-reports-grouped-table"
import { BugReportsViewToggle } from "./bug-reports-view-toggle"
import { VIEW_OPTIONS } from "./filters"

export function BugReportsList() {
  const filtersState = useBugReportsFilters()

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

  return (
    <BugReportsGroupedTable
      filtersState={filtersState}
      viewToggle={viewToggle}
    />
  )
}
