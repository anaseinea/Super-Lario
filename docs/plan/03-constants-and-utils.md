# 03 — Constants & Shared Utilities

Depends on: 02. Produces: `BROS.C`, `BROS.U`. Consumed by: 04–16.
Node-testable (DOM-free).

## BROS.C — the ONLY tuning surface (all values in px / 60Hz frames)

World/render:
- TILE 16, ROWS 15, VIEW_W 256, VIEW_H 240, FPS 60
- LIVES_START 3, BONUS_LIFE_AT 100 (bonbons), LEVEL_TIME 300 (game-seconds),
  TIME_UNIT_FRAMES 30 (1 game-second = 30 frames), HURRY_AT 100

Physics core:
- GRAVITY 0.55, GRAVITY_HOLD 0.34 (while rising & jump held), MAX_FALL 9
- WALK_MAX 2.3, RUN_MAX 3.4, GROUND_ACCEL 0.12, AIR_ACCEL 0.1
- GROUND_FRICTION 0.17, AIR_DRAG 0.03
- JUMP_SMALL 7.2, JUMP_BIG 7.5, JUMP_CUT 2.3 (release sets vy >= -JUMP_CUT),
  JUMP_BUFFER 8 (frames), COYOTE 6 (frames)

Forms (multipliers/overrides; details in steps 11–13):
- BIG_W 12, BIG_H 30, SMALL_W 11, SMALL_H 16, CROUCH_H 16
- BUBBLE_GRAV_MUL 0.52, BUBBLE_MAX_FALL 4.6, BUBBLE_FRAMES 480
- TOFFEE_GRAV_MUL 1.8, TOFFEE_MAX_FALL 12.5, TOFFEE_FRAMES 480,
  TOFFEE_BOUNCE 8.6, TOFFEE_KILL_SIDE true
- FIRE_MAX_PROJECTILES 2, FIRE_COOLDOWN 14, FIREBALL_SPEED 5, FIREBALL_GRAV 0.4,
  FIREBALL_BOUNCE 5.6, FIREBALL_LIFE 180

Enemies (details in 12):
- PUDGE_SPEED 0.72, SHELL_SPEED_WALK 0.55, SHELL_SLIDE 4.2, SHELL_REVIVE 480,
  SHELL_REVIVE_BLINK 180, HOPPER_SPEED 0.55, HOPPER_JUMP_VY 5.6,
  HOPPER_WAIT 60, FLOATOO_SPEED 0.6, FLOATOO_BOB_AMP 10, FLOATOO_BOB_PERIOD 96,
  CHOMPER_AMP 26, CHOMPER_PERIOD 140, ENEMY_KB (knockback on wall) 0
- TRAMPOLINE_VY 11.2, HOPPER_BOUNCE (player stomp on hopper mid-jump) allowed

Combos & scoring (details in 12/13):
- COMBO_WINDOW 45, COMBO_VALUES [100,200,400,800,1000,2000,4000,8000],
  COMBO_1UP_EVERY 8 (kills) -> 1UP popup
- SCORE_COIN 200, SCORE_BRICK 50, SCORE_FIREBALL 200, SCORE_FLAG [100,400,800,
  2000,4000,8000] (band index from pole-grab height), TALLY_RATE 50 (pts per
  remaining game-second), TIME_FLAG_BONUS 50 per 10 remaining
- INVULN_HITS 120 (frames after damage), STOMP_BOUNCE 6.6, STOMP_BOUNCE_HELD 8.2,
  POP_BOUNCE (Floatoo) 5.2
- DEATH_PAUSE 30, DEATH_LAUNCH 6.4, FLAG_SLIDE_SPEED 2.4, FLAG_WALK_SPEED 1.6

## BROS.U — utility API
- `clamp(v,a,b)`, `sign(v)`, `approach(v,target,step)`
- `aabb(a,b)` rect overlap for {x,y,w,h} (x,y = top-left)
- `randRange(rng,a,b)`, `mulberry32(seed)` deterministic RNG factory
- `hsl(h,s,l)` css string helper, `lerp(a,b,t)`
- `dist2(ax,ay,bx,by)`

## Acceptance
- `node -e` load of 01+02+03 succeeds; `U.approach(U.clamp(...)` spot checks.
- No file other than 02-constants.js defines gameplay numbers.
