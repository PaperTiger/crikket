"use client"

import { Button } from "@crikket/ui/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@crikket/ui/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@crikket/ui/components/ui/popover"
import { useDebounce } from "@crikket/ui/hooks/use-debounce"
import { cn } from "@crikket/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown } from "lucide-react"
import * as React from "react"

import { orpc } from "@/utils/orpc"

interface ProjectComboboxProps {
  value: string | null
  selectedName: string | null
  onChange: (projectId: string | null, projectName: string | null) => void
  disabled?: boolean
}

export function ProjectCombobox({
  value,
  selectedName,
  onChange,
  disabled,
}: ProjectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const debouncedQuery = useDebounce(query)

  const projectsQuery = useQuery(
    orpc.project.search.queryOptions({
      input: { query: debouncedQuery || undefined, limit: 25 },
      enabled: open,
    })
  )
  const projects = projectsQuery.data ?? []

  const buttonLabel = value
    ? (selectedName ?? "Selected project")
    : "No project"

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
            type="button"
            variant="outline"
          >
            <span
              className={cn("truncate", value ? "" : "text-muted-foreground")}
            >
              {buttonLabel}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setQuery}
            placeholder="Search projects..."
            value={query}
          />
          <CommandList>
            {projectsQuery.isLoading ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Searching...
              </div>
            ) : (
              <CommandEmpty>No projects found.</CommandEmpty>
            )}
            <CommandGroup>
              <CommandItem
                data-checked={value === null}
                onSelect={() => {
                  onChange(null, null)
                  setOpen(false)
                }}
                value="__none__"
              >
                <span className="text-muted-foreground">No project</span>
              </CommandItem>
              {projects.map((project) => (
                <CommandItem
                  data-checked={value === project.id}
                  key={project.id}
                  onSelect={() => {
                    onChange(project.id, project.name)
                    setOpen(false)
                  }}
                  value={project.id}
                >
                  <span className="truncate">{project.name}</span>
                  {project.clientName ? (
                    <span className="truncate text-muted-foreground text-xs">
                      {project.clientName}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
