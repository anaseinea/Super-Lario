# 11 — Player State Machine (Gumdrop)

Depends on: 04, 10 (uses 03 constants). Produces: `BROS.Player` (js/13-player.js).
Consumed by 14. Player talks to Level ONLY via provided callbacks
(`level.onHeadBump(cells)`, `level.onLandTrampolined()`, etc.) — never touches
enemy lists directly; Level mediates player<->world overlaps (step 14).

## Forms (state `power`: 'small'|'big'|'flame' + timed flags `toffeeFrames`,
`bubbleFrames` counters; form priority for visuals: bubble overlay > toffee tint >
flame > big > small)
- small: hitbox SMALL_W x SMALL_H, jump vy JUMP_SMALL.
- big/flame: hitbox BIG_W x BIG_H; sprite anchor: feet-aligned; crouch (power!=
  small && down held): hitbox CROUCH_H, no run accel, skid allowed.
- flame: may fire when grounded? NO — fires freely (max FIRE_MAX_PROJECTILES
  alive on screen, cooldown FIRE_COOLDOWN frames, press 'run' to fire).
- bubble (timed BUBBLE_FRAMES): gravity*mul + max fall override; while bubble
  active side-contact death -> pops bubble instead (consume + INVULN_HITS frames
  + `popbubble` sfx); bubble does NOT protect pits.
- toffee (timed TOFFEE_FRAMES): gravity/max-fall override; side contact KILLS
  enemies instead (Level checks `player.toffeeKillSide()`); stomp bounce uses
  TOFFEE_BOUNCE; landing ON a brick tile (landed on brick top) -> Level smashes
  it (`level.smashTileUnderFeet()`); head bumps also break bricks regardless of
  size while toffee.

## Controls feel
- Accel/friction per C table; skid: holding opposite dir on ground with speed>
  1.2 -> face flips instantly + `skid` pose (no turn-around teleport).
- Jump: press sets vy=-JUMP* (power size); variable height via GRAVITY_HOLD while
  rising && held, release -> vy clamped to -JUMP_CUT. JUMP_BUFFER jump press
  within buffered frames of landing re-triggers jump. COYOTE frames after leaving
  ground still allow jump. One jump per press unless buffered (no mid-air re-jump).
- Death conditions: fall below level bottom (y > rows*TILE+32) OR damage while
  small&no-bubble -> dying state (controls locked, DEATH_PAUSE then DEATH_LAUNCH
  upward, fall off-screen; Level notifies Game via `level.playerDied()`).
- Damage from enemies/spikes handled by Level calling `player.hurt()` -> returns
  'bubble'|'shrink'|'die'; player applies + invuln blink INVULN_HITS (overlap
  checks skip player while invuln>40; sprite blinks every 4 frames).

## States: `normal | crouch | dying | flag (handled by Level takeover) | victory`
Flag/victory: Level sets `player.takeControl(false)`, poses only.

## HUD-visible fields (read-only getters): x,y,w,h,vx,vy,power,activeForm(),
onGround, facing, scorePopupRequest handled by Level popup API.

## Acceptance
- Hold-jump reaches ~3+ tiles; tap-jump ~1.5 tiles; run-jump clears 5-tile gap.
- Buffer test: press jump 5 frames before landing -> jump on landing frame.
- Bubble hit consumes bubble not life; toffee side-touch kills Pudge (via Level).
