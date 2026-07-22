function SvgIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    />
  )
}

export function DrawIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 6.5 4 4" />
    </SvgIcon>
  )
}

export function HighlightIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M6 16.5 14.5 8a2.1 2.1 0 1 1 3 3L9 19.5H6v-3Z" />
      <path d="M4 20h16" />
    </SvgIcon>
  )
}

export function RectangleIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <rect height="12" rx="2" width="16" x="4" y="6" />
    </SvgIcon>
  )
}

export function UndoIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="m10 8-5 4 5 4" />
      <path d="M6 12h8a4 4 0 1 1 0 8h-1" />
    </SvgIcon>
  )
}

export function ResetIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M12 5a7 7 0 1 1-6.2 3.8" />
      <path d="M4 4v5h5" />
    </SvgIcon>
  )
}

export function SelectIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="m5 4 6 15 2.2-5.8L19 11 5 4Z" />
      <path d="m13 13 5 5" />
    </SvgIcon>
  )
}

export function ArrowIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M5 19 19 5" />
      <path d="M10 5h9v9" />
    </SvgIcon>
  )
}

export function TextIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M5 6V5h14v1" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </SvgIcon>
  )
}

export function BlurIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" strokeDasharray="1.5 2.5" />
      <path d="M4 12h16" strokeDasharray="1.5 2.5" />
    </SvgIcon>
  )
}

export function EmojiIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M9 14.5a4 4 0 0 0 6 0" />
    </SvgIcon>
  )
}

export function TrashIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 12h8l1-12" />
    </SvgIcon>
  )
}

export function CopyIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <rect height="12" rx="2" width="10" x="9" y="9" />
      <path d="M7 15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </SvgIcon>
  )
}

export function CheckIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </SvgIcon>
  )
}

export function ExternalLinkIcon(
  props: React.SVGProps<SVGSVGElement>
): React.JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </SvgIcon>
  )
}
