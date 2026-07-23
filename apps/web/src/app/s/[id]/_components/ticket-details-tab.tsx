"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@crikket/ui/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crikket/ui/components/ui/tooltip"
import { cn } from "@crikket/ui/lib/utils"
import { ChevronDown, MonitorSmartphone } from "lucide-react"
import { useState } from "react"

import {
  AssigneeControl,
  FieldRow,
  PriorityControl,
  TypeControl,
  useTicketUpdate,
} from "./ticket-controls"
import type { DeviceInfo, SharedBugReport } from "./types"
import { parseReporterFromDescription } from "./utils"

const WHITESPACE_PATTERN = /\s+/

function getInitials(name: string): string {
  const parts = name.trim().split(WHITESPACE_PATTERN).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase() || "?"
}

function formatReportedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function EnvironmentRow({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  if (!value) {
    return null
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <span className="wrap-break-word text-foreground text-sm">{value}</span>
    </div>
  )
}

export function TicketDetailsTab({
  data,
  onUpdated,
}: {
  data: SharedBugReport
  onUpdated: () => Promise<unknown>
}) {
  const ticket = useTicketUpdate(data.id, onUpdated)
  // Closed by default, per the wireframe.
  const [sessionOpen, setSessionOpen] = useState(false)
  const deviceInfo = data.deviceInfo as DeviceInfo | null
  // SDK submissions carry the reporter in the description text, not a relation.
  const parsedReporter = parseReporterFromDescription(data.description)
  const reporterName =
    data.reporter?.name?.trim() || parsedReporter?.name || "Unknown reporter"
  // Prefer the resolved account email (members only); fall back to the address
  // parsed from an SDK submission's description.
  const reporterEmail = data.reporter?.email ?? parsedReporter?.email ?? null
  const reporterIsGuest = data.reporter?.isGuest ?? false

  return (
    <div className="space-y-4 p-4">
      {/* Reporter */}
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Avatar className="size-9" isGuest={reporterIsGuest}>
          {data.reporter?.image ? (
            <AvatarImage alt={reporterName} src={data.reporter.image} />
          ) : null}
          <AvatarFallback>{getInitials(reporterName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">
            Reported by{" "}
            {reporterEmail ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="cursor-default underline decoration-dotted underline-offset-2" />
                  }
                >
                  {reporterName}
                </TooltipTrigger>
                <TooltipContent>{reporterEmail}</TooltipContent>
              </Tooltip>
            ) : (
              reporterName
            )}
          </p>
          <p className="truncate text-muted-foreground text-xs">
            {formatReportedAt(data.createdAt)}
          </p>
        </div>
      </div>

      {/* Editable ticket info */}
      <div className="space-y-1 rounded-lg border p-3">
        <FieldRow label="ID">
          <span
            className="max-w-[200px] truncate font-mono text-muted-foreground text-xs"
            title={data.id}
          >
            {data.id}
          </span>
        </FieldRow>
        <FieldRow label="Type">
          <TypeControl
            category={data.category}
            disabled={ticket.pendingField === "category"}
            editable={data.canEdit}
            onChange={(category) => ticket.update("category", { category })}
          />
        </FieldRow>
        <FieldRow label="Assignee">
          <AssigneeControl
            assignee={data.assignee}
            assigneeId={data.assigneeId}
            disabled={ticket.pendingField === "assignee"}
            editable={data.canEdit}
            onChange={(assigneeId) => ticket.update("assignee", { assigneeId })}
          />
        </FieldRow>
        <FieldRow label="Priority">
          <PriorityControl
            disabled={ticket.pendingField === "priority"}
            editable={data.canTriage}
            onChange={(priority) => ticket.update("priority", { priority })}
            priority={data.priority}
          />
        </FieldRow>
      </div>

      {/* Session environment — collapsed by default */}
      <Collapsible
        className="rounded-lg border"
        onOpenChange={setSessionOpen}
        open={sessionOpen}
      >
        <CollapsibleTrigger
          render={
            <button
              className="flex w-full items-center justify-between p-3 font-medium text-sm"
              type="button"
            />
          }
        >
          <span className="flex items-center gap-2">
            <MonitorSmartphone aria-hidden className="size-4" />
            Session environment
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              sessionOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 border-t px-3 pt-3 pb-3">
          <EnvironmentRow label="URL" value={data.url} />
          <EnvironmentRow label="Browser" value={deviceInfo?.browser} />
          <EnvironmentRow label="OS" value={deviceInfo?.os} />
          <EnvironmentRow label="Viewport" value={deviceInfo?.viewport} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
