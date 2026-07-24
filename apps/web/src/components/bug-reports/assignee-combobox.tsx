"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crikket/ui/components/ui/tooltip"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, UserRound } from "lucide-react"
import * as React from "react"

import { orpc } from "@/utils/orpc"

const WHITESPACE_PATTERN = /\s+/

interface AssigneeComboboxProps {
  value: string | null
  onChange: (assigneeId: string | null) => void
  disabled?: boolean
  /** Icon-only trigger (avatar, or a placeholder when unassigned). */
  compact?: boolean
}

function getInitials(name: string): string {
  const parts = name.trim().split(WHITESPACE_PATTERN).filter(Boolean)
  if (parts.length === 0) {
    return "?"
  }
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase() || "?"
}

export function AssigneeCombobox({
  value,
  onChange,
  disabled,
  compact = false,
}: AssigneeComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const peopleQuery = useQuery(orpc.people.list.queryOptions())
  const people = peopleQuery.data ?? []
  const selected = people.find((person) => person.id === value)

  // Outline only when showing the placeholder — a selected avatar has its own
  // ring, so an extra border would double up.
  const compactTrigger = (
    <Button
      aria-expanded={open}
      aria-label={selected ? selected.name : "Assign to…"}
      className="size-8"
      disabled={disabled}
      size="icon-sm"
      type="button"
      variant={selected ? "ghost" : "outline"}
    >
      {selected ? (
        <Avatar size="sm">
          {selected.avatarUrl ? (
            <AvatarImage alt={selected.name} src={selected.avatarUrl} />
          ) : null}
          <AvatarFallback>{getInitials(selected.name)}</AvatarFallback>
        </Avatar>
      ) : (
        <UserRound className="size-4 text-muted-foreground" />
      )}
    </Button>
  )

  const fullTrigger = (
    <Button
      aria-expanded={open}
      className="w-full justify-between font-normal"
      disabled={disabled}
      type="button"
      variant="outline"
    >
      {selected ? (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar size="sm">
            {selected.avatarUrl ? (
              <AvatarImage alt={selected.name} src={selected.avatarUrl} />
            ) : null}
            <AvatarFallback>{getInitials(selected.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{selected.name}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      )}
      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
    </Button>
  )

  const popoverContent = (
    <PopoverContent align="start" className="w-72 p-0">
      <Command>
        <CommandInput placeholder="Search people..." />
        <CommandList>
          <CommandEmpty>No people found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              data-checked={value === null}
              onSelect={() => {
                onChange(null)
                setOpen(false)
              }}
              value="Unassigned"
            >
              <span className="text-muted-foreground">Unassigned</span>
            </CommandItem>
            {people.map((person) => (
              <CommandItem
                data-checked={value === person.id}
                key={person.id}
                onSelect={() => {
                  onChange(person.id)
                  setOpen(false)
                }}
                value={person.name}
              >
                <Avatar size="sm">
                  {person.avatarUrl ? (
                    <AvatarImage alt={person.name} src={person.avatarUrl} />
                  ) : null}
                  <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{person.name}</span>
                {person.discipline ? (
                  <span className="truncate text-muted-foreground text-xs">
                    {person.discipline}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  )

  if (compact) {
    return (
      <Popover onOpenChange={setOpen} open={open}>
        <Tooltip>
          <TooltipTrigger render={<PopoverTrigger render={compactTrigger} />} />
          <TooltipContent>
            {selected ? selected.name : "No assignee"}
          </TooltipContent>
        </Tooltip>
        {popoverContent}
      </Popover>
    )
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={fullTrigger} />
      {popoverContent}
    </Popover>
  )
}
