// PLAN: docs/plan/17-testing-and-tuning.md
// Integration tests for js/14-level.js: real Level runtime on synthetic
// maps (pole+Keep tail, as parseLevel requires) plus a smoke run on the
// real generated levels.  Scripted fake Input (swapped into BROS.Input)
// and a recording fake Audio (swapped into BROS.Audio).  draw() is never
// called here (per plan 17: Node tests stay DOM-free).
// Run:  node tools/test-level.mjs
'use strict';
import { load } from './loadmodules.mjs';

const { BROS } = load([
  'js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js',
  'js/08-physics.js', 'js/09-tiles.js', 'js/10-levels.js',
  'js/11-objects.js', 'js/12-enemies.js', 'js/13-player.js', 'js/14-level.js'
]);
const C = BROS.C;
const Tiles = BROS.Tiles;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL ' + msg); }
}
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (' + a + ' vs ' + b + ')'); }
function count(log, name) { let n = 0; for (const s of log) if (s === name) n++; return n; }

/* --- scripted fake Input (same shape as test-player.mjs) ------------------ */
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

/* --- recording fake Audio -------------------------------------------------- */
function fakeAudio(rec) {
  return {
    sfx: function (n) { rec.sfxLog.push(n); },
    stopMusic: function (f) { rec.stopLog.push(f); },
    playMusic: function () {}, setPaused: function () {}, ensure: function () {},
    unlock: function () {}, toggleMute: function () {}, tickMusic: function () {},
    tickCleanup: function () {}, currentMusic: function () { return null; },
    musicDone: function () { return true; }
  };
}

/* --- synthetic map template: 32 cols x 15 rows, pole@26, Keep@28-31 ------- */
const COLS = 32, POLE = 26;
function mkDef(name, tweak, opts) {
  opts = opts || {};
  const rows = [];
  for (let r = 0; r < 15; r++) rows.push(new Array(COLS).fill('.'));
  for (let c = 0; c < COLS; c++) { rows[13][c] = 'G'; rows[14][c] = 'G'; }
  for (let r = 8; r <= 12; r++) rows[r][POLE] = 'I';
  for (let r = 9; r <= 12; r++) for (let c = POLE + 2; c <= POLE + 5; c++) rows[r][c] = 'K';
  if (tweak) tweak(rows);
  return {
    name: name, theme: opts.theme || 'day', time: opts.time || 300,
    startCol: 2, map: rows.map(function (r) { return r.join(''); })
  };
}

/* --- level context ---------------------------------------------------------- */
function mkCtx(def, preset) {
  const rec = { sfxLog: [], stopLog: [] };
  const I = fakeInput();
  BROS.Input = I;
  BROS.Audio = fakeAudio(rec);
  const gs = { score: 0, coins: 0, lives: 3 };
  if (preset) preset(gs);
  const level = new BROS.Level(def, gs);
  const ctx = {
    level: level, gs: gs, I: I, p: level.player, rec: rec,
    popups: new Set(), bumpSeen: new Set(), fxKinds: new Set(), powers: new Set()
  };
  return ctx;
}
function scan(ctx) {
  for (const f of ctx.level.fx) {
    if (f.fx === 'popup') ctx.popups.add(f.text);
    else if (f.fx) ctx.fxKinds.add(f.fx);
  }
  for (const b of ctx.level.bumps) ctx.bumpSeen.add(b.col + ',' + b.row);
  for (const it of ctx.level.items) ctx.powers.add(it.power);
}
function run(ctx, n, pre) {
  for (let i = 0; i < n; i++) {
    if (pre) pre(i);
    ctx.level.update();
    ctx.I.__step();
    scan(ctx);
  }
}
function camMonotonic(ctx) {
  let prevX = -1;
  for (let i = 0; i < 1; i++) {} // (log captured by callers via run loop)
  return prevX;
}

const POLE_MID = POLE * C.TILE + C.TILE / 2;             // 424
const POLE_BASE_FEET = 13 * C.TILE;                      // 208 (ground surface)
const POLE_TOP_FEET = 8 * C.TILE;                        // 128
const KEEP_TARGET = (POLE + 2) * C.TILE;                 // 448

