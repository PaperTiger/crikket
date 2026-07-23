import { cn } from "@crikket/ui/lib/utils"
import { Globe, Info, MousePointerClick, Terminal } from "lucide-react"
import type { ReactNode } from "react"

import { NetworkRequestsPanel } from "./network-requests-panel"
import { ReproductionStepsList } from "./reproduction-steps-list"
import { TicketDetailsTab } from "./ticket-details-tab"
import { TimelineList } from "./timeline-list"
import type {
  DebuggerAction,
  DebuggerNetworkRequest,
  DebuggerTimelineEntry,
  SharedBugReport,
} from "./types"

export type SidebarTab = "details" | "console" | "network" | "actions"

interface TimelineSidebarState {
  entries: DebuggerTimelineEntry[]
  selectedEntryId: string | null
  highlightedEntryIds: string[]
}

interface ActionsSidebarState extends TimelineSidebarState {
  actions: DebuggerAction[]
}

interface NetworkSidebarState extends TimelineSidebarState {
  requests: DebuggerNetworkRequest[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onLoadMore: () => void
}

interface BugReportSidebarProps {
  bugReportId: string
  data: SharedBugReport
  activeTab: SidebarTab
  tabAction?: ReactNode
  onTabChange: (tab: SidebarTab) => void
  onUpdated: () => Promise<unknown>
  timeline: {
    actions: ActionsSidebarState
    console: TimelineSidebarState
  }
  network: NetworkSidebarState
  onEntrySelect: (entry: DebuggerTimelineEntry) => void
}

export function BugReportSidebar({
  bugReportId,
  data,
  activeTab,
  tabAction,
  onTabChange,
  onUpdated,
  timeline,
  network,
  onEntrySelect,
}: BugReportSidebarProps) {
  // Console and network payloads can carry internal API responses and tokens,
  // so guests do not get these panels.
  const canViewDebugger = data.canViewDebugger

  return (
    <div className="z-20 flex h-full w-full flex-col bg-background shadow-xl md:relative md:top-0 md:border-l md:shadow-none">
      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b px-1 py-1">
        <TabButton
          active={activeTab === "details"}
          icon={<Info className="h-3.5 w-3.5" />}
          label="Details"
          onClick={() => onTabChange("details")}
        />
        <TabButton
          active={activeTab === "actions"}
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          label="Steps"
          onClick={() => onTabChange("actions")}
        />
        {canViewDebugger ? (
          <>
            <TabButton
              active={activeTab === "console"}
              icon={<Terminal className="h-3.5 w-3.5" />}
              label="Console"
              onClick={() => onTabChange("console")}
            />
            <TabButton
              active={activeTab === "network"}
              icon={<Globe className="h-3.5 w-3.5" />}
              label="Network"
              onClick={() => onTabChange("network")}
            />
          </>
        ) : null}
        {tabAction ? <div className="shrink-0">{tabAction}</div> : null}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "details" && (
          <TicketDetailsTab data={data} onUpdated={onUpdated} />
        )}

        {activeTab === "actions" && (
          <ReproductionStepsList
            actions={timeline.actions.actions}
            entries={timeline.actions.entries}
            highlightedIds={timeline.actions.highlightedEntryIds}
            onSelect={onEntrySelect}
            selectedId={timeline.actions.selectedEntryId}
          />
        )}

        {canViewDebugger && activeTab === "console" && (
          <TimelineList
            emptyMessage="No console logs captured."
            entries={timeline.console.entries}
            highlightedIds={timeline.console.highlightedEntryIds}
            icon={<Terminal className="h-3 w-3" />}
            onSelect={onEntrySelect}
            selectedId={timeline.console.selectedEntryId}
          />
        )}

        {canViewDebugger && activeTab === "network" && (
          <NetworkRequestsPanel
            bugReportId={bugReportId}
            entries={network.entries}
            hasNextPage={network.hasNextPage}
            highlightedEntryIds={network.highlightedEntryIds}
            isFetchingNextPage={network.isFetchingNextPage}
            isLoading={network.isLoading}
            onEntrySelect={onEntrySelect}
            onLoadMore={network.onLoadMore}
            requests={network.requests}
            selectedEntryId={network.selectedEntryId}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-[4px] py-1.5 font-medium text-xs transition-all",
        active
          ? "bg-muted text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}
