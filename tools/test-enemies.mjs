// PLAN: docs/plan/17-testing-and-tuning.md
// Unit tests for js/12-enemies.js against a fake duck-typed level.
// Run:  node tools/test-enemies.mjs
'use strict';
import { load } from './loadmodules.mjs';

const { BROS } = load([
  'js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js',
  'js/08-physics.js', 'js/12-enemies.js'
]);
const C = BROS.C, E = BROS.Enemies;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL ' + msg); }
}
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')'); }

/* --- fake level ---------------------------------------------------------- */
function fakeLevel(rows) {
  const h = rows.length, w = rows[0].length;
  const SOLID = 'GBXCPU';
  const lv = {
    rows: h, cols: w, camX: 0, player: null,
    solidAt(c, r) {
      if (c < 0 || c >= w) return true;
      if (r < 0 || r >= h) return false;
      return SOLID.indexOf(rows[r][c]) >= 0;
    },
    landTypeAt(c, r) {
      if (c < 0 || c >= w || r < 0 || r >= h) return null;
      return rows[r][c] === 'C' ? 'tramp' : null;
    },
    pipes: [], spawns: []
  };
  return lv;
}
function flat() {
  const r = [];
  for (let i = 0; i < 13; i++) r.push('....................');
  r.push('GGGGGGGGGGGGGGGGGG'); r.push('GGGGGGGGGGGGGGGGGG');
  return r;
}
/* flat with an X wall (rows 11-12) at cols 3-4, pit at cols 8-10 */
function tricky() {
  const rows = flat();
  rows[11] = 'XXX.................';
  rows[12] = 'XXX.................';
  rows[13] = 'GGGGGGGGG.......GGGG';
  rows[14] = 'GGGGGGGGG.......GGGG';
  return rows;
}

/* --- Pudge --------------------------------------------------------------- */
{
  const lv = fakeLevel(tricky());
  const p = E.pudge(8, 12);        // solid floor cols 0-8, pit 9-15, wall cols 0-2
  p.dir = -1;
  let flippedAt = -1, xAtFlip = 0;
  for (let f = 0; f < 400; f++) {
    p.update(lv);
    if (flippedAt < 0 && p.dir === 1) { flippedAt = f; xAtFlip = p.x; }
    if (flippedAt >= 0 && p.x > xAtFlip + 8) break;
  }
  ok(flippedAt >= 0, 'pudge flips at the wall');
  ok(xAtFlip >= 3 * 16 && xAtFlip < 6 * 16, 'pudge flips at the wall edge, not through it');
  ok(p.grounded, 'pudge stays glued to the floor while patrolling');

  const pitLv = fakeLevel(tricky());
  const p2 = E.pudge(8, 12);
  p2.dir = 1;                      // walks right off the ledge into the pit 9-15
  let fell = false;
  for (let f = 0; f < 300; f++) { p2.update(pitLv); if (p2.y > 13 * 16 + 8) fell = true; }
  ok(fell, 'pudge walks off ledges (SMB tradition)');

  p2.onStomp({});
  ok(p2.dead && p2.flat && p2.deadTimer === 30, 'stomped pudge squishes flat for 30f');
  ok(p2.spriteName() === 'pudge_flat', 'flat pudge uses squish art');
}

