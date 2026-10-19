# 01 — Overview, Vision, Scope

Depends on: nothing. Consumed by: every other step.

## Vision
A single-screen-camera, tile-based, 2D side-scrolling platformer in the spirit of
classic 8-bit platformers, playable in any modern browser from a static folder.
16px tiles, 256x240 internal resolution integer-scaled to the window, fixed 60Hz
simulation, keyboard + touch controls.

## Pillars
1. **Zero dependencies, zero build step.** Plain `<script>` tags, classic scripts
   (works from `file://`), ES2017 syntax only. Canvas2D + WebAudio only.
2. **Total originality.** Art = procedurally built pixel canvases in code.
   Audio = synthesized SFX + original composed chiptune loops. Levels = our data.
   Names/IP = original (Gumdrop, Sugar Meadows, Pudge, Tinshell…).
3. **Faithful *feel*, original *content*.** Physics, jump arcs, stomp/kick
   interactions, block bumps, flagpole finale — recreated from first-principles
   tuning — but power-ups, enemies, gimmicks, levels, art and music are ours.
4. **Modular plan.** Each plan step maps to one source file and can be worked on
   in isolation behind its interface (see plan README isolation protocol).

## Scope (v1.0)
IN: 3 levels (day/cave/dusk themes), lives system, score/combos, small→big(Jelly)
→flame(Ember) tiers + timed Bubble/Toffee forms, 5 enemy families, pipes & plants,
trampolines, spikes, bonbons, question/brick/used blocks, flagpole + Keep finale,
time tally, HUD, title/pause/game-over/level-clear/all-clear screens, keyboard +
touch input, chiptune music (3 loops + jingles), screen shake, particles,
score popups, 1-ups at 100 bonbons.
OUT (v1.0): multiplayer, world map, warp pipes, secret areas, save states,
moving platforms, level editor UI, gamepad. Stretch ideas recorded in 17.

## Global technical decisions
- Internal render size **256x240** (16x15 tiles). Integer CSS scaling only.
- Fixed timestep **60 Hz** with accumulator; one `update()` + one `draw()` per tick.
- Tile legend and level format defined in step 08; level data in step 09.
- Namespace: every module exposes `window.BROS.<Name>`; nothing else is global.
- Collision: axis-separated AABB vs stamped solid tile grid (pipes stamp into grid).

## Acceptance (whole game)
- Opens with just `index.html` (double-click OK). No console errors.
- All 3 levels completable; all mechanics in Scope demonstrable in ~10 minutes.
- `node tools/validate-levels.mjs` passes; `node --check` passes on every js file.
