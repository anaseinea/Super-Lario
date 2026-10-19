# 10 — Physics, Tile Collision & Camera

Depends on: 03, 08. Produces: `BROS.Phys` (js/08-physics.js) + `BROS.Camera`
(defined in js/14-level.js). Consumed by 11, 12, 13.
Node-testable core math; `Phys` takes a minimal `world` duck-type:
`{solidAt(c,r), tileAt(c,r), setTileAt(c,r,id), cols, rows}` — the parsed level
satisfies it, so movement tests run in Node.

## Fixed-step move algorithm (`Phys.move(entity, world, opts)`)
Entity: `{x,y (top-left px), w,h, vx,vy, onGround, wasOnGround, ko (dead-flag)}`.
Axis-separated:
1. `x += vx`; scan tile cells overlapping new AABB's left/right edges; if solid:
   snap flush (`x = cellEdge - w` or `cellEdge+… `), set `hitWall` (side, edge
   dir), zero vx (entities that die-on-wall pass `stopAtWall:false` to keep vx).
2. `y += vy`; scan cells overlapping top/bottom edges:
   - moving down & solid -> land: `y = rowTop - h`, `vy=0`, `onGround=true`;
     if cell is trampoline -> return event `{landType:'tramp'}`.
   - moving up & solid -> ceiling: `y = rowBottom(+1)`, `vy=0`, collect
     `headCells:[{col,row}]` (all solid cells touched, ordered nearest-to-center
     first; caller bumps ONLY the first per classic convention).
3. Return events object: `{hitWall, landed, headCells, landType}`.
Edge cases: entity taller than 1 cell may touch 2 rows — evaluate both; corner
snaps must never tunnel (cell scan over the FULL span of each edge, step
subdivision when |v|>TILE/2 — rare, MAX_FALL<TILE*0.6 so single scan suffices,
but keep the safety loop).
`onGround` recheck each frame (1px probe below feet) so walking off ledges works.

## Stamps & runtime tiles
Pipes occupy real solid grid cells (from 08) — no separate pipe colliders.
Runtime tile edits flow ONLY through Level (14) calling `setTileAt` + invalidating
visuals; physics is stateless w.r.t. why the tile changed.

## Camera (`BROS.Camera`, owned by Level)
- `camX` clamped `[0, levelPx - VIEW_W]`; follows with one-way scroll:
  `camX = max(camX, clamp(playerX - 96, 0, max))` — camera NEVER scrolls back.
- Player is soft-pushed at the left screen edge (can't walk left past camX).
- Vertical camera locked (level height == view height == 15 rows).
- Shake API: `camera.shake(frames, amp)` — offset applied at draw time only.
- Culling helper: `visibleCols(camX)` -> [c0, c1].

## Acceptance (Node)
- Falling 1-tile entity onto ground row stops with y exactly rowTop-h, landed=true.
- Moving right at v=4 into wall snaps flush, hitWall true.
- Head bump at vy=-7 records headCells with the nearest column first.
- Entity at v>TILE/2 subdivides without tunneling (test with fake fast vy).
