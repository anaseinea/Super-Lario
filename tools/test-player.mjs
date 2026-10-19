// PLAN: docs/plan/17-testing-and-tuning.md
// Unit tests for js/13-player.js: a scripted fake Input (swapped into
// BROS.Input) driving the real physics against fake duck-typed levels.
// Run:  node tools/test-player.mjs
'use strict';
import { load } from './loadmodules.mjs';

const { BROS } = load([
  'js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js',
  'js/08-physics.js', 'js/13-player.js'
]);
const C = BROS.C;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL ' + msg); }
}
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')'); }

/* --- fake scripted Input -------------------------------------------------- */
function fakeInput() {
  const held = Object.create(null), prev = Object.create(null);
  let tick = 0, lastJumpPress = -9999;
  return {
    press(a) { held[a] = true; if (a === 'jump') lastJumpPress = tick; },
    release(a) { held[a] = false; },
    down(a) { return !!held[a]; },
    pressed(a) { return !!held[a] && !prev[a]; },
    released(a) { return !held[a] && !!prev[a]; },
    jumpBufferFrames() { return tick - lastJumpPress; },
    __step() { tick++; for (const a in held) prev[a] = held[a]; }
  };
}

/* --- fake level implementing the player callback contract ----------------- */
function fakeLevel(rows) {
  const h = rows.length, w = rows[0].length;
  const SOLID = 'GBXCPU';
  const lv = {
    rows: h, cols: w, player: null,
    headBumps: [], landings: [], trampCalls: 0, fireballs: [], liveFires: 0,
    solidAt(c, r) {
      if (c < 0 || c >= w) return true;               // columns are walls
      if (r < 0 || r >= h) return false;              // sky / pit open
      return SOLID.indexOf(rows[r][c]) >= 0;
    },
    landTypeAt(c, r) {
      if (c < 0 || c >= w || r < 0 || r >= h) return null;
      return rows[r][c] === 'C' ? 'tramp' : null;
    },
    onHeadBump(cells) { lv.headBumps.push(cells); },
    onPlayerLanded(ev) { lv.landings.push(ev); },
    onLandTrampolined() { lv.trampCalls++; lv.player.launchTrampoline(C.TRAMPOLINE_VY); },
    spawnFireball(p) { lv.fireballs.push({ x: p.x, y: p.y }); },
    activeFireballCount() { return lv.liveFires; }
  };
  return lv;
}

function flatRows() {
  const r = [];
  for (let i = 0; i < 13; i++) r.push('....................');
  r.push('GGGGGGGGGGGGGGGGGG'); r.push('GGGGGGGGGGGGGGGGGG');
  return r;
}
function mk(rows, x, feetY) {
  const lv = fakeLevel(rows), I = fakeInput();
  BROS.Input = I;
  const p = BROS.Player.spawn(x, feetY);
  lv.player = p;
  return { lv, I, p };
}
function run(p, lv, I, n, pre, post) {
  for (let f = 1; f <= n; f++) {
    if (pre) pre(f);
    p.update(lv);
    I.__step();
    if (post) post(f);
  }
}

/* --- jump feel: hold vs cut vs tap + no auto-bounce while holding --------- */
function measureJump(rows, releaseAt) {
  const { lv, I, p } = mk(rows || flatRows(), 50, 208);
  run(p, lv, I, 3);                                   // settle on the floor
  let minFeet = 208, airborne = false, landed = false, badHold = 0;
  run(p, lv, I, 90,
    f => {
      if (f === 1) I.press('jump');
      if (releaseAt && f === releaseAt + 1) I.release('jump');
    },
    () => {
      if (p.y + p.h < minFeet) minFeet = p.y + p.h;
      if (!p.onGround) airborne = true;
      else if (airborne && !landed) landed = true;   // touchdown frame
      else if (landed && (p.vy < 0 || !p.onGround)) badHold++;
    });
  return { rise: 208 - minFeet, badHold };
}
{
  const hold = measureJump(null, null);
  const mid = measureJump(null, 2);                  // release mid-ascent
  const tap = measureJump(null, 1);                  // one-frame tap
  ok(hold.rise >= 60 && hold.rise <= 85, 'held jump apex ~72px (' + hold.rise.toFixed(1) + ')');
  ok(mid.rise < hold.rise && mid.rise > tap.rise, 'jump cut shortens the arc cleanly');
  ok(tap.rise <= 15, 'tap jumps are small and crisp (' + tap.rise.toFixed(1) + ')');
  ok(hold.badHold === 0, 'holding jump through a landing does NOT auto-bounce');
  ok(hold.rise > tap.rise * 3, 'hold gives dramatically more height than tap (SMB feel)');
}

