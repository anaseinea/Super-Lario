# 13 — Items, Blocks, Collectibles, FX Entities

Depends on: 10. Produces: `BROS.Objects` factories in js/11-objects.js:
items, bonbon entities, bumps/coin-pop/debris/score-popup FX, fireballs.
All are plain entities updated by Level with physics via Phys (fireballs bounce
on tiles), no input.

## Blocks runtime behavior (Level executes, FX entities visualize)
- Head bump on `?/J/E/R/O` (Q-blocks): -> `used` tile; pop effect entity spawns:
  - bonbon: coin_pop rises 48px over 24f, spins, vanishes; Level awards
    SCORE_COIN + bonbon count.
  - jelly: Jumbo Jelly item emerges (slides up 16px over 24f from block then
    starts walking left dir, gravity applies, walks off ledges, speed 0.7,
    flips at walls). Collect: power small->big (`grow` sfx) else +1000 score.
  - ember: Ember Berry item: STATIC on top of block (no gravity motion until
    touched; wiggles in place), collect: power -> flame (`powerup` sfx). If
    already flame: +1000.
  - toffee: same emergence+walk as jelly; collect: starts TOFFEE_FRAMES timer
    (`toffee` sfx). Already toffee: refreshes timer +1000? refresh + 500.
  - bubble: emerges, floats UP slowly (vy=-0.35, no gravity, dies off top edge)
    w/ slight sine drift; collect: BUBBLE_FRAMES (`bubble` sfx). Already bubble:
    refresh +500.
- Head bump on `B` brick: if power big/flame or toffee -> SMASH: tile cleared,
  2x debris shards spawn (Phys-driven, vx ±1.6/±0.9, vy -4/-6 pop), SCORE_BRICK,
  `break` sfx, camera shake 6. Else: bump only (`bump` sfx).
- Head bump on `X/G/used`: bump-only animation (no score) `bump`.
- Bump animation: tile visual offset parabola (peak 8px) over 14f — stored in
  Level bump list keyed by cell; collision itself is UNCHANGED during animation.
- Toffee feet-smash (from 11): same as head-bump smash but `landType` brick.
- `trampoline` tile: player landing on top -> Level calls
  `player.launchTrampoline(TRAMPOLINE_VY)` (`boing`, squash handled by pose
  selection; no tile anim) ; enemies landing on tramp get vy=-TRAMPOLINE_VY*0.6.
- `spike` cell: any player overlap (1px inset) -> `player.hurt()` (cooldown:
  after hurt, ignore spike overlap for 30f); `spike` sfx on hurt. Enemies ignore.
- `bonbon` collectible: static spinning sprite in cell; AABB overlap with player
  -> collect (same award path as coin-pop), entity removed.

## Fireball entity (flame form)
8x8, vx=FIREBALL_SPEED*faceDir, gravity FIREBALL_GRAV, bounces on land to
FIREBALL_BOUNCE, dies on wall touch / FIREBALL_LIFE expiry / bounce count > 6;
kills enemies on overlap (`fireKillable` ones; not Chomper? Chomper IS
fireKillable per 12); spin animation fireball1/2.

## Score popups & 1-ups
`scorePopup(text,x,y)` entity: rises 40px over 50f then vanishes; drawn with
Font (uppercase). 1UP popup uses `1UP` text + `1up` sfx; Level adds life.

## Acceptance
- Fake-world tests: brick smash clears tile + spawns 2 debris that fall off-map
  and despawn; Q-block becomes used; jelly emerges then walks left; bubble item
  never falls; fireball bounces then dies after bounce cap.
