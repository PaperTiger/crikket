import { Button } from "@crikket/ui/components/ui/button"
import { Separator } from "@crikket/ui/components/ui/separator"
import { Home } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { PaperTigerWordmark } from "@/components/paper-tiger-wordmark"
import type { SharedBugReport } from "./types"

interface BugReportHeaderProps {
  data: SharedBugReport
}

export function BugReportHeader({
  data,
  sidebarTrigger,
}: BugReportHeaderProps & { sidebarTrigger?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="md:hidden">{sidebarTrigger}</div>
        <Link
          aria-label="Paper Tiger — back to dashboard"
          className="shrink-0 text-foreground transition-opacity hover:opacity-70"
          href="/"
        >
          <PaperTigerWordmark className="h-4 w-auto" />
        </Link>
        <Separator className="h-5 shrink-0" orientation="vertical" />
        <h1
          className="truncate font-medium text-sm"
          title={data.title ?? "Untitled"}
        >
          {data.title ?? "Untitled Bug Report"}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-muted-foreground text-xs sm:inline-block">
          {new Date(data.createdAt).toLocaleString()}
        </span>
        <Separator className="hidden sm:block" orientation="vertical" />
        <Button
          nativeButton={false}
          render={
            <Link href="/">
              <Home />
              <span className="sr-only">Dashboard</span>
            </Link>
          }
          size="sm"
          variant="ghost"
        />
      </div>
    </header>
  )
}
