import {
  BUG_REPORT_SORT_OPTIONS,
  BUG_REPORT_STATUS_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportSort,
  type BugReportStatus,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"

export const STATUS_OPTIONS: Array<{ value: BugReportStatus; label: string }> =
  [
    { value: BUG_REPORT_STATUS_OPTIONS.toDo, label: "To do" },
    { value: BUG_REPORT_STATUS_OPTIONS.inProgress, label: "In progress" },
    { value: BUG_REPORT_STATUS_OPTIONS.clientReview, label: "Client review" },
    { value: BUG_REPORT_STATUS_OPTIONS.blocked, label: "Blocked" },
    { value: BUG_REPORT_STATUS_OPTIONS.done, label: "Done" },
    { value: BUG_REPORT_STATUS_OPTIONS.closed, label: "Closed" },
  ]

export const PRIORITY_FILTER_OPTIONS: Array<{
  value: Priority
  label: string
}> = [
  { value: PRIORITY_OPTIONS.critical, label: "Critical" },
  { value: PRIORITY_OPTIONS.high, label: "High" },
  { value: PRIORITY_OPTIONS.medium, label: "Medium" },
  { value: PRIORITY_OPTIONS.low, label: "Low" },
  { value: PRIORITY_OPTIONS.none, label: "None" },
]

export const VISIBILITY_OPTIONS: Array<{
  value: BugReportVisibility
  label: string
}> = [
  { value: BUG_REPORT_VISIBILITY_OPTIONS.private, label: "Private" },
  { value: BUG_REPORT_VISIBILITY_OPTIONS.public, label: "Public" },
]

export const SORT_OPTIONS: Array<{ value: BugReportSort; label: string }> = [
  { value: BUG_REPORT_SORT_OPTIONS.newest, label: "Newest" },
  { value: BUG_REPORT_SORT_OPTIONS.oldest, label: "Oldest" },
  { value: BUG_REPORT_SORT_OPTIONS.updated, label: "Recently Updated" },
  {
    value: BUG_REPORT_SORT_OPTIONS.priorityHigh,
    label: "Priority: High to Low",
  },
  {
    value: BUG_REPORT_SORT_OPTIONS.priorityLow,
    label: "Priority: Low to High",
  },
]

export const VIEW_OPTIONS = {
  table: "table",
  grid: "grid",
} as const

export type DashboardView = (typeof VIEW_OPTIONS)[keyof typeof VIEW_OPTIONS]

export const GROUP_BY_OPTIONS = {
  project: "project",
  assignee: "assignee",
  page: "page",
} as const

export type BugReportGroupBy =
  (typeof GROUP_BY_OPTIONS)[keyof typeof GROUP_BY_OPTIONS]

export const GROUP_BY_SELECT_OPTIONS: Array<{
  value: BugReportGroupBy
  label: string
}> = [
  { value: GROUP_BY_OPTIONS.project, label: "Project" },
  { value: GROUP_BY_OPTIONS.assignee, label: "Assignee" },
  { value: GROUP_BY_OPTIONS.page, label: "Page" },
]

/** Header label for the group-label column, driven by the active group-by. */
export function formatGroupColumnHeader(groupBy: BugReportGroupBy): string {
  switch (groupBy) {
    case GROUP_BY_OPTIONS.assignee:
      return "Person"
    case GROUP_BY_OPTIONS.page:
      return "Page"
    default:
      return "Project"
  }
}

/** Drill-down filters set when a group row is clicked in the table view. */
export interface DashboardDrillDown {
  projectId?: string
  assigneeId?: string
  pageUrl?: string
}

export interface DashboardFilters {
  statuses: BugReportStatus[]
  priorities: Priority[]
  visibilities: BugReportVisibility[]
  drillDown: DashboardDrillDown
}

export const EMPTY_FILTERS: DashboardFilters = {
  statuses: [],
  priorities: [],
  visibilities: [],
  drillDown: {},
}

export function formatStatusLabel(status: BugReportStatus): string {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
  )
}

export function formatPriorityLabel(priority: Priority): string {
  return (
    PRIORITY_FILTER_OPTIONS.find((option) => option.value === priority)
      ?.label ?? priority
  )
}

export function formatVisibilityLabel(visibility: BugReportVisibility): string {
  return (
    VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ??
    visibility
  )
}
