import { LazyDebuggerCollector } from "../debugger/lazy-debugger-collector"
import {
  captureDomScreenshot,
  captureScreenshot,
  selectCaptureRegion,
  startDisplayRecording,
} from "../media/lazy-capture-media"
import type {
  CapturedMedia,
  CaptureInitOptions,
  CaptureRuntimeConfig,
  CaptureRuntimeController,
  CaptureSubmissionDraft,
  CaptureSubmitTransport,
  RecordingController,
  ReviewSnapshot,
} from "../types"
import { mountCaptureUi } from "../ui/mount-capture-ui"
import type { CaptureReviewSubmitOptions, MountedCaptureUi } from "../ui/types"
import {
  normalizeHost,
  normalizeKey,
  normalizeScreenshotMode,
  normalizeSubmitPath,
  normalizeZIndex,
} from "../utils"

export class CaptureSdkRuntime implements CaptureRuntimeController {
  private runtimeConfig: CaptureRuntimeConfig | null = null
  private submitTransport: CaptureSubmitTransport | undefined
  private mountedTarget: HTMLElement | null = null
  private mountedUi: MountedCaptureUi | null = null
  private readonly debuggerCollector = new LazyDebuggerCollector()
  private activeRecording: RecordingController | null = null
  private currentMedia: CapturedMedia | null = null
  private currentReview: ReviewSnapshot | null = null

  init(options: CaptureInitOptions): CaptureRuntimeController {
    const config: CaptureRuntimeConfig = {
      key: normalizeKey(options.key),
      host: normalizeHost(options.host),
      submitPath: normalizeSubmitPath(options.submitPath),
      zIndex: normalizeZIndex(options.zIndex),
      screenshotMode: normalizeScreenshotMode(options.screenshotMode),
    }

    this.runtimeConfig = config
    this.submitTransport = options.submitTransport

    if (options.autoMount ?? true) {
      this.mount(options.mountTarget)
    }

    return this
  }

  isInitialized(): boolean {
    return this.runtimeConfig !== null
  }

  getConfig(): CaptureRuntimeConfig | null {
    return this.runtimeConfig
  }

  mount(target?: HTMLElement): void {
    const config = this.getRuntimeConfig()
    this.ensureBrowserContext()

    if (this.mountedTarget) {
      return
    }

    const mountTarget = target ?? document.body
    this.mountedUi = mountCaptureUi(mountTarget, config.zIndex, {
      onClose: () => {
        this.close()
      },
      onStartVideo: () => {
        return this.startRecording()
      },
      onTakeScreenshot: async () => {
        // Returns null when the user cancels region selection; that is a
        // graceful no-op (the chooser is restored), not a failure.
        await this.takeScreenshot()
      },
      onStopRecording: async () => {
        const blob = await this.stopRecording()
        if (!blob) {
          throw new Error("Recording capture failed.")
        }
      },
      onSubmit: (draft, options) => {
        return this.submit(draft, options).then(() => undefined)
      },
      onReset: () => {
        this.reset()
      },
    })
    this.mountedTarget = mountTarget
  }

  unmount(): void {
    this.abortActiveRecording()
    this.setUiHidden(false)
    this.mountedUi?.unmount()
    this.mountedUi = null
    this.debuggerCollector.dispose()
    this.mountedTarget = null
  }

  open(): void {
    this.getRuntimeConfig()
    if (!this.mountedTarget) {
      this.mount()
    }

    this.mountedUi?.store.openChooser()
  }

  close(): void {
    this.setUiHidden(false)
    this.mountedUi?.store.close()
  }

  destroy(): void {
    this.reset()
    this.unmount()
    this.runtimeConfig = null
    this.submitTransport = undefined
  }

  async startRecording(): Promise<{ startedAt: number }> {
    this.getRuntimeConfig()
    this.ensureBrowserContext()
    this.abortActiveRecording()
    await this.debuggerCollector.startRecordingSession()

    try {
      await this.hideUiForCapture()
      const controller = await startDisplayRecording()
      this.debuggerCollector.markRecordingStarted(controller.startedAt)
      this.activeRecording = controller
      controller.finished
        .then(async (result) => {
          if (this.activeRecording !== controller) {
            return
          }

          this.activeRecording = null
          await this.finalizeCapturedMedia({
            blob: result.blob,
            captureType: "video",
            durationMs: result.durationMs,
          })
        })
        .catch(() => undefined)

      return {
        startedAt: controller.startedAt,
      }
    } catch (error) {
      this.setUiHidden(false)
      this.debuggerCollector.clearSession()
      throw error
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.activeRecording) {
      return null
    }

    const recording = this.activeRecording
    this.activeRecording = null

    const result = await recording.stop()
    await this.finalizeCapturedMedia({
      blob: result.blob,
      captureType: "video",
      durationMs: result.durationMs,
    })

    return result.blob
  }

