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

Background music is switched off by default — `js/02-constants.js` carries
`MUSIC: false`, which short-circuits `BROS.Audio.playMusic` (every call site —
title, card, level tracks, clear, game-over). SFX and the M key still work.
Flip the flag to `true` to bring the synthesized 8-bit BGM back.
level tracks, clear, game-over). SFX and the M key still work. Flip the flag to
`true` to bring the synthesized 8-bit BGM back.

Touch devices: when the media query `pointer: coarse` matches (phones/tablets)
a fixed on-screen pad appears — d-pad ◀ ▼ ▶ in the bottom-left corner, B (run)
and A (jump) in the bottom-right, sized in viewport units and translucent. The
A button also confirms in menus (SMB-style: tap A on the title to start). Built
by `BROS.Input.buildTouch`, styled in `css/game.css`.

### Secret: stage select

On the title screen, tap the warp code — **RIGHT RIGHT DOWN DOWN LEFT RIGHT
RUN RUN** (keyboard arrows + X/Shift, or on the touch pad: ▶ ▶ ▼ ▼ ◀ ▶ B B).
A gate jingle opens a hidden "SELECT YOUR STAGE" menu: ◀ ▶ move a blinking
cursor across all twelve stages, Enter/A starts a fresh run from there, and
progression continues normally from that stage.

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
js/01…16            the game: one classic-script module per plan step (01–16)
docs/plan/          build plan + 17 step contracts
tools/              Node test/validation harnesses (never shipped to browser)
```
