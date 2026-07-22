import { describe, expect, it } from "bun:test"

import { SCREENSHOT_LOOKBACK_MS } from "../src/constants"
import {
  createSubmitTransport,
  getCaptureSdk,
  sdkTestState,
  setupCaptureSdkTestHooks,
  waitFor,
} from "./lib/sdk-test-harness"

setupCaptureSdkTestHooks()

describe("capture SDK DOM screenshot flow", () => {
  it("captures a region via snapdom and opens review without a permission prompt", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_dom_flow",
      host: "https://api.crikket.io",
      submitTransport: createSubmitTransport(),
    })

    expect(capture.getConfig()?.screenshotMode).toBe("dom")

    capture.open()
    await waitFor(() => sdkTestState.uiOpenChooserCalls === 1)

    const blob = await capture.takeScreenshot()

    expect(blob).toBe(sdkTestState.screenshotBlob)
    expect(sdkTestState.selectRegionCalls).toHaveLength(1)
    expect(sdkTestState.domCaptureCalls).toBe(1)
    // DOM capture never touches the display-capture (getDisplayMedia) path.
    expect(sdkTestState.startSessionCalls).toEqual([
      {
        captureType: "screenshot",
        lookbackMs: SCREENSHOT_LOOKBACK_MS,
      },
    ])
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
    expect(sdkTestState.uiHidden).toEqual([true, false])
  })

  it("restores the chooser without an error when the user cancels region selection", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_dom_cancel",
      host: "https://api.crikket.io",
    })

    capture.open()
    await waitFor(() => sdkTestState.uiOpenChooserCalls === 1)

    sdkTestState.regionSelectCancelled = true

    const blob = await capture.takeScreenshot()

    expect(blob).toBeNull()
    expect(sdkTestState.selectRegionCalls).toHaveLength(1)
    expect(sdkTestState.domCaptureCalls).toBe(0)
    // No session is started and no review is shown on cancel.
    expect(sdkTestState.startSessionCalls).toEqual([])
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(0)
    // Widget hidden for the overlay, then restored, and the chooser reopened.
    expect(sdkTestState.uiHidden).toEqual([true, false])
    expect(sdkTestState.uiOpenChooserCalls).toBe(2)
  })

  it("falls back to display capture when DOM rasterization fails", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_dom_fallback",
      host: "https://api.crikket.io",
    })

    capture.open()
    await waitFor(() => sdkTestState.uiOpenChooserCalls === 1)

    sdkTestState.domCaptureError = new Error("Tainted canvas.")

    const blob = await capture.takeScreenshot()

    expect(blob).toBe(sdkTestState.screenshotBlob)
    expect(sdkTestState.domCaptureCalls).toBe(1)
    // Two screenshot sessions: the DOM attempt (cleared) then the display path.
    expect(sdkTestState.startSessionCalls).toHaveLength(2)
    expect(sdkTestState.clearSessionCalls).toBe(1)
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
  })

  it("skips the region overlay entirely in display mode", async () => {
    const capture = getCaptureSdk()

    capture.init({
      key: "crk_display_mode",
      host: "https://api.crikket.io",
      screenshotMode: "display",
    })

    expect(capture.getConfig()?.screenshotMode).toBe("display")

    capture.open()
    await waitFor(() => sdkTestState.uiOpenChooserCalls === 1)

    const blob = await capture.takeScreenshot()

    expect(blob).toBe(sdkTestState.screenshotBlob)
    expect(sdkTestState.selectRegionCalls).toHaveLength(0)
    expect(sdkTestState.domCaptureCalls).toBe(0)
    expect(sdkTestState.uiShowReviewInputs).toHaveLength(1)
  })
})