/* --- jump buffering: press a few frames before landing re-jumps ----------- */
{
  const { lv, I, p } = mk(flatRows(), 50, 160);      // drop from 3 tiles up
  let armed = false, jumped = false, landFrame = -1, badLandings = 0;
  run(p, lv, I, 120,
    () => { if (!armed && p.y + p.h >= 184) { I.press('jump'); armed = true; } },
    f => {
      if (!jumped && lv.landings.length > 0) {
        jumped = true; landFrame = f;
        if (p.vy !== -C.JUMP_SMALL) badLandings++;   // buffered re-jump must fire
      }
    });
  ok(jumped && badLandings === 0, 'jump buffered before touchdown re-jumps on the landing frame');
}

/* --- coyote time: jump shortly after walking off a ledge ------------------- */
{
  const rows = flatRows();
  rows[13] = 'GGGGGGGGG.......GGGG';                  // pit at cols 9-15
  rows[14] = rows[13];
  const { lv, I, p } = mk(rows, 32, 208);
  I.press('right');
  let stepped = -1, coyoteJump = false, expiredJump = false;
  run(p, lv, I, 200,
    f => {
      if (stepped >= 0 && f === stepped + 2) I.release('jump');   // cut the coyote hop short; rearm press edges
      if (stepped >= 0 && (f === stepped + 1 || f === stepped + C.COYOTE + 2)) I.press('jump');
    },
    f => {
      // jumpUsed is falsed by each press edge and trued by a launch, so on an exact press frame
      // jumpUsed === true means "this very press launched a jump".
      if (stepped < 0 && !p.onGround) stepped = f;
      if (stepped >= 0 && f === stepped + 1 && p.jumpUsed) coyoteJump = true;
      if (stepped >= 0 && f === stepped + C.COYOTE + 2 && p.jumpUsed) expiredJump = true;
    });
  ok(stepped > 0, 'player walks off a ledge and goes airborne');
  ok(coyoteJump, 'coyote window: pressing jump right after leaving the ground still jumps');
  ok(!expiredJump, 'after the coyote window expires there is no air jump');
  ok(p.y + p.h > 224, 'the second player falls clean into the pit (no late rescue jump)');
}

/* --- speeds & skid ---------------------------------------------------------- */
{
  const { lv, I, p } = mk(flatRows(), 50, 208);
  I.press('right');
  run(p, lv, I, 80);
  near(Math.abs(p.vx), C.WALK_MAX, 0.05, 'walk tops out at WALK_MAX');

  const r2 = mk(flatRows(), 50, 208);
  r2.I.press('right'); r2.I.press('run');
  run(r2.p, r2.lv, r2.I, 70);     // 70f tops out at RUN_MAX well before the flat world's right border wall
  near(Math.abs(r2.p.vx), C.RUN_MAX, 0.05, 'run tops out at RUN_MAX');
  ok(r2.p.vx > p.vx + 0.5, 'run is clearly faster than walk');

  // full-speed run -> opposite direction: face flips instantly, hard skid stop
  const s = mk(flatRows(), 50, 208);
  s.I.press('right'); s.I.press('run');
  run(s.p, s.lv, s.I, 70);        // same: stop before the border wall would zero vx
  let sawSkid = false, flipFrame = -1, reversedFrame = -1;
  run(s.p, s.lv, s.I, 60,
    f => { if (f === 1) { s.I.release('right'); s.I.press('left'); } },
    f => {
      if (s.p.skid && !sawSkid) { sawSkid = true; flipFrame = f; }
      if (flipFrame > 0 && reversedFrame < 0 && s.p.vx < 0) reversedFrame = f;
    });
  ok(sawSkid, 'turn-around at running speed triggers a skid pose');
  ok(flipFrame === 1, 'facing flips on the very first opposite-pressure frame');
  ok(reversedFrame - flipFrame <= 25, 'skid deceleration is much sharper than normal friction');
}

