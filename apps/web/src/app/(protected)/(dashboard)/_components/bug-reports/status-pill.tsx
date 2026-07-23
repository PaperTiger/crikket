"use client"

import type { BugReportStatus } from "@crikket/shared/constants/bug-report"
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
              "cursor-pointer gap-1.5 hover:bg-muted disabled:cursor-default disabled:opacity-60"
            )}
            type="button"
          />
        }
      >
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-muted-foreground"
        />
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