/* --- Tinshell state machine ---------------------------------------------- */
{
  const lv = fakeLevel(flat());

  // stomp walking -> still
  const s = E.tinshell(6, 12);
  ok(s.state === 'walk', 'shell starts walking');
  s.onStomp({ playerCenterX: s.x + 4 });
  ok(s.state === 'still' && s.h === 12 && s.vx === 0, 'stomp walking shell retracts it to still');
  ok(s.spriteName() === 'shell_still', 'still shell art');
  let blinked = false, revivedWalk = false;
  for (let f = 0; f < C.SHELL_REVIVE + 5; f++) {
    s.update(lv);
    if (s.blinking()) blinked = true;
    if (s.state === 'walk') { revivedWalk = true; break; }
  }
  ok(blinked, 'still shell blinks before reviving');
  ok(revivedWalk && s.h === 16, 'still shell stands back up on solid ground');

  // side touch on still -> kick slide, no death
  const k = E.tinshell(6, 12);
  k.onStomp({ playerCenterX: k.x });
  k.onSideHit({ playerCenterX: k.x + 20 });     // player on the right -> shell rolls left
  ok(k.state === 'slide' && k.vx === -C.SHELL_SLIDE, 'side touch kicks a still shell into a slide');
  ok(!k.dead, 'kicking a still shell does not kill it');
  ok(k.spriteName() === 'shell_slide', 'sliding shell art');

  // stomp sliding -> still
  k.onStomp({ playerCenterX: k.x });
  ok(k.state === 'still', 'stomp sliding shell re-stills it');
  // stomp while still -> slide away from the stomper
  k.onStomp({ playerCenterX: k.x - 10 });        // stomper on the LEFT -> shell rolls right
  ok(k.state === 'slide' && k.vx === C.SHELL_SLIDE, 'stomping a still shell kicks it away');

  // chain conversion: a slider converts walking shells
  const chain = E.tinshell(10, 12);
  ok(chain.chainConvert(1) === true && chain.state === 'slide', 'sliding shell converts a walker (chain)');
  ok(chain.chainConvert(1) === false, 'a shell already sliding is not re-converted');

  // slide flips at walls and keeps sliding forever
  const w = fakeLevel(tricky());
  const sl = E.tinshell(7, 12);                  // solid floor here, left of the pit
  sl.onStomp({ playerCenterX: sl.x });           // retract the walker first (onSideHit only kicks STILL shells)
  sl.onSideHit({ playerCenterX: sl.x + 20 });    // player on the right -> slides LEFT into the wall
  ok(sl.vx === -C.SHELL_SLIDE, 'kick direction is away from the player');
  let flipped = false;
  for (let f = 0; f < 300; f++) {
    sl.update(w);
    if (sl.dir === 1 && sl.state === 'slide') { flipped = true; break; }
  }
  ok(flipped, 'sliding shell bounces off walls and keeps sliding');

  // revive-fall: still shell with no floor under it revives as a slider
  const pitLv2 = fakeLevel(tricky());
  const pf = E.tinshell(10, 12);
  pf.onStomp({ playerCenterX: pf.x });            // retracted directly over the pit 9-15
  for (let f = 0; f < C.SHELL_REVIVE + 2; f++) pf.update(pitLv2);
  ok(pf.state === 'slide', 'revive-fall: shell over a gap revives as a slider');

  // fire kill = flip-fade 40f
  const fi = E.tinshell(5, 12);
  fi.onFireHit();
  ok(fi.dead && !fi.flat && fi.deadTimer === 40, 'fire kills shell with flip-fade');
  ok(fi.spriteName() === 'shell_flip', 'flipped shell art');
}

/* --- Hopper --------------------------------------------------------------- */
{
  const lv = fakeLevel(flat());
  lv.player = { x: 600, y: 200, w: 11, h: 16, dead: false };   // far away, off level
  const h = E.hopper(3, 12);
  let hoppedFar = false, hopFrame = -1;
  for (let f = 0; f < C.HOPPER_WAIT + 20; f++) {
    h.update(lv);
    if (h.vy < 0) { hoppedFar = true; hopFrame = f; break; }
  }
  ok(hoppedFar, 'hopper hops on its own timer even with no player near');
  ok(hopFrame < C.HOPPER_WAIT + 2, 'timer hop fires at HOPPER_WAIT');

  const lv2 = fakeLevel(flat());
  lv2.player = { x: 10 * 16 + 70, y: 192, w: 11, h: 16, dead: false }; // within 90px
  const h2 = E.hopper(10, 12);
  let nearHop = false;
  for (let f = 0; f < 20; f++) { h2.update(lv2); if (h2.vy < 0) { nearHop = true; break; } }
  ok(nearHop, 'hopper hops early when the player is within 90px');

  // apex of a hop ~ HOPPER_JUMP_VY^2 / (2*G) = 28.4px
  const h3 = E.hopper(15, 12);
  lv2.player.x = 15 * 16;
  let feet0 = h3.y + h3.h, minFeet = feet0;
  for (let f = 0; f < 80; f++) {
    h3.update(lv2);
    const feet = h3.y + h3.h;
    if (feet < minFeet) minFeet = feet;
  }
  const rise = feet0 - minFeet;
  const ideal = C.HOPPER_JUMP_VY * C.HOPPER_JUMP_VY / (2 * C.GRAVITY);
  ok(rise > ideal * 0.75 && rise <= ideal + 2, 'hop apex near HOPPER_JUMP_VY arc (' + rise.toFixed(1) + ' vs ' + ideal.toFixed(1) + ')');

  h3.onStomp({});
  ok(h3.dead && h3.flat, 'stomped hopper squishes flat');
  ok(h3.spriteName() === 'hopper_flat', 'flat hopper art');
  ok(E.hopper(2, 12).stompable() === true, 'hopper stompable mid-air too (flag is stateless)');
}

