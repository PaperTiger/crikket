/**
 * Fields a guest is allowed to change on a bug report.
 *
 * Triage only: guests follow along on their projects and move work through the
 * board. Title, tags, assignee and visibility stay with the organization.
 */
export const GUEST_WRITABLE_FIELDS = ["status", "priority"] as const

/** Identifiers, not writes — present on every update payload. */
const UPDATE_TARGET_FIELDS = new Set(["id", "ids"])

/**
 * Which fields of an update payload a guest may not set.
 *
 * Only fields actually present with a value count: an update carrying
 * `visibility: undefined` is not an attempt to change visibility.
 */
export function findForbiddenGuestFields(
  input: Record<string, unknown>
): string[] {
  const writable = new Set<string>(GUEST_WRITABLE_FIELDS)

  return Object.keys(input).filter(
    (field) =>
      !UPDATE_TARGET_FIELDS.has(field) &&
      input[field] !== undefined &&
      !writable.has(field)
  )
}
