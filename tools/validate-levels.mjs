/* ============================================================================
 * validate-levels.mjs — independent gate for the shipped level maps.
 *
 *   node tools/validate-levels.mjs
 *
 * 1. loads js/01/02/03/09/10 in the Node sandbox and runs BROS.parseLevel on
 *    every entry of BROS.LEVELS (the parser itself is strict: it throws on
 *    uneven rows, unknown letters, unpaired pipes, floating chompers, gapped
 *    poles, bad Keeps, start spots with no ground...);
 * 2. re-checks the parsed result against the gameplay contract the next
 *    modules will rely on: spawn support, Q-block headroom, spike solidity,
 *    trampoline counts, start spot, pole/Keep geometry;
 * 3. byte-compares every map against a fresh regeneration from
 *    tools/design-*.mjs, so js/10-levels.js can never drift from the DSL.
 * ==========================================================================*/
'use strict';
import { load } from './loadmodules.mjs';
import { renderRows } from './genmaps-lib.mjs';
import { build as build11 } from './design-11.mjs';
import { build as build12 } from './design-12.mjs';
import { build as build13 } from './design-13.mjs';

const { BROS } = load([
  'js/01-namespace.js',
  'js/02-constants.js',
  'js/03-utils.js',
  'js/09-tiles.js',
  'js/10-levels.js'
]);

