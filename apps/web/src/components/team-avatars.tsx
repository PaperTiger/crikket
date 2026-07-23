"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { cn } from "@crikket/ui/lib/utils"

export interface TeamAvatarPerson {
  key: string
  label: string
  image: string | null
}

interface TeamAvatarsProps {
  people: TeamAvatarPerson[]
  /** How many faces to show before collapsing into "+N". */
  max?: number
  size?: "sm" | "md"
  className?: string
}

const WHITESPACE_RE = /\s+/

export function teamAvatarInitials(value: string): string {
  const source = value.trim() || "?"
  return source
    .split(WHITESPACE_RE)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/**
 * Overlapping avatar stack used wherever a project's people are summarised —
 * the project index, the grouped table, and the Manage access trigger.
 */
export function TeamAvatars({
  people,
  max = 3,
  size = "md",
  className,
}: TeamAvatarsProps) {
  if (people.length === 0) {
    return null
  }

  const visible = people.slice(0, max)
  const overflow = people.length - visible.length
  const sizeClass = size === "sm" ? "size-6" : "size-8"

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex items-center -space-x-2">
        {visible.map((person) => (
          <Avatar
            className={cn(sizeClass, "ring-2 ring-background")}
            key={person.key}
            title={person.label}
          >
            <AvatarImage alt={person.label} src={person.image ?? undefined} />
            <AvatarFallback className="text-xs">
              {teamAvatarInitials(person.label)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {overflow > 0 ? (
        <span className="pl-2 text-muted-foreground text-xs tabular-nums">
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