  takeScreenshot(): Promise<Blob | null> {
    const config = this.getRuntimeConfig()
    this.ensureBrowserContext()

    if (config.screenshotMode === "display") {
      return this.captureDisplayScreenshot()
    }

    return this.captureRegionScreenshot(config)
  }

  private async captureRegionScreenshot(
    config: CaptureRuntimeConfig
  ): Promise<Blob | null> {
    // Hide the widget before the crosshair overlay appears so it never ends up
    // in the capture and the page underneath is clean to select on.
    await this.hideUiForCapture()

    let selection: Awaited<ReturnType<typeof selectCaptureRegion>>
    try {
      selection = await selectCaptureRegion({ zIndex: config.zIndex })
    } catch {
      selection = null
    }

    if (!selection) {
      // Cancelled (Esc / tab hidden) — restore the chooser without an error.
      this.setUiHidden(false)
      this.mountedUi?.store.openChooser()
      return null
    }

    await this.debuggerCollector.startScreenshotSession()

    let blob: Blob
    try {
      blob = await captureDomScreenshot(selection)
    } catch {
      // DOM rasterization failed (tainted canvas, strict CSP, cross-origin
      // assets). Fall back to the display-capture path within the same gesture.
      this.debuggerCollector.clearSession()
      return this.captureDisplayScreenshot()
    }

    await this.finalizeCapturedMedia({
      blob,
      captureType: "screenshot",
      durationMs: null,
    })

    return blob
  }

  private async captureDisplayScreenshot(): Promise<Blob | null> {
    await this.debuggerCollector.startScreenshotSession()

    let blob: Blob
    try {
      await this.hideUiForCapture()
      blob = await captureScreenshot()
    } catch (error) {
      this.setUiHidden(false)
      this.debuggerCollector.clearSession()
      throw error
    }
    await this.finalizeCapturedMedia({
      blob,
      captureType: "screenshot",
      durationMs: null,
    })

    return blob
  }

  async submit(
    draft: CaptureSubmissionDraft,
    options?: CaptureReviewSubmitOptions
  ) {
    const config = this.getRuntimeConfig()
    if (!(this.currentMedia && this.currentReview)) {
      throw new Error(
        "No capture is ready to submit. Start a recording or take a screenshot first."
      )
    }

    const { submitCapturedReport } = await import("./submit-captured-report")
    const media =
      this.currentMedia.captureType === "screenshot" &&
      options?.screenshotBlobOverride
        ? {
            ...this.currentMedia,
            blob: options.screenshotBlobOverride,
          }
        : this.currentMedia
    const result = await submitCapturedReport({
      config,
      draft,
      media,
      review: this.currentReview,
      submitTransport: this.submitTransport,
    })

    if (this.mountedUi) {
      this.mountedUi.store.showSuccess(result.shareUrl)
    }

    return result
  }

  reset(): void {
    this.abortActiveRecording()
    this.setUiHidden(false)
    this.clearMedia()
    this.currentReview = null
    this.debuggerCollector.clearSession()
  }

  private setMedia(input: {
    blob: Blob
    captureType: CapturedMedia["captureType"]
    durationMs: number | null
  }): CapturedMedia {
    this.clearMedia()

    this.currentMedia = {
      blob: input.blob,
      captureType: input.captureType,
      durationMs: input.durationMs,
      objectUrl: URL.createObjectURL(input.blob),
    }

    return this.currentMedia
  }

  private clearMedia(): void {
    if (!this.currentMedia) {
      return
    }

    URL.revokeObjectURL(this.currentMedia.objectUrl)
    this.currentMedia = null
  }

  private finalizeCapturedMedia(input: {
    blob: Blob
    captureType: CapturedMedia["captureType"]
    durationMs: number | null
  }): void {
    this.setUiHidden(false)

    const review = this.debuggerCollector.finalizeSession()
    const media = this.setMedia(input)

    this.currentReview = review
    if (!this.mountedUi) {
      return
    }

    this.mountedUi.store.showReview({
      media,
      warnings: review.warnings,
      summary: review.debuggerSummary,
    })
    // Title is intentionally left blank — the reporter fills the description
    // and the title is generated from the content later.
  }

  private abortActiveRecording(): void {
    if (!this.activeRecording) {
      return
    }

    this.activeRecording.abort()
    this.activeRecording = null
  }

  private async hideUiForCapture(): Promise<void> {
    this.setUiHidden(true)
    await waitForNextPaint()
  }

  private setUiHidden(hidden: boolean): void {
    this.mountedUi?.setHidden(hidden)
  }

  private getRuntimeConfig(): CaptureRuntimeConfig {
    if (!this.runtimeConfig) {
      throw new Error(
        "Capture SDK is not initialized. Call capture.init({ key }) first."
      )
    }

    return this.runtimeConfig
  }

  private ensureBrowserContext(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("Capture SDK can only run in a browser environment.")
    }
  }
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}
