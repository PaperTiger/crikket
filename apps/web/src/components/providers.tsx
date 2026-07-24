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
          {/* Delay so tooltips only appear once you settle on an element,
              rather than flashing as the cursor passes over. */}
          <TooltipProvider delay={600}>
            {children}
            <ReactQueryDevtools />
          </TooltipProvider>
        </QueryClientProvider>
        <Toaster richColors />
      </ThemeProvider>
    </NuqsAdapter>
  )
}
