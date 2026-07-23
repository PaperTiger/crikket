"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crikket/ui/components/ui/table"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ImageIcon, Loader2, Play } from "lucide-react"
import type { Route } from "next"
import Image from "next/image"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import * as React from "react"
import { toast } from "sonner"

import { orpc } from "@/utils/orpc"
import { useBugReportsData } from "../../_hooks/use-bug-reports-data"
import type { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportsToolbar } from "./bug-reports-toolbar"
import {
  formatPriorityLabel,
  formatStatusLabel,
  PRIORITY_FILTER_OPTIONS,
  STATUS_OPTIONS,
} from "./filters"
import { StatusPill } from "./status-pill"
import type { BugReportListItem } from "./types"

interface BugReportsIssuesTableProps {
  filtersState: ReturnType<typeof useBugReportsFilters>
  viewToggle: ReactNode
  /**
   * Guest portal mode: no assignee column (the staff directory is not theirs
   * to see) and status/priority become editable inline, since triage is the
   * whole reason a guest is here.
   */
  guestMode?: boolean
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

/**
 * Inline status/priority updates for the guest table. Refetches rather than
 * patching the cache, so a change that the server refuses snaps back.
 */
function useIssueTriage(onSettled: () => Promise<void>) {
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  const mutation = useMutation(
    orpc.bugReport.update.mutationOptions({
      onSuccess: async () => {
        await onSettled()
      },
      onError: (error) => {
        toast.error(error.message || "Could not update the issue")
      },
      onSettled: () => {
        setPendingId(null)
      },
    })
  )

  return {
    pendingId,
    update: (
      input: Parameters<typeof mutation.mutate>[0] & { id: string }
    ): void => {
      setPendingId(input.id)
      mutation.mutate(input)
    },
  }
}

/**
 * Compact landscape preview for a table row. Same fixed aspect (video/16:9) and
 * fallback logic as the grid card, so both views read consistently.
 */
function IssueThumbnail({ report }: { report: BugReportListItem }) {
  const src =
    report.thumbnail ??
    (report.attachmentType === "screenshot" ? report.attachmentUrl : null)

  return (
    <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded border bg-muted">
      {src ? (
        <Image alt="" className="object-cover" fill sizes="80px" src={src} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          {report.attachmentType === "video" ? (
            <Play className="size-4" />
          ) : (
            <ImageIcon className="size-4" />
          )}
        </div>
      )}
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(WHITESPACE_RE)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** A triage dropdown that doesn't trigger the row's navigation. */
function TriageSelect<TValue extends string>({
  value,
  options,
  label,
  width,
  disabled,
  onChange,
}: {
  value: TValue
  options: ReadonlyArray<{ value: TValue; label: string }>
  label: string
  width: string
  disabled: boolean
  onChange: (value: TValue) => void
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => onChange(next as TValue)}
      value={value}
    >
      <SelectTrigger className={`h-8 ${width}`} size="sm">
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AssigneeCell({
  assigneeId,
  assignee,
}: {
  assigneeId: string | null
  assignee: { name: string; avatarUrl: string | null } | undefined
}) {
  if (!assigneeId) {
    return <span className="text-muted-foreground text-sm">Unassigned</span>
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        {assignee?.avatarUrl ? (
          <AvatarImage alt={assignee.name} src={assignee.avatarUrl} />
        ) : null}
        <AvatarFallback>
          {assignee ? initials(assignee.name) : "?"}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm">{assignee?.name ?? "Unknown"}</span>
    </div>
  )
}

function IssueRow({
  report,
  assignee,
  guestMode,
  isTriaging,
  onTriage,
  onOpen,
}: {
  report: BugReportListItem
  assignee: { name: string; avatarUrl: string | null } | undefined
  guestMode: boolean
  isTriaging: boolean
  onTriage: (input: { id: string } & Partial<BugReportListItem>) => void
  onOpen: () => void
}) {
  const host = hostFromUrl(report.url)
  // Guests edit inline, so their cells must swallow the row's navigation click.
  const stopRowNavigation = (event: React.MouseEvent) => {
    if (guestMode) {
      event.stopPropagation()
    }
  }

  return (
    <TableRow
      className="cursor-pointer"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <TableCell className="w-[92px]">
        <IssueThumbnail report={report} />
      </TableCell>

      <TableCell className="max-w-[420px]">
        <div className="truncate font-medium" title={report.title}>
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

      <TableCell onClick={(event) => event.stopPropagation()}>
        {guestMode ? (
          <TriageSelect
            disabled={isTriaging}
            label={formatStatusLabel(report.status)}
            onChange={(status) => onTriage({ id: report.id, status })}
            options={STATUS_OPTIONS}
            value={report.status}
            width="w-[150px]"
          />
        ) : (
          <StatusPill
            disabled={isTriaging}
            onChange={(status) => onTriage({ id: report.id, status })}
            status={report.status}
          />
        )}
      </TableCell>

      {guestMode ? null : (
        <TableCell>
          <AssigneeCell assignee={assignee} assigneeId={report.assigneeId} />
        </TableCell>
      )}

      <TableCell className="text-sm" onClick={stopRowNavigation}>
        {guestMode ? (
          <TriageSelect
            disabled={isTriaging}
            label={formatPriorityLabel(report.priority)}
            onChange={(priority) => onTriage({ id: report.id, priority })}
            options={PRIORITY_FILTER_OPTIONS}
            value={report.priority}
            width="w-[130px]"
          />
        ) : (
          formatPriorityLabel(report.priority)
        )}
      </TableCell>

      <TableCell className="whitespace-nowrap text-right text-muted-foreground text-sm">
        {formatRelative(report.updatedAt)}
      </TableCell>
    </TableRow>
  )
}

export function BugReportsIssuesTable({
  filtersState,
  viewToggle,
  guestMode = false,
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
    refetchAll,
    loadMoreRef,
  } = useBugReportsData({
    search: filtersState.debouncedSearch,
    sort: filtersState.sort,
    filters: filtersState.filters,
  })

  const triage = useIssueTriage(refetchAll)

  // The people directory is organization-only; asking for it as a guest just
  // produces a 403.
  const peopleQuery = useQuery({
    ...orpc.people.list.queryOptions(),
    enabled: !guestMode,
  })
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
        guestMode={guestMode}
        hideProjectDrillDown={Boolean(filtersState.forcedProjectId)}
        onClearDrillDown={filtersState.clearDrillDown}
        onClearFilters={filtersState.clearFilters}
        onSearchChange={filtersState.setSearchValue}
        onSortChange={filtersState.setSort}
        onTogglePriority={filtersState.togglePriority}
        onToggleStatus={filtersState.toggleStatus}
        onToggleTeamMember={filtersState.toggleTeamMember}
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
                <TableHead className="w-[92px]">
                  <span className="sr-only">Preview</span>
                </TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                {guestMode ? null : <TableHead>Assignee</TableHead>}
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedReports.map((report) => (
                <IssueRow
                  assignee={
                    report.assigneeId
                      ? peopleById.get(report.assigneeId)
                      : undefined
                  }
                  guestMode={guestMode}
                  isTriaging={triage.pendingId === report.id}
                  key={report.id}
                  onOpen={() => router.push(`/s/${report.id}` as Route)}
                  onTriage={triage.update}
                  report={report}
                />
              ))}
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
