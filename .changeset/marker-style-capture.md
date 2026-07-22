---
"@crikket-io/capture": minor
---

Add Marker.io-style instant screenshot capture. Clicking "Report Issue" now
shows a crosshair to drag-select a region of the page and captures it in-browser
via snapdom — no "share this tab" permission prompt. The annotation editor is
rebuilt on Konva with arrow, rectangle, pen, highlight, text, blur, emoji, and
move/resize tools. A new `screenshotMode` init option (`"dom"` default,
`"display"` to force the old screen-capture path) controls this; DOM capture
automatically falls back to screen capture when the page can't be rasterized.
