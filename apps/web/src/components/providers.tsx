"use client"

import { ThemeProvider } from "@crikket/ui/components/theme-provider"
import { Toaster } from "@crikket/ui/components/ui/sonner"
import { TooltipProvider } from "@crikket/ui/components/ui/tooltip"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { queryClient } from "@/utils/orpc"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        <QueryClientProvider client={queryClient}>
          {/* Delay so tooltips only appear once you settle on an element.
              timeout={0} disables base-ui's grouping, so every tooltip waits
              the full delay each time instead of the next one opening instantly
              as the cursor moves between adjacent triggers. */}
          <TooltipProvider delay={600} timeout={0}>
            {children}
            <ReactQueryDevtools />
          </TooltipProvider>
        </QueryClientProvider>
        <Toaster richColors />
      </ThemeProvider>
    </NuqsAdapter>
  )
}
