"use client"

import {
  BUG_REPORT_STATUS_OPTIONS,
  type BugReportStatus,
} from "@crikket/shared/constants/bug-report"
import { badgeVariants } from "@crikket/ui/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { cn } from "@crikket/ui/lib/utils"
import { ChevronDown } from "lucide-react"

import { formatStatusLabel, STATUS_OPTIONS } from "./filters"

// Per-status accent color. Text/dot use the solid color; the pill background is
// the same color at 15% opacity (hex alpha `26`) with a softer border (`59`).
// `closed` is intentionally left neutral (uses the outline badge default).
const STATUS_COLORS: Partial<Record<BugReportStatus, string>> = {
  [BUG_REPORT_STATUS_OPTIONS.toDo]: "#9589d3",
  [BUG_REPORT_STATUS_OPTIONS.inProgress]: "#56a1d2",
  [BUG_REPORT_STATUS_OPTIONS.clientReview]: "#e6c15c",
  [BUG_REPORT_STATUS_OPTIONS.blocked]: "#fa435b",
  [BUG_REPORT_STATUS_OPTIONS.done]: "#6dc9bc",
}

/**
 * The status shown as an editable pill: reads as a badge but opens a dropdown
 * to change the report's status inline. Lives inside click-to-open rows/cards,
 * so the trigger swallows the click that would otherwise navigate.
 */
export function StatusPill({
  status,
  disabled = false,
  onChange,
}: {
  status: BugReportStatus
  disabled?: boolean
  onChange: (status: BugReportStatus) => void
}) {
  const color = STATUS_COLORS[status]
  // Inline styles win over the badge classes, so a colored pill keeps its tint
  // (including on hover); neutral statuses fall back to the muted outline look.
  const colorStyle = color
    ? { color, backgroundColor: `${color}26`, borderColor: `${color}59` }
    : undefined

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        // A native <button> styled as an outline badge: keeps real button
        // semantics/keyboard handling while reading as a status pill.
        render={
          <button
            className={cn(
              badgeVariants({ variant: "outline" }),
              "cursor-pointer gap-1.5 disabled:cursor-default disabled:opacity-60",
              color ? "" : "text-muted-foreground hover:bg-muted"
            )}
            style={colorStyle}
            type="button"
          />
        }
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {formatStatusLabel(status)}
        <ChevronDown aria-hidden className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value !== status) {
              onChange(value as BugReportStatus)
            }
          }}
          value={status}
        >
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
