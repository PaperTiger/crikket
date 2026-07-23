import {
  BUG_REPORT_STATUS_OPTIONS,
  type BugReportStatus,
} from "@crikket/shared/constants/bug-report"

// Per-status accent color, shared by every place that renders a status badge
// (dashboard pills, the ticket detail header, ...). Text/dot use the solid
// color; backgrounds use the same color at 15% opacity (hex alpha `26`) with a
// softer 35% border (`59`). `closed` has no color and falls back to the neutral
// badge styling at each call site.
const STATUS_COLORS: Partial<Record<BugReportStatus, string>> = {
  [BUG_REPORT_STATUS_OPTIONS.toDo]: "#9589d3",
  [BUG_REPORT_STATUS_OPTIONS.inProgress]: "#56a1d2",
  [BUG_REPORT_STATUS_OPTIONS.clientReview]: "#e6c15c",
  [BUG_REPORT_STATUS_OPTIONS.blocked]: "#fa435b",
  [BUG_REPORT_STATUS_OPTIONS.done]: "#6dc9bc",
}

export interface StatusColorStyle {
  color: string
  backgroundColor: string
  borderColor: string
}

/**
 * Inline style for a status badge, or `undefined` when the status has no accent
 * color (leave the neutral badge styling in place). Inline styles win over
 * badge classes, so a colored badge keeps its tint including on hover.
 */
export function statusColorStyle(
  status: BugReportStatus
): StatusColorStyle | undefined {
  const color = STATUS_COLORS[status]
  return color
    ? { color, backgroundColor: `${color}26`, borderColor: `${color}59` }
    : undefined
}
