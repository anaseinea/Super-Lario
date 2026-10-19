// PLAN: docs/plan/17-testing-and-tuning.md
// Headless self-test for js/16-game.js: full state-machine flow on the REAL
// generated LEVELS with scripted Input/Audio fakes (fake canvas via fakecanvas).
// Menu/card screens are drawn through a blit recorder and checked in-bounds;
// level frames are NOT drawn (world-space coords + canvas transforms).
// Run:  node tools/test-game.mjs
'use strict';
import { installFakeBrowser, loadScripts } from './fakecanvas.mjs';

installFakeBrowser();
loadScripts([
  'js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js',
  'js/04-input.js', 'js/05-font.js', 'js/06-sprites.js', 'js/07-audio.js',
  'js/08-physics.js', 'js/09-tiles.js', 'js/10-levels.js', 'js/11-objects.js',
  'js/12-enemies.js', 'js/13-player.js', 'js/14-level.js', 'js/15-hud.js',
  'js/16-game.js'
]);
const BROS = globalThis.BROS;
const C = BROS.C;
BROS.Sprites.ensure('day');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.log('  FAIL ' + msg); }
}

/* ---------- fake Input: mirrors 04-input.js late-bound API ---------- */
const ACTIONS = ['left', 'right', 'down', 'jump', 'run', 'start', 'pause', 'mute'];
function mkInput() {
  const held = {}, just = {}, prev = {}, pend = {};
  let buf = 99;
  const inp = {};
  inp.press = function (a) { held[a] = true; pend[a] = true; };
  inp.release = function (a) { held[a] = false; pend[a] = false; };
  inp.down = function (a) { return !!held[a]; };
  inp.pressed = function (a) { return !!just[a]; };
  inp.update = function () {
    for (const a of ACTIONS) {
      just[a] = !!held[a] && (!prev[a] || !!pend[a]);   // one press event = one just
      prev[a] = !!held[a];
      pend[a] = false;
    }
    buf = just.jump ? 0 : buf + 1;
  };
  inp.consume = function (a) {
    if (just[a]) { just[a] = false; return true; }
    return false;
  };
  inp.clear = function () {
    for (const a of ACTIONS) { held[a] = false; just[a] = false; prev[a] = false; pend[a] = false; }
    buf = 99;
  };
  inp.anyPressed = function () {
    for (const a of ACTIONS) if (just[a]) return true;
    return false;
  };
  inp.jumpBufferFrames = function () { return buf; };
  return inp;
}

/* ---------- fake Audio recorder ---------- */
const rec = { sfx: [], music: [], stopped: [], paused: null };
const fakeAudio = {
  sfx: function (n) { rec.sfx.push(n); },
  playMusic: function (n) { rec.music.push(n); },
  stopMusic: function () { rec.stopped.push(1); },
  setPaused: function (v) { rec.paused = v; },
  tickMusic: function () {}, ensure: function () {}, unlock: function () {},
  toggleMute: function () {}, currentMusic: function () { return null; },
  musicDone: function () { return true; }
};
BROS.Audio = fakeAudio;                      // late-bound everywhere

/* ---------- recording ctx: menus draw through it, blits captured ---------- */
function mkCtx() {
  const blits = [];
  const c = { fillStyle: '', globalAlpha: 1 };
  c.fillRect = function (x, y, w, h) { blits.push([x, y, w, h]); };
  c.drawImage = function (img, x, y) { blits.push([x, y, img.width, img.height]); };
  c.save = function () {}; c.restore = function () {};
  c.translate = function () {}; c.scale = function () {};
  return { ctx: c, blits: blits };
}
function inBounds(list, x1, y1) {
  for (const b of list) {
    if (b[0] < 0 || b[1] < 0 || b[0] + b[2] > x1 || b[1] + b[3] > y1) return false;
  }
  return true;
}
function poleColOf(i) {
  const map = BROS.LEVELS[i].map;
  let pc = -1;
  for (const row of map) { const c = row.indexOf('I'); if (c > pc) pc = c; }
  return pc;
}

const ctxR = mkCtx();
const I = mkInput();
const game = BROS.Game.create(null, ctxR.ctx, I);

