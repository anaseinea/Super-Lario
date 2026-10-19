# 15 — HUD & Screens (Font + Sprites only)

Depends on: 05, 06, 14 (hudData). Produces: `BROS.HUD` + `BROS.Screens`
(js/15-hud.js). Consumed by 14/16 draw pass. ALL text via BROS.Font (charset per
05). All colors theme-aware where noted.

## In-play HUD (fixed screen-space row, y0..14, drawn OVER level)
- `MARIO` label at (16,2); score text right-aligned width 7 digits at (46,2).
- bonbon icon sprite at (88,0) + `x` + 3-digit coins at (104,2).
- `WORLD` + level name at (140,2). `TIME` + 3-digit time left at (184,2);
  red when <= HURRY_AT. Lives: `x` + digits at (226,2)? Format: `GUM x3` at
  (214,2). Layout constants in 15 file (screen coordinates, not C).
- Combo/score popups drawn by Level (13) NOT HUD.

## Screens (title / card / pause / clearcard / gameover / allclear)
- title: sky + ground strip; logo `SUPER GUMDROP` scale 2 centered y56, `BROS.`
  y80; blinking `PRESS ENTER` y130 (toggle 30f); controls block y160-200:
  `ARROWS MOVE  SPACE JUMP  X RUN/FIRE`, `P PAUSE  M MUTE`, item legend:
  `JELLY GROWS YOU  EMBER SPITS FIRE`, `TOFFEE CHARGE  BUBBLE FLOAT GUARD`;
  bottom: `ALL CODE ART AUDIO ORIGINAL` + `ENTER TO BEGIN` credits y222.
- card: black bg, `WORLD 1-1` centered scale 2, `x LIVES…` line? SMB-style:
  name + tiny `GET READY`? Use: name scale 2 y112, `GO!` y140 after 40f.
- pause: dim overlay rgba(0,0,0,0.45) + `PAUSED` centered scale 2.
- clearcard: level name `CLEAR!` + tally ticking HUD + `PRESS ENTER` when done.
- gameover: black, `GAME OVER` scale 2 centered, final score line, `ENTER` retry.
- allclear: `ALL CLEAR!` scale 2, `FINAL SCORE` + number, credit lines
  `THANKS FOR PLAYING` + `MADE BY: THIS ONE FILE REPO`, ENTER returns title.

## Draw rules
- HUD/screens never draw level sprites; Level draws level first, Game draws HUD/
  screens above (z-order in 14). Screen text must pass charset check (`Font.hasChar`).

## Acceptance
- `HUD.draw(ctx, level.hudData())` renders every element on 256x240 within
  bounds (no overflow > 256). Every screen copy string pre-validated against
  charset at build (assert loop). Title fits 256x240 with 4px margins.
