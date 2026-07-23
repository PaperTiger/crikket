import { describe, expect, it } from "bun:test"
import { findForbiddenGuestFields } from "../src/lib/guest-write-policy"
import {
  buildProjectScopeFilter,
  buildTeamMemberProjectFilter,
} from "../src/lib/project-scope"

describe("findForbiddenGuestFields", () => {
  it("allows a status change", () => {
    expect(findForbiddenGuestFields({ id: "r1", status: "done" })).toBeEmpty()
  })

  it("allows a priority change", () => {
    expect(findForbiddenGuestFields({ id: "r1", priority: "high" })).toBeEmpty()
  })

  it("allows status and priority together on a bulk update", () => {
    expect(
      findForbiddenGuestFields({
        ids: ["r1", "r2"],
        status: "done",
        priority: "low",
      })
    ).toBeEmpty()
  })

  it("rejects a visibility change", () => {
    expect(
      findForbiddenGuestFields({ id: "r1", visibility: "public" })
    ).toEqual(["visibility"])
  })

  it("rejects reassignment", () => {
    expect(findForbiddenGuestFields({ id: "r1", assigneeId: "p1" })).toEqual([
      "assigneeId",
    ])
  })

  it("rejects clearing the assignee, which is a null and not an absence", () => {
    expect(findForbiddenGuestFields({ id: "r1", assigneeId: null })).toEqual([
      "assigneeId",
    ])
  })

  it("reports every forbidden field, not just the first", () => {
    expect(
      findForbiddenGuestFields({
        id: "r1",
        status: "done",
        title: "new title",
        tags: ["a"],
      })
    ).toEqual(["title", "tags"])
  })

  it("ignores fields that are merely absent", () => {
    expect(
      findForbiddenGuestFields({
        id: "r1",
        status: "done",
        visibility: undefined,
        assigneeId: undefined,
      })
    ).toBeEmpty()
  })
})

describe("buildProjectScopeFilter", () => {
  it("matches nothing when the guest holds no grants", () => {
    // The dangerous failure mode is an empty grant list yielding an *open*
    // filter, which would hand a guest the entire organization. The populated
    // branch builds a subquery off the live `db` and so belongs in the manual
    // end-to-end pass, not here.
    const filter = buildProjectScopeFilter([])
    const rendered = JSON.stringify(filter.queryChunks)

    expect(rendered).toContain("false")
    expect(rendered).not.toContain("capture_public_key")
  })
})

describe("buildTeamMemberProjectFilter", () => {
  it("applies no filter when nobody is selected", () => {
    // Deliberately the INVERSE of buildProjectScopeFilter above. That one is a
    // security boundary where empty must match nothing; this one is a dashboard
    // filter where empty must mean "show everything". Getting these two the
    // wrong way round would either hide all of an org member's reports or hand
    // a guest the whole organization.
    // The populated branch builds a subquery off the live `db` and so belongs
    // in the end-to-end pass, not here.
    expect(buildTeamMemberProjectFilter([])).toBeNull()
  })
})