/* --- crouch: crawl under a low ceiling, blocked stand-up, auto-stand ------- */
{
  const rows = flatRows();
  rows[11] = '....XXXXXXXX........';                  // X ceiling cols 4-11
  const { lv, I, p } = mk(rows, 224, 208);
  ok(p.grow(lv) === true && p.h === C.BIG_H, 'grow on open ground makes big Gumdrop');
  I.press('left');
  let crouchX = 224, blockedFramesBad = 0, stoodBackUp = false;
  run(p, lv, I, 75,
    f => { if (f === 20) I.press('down'); },
    () => { if (p.crouched) crouchX = p.x; });
  ok(p.crouched && p.h === C.CROUCH_H, 'holding down while big & grounded crouches (h = CROUCH_H)');
  ok(crouchX < 7 * 16, 'crouched Gumdrop duck-walks underneath the low ceiling (plan 11)');
  I.release('down'); I.release('left');          // stop just inside the low section
  run(p, lv, I, 15, null, () => {
    if (!(p.crouched && p.h === C.CROUCH_H)) blockedFramesBad++;
  });
  ok(blockedFramesBad === 0, 'crouched under a low ceiling: standing up stays blocked');
  I.press('left');
  run(p, lv, I, 60, null, () => {
    if (!p.crouched && p.h === C.BIG_H) stoodBackUp = true;
  });
  ok(stoodBackUp, 'once clear of the ceiling, releasing down auto-stands back up');
  ok(p.power === 'big' && p.w === C.BIG_W, 'crouching never costs power or width');
}

/* --- grow & pending-grow retry --------------------------------------------- */
{
  const rows = flatRows();
  rows[11] = '.......X............';                  // X cap directly over col 7
  const { lv, I, p } = mk(rows, 112, 208);
  ok(p.grow(lv, 'flame') === false, 'grow refuses when the extra headroom is occupied');
  ok(p.pending === 'flame' && p.h === C.SMALL_H && p.power === 'small',
    'blocked grow arms pending and keeps the small box (no wall embedding)');
  ok(p.collectJelly(lv) === undefined && p.pending === 'flame',
    'collecting jelly while pending keeps the pending target alive');
  I.press('right');
  let grewAt = -1;
  run(p, lv, I, 60, null, f => { if (grewAt < 0 && p.power === 'flame' && p.h === C.BIG_H) grewAt = f; });
  ok(grewAt > 0, 'walking clear auto-retries the pending upgrade');
  ok(p.pending === null && p.big(), 'pending is cleared once the upgrade lands');
}

/* --- head bump -------------------------------------------------------------- */
{
  const rows = flatRows();
  rows[11] = '....XXX.............';                  // X ceiling right overhead
  const { lv, I, p } = mk(rows, 80, 208);
  I.press('jump');
  let minFeet = 208;
  run(p, lv, I, 40, null, () => { if (p.y + p.h < minFeet) minFeet = p.y + p.h; });
  ok(lv.headBumps.length >= 1, 'hitting a ceiling calls level.onHeadBump');
  ok(Array.isArray(lv.headBumps[0]) && lv.headBumps[0].length >= 1, 'onHeadBump receives the struck cells');
  ok(208 - minFeet <= 20, 'jump is killed dead by a ceiling flush over the head');
}

