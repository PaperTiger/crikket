"use client"

import { Link as LinkIcon } from "lucide-react"
import type { Route } from "next"
import type { RefObject } from "react"

import { BugReportCanvas } from "./bug-report-canvas"
import {
  StatusControl,
  TicketActionsMenu,
  useTicketUpdate,
} from "./ticket-controls"
import type { SharedBugReport } from "./types"
import { stripReporterLine } from "./utils"

/**
 * The wireframe's main column: the attachment (capped in height, click to open
 * larger), then a title row carrying the status pill and actions, the captured
 * link, and the description — a scrollable document.
 */
export function TicketMainColumn({
  data,
  canvasRef,
  onTimeUpdate,
  onUpdated,
  onEditDetails,
  compactCanvas = true,
}: {
  data: SharedBugReport
  canvasRef: RefObject<HTMLVideoElement | null>
  onTimeUpdate: (currentTimeMs: number) => void
  onUpdated: () => Promise<unknown>
  onEditDetails?: () => void
  compactCanvas?: boolean
}) {
  const ticket = useTicketUpdate(data.id, onUpdated)
  const description = stripReporterLine(data.description)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
        {/* Attachment capped at 350px tall; zoom/fullscreen to see more. */}
        <div className="flex max-h-[350px] justify-center overflow-hidden rounded-lg border bg-muted/20 [&_img]:max-h-[350px] [&_img]:w-auto [&_video]:max-h-[350px] [&_video]:w-auto">
          <BugReportCanvas
            compact={compactCanvas}
            data={data}
            onTimeUpdate={onTimeUpdate}
            ref={canvasRef}
          />
        </div>

        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 font-semibold text-2xl leading-tight tracking-tight">
            {data.title || "Untitled ticket"}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <StatusControl
              disabled={ticket.pendingField === "status"}
              editable={data.canTriage}
              onChange={(status) => ticket.update("status", { status })}
              size="lg"
              status={data.status}
            />
            <TicketActionsMenu
              canDelete={data.canDelete}
              id={data.id}
              onEditDetails={onEditDetails}
              redirectTo={"/" as Route}
            />
          </div>
        </div>

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
            {description || "No description provided."}
          </p>
        </div>
      </div>
    </div>
  )
}