/* --- Floatoo --------------------------------------------------------------- */
{
  const lv = fakeLevel(flat());
  lv.player = { x: 600, y: 200, w: 11, h: 16, dead: false };
  const fl = E.floatoo(5, 10);
  const spawnY = fl.y;
  let minD = 0, maxD = 0;
  for (let f = 0; f < C.FLOATOO_BOB_PERIOD; f++) {
    fl.update(lv);
    const d = fl.y - spawnY;
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
  }
  ok(maxD <= C.FLOATOO_BOB_AMP + 0.5 && -minD <= C.FLOATOO_BOB_AMP + 0.5, 'floatoo bob stays within FLOATOO_BOB_AMP');
  ok(maxD - minD >= C.FLOATOO_BOB_AMP, 'floatoo actually sweeps most of the bob arc');

  // chase: player to the right -> drift right after the 60f re-think
  lv.player = { x: 200, y: 192, w: 11, h: 16, dead: false };
  const x0 = fl.x;
  for (let f = 0; f < 180; f++) fl.update(lv);
  ok(fl.x > x0 + 20, 'floatoo drifts toward the player x');

  // stop chasing when the player is off-screen to the left
  lv.camX = 220;
  lv.player = { x: 40, y: 192, w: 11, h: 16, dead: false };
  fl.chaseTimer = 0;
  for (let f = 0; f < 60; f++) fl.update(lv);       // re-think sees player left of camX
  const x1 = fl.x;
  for (let f = 0; f < 60; f++) fl.update(lv);
  ok(fl.x === x1, 'floatoo stops chasing once the player is behind the camera');

  const pop = E.floatoo(12, 10);
  pop.onStomp({});
  ok(pop.dead && !pop.flat && pop.cause === 'pop' && pop.deadTimer === 40, 'stomped floatoo pops (flip-fade)');
  ok(pop.stompable() === true, 'floatoo always stompable');
}

/* --- Chomper --------------------------------------------------------------- */
{
  const rows = flat();
  for (let r = 11; r <= 12; r++) rows[r] = rows[r].split('').map((c, i) => (i === 10 || i === 11) ? 'p' : c).join('');
  const lv = fakeLevel(rows);
  lv.pipes = [{ col: 10, row: 11, hgt: 2, bottomRow: 12, mouthRow: 11 }];
  lv.spawns = [{ kind: 'chomper', col: 10, row: 10 }];
  const list = E.spawnAll(lv);
  ok(list.length === 1 && list[0].kind === 'chomper', 'spawnAll builds a chomper from the map records');
  const ch = list[0];
  ok(ch.stompable() === false, 'chomper is never stompable');

  let maxRaise = 0, hiddenFrames = 0;
  let geomOK = true;
  for (let f = 0; f < C.CHOMPER_PERIOD; f++) {
    ch.update(lv);
    if (ch.raise > maxRaise) maxRaise = ch.raise;
    if (ch.h === 0) hiddenFrames++;
    if (ch.y !== ch.mouthTopY - ch.raise || ch.h !== ch.raise) geomOK = false;
  }
  near(maxRaise, C.CHOMPER_AMP, 1.5, 'chomper reaches CHOMPER_AMP on its cycle');
  ok(hiddenFrames >= 30, 'chomper rests hidden for a clear part of the cycle');
  ok(geomOK, 'chomper hitbox geometry tracks the exposed band exactly');
  ok(ch.mouthTopY === 11 * 16, 'chomper anchors on the pipe mouth row');

  // hidden = no overlap; raised full = bites a player standing on the pipe top
  const onPipe = { x: 10 * 16 + 2, y: 11 * 16 - 16, w: 11, h: 16, dead: false }; // small, feet on mouth line
  let overlapWhileHidden = false, overlapAtPeak = false;
  for (let f = 0; f < C.CHOMPER_PERIOD * 2; f++) {
    ch.update(lv);
    if (ch.h === 0 && BROS.Phys.entitiesOverlap(ch, onPipe)) overlapWhileHidden = true;
    if (ch.raise >= C.CHOMPER_AMP - 1 && BROS.Phys.entitiesOverlap(ch, onPipe)) overlapAtPeak = true;
  }
  ok(!overlapWhileHidden, 'hidden chomper cannot hurt anyone');
  ok(overlapAtPeak, 'raised chomper bites a player standing on the pipe');
}

/* --- spawnAll kinds -------------------------------------------------------- */
{
  const lv = fakeLevel(flat());
  lv.spawns = [
    { kind: 'pudge', col: 2, row: 12 }, { kind: 'shell', col: 4, row: 12 },
    { kind: 'hopper', col: 6, row: 12 }, { kind: 'floatoo', col: 8, row: 10 }
  ];
  const list = E.spawnAll(lv);
  const kinds = list.map(e => e.kind).sort().join(',');
  ok(list.length === 4 && kinds === 'floatoo,hopper,pudge,tinshell', 'spawnAll maps parse kinds (shell->tinshell)');
  const grounded = list.filter(e => e.y + e.h === 13 * 16);
  ok(grounded.length === 3, 'ground walkers spawn feet-flush on the walk band');
}

console.log('test-enemies: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
