import { cn } from "./cn"

type ButtonVariant = "primary" | "outline" | "secondary"
type ButtonSize = "default" | "icon" | "sm"

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: ButtonSize
    variant?: ButtonVariant
  }
): React.JSX.Element {
  const variant = props.variant ?? "primary"
  const size = props.size ?? "default"

  return (
    <button
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === "sm" && "h-8 gap-1.5 px-3",
        size === "default" && "h-9 px-4 py-2",
        size === "icon" && "size-9",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        variant === "outline" &&
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        variant === "secondary" &&
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        props.className
      )}
      type={props.type ?? "button"}
    >
      {props.children}
    </button>
  )
}
