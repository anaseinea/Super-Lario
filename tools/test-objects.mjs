// PLAN: docs/plan/17-testing-and-tuning.md
// Unit tests for js/11-objects.js against a fake tile world.
// Run:  node tools/test-objects.mjs
'use strict';
import { load } from './loadmodules.mjs';

const { BROS } = load([
  'js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js',
  'js/08-physics.js', 'js/11-objects.js'
]);
const C = BROS.C, O = BROS.Objects;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL ' + msg); }
}
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')'); }

/* --- fake duck-typed level world -------------------------------------- */
function world(rows) {
  const h = rows.length, w = rows[0].length;
  const SOLID = 'GBXCPU';
  return {
    rows: h, cols: w,
    solidAt(c, r) {
      if (c < 0 || c >= w) return true;               // columns are walls
      if (r < 0 || r >= h) return false;              // sky / pit open
      return SOLID.indexOf(rows[r][c]) >= 0;
    },
    landTypeAt(c, r) {
      if (c < 0 || c >= w || r < 0 || r >= h) return null;
      return rows[r][c] === 'C' ? 'tramp' : null;
    }
  };
}
const FLAT = world([
  '....................', '....................', '....................',
  '....................', '....................', '....................',
  '....................', '....................', '....................',
  '....................', '....................', '....................',
  '....................', 'GGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGG'
]);

/* --- bonbon collectible ------------------------------------------------ */
{
  const b = O.bonbon(5, 10);
  const seen = {};
  for (let f = 0; f < 24; f++) { b.update(); seen[b.spriteName()] = 1; }
  ok(Object.keys(seen).length === 4, 'bonbon spins through all 4 frames');
  ok(b.x === 80 && b.y === 160, 'bonbon sits in its cell');
}

/* --- coin pop ----------------------------------------------------------- */
{
  const p = O.coinPop(100, 100);
  for (let f = 0; f < 12; f++) p.update();
  near(p.y, 100 - C.COIN_POP_H / 2, 1, 'coin pop rises linearly');
  for (let f = 0; f < 12; f++) p.update();
  ok(p.dead, 'coin pop dies after COIN_POP_FRAMES');
  near(p.y, 100 - C.COIN_POP_H, 0.01, 'coin pop reaches full COIN_POP_H');
}

/* --- debris -------------------------------------------------------------- */
{
  const d = O.debris(64, 190, C.DEBRIS_VX1, C.DEBRIS_VY1);
  const y0 = d.y;
  d.update(FLAT); d.update(FLAT);
  ok(d.vy > C.DEBRIS_VY1, 'debris gravity accelerates');
  let alive = true, f = 0;
  while (alive && f < 200) { d.update(FLAT); alive = !d.dead; f++; }
  ok(d.dead && d.y > 15 * 16 + 32, 'debris falls off the bottom and despawns');
  ok(d.spriteName().indexOf('debris') === 0, 'debris has art');
}

/* --- score popup --------------------------------------------------------- */
{
  const pu = O.popup('100', 50, 150);
  for (let f = 0; f < C.POPUP_FRAMES / 2; f++) pu.update();
  near(pu.y, 150 - C.POPUP_RISE / 2, 1, 'popup rises');
  for (let f = 0; f < C.POPUP_FRAMES / 2; f++) pu.update();
  ok(pu.dead, 'popup dies after POPUP_FRAMES');
  ok(pu.text === '100', 'popup keeps its text');
}

/* --- jelly item: emerge, walk, wall-flip, never sink --------------------- */
{
  const w = world([
    '....................', '....................', '....................',
    '....................', '....................', '....................',
    '....................', '....................', '....................',
    '....................', '....................', 'XXXXXXXX............',
    '....................', 'GGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGG'
  ]);
  const j = O.item('jelly', 9, 13);          // block cell (9,13): emerges onto its top
  for (let f = 0; f < C.ITEM_EMERGE_FRAMES; f++) j.update(w);
  ok(j.emerged, 'jelly emerges after ITEM_EMERGE_FRAMES');
  near(j.y, 12 * 16, 0.01, 'jelly ends emergence sitting on the block top');
  let flipped = false, sank = false;
  for (let f = 0; f < 400; f++) {
    j.update(w);
    if (j.vx > 0) flipped = true;
    if (j.y + j.h > 13 * 16 + 1) sank = true;
    if (flipped && j.x > 9 * 16) break;
  }
  ok(flipped, 'jelly flips at the wall');
  ok(!sank, 'jelly never sinks through the floor');
}

