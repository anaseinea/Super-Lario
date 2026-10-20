# SUPER GUMDROP BROS.

A dependency-free, single-page browser platformer — 100% original homage.
Hero: **Gumdrop**, a candy guy racing through 12 hand-authored levels across
four worlds — Sugar Meadows, the Candy Mine, Peppermint Dusk and the Marzipan
highlands. All code,
art, audio and level design are authored from scratch in this repository:
no external assets, no libraries, no build step.

See `docs/plan/README.md` for the build plan and `docs/plan/NN-*.md` for the
step contracts each source file implements.

## Run the game

Open `index.html` directly in any modern desktop browser (double-click works —
there is no server or build step):

```text
start index.html            (Windows)
open index.html             (macOS)
```

Or serve the folder statically if you prefer:

```bash
python -m http.server 8000   # then open http://localhost:8000/
```

The game boots itself: `index.html` loads `js/01 … js/16` in order and calls
`BROS.Game.boot()`, which resizes the canvas to fill the window edge-to-edge:
wide screens widen the VIEW (more world columns on screen, HUD re-anchored to
the right edge), narrow/portrait screens scale the base 256×240 view to the
full window width with letterbox bands — pixels never crop, and phone players
always get the full width.

## Controls

| Action        | Keys                          |
|---------------|-------------------------------|
| Move / crouch | Arrow Left/Right/Down (or A/D/S) |
| Jump          | Space, Z, W, ArrowUp          |
| Run / fire Ember balls (hold while charged) | X, Shift |
| Start (menus, skip tally) | Enter |
| Pause (mid-level, P toggles) | P |
| Mute music/SFX | M |
| Toggle 2.5D POP visuals | V |

Background music is switched off by default — `js/02-constants.js` carries
`MUSIC: false`, which short-circuits `BROS.Audio.playMusic` (every call site —
title, card, level tracks, clear, game-over). SFX and the M key still work.
Flip the flag to `true` to bring the synthesized 8-bit BGM back.
level tracks, clear, game-over). SFX and the M key still work. Flip the flag to
`true` to bring the synthesized 8-bit BGM back.

Touch devices: when the media query `pointer: coarse` matches (phones/tablets)
a fixed on-screen pad appears — d-pad ◀ ▼ ▶ in the bottom-left corner, B (run)
and A (jump) in the bottom-right (these two are sized up and spaced wider apart
so thumbs can't brush both at once), all sized in viewport units and
translucent. A round **2.5D** chip floats centered just above both pads: tap it
to flip between the flat and POP visual modes (it re-labels itself `2D` while
in POP mode; it is a pure render switch — it never feeds the game input). The
A button also confirms in menus (SMB-style: tap A on the title to start). Built
by `BROS.Input.buildTouch`, styled in `css/game.css`.

### Secret: stage select

On the title screen, tap the warp code — **RIGHT RIGHT DOWN DOWN LEFT RIGHT
RUN RUN** (keyboard arrows + X/Shift, or on the touch pad: ▶ ▶ ▼ ▼ ◀ ▶ B B).
A gate jingle opens a hidden "SELECT YOUR STAGE" menu: ◀ ▶ move a blinking
cursor across all twelve stages, Enter/A starts a fresh run from there, and
progression continues normally from that stage.

### 2.5D "POP" render mode (optional)

`js/17-render25d.js` adds a switchable second visual mode. Press **V** any time
(mid-game included) to flip between the classic pixel canvas and the 2.5D POP
mode; append **`?pop=1`** to the URL to boot straight into it, or tap the round
**2.5D** chip on the touch pad (phones have no V key — those are the mobile
entry points). POP mode keeps the exact same simulation, sprite art, levels and
HUD — it replays the Level draw ops as textured quads in a three.js perspective
scene, and gets its own art direction rather than a flat re-dress: the sky is a
vertical gradient (deeper at the top, hazed toward the horizon), tiles extrude
into prisms whose true silhouette edges gain shaded side faces (interior faces
are culled from the recorded tile grid, so rows read as solid blocks), entities
pop toward a slower, softer camera sway, and a gentle vignette frames the world
under the pixel-crisp HUD. Decor sits on a pushed-back parallax plane, sprites
billboard toward a camera that aims at Gumdrop, and full-view washes (blackouts,
fades) replay on the 2D overlay. Painter order is preserved with `renderOrder` +
no depth test, so z-ordering logic never changed.

The flat default remains dependency-free. POP mode uses exactly one vendored
library: `vendor/three.min.js` (three.js r149 UMD build, taken from the npm
`three` package: `npm i three@0.149.0` → copy `build/three.min.js`; MIT). If
that file is missing the game just stays in flat mode — nothing crashes. See
`docs/plan/18-visual-2-5d.md` for the mode's contract and knobs (`BROS.C.R3D`).

## Test suite (all must pass)

Syntax-check every source file, then run the Node self-tests (no browser needed
— game cores are DOM-free; canvas-dependent tests use the fake-browser harness
in `tools/fakecanvas.mjs`):

```bash
for f in js/*.js; do node --check "$f"; done

node tools/validate-levels.mjs    # level-map validation + physics spot-checks
node tools/test-tiles.mjs
node tools/test-sprites.mjs
node tools/test-audio.mjs
node tools/test-physics.mjs
node tools/test-objects.mjs
node tools/test-enemies.mjs
node tools/test-player.mjs
node tools/test-level.mjs
node tools/test-hud.mjs           # HUD + title/card/clear/gameover screens
node tools/test-game.mjs          # full state-machine flow, headless
```

One-liner for the whole suite:

```bash
for t in tools/test-*.mjs tools/validate-levels.mjs; do node "$t" >/dev/null 2>&1 && echo "PASS ${t}" || echo "FAIL ${t}"; done
```

Every test prints `N passed, 0 failed` and exits 0 on success.

## Generation tools (used at build time, kept for reference)

```bash
node tools/genmaps.mjs            # deterministic generated LEVELS (js/10-levels.js)
node tools/dump-sprite.mjs        # print an ASCII dump of any sprite frame
```

## Debug hooks

`BROS.DEBUG.grantCoins(n)` injects bonbon count (cheat-test for the 100-bonbon
1UP); exposed through the Game instance for console users only.

## Layout

```text
index.html          boot page (canvas #screen, touch pad #touch, script order)
css/game.css        page styling (canvas smoothing off, pixel-crisp)
js/01…17            the game: one classic-script module per plan step (01–17; 17 = POP mode)
vendor/three.min.js the one shipped external: three.js r149 UMD, only used by POP mode
docs/plan/          build plan + 18 step contracts
tools/              Node test/validation harnesses (never shipped to browser)
```
