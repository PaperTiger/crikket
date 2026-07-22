"use client"

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
import { useDebounce } from "@crikket/ui/hooks/use-debounce"
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useEffect, useMemo, useState } from "react"

import type {
  BugReportGroupBy,
  DashboardFilters,
  DashboardView,
} from "../_components/bug-reports/filters"
import {
  GROUP_BY_OPTIONS,
  VIEW_OPTIONS,
} from "../_components/bug-reports/filters"
import { toggleValue } from "../_components/bug-reports/utils"

const STATUS_VALUES = [
  BUG_REPORT_STATUS_OPTIONS.toDo,
  BUG_REPORT_STATUS_OPTIONS.inProgress,
  BUG_REPORT_STATUS_OPTIONS.clientReview,
  BUG_REPORT_STATUS_OPTIONS.blocked,
  BUG_REPORT_STATUS_OPTIONS.done,
  BUG_REPORT_STATUS_OPTIONS.closed,
] as const satisfies readonly BugReportStatus[]

const PRIORITY_VALUES = [
  PRIORITY_OPTIONS.critical,
  PRIORITY_OPTIONS.high,
  PRIORITY_OPTIONS.medium,
  PRIORITY_OPTIONS.low,
  PRIORITY_OPTIONS.none,
] as const satisfies readonly Priority[]

const VISIBILITY_VALUES = [
  BUG_REPORT_VISIBILITY_OPTIONS.private,
  BUG_REPORT_VISIBILITY_OPTIONS.public,
] as const satisfies readonly BugReportVisibility[]

const SORT_VALUES = [
  BUG_REPORT_SORT_OPTIONS.newest,
  BUG_REPORT_SORT_OPTIONS.oldest,
  BUG_REPORT_SORT_OPTIONS.updated,
  BUG_REPORT_SORT_OPTIONS.priorityHigh,
  BUG_REPORT_SORT_OPTIONS.priorityLow,
] as const satisfies readonly BugReportSort[]

const VIEW_VALUES = [
  VIEW_OPTIONS.table,
  VIEW_OPTIONS.grid,
] as const satisfies readonly DashboardView[]

const GROUP_BY_VALUES = [
  GROUP_BY_OPTIONS.project,
  GROUP_BY_OPTIONS.assignee,
  GROUP_BY_OPTIONS.page,
] as const satisfies readonly BugReportGroupBy[]

const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  statuses: [],
  priorities: [],
  visibilities: [],
  drillDown: {},
}

const CLEARED_DRILL_DOWN: {
  capturePublicKeyId: string | null
  assigneeId: string | null
  pageUrl: string | null
} = {
  capturePublicKeyId: null,
  assigneeId: null,
  pageUrl: null,
}

