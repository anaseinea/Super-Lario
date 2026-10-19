# 17 — Testing, Validation & Tuning

Depends on: all. Produces: `tools/validate-levels.mjs` (+ commands recorded in
root README).

## Automated checks (must all pass before "done")
1. `node --check` on every file in js/ (syntax).
2. `node tools/validate-levels.mjs`:
   - loads 01/02/03/09/10 in a sandbox with a stub `window` (files are DOM-free);
   - parses each level via `BROS.parseLevel`;
   - asserts: uniform row lengths; cols>=64; exactly one pole column per level;
     keep 4x4 adjacent; solid ground under pole; pipe runs even-paired;
     no spawn letter on solid/occupied cell; every `r` directly above pipe
     mouth; pit gap analysis (max 6, and >4 requires adjacent trampoline `C` in
     pit walls or run-up corridor); reachable-ceiling sanity (Q-block rows have
     >=2 air rows below); prints per-level stats (cols, bonbons, enemies, items).
3. Unit spot-checks embedded in validate script using BROS.Phys + BROS.U with
   fake worlds (tunneling test, snap test, headCells order test).

## Manual QA checklist (play all 3 levels once)
- [ ] run+jump gap distances feel right (no impossible gaps, no trivial 1-gaps)
- [ ] all 5 enemy types behave per step 12 incl. shell chains >= 3 kills
- [ ] Jelly/Ember/Toffee/Bubble each demonstrated incl. bubble hit-absorb
- [ ] trampoline chain 1-3 completable without death on first honest attempt?
      (difficulty note: may cost lives; gaps re-tuned until "fair but tense")
- [ ] spikes never multi-hit in one fall (30f cooldown)
- [ ] flag finale + tally + allclear flow + 1UP at 100 bonbons (cheat-test via
      debug flag `BROS.DEBUG.grantCoins(n)`)
- [ ] pause/mute mid-level; touch controls on touch device
- [ ] no console errors/warnings during entire session

## Tuning knob table (all in BROS.C — change here only)
jump heights, gravity pair, run/walk caps, buffer/coyote, trampoline vy, enemy
speeds, shell slide speed, combo window, invuln, time limits, tally rate.
Rule: one knob at a time, re-test level 1 after each.

## Known limitations / stretch ideas (v1.1+)
world map & warps, hidden brick secret (1-1 easter egg), moving platforms,
gamepad, level editor (reuse genmaps), parallax (dusk theme has 1-layer drift
already), 2-player.
