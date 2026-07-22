export const BUG_REPORT_STATUS_OPTIONS = {
  toDo: "to_do",
  inProgress: "in_progress",
  clientReview: "client_review",
  blocked: "blocked",
  done: "done",
  closed: "closed",
} as const

export type BugReportStatus =
  (typeof BUG_REPORT_STATUS_OPTIONS)[keyof typeof BUG_REPORT_STATUS_OPTIONS]

export const BUG_REPORT_VISIBILITY_OPTIONS = {
  public: "public",
  private: "private",
} as const

export type BugReportVisibility =
  (typeof BUG_REPORT_VISIBILITY_OPTIONS)[keyof typeof BUG_REPORT_VISIBILITY_OPTIONS]

export const BUG_REPORT_SUBMISSION_STATUS_OPTIONS = {
  processing: "processing",
  ready: "ready",
  failed: "failed",
} as const

export type BugReportSubmissionStatus =
  (typeof BUG_REPORT_SUBMISSION_STATUS_OPTIONS)[keyof typeof BUG_REPORT_SUBMISSION_STATUS_OPTIONS]

export const BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS = {
  notUploaded: "not_uploaded",
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
} as const

export type BugReportDebuggerIngestionStatus =
  (typeof BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS)[keyof typeof BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS]

export const BUG_REPORT_SORT_OPTIONS = {
  newest: "newest",
  oldest: "oldest",
  updated: "updated",
  priorityHigh: "priority_high",
  priorityLow: "priority_low",
} as const

export type BugReportSort =
  (typeof BUG_REPORT_SORT_OPTIONS)[keyof typeof BUG_REPORT_SORT_OPTIONS]
