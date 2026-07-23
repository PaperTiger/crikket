"use client"

import {
  BUG_REPORT_COMMENT_VISIBILITY_OPTIONS,
  type BugReportCommentVisibility,
} from "@crikket/shared/constants/bug-report"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@crikket/ui/components/ui/avatar"
import { Button } from "@crikket/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { Textarea } from "@crikket/ui/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crikket/ui/components/ui/tooltip"
import { cn } from "@crikket/ui/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AtSign,
  ChevronDown,
  EyeOff,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from "lucide-react"
import {
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { orpc } from "@/utils/orpc"
import type { SharedBugReport } from "./types"

const { everyone, memberOnly } = BUG_REPORT_COMMENT_VISIBILITY_OPTIONS

const WHITESPACE_RE = /\s+/
const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

function getInitials(name: string): string {
  return (
    name
      .split(WHITESPACE_RE)
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

function formatRelative(value: string): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) {
    return ""
  }
  const diffMs = Date.now() - then
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) {
    return "just now"
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.round(hours / 24)
  if (days < 30) {
    return `${days}d ago`
  }
  return new Date(value).toLocaleDateString()
}

/** Render body text, styling `@[Name](id)` mention tokens. */
function renderBody(body: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  let key = 0
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex walk
  while ((match = MENTION_RE.exec(body)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(body.slice(lastIndex, match.index))
    }
    nodes.push(
      <span
        className="rounded bg-primary/10 px-1 font-medium text-primary"
        key={`m-${key}`}
      >
        @{match[1]}
      </span>
    )
    key += 1
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) {
    nodes.push(body.slice(lastIndex))
  }
  return nodes
}

/** A person's name; hovering reveals their email when one is available. */
function PersonName({
  name,
  email,
}: {
  name: string
  email: string | null
}) {
  if (!email) {
    return <span className="font-medium text-sm">{name}</span>
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="cursor-default font-medium text-sm underline decoration-dotted underline-offset-2" />
        }
      >
        {name}
      </TooltipTrigger>
      <TooltipContent>{email}</TooltipContent>
    </Tooltip>
  )
}

type CommentItem = Awaited<
  ReturnType<typeof import("@/utils/orpc").client.bugReport.listComments>
>[number]

function VisibilityMenu({
  value,
  onChange,
}: {
  value: BugReportCommentVisibility
  onChange: (value: BugReportCommentVisibility) => void
}) {
  const isEveryone = value === everyone
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="gap-1.5 text-muted-foreground"
            size="sm"
            variant="ghost"
          />
        }
      >
        {isEveryone ? (
          <Users className="size-4" />
        ) : (
          <EyeOff className="size-4" />
        )}
        {isEveryone ? "Everyone" : "Member-only"}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onChange(everyone)}>
          <Users className="size-4" />
          Everyone
          <DropdownMenuShortcut>E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange(memberOnly)}>
          <EyeOff className="size-4" />
          Member-only
          <DropdownMenuShortcut>M</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface MentionQuery {
  /** Index of the triggering "@" in the body. */
  start: number
  /** Text typed after the "@", up to the caret. */
  query: string
}

/**
 * If the caret sits inside an active "@mention" token, return where it starts
 * and what has been typed so far. A token starts at an "@" that follows
 * whitespace (or the start of the text) and runs until the next whitespace.
 */
function detectMention(value: string, caret: number): MentionQuery | null {
  let index = caret - 1
  while (index >= 0) {
    const char = value[index]
    if (char === "@") {
      const before = index > 0 ? value[index - 1] : " "
      if (before && /\s/.test(before)) {
        return { start: index, query: value.slice(index + 1, caret) }
      }
      return null
    }
    if (!char || /\s/.test(char)) {
      return null
    }
    index -= 1
  }
  return null
}

