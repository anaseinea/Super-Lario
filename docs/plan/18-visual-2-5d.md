# Step 18 — 2.5D POP visual mode (js/17-render25d.js)

Optional second visual mode switchable at runtime; the default flat mode is
untouched (in flat mode the wrapping proxy just forwards every ctx call).

## Inputs / outputs / interface

- `BROS.R3D.boot(canvasEl, wantPop)` → 2D ctx for the HUD/Screens overlay;
  creates/reveals the `#gl` and `#overlay` canvases inside `#wrap`.
- `BROS.R3D.wrap(ctx2d)` → Proxy: forwards all 2D ops in flat mode, records
  `fillRect`, `drawImage` (2–9-arg), `fillStyle`, `globalAlpha`, `save/restore`,
  `translate/scale/rotate` in pop mode; unknown props pass through
  (`ctx.playerCenterX`).
- `BROS.R3D.begin()` / `end(overlayCtx)` bracket one world frame in `js/16`
  draw pass; `end` replays ops through three.js and returns.
- `BROS.R3D.focus(x, y)` — called by `js/14` per player frame (soft camera aim).
- `BROS.R3D.toggle()` / `resize(cv)` — mode flip + canvas lockstep (driven by
  boot's resize()).
- Knobs: `BROS.C.R3D` (FOV, depths in 16px units, camera pitch/sway/focus angles).

## Replay design

- Painter order survives as `renderOrder = opIndex` + `depthTest:false` on
  transparent materials — no depth buffer decisions to fight.
- Tiles = 16px sprites from `BROS.Sprites._map` registered under `tile_*`,
  `pipe_*`, `pole_segment`: extruded prisms (front textured, top face = lit
  average of the art's top edge, and shaded side faces only on true silhouette
  edges — a per-frame occupancy grid culls interior faces so rows read as one
  solid block). Everything else = billboard quads.
- World z: tiles at 0, entities +Z_POP (pop toward camera, keep apparent size),
  decor Z_BACK (scaled up so apparent size matches 2D; parallax comes from
  camera sway + focus aim).
- Camera: perspective, distance = (VIEW_H/2)/tan(FOV/2) so the z=0 plane maps
  16px = 1 unit exactly; position derived from the recorded camera translate,
  so pop mode frames the same slice of the world as the 2D blitter.
- Sky fill (first full-view fillRect) = both the scene clear color AND a far
  gradient sky quad (`K.SKY_Z`, cached per sky color as a CanvasTexture: deeper
  above, base mid, hazed toward the horizon, painted first at renderOrder 0).
- Blackout/fade washes replay as plain 2D `fillRect`s on the overlay (kept under
  the HUD, same as flat mode); after each POP frame a cached radial vignette is
  drawn over the world on that same overlay — framing under the HUD.
- Textures: the sprite canvases `js/06` bakes at load, used as NearestFilter
  CanvasTextures; sub-rect sources (chomper bands) bake into geometry UVs.

## Acceptance

- Flat mode identical to before (proxy forwards; tests unaffected — they never
  load 17).
- `?pop=1` boots the POP mode; `V` key toggles mid-game; if `vendor/three.min.js`
  is missing, pop falls back to flat on the first frame without crashing.
- Touch devices: `?pop=1` URL param boots POP, and a round `2.5D` chip button
  (`#btn-mode`, built by `buildTouch`, wired straight to `R3D.toggle` — it is
  not an Input action) sits centered above the pads to flip visuals mid-run.
  The chip is a direct child of `#touch` (`pointer-events: none`), so its own
  CSS rule must set `pointer-events: auto` — without it the tap falls through
  to whatever is underneath (only `.cluster` re-arms the pads).
- HUD/Screens stay pixel-crisp in both modes (separate `#overlay` canvas).
- No gameplay state is touched by the recorder — pure observation.

## Vendor

`vendor/three.min.js` = UMD r149 build vendored from the npm package:
`npm i three@0.149.0` then copy `node_modules/three/build/three.min.js`.
UMD classic-script build assigns `window.THREE` before boot (defer script in
index.html); it is never needed in flat mode. MIT license header kept intact.
