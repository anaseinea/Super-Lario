# SUPER GUMDROP BROS.

A dependency-free, single-page browser platformer — 100% original homage.
Hero: **Gumdrop**, a candy guy racing through Sugar Meadows, the Candy Mine
and Peppermint Dusk. All code, art, audio and level design are authored from
scratch in this repository: no external assets, no libraries, no build step.

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
`BROS.Game.boot()`, which fits the 256×240 canvas to the window at integer
scale and wires keyboard + on-screen touch controls.

## Controls

| Action        | Keys                          |
|---------------|-------------------------------|
| Move / crouch | Arrow Left/Right/Down (or A/D/S) |
| Jump          | Space, Z, W, ArrowUp          |
| Run / fire Ember balls (hold while charged) | X, Shift |
| Start (menus, skip tally) | Enter |
| Pause (mid-level, P toggles) | P |
| Mute music/SFX | M |

Touch devices: on-screen control pad is built into `#touch` by `BROS.Input.buildTouch`.

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