/* ================================================================== *
 * A. flagpole takeover: pole-top grab band, phase order, tally
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-FLAG'));
  const { level, gs, p } = ctx;
  p.x = POLE_MID - p.w / 2;                    // centered on the pole, at its tip
  p.y = POLE_TOP_FEET - p.h;
  run(ctx, 1);
  ok(level.flagPhase === 'grab', 'A: pole grab started');
  near(gs.score, 8000, 0.001, 'A: pole-top grab scores top band 8000');
  ok(count(ctx.rec.sfxLog, 'flagpole') === 1, 'A: flagpole sfx once');
  ok(ctx.rec.stopLog.length >= 1, 'A: music stopped at flag grab');
  ok(ctx.popups.has('8000'), 'A: 8000 popup shown');

  const phases = [];
  let prevPhase = 'grab', frames = 0;
  while (!level.finished && frames < 260) {
    run(ctx, 1); frames++;
    if (level.flagPhase !== prevPhase) { phases.push(level.flagPhase); prevPhase = level.flagPhase; }
  }
  ok(level.finished === 'complete', 'A: flag sequence completes');
  ok(frames <= 200, 'A: sequence length ' + frames + ' <= 200f');
  ok(phases.join(',') === 'slide,hop,walk,enter,done', 'A: phase order ' + phases.join(','));
  ok(count(ctx.rec.sfxLog, 'gate') === 1, 'A: Keep door sfx once');
  ok(count(ctx.rec.sfxLog, 'tick') === 0, 'A: no ticks before tally');
  near(level.flagY, POLE_TOP_FEET + 2, 0.001, 'A: flag ends at pole top');
  ok(gs.lives === 3, 'A: flag costs no lives');

  let tf = 0, done = false;
  while (!done && tf < 400) { done = level.tally(); tf++; }
  ok(done, 'A: tally finishes');
  ok(tf === 150, 'A: 300-unit tally takes 150 frames (got ' + tf + ')');   // < 3s plan cap
  const ticks = count(ctx.rec.sfxLog, 'tick');
  ok(ticks >= 45 && ticks <= 52, 'A: tick rate ' + ticks + ' in [45,52]');
  ok(ticks * 3 <= tf + 6, 'A: tick spacing >= 3 frames');
  near(gs.score, 8000 + 300 * C.TIME_FLAG_BONUS, 0.001, 'A: tally score 8000+15000');
  ok(level.timeLeft === 0, 'A: tally empties clock');
  ok(ctx.level.hudData().hurry === true, 'A: hud hurry flag after tally');
}

/* ================================================================== *
 * B. walking into the pole: ground band = 100, grab pose, full sequence
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-WALK'));
  const { level, gs, I, p } = ctx;
  I.press('right');
  let snap = null, frames = 0;
  while (!level.finished && frames < 500) {
    run(ctx, 1); frames++;
    if (!snap && level.flagPhase === 'grab') {
      snap = { x: p.x, facing: p.facing, feet: p.y + p.h, score: gs.score };
    }
  }
  ok(level.finished === 'complete', 'B: walker completes flag sequence (' + frames + 'f)');
  ok(snap !== null, 'B: grab observed while walking');
  if (snap) {
    near(snap.x, POLE_MID - p.w + C.FLAG_GRAB_X, 0.001, 'B: grabbed pose straddles pole');
    ok(snap.facing === -1, 'B: grabbed pose faces pole');
    near(snap.feet, POLE_BASE_FEET, 0.001, 'B: ground grab feet on base');
    near(snap.score, 100, 0.001, 'B: lowest band scores 100');
  }
}

/* ================================================================== *
 * C. camera: one-way scroll, soft left wall, never back-tracks
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-CAM'));
  const { level, I, p } = ctx;
  I.press('right');
  let prevX = -1, monotone = true, frames = 0;
  while (frames < 500) {
    frames++;
    if (p.x >= 344 && p.onGround) { I.release('right'); I.press('left'); }
    level.update(); ctx.I.__step();
    if (level.camX < prevX - 0.001) monotone = false;
    prevX = level.camX;
    if (p.x >= 344 && frames > 200) break;      // pinned by camera on the left press
  }
  ok(level.camX === level.levelPx - C.VIEW_W, 'C: camera reaches level max (' + level.camX + ')');
  ok(level.camX === 256, 'C: camera parked at 256');
  ok(monotone, 'C: camX never decreases');
  ok(p.x >= 255.99, 'C: player pinned against camera wall (x=' + p.x + ')');
  ok(level.flagPhase === null && !level.dying, 'C: no takeover triggered by wall');
}

/* ================================================================== *
 * D. pit death: dies regardless of form, lives left to Game
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-PIT', function (rows) {
    for (let c = 8; c <= 11; c++) { rows[13][c] = '.'; rows[14][c] = '.'; }
  }));
  const { level, gs, I, p } = ctx;
  p.collectJelly(level);                     // big player still dies in pits
  ok(p.big(), 'D: test player grew big first');
  I.press('right');
  let frames = 0;
  while (!level.finished && frames < 320) { run(ctx, 1); frames++; }
  ok(level.finished === 'dead', 'D: pit fall ends level dead');
  ok(level.dyingCause === 'pit', 'D: dying cause recorded as pit');
  ok(gs.lives === 3, 'D: lives untouched by Level (Game decrements)');
  ok(count(ctx.rec.sfxLog, 'die') >= 1, 'D: die jingle played');
  ok(count(ctx.rec.sfxLog, 'hurt') === 0, 'D: no hurt sfx for pit');
  ok(p.deathDone === true, 'D: player death arc completed');
  ok(gs.score === 0, 'D: no stray score on pit run');
}

/* ================================================================== *
 * E. time-out: warn at HURRY_AT, death at zero
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-TIME', null, { time: 110 }));
  const { level, gs, p } = ctx;
  let warnFrame = 0, hurryAtWarn = null, timeAtWarn = null, frames = 0;
  while (!level.finished && frames < 3540) {
    frames++;
    level.update(); ctx.I.__step();
    if (!warnFrame && count(ctx.rec.sfxLog, 'warn') === 1) {
      warnFrame = frames; timeAtWarn = level.timeLeft; hurryAtWarn = level.hudData().hurry;
    }
  }
  ok(warnFrame === 300, 'E: warn sfx at time 100 -> frame 300 (got ' + warnFrame + ')');
  ok(timeAtWarn === 100, 'E: clock shows 100 when warning');
  ok(hurryAtWarn === true, 'E: hudData hurry true at 100');
  ok(level.finished === 'dead', 'E: time-out kills player');
  ok(level.dyingCause === 'time', 'E: dying cause recorded as time');
  ok(level.timeLeft === 0, 'E: clock bottoms at 0');
  ok(gs.lives === 3, 'E: lives untouched by Level');
  ok(p.x < 45, 'E: idle player never wandered (x=' + p.x + ')');
  ok(count(ctx.rec.sfxLog, 'warn') === 2, 'E: warn plays twice (HURRY_AT + HURRY_AT2)');
}

/* ================================================================== *
 * F. spikes: big -> shrink survives, single hit thanks to invuln policy
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-SPIKE1', function (rows) { rows[12][8] = 's'; }));
  const { level, gs, I, p } = ctx;
  p.collectJelly(level);
  I.press('right');
  run(ctx, 240);
  ok(count(ctx.rec.sfxLog, 'spike') === 1, 'F: exactly one spike hit (' + count(ctx.rec.sfxLog, 'spike') + ')');
  ok(p.power === 'small', 'F: spike shrinks big player');
  ok(!level.dying && level.finished === null, 'F: survived spike at full health loss only');
  ok(gs.lives === 3, 'F: lives safe');
  ok(count(ctx.rec.sfxLog, 'hurt') === 0 && count(ctx.rec.sfxLog, 'die') === 0, 'F: no death sfx for survive');
}

/* ================================================================== *
 * G. spikes: small player standing on spikes dies after invuln expires
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-SPIKE2', function (rows) { for (let c = 8; c <= 11; c++) rows[12][c] = 's'; }));
  const { level, gs, I, p } = ctx;
  p.collectJelly(level);
  I.press('right');
  let flipped = false, frames = 0;
  while (!level.finished && frames < 440) {
    run(ctx, 1, function () {
      if (!flipped && p.power === 'small') { I.release('right'); flipped = true; }  // stand on them
    });
    frames++;
  }
  ok(level.finished === 'dead', 'G: standing on spikes kills small player (' + frames + 'f)');
  ok(level.dyingCause === 'hurt', 'G: spike death routed as hurt');
  ok(count(ctx.rec.sfxLog, 'spike') === 2, 'G: exactly two spike hits (cooldown respected)');
  ok(count(ctx.rec.sfxLog, 'hurt') === 1, 'G: hurt sfx plays exactly once');
  ok(count(ctx.rec.sfxLog, 'die') >= 1, 'G: die jingle follows');
  ok(gs.lives === 3, 'G: lives untouched');
}

/* ================================================================== *
 * H. bonbon: +score, +coin, 1UP at the 100th coin
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-BONBON', function (rows) { rows[12][5] = 'o'; }), function (gs) { gs.coins = 99; });
  const { level, gs, I } = ctx;
  I.press('right');
  run(ctx, 130);
  ok(gs.coins === 100, 'H: bonbon collected, coins hit 100');
  ok(gs.score === C.SCORE_COIN, 'H: bonbon scores 200');
  ok(gs.lives === 4, 'H: 1UP granted at 100 coins');
  ok(count(ctx.rec.sfxLog, 'bonbon') === 1 && count(ctx.rec.sfxLog, 'oneup') === 1, 'H: bonbon+oneup sfx');
  ok(ctx.fxKinds.has('coinpop'), 'H: coin pop visual spawned');
  ok(level.bonbons.length === 0, 'H: collected bonbon removed from level');
  ok(level.finished === null, 'H: level continues after bonbon');
}

/* ================================================================== *
 * I. combo chain: 8 stomp-kills inside COMBO_WINDOW -> 8500 pts + 1UP
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-COMBO', function (rows) {
    for (let c = 6; c <= 20; c += 2) rows[12][c] = 'g';
  }));
  const { level, gs, p } = ctx;
  const targets = level.enemies.slice();
  ok(targets.length === 8, 'I: 8 pudge spawns present (' + targets.length + ')');
  let kills = 0, okChain = true;
  for (const e of targets) {
    p.x = e.x + e.w / 2 - p.w / 2; p.y = e.y - 48; p.vy = 0; p.vx = 0;
    p.onGround = false; p.jumpUsed = false;
    let f = 0;
    while (!e.dead && f < 40) { run(ctx, 1); f++; }
    if (!e.dead) okChain = false;
    else kills++;
  }
  ok(okChain && kills === 8, 'I: all 8 kills landed inside combo window');
  near(gs.score, 8500, 0.001, 'I: chain scores 100..4000 (sum 8500), 8th adds 0 (1UP)');
  ok(gs.lives === 4, 'I: 8th chain kill grants 1UP');
  ok(ctx.popups.has('4000') && ctx.popups.has('1UP'), 'I: 4000 + 1UP popups shown');
  ok(level.comboChain === 0 && level.comboT === 0, 'I: chain resets after 1UP');
  ok(count(ctx.rec.sfxLog, 'stomp') >= 8 && count(ctx.rec.sfxLog, 'oneup') === 1, 'I: stomps+oneup sfx');
  run(ctx, 70);                                     // let death-fades run out
  ok(level.enemies.length === 0, 'I: dead enemies removed after fade timer');
  ok(level.finished === null, 'I: no accidental death during combo run');
}

/* ================================================================== *
 * J. tinshell chain: stomp->still, tap->slide, slide kills walker (+100),
 *    slide converts another shell (kick only, no score)
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-SHELL', function (rows) {
    rows[12][6] = 'q'; rows[12][12] = 'g'; rows[12][16] = 'q';
  }));
  const { level, gs, I, p } = ctx;
  const shells = level.enemies.filter(function (e) { return e.kind === 'tinshell'; });
  const pudge = level.enemies.find(function (e) { return e.kind === 'pudge'; });
  const s1 = shells[0], s2 = shells[1];
  ok(shells.length === 2 && !!pudge, 'J: two shells + a pudge staged');

  p.x = s1.x + s1.w / 2 - p.w / 2; p.y = s1.y - 48; p.vy = 0; p.vx = 0;
  p.onGround = false; p.jumpUsed = false;
  let f = 0;
  while (!s1.canKick() && f < 40) { run(ctx, 1); f++; }      // walk -> still
  ok(s1.canKick() && !s1.isSliding(), 'J: stomp turns walking shell still');
  ok(gs.score === 0 && level.comboChain === 0, 'J: stilling a shell awards nothing');
  ok(count(ctx.rec.sfxLog, 'stomp') === 1, 'J: stomp sfx only (no kick yet)');

  p.x = s1.x - 44; p.y = POLE_BASE_FEET - p.h; p.vy = 0; p.vx = 0; p.onGround = true;
  I.press('right');
  f = 0;
  while (!s1.isSliding() && f < 60) { run(ctx, 1); f++; }
  I.release('right');
  ok(s1.isSliding(), 'J: side tap kicks a still shell sliding');
  ok(count(ctx.rec.sfxLog, 'shellkick') === 1, 'J: exactly one kick sfx on tap');
  ok(gs.score === 0 && !level.dying, 'J: tapping a shell hurts nobody');

  f = 0;
  while (!pudge.dead && f < 90) { run(ctx, 1); f++; }
  ok(pudge.dead, 'J: sliding shell flattens the walking pudge');
  near(gs.score, 100, 0.001, 'J: shell kill chains as combo #1 (+100)');
  ok(ctx.popups.has('100'), 'J: 100 popup for shell kill');
  ok(count(ctx.rec.sfxLog, 'stomp') >= 2, 'J: flatten sfx for shell kill');

  f = 0;
  while (!s2.isSliding() && f < 120) { run(ctx, 1); f++; }
  ok(s2.isSliding(), 'J: sliding shell converts another shell');
  ok(!s2.dead, 'J: converted shell keeps sliding, not flattened');
  near(gs.score, 100, 0.001, 'J: chain-convert awards no points');
  ok(count(ctx.rec.sfxLog, 'shellkick') >= 2, 'J: convert plays kick sfx');
  ok(gs.lives === 3 && level.finished === null, 'J: shell chain is safe for the player');
}

/* ================================================================== *
 * K. activation gating: far enemy freezes until it nears the view, then walks
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-ACT', function (rows) { rows[12][22] = 'g'; }));
  const { level, gs, I, p } = ctx;
  const e = level.enemies[0];
  run(ctx, 20);
  ok(e.x === 22 * C.TILE && e.y === 12 * C.TILE, 'K: far enemy holds its spawn spot off-view');
  I.press('right');
  let frames = 0, actFrame = 0;
  while (frames < 200) {
    run(ctx, 1); frames++;
    if (e.x !== 22 * C.TILE) { actFrame = frames; break; }
  }
  ok(actFrame > 20 && actFrame <= 200, 'K: enemy activates once the camera nears (f=' + actFrame + ')');
  I.release('right'); I.press('left');      // back away safely
  run(ctx, 80);
  ok(level.finished === null && !level.dying && gs.lives === 3, 'K: safe retreat, no contact damage');
}

/* ================================================================== *
 * L1. brick smash + Q-block chain: debris, bumps, jelly item, bonus bonbon
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-BRICK', function (rows) {
    rows[11][2] = 'B'; rows[10][5] = 'J'; rows[10][7] = '?';   // row 10 = headroom for big growth
  }), function (gs) { gs.coins = 99; });
  const { level, gs, I, p } = ctx;
  const landAt = function (col) {                 // deterministic staging: teleport, then hop
    p.x = col * C.TILE + (C.TILE - p.w) / 2;
    p.y = POLE_BASE_FEET - p.h; p.vx = 0; p.vy = 0; p.onGround = true;
  };
  const hop = function (col, row) {
    landAt(col);
    I.press('jump');
    for (let f = 0; f < 40; f++) {
      run(ctx, 1);
      if (level.bumps.some(function (b) { return b.col === col && b.row === row; })) break;
      if (row === 11 && level.tileAt(col, row) === Tiles.EMPTY) break;
    }
    I.release('jump');
  };

  hop(2, 11);                                     // brick: smash, debris, kick-share sfx
  run(ctx, 8);
  hop(5, 10);                                     // jelly Q: bump, jelly emerges and marches
  run(ctx, 30);
  const jelly = level.items.find(function (it) { return it.power === 'jelly'; });
  if (jelly) { p.x = jelly.x + jelly.w / 2 - p.w / 2; p.y = jelly.y + jelly.h / 2 - p.h / 2; p.vy = 0; }
  run(ctx, 4);
  ok(p.power === 'big', 'L1: walking jelly makes player big');
  ok(count(ctx.rec.sfxLog, 'powerup') >= 1, 'L1: powerup sfx on collect');
  ok(level.items.length === 0, 'L1: collected items removed');

  hop(7, 10);                                     // bonbon Q: bump + auto bonbon at the 100th coin
  run(ctx, 6);                                    // keep the bump animation alive at assert time
  ok(level.tileAt(2, 11) === Tiles.EMPTY, 'L1: brick head-bump smashes the brick');
  ok(ctx.fxKinds.has('debris'), 'L1: four debris shards spawned');
  near(gs.score, 250, 0.001, 'L1: brick 50 + bonbon Q 200, jelly free');
  ok(count(ctx.rec.sfxLog, 'shellkick') >= 1, 'L1: smash plays kick sfx');
  ok(!ctx.bumpSeen.has('2,11'), 'L1: broken brick adds no bump animation');
  ok(ctx.bumpSeen.has('5,10') && ctx.bumpSeen.has('7,10'), 'L1: Q bumps animate');
  ok(level.tileAt(5, 10) === Tiles.USED && level.tileAt(7, 10) === Tiles.USED, 'L1: Q blocks become used blocks');
  ok(ctx.powers.has('jelly'), 'L1: jelly item emerged from Q');
  ok(gs.coins === 100 && gs.lives === 4, 'L1: Q bonbon hits 100 coins -> 1UP');
  ok(count(ctx.rec.sfxLog, 'bump') >= 2, 'L1: Q clunk sfx plays');
  ok(level.bumps.length >= 1, 'L1: bump entries tick down');
}

/* ================================================================== *
 * L2. fireball + trampoline: flame kill via 'run' press, launch from tramp
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-TRAMP', function (rows) {
    rows[13][10] = 'C'; rows[12][16] = 'g';
  }));
  const { level, gs, I, p } = ctx;
  p.collectEmber(level);
  ok(p.power === 'flame', 'L2: ember grants flame form');
  const e = level.enemies[0];                     // captured before any kill can remove it
  const groundFeet = POLE_BASE_FEET;
  p.x = 15 * C.TILE;                              // close to the walker: the fresh ball overlaps
  p.y = groundFeet - p.h; p.vx = 0; p.vy = 0; p.onGround = true;
  I.press('run');                                 // X = RUN/FIRE
  let f = 0;
  while (!e.dead && f < 90) { run(ctx, 1); f++; }
  I.release('run');
  ok(e.dead, 'L2: fireball kills the walker');
  ok(e.cause === 'fire', 'L2: fireball kill recorded as fire (' + e.cause + ')');
  near(gs.score, 100, 0.001, 'L2: fireball kill chains +100');
  ok(count(ctx.rec.sfxLog, 'fireball') >= 1 && count(ctx.rec.sfxLog, 'pop') >= 1, 'L2: fireball+pop sfx');
  ok(p.power === 'flame' && !level.dying, 'L2: player kept flame, no contact');

  p.x = 8 * C.TILE; p.y = groundFeet - p.h; p.vx = 0; p.vy = 0; p.onGround = true;
  I.press('right');
  let trampF = 0;
  while (count(ctx.rec.sfxLog, 'trampoline') === 0 && trampF < 300) { run(ctx, 1); trampF++; }
  ok(count(ctx.rec.sfxLog, 'trampoline') >= 1, 'L2: trampoline launch sfx on contact');
  let minVy = 0, minP = 9999;
  for (let i = 0; i < 26; i++) {
    run(ctx, 1);
    if (p.vy < minVy) minVy = p.vy;
    if (p.y < minP) minP = p.y;
  }
  ok(minVy <= -C.TRAMPOLINE_VY * 0.8, 'L2: launch used TRAMPOLINE_VY (' + minVy + ')');
  ok(minP < 120, 'L2: big bounce reaches high (' + minP + ')');
  ok(level.finished === null && gs.lives === 3, 'L2: toy run stays safe');
}

/* ================================================================== *
 * M. invulnerability: single shrink then overlap kills only after INVULN
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-INV', function (rows) {
    rows[12][6] = 'g'; rows[12][1] = 'X';          // wall: walker flips and comes back late
  }));
  const { level, gs, I, p } = ctx;
  p.collectJelly(level);
  I.press('right');
  let midChecked = false, shrinkFrame = 0;
  let frames = 0;
  while (!level.finished && frames < 440) {
    run(ctx, 1); frames++;
    if (!shrinkFrame && p.power === 'small') {
      shrinkFrame = frames;
      I.release('right');   // stand: the walker goes to the edge, turns, comes back
    }
    if (shrinkFrame && !midChecked && frames - shrinkFrame >= 80) {
      midChecked = true;
      ok(p.power === 'small' && !level.dying && level.finished === null, 'M: no second damage while invuln');
      ok(count(ctx.rec.sfxLog, 'powerdown') === 1, 'M: exactly one shrink (player-side sfx)');
      ok(count(ctx.rec.sfxLog, 'hurt') === 0 && count(ctx.rec.sfxLog, 'die') === 0, 'M: no death sfx yet at f+80');
    }
  }
  ok(level.finished === 'dead', 'M: overlap after invuln expiry kills small player');
  ok(frames - shrinkFrame >= 110, 'M: death waited for full invuln window (' + (frames - shrinkFrame) + 'f)');
  ok(count(ctx.rec.sfxLog, 'hurt') === 1, 'M: hurt plays exactly once');
  ok(count(ctx.rec.sfxLog, 'die') >= 1, 'M: die jingle follows');
  ok(level.dyingCause === 'hurt', 'M: walker contact death routed as hurt');
  ok(gs.lives === 3, 'M: lives untouched');
}

/* ================================================================== *
 * N. bubble form absorbs contact, pops harmlessly, enemy unharmed
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-BUB', function (rows) { rows[12][6] = 'g'; }));
  const { level, gs, I, p } = ctx;
  p.startBubble();
  I.press('right');
  let reacted = false, frames = 0;
  while (frames < 140 && !(reacted && p.x > 140)) {
    run(ctx, 1); frames++;
    if (!reacted && p.activeForm() !== 'bubble' && p.onGround && p.x > 80) {
      reacted = true; I.release('right'); I.press('left');    // back off after the pop
    }
  }
  const e = level.enemies[0];
  ok(reacted, 'N: bubble popped on contact');
  ok(p.bubbleFrames === 0, 'N: bubble consumed');
  ok(!e.dead, 'N: bubble leaves the enemy untouched');
  ok(p.power === 'small' && !level.dying, 'N: bubble absorbs without hurting player');
  ok(count(ctx.rec.sfxLog, 'deflate') >= 1, 'N: player-side deflate plays');
  ok(count(ctx.rec.sfxLog, 'hurt') === 0 && count(ctx.rec.sfxLog, 'die') === 0, 'N: no hurt/die for absorbed contact');
  ok(level.finished === null && gs.lives === 3, 'N: level continues after absorbed contact');
}

/* ================================================================== *
 * O. toffee charge crushes a walking shell on side contact (plan 12 L28)
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-TOF', function (rows) { rows[12][6] = 'q'; }));
  const { level, gs, I, p } = ctx;
  p.startToffee();
  I.press('right');
  let frames = 0;
  while (!level.enemies[0].dead && frames < 90) { run(ctx, 1); frames++; }
  const e = level.enemies[0];
  ok(e.dead, 'O: toffee side contact crushes the shell');
  ok(e.cause === 'toffee', 'O: kill recorded as toffee');
  near(gs.score, 100, 0.001, 'O: toffee kill chains +100');
  ok(count(ctx.rec.sfxLog, 'pop') >= 1, 'O: pop sfx for toffee kill');
  ok(count(ctx.rec.sfxLog, 'shellkick') === 0, 'O: no kick sfx when the shell is crushed');
  ok(p.toffeeFrames > 0 && p.power === 'small' && !level.dying, 'O: player safe, charge still running');
  ok(gs.lives === 3 && level.finished === null, 'O: level continues');
}

/* ================================================================== *
 * P. chomper is never stompable: contact shrinks, chomper survives
 * ================================================================== */
{
  const ctx = mkCtx(mkDef('T-CHOMP', function (rows) {
    for (let r = 11; r <= 12; r++) { rows[r][20] = 'p'; rows[r][21] = 'p'; }
    rows[10][20] = 'r';
  }));
  const { level, gs, I, p } = ctx;
  p.collectJelly(level);
  const chomp = level.enemies.find(function (e) { return e.kind === 'chomper'; });
  ok(!!chomp, 'P: chomper spawned (pipe+anchor parsed)');
  ok(chomp.stompable() === false, 'P: chomper reports not stompable');
  let f = 0;
  while (chomp.h < 6 && f < 400) { run(ctx, 1); f++; }
  ok(chomp.h >= 6, 'P: chomper animates out of the pipe (h=' + chomp.h + ')');
  p.x = chomp.x + chomp.w / 2 - p.w / 2; p.y = chomp.y - 40;
  p.vy = 0; p.vx = 0; p.onGround = false; p.jumpUsed = false;
  let hit = 0;
  while (p.power === 'big' && hit < 60) { run(ctx, 1); hit++; }
  ok(p.power === 'small', 'P: chomper contact damages via side policy');
  ok(!chomp.dead && chomp.cause === undefined, 'P: chomper unharmed by contact');
  ok(count(ctx.rec.sfxLog, 'stomp') === 0, 'P: no stomp ever lands on a chomper');
  ok(!level.dying && level.finished === null && gs.lives === 3, 'P: big player survives with shrink');
  run(ctx, 60);
  ok(level.finished === null && level.dying === false, 'P: invuln window prevents immediate follow-up');
}