/* ================= F1: title -> card -> play -> flag -> tally -> clear ==== */
{
  ok(game.state === 'title' && game.level === null, 'F1: fresh game at title');
  ok(game.gs.lives === C.LIVES_START, 'F1: lives from constants');
  ok(typeof BROS.DEBUG.grantCoins === 'function', 'F1: debug grantCoins hook');

  for (let i = 0; i < 31; i++) { game.step(); game.draw(); }   // title blink
  ok(inBounds(ctxR.blits, 256, 240), 'F1: title frames in bounds');

  I.press('start');
  game.step();
  ok(game.state === 'card', 'F1: START -> card');
  ok(game.lock === C.MENU_LOCKOUT, 'F1: 30f menu lockout armed');
  ok(rec.music.indexOf('card') >= 0, 'F1: card tune on card entry');
  ok(game.gs.score === 0 && game.gs.coins === 0, 'F1: gs reset');

  I.press('start');                       // same gesture must not cascade
  game.step();
  ok(game.state === 'card' && game.lock === C.MENU_LOCKOUT - 1,
    'F1: held start swallowed by lockout');

  let guard = 0;
  while (game.state !== 'play' && guard++ < 400) game.step();
  ok(game.state === 'play', 'F1: card auto-advanced at CARD_AUTO');
  ok(game.cardT >= C.CARD_AUTO, 'F1: auto at 90f');
  ok(game.level !== null && game.level.theme === 'day', 'F1: level 1-1 built (day)');
  ok(rec.music.indexOf('main') >= 0, 'F1: day->main music map');

  const lv = game.level;
  const pc = poleColOf(0);
  ok(pc > 0, 'F1: pole found in generated map');
  const p = lv.player;
  p.x = pc * C.TILE + C.TILE / 2 - p.w / 2 + 1;      // cross the pole midline
  p.y = 12 * C.TILE - p.h;
  let frames = 0;
  while (game.state === 'play' && frames++ < 600) game.step();
  ok(game.state === 'tally', 'F1: flag sequence completes -> tally');
  ok(rec.stopped.length >= 1, 'F1: Level stopped music at flag grab');
  ok(lv.timeLeft > 0, 'F1: tally not started inside Level.update');

  let tallyGuard = 0;
  while (game.state === 'tally' && tallyGuard++ < 400) game.step();
  ok(game.state === 'clear', 'F1: tally -> clearcard');
  ok(tallyGuard <= 180, 'F1: 300s tally ticks in ' + tallyGuard + 'f (<3s)');
  ok(lv.timeLeft === 0, 'F1: tally clock drained');
  ok(rec.music.indexOf('clear') >= 0, 'F1: clear tune after tally');
  ok(lv.hudData().score > 0, 'F1: tally converted into shared gs score');

  let f = 0;
  while (game.lock > 0 && f++ < 40) game.step();
  I.press('start');
  game.step();
  ok(game.state === 'card' && game.levelIdx === 1, 'F1: clear -> card of next level');
  guard = 0;
  while (game.state !== 'play' && guard++ < 400) game.step();
  ok(game.level.theme === 'cave', 'F1: 1-2 built (cave)');
  ok(rec.music.indexOf('cave') >= 0, 'F1: cave->cave music map');
  ok(game.level.timeLeft === BROS.LEVELS[1].time, 'F1: fresh level clock');
}

/* ================= F2: pause freezes play, resumes ---------------------- */
{
  const t0 = game.level.timeLeft, x0 = game.level.player.x;
  I.press('pause');
  game.step();
  ok(game.paused === true, 'F2: P -> paused');
  ok(rec.paused === true, 'F2: Audio.setPaused(true) (music bus keeps running)');
  ok(rec.sfx.filter(function (s) { return s === 'pause'; }).length === 1, 'F2: pause sfx on toggle');
  for (let i = 0; i < 60; i++) game.step();
  ok(game.paused === true, 'F2: stays paused while held');
  ok(game.level.timeLeft === t0, 'F2: clock frozen (60f)');
  ok(game.level.player.x === x0, 'F2: player frozen (no drift, 60f)');
  I.release('pause'); I.press('pause');
  game.step();
  ok(game.paused === false, 'F2: P again -> resume');
  ok(rec.paused === false, 'F2: setPaused(false)');
  ok(rec.sfx.filter(function (s) { return s === 'pause'; }).length === 2, 'F2: pause sfx both toggles');
  for (let i = 0; i < 31; i++) game.step();
  ok(game.level.timeLeft < t0, 'F2: clock resumes after unpause');
}

