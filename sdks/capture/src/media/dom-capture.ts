import { snapdom } from "@zumer/snapdom"
import { canvasToBlob } from "./display-capture"
import type { RegionSelection } from "./region-select"

// Cap the rasterization multiplier so very tall pages on high-DPR displays do
// not blow past the browser's canvas size limits.
const MAX_CAPTURE_SCALE = 2

// Selector for the SDK's own UI hosts (launcher, widget, region overlay) so
// snapdom never rasterizes the capture chrome into the screenshot.
const CAPTURE_UI_SELECTOR = "[data-crikket-capture-ui]"

/**
 * Raised when snapdom cannot rasterize the page (tainted canvas, strict CSP,
 * cross-origin fonts/images, oversized canvas). The runtime catches this to
 * fall back to the display-capture path.
 */
export class DomCaptureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "DomCaptureError"
  }
}

/**
 * Rasterizes the current viewport with snapdom (no permission prompt) and crops
 * it to the selected region. Returns a PNG blob for the existing capture
 * pipeline.
 *
 * v1 captures the visible viewport only — content above/below the fold is not
 * stitched, and `position: fixed` elements are rendered at their document
 * position when the page is scrolled.
 */
export async function captureDomScreenshot(
  selection: RegionSelection
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new DomCaptureError("DOM capture requires a browser environment.")
  }

  const scale = Math.min(
    Math.max(window.devicePixelRatio || 1, 1),
    MAX_CAPTURE_SCALE
  )

  let sourceCanvas: HTMLCanvasElement
  try {
    sourceCanvas = await snapdom.toCanvas(document.body, {
      scale,
      dpr: 1,
      fast: true,
      embedFonts: true,
      backgroundColor: "#ffffff",
      exclude: [CAPTURE_UI_SELECTOR],
    })
  } catch (error) {
    throw new DomCaptureError("Failed to rasterize the page for capture.", {
      cause: error,
    })
  }

  try {
    return await cropCanvasToSelection(sourceCanvas, selection)
  } catch (error) {
    throw new DomCaptureError("Failed to crop the captured screenshot.", {
      cause: error,
    })
  }
}

function cropCanvasToSelection(
  sourceCanvas: HTMLCanvasElement,
  selection: RegionSelection
): Promise<Blob> {
  const bodyElement = document.body
  const bodyRect = bodyElement.getBoundingClientRect()

  // Derive the true scale from the produced canvas rather than assuming how
  // snapdom combined scale/dpr — this keeps the crop correct regardless.
  const sourceWidth = bodyElement.offsetWidth || sourceCanvas.width
  const sourceHeight = bodyElement.offsetHeight || sourceCanvas.height
  const scaleX = sourceCanvas.width / sourceWidth
  const scaleY = sourceCanvas.height / sourceHeight

  // Selection is in viewport coords; bodyRect (already scroll/margin adjusted)
  // maps them into the captured canvas coordinate space.
  const rawX = (selection.x - bodyRect.left) * scaleX
  const rawY = (selection.y - bodyRect.top) * scaleY
  const rawWidth = selection.width * scaleX
  const rawHeight = selection.height * scaleY

  const sx = clamp(rawX, 0, sourceCanvas.width)
  const sy = clamp(rawY, 0, sourceCanvas.height)
  const sw = clamp(rawWidth, 1, sourceCanvas.width - sx)
  const sh = clamp(rawHeight, 1, sourceCanvas.height - sy)

  const outputCanvas = document.createElement("canvas")
  outputCanvas.width = Math.max(1, Math.round(sw))
  outputCanvas.height = Math.max(1, Math.round(sh))

  const context = outputCanvas.getContext("2d")
  if (!context) {
    throw new Error("Failed to initialize crop canvas.")
  }

  context.drawImage(
    sourceCanvas,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  )

  return canvasToBlob(outputCanvas, "image/png")
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
