"use client"

import type { BugReportCategory } from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { badgeVariants } from "@crikket/ui/components/ui/badge"
import { Button } from "@crikket/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { Textarea } from "@crikket/ui/components/ui/textarea"
import { cn } from "@crikket/ui/lib/utils"
import { useMutation } from "@tanstack/react-query"
import { ChevronDown, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { AssigneeCombobox } from "@/components/bug-reports/assignee-combobox"
import {
  CATEGORY_FIELD_OPTIONS,
  formatCategoryLabel,
  formatStatusLabel,
  PRIORITY_FIELD_OPTIONS,
  STATUS_FIELD_OPTIONS,
} from "@/lib/bug-report-fields"
import { statusColorStyle } from "@/lib/bug-report-status-color"
import { client, orpc } from "@/utils/orpc"
import type { SharedBugReport } from "./types"
import { extractReporterLine, stripReporterLine } from "./utils"

const WHITESPACE_PATTERN = /\s+/

type TicketUpdateInput = {
  status?: SharedBugReport["status"]
  priority?: Priority
  category?: BugReportCategory
  assigneeId?: string | null
  description?: string
}

/**
 * Inline ticket-field edits. Refetches the report on success rather than
 * patching the cache, so a change the server refuses snaps back.
 */
export function useTicketUpdate(id: string, onUpdated: () => Promise<unknown>) {
  const [pendingField, setPendingField] = useState<string | null>(null)

  const mutation = useMutation(
    orpc.bugReport.update.mutationOptions({
      onSuccess: async () => {
        await onUpdated()
      },
      onError: (error) => {
        toast.error(error.message || "Could not update the ticket")
      },
      onSettled: () => setPendingField(null),
    })
  )

  return {
    pendingField,
    update: (field: string, input: TicketUpdateInput) => {
      setPendingField(field)
      mutation.mutate({ id, ...input })
    },
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(WHITESPACE_PATTERN).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase() || "?"
}

/** Colored status pill that opens a dropdown to change the status. */
export function StatusControl({
  status,
  editable,
  disabled = false,
  size = "sm",
  onChange,
}: {
  status: SharedBugReport["status"]
  editable: boolean
  disabled?: boolean
  /** "lg" is used on the ticket page so the pill is easy to see and click. */
  size?: "sm" | "lg"
  onChange: (status: SharedBugReport["status"]) => void
}) {
  const colorStyle = statusColorStyle(status)
  const isLg = size === "lg"
  const pillClassName = cn(
    badgeVariants({ variant: "outline" }),
    "gap-1.5",
    isLg && "h-8 gap-2 px-3 text-sm [&>svg]:size-4!",
    colorStyle ? "" : "text-muted-foreground"
  )
  const dotClassName = cn(
    "rounded-full bg-current",
    isLg ? "size-2" : "size-1.5"
  )

  if (!editable) {
    return (
      <span className={pillClassName} style={colorStyle}>
        <span aria-hidden className={dotClassName} />
        {formatStatusLabel(status)}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            className={cn(
              pillClassName,
              "cursor-pointer disabled:cursor-default disabled:opacity-60"
            )}
            style={colorStyle}
            type="button"
          />
        }
      >
        <span aria-hidden className={dotClassName} />
        {formatStatusLabel(status)}
        <ChevronDown aria-hidden className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value !== status) {
              onChange(value as SharedBugReport["status"])
            }
          }}
          value={status}
        >
          {STATUS_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Label + control row used inside the sidebar ticket-info card. */
function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground text-sm">{label}</span>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  )
}

/** A boxed dropdown trigger styled like the wireframe's select controls. */
function fieldTriggerButton(disabled?: boolean) {
  return (
    <Button
      className="h-8 max-w-[200px] justify-between gap-2 font-normal"
      disabled={disabled}
      size="sm"
      type="button"
      variant="outline"
    />
  )
}

export function TypeControl({
  category,
  editable,
  disabled = false,
  onChange,
}: {
  category: BugReportCategory | null
  editable: boolean
  disabled?: boolean
  onChange: (category: BugReportCategory) => void
}) {
  const active = CATEGORY_FIELD_OPTIONS.find((o) => o.value === category)
  const ActiveIcon = active?.icon

  const value = (
    <>
      {ActiveIcon ? <ActiveIcon aria-hidden className="size-3.5" /> : null}
      <span className="truncate">{formatCategoryLabel(category)}</span>
    </>
  )

  if (!editable) {
    return (
      <span className="flex items-center gap-1.5 text-foreground text-sm">
        {value}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={fieldTriggerButton(disabled)}>
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {value}
        </span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          onValueChange={(next) => {
            if (next !== category) {
              onChange(next as BugReportCategory)
            }
          }}
          value={category ?? ""}
        >
          {CATEGORY_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden className="size-3.5" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PriorityControl({
  priority,
  editable,
  disabled = false,
  onChange,
}: {
  priority: Priority
  editable: boolean
  disabled?: boolean
  onChange: (priority: Priority) => void
}) {
  const active = PRIORITY_FIELD_OPTIONS.find((o) => o.value === priority)
  const ActiveIcon = active?.icon

  const value = (
    <>
      {ActiveIcon ? (
        <ActiveIcon
          aria-hidden
          className={cn("size-3.5", active?.colorClassName)}
        />
      ) : null}
      <span className="truncate">{active?.label ?? priority}</span>
    </>
  )

  if (!editable) {
    return (
      <span className="flex items-center gap-1.5 text-foreground text-sm">
        {value}
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={fieldTriggerButton(disabled)}>
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {value}
        </span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          onValueChange={(next) => {
            if (next !== priority) {
              onChange(next as Priority)
            }
          }}
          value={priority}
        >
          {PRIORITY_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon
                aria-hidden
                className={cn("size-3.5", option.colorClassName)}
              />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AssigneeControl({
  assignee,
  assigneeId,
  editable,
  disabled = false,
  onChange,
}: {
  assignee: SharedBugReport["assignee"]
  assigneeId: string | null
  editable: boolean
  disabled?: boolean
  onChange: (assigneeId: string | null) => void
}) {
  if (editable) {
    return (
      <div className="w-[200px]">
        <AssigneeCombobox
          disabled={disabled}
          onChange={onChange}
          value={assigneeId}
        />
      </div>
    )
  }

  if (!assignee) {
    return <span className="text-muted-foreground text-sm">Unassigned</span>
  }

  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <Avatar className="size-5">
        {assignee.avatarUrl ? (
          <AvatarImage alt={assignee.name} src={assignee.avatarUrl} />
        ) : null}
        <AvatarFallback className="text-[10px]">
          {getInitials(assignee.name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{assignee.name}</span>
    </span>
  )
}

/** The ⋮ menu next to the title: copy link (everyone), edit + delete (staff). */
export function TicketActionsMenu({
  id,
  canDelete,
  redirectTo,
  onEditDetails,
}: {
  id: string
  canDelete: boolean
  redirectTo: Route
  /** Opens the full edit sheet (title/tags/privacy) — staff only. */
  onEditDetails?: () => void
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async () => client.bugReport.delete({ id }),
    onSuccess: () => {
      toast.success("Ticket deleted")
      setConfirmOpen(false)
      router.push(redirectTo)
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
          {onEditDetails ? (
            <DropdownMenuItem onClick={onEditDetails}>
              <Pencil className="size-4" />
              Edit details
            </DropdownMenuItem>
          ) : null}
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

/**
 * The description: read-only text for clients, click-to-edit for staff. Editing
 * preserves the SDK's "Reported by …" line so the reporter card keeps resolving.
 */
export function DescriptionField({
  description,
  editable,
  disabled = false,
  onSave,
}: {
  description: string | null | undefined
  editable: boolean
  disabled?: boolean
  onSave: (nextDescription: string) => void
}) {
  const body = stripReporterLine(description)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(body)

  const textClassName =
    "whitespace-pre-wrap text-foreground text-sm leading-relaxed"

  if (isEditing) {
    const handleSave = () => {
      const trimmed = draft.trim()
      const reporterLine = extractReporterLine(description)
      const next = reporterLine
        ? [trimmed, reporterLine].filter(Boolean).join("\n\n")
        : trimmed
      onSave(next)
      setIsEditing(false)
    }

    return (
      <div className="space-y-2">
        <Textarea
          autoFocus
          className="min-h-24 text-sm"
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
        <div className="flex gap-2">
          <Button disabled={disabled} onClick={handleSave} size="sm">
            Save
          </Button>
          <Button
            onClick={() => setIsEditing(false)}
            size="sm"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const text = body || "No description provided."

  if (!editable) {
    return <p className={textClassName}>{text}</p>
  }

  return (
    <button
      className="-mx-2 block w-full cursor-text rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/50"
      onClick={() => {
        setDraft(body)
        setIsEditing(true)
      }}
      type="button"
    >
      <p className={cn(textClassName, !body && "text-muted-foreground")}>
        {text}
      </p>
    </button>
  )
}

export { FieldRow }