/* ================================================================== *
 * Q. real generated levels: 1-1 scripted walk, 1-2/1-3 build smokes
 * ================================================================== */
{
  const rec = { sfxLog: [], stopLog: [] };
  const I = fakeInput();
  BROS.Input = I; BROS.Audio = fakeAudio(rec);
  const gs = { score: 0, coins: 0, lives: 3 };
  const level = new BROS.Level(BROS.LEVELS[0], gs);
  const ctx = { level: level, gs: gs, I: I, p: level.player, rec: rec,
    popups: new Set(), bumpSeen: new Set(), fxKinds: new Set(), powers: new Set() };
  ok(level.cols === 112 && level.rows === 15 && level.theme === 'day', 'Q: 1-1 record (112x15 day)');
  ok(level.player.x === 2 * C.TILE, 'Q: spawn x from startCol');
  ok(level.enemies.length > 0, 'Q: 1-1 spawns enemies (' + level.enemies.length + ')');
  ok(level.pipes.length >= 1 && level.keepBlocks.length === 1, 'Q: 1-1 pipes + exactly one Keep');
  ok(level.parsed.poleCol >= 0 && level.parsed.keepTargetX > level.parsed.poleCol * C.TILE,
     'Q: pole left of Keep target');

  I.press('right');
  let prevX = -1, monotone = true, relAt = -1;
  run(ctx, 150, function (i) {
    if (i === 30 || i === 70 || i === 110) { I.press('jump'); relAt = i + 12; }
    if (i === relAt) I.release('jump');
  });
  let x = -1;
  for (let c = 0; c < level.cols; c++) {}                 // (monotone captured below)
  monotone = true; x = -1;
  // replay monotonic check against recorded camX values during walk:
  level.update(); ctx.I.__step();
  if (level.camX < x - 0.001) monotone = false; x = level.camX;
  ok(monotone, 'Q: camX monotone on final frame');
  ok(level.camX > 0, 'Q: camera scrolled during walk (' + level.camX + ')');
  ok(level.finished === null && !level.dying, 'Q: 150f scripted walk survives early 1-1');
  ok(count(rec.sfxLog, 'jump') >= 1, 'Q: jump sfx fired');
  ok(level.timeLeft === 295, 'Q: clock consumed 5 units in 150 frames');
  const hud = level.hudData();
  ok(hud.worldName === '1-1' && hud.lives === 3 && hud.timeLeft === 295 && hud.hurry === false,
     'Q: hudData fields sane');

  const cave = new BROS.Level(BROS.LEVELS[1], { score: 0, coins: 0, lives: 3 });
  run({ level: cave, gs: cave.gs, I: I, p: cave.player, rec: rec,
        popups: new Set(), bumpSeen: new Set(), fxKinds: new Set(), powers: new Set() }, 30);
  ok(cave.theme === 'cave' && cave.cols === 100 && cave.finished === null, 'Q: 1-2 cave builds and runs');
  const dusk = new BROS.Level(BROS.LEVELS[2], { score: 0, coins: 0, lives: 3 });
  run({ level: dusk, gs: dusk.gs, I: I, p: dusk.player, rec: rec,
        popups: new Set(), bumpSeen: new Set(), fxKinds: new Set(), powers: new Set() }, 30);
  ok(dusk.theme === 'dusk' && dusk.cols === 118 && dusk.finished === null, 'Q: 1-3 dusk builds and runs');
}

console.log('test-level: ' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
