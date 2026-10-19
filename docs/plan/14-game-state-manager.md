# 14 — Game State Manager & Level Runtime

Depends on: 11, 12, 13 (owns their entities), 08/09 (level data). Produces:
`BROS.Level` (js/14-level.js) + `BROS.Game` (js/16-game.js).

## BROS.Level — one per level attempt
Owns: parsed level (08), player (11), enemies (12), objects (13), camera (10).
Public contract used by Game/HUD:
```
new BROS.Level(def, gameState)   // gameState: {score, coins, lives, totalCoins?}
level.update() / level.draw(ctx)
level.finished -> null | 'dead' | 'complete'   // polled by Game after update
level.hudData() -> {score, coins, lives, timeLeft, worldName, hurry}
level.tally() -> completes time->score conversion (called by Game post-flag)
level.flagPhase -> 'grab'|'slide'|'hop'|'walk'|'enter'|'done' (for draw/anim)
```
Update order per frame (STRICT): Input already updated by Game -> camera follow
-> player update (with level callbacks) -> enemies update (cull beyond camX-48
left or level right+80) -> items/fireballs/particles/popups -> tile bumps tick
-> player-vs-enemy resolution -> player-vs-items -> fireball-vs-enemy ->
shell-vs-enemy -> bonbons/spikes/pits -> flag sequence state machine -> death
handling.
- Stomp test: `vy>0.5` && player.bottom within [enemy.top, enemy.top+12] &&
  horizontal overlap -> stomp path; else side path (respect bubble/toffee/invuln
  rules from 11/12/13). Combo counter increments on any enemy kill while
  COMBO_WINDOW active (frames), resets after.
- Flag sequence (candy cane pole): crossing `poleCol` midline while alive ->
  grab (score by poleTopRow band per C.SCORE_FLAG, `flag` sfx, music stops),
  slide down pole at FLAG_SLIDE_SPEED, flag sprite slides up pole (40f), hop
  pose 20f on ground, auto-walk right FLAG_WALK_SPEED to keepTargetX (`enter`:
  fade-walk into Keep door, player hidden), 60f blackout -> `finished:'complete'`
  (Game runs tally + next).
- Death: `playerDied()` -> Level sets death animation ownership (freeze world,
  launch player, 140f total) -> `finished:'dead'`. Time hits 0 -> instant death.

## BROS.Game — screens & glue (frame loop, accumulator fixed step)
States + transitions:
```
boot -> title --start--> card(level i) --auto 90f / start--> play
play --finished:'dead'--> lives--; lives>0 ? card(same) : gameover
play --finished:'complete'--> tally (auto ~ until timeLeft==0 or start-skip)
   -> clearcard ("COURSE CLEAR") --start--> next card OR allclear (if last)
allclear --start--> title   gameover --start--> title (reset lives/score)
pause toggles anytime in play/card/tally (overlay, updates halt, music keeps).
```
- On every state entry: `Input.clear()` + 30f menu lockout before consume.
- Score/coins/lives live ONLY in Game state object (Level reads/writes via
  hudData refs). 100-bonbon -> +1 life (`1up`), coins modulo display.
- Music selection: theme->loop map; clear card plays `clear`, gameover plays
  `gameover`, card entry plays `card`. Tally: tick sfx per 4 units (max 20/s).
- Boot wiring: resize handler, first-gesture `Audio.ensure()`, canvas ctx
  imageSmoothingEnabled=false, load order per 02.
- `Game.resize()`: integer scale = floor(min(innerW/256, innerH/240)) clamp >=1,
  sets canvas style px size.

## Acceptance
- Full run-through: title->1-1->...->allclear with only keyboard; dying costs
  exactly 1 life; tally converts 300s in <3s visible ticking; pause freezes
  everything except music; flagpole sequence never softlocks (all timers tick).