/* --- trampoline landing ----------------------------------------------------- */
{
  const rows = flatRows();
  rows[13] = 'GGGGGGCCGGGGGGGGGG';                    // tramp tiles cols 6-7
  const { lv, I, p } = mk(rows, 100, 160);
  let minFeet = 208, launchVy = 0;
  run(p, lv, I, 45, null, () => {
    if (p.y + p.h < minFeet) minFeet = p.y + p.h;
    if (lv.trampCalls === 1 && launchVy === 0) launchVy = p.vy;
  });
  ok(lv.trampCalls === 1, 'landing on a tramp tile calls level.onLandTrampolined');
  near(launchVy, -C.TRAMPOLINE_VY, 0.001, 'Level launches via player.launchTrampoline(TRAMPOLINE_VY)');
  ok(208 - minFeet >= 100, 'trampoline bounce reaches ~114px of rise');
  ok(lv.landings.length === 0, 'normal landing callback does NOT fire on a tramp contact');
}

/* --- bubble form -------------------------------------------------------------- */
{
  const { lv, I, p } = mk(flatRows(), 50, 160);
  p.startBubble();
  ok(p.activeForm() === 'bubble' && p.bubbleFrames === C.BUBBLE_FRAMES, 'bubble form active');
  let maxVy = 0, reachedSlow = false, apexFeet = 208;
  run(p, lv, I, 300,
    f => { if (f === 20) I.press('jump'); },
    () => {
      if (p.vy > maxVy) maxVy = p.vy;
      if (p.vy >= C.BUBBLE_MAX_FALL - 0.1) reachedSlow = true;
      if (p.y + p.h < apexFeet) apexFeet = p.y + p.h;
    });
  ok(maxVy <= C.BUBBLE_MAX_FALL + 0.001, 'bubble fall never exceeds BUBBLE_MAX_FALL');
  ok(reachedSlow, 'bubble actually drifts (the cap is engaged)');
  ok(208 - apexFeet >= 60, 'bubble form can still jump high');
  const h = p.hurt();
  ok(h === 'bubble' && p.bubbleFrames === 0 && p.invuln === C.INVULN_HITS,
    'hurt in bubble form pops the bubble and grants i-frames');

  const x = mk(flatRows(), 50, 208);
  x.p.startBubble();
  run(x.p, x.lv, x.I, C.BUBBLE_FRAMES + 3);
  ok(x.p.bubbleFrames === 0 && x.p.activeForm() === 'small', 'bubble times out back to base form');
}

/* --- toffee bounce overrides -------------------------------------------------- */
{
  const { lv, I, p } = mk(flatRows(), 50, 208);
  p.startToffee();
  ok(p.activeForm() === 'toffee' && p.toffeeFrames === C.TOFFEE_FRAMES, 'toffee form active');
  p.jumpHeld = false; p.bounceOff(false); near(p.vy, -C.TOFFEE_BOUNCE, 0.001, 'toffee stomp bounce = TOFFEE_BOUNCE');
  p.bounceOff(true);  near(p.vy, -C.TOFFEE_BOUNCE, 0.001, 'toffee overrides even a floatoo pop bounce');
  p.jumpHeld = true;  p.bounceOff(false); near(p.vy, -C.TOFFEE_BOUNCE, 0.001, 'toffee overrides held stomp too');
  p.toffeeFrames = 0;
  p.jumpHeld = false; p.bounceOff(false); near(p.vy, -C.STOMP_BOUNCE, 0.001, 'plain stomp bounce');
  p.jumpHeld = true;  p.bounceOff(false); near(p.vy, -C.STOMP_BOUNCE_HELD, 0.001, 'held stomp bounces higher');
  p.bounceOff(true);  near(p.vy, -C.POP_BOUNCE, 0.001, 'floatoo pop bounce is FIXED at POP_BOUNCE');
  const t2 = mk(flatRows(), 50, 100);          // airborne: a long toffee fall
  t2.p.startToffee();
  let maxVy2 = 0, capEngaged = false;
  run(t2.p, t2.lv, t2.I, 120, null, () => {
    if (t2.p.vy > maxVy2) maxVy2 = t2.p.vy;
    if (t2.p.vy >= C.TOFFEE_MAX_FALL - 0.1) capEngaged = true;
  });
  ok(maxVy2 <= C.TOFFEE_MAX_FALL + 0.001 && capEngaged, 'toffee fall speed hits TOFFEE_MAX_FALL and never exceeds it');
}

