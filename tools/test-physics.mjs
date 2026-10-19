/* test-physics.mjs — physics self test plus a measured jump arc (docs/plan/10, 17).
 *
 * The arc numbers printed here are what level design (tools/genmaps.mjs) is
 * built against: standing vs running apex, air time, and clearable gap width.
 */
import { load } from './loadmodules.mjs';

const { BROS } = load(['js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js', 'js/08-physics.js']);

const C = BROS.C;
let bad = 0;

const fails = BROS.Phys.selfTest();
if (fails.length) {
  bad = 1;
  process.stdout.write('PHYSICS SELF TEST FAILED (' + fails.length + ')\n');
  for (const f of fails) process.stdout.write('  - ' + f + '\n');
} else {
  process.stdout.write('physics self-test OK\n');
}

/* ------------------------------------------------------------------ *
 * simulated jump arc, mirroring the player rules from docs/plan/11:
 *   gravity = GRAVITY while falling or coasting, GRAVITY_HOLD while rising
 *   with A held, vy clamped to JUMP_CUT when A is released early.
 * ------------------------------------------------------------------ */
function arc(opts) {
  const world = {
    cols: 60, rows: 15,
    solidAt: function (c, r) { return r >= 13; },      // flat ground, rows 13-14
    landTypeAt: function () { return null; }
  };
  const big = !!opts.big;
  const h = big ? C.BIG_H : C.SMALL_H;
  const p = { x: 30, y: 13 * 16 - h, w: big ? C.BIG_W : C.SMALL_W, h: h, vx: 0, vy: 0 };
  const holdFrames = opts.hold == null ? 40 : opts.hold;

  let grounded = true, apex = 0, air = 0, maxVx = 0, jumpFrame = 20, launched = false;
  let earlyRelease = -1;
  for (let f = 0; f < 240; f++) {
    const wantRight = true;
    const accel = grounded ? C.GROUND_ACCEL : C.AIR_ACCEL;
    const top = opts.run ? C.RUN_MAX : C.WALK_MAX;
    if (wantRight) p.vx = Math.min(top, p.vx + accel);
    if (grounded && f === jumpFrame) {
      p.vy = -(big ? C.JUMP_BIG : C.JUMP_SMALL);
      grounded = false; launched = true;
      if (opts.releaseAt != null) earlyRelease = f + opts.releaseAt;
    }
    if (!grounded) {
      const released = opts.releaseAt != null && f >= earlyRelease;
      const holding = launched && !released && f < jumpFrame + holdFrames;
      p.vy += (p.vy < 0 && holding) ? C.GRAVITY_HOLD : C.GRAVITY;
      if (released && f === earlyRelease && p.vy < -C.JUMP_CUT) p.vy = -C.JUMP_CUT;
      p.vy = Math.min(p.vy, C.MAX_FALL);
    }
    const ev = BROS.Phys.move(p, world, { grounded: grounded });
    if (ev.hitWall) p.vx = 0;
    grounded = ev.onGround;
    maxVx = Math.max(maxVx, Math.abs(p.vx));
    if (!grounded) { air++; apex = Math.max(apex, 13 * 16 - (p.y + p.h)); }
    else if (launched && air > 0) break;                 // landed: arc finished
  }
  return { apex: apex, air: air, v: maxVx, reach: Math.round(maxVx * air) };
}

const tests = [
  ['standing walk jump', arc({ run: false })],
  ['running  jump     ', arc({ run: true })],
  ['big run  jump     ', arc({ run: true, big: true })],
  ['early release     ', arc({ run: true, releaseAt: 6 })]
];
for (const [label, r] of tests) {
  process.stdout.write('  ' + label + ': apex ' + String(r.apex).padStart(3) + ' px (' +
    (r.apex / 16).toFixed(2) + ' tiles), air ' + String(r.air).padStart(3) +
    ' frames, speed ' + r.v.toFixed(2) + ' px/f, horizontal reach ' + r.reach + ' px (' +
    (r.reach / 16).toFixed(1) + ' tiles)\n');
}

const st = tests[0][1], run = tests[1][1];
process.stdout.write('  recommended level limits: gap <= ' +
  Math.max(3, Math.floor((run.reach - 16) / 16)) + ' tiles run-jumped, <= ' +
  Math.max(2, Math.floor((st.reach - 16) / 16)) + ' tiles from a standstill, high step <= ' +
  Math.max(1, Math.floor(st.apex / 16)) + ' tiles\n');
if (run.apex < 40 || run.apex > 100) { process.stdout.write('  WARNING: apex outside 2.5-6 tiles, retune JUMP_* / GRAVITY_*\n'); bad = 1; }
if (run.air < 25 || run.air > 80) { process.stdout.write('  WARNING: air time outside 25-80 frames, retune\n'); bad = 1; }

process.exitCode = bad;
