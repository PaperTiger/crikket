import {
  BUG_REPORT_CATEGORY_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import type { CaptureSubmissionDraft } from "../../../types"

const priorityValues = new Set<string>(Object.values(PRIORITY_OPTIONS))
const categoryValues = new Set<string>(
  Object.values(BUG_REPORT_CATEGORY_OPTIONS)
)
const visibilityValues = new Set<string>(
  Object.values(BUG_REPORT_VISIBILITY_OPTIONS)
)
export type ReviewDraftErrors = Partial<
  Record<keyof CaptureSubmissionDraft, string>
>

export const captureCategoryOptions = [
  { label: "Feature", value: BUG_REPORT_CATEGORY_OPTIONS.feature },
  { label: "Bug", value: BUG_REPORT_CATEGORY_OPTIONS.bug },
  { label: "Content", value: BUG_REPORT_CATEGORY_OPTIONS.content },
  { label: "Question", value: BUG_REPORT_CATEGORY_OPTIONS.question },
] as const

export const capturePriorityOptions = [
  { label: "Critical", value: PRIORITY_OPTIONS.critical },
  { label: "High", value: PRIORITY_OPTIONS.high },
  { label: "Medium", value: PRIORITY_OPTIONS.medium },
  { label: "Low", value: PRIORITY_OPTIONS.low },
  { label: "None", value: PRIORITY_OPTIONS.none },
] as const

export function validateReviewDraft(
  value: CaptureSubmissionDraft
): ReviewDraftErrors | undefined {
  const errors: ReviewDraftErrors = {}

  if (value.title.length > 200) {
    errors.title = "Title must be at most 200 characters."
  }

  if (value.description.trim().length === 0) {
    errors.description = "Please describe the issue."
  } else if (value.description.length > 3000) {
    errors.description = "Description must be at most 3000 characters."
  }

  if (!categoryValues.has(value.category)) {
    errors.category = "Select a valid category."
  }

  if (!priorityValues.has(value.priority)) {
    errors.priority = "Select a valid priority."
  }

  if (
    value.visibility !== undefined &&
    !visibilityValues.has(value.visibility)
  ) {
    errors.visibility = "Select a valid visibility."
  }

  return Object.keys(errors).length > 0 ? errors : undefined
}

export function trimReviewDraftForSubmission(
  draft: CaptureSubmissionDraft
): CaptureSubmissionDraft {
  return {
    category: draft.category,
    description: draft.description.trim(),
    priority: draft.priority,
    title: draft.title.trim(),
    visibility: visibilityValues.has(draft.visibility ?? "")
      ? (draft.visibility as BugReportVisibility)
      : BUG_REPORT_VISIBILITY_OPTIONS.private,
  }
}

export type CapturePriority = Priority
