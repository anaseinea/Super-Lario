# SUPER GUMDROP BROS. — Build Plan

Browser-buildable, dependency-free, 100% original homage to classic side-scrolling
platformers. Hero: **Gumdrop**, a candy guy in Sugar Meadows. All code, art, audio,
and level design are authored from scratch in this repository (no external assets,
no libraries, no build step).

## How to use these plan files (isolation protocol)

- Each numbered file is one **self-contained work step**. It defines: inputs,
  outputs, public interface (exact names), acceptance criteria, and which step
  it depends on. A step can be implemented/tested in isolation as long as the
  interfaces of the steps it depends on are honored.
- Steps map 1:1 to source files (table below). Every source file starts with a
  header comment naming its plan step.
- Files 02, 03, 09, 10 (constants/utils/tiles/levels) must stay **DOM-free** so
  they can be tested in plain Node.
- Contract rule: nothing may reach into another module's internals. The only
  shared surface is `window.BROS.<ComponentName>` (see 02-scaffold.md).

## Step index

| # | Plan file | Source file(s) | Depends on |
|---|-----------|----------------|----------|
| 01 | 01-overview.md | — | — |
| 02 | 02-scaffold.md | index.html, css/game.css, js/01-namespace.js | 01 |
| 03 | 03-constants-and-utils.md | js/02-constants.js, js/03-utils.js | 02 |
| 04 | 04-input-system.md | js/04-input.js | 02 |
| 05 | 05-font-and-text.md | js/05-font.js | 02 |
| 06 | 06-sprites-system.md | js/06-sprites.js | 02, 03 |
| 07 | 07-audio-system.md | js/07-audio.js | 02, 03 |
| 08 | 08-tiles-and-level-format.md | js/09-tiles.js | 03 |
| 09 | 09-level-design.md | js/10-levels.js (via tools/genmaps.mjs) | 08 |
| 10 | 10-physics-and-camera.md | js/08-physics.js, js/14-level.js (camera) | 03, 08 |
| 11 | 11-player-state-machine.md | js/13-player.js | 10, 04 |
| 12 | 12-enemies.md | js/12-enemies.js | 10 |
| 13 | 13-items-blocks-effects.md | js/11-objects.js | 10 |
| 14 | 14-game-state-manager.md | js/16-game.js | 11–13 |
| 15 | 15-hud-and-screens.md | js/15-hud.js | 05, 06, 14 |
| 16 | 16-juice-and-polish.md | cross-cutting (07, 12, 13, 14) | 11–13 |
| 17 | 18-visual-2-5d.md | js/17-render25d.js, vendor/three.min.js (npm `three`) | 02, 06, 14, 15 |
| 17 | 17-testing-and-tuning.md | tools/validate-levels.mjs | all |

## Signature twists that make this OUR game (not a clone)

- **Bubble power-up** — encases Gumdrop in a bubble: floaty low gravity, survives
  one hit, timed (~8s).
- **Toffee power-up** — charge form: immune to side contact (enemies die on touch),
  bigger stomp bounce, smashes bricks by landing on them, timed (~8s).
- **Enemies with personality**: Pudge (stomp blob), Tinshell (kickable-shell bug),
  Hopper (jumps at you), Floatoo (balloon floater that chases), Chomper (pipe plant).
- **Level gimmicks**: candy trampoline pads, spike tiles, 3 themed levels
  (Sugar Meadows / Candy Mine / Peppermint Dusk), flagpole = candy-cane pole into
  the Gingerbread Keep.