function Composer({
  bugReportId,
  isGuest,
  onPosted,
}: {
  bugReportId: string
  isGuest: boolean
  onPosted: () => Promise<unknown>
}) {
  const [body, setBody] = useState("")
  const [visibility, setVisibility] =
    useState<BugReportCommentVisibility>(everyone)
  const [mention, setMention] = useState<MentionQuery | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const createMutation = useMutation(
    orpc.bugReport.createComment.mutationOptions({
      onSuccess: async () => {
        setBody("")
        setVisibility(everyone)
        setMention(null)
        await onPosted()
      },
      onError: (error) => {
        toast.error(error.message || "Could not post your comment")
      },
    })
  )

  // Guests can't enumerate the staff directory, so mentions are member-only.
  const peopleQuery = useQuery({
    ...orpc.people.list.queryOptions(),
    enabled: !isGuest,
  })
  const suggestions = useMemo(() => {
    if (!mention) {
      return []
    }
    const q = mention.query.toLowerCase()
    return (peopleQuery.data ?? [])
      .filter((person) => person.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [peopleQuery.data, mention])

  const syncMention = (value: string, caret: number) => {
    if (isGuest) {
      return
    }
    setMention(detectMention(value, caret))
    setActiveIndex(0)
  }

  const selectPerson = (person: { id: string; name: string }) => {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? body.length
    const start = mention?.start ?? caret
    const markup = `@[${person.name}](${person.id}) `
    const next = body.slice(0, start) + markup + body.slice(caret)
    setBody(next)
    setMention(null)
    requestAnimationFrame(() => {
      el?.focus()
      const pos = start + markup.length
      el?.setSelectionRange(pos, pos)
    })
  }

  const submit = () => {
    const trimmed = body.trim()
    if (!trimmed || createMutation.isPending) {
      return
    }
    createMutation.mutate({ bugReportId, body: trimmed, visibility })
  }

  const isPicking = mention !== null && suggestions.length > 0

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isPicking) {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % suggestions.length)
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex(
          (index) => (index - 1 + suggestions.length) % suggestions.length
        )
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        selectPerson(suggestions[activeIndex])
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        setMention(null)
        return
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      submit()
    }
  }

  const triggerMention = () => {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? body.length
    // Only prefix a space when the previous char isn't already whitespace, so
    // the "@" reliably starts a mention token.
    const needsSpace = caret > 0 && !/\s/.test(body[caret - 1] ?? "")
    const insert = `${needsSpace ? " " : ""}@`
    const next = body.slice(0, caret) + insert + body.slice(caret)
    setBody(next)
    requestAnimationFrame(() => {
      el?.focus()
      const pos = caret + insert.length
      el?.setSelectionRange(pos, pos)
      syncMention(next, pos)
    })
  }

  return (
    <div className="relative rounded-lg border bg-card focus-within:border-ring">
      {isPicking ? (
        <div className="absolute bottom-full left-2 z-30 mb-1 w-72 overflow-hidden rounded-lg border bg-popover shadow-md">
          <ul className="max-h-64 overflow-auto py-1">
            {suggestions.map((person, index) => (
              <li key={person.id}>
                <button
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-sm",
                    index === activeIndex && "bg-accent"
                  )}
                  onMouseDown={(event) => {
                    // Keep textarea focus; mousedown fires before blur.
                    event.preventDefault()
                    selectPerson(person)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  type="button"
                >
                  {person.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Textarea
        aria-label="Write a comment"
        className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        onChange={(event) => {
          setBody(event.target.value)
          syncMention(event.target.value, event.target.selectionStart ?? 0)
        }}
        onClick={(event) =>
          syncMention(
            event.currentTarget.value,
            event.currentTarget.selectionStart ?? 0
          )
        }
        onKeyDown={handleKeyDown}
        placeholder="Write a comment..."
        ref={textareaRef}
        value={body}
      />
      <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          {isGuest ? null : (
            <Button
              aria-label="Mention someone"
              className="text-muted-foreground"
              onClick={triggerMention}
              size="icon-sm"
              variant="ghost"
            >
              <AtSign className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Guests may only post to everyone, so the toggle is member-only. */}
          {isGuest ? null : (
            <VisibilityMenu onChange={setVisibility} value={visibility} />
          )}
          <Button
            disabled={!body.trim() || createMutation.isPending}
            onClick={submit}
            size="sm"
          >
            {createMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentRow({
  comment,
  onChanged,
}: {
  comment: CommentItem
  onChanged: () => Promise<unknown>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)

  const updateMutation = useMutation(
    orpc.bugReport.updateComment.mutationOptions({
      onSuccess: async () => {
        setIsEditing(false)
        await onChanged()
      },
      onError: (error) => toast.error(error.message || "Could not save"),
    })
  )
  const deleteMutation = useMutation(
    orpc.bugReport.deleteComment.mutationOptions({
      onSuccess: async () => {
        await onChanged()
      },
      onError: (error) => toast.error(error.message || "Could not delete"),
    })
  )

  const author = comment.author
  const displayName = comment.canModify ? "You" : (author?.name ?? "Unknown")
  const isMemberOnly = comment.visibility === memberOnly

  return (
    <div className="flex gap-3">
      <Avatar className="mt-0.5" isGuest={author?.isGuest ?? false} size="sm">
        {author?.avatarUrl ? (
          <AvatarImage alt={displayName} src={author.avatarUrl} />
        ) : null}
        <AvatarFallback>
          {getInitials(author?.name ?? displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PersonName email={author?.email ?? null} name={displayName} />
          <span className="text-muted-foreground text-xs">
            {formatRelative(comment.createdAt)}
          </span>
          {isMemberOnly ? (
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <EyeOff className="size-3" />
              Member-only
            </span>
          ) : null}
          {comment.canModify && !isEditing ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label="Comment actions"
                    className="ml-auto text-muted-foreground"
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setDraft(comment.body)
                    setIsEditing(true)
                  }}
                >
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate({ id: comment.id })}
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              className="min-h-16"
              onChange={(event) => setDraft(event.target.value)}
              value={draft}
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setIsEditing(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={!draft.trim() || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({ id: comment.id, body: draft.trim() })
                }
                size="sm"
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {renderBody(comment.body)}
          </p>
        )}
      </div>
    </div>
  )
}

export function CommentsPanel({ data }: { data: SharedBugReport }) {
  const commentsQuery = useQuery(
    orpc.bugReport.listComments.queryOptions({
      input: { bugReportId: data.id },
    })
  )
  const comments = commentsQuery.data ?? []

  const refetch = async () => {
    await commentsQuery.refetch()
  }

  return (
    <div className="space-y-4 pt-2">
      <h2 className="font-semibold text-lg">Comments</h2>

      {comments.length === 0 && !commentsQuery.isLoading ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed py-10 text-center">
          <MessageSquare className="size-6 text-muted-foreground" />
          <p className="font-medium text-sm">No comments</p>
          <p className="text-muted-foreground text-sm">Start a conversation</p>
        </div>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => (
            <CommentRow comment={comment} key={comment.id} onChanged={refetch} />
          ))}
        </div>
      )}

      <Composer bugReportId={data.id} isGuest={data.isGuest} onPosted={refetch} />
    </div>
  )
}
