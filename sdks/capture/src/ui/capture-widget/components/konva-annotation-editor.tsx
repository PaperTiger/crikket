import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import {
  AnnotationStage,
  type AnnotationStageState,
  type AnnotationTool,
} from "../utils/annotation-stage"
import {
  ArrowIcon,
  BlurIcon,
  DrawIcon,
  EmojiIcon,
  HighlightIcon,
  RectangleIcon,
  ResetIcon,
  SelectIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from "./icons"
import { Button } from "./primitives/button"
import { cn } from "./primitives/cn"

export interface KonvaAnnotationEditorHandle {
  exportAnnotatedBlob: () => Promise<Blob | null>
}

interface KonvaAnnotationEditorProps {
  disabled: boolean
  src: string
}

const TOOLS: Array<{
  value: AnnotationTool
  label: string
  icon: React.ReactNode
}> = [
  {
    value: "select",
    label: "Select",
    icon: <SelectIcon className="h-4 w-4" />,
  },
  { value: "pen", label: "Draw", icon: <DrawIcon className="h-4 w-4" /> },
  {
    value: "highlight",
    label: "Highlight",
    icon: <HighlightIcon className="h-4 w-4" />,
  },
  { value: "arrow", label: "Arrow", icon: <ArrowIcon className="h-4 w-4" /> },
  {
    value: "rectangle",
    label: "Rectangle",
    icon: <RectangleIcon className="h-4 w-4" />,
  },
  { value: "text", label: "Text", icon: <TextIcon className="h-4 w-4" /> },
  { value: "blur", label: "Blur", icon: <BlurIcon className="h-4 w-4" /> },
  { value: "emoji", label: "Emoji", icon: <EmojiIcon className="h-4 w-4" /> },
]

const COLOR_OPTIONS = [
  { label: "Orange", value: "#F97316" },
  { label: "Red", value: "#EF4444" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Green", value: "#22C55E" },
] as const

const EMOJI_OPTIONS = ["👍", "👎", "❤️", "🔥", "⚠️", "❓", "✅", "❌"]

const DEFAULT_TOOL: AnnotationTool = "select"
const DEFAULT_COLOR = COLOR_OPTIONS[0].value
const DEFAULT_EMOJI = "👍"

const TOOL_HINTS: Partial<Record<AnnotationTool, string>> = {
  select: "Click an annotation to move or resize it, then use the trash icon.",
  text: "Click the screenshot and type. Press Enter to place, Esc to cancel.",
  blur: "Drag a box over anything you want to blur out.",
}

export const KonvaAnnotationEditor = forwardRef<
  KonvaAnnotationEditorHandle,
  KonvaAnnotationEditorProps
>(function KonvaAnnotationEditor({ disabled, src }, ref): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<AnnotationStage | null>(null)
  const [tool, setTool] = useState<AnnotationTool>(DEFAULT_TOOL)
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [activeEmoji, setActiveEmoji] = useState<string>(DEFAULT_EMOJI)
  const [isReady, setIsReady] = useState(false)
  const [stageState, setStageState] = useState<AnnotationStageState>({
    hasShapes: false,
    hasSelection: false,
  })

  useImperativeHandle(
    ref,
    () => ({
      exportAnnotatedBlob: () => {
        const stage = stageRef.current
        if (!stage) {
          return Promise.resolve(null)
        }
        return stage.exportBlob()
      },
    }),
    []
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let cancelled = false
    setIsReady(false)
    setTool(DEFAULT_TOOL)
    setStageState({ hasShapes: false, hasSelection: false })

    AnnotationStage.mount({
      container,
      imageUrl: src,
      onStateChange: (state) => {
        setStageState(state)
      },
    })
      .then((stage) => {
        if (cancelled) {
          stage.destroy()
          return
        }
        stageRef.current = stage
        setIsReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setIsReady(false)
        }
      })

    return () => {
      cancelled = true
      stageRef.current?.destroy()
      stageRef.current = null
    }
  }, [src])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const observer = new ResizeObserver(() => {
      stageRef.current?.resize()
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    stageRef.current?.setDisabled(disabled)
  }, [disabled])

  const applyTool = (nextTool: AnnotationTool) => {
    setTool(nextTool)
    stageRef.current?.setTool(nextTool)
  }

  const applyColor = (nextColor: string) => {
    setColor(nextColor)
    stageRef.current?.setColor(nextColor)
  }

  const applyEmoji = (nextEmoji: string) => {
    setActiveEmoji(nextEmoji)
    stageRef.current?.setActiveEmoji(nextEmoji)
  }

  const controlsDisabled = disabled || !isReady

  return (
    <div className="grid min-h-full grid-rows-[auto_1fr] gap-3">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {TOOLS.map((toolOption) => (
            <ToolButton
              active={tool === toolOption.value}
              disabled={controlsDisabled}
              icon={toolOption.icon}
              key={toolOption.value}
              label={toolOption.label}
              onClick={() => {
                applyTool(toolOption.value)
              }}
            />
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {COLOR_OPTIONS.map((option) => (
              <ColorButton
                active={color === option.value}
                color={option.value}
                disabled={controlsDisabled}
                key={option.value}
                label={option.label}
                onClick={() => {
                  applyColor(option.value)
                }}
              />
            ))}
            <Button
              className="gap-2"
              disabled={controlsDisabled || !stageState.hasSelection}
              onClick={() => {
                stageRef.current?.deleteSelected()
              }}
              size="icon"
              type="button"
              variant="outline"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
            <Button
              className="gap-2"
              disabled={controlsDisabled || !stageState.hasShapes}
              onClick={() => {
                stageRef.current?.undo()
              }}
              size="icon"
              type="button"
              variant="outline"
            >
              <UndoIcon className="h-4 w-4" />
            </Button>
            <Button
              className="gap-2"
              disabled={controlsDisabled || !stageState.hasShapes}
              onClick={() => {
                stageRef.current?.reset()
              }}
              size="icon"
              type="button"
              variant="outline"
            >
              <ResetIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {tool === "emoji" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                aria-label={`Emoji ${emoji}`}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border text-base outline-none transition-transform focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  activeEmoji === emoji
                    ? "scale-110 border-foreground bg-muted"
                    : "border-border"
                )}
                disabled={controlsDisabled}
                key={emoji}
                onClick={() => {
                  applyEmoji(emoji)
                }}
                type="button"
              >
                {emoji}
              </button>
            ))}
            <span className="text-muted-foreground text-xs">
              Pick an emoji, then click the screenshot to place it.
            </span>
          </div>
        ) : null}

        {tool !== "emoji" && TOOL_HINTS[tool] ? (
          <p className="text-muted-foreground text-xs">{TOOL_HINTS[tool]}</p>
        ) : null}
      </div>

      <div className="min-h-0 overflow-auto">
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-[960px]">
            <div
              className="w-full overflow-hidden rounded-xl bg-white shadow-sm"
              ref={containerRef}
              style={{ touchAction: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

function ToolButton(props: {
  active: boolean
  disabled: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      className={cn(
        "gap-2",
        props.active
          ? "border-transparent bg-primary text-primary-foreground"
          : null
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      size="sm"
      type="button"
      variant={props.active ? "secondary" : "outline"}
    >
      <span className="text-sm">{props.icon}</span>
      <span>{props.label}</span>
    </Button>
  )
}

function ColorButton(props: {
  active: boolean
  color: string
  disabled: boolean
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      aria-label={props.label}
      className={cn(
        "h-5 w-5 rounded-full border outline-none transition-transform focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        props.active ? "scale-110 border-foreground" : "border-border"
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        backgroundColor: props.color,
      }}
      type="button"
    />
  )
}
