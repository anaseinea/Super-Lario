# 12 — Enemies

Depends on: 10 (movement/collisions use Phys + level world; enemies NEVER read
Input except Hopper/Floatoo chasing player x via Level-provided player pos).
Produces: `BROS.Enemies` factories in js/12-enemies.js. All enemies:
`{x,y,w,h,vx,vy,kind,dead,deadTimer,dir, state getters, stompable(),
sideKillable(), fireKillable(), onStomp(), onSideHit(shell-kick semantics),
onFireHit(), update(level)}`. Death = instant flip-fade (`deadTimer` 40f) or
squish-flat (pudge/hopper flat 30f) — Level removes them.

## Pudge (16x16 patrol, speed PUDGE_SPEED)
Tile wall -> flip dir. Walks off ledges (SMB tradition). Stomp -> squish flat +
die. Side -> damages player. Fireball -> flip death. Toffee side -> dies.
Score via Level combo system on any death cause.

## Tinshell (16x24 walker) / shell states
State machine: `walk -> still (stomped once; retracts; SHELL_REVIVE frames then
stand back up with blink) -> slide (kick/stomp-while-still/revive-fall)`.
Rules:
- Stomp moving shell: -> still, combo score. Player bounces.
- Side touch on still shell (player not stomping): kick -> slide (dir away from
  player) + `kick` sfx + SCORE? kick itself scores only via kills it causes.
- Stomp sliding shell: -> still. Side touch sliding shell: damages player.
- Sliding shell hits other enemies: kills them (combo chain via Level);
  hit a walking Tinshell -> converts it to sliding shell (chain continues).
- Slide flips dir at walls; stays slide until wall-hit limit? NO — keeps sliding
  (SMB), only wall hits flip dir; revive timer applies only to `still`.
- Fireball -> flip death. Toffee side on still/sliding -> kills.
Score table on kill: combo (see C.COMBO_VALUES) indexed by Level combo counter.

## Hopper (16x16)
Patrol at HOPPER_SPEED (turns at walls). Every HOPPER_WAIT frames (or when
player within 90px) performs hop: vy=-HOPPER_JUMP_VY, vx biased TOWARD player x
(0.55 dir). Lands -> normal. Stompable anytime (flat-squish, grants bounce, and
if stomped mid-air it just dies). Side -> damage. Fire/Toffee -> death.

## Floatoo (16x20 hover, no gravity)
Hover: y = spawnY + sin bob (FLOATOO_BOB_AMP, period frames); drifts toward
player at FLOATOO_SPEED (recompute dir every 60f; stops chasing if player
off-screen-left of camera view). NEVER flips for walls — instead dies if pushed
into solids? NO: reverses at solids but keeps vertical drift. Stomp -> `pop`
(+POP_BOUNCE, safe). Side touch -> damage. Fire/shell-slide/Toffee -> death.
NOT stomp-damaging — stomping always safe (balloons are a tool).

## Chomper (16x30, anchored in pipe mouth)
Oscillates: hidden fully inside pipe <-> raised CHOMPER_AMP px over
CHOMPER_PERIOD frames (sinusoidal rest cycle w/ pause at both ends). Hitbox
exists only while any part is above the pipe mouth. Overlap damages player
(ANY side incl. top — never stompable). Fireball/Toffee side? Toffee side KILLS
it (charge crush). Shell-slide kills it. Combo scores apply.

## Acceptance
- Node-able unit checks (pure update with fake world): Pudge flips at wall;
  shell state transitions per rules; Hopper hop triggers near player; Floatoo
  bob range; Chomper hidden span never damages (fake overlap test).
