# 05 — Bitmap Font & Text Rendering

Depends on: 02. Produces: `BROS.Font`. Consumed by: 15 (HUD/screens), 11/12/13
(score popups via Level).

## Design
A 5x7 pixel bitmap font authored in code (fully original). Uppercase only —
classic console style. Glyph advance 6px (5 + 1 gutter). Height 7px.

## Public API
```
BROS.Font.drawText(ctx, text, x, y, opts)  // opts: {color='#fff', scale=1}
BROS.Font.width(text, scale=1)
BROS.Font.hasChar(ch)
```
- `x,y` = top-left of the 7px-tall text box. Draws 1px rects (scaled to `scale`
  px blocks). Unknown chars render as a hollow box glyph.
- Text is written uppercase internally (`text.toUpperCase()`).

## Required charset
`A–Z 0–9 space . , ! ? : - ' / ( ) x` where `x` renders as a small multiply
cross (used by HUD "x03" counters). Anything missing from a screen's copy is a
plan bug — screens may only use this charset (enforced by 15's acceptance).

## Acceptance
- `width('MARIO',1)` = 5*6-1 = 29. `hasChar('x')` true, `hasChar('a')` true
  (case-folded). Rendering 'AB' at scale 2 covers exactly 22x14 px.
