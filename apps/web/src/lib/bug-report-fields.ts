import {
  BUG_REPORT_CATEGORY_OPTIONS,
  BUG_REPORT_STATUS_OPTIONS,
  type BugReportCategory,
  type BugReportStatus,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import {
  Bug,
  ChevronsDown,
  ChevronsUp,
  CircleAlert,
  CircleDashed,
  CircleHelp,
  Equal,
  FileText,
  type LucideIcon,
  Sparkles,
} from "lucide-react"

export interface FieldOption<T extends string> {
  value: T
  label: string
  icon: LucideIcon
  /** Tailwind text color class for the icon, when the field is color-coded. */
  colorClassName?: string
}

// Type — maps to the DB `category` column (feature/bug/content/question).
export const CATEGORY_FIELD_OPTIONS: FieldOption<BugReportCategory>[] = [
  {
    value: BUG_REPORT_CATEGORY_OPTIONS.feature,
    label: "Feature",
    icon: Sparkles,
  },
  { value: BUG_REPORT_CATEGORY_OPTIONS.bug, label: "Bug", icon: Bug },
  {
    value: BUG_REPORT_CATEGORY_OPTIONS.content,
    label: "Content",
    icon: FileText,
  },
  {
    value: BUG_REPORT_CATEGORY_OPTIONS.question,
    label: "Question",
    icon: CircleHelp,
  },
]

// Priority labels match the dashboard (Critical, not the wireframe's "Urgent")
// so the same value never reads differently across the app.
export const PRIORITY_FIELD_OPTIONS: FieldOption<Priority>[] = [
  {
    value: PRIORITY_OPTIONS.critical,
    label: "Critical",
    icon: CircleAlert,
    colorClassName: "text-red-500",
  },
  {
    value: PRIORITY_OPTIONS.high,
    label: "High",
    icon: ChevronsUp,
    colorClassName: "text-orange-500",
  },
  {
    value: PRIORITY_OPTIONS.medium,
    label: "Medium",
    icon: Equal,
    colorClassName: "text-yellow-500",
  },
  {
    value: PRIORITY_OPTIONS.low,
    label: "Low",
    icon: ChevronsDown,
    colorClassName: "text-blue-400",
  },
  {
    value: PRIORITY_OPTIONS.none,
    label: "None",
    icon: CircleDashed,
    colorClassName: "text-muted-foreground",
  },
]

export const STATUS_FIELD_OPTIONS: Array<{
  value: BugReportStatus
  label: string
}> = [
  { value: BUG_REPORT_STATUS_OPTIONS.toDo, label: "To do" },
  { value: BUG_REPORT_STATUS_OPTIONS.inProgress, label: "In progress" },
  { value: BUG_REPORT_STATUS_OPTIONS.clientReview, label: "Client review" },
  { value: BUG_REPORT_STATUS_OPTIONS.blocked, label: "Blocked" },
  { value: BUG_REPORT_STATUS_OPTIONS.done, label: "Done" },
  { value: BUG_REPORT_STATUS_OPTIONS.closed, label: "Closed" },
]

export function formatStatusLabel(value: BugReportStatus): string {
  return (
    STATUS_FIELD_OPTIONS.find((option) => option.value === value)?.label ??
    value
  )
}

export function formatPriorityLabel(value: Priority): string {
  return (
    PRIORITY_FIELD_OPTIONS.find((option) => option.value === value)?.label ??
    value
  )
}

export function formatCategoryLabel(value: BugReportCategory | null): string {
  if (!value) {
    return "Untyped"
  }
  return (
    CATEGORY_FIELD_OPTIONS.find((option) => option.value === value)?.label ??
    value
  )
}