/* --- hurt chain ---------------------------------------------------------------- */
{
  const a = mk(flatRows(), 50, 208);
  ok(a.p.hurt() === 'die' && a.p.state === 'dying', 'small Gumdrop side-hit starts death');

  const b = mk(flatRows(), 50, 208);
  b.p.grow(b.lv);
  ok(b.p.hurt() === 'shrink' && b.p.power === 'small' && b.p.h === C.SMALL_H && b.p.invuln === C.INVULN_HITS,
    'big hit shrinks to small with i-frames');

  const c = mk(flatRows(), 50, 208);
  c.p.grow(c.lv); c.p.collectEmber(c.lv);
  ok(c.p.power === 'flame', 'ember on big upgrades straight to flame');
  ok(c.p.hurt() === 'shrink' && c.p.power === 'big' && c.p.h === C.BIG_H, 'flame hit demotes to big, box intact');

  const d = mk(flatRows(), 50, 208);
  d.p.grow(d.lv); d.p.collectEmber(d.lv); d.p.startBubble();
  ok(d.p.hurt() === 'bubble' && d.p.power === 'flame', 'bubble over flame: hurt pops bubble, keeps flame');

  const e2 = mk(flatRows(), 50, 208);
  e2.p.grow(e2.lv);
  e2.I.press('down');
  run(e2.p, e2.lv, e2.I, 10);
  ok(e2.p.crouched, 'crouch active before hurt test');
  ok(e2.p.hurt() === 'shrink' && e2.p.power === 'small' && e2.p.h === C.SMALL_H && !e2.p.crouched,
    'hurt while crouched shrinks cleanly and cancels the crouch');
}

/* --- flame fire request --------------------------------------------------------- */
{
  const { lv, I, p } = mk(flatRows(), 160, 208);
  p.collectEmber(lv);                                     // small -> flame (grows too)
  ok(p.power === 'flame' && p.h === C.BIG_H, 'ember on small grows straight to flame form');
  let bad = 0;
  run(p, lv, I, 60,
    f => {
      if (f === 2) { I.press('run'); }
      if (f === 3) { I.release('run'); }
      if (f === 8) { I.press('run'); }                    // inside cooldown -> refused
      if (f === 9) { I.release('run'); }
      if (f === 20) { I.press('run'); }                   // cooldown done -> fires
      if (f === 21) { I.release('run'); lv.liveFires = C.FIRE_MAX_PROJECTILES; }
      if (f === 38) { I.press('run'); }                   // cap reached -> refused
      if (f === 39) { I.release('run'); }
    },
    f => {
      if (f === 3 && lv.fireballs.length !== 1) bad++;
      if (f === 9 && lv.fireballs.length !== 1) bad++;
      if (f === 21 && lv.fireballs.length !== 2) bad++;
      if (f === 39 && (lv.fireballs.length !== 2 || p.fireCooldown !== 0)) bad++;
    });
  ok(bad === 0, 'fire request: cooldown respected, projectile cap respected, edges required');
  ok(p.fireCooldown === 0, 'cooldown decays every frame');

  const s = mk(flatRows(), 160, 208);                     // small, no flame
  run(s.p, s.lv, s.I, 5, f => { if (f === 2) s.I.press('run'); });
  ok(s.lv.fireballs.length === 0, 'pressing run without flame fires nothing');
}

