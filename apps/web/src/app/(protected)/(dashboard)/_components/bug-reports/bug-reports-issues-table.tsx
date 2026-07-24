"use client"

import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"
import { Button } from "@crikket/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crikket/ui/components/ui/tooltip"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Copy,
  ImageIcon,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Play,
  Trash2,
} from "lucide-react"
import type { Route } from "next"
import Image from "next/image"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import * as React from "react"
import { toast } from "sonner"

import {
  AssigneeControl,
  PriorityControl,
  StatusControl,
  TypeControl,
} from "@/app/s/[id]/_components/ticket-controls"
import { parseReporterFromDescription } from "@/app/s/[id]/_components/utils"
import { client, orpc } from "@/utils/orpc"
import { useBugReportsData } from "../../_hooks/use-bug-reports-data"
import type { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportsToolbar } from "./bug-reports-toolbar"
import { STATUS_OPTIONS } from "./filters"
import type { BugReportListItem } from "./types"

interface BugReportsIssuesTableProps {
  filtersState: ReturnType<typeof useBugReportsFilters>
  viewToggle: ReactNode
  /**
   * Guest portal mode: no assignee/type editing (the staff directory is not
   * theirs to see, and category is staff-only), but status stays editable —
   * triage is the whole reason a guest is here.
   */
  guestMode?: boolean
}

// Rank used for the default "sort by status" ordering (To do first).
const STATUS_RANK = new Map(
  STATUS_OPTIONS.map((option, index) => [option.value, index])
)

function statusRank(status: BugReportListItem["status"]): number {
  return STATUS_RANK.get(status) ?? STATUS_OPTIONS.length
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
 * Inline field updates for a row. Refetches rather than patching the cache, so
 * a change the server refuses snaps back.
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

/** Fixed-size 16:9 preview, same source/fallback logic as the grid card. */
function IssueThumbnail({ report }: { report: BugReportListItem }) {
  const src =
    report.thumbnail ??
    (report.attachmentType === "screenshot" ? report.attachmentUrl : null)

  return (
    <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded border bg-muted">
      {src ? (
        <Image alt="" className="object-cover" fill sizes="64px" src={src} />
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

/** Reporter name; hovering reveals their email when the viewer may see it. */
function ReporterLabel({
  name,
  email,
}: {
  name: string
  email: string | null
}) {
  const inner = (
    <span className="inline-flex items-center gap-1">
      <PenLine aria-hidden className="size-3" />
      {name}
    </span>
  )
  if (!email) {
    return inner
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-default" />}>
        {inner}
      </TooltipTrigger>
      <TooltipContent>Reported by {email}</TooltipContent>
    </Tooltip>
  )
}

/** Row ⋮ menu: copy link (everyone), delete (staff), then refetch the list. */
function RowActionsMenu({
  id,
  canDelete,
  onDeleted,
}: {
  id: string
  canDelete: boolean
  onDeleted: () => Promise<unknown>
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => client.bugReport.delete({ id }),
    onSuccess: async () => {
      toast.success("Ticket deleted")
      setConfirmOpen(false)
      await onDeleted()
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete ticket")
    },
  })

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${id}`)
      toast.success("Ticket link copied")
    } catch (error) {
      reportNonFatalError("Failed to copy ticket link", error)
      toast.error("Failed to copy link")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Ticket actions"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={handleCopyLink}>
            <Copy className="size-4" />
            Copy ticket link
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmOpen(true)}
                variant="destructive"
              >
                <Trash2 className="size-4" />
                Delete ticket
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        confirmText="Delete ticket"
        description="This permanently removes the ticket and its attachments from storage. This cannot be undone."
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          await deleteMutation.mutateAsync()
        }}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Delete this ticket?"
        variant="destructive"
      />
    </>
  )
}

type TriageUpdate = Parameters<
  ReturnType<typeof useIssueTriage>["update"]
>[0]

function IssueRow({
  report,
  guestMode,
  isTriaging,
  onTriage,
  onOpen,
  onChanged,
}: {
  report: BugReportListItem
  guestMode: boolean
  isTriaging: boolean
  onTriage: (input: TriageUpdate) => void
  onOpen: () => void
  onChanged: () => Promise<unknown>
}) {
  // SDK submissions carry the reporter in the description, not a relation, so
  // fall back to parsing it (same as the ticket detail page).
  const parsedReporter = parseReporterFromDescription(report.description)
  const reporterName = report.uploader?.name ?? parsedReporter?.name
  const reporterEmail = report.reporterEmail ?? parsedReporter?.email ?? null

  return (
    <div className="flex items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40">
      {/* Thumbnail + title/reporter navigate to the ticket. */}
      <button
        aria-label={`Open ${report.title}`}
        className="shrink-0 cursor-pointer rounded"
        onClick={onOpen}
        type="button"
      >
        <IssueThumbnail report={report} />
      </button>

      {/* Icon-only controls, each opening its dropdown/popup. Type and assignee
          are staff-only (category isn't guest-editable, and guests can't
          enumerate the staff directory); priority is editable by both. */}
      <div className="flex shrink-0 items-center">
        {guestMode ? null : (
          <TypeControl
            category={report.category}
            disabled={isTriaging}
            editable
            iconOnly
            onChange={(category) => onTriage({ id: report.id, category })}
          />
        )}
        {guestMode ? null : (
          <AssigneeControl
            assignee={null}
            assigneeId={report.assigneeId}
            disabled={isTriaging}
            editable
            iconOnly
            onChange={(assigneeId) => onTriage({ id: report.id, assigneeId })}
          />
        )}
        <PriorityControl
          disabled={isTriaging}
          editable
          iconOnly
          onChange={(priority) => onTriage({ id: report.id, priority })}
          priority={report.priority}
        />
      </div>

      <button
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={onOpen}
        type="button"
      >
        <div className="truncate font-medium text-sm" title={report.title}>
          {report.title || "Untitled ticket"}
        </div>
        {reporterName ? (
          <div className="truncate text-muted-foreground text-xs">
            <ReporterLabel email={reporterEmail} name={reporterName} />
          </div>
        ) : null}
      </button>

      {report.commentCount > 0 ? (
        <button
          aria-label={`${report.commentCount} comments — open ticket`}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground text-xs tabular-nums transition-colors hover:bg-muted hover:text-foreground"
          onClick={onOpen}
          type="button"
        >
          <MessageSquare className="size-3.5" />
          {report.commentCount}
        </button>
      ) : null}

      <div className="shrink-0">
        <StatusControl
          disabled={isTriaging}
          editable
          onChange={(status) => onTriage({ id: report.id, status })}
          status={report.status}
        />
      </div>

      <span className="w-16 shrink-0 whitespace-nowrap text-right text-muted-foreground text-xs">
        {formatRelative(report.updatedAt)}
      </span>

      <div className="shrink-0">
        <RowActionsMenu
          canDelete={!guestMode}
          id={report.id}
          onDeleted={onChanged}
        />
      </div>
    </div>
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
              className="h-14 w-full animate-pulse rounded-md bg-muted"
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
          {orderedReports.map((report) => (
            <IssueRow
              guestMode={guestMode}
              isTriaging={triage.pendingId === report.id}
              key={report.id}
              onChanged={refetchAll}
              onOpen={() => router.push(`/s/${report.id}` as Route)}
              onTriage={triage.update}
              report={report}
            />
          ))}
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
