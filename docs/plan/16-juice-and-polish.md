# 16 — Juice & Polish Pass (cross-cutting)

Depends on: 07, 11–13, 14. Modifies files named below — keep each tweak a small
diff (polish must not break step acceptance of owned files).

## Checklist
1. Screen shake: camera.shake(6,2) on brick smash, toffee landing thud,
   Chomper kill; shake(10,3) on Gumdrop death; decay each frame.
2. Skid: already a pose (11); add 3f dust? SKIP dust particles (budget) — pose +
   sfx `bump`-less silent skid is enough. (Document decision.)
3. Stomp feedback: brief 4f squash pose swap for stomped enemy (flat frames).
4. Collect flow: coin/jelly/ember collect pops freeze player vy? NO freeze
   (smooth); instead: powerup pickup plays `powerup` arp + 20f sprite flash
   (blink invuln pattern reused).
5. Hurry: timer<=100 -> one `hurry_warn`, music.hurry(true), HUD red; timer<=50
   second warn beep only once.
6. Flagpole band flash: on grab, show popup band value instantly.
7. Toffee/Bubble overlays: bubble = translucent circle (stroke 1px, sheen dot)
   around hitbox center; toffee = amber tint rect overlay behind sprite + amber
   outline while active — cheap procedural, no new sprites (matches 06 policy).
8. Tally ticking: score increments animate via popups throttled (1 per 8f).
9. Floatoo string: 1px string line sprite->anchor? anchor is spawn row; draw
   dangling string from balloon to its patrol "shadow" row — just draw to fixed
   offset 24px below balloon center.
10. Title demo-free but alive: clouds drift slowly (decor scroll 0.1px/f).
11. Death sequence polish: player sprite blinks during DEATH_PAUSE? No — freeze,
    then launch; camera locked during death (already per 14).

## Performance guardrails
- Tile draw: only visible columns via camera culling; bump animation only redraws
  affected cells on top of static pass (draw order: static tiles -> bumps ->
  bonbons/items/enemies/player/particles/popups). Frame budget ~240 tile blits.
- No allocations per frame in update hot loops (reuse event objects; Phys returns
  a shared scratch object).

## Acceptance
Manual: feels responsive (input->player same frame); no visual jank at 60fps
(browser devtools FPS >= 58); all 11 checklist items visible in-game.
