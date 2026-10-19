# 06 — Sprite System (100% procedural original pixel art)

Depends on: 02, 03 (theme ids only). Produces: `BROS.Sprites`. Consumed by 11–15.
Art policy: every sprite is built in code on an offscreen canvas with a tiny
`px()` rectangle helper (pixel-unit rects => crisp 1px art, zero assets, zero
bitmaps-in-source). Theme = palette tables; shape builders are shared.

## Public API
```
BROS.Sprites.build()              // idempotent; call once at boot
BROS.Sprites.get(name)            // returns HTMLCanvasElement (throws w/ name)
BROS.Sprites.has(name)
BROS.Sprites.theme                // 'day' | 'cave' | 'dusk' (set by Level loader)
```
Naming: lowercase snake_case, documented inventory below; consumers may NOT
invent names — a missing name is a bug to fix in 06.

## Player sprites (poses)
Sizes: small 12x16, big 14x30, dead variants 16x16 / 16x30. Poses:
`idle, walk1, walk2, skid, jump, dead, victory` (+`crouch` for big).
Palette variants: `gum` (default: gumdrop-red cap/jumpsuit, tan face, brown
boots), `flame` (white/cream suit, hot accents). Name pattern:
`p_<size>_<pose>_<variant>` e.g. `p_small_idle_gum`, `p_big_walk2_flame`.
Facing is handled by draw-side horizontal mirroring — sprites face RIGHT only.
Bubble/Toffee forms add NO new poses: drawn as overlays (bubble: stroked circle +
sheen; toffee: tinted silhouette — implemented in draw code of 11 using ctx, not sprites).

## Enemy sprites
`pudge1/pudge2` 16x16 (+`pudge_flat` 16x8), `shell_walk1/shell_walk2` 16x24,
`shell_still` 14x12, `shell_slide` 14x11, `shell_flip` 14x12 (killed spin-out),
`hopper1/hopper2` 16x16 (+`hopper_flat`), `floatoo1/floatoo2` 16x20 (balloon+
puck body; string drawn in draw code), `chomper1/chomper2` 16x30 (two-leaf
plant), `squish` shared flat frame where noted.

## Items / FX sprites
`bonbon` 4 frames (`bonbon0..3` spin), `q_block` 3 frames (`q0,q1,q2` pulse),
`brick`, `used`, `stone`, `trampoline` (16x16 compressed spring look),
`spike` 16x10 (drawn low, sits on cell bottom), `pipe_tl/tr/bl/br` 16x16 rims +
`pipe_l/pipe_r` body halves, `jelly` 16x16 (Jumbo Jelly item),
`ember` 16x16 (Ember Berry), `toffee` 16x16, `bubble_item` 16x16,
`fireball1/2` 8x8, `coin_pop` 16x16 (one-frame flying bonbon, drawn via bonbon),
`debris1/2` 8x8 brick shards, `pole_ball` 8x8, `flag` 16x14, `keep` 64x64
(Gingerbread Keep), decor: `hill_big/hill_small` 48x24, `bush` 48x16,
`cloud1/cloud2` 32x16, `pole_segment` 2x16 (candy-cane stripes, theme-tinted).

## Theme palettes (tiles change, shapes don't)
`day`: green-topped ground, warm dirt. `cave`: blue/violet hard-candy.
`dusk`: peppermint-pink ground, dark silhouetted decor. Tile sprites are rebuilt
per theme on `Sprites.theme = t; Sprites.build()` (rebuild allowed; canvases are
cheap). Player/enemy/item sprites are theme-independent.

## Acceptance
- `build()` then `get()` on every inventory name returns canvas with expected
  width/height (self-check loop logs any miss). No canvas exceeds 64x64.
- Zero data-URI/images in source. `Sprites.theme='cave'; build()` changes tile
  colors but not player sprites.
