"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { LayoutGrid, Table2 } from "lucide-react"

import { type DashboardView, VIEW_OPTIONS } from "./filters"

interface BugReportsViewToggleProps {
  view: DashboardView
  onViewChange: (view: DashboardView) => void
}

export function BugReportsViewToggle({
  view,
  onViewChange,
}: BugReportsViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-background p-0.5">
      <Button
        aria-pressed={view === VIEW_OPTIONS.table}
        onClick={() => onViewChange(VIEW_OPTIONS.table)}
        size="sm"
        variant={view === VIEW_OPTIONS.table ? "secondary" : "ghost"}
      >
        <Table2 className="size-4" />
        Table
      </Button>
      <Button
        aria-pressed={view === VIEW_OPTIONS.grid}
        onClick={() => onViewChange(VIEW_OPTIONS.grid)}
        size="sm"
        variant={view === VIEW_OPTIONS.grid ? "secondary" : "ghost"}
      >
        <LayoutGrid className="size-4" />
        Grid
      </Button>
    </div>
  )
}