const T = BROS.C.TILE;
let fails = 0;
function fail(msg) { fails++; console.log('  FAIL ' + msg); }
function ok(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

/* ------------------------------------------------------------------ *
 * 1. parse every shipped map
 * ------------------------------------------------------------------ */
const designs = [build11(), build12(), build13()];
const levels = BROS.LEVELS;
if (levels.length !== 3) fail('expected 3 levels in BROS.LEVELS, got ' + levels.length);

for (let i = 0; i < levels.length; i++) {
  const def = levels[i];
  console.log('=== ' + def.name + ' "' + def.title + '" (' + def.theme + ', ' +
    def.map[0].length + ' cols) ===');

  let level;
  try {
    level = BROS.parseLevel(def);
  } catch (e) {
    fail(def.name + ': parseLevel threw: ' + e.message);
    continue;
  }
  console.log('  parsed clean');

  /* geometry basics */
  const rows = def.map.length, cols = def.map[0].length;
  if (rows !== 15) fail(def.name + ': ' + rows + ' rows, expected 15');
  if (level.cols !== cols || level.rows !== 15) fail(def.name + ': parsed size mismatch');
  if (level.levelPx !== cols * T) fail(def.name + ': levelPx wrong');
  for (let r = 1; r < rows; r++) {
    if (def.map[r].length !== cols) fail(def.name + ': row ' + r + ' width mismatch');
  }
  if (!['day', 'cave', 'dusk'].includes(def.theme)) fail(def.name + ': bad theme');
  if (!(def.time >= 200 && def.time <= 600)) fail(def.name + ': odd time ' + def.time);

  /* pole / Keep */
  if (level.poleCol < 0) fail(def.name + ': no pole parsed');
  if (level.keepBlocks.length !== 1) fail(def.name + ': keepBlocks ' + level.keepBlocks.length);
  if (level.keepCol !== level.poleCol + 3) fail(def.name + ': keep not 3 right of pole');
  const keep = level.keepBlocks[0];
  if (keep.col !== level.keepCol) fail(def.name + ': keepCol mismatch');
  if (level.keepTopRow < 6 || level.keepTopRow > 11) fail(def.name + ': odd keep top row ' + level.keepTopRow);
  if (level.poleBottomRow < 11) fail(def.name + ': pole base row ' + level.poleBottomRow + ' too high');
  if (cols - level.keepCol !== 5) fail(def.name + ': keep tail margin ' + (cols - level.keepCol) + ' (want 5)');

  /* start spot */
  if (def.startCol < 1 || def.startCol > 4) fail(def.name + ': startCol ' + def.startCol + ' too deep/side');
  if (level.startRow < 10) fail(def.name + ': startRow ' + level.startRow + ' floating');
  if (!level.solidAt(level.startCol, level.startRow)) fail(def.name + ': not standing on solid');

  /* spawn support: ground walkers need a solid under their seed row,
     chompers ride pipes (parse already enforced this), floatoos need open
     space under them so they actually bob over a hazard or a walkway. */
  const counts = {};
  for (const s of level.spawns) {
    counts[s.kind] = (counts[s.kind] || 0) + 1;
    if (s.kind === 'pudge' || s.kind === 'shell' || s.kind === 'hopper') {
      if (!level.solidAt(s.col, s.row + 1)) {
        fail(def.name + ': ' + s.kind + ' at ' + s.col + ',' + s.row + ' has no floor under it');
      }
      if (level.solidAt(s.col, s.row) || level.solidAt(s.col, s.row - 1)) {
        fail(def.name + ': ' + s.kind + ' at ' + s.col + ',' + s.row + ' buried in solid cells');
      }
    }
    if (s.kind === 'floatoo') {
      if (level.solidAt(s.col, s.row) || level.solidAt(s.col, s.row + 1) || level.solidAt(s.col, s.row + 2)) {
        fail(def.name + ': floatoo at ' + s.col + ',' + s.row + ' has no room to bob');
      }
    }
    if (s.kind === 'chomper' && !level.plants.some(p => p.col === s.col && p.row === s.row)) {
      fail(def.name + ': chomper ' + s.col + ',' + s.row + ' not linked to a pipe');
    }
  }
  console.log('  spawns: ' + Object.keys(counts).sort().map(k => k + ' x' + counts[k]).join(', ') +
    '  bonbons: ' + level.bonbons.length + '  pipes: ' + level.pipes.length);

  /* Q blocks: cell directly above must be free (bump must not weld the player) */
  let qCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!BROS.Tiles.isQ(level.tileAt(c, r))) continue;
      qCount++;
      if (level.solidAt(c, r - 1)) fail(def.name + ': Q block ' + c + ',' + r + ' has solid above');
    }
  }
  console.log('  Q blocks: ' + qCount);

  /* table flags the gameplay layer relies on */
  if (BROS.Tiles.table[BROS.Tiles.SPIKE].solid) fail('spikes must NOT be solid');
  if (BROS.Tiles.table[BROS.Tiles.SPIKE].bumpable) fail('spikes must not be bumpable');
  if (!BROS.Tiles.table[BROS.Tiles.TRAMP].solid) fail('trampolines must be solid');
  if (!BROS.Tiles.table[BROS.Tiles.TRAMP].trampoline) fail('trampolines need the trampoline flag');
  if (BROS.Tiles.table[BROS.Tiles.POLE].solid) fail('pole column must be non-solid (finale is overlap-triggered)');
  if (BROS.Tiles.table[BROS.Tiles.KEEP].solid) fail('Keep must be non-solid (decoration + finale target)');

  /* trampolines: count the shipped 'C' cells (row-13 pads replacing ground) */
  const shippedTramp = def.map.reduce((n, row) => n + (row.match(/C/g) || []).length, 0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (def.map[r][c] !== 'C') continue;
      if (!level.landTypeAt(c, r)) fail(def.name + ': C at ' + c + ',' + r + ' has no landType tramp');
      if (r !== 13) fail(def.name + ': trampoline C at row ' + r + ', expected flush ground row 13');
      if (level.tileAt(c, r - 1) !== BROS.Tiles.EMPTY) fail(def.name + ': cell above trampoline ' + c + ',' + r + ' not clear');
    }
  }

  /* spikes all live in the walk band row 12 and sit on ground */
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (def.map[r][c] !== 's') continue;
      if (r !== 12) fail(def.name + ': spike at row ' + r + ', expected walk band 12');
      if (!level.solidAt(c, r + 1)) fail(def.name + ': spike ' + c + ',' + r + ' not standing on ground');
      if (level.tileAt(c, r) !== BROS.Tiles.SPIKE) fail(def.name + ': spike cell lost its id');
    }
  }

  /* 3. byte-equal against a fresh regeneration from the design DSL */
  const fresh = renderRows(designs[i]);
  let drift = false;
  if (!Array.isArray(fresh) || fresh.length !== rows) {
    fail(def.name + ': regeneration produced the wrong row count');
    drift = true;
  } else {
    for (let r = 0; r < rows; r++) {
      if (fresh[r] !== def.map[r]) {
        fail(def.name + ': map drift at row ' + r + '\n    shipped: ' + def.map[r] + '\n    fresh:   ' + fresh[r]);
        drift = true;
        break;
      }
    }
  }
  if (!drift) console.log('  map byte-matches the design DSL');
}

/* ------------------------------------------------------------------ *
 * tiles module smoke test + cross-level sanity
 * ------------------------------------------------------------------ */
const t = BROS.Tiles.selfTest();
if (t && t.length) { console.log('  Tiles.selfTest failures: ' + t.join('; ')); fails += t.length; }

for (let i = 1; i < levels.length; i++) {
  if (levels[i].time <= levels[i - 1].time) fail(levels[i].name + ' should have more time than ' + levels[i - 1].name);
  if (levels[i].map[0].length < 90) fail(levels[i].name + ' suspiciously short');
}

console.log(fails ? 'FAILED: ' + fails + ' problem(s)' : 'ALL LEVELS VALID');
process.exit(fails ? 1 : 0);