export function useBugReportsFilters() {
  const [
    {
      view,
      group,
      includeClosed,
      search,
      sort,
      statuses,
      priorities,
      visibilities,
      capturePublicKeyId,
      assigneeId,
      pageUrl,
    },
    setFilterSearchQuery,
  ] = useQueryStates(
    {
      view: parseAsStringLiteral(VIEW_VALUES)
        .withOptions({ clearOnDefault: true })
        .withDefault(VIEW_OPTIONS.table),
      group: parseAsStringLiteral(GROUP_BY_VALUES)
        .withOptions({ clearOnDefault: true })
        .withDefault(GROUP_BY_OPTIONS.project),
      includeClosed: parseAsBoolean
        .withOptions({ clearOnDefault: true })
        .withDefault(false),
      search: parseAsString
        .withOptions({ clearOnDefault: true })
        .withDefault(""),
      sort: parseAsStringLiteral(SORT_VALUES)
        .withOptions({ clearOnDefault: true })
        .withDefault(BUG_REPORT_SORT_OPTIONS.newest),
      statuses: parseAsArrayOf(parseAsStringLiteral(STATUS_VALUES))
        .withOptions({ clearOnDefault: true })
        .withDefault([]),
      priorities: parseAsArrayOf(parseAsStringLiteral(PRIORITY_VALUES))
        .withOptions({ clearOnDefault: true })
        .withDefault([]),
      visibilities: parseAsArrayOf(parseAsStringLiteral(VISIBILITY_VALUES))
        .withOptions({ clearOnDefault: true })
        .withDefault([]),
      capturePublicKeyId: parseAsString.withOptions({ clearOnDefault: true }),
      assigneeId: parseAsString.withOptions({ clearOnDefault: true }),
      pageUrl: parseAsString.withOptions({ clearOnDefault: true }),
    },
    {
      history: "replace",
      shallow: false,
    }
  )
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounce(searchInput)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    if (debouncedSearch === search) {
      return
    }

    setFilterSearchQuery({ search: debouncedSearch }).catch(() => undefined)
  }, [debouncedSearch, search, setFilterSearchQuery])

  const drillDown = useMemo(
    () => ({
      capturePublicKeyId: capturePublicKeyId ?? undefined,
      assigneeId: assigneeId ?? undefined,
      pageUrl: pageUrl ?? undefined,
    }),
    [capturePublicKeyId, assigneeId, pageUrl]
  )

  const hasDrillDown = Boolean(
    drillDown.capturePublicKeyId || drillDown.assigneeId || drillDown.pageUrl
  )

  const filters = useMemo<DashboardFilters>(
    () => ({ statuses, priorities, visibilities, drillDown }),
    [statuses, priorities, visibilities, drillDown]
  )

  const hasFilters = useMemo(
    () =>
      filters.statuses.length > 0 ||
      filters.priorities.length > 0 ||
      filters.visibilities.length > 0 ||
      hasDrillDown,
    [filters, hasDrillDown]
  )

  return {
    view,
    setView: (value: DashboardView) => {
      setFilterSearchQuery({ view: value }).catch(() => undefined)
    },
    group,
    setGroup: (value: BugReportGroupBy) => {
      setFilterSearchQuery({ group: value }).catch(() => undefined)
    },
    includeClosed,
    setIncludeClosed: (value: boolean) => {
      setFilterSearchQuery({ includeClosed: value }).catch(() => undefined)
    },
    drillDown,
    hasDrillDown,
    drillDownInto: (groupBy: BugReportGroupBy, groupKey: string) => {
      const next = { ...CLEARED_DRILL_DOWN }
      if (groupBy === GROUP_BY_OPTIONS.assignee) {
        next.assigneeId = groupKey
      } else if (groupBy === GROUP_BY_OPTIONS.page) {
        next.pageUrl = groupKey
      } else {
        next.capturePublicKeyId = groupKey
      }

      setFilterSearchQuery({ ...next, view: VIEW_OPTIONS.grid }).catch(
        () => undefined
      )
    },
    clearDrillDown: () => {
      setFilterSearchQuery({ ...CLEARED_DRILL_DOWN }).catch(() => undefined)
    },
    searchValue: searchInput,
    setSearchValue: setSearchInput,
    debouncedSearch,
    sort,
    setSort: (value: BugReportSort) => {
      setFilterSearchQuery({ sort: value }).catch(() => undefined)
    },
    filters,
    clearFilters: () => {
      setFilterSearchQuery({
        statuses: EMPTY_DASHBOARD_FILTERS.statuses,
        priorities: EMPTY_DASHBOARD_FILTERS.priorities,
        visibilities: EMPTY_DASHBOARD_FILTERS.visibilities,
        ...CLEARED_DRILL_DOWN,
      }).catch(() => undefined)
    },
    resetFiltersAndSearch: () => {
      setSearchInput("")
      setFilterSearchQuery({
        search: "",
        statuses: EMPTY_DASHBOARD_FILTERS.statuses,
        priorities: EMPTY_DASHBOARD_FILTERS.priorities,
        visibilities: EMPTY_DASHBOARD_FILTERS.visibilities,
        ...CLEARED_DRILL_DOWN,
      }).catch(() => undefined)
    },
    hasActiveFilters: hasFilters || debouncedSearch.length > 0,
    toggleStatus: (value: DashboardFilters["statuses"][number]) =>
      setFilterSearchQuery({
        statuses: toggleValue(filters.statuses, value),
      }).catch(() => undefined),
    togglePriority: (value: DashboardFilters["priorities"][number]) =>
      setFilterSearchQuery({
        priorities: toggleValue(filters.priorities, value),
      }).catch(() => undefined),
    toggleVisibility: (value: DashboardFilters["visibilities"][number]) =>
      setFilterSearchQuery({
        visibilities: toggleValue(filters.visibilities, value),
      }).catch(() => undefined),
  }
}
