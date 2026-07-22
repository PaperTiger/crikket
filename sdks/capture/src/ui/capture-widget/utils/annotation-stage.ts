import type Konva from "konva"

export type AnnotationTool =
  | "select"
  | "arrow"
  | "rectangle"
  | "pen"
  | "highlight"
  | "text"
  | "blur"
  | "emoji"

export interface AnnotationStageState {
  hasShapes: boolean
  hasSelection: boolean
}

interface AnnotationStageOptions {
  container: HTMLDivElement
  imageUrl: string
  onStateChange: (state: AnnotationStageState) => void
}

const BLUR_RADIUS_RATIO = 0.012
const MIN_SHAPE_SIZE = 4

/**
 * Imperative wrapper around a Konva stage for annotating a screenshot. Konva is
 * loaded dynamically so it lands in its own async chunk (ESM) and only when the
 * review step opens.
 *
 * Shapes are stored in the image's natural pixel coordinates; the stage is
 * scaled to fit its container, so exports are always at full resolution and
 * resizing never distorts existing annotations.
 */
export class AnnotationStage {
  private tool: AnnotationTool = "select"
  private color: string
  private activeEmoji: string | null = "👍"
  private disabled = false
  private scale = 1
  private isDrawing = false
  private draftNode: Konva.Shape | null = null
  private origin = { x: 0, y: 0 }
  private readonly shapes: Konva.Shape[] = []
  private activeTextarea: HTMLTextAreaElement | null = null

  private readonly konva: typeof Konva
  private readonly stage: Konva.Stage
  private readonly drawLayer: Konva.Layer
  private readonly transformer: Konva.Transformer
  private readonly image: HTMLImageElement
  private readonly naturalWidth: number
  private readonly naturalHeight: number
  private readonly options: AnnotationStageOptions

  private constructor(init: {
    konva: typeof Konva
    stage: Konva.Stage
    drawLayer: Konva.Layer
    transformer: Konva.Transformer
    image: HTMLImageElement
    naturalWidth: number
    naturalHeight: number
    options: AnnotationStageOptions
  }) {
    this.konva = init.konva
    this.stage = init.stage
    this.drawLayer = init.drawLayer
    this.transformer = init.transformer
    this.image = init.image
    this.naturalWidth = init.naturalWidth
    this.naturalHeight = init.naturalHeight
    this.options = init.options
    this.color = "#F97316"
  }

  static async mount(
    options: AnnotationStageOptions
  ): Promise<AnnotationStage> {
    const konva = (await import("konva")).default
    const image = await loadImage(options.imageUrl)

    const naturalWidth = image.naturalWidth || image.width || 1
    const naturalHeight = image.naturalHeight || image.height || 1

    const container = options.container
    container.style.position = "relative"
    const containerWidth = container.clientWidth || naturalWidth
    const scale = containerWidth / naturalWidth

    const stage = new konva.Stage({
      container,
      width: naturalWidth * scale,
      height: naturalHeight * scale,
    })
    stage.scale({ x: scale, y: scale })

    const backgroundLayer = new konva.Layer({ listening: false })
    backgroundLayer.add(
      new konva.Image({
        image,
        x: 0,
        y: 0,
        width: naturalWidth,
        height: naturalHeight,
      })
    )
    stage.add(backgroundLayer)

    const drawLayer = new konva.Layer()
    stage.add(drawLayer)

    const transformer = new konva.Transformer({
      rotateEnabled: false,
      borderStroke: "#2563eb",
      anchorStroke: "#2563eb",
      anchorFill: "#ffffff",
      anchorSize: 8,
      ignoreStroke: true,
    })
    drawLayer.add(transformer)

    const instance = new AnnotationStage({
      konva,
      stage,
      drawLayer,
      transformer,
      image,
      naturalWidth,
      naturalHeight,
      options,
    })
    instance.scale = scale
    instance.bindEvents()
    return instance
  }

  setTool(tool: AnnotationTool): void {
    this.commitActiveText()
    this.tool = tool
    if (tool !== "select") {
      this.detachTransformer()
    }

    const selectable = tool === "select"
    for (const shape of this.shapes) {
      shape.draggable(selectable && !this.disabled)
    }
    this.stage.container().style.cursor = this.cursorForTool(tool)
    this.emitState()
  }

  setColor(color: string): void {
    this.color = color
    // If a shape is selected, recolor it so color can be changed after placing.
    const selected = this.transformer.nodes()
    if (selected.length === 0) {
      return
    }
    for (const node of selected) {
      this.applyColorToShape(node, color)
    }
    this.drawLayer.batchDraw()
  }

