import { buildPaginationMeta } from "@crikket/shared/lib/server/pagination"
import { ORPCError } from "@orpc/server"

import {
  countBugReportNetworkRequests,
  getBugReportDebuggerEventsData,
  getBugReportNetworkRequestPayload as getBugReportNetworkRequestPayloadData,
  getBugReportNetworkRequestsPage,
} from "../lib/debugger"
import {
  assertBugReportAccessById,
  bugReportIdInputSchema,
  canViewDebugger,
  debuggerNetworkRequestPayloadInputSchema,
  debuggerNetworkRequestsInputSchema,
  normalizeDebuggerNetworkRequestPagination,
} from "../lib/utils"
import { o } from "./context"

export const getBugReportDebuggerEvents = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    // Not gated on debugger access: this call also powers the "Steps" tab,
    // which guests keep. The console logs in the same payload are what they
    // must not see, so those are stripped below.
    const { access } = await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const events = await getBugReportDebuggerEventsData(input.id)

    if (canViewDebugger(access)) {
      return events
    }

    return { ...events, logs: [] }
  })

export const getBugReportNetworkRequests = o
  .input(debuggerNetworkRequestsInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
      requireDebuggerAccess: true,
    })

    const { page, perPage, offset, limit } =
      normalizeDebuggerNetworkRequestPagination({
        page: input.page,
        perPage: input.perPage,
      })

    const [totalCount, items] = await Promise.all([
      countBugReportNetworkRequests({
        bugReportId: input.id,
        search: input.search,
      }),
      getBugReportNetworkRequestsPage({
        bugReportId: input.id,
        limit,
        offset,
        search: input.search,
      }),
    ])

    return {
      items,
      pagination: buildPaginationMeta(totalCount, page, perPage),
    }
  })

export const getBugReportNetworkRequestPayload = o
  .input(debuggerNetworkRequestPayloadInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
      requireDebuggerAccess: true,
    })

    const payload = await getBugReportNetworkRequestPayloadData({
      bugReportId: input.id,
      requestId: input.requestId,
    })

    if (!payload) {
      throw new ORPCError("NOT_FOUND", { message: "Network request not found" })
    }

    return payload
  })
