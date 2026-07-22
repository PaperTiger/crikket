import type { RecordingController } from "../types"
import type { RegionSelection } from "./region-select"

export async function captureScreenshot(): Promise<Blob> {
  const mediaModule = await import("./capture-screenshot")
  return mediaModule.captureScreenshot()
}

export async function selectCaptureRegion(options: {
  zIndex: number
}): Promise<RegionSelection | null> {
  const mediaModule = await import("./region-select")
  return mediaModule.selectCaptureRegion(options)
}

export async function captureDomScreenshot(
  selection: RegionSelection
): Promise<Blob> {
  const mediaModule = await import("./dom-capture")
  return mediaModule.captureDomScreenshot(selection)
}

export async function startDisplayRecording(): Promise<RecordingController> {
  const mediaModule = await import("./start-display-recording")
  return mediaModule.startDisplayRecording()
}