/* ================= F3: deaths cost exactly one life -> gameover --------- */
{
  const gs0 = game.gs.lives;
  let deaths = 0;
  while (true) {
    let g = 0;
    while (game.state !== 'play' && g++ < 700) game.step();
    if (game.state === 'gameover') break;
    const p3 = game.level.player;
    p3.y = 500;                                  // under the floor: pit fall
    let f3 = 0;
    while (game.state === 'play' && f3++ < 420) game.step();
    deaths++;
    ok(game.gs.lives === gs0 - deaths, 'F3: exactly one life lost per death');
    if (deaths >= 6) break;                      // runaway guard, real assert below
    if (deaths < 3) ok(game.state === 'card', 'F3: death -> card of same level');
  }
  ok(deaths === 3, 'F3: 3 lives cost 3 deaths -> game over');
  ok(game.state === 'gameover', 'F3: gameover state');
  ok(rec.music.indexOf('gameover') >= 0, 'F3: gameover tune');
  game.draw();
  ok(inBounds(ctxR.blits, 256, 240), 'F3: gameover screen in bounds');
  let f = 0;
  while (game.lock > 0 && f++ < 40) game.step();
  I.press('start');
  game.step();
  ok(game.state === 'title', 'F3: ENTER -> back to title');
}

/* ================= F4: all three levels -> allclear -> title ------------ */
{
  const ctx4 = mkCtx();
  const I4 = mkInput();
  const g3 = BROS.Game.create(null, ctx4.ctx, I4);
  I4.press('start');
  g3.step();
  let guard = 0;
  while (g3.state !== 'play' && guard++ < 500) g3.step();
  ok(g3.state === 'play' && g3.levelIdx === 0, 'F4: entered level 1');

  for (let i = 0; i < BROS.LEVELS.length; i++) {
    const p4 = g3.level.player;
    const pc = poleColOf(i);
    p4.x = pc * C.TILE + C.TILE / 2 - p4.w / 2 + 1;
    p4.y = 12 * C.TILE - p4.h;
    let f = 0;
    while (g3.state === 'play' && f++ < 700) g3.step();
    ok(g3.state === 'tally' || g3.state === 'clear', 'F4: level ' + (i + 1) + ' completed by flag');
    f = 0;
    while (g3.state === 'tally' && f++ < 400) g3.step();
    ok(g3.state === 'clear', 'F4: level ' + (i + 1) + ' -> clearcard');
    ok(g3.levelIdx === i, 'F4: progression index held by Game');
    let g = 0;
    while (g3.lock > 0 && g++ < 40) g3.step();
    I4.press('start');
    g3.step();
    if (g3.state === 'card') {
      g3.draw();                                   // next card frame
      guard = 0;
      while (g3.state !== 'play' && guard++ < 500) g3.step();
    }
  }
  ok(g3.state === 'allclear', 'F4: last clear -> allclear');
  ok(rec.music.indexOf('dusk') >= 0, 'F4: dusk->dusk music map');
  g3.draw();
  ok(inBounds(ctx4.blits, 256, 240), 'F4: card+allclear blits in bounds');
  let f = 0;
  while (g3.lock > 0 && f++ < 40) g3.step();
  I4.press('start');
  g3.step();
  ok(g3.state === 'title', 'F4: allclear -> title');
}

/* ================= F5: pause during card also freezes ------------------- */
{
  const ctx5 = mkCtx();
  const I5 = mkInput();
  const g5 = BROS.Game.create(null, ctx5.ctx, I5);
  I5.press('start');
  g5.step();                                   // -> card
  I5.press('pause');
  g5.step();
  ok(g5.paused === true && g5.state === 'card', 'F5: pause works in card too');
  const tA = g5.cardT;
  for (let i = 0; i < 30; i++) g5.step();
  ok(g5.cardT === tA, 'F5: card timer frozen while paused');
  I5.release('pause'); I5.press('pause');
  g5.step();
  ok(g5.paused === false, 'F5: resumed');
  let guard = 0;
  while (g5.state !== 'play' && guard++ < 500) g5.step();
  ok(g5.state === 'play' && g5.levelIdx === 0, 'F5: reached play of 1-1');
}

console.log('test-game: ' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