/* --- regression: power-up leaving a long block row ------------------------
 * The old code accumulated vy every standing frame without a landing reset,
 * so the item TELEPORTED down (vy at MAX_FALL) the instant it hit the ledge.
 * A proper fall starts at ~GRAVITY px/frame and accelerates from there.   */
{
  const w = world([
    '....................', '....................', '....................',
    '....................', '....................', '....................',
    '....................', '....................', '....................',
    '....................', '....................',
    '...XXXXX..........', 'GGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGG'
  ]);
  const j = O.item('jelly', 7, 11);
  for (let f = 0; f < C.ITEM_EMERGE_FRAMES; f++) j.update(w);
  let firstAirVy = null, sank = false;
  for (let f = 0; f < 400; f++) {
    const before = j.y + j.h;
    j.update(w);
    const after = j.y + j.h;
    if (firstAirVy === null && before <= 11 * 16 + 0.01 && after > 11 * 16 + 0.01) firstAirVy = after - before;
    if (before < 12 * 16 && after > 12 * 16 + 1) sank = true;   // snapped landing, never punched through
    if (before >= 12 * 16 - 0.01 && Math.abs(after - before) > 1) sank = true; // stable on the floor
  }
  ok(firstAirVy !== null && firstAirVy < C.GRAVITY + 1, 'jelly leaves the block ledge at normal gravity');
  ok(!sank, 'falling jelly does not punch through the floor');
  ok(!j.dead, 'jelly survives the drop');
}

/* --- ember item: static until touched ------------------------------------ */
{
  const e = O.item('ember', 4, 10);
  for (let f = 0; f < C.ITEM_EMERGE_FRAMES; f++) e.update(FLAT);
  const y = e.y;
  for (let f = 0; f < 120; f++) e.update(FLAT);
  ok(e.emerged && e.y === y, 'ember stays static on its block');
  ok(e.spriteName() === 'ember', 'ember art name');
  ok(Math.abs(e.wiggle()) <= 2, 'ember wiggle is draw-time only and bounded');
}

/* --- bubble item: always rises, dies off the top ------------------------- */
{
  const b = O.item('bubble', 12, 10);
  for (let f = 0; f < C.ITEM_EMERGE_FRAMES; f++) b.update(FLAT);
  let everFell = false, prevY = b.y, deadFrame = -1;
  for (let f = 0; f < 700; f++) {
    b.update(FLAT);
    if (b.y > prevY + 0.001) everFell = true;
    prevY = b.y;
    if (b.dead) { deadFrame = f; break; }
  }
  ok(!everFell, 'bubble item never falls');
  ok(deadFrame >= 0 && b.y + b.h < 0, 'bubble item dies once fully off the top edge');
}

/* --- fireball: bounce, wall death, bounce cap ---------------------------- */
{
  const w = world([
    '....................', '....................', '....................',
    '....................', '....................', '....................',
    '....................', '....................', '....................',
    '....................', '....................', '....................',
    '............XXXX....', 'GGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGG'
  ]);
  const fb = O.fireball(5 * 16, 12 * 16, 1);   // walking-band height, heading right
  let bounced = 0, prevVy = fb.vy;
  for (let f = 0; f < 120 && !fb.dead; f++) {
    fb.update(w);
    if (fb.vy < 0 && prevVy > 0) bounced++;
    prevVy = fb.vy;
  }
  ok(bounced >= 1, 'fireball bounces off the ground');
  ok(fb.dead, 'fireball dies on the wall');
  ok(fb.bounces <= C.FIREBALL_MAX_BOUNCES, 'fireball honors the bounce cap');

  const open = O.fireball(2 * 16, 6 * 16, 1);  // long open flight -> life expiry path
  let f = 0;
  while (!open.dead && f < C.FIREBALL_LIFE + 30) { open.update(FLAT); f++; }
  ok(open.dead && f <= C.FIREBALL_LIFE + 2, 'fireball dies of old age');
}

console.log('test-objects: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
