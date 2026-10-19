# 08 — Tiles & Level Format (parser)

Depends on: 03. Produces: `BROS.Tiles` (table) + `BROS.parseLevel(def)` +
`BROS.Levels` registry container rules. Consumed by 09, 10, 11, 12, 13, 14.
**Node-testable: this file must not touch document/window.BROS beyond C/U.**

## Tile legend (single source of truth — mirrors tools/genmaps)
```
.  empty            G  ground (solid)          B  candy brick (solid, breakable)
X  hard candy (solid, unbump-breakable)        ?  Q-block -> bonbon
J  Q-block -> Jumbo Jelly (grow)               E  Q-block -> Ember Berry (flame)
R  Q-block -> Toffee form (timed)              O  Q-block -> Bubble form (timed)
C  trampoline (solid, launches)                s  spikes (NON-solid, damage zone)
p  pipe cell (paired 2-wide; parser stamps solid grid + emits pipe visual)
r  Chomper spawn (must sit directly above a pipe mouth)
g  Pudge spawn      q  Tinshell spawn          h  Hopper spawn   f  Floatoo spawn
o  bonbon collectible (non-solid)              U  used block (runtime-only)
I  candy-cane flagpole segment column (non-solid, triggers finale)
K  Gingerbread Keep area (4x4 cells, non-solid, decoration + finale target)
```

## Tile table (`BROS.Tiles.table[id]`) fields
`solid, breakable, qitem (null|'bonbon'|'jelly'|'ember'|'toffee'|'bubble'),
trampoline, spike, collect, pole, keep, pipe, deco` — booleans/strings only.

## parseLevel(def) contract
Input: `{name, theme:'day'|'cave'|'dusk', map:[rows strings], startCol, time}`
(rows top->bottom; every row same length). Output:
```
{ name, theme, cols, rows, startCol, time,
  tiles: Uint8Array(cols*rows)          // ids from Tiles.ids
  aux:   Int16Array(cols*rows)          // pipe visual pairing id (-1 else)
  solidAt(col,row) -> bool
  tileAt/setTileAt(col,row,id)
  pipes:[{col,row,hgt}]                 // row = topmost cell row
  plants:[{col,row}]                    // spawn anchors (row above pipe mouth)
  spawns:[{kind:'pudge'|'shell'|'hopper'|'floatoo', col, row}]
  bonbons:[{col,row}]                   // removed from tiles, animated collectibles
  poleCol, poleTopRow, keepCol         // -1 if absent (level must have pole)
  keepTargetX (walk target px)
}
```
Parse rules: spawn letters are REPLACED by '.' in the grid (entities exist in
runtime lists); 'o' becomes a runtime bonbon entity, cell cleared; 'I' column
spans contiguous vertical run -> poleTopRow; 'K' 4x4 block -> keepCol=leftmost,
cells cleared; pipes: each maximal vertical run of 'p' in a column, runs in
adjacent columns with identical span merge into ONE pipe {col=left, hgt}, aux
stamps 0/1 half-index; unpaired runs are a parse ERROR (throw). Pole base must
have solid ground beneath (validation). `setTile` runtime ops (Q->U, brick->
empty, stamping pipes) live here, not in gameplay files.

## Acceptance (with tools/validate-levels.mjs, step 17)
- Parses all 3 generated maps without throwing; row lengths uniform; pipe pairs
  even; pole+keep found exactly once per level; no spawn on a solid cell; every
  pit gap <= 6 columns (trampolines may assist).
