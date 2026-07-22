"use client"

import { DataTableColumnHeader } from "@crikket/ui/components/data-table/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"

import { type BugReportGroupBy, formatGroupColumnHeader } from "./filters"
import type { BugReportGroupRow } from "./types"

interface GroupedTableColumnsOptions {
  groupBy: BugReportGroupBy
}

const COUNT_COLUMNS: Array<{
  id: keyof BugReportGroupRow
  label: string
}> = [
  { id: "toDo", label: "To do" },
  { id: "inProgress", label: "In progress" },
  { id: "clientReview", label: "Client review" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
  { id: "total", label: "Total" },
]

export function createGroupedTableColumns({
  groupBy,
}: GroupedTableColumnsOptions): ColumnDef<BugReportGroupRow>[] {
  const groupHeader = formatGroupColumnHeader(groupBy)

  return [
    {
      accessorKey: "groupLabel",
      enableHiding: false,
      meta: { label: groupHeader },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label={groupHeader} />
      ),
      // The whole row is the click target (see BugReportsGroupedTable); the
      // label just needs to read as an actionable link for grouped rows.
      cell: ({ row }) => {
        const { groupKey, groupLabel } = row.original

        if (!groupKey) {
          return (
            <span className="font-medium text-muted-foreground">
              {groupLabel}
            </span>
          )
        }

        return (
          <span
            className="block max-w-[420px] truncate font-medium text-primary underline-offset-4 group-hover/row:underline"
            title={groupLabel}
          >
            {groupLabel}
          </span>
        )
      },
    },
    ...COUNT_COLUMNS.map<ColumnDef<BugReportGroupRow>>((countColumn) => ({
      accessorKey: countColumn.id,
      enableSorting: false,
      meta: { label: countColumn.label },
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} label={countColumn.label} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original[countColumn.id]}
        </div>
      ),
    })),
  ]
}