  private applyColorToShape(node: Konva.Node, color: string): void {
    if (node instanceof this.konva.Text) {
      node.fill(color)
      return
    }
    if (node instanceof this.konva.Arrow) {
      node.stroke(color)
      node.fill(color)
      return
    }
    if (node instanceof this.konva.Line) {
      node.stroke(color)
      return
    }
    if (node instanceof this.konva.Rect) {
      node.stroke(color)
      node.fill(withAlpha(color, 0.08))
    }
    // Blur (Image) regions and emoji glyphs have no author-set color.
  }

  setActiveEmoji(emoji: string): void {
    this.activeEmoji = emoji
  }

  setDisabled(disabled: boolean): void {
    this.disabled = disabled
    const selectable = this.tool === "select" && !disabled
    for (const shape of this.shapes) {
      shape.draggable(selectable)
    }
    this.stage.container().style.cursor = disabled
      ? "default"
      : this.cursorForTool(this.tool)
  }

  undo(): void {
    const shape = this.shapes.pop()
    if (!shape) {
      return
    }
    if (this.transformer.nodes().includes(shape)) {
      this.detachTransformer()
    }
    shape.destroy()
    this.drawLayer.batchDraw()
    this.emitState()
  }

  deleteSelected(): void {
    const nodes = this.transformer.nodes()
    if (nodes.length === 0) {
      return
    }
    this.detachTransformer()
    for (const node of nodes) {
      const index = this.shapes.indexOf(node as Konva.Shape)
      if (index >= 0) {
        this.shapes.splice(index, 1)
      }
      node.destroy()
    }
    this.drawLayer.batchDraw()
    this.emitState()
  }

  reset(): void {
    this.commitActiveText()
    this.detachTransformer()
    for (const shape of this.shapes) {
      shape.destroy()
    }
    this.shapes.length = 0
    this.drawLayer.batchDraw()
    this.emitState()
  }

  hasShapes(): boolean {
    return this.shapes.length > 0
  }

  resize(): void {
    const containerWidth = this.stage.container().clientWidth
    if (!containerWidth) {
      return
    }
    const scale = containerWidth / this.naturalWidth
    this.scale = scale
    this.stage.width(this.naturalWidth * scale)
    this.stage.height(this.naturalHeight * scale)
    this.stage.scale({ x: scale, y: scale })
    this.stage.batchDraw()
  }

  async exportBlob(): Promise<Blob | null> {
    this.commitActiveText()
    if (this.shapes.length === 0) {
      return null
    }

    this.detachTransformer()
    const canvas = this.stage.toCanvas({ pixelRatio: 1 / this.scale })
    return await canvasToBlob(canvas)
  }

  destroy(): void {
    this.removeActiveTextarea()
    this.stage.destroy()
  }

  private bindEvents(): void {
    this.stage.on("pointerdown", (event) => {
      this.handlePointerDown(event)
    })
    this.stage.on("pointermove", () => {
      this.handlePointerMove()
    })
    this.stage.on("pointerup", () => {
      this.handlePointerUp()
    })
  }

  private handlePointerDown(event: Konva.KonvaEventObject<PointerEvent>): void {
    if (this.disabled) {
      return
    }

    if (this.tool === "select") {
      this.handleSelectPointerDown(event)
      return
    }

    this.commitActiveText()
    this.detachTransformer()

    const pos = this.pointerPosition()
    if (!pos) {
      return
    }
    this.origin = pos

    switch (this.tool) {
      case "pen":
      case "highlight": {
        this.draftNode = this.createStroke(pos)
        this.drawLayer.add(this.draftNode)
        this.isDrawing = true
        break
      }
      case "rectangle":
      case "blur": {
        this.draftNode = this.createRectangle(pos)
        this.drawLayer.add(this.draftNode)
        this.isDrawing = true
        break
      }
      case "arrow": {
        this.draftNode = this.createArrow(pos)
        this.drawLayer.add(this.draftNode)
        this.isDrawing = true
        break
      }
      case "text": {
        this.beginTextEntry(pos)
        break
      }
      case "emoji": {
        this.placeEmoji(pos)
        break
      }
      default:
        break
    }
  }

