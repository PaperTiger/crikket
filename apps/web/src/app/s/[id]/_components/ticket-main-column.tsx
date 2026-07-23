"use client"

import { Link as LinkIcon } from "lucide-react"
import type { Route } from "next"
import type { RefObject } from "react"

import { BugReportBreadcrumbs } from "./bug-report-breadcrumbs"
import { BugReportCanvas } from "./bug-report-canvas"
import {
  StatusControl,
  TicketActionsMenu,
  useTicketUpdate,
} from "./ticket-controls"
import type { SharedBugReport } from "./types"

/**
 * The wireframe's main column: the attachment, then the status + actions row,
 * the title, the captured link, and the description — a scrollable document
 * rather than the old full-height canvas.
 */
export function TicketMainColumn({
  data,
  canvasRef,
  onTimeUpdate,
  onUpdated,
  onEditDetails,
  compactCanvas = false,
  showBreadcrumbs = true,
}: {
  data: SharedBugReport
  canvasRef: RefObject<HTMLVideoElement | null>
  onTimeUpdate: (currentTimeMs: number) => void
  onUpdated: () => Promise<unknown>
  onEditDetails?: () => void
  compactCanvas?: boolean
  showBreadcrumbs?: boolean
}) {
  const ticket = useTicketUpdate(data.id, onUpdated)

  return (
    <div className="flex h-full flex-col">
      {showBreadcrumbs ? <BugReportBreadcrumbs data={data} /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
          <div className="overflow-hidden rounded-lg border bg-muted/20">
            <BugReportCanvas
              compact={compactCanvas}
              data={data}
              onTimeUpdate={onTimeUpdate}
              ref={canvasRef}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <StatusControl
              disabled={ticket.pendingField === "status"}
              editable={data.canTriage}
              onChange={(status) => ticket.update("status", { status })}
              status={data.status}
            />
            <TicketActionsMenu
              canDelete={data.canDelete}
              id={data.id}
              onEditDetails={onEditDetails}
              redirectTo={"/" as Route}
            />
          </div>

          <h1 className="font-semibold text-2xl leading-tight tracking-tight">
            {data.title || "Untitled ticket"}
          </h1>

          {data.url ? (
            <a
              className="inline-flex max-w-full items-center gap-1.5 break-all text-primary text-sm hover:underline"
              href={data.url}
              rel="noreferrer"
              target="_blank"
            >
              <LinkIcon aria-hidden className="size-3.5 shrink-0" />
              {data.url}
            </a>
          ) : null}

          <div className="space-y-2 pt-2">
            <h2 className="font-semibold text-lg">Description</h2>
            <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
              {data.description || "No description provided."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
