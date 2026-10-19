# CLAUDE.md – sUPERmARIO project guidelines

Read this before writing or modifying any code.

## Context budget rule (130K window)

To work safely in a 130K context window:
- **Never read a file larger than 200 lines in one shot.** Use `offset`/`limit` to read only the section you need.
- **Never paste a full file into a conversation.** Read targeted chunks.
- **Files must stay under 250 lines.** If a file would grow past 250, split it.
- **Functions must stay under 40 lines.** Split by responsibility, not by convenience.
- When making changes, use `offset`+`limit` on `Read` to load only the relevant section.

## File layout (one concern per file)

```
index.html          – canvas setup, script tags only
css/style.css       – visual style, canvas scaling
js/
  constants.js      – all magic numbers, tile IDs, scoring, physics values
  input.js          – keyboard state tracking (no game logic)
  level.js          – tilemap builder + entity spawn data (no game logic)
  physics.js        – AABB tile collision resolution (no game state)
  sprites.js        – pixel-art draw helpers (no game logic)
  renderer.js       – composites sprites into canvas (no game logic)
  player.js         – Player class (movement, power-up, death)
  entities.js       – Goomba, Koopa, Mushroom, Fireball, CoinPop classes
  hud.js            – draw HUD text/icons (score, time, lives)
  game.js           – game loop, state machine, entity spawn, collision dispatch
```

## Architecture rules

- **ES modules** (`export`/`import`). No globals. Entry point: `game.js` via `<script type="module">`.
- **Canvas resolution**: 480×288 px (30×18 tiles at TILE=16). CSS upscales with `image-rendering: pixelated`. No runtime scaling in JS.
- **All magic numbers live in `constants.js`.** Import them everywhere. Never hard-code pixel sizes, speeds, or scores elsewhere.
- **Tile IDs**: single source of truth in `constants.js`. `physics.js` imports them. No other file defines tile semantics.
- **Collision is tile-based AABB** (not pixel). `physics.js` owns all resolution. No file other than `physics.js` resolves overlaps.
- **Level data is static** – no procedural generation in MVP. All layout goes in `level.js`.
- **Drawing is in `renderer.js` only.** Game classes (Player, Goomba, …) do NOT draw themselves. They expose position/state. `renderer.js` reads state and draws.
- **HUD drawing is in `hud.js` only.** No other file touches score display.
- **State machine is in `game.js` only.** States: `title | playing | dying | levelComplete | gameover`. Other modules call `game.onDeath()`, `game.onFlag()` etc. – they don't own transitions.
- **No `console.log` in shipped code.** Remove all debug output before finishing a file.

## Style rules

- Use `const` for everything that doesn't reassign. Use `let` only when needed.
- No `var`.
- Class methods: short, imperative. No comments unless the *why* is non-obvious.
- Comment only to explain a hidden constraint or a subtle invariant.
- Entity classes: expose `x, y, vx, vy, w, h` as plain fields (not getters) for `physics.js` to operate on.

## Entity hitbox sizes (canonical)

| Entity       | w   | h   |
|-------------|-----|-----|
| Mario (small)| 12 | 15 |
| Mario (big)  | 14 | 30 |
| Goomba       | 14 | 14 |
| Koopa (walk) | 14 | 22 |
| Koopa (shell)| 14 | 14 |
| Mushroom     | 14 | 15 |
| Coin (tile)  | 8  | 14 |
| Coin pop     | 8  | 14 |
| Flagpole     | 4  | 144|

## Known tricky bits (do these right)

- **Jump variable height**: apply full `JUMP_FORCE` on press. While rising, if key is released early, immediately add `JUMP_CUT_MULT` to `vy` (cut the rise short). Don't use a `jumpLock` boolean – use key-hold check directly.
- **`vy > 0` means falling** (canvas Y grows downward).
- **`onGround` check**: done *after* both horizontal and vertical resolution. Check if the tile at `y+h` row is solid. Never use `vy === 0` as a ground proxy.
- **Camera only advances right** (never scrolls back). This is classic Mario behavior.
- **Question/brick bump**: detect via `headBump` event in physics (vy was negative and a solid tile was directly above). Handle tile response in `game.js`.
- **Invincibility flash**: after damage, 120 frames invincible. Mario blinks (skip drawing on odd 8-frame windows). No damage during this.
- **Big Mario height change on powerup**: adjust `y` upward by `ΔH = 30-15 = 15` so feet stay on ground. On shrink, shift `y` down by 15.
- **Koopa shell kick**: if player overlaps shell from the side (not from above), set `shell.vx = ±SHELL_SPEED` depending on which side player approached from. Re-kick only if shell is stationary.

## Adding a new feature checklist

1. Add constants to `constants.js` first.
2. Decide which existing file owns the new logic.
3. If none fits and the concern is > 50 lines, create a new file under the file layout above.
4. Add sprite draw functions to `sprites.js` / renderer wiring in `renderer.js`.
5. Add spawn data to `level.js` if the feature changes the level.
6. Never duplicate a responsibility that already lives in another file.
