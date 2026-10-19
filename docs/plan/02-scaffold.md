# 02 — Project Scaffold, Script Order, Conventions

Depends on: 01. Produces: `index.html`, `css/game.css`, `js/01-namespace.js`.
Consumed by: everything.

## Directory layout
```
index.html
css/game.css
js/01-namespace.js  02-constants.js  03-utils.js  04-input.js  05-font.js
   06-sprites.js  07-audio.js  08-physics.js  09-tiles.js  10-levels.js
   11-objects.js  12-enemies.js  13-player.js  14-level.js  15-hud.js  16-game.js
tools/genmaps.mjs      (dev-only: generates level map strings -> js/10-levels.js)
tools/validate-levels.mjs
docs/plan/*.md
README.md
```

## index.html contract
- `<canvas id="screen" width="256" height="240">`, `<div id="touch">` for the
  on-screen buttons (built by 04-input), `<div id="hint">` static help text.
- Classic `<script src>` tags loaded **exactly in numeric order** (16 files),
  then a final inline `window.addEventListener('load', () => BROS.Game.boot())`.
- Classic scripts (NOT ES modules) so the game runs from `file://` too.

## css/game.css contract
- Dark page background, centered canvas, `image-rendering: pixelated` on canvas.
- Canvas size set in CSS px by `Game.resize()` to integer multiples of 256x240.
- Touch buttons styled as translucent squares, shown only for coarse pointers
  via `@media (pointer: coarse)`. No web fonts required for the game itself.

## js/01-namespace.js contract (entire file is trivial)
```js
window.BROS = window.BROS || { _loaded: {} };
```
Every other file: `(function(){ 'use strict'; const BROS = window.BROS; … BROS.X = …; })();`
— IIFE so top-level consts never collide across files. Each file begins with a
`// PLAN: docs/plan/NN-….md` header comment.

## Conventions
- ES2017 max (no optional chaining `?.`, no `#private`). `const/let`, classes,
  arrow functions OK.
- No DOM access in 02, 03, 09, 10 (Node-testable). DOM in 04, 05(cache), 06, 07,
  14–16.
- All timing/physics units are **pixels & 60Hz frames**; constants live in
  `BROS.C` only — magic numbers outside 02-constants.js are forbidden.
- Verification: `node --check js/*.js` after every edit.

## Acceptance
- Game shell boots showing a black canvas without errors (before other modules
  exist — boot guarded until Game exists is OK).
- `file://` open works (manual check). Script order matches list above.
