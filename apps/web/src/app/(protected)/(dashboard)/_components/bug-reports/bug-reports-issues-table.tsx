"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Badge } from "@crikket/ui/components/ui/badge"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crikket/ui/components/ui/table"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import * as React from "react"

import { orpc } from "@/utils/orpc"
import { useBugReportsData } from "../../_hooks/use-bug-reports-data"
import type { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportsToolbar } from "./bug-reports-toolbar"
import {
  formatPriorityLabel,
  formatStatusLabel,
  STATUS_OPTIONS,
} from "./filters"
import type { BugReportListItem } from "./types"

interface BugReportsIssuesTableProps {
  filtersState: ReturnType<typeof useBugReportsFilters>
  viewToggle: ReactNode
}

// Rank used for the default "sort by status" ordering (To do first).
const STATUS_RANK = new Map(
  STATUS_OPTIONS.map((option, index) => [option.value, index])
)

const TRAILING_SLASH_RE = /\/$/
const WHITESPACE_RE = /\s+/

function statusRank(status: BugReportListItem["status"]): number {
  return STATUS_RANK.get(status) ?? STATUS_OPTIONS.length
}

function hostFromUrl(url: string | undefined): string | null {
  if (!url) {
    return null
  }
  try {
    const parsed = new URL(url)
    return parsed.host + parsed.pathname.replace(TRAILING_SLASH_RE, "")
  } catch {
    return url
  }
}

function formatRelative(value: string): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) {
    return ""
  }
  const diffMs = Date.now() - then
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) {
    return "just now"
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.round(hours / 24)
  if (days < 30) {
    return `${days}d ago`
  }
  return new Date(value).toLocaleDateString()
}

function initials(name: string): string {
  return name
    .split(WHITESPACE_RE)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function BugReportsIssuesTable({
  filtersState,
  viewToggle,
}: BugReportsIssuesTableProps) {
  const router = useRouter()
  const {
    reports,
    stats,
    isError,
    errorMessage,
    isLoading,
    isFetching,
    refetch,
    loadMoreRef,
  } = useBugReportsData({
    search: filtersState.debouncedSearch,
    sort: filtersState.sort,
    filters: filtersState.filters,
  })

  const peopleQuery = useQuery(orpc.people.list.queryOptions())
  const peopleById = React.useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null }>()
    for (const person of peopleQuery.data ?? []) {
      map.set(person.id, { name: person.name, avatarUrl: person.avatarUrl })
    }
    return map
  }, [peopleQuery.data])

  // Primary order is status (To do → Closed); the toolbar sort acts as the
  // stable secondary order within each status bucket.
  const orderedReports = React.useMemo(() => {
    return [...reports].sort(
      (a, b) => statusRank(a.status) - statusRank(b.status)
    )
  }, [reports])

  return (
    <div className="space-y-4">
      <BugReportsToolbar
        filters={filtersState.filters}
        hideProjectDrillDown={Boolean(filtersState.forcedProjectId)}
        onClearDrillDown={filtersState.clearDrillDown}
        onClearFilters={filtersState.clearFilters}
        onSearchChange={filtersState.setSearchValue}
        onSortChange={filtersState.setSort}
        onTogglePriority={filtersState.togglePriority}
        onToggleStatus={filtersState.toggleStatus}
        onToggleVisibility={filtersState.toggleVisibility}
        search={filtersState.searchValue}
        sort={filtersState.sort}
        stats={stats}
        viewToggle={viewToggle}
      />

      {isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-sm">Failed to load bug reports</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {errorMessage || "Unexpected error"}
          </p>
          <Button
            className="mt-3"
            onClick={() => refetch()}
            size="sm"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {["r1", "r2", "r3", "r4", "r5"].map((skeletonKey) => (
            <div
              className="h-12 w-full animate-pulse rounded-md bg-muted"
              key={skeletonKey}
            />
          ))}
        </div>
      ) : null}

      {!isLoading && orderedReports.length === 0 && !isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border py-16">
          <h2 className="font-semibold text-lg">
            {filtersState.hasActiveFilters
              ? "No matching issues"
              : "No issues yet"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {filtersState.hasActiveFilters
              ? "Try adjusting your search or filters."
              : "Issues reported for this project will appear here."}
          </p>
        </div>
      ) : null}

      {orderedReports.length > 0 ? (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedReports.map((report) => {
                const assignee = report.assigneeId
                  ? peopleById.get(report.assigneeId)
                  : undefined
                const host = hostFromUrl(report.url)

                return (
                  <TableRow
                    className="cursor-pointer"
                    key={report.id}
                    onClick={() => router.push(`/s/${report.id}` as Route)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        router.push(`/s/${report.id}` as Route)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <TableCell className="max-w-[420px]">
                      <div
                        className="truncate font-medium"
                        title={report.title}
                      >
                        {report.title || "Untitled issue"}
                      </div>
                      {host ? (
                        <div
                          className="truncate text-muted-foreground text-xs"
                          title={report.url}
                        >
                          {host}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge className="gap-1.5" variant="outline">
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full bg-muted-foreground"
                        />
                        {formatStatusLabel(report.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.assigneeId ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            {assignee?.avatarUrl ? (
                              <AvatarImage
                                alt={assignee.name}
                                src={assignee.avatarUrl}
                              />
                            ) : null}
                            <AvatarFallback>
                              {assignee ? initials(assignee.name) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm">
                            {assignee?.name ?? "Unknown"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatPriorityLabel(report.priority)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-muted-foreground text-sm">
                      {formatRelative(report.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {isFetching && !isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      <div aria-hidden className="h-1 w-full" ref={loadMoreRef} />
    </div>
  )
}
