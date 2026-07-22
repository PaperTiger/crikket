"use client"

import { DataTable } from "@crikket/ui/components/data-table/data-table"
import { DataTableViewOptions } from "@crikket/ui/components/data-table/data-table-view-options"
import { Checkbox } from "@crikket/ui/components/ui/checkbox"
import { Input } from "@crikket/ui/components/ui/input"
import { Label } from "@crikket/ui/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import { useDataTable } from "@crikket/ui/hooks/use-data-table"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import type { ReactNode } from "react"
import * as React from "react"

import { orpc } from "@/utils/orpc"
import type { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { createGroupedTableColumns } from "./bug-reports-grouped-table-columns"
import { type BugReportGroupBy, GROUP_BY_SELECT_OPTIONS } from "./filters"
import type { BugReportGroupRow } from "./types"

interface BugReportsGroupedTableProps {
  filtersState: ReturnType<typeof useBugReportsFilters>
  viewToggle: ReactNode
}

export function BugReportsGroupedTable({
  filtersState,
  viewToggle,
}: BugReportsGroupedTableProps) {
  const { group, includeClosed, debouncedSearch } = filtersState

  const groupedQuery = useQuery(
    orpc.bugReport.getGroupedStats.queryOptions({
      input: {
        groupBy: group,
        includeClosed,
        search: debouncedSearch || undefined,
      },
    })
  )

  const rows = React.useMemo<BugReportGroupRow[]>(
    () => groupedQuery.data?.rows ?? [],
    [groupedQuery.data]
  )

  const columns = React.useMemo(
    () =>
      createGroupedTableColumns({
        groupBy: group,
        onDrillDown: (groupKey) => filtersState.drillDownInto(group, groupKey),
      }),
    [group, filtersState.drillDownInto]
  )

  const { table } = useDataTable({
    data: rows,
    columns,
    pageCount: 1,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 100,
      },
    },
    getRowId: (row, index) => row.groupKey ?? `ungrouped-${index}`,
    shallow: false,
    history: "replace",
    enableRowSelection: false,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) =>
              filtersState.setSearchValue(event.target.value)
            }
            placeholder="Search title, description, or URL"
            value={filtersState.searchValue}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewToggle}

          <Select
            onValueChange={(value) =>
              filtersState.setGroup(value as BugReportGroupBy)
            }
            value={group}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_SELECT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 font-normal text-sm">
            <Checkbox
              checked={includeClosed}
              onCheckedChange={(checked) =>
                filtersState.setIncludeClosed(checked === true)
              }
            />
            Closed
          </Label>

          <DataTableViewOptions table={table} />
        </div>
      </div>

      {groupedQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-sm">Failed to load grouped stats</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {groupedQuery.error?.message || "Unexpected error"}
          </p>
        </div>
      ) : null}

      {groupedQuery.isLoading ? (
        <div className="space-y-2">
          {["r1", "r2", "r3", "r4", "r5"].map((skeletonKey) => (
            <div
              className="h-10 w-full animate-pulse rounded-md bg-muted"
              key={skeletonKey}
            />
          ))}
        </div>
      ) : null}

      {!(groupedQuery.isLoading || groupedQuery.isError) &&
      rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border py-16">
          <h2 className="font-semibold text-lg">No reports</h2>
          <p className="text-muted-foreground text-sm">
            Try adjusting your search or the group-by option.
          </p>
        </div>
      ) : null}

      {!(groupedQuery.isLoading || groupedQuery.isError) && rows.length > 0 ? (
        <DataTable hideSelectedRowsLabel table={table} />
      ) : null}
    </div>
  )
}