/* --- dying sequence --------------------------------------------------------------- */
{
  const { lv, I, p } = mk(flatRows(), 50, 208);
  const y0 = p.y, x0 = p.x;
  I.press('right'); I.press('jump');
  p.startDeath();
  let frozenBad = 0;
  run(p, lv, I, C.DEATH_PAUSE, null, () => {
    if (p.y !== y0 || p.vy !== 0 || p.x !== x0) frozenBad++;
  });
  ok(frozenBad === 0, 'dying: input is ignored and the pose pauses for DEATH_PAUSE frames');
  let maxRise = 0, doneAt = -1;
  run(p, lv, I, C.DEATH_FRAMES, null, f => {
    if (y0 - p.y > maxRise) maxRise = y0 - p.y;
    if (doneAt < 0 && p.deathDone) doneAt = f;
  });
  ok(maxRise >= 20, 'dying: the classic pop-up launch happens after the pause');
  ok(doneAt > 0 && doneAt <= C.DEATH_PAUSE + C.DEATH_FRAMES && p.y > lv.rows * C.TILE + 64,
    'dying: player falls out of the world and deathDone fires');
}

/* --- flag / victory takeover ------------------------------------------------------ */
{
  const { lv, I, p } = mk(flatRows(), 160, 208);
  const x0 = p.x, y0 = p.y;
  p.takeControl(false);
  ok(p.state === 'flag' && p.control === false, 'takeControl(false) hands the player to the level');
  I.press('right');
  run(p, lv, I, 20);
  ok(p.x === x0 && p.y === y0 && lv.landings.length === 0, 'flag state: no input, no physics, frozen pose');
  ok(p.pose() === 'jump', 'flag pose is the jump hold');
  p.takeControl(true);
  ok(p.state === 'normal', 'takeControl(true) hands control back');
  run(p, lv, I, 30);
  ok(p.x > x0 + 20, 'control resumes normally');
  p.setVictory();
  run(p, lv, I, 10);
  ok(p.state === 'victory' && p.pose() === 'victory', 'setVictory locks the victory pose');
  ok(p.spriteName() === 'p_small_victory_gum', 'victory sprite name is canonical');
}

/* --- invuln blinking -------------------------------------------------------------- */
{
  const { lv, I, p } = mk(flatRows(), 50, 208);
  p.invuln = C.INVULN_HITS;
  let everHidden = false, badVisiblePhase = 0, badLate = 0;
  run(p, lv, I, 95, null, () => {
    const hidden = p.blinkHidden();
    if (hidden) everHidden = true;
    if (p.invuln > 40 && hidden !== ((p.frame % 8) < 4)) badVisiblePhase++;
    if (p.invuln <= 40 && hidden) badLate++;
  });
  ok(everHidden, 'invulnerable Gumdrop blinks');
  ok(badVisiblePhase === 0, 'blinking follows the 4-on/4-off cadence while invuln > 40');
  ok(badLate === 0, 'blinking stops once invuln <= 40 (solid for the tail of the i-frames)');
}

/* --- sprite name sanity ------------------------------------------------------------- */
{
  const { lv, I, p } = mk(flatRows(), 50, 208);
  run(p, lv, I, 3);                                  // settle first: a fresh spawn starts airborne
  ok(p.spriteName() === 'p_small_idle_gum', 'idle sprite name');
  run(p, lv, I, 2, f => { if (f === 1) I.press('jump'); });
  ok(p.spriteName() === 'p_small_jump_gum', 'airborne sprite name');
  run(p, lv, I, 40, f => { if (f === 1) I.press('right'); });
  ok(/^p_small_walk[12]_gum$/.test(p.spriteName()), 'walking anim cycles walk1/walk2');
  p.startDeath();
  ok(p.spriteName() === 'p_small_dead_gum', 'dead sprite name');
  const f2 = mk(flatRows(), 50, 208);
  f2.p.collectEmber(f2.lv);
  run(f2.p, f2.lv, f2.I, 40, f => { if (f === 1) f2.I.press('right'); });
  ok(/^p_big_walk[12]_flame$/.test(f2.p.spriteName()), 'flame big uses flame tint');
}

console.log('test-player: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
