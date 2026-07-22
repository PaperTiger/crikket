export interface RegionSelection {
  kind: "region" | "viewport"
  // CSS pixels in viewport coordinates (relative to the top-left of the visible area).
  x: number
  y: number
  width: number
  height: number
}

interface SelectCaptureRegionOptions {
  zIndex: number
}

// Below this drag distance we treat the gesture as a click and capture the
// whole viewport instead of a region.
const MIN_DRAG_SIZE_PX = 8

const OVERLAY_MARKER_ATTRIBUTE = "data-crikket-capture-ui"

const OVERLAY_STYLES = `
:host { all: initial; }
.region-overlay {
  position: fixed;
  inset: 0;
  cursor: crosshair;
  background: rgba(0, 0, 0, 0.35);
  touch-action: none;
  overscroll-behavior: contain;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.region-overlay[data-dragging="true"] {
  background: transparent;
}
.region-box {
  position: absolute;
  display: none;
  border: 1px dashed rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.region-overlay[data-dragging="true"] .region-box {
  display: block;
}
.region-size {
  position: absolute;
  display: none;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(17, 17, 17, 0.92);
  color: #fff;
  font-size: 11px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}
.region-overlay[data-dragging="true"] .region-size {
  display: block;
}
.region-hint {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 9999px;
  background: rgba(17, 17, 17, 0.92);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.region-overlay[data-dragging="true"] .region-hint {
  opacity: 0;
}
.region-hint-text {
  opacity: 0.85;
}
.region-hint-button {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 9999px;
  cursor: pointer;
}
.region-hint-button:hover {
  background: rgba(255, 255, 255, 0.22);
}
`

/**
 * Shows a Marker.io-style crosshair overlay so the user can drag-select a
 * region of the live page. Resolves with the selection in viewport
 * coordinates, or `null` if the user cancels (Esc / tab hidden).
 *
 * A drag shorter than {@link MIN_DRAG_SIZE_PX}, or the "Capture full screen"
 * button, resolves to a `viewport` selection covering the whole visible area.
 *
 * The overlay lives outside the widget's React tree because the widget host is
 * hidden (`display: none`) during capture. It mounts its own shadow-rooted host
 * into `document.body` and removes it before resolving.
 */
export function selectCaptureRegion(
  options: SelectCaptureRegionOptions
): Promise<RegionSelection | null> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const host = document.createElement("div")
    host.setAttribute(OVERLAY_MARKER_ATTRIBUTE, "")
    host.style.position = "fixed"
    host.style.inset = "0"
    host.style.zIndex = String(options.zIndex + 1)

    const shadowRoot = host.attachShadow({ mode: "open" })
    const styleElement = document.createElement("style")
    styleElement.textContent = OVERLAY_STYLES

    const overlay = document.createElement("div")
    overlay.className = "region-overlay"

    const box = document.createElement("div")
    box.className = "region-box"

    const sizeLabel = document.createElement("div")
    sizeLabel.className = "region-size"

    const hint = document.createElement("div")
    hint.className = "region-hint"
    const hintText = document.createElement("span")
    hintText.className = "region-hint-text"
    hintText.textContent = "Drag to select an area · Esc to cancel"
    const fullScreenButton = document.createElement("button")
    fullScreenButton.type = "button"
    fullScreenButton.className = "region-hint-button"
    fullScreenButton.textContent = "Capture full screen"
    hint.append(hintText, fullScreenButton)

    overlay.append(box, sizeLabel, hint)
    shadowRoot.append(styleElement, overlay)
    document.body.append(host)

    let settled = false
    let dragging = false
    let originX = 0
    let originY = 0
    let activePointerId: number | null = null

    const cleanup = () => {
      window.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      host.remove()
    }

    const settle = (selection: RegionSelection | null) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(selection)
    }

    const viewportSelection = (): RegionSelection => ({
      kind: "viewport",
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    })

    const currentRect = (clientX: number, clientY: number) => {
      const clampedX = clamp(clientX, 0, window.innerWidth)
      const clampedY = clamp(clientY, 0, window.innerHeight)
      return {
        x: Math.min(originX, clampedX),
        y: Math.min(originY, clampedY),
        width: Math.abs(clampedX - originX),
        height: Math.abs(clampedY - originY),
      }
    }

    const renderRect = (rect: {
      x: number
      y: number
      width: number
      height: number
    }) => {
      box.style.left = `${rect.x}px`
      box.style.top = `${rect.y}px`
      box.style.width = `${rect.width}px`
      box.style.height = `${rect.height}px`

      sizeLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`
      const labelTop = rect.y - 24 < 4 ? rect.y + 6 : rect.y - 24
      sizeLabel.style.left = `${rect.x}px`
      sizeLabel.style.top = `${labelTop}px`
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || settled) {
        return
      }
      // Ignore clicks that land on the hint controls.
      if (event.target instanceof Node && hint.contains(event.target)) {
        return
      }

      dragging = true
      activePointerId = event.pointerId
      originX = clamp(event.clientX, 0, window.innerWidth)
      originY = clamp(event.clientY, 0, window.innerHeight)
      overlay.setAttribute("data-dragging", "true")
      overlay.setPointerCapture(event.pointerId)
      renderRect({ x: originX, y: originY, width: 0, height: 0 })
      event.preventDefault()
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragging || event.pointerId !== activePointerId) {
        return
      }
      renderRect(currentRect(event.clientX, event.clientY))
    }

    function handlePointerUp(event: PointerEvent) {
      if (!dragging || event.pointerId !== activePointerId) {
        return
      }
      dragging = false
      activePointerId = null
      overlay.removeAttribute("data-dragging")

      const rect = currentRect(event.clientX, event.clientY)
      if (rect.width < MIN_DRAG_SIZE_PX || rect.height < MIN_DRAG_SIZE_PX) {
        settle(viewportSelection())
        return
      }

      settle({
        kind: "region",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        settle(null)
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        settle(null)
      }
    }

    overlay.addEventListener("pointerdown", handlePointerDown)
    overlay.addEventListener("pointermove", handlePointerMove)
    overlay.addEventListener("pointerup", handlePointerUp)
    overlay.addEventListener("pointercancel", () => {
      settle(null)
    })
    fullScreenButton.addEventListener("click", () => {
      settle(viewportSelection())
    })
    window.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("visibilitychange", handleVisibilityChange)
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