  private handlePointerMove(): void {
    if (!(this.isDrawing && this.draftNode)) {
      return
    }
    const pos = this.pointerPosition()
    if (!pos) {
      return
    }

    if (this.tool === "pen" || this.tool === "highlight") {
      const line = this.draftNode as Konva.Line
      line.points([...line.points(), pos.x, pos.y])
    } else if (this.tool === "arrow") {
      const arrow = this.draftNode as Konva.Arrow
      arrow.points([this.origin.x, this.origin.y, pos.x, pos.y])
    } else {
      const rect = this.draftNode as Konva.Rect
      rect.setAttrs({
        x: Math.min(this.origin.x, pos.x),
        y: Math.min(this.origin.y, pos.y),
        width: Math.abs(pos.x - this.origin.x),
        height: Math.abs(pos.y - this.origin.y),
      })
    }
    this.drawLayer.batchDraw()
  }

  private handlePointerUp(): void {
    if (!(this.isDrawing && this.draftNode)) {
      return
    }
    this.isDrawing = false
    const draft = this.draftNode
    this.draftNode = null

    if (this.tool === "blur") {
      const rect = draft as Konva.Rect
      const box = {
        x: rect.x(),
        y: rect.y(),
        width: rect.width(),
        height: rect.height(),
      }
      rect.destroy()
      if (box.width < MIN_SHAPE_SIZE || box.height < MIN_SHAPE_SIZE) {
        this.drawLayer.batchDraw()
        return
      }
      const blurNode = this.createBlurRegion(box)
      this.commitShape(blurNode)
      return
    }

    if (this.tool === "rectangle") {
      const rect = draft as Konva.Rect
      if (rect.width() < MIN_SHAPE_SIZE || rect.height() < MIN_SHAPE_SIZE) {
        draft.destroy()
        this.drawLayer.batchDraw()
        return
      }
    }

    this.commitShape(draft)
  }

  private handleSelectPointerDown(
    event: Konva.KonvaEventObject<PointerEvent>
  ): void {
    const target = event.target
    if (target === this.stage || !this.shapes.includes(target as Konva.Shape)) {
      this.detachTransformer()
      this.emitState()
      return
    }

    // Text and emoji scale uniformly from the corners; boxes/lines are free.
    const isTextLike = target instanceof this.konva.Text
    this.transformer.keepRatio(isTextLike)
    this.transformer.enabledAnchors(
      isTextLike
        ? ["top-left", "top-right", "bottom-left", "bottom-right"]
        : [
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]
    )
    this.transformer.nodes([target])
    this.transformer.moveToTop()
    this.drawLayer.batchDraw()
    this.emitState()
  }

  private commitShape(shape: Konva.Shape): void {
    // Draft-based tools (pen/highlight/arrow/rectangle) already added their node
    // during pointerdown; text/emoji/blur create theirs here. add() is
    // idempotent for a node already on the layer, so this covers both.
    this.drawLayer.add(shape)
    shape.name("annotation")
    shape.draggable(this.tool === "select" && !this.disabled)
    shape.on("transformend", () => {
      this.normalizeScale(shape)
    })
    // Keep the transformer above committed shapes so its handles stay usable.
    this.transformer.moveToTop()
    this.shapes.push(shape)
    this.drawLayer.batchDraw()
    this.emitState()
  }

  private createStroke(pos: Konva.Vector2d): Konva.Line {
    const isHighlight = this.tool === "highlight"
    const strokeWidth = isHighlight
      ? Math.max(14, this.relativeSize(0.025))
      : Math.max(3, this.relativeSize(0.006))

    return new this.konva.Line({
      points: [pos.x, pos.y],
      stroke: this.color,
      strokeWidth,
      lineCap: "round",
      lineJoin: "round",
      opacity: isHighlight ? 0.35 : 1,
      tension: isHighlight ? 0 : 0.4,
      globalCompositeOperation: isHighlight ? "multiply" : "source-over",
    })
  }

  private createRectangle(pos: Konva.Vector2d): Konva.Rect {
    const isBlur = this.tool === "blur"
    return new this.konva.Rect({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      stroke: isBlur ? "rgba(37, 99, 235, 0.9)" : this.color,
      strokeWidth: Math.max(3, this.relativeSize(0.005)),
      dash: isBlur ? [6, 4] : undefined,
      fill: isBlur ? undefined : withAlpha(this.color, 0.08),
    })
  }

  private createArrow(pos: Konva.Vector2d): Konva.Arrow {
    const strokeWidth = Math.max(3, this.relativeSize(0.006))
    return new this.konva.Arrow({
      points: [pos.x, pos.y, pos.x, pos.y],
      stroke: this.color,
      fill: this.color,
      strokeWidth,
      pointerLength: strokeWidth * 3.2,
      pointerWidth: strokeWidth * 3,
      lineCap: "round",
      lineJoin: "round",
    })
  }

  private createBlurRegion(box: {
    x: number
    y: number
    width: number
    height: number
  }): Konva.Image {
    const node = new this.konva.Image({
      image: this.image,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      crop: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
    })
    node.filters([this.konva.Filters.Blur])
    node.blurRadius(Math.max(6, this.relativeSize(BLUR_RADIUS_RATIO)))
    node.cache()
    return node
  }

  private placeEmoji(pos: Konva.Vector2d): void {
    const emoji = this.activeEmoji
    if (!emoji) {
      return
    }
    const fontSize = Math.max(28, this.relativeSize(0.05))
    const text = new this.konva.Text({
      text: emoji,
      x: pos.x,
      y: pos.y,
      fontSize,
      offsetX: fontSize / 2,
      offsetY: fontSize / 2,
    })
    this.commitShape(text)
  }

  private beginTextEntry(pos: Konva.Vector2d): void {
    this.removeActiveTextarea()

    const fontSize = Math.max(16, this.relativeSize(0.03))
    const container = this.stage.container()
    const textarea = document.createElement("textarea")
    container.append(textarea)

    Object.assign(textarea.style, {
      position: "absolute",
      left: `${pos.x * this.scale}px`,
      top: `${pos.y * this.scale}px`,
      margin: "0",
      padding: "0",
      border: "1px dashed rgba(37, 99, 235, 0.9)",
      background: "transparent",
      caretColor: this.color,
      outline: "none",
      resize: "none",
      overflow: "hidden",
      lineHeight: "1.2",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: `${fontSize * this.scale}px`,
      color: this.color,
      minWidth: "40px",
      zIndex: "10",
    } satisfies Partial<CSSStyleDeclaration>)

    this.activeTextarea = textarea
    const capturedColor = this.color

    const commit = () => {
      const value = textarea.value.trim()
      this.removeActiveTextarea()
      if (!value) {
        return
      }
      const text = new this.konva.Text({
        text: value,
        x: pos.x,
        y: pos.y,
        fontSize,
        fill: capturedColor,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        lineHeight: 1.2,
      })
      this.commitShape(text)
    }

    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        commit()
      } else if (event.key === "Escape") {
        event.preventDefault()
        this.removeActiveTextarea()
      }
    })
    textarea.addEventListener("blur", () => {
      commit()
    })

    // Focus after the current event settles so the click that created it does
    // not immediately blur the textarea.
    window.setTimeout(() => {
      textarea.focus()
    }, 0)
  }

  private commitActiveText(): void {
    if (!this.activeTextarea) {
      return
    }
    // Trigger the blur handler to commit any pending text.
    this.activeTextarea.blur()
  }

  private removeActiveTextarea(): void {
    if (!this.activeTextarea) {
      return
    }
    const textarea = this.activeTextarea
    this.activeTextarea = null
    textarea.remove()
  }

  private normalizeScale(shape: Konva.Shape): void {
    // Bake the transformer's scale back into concrete dimensions so future
    // exports and edits stay in natural pixel space.
    const scaleX = shape.scaleX()
    const scaleY = shape.scaleY()
    if (scaleX === 1 && scaleY === 1) {
      return
    }

    if (shape instanceof this.konva.Text) {
      shape.fontSize(Math.max(1, shape.fontSize() * Math.max(scaleX, scaleY)))
      shape.scale({ x: 1, y: 1 })
    } else if (
      shape instanceof this.konva.Rect ||
      shape instanceof this.konva.Image
    ) {
      shape.width(Math.max(1, shape.width() * scaleX))
      shape.height(Math.max(1, shape.height() * scaleY))
      shape.scale({ x: 1, y: 1 })
      if (shape instanceof this.konva.Image) {
        shape.cache()
      }
    }
    this.drawLayer.batchDraw()
  }

  private detachTransformer(): void {
    if (this.transformer.nodes().length > 0) {
      this.transformer.nodes([])
      this.drawLayer.batchDraw()
    }
  }

  private pointerPosition(): Konva.Vector2d | null {
    return this.stage.getRelativePointerPosition()
  }

  private relativeSize(ratio: number): number {
    return Math.round(Math.min(this.naturalWidth, this.naturalHeight) * ratio)
  }

  private cursorForTool(tool: AnnotationTool): string {
    return tool === "select" ? "default" : "crosshair"
  }

  private emitState(): void {
    this.options.onStateChange({
      hasShapes: this.shapes.length > 0,
      hasSelection: this.transformer.nodes().length > 0,
    })
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = "async"
    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      reject(new Error("Failed to load screenshot for annotation."))
    }
    image.src = source
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export annotated screenshot."))
        return
      }
      resolve(blob)
    }, "image/png")
  })
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "")
  if (hex.length < 6) {
    return color
  }
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
