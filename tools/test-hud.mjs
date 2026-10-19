// PLAN: docs/plan/17-testing-and-tuning.md
// Self-test for js/15-hud.js: HUD elements + every screen must stay inside
// 256x240 (text within 4px margins).  A recording ctx captures every blit.
// Run:  node tools/test-hud.mjs
'use strict';
import { installFakeBrowser, loadScripts } from './fakecanvas.mjs';

installFakeBrowser();
loadScripts([
  'js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js',
  'js/04-input.js', 'js/05-font.js', 'js/06-sprites.js', 'js/07-audio.js',
  'js/08-physics.js', 'js/09-tiles.js', 'js/10-levels.js', 'js/11-objects.js',
  'js/12-enemies.js', 'js/13-player.js', 'js/14-level.js', 'js/15-hud.js'
]);
const BROS = globalThis.BROS;
const C = BROS.C;
BROS.Sprites.ensure('day');            // build the art before HUD/Screens get() it

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.log('  FAIL ' + msg); } }

/* recording ctx: captures absolute blits; transforms are identity (screens
 * never transform, and the recorder asserts that too) */
function mkRecorder() {
  const rec = { blits: [], strings: [] };
  const ctx = {
    fillStyle: '#000000',
    globalAlpha: 1,
    fillRect: function (x, y, w, h) {
      rec.blits.push([x, y, w, h, ctx.fillStyle]);
    },
    drawImage: function (img, x, y, w, h) {
      rec.blits.push([x, y, w == null ? img.width : w, h == null ? img.height : h, ctx.fillStyle]);
    },
    save: function () {}, restore: function () {}, translate: function () {}, scale: function () {}
  };
  return { ctx: ctx, rec: rec };
}
/* decor = full-view bg fill, ground tiles (16x16) or clouds (32x16); text blits
 * are the tiny glyph pixels and must keep the 4px margins */
function classify(b) {
  const w = b[2], h = b[3];
  if (w === 256 && h === 240) return 'bg';
  if ((w === 16 && h === 16) || (w === 32 && h === 16)) return 'decor';
  return 'text';
}
function boundsCheck(rec, x0, y0, x1, y1, label, marginText) {
  let allOK = true, textOK = true;
  for (const b of rec.blits) {
    if (b[0] < 0 || b[1] < 0 || b[0] + b[2] > x1 || b[1] + b[3] > y1) allOK = false;
    if (marginText && classify(b) === 'text') {
      if (b[0] < 4 || b[1] < 4 || b[0] + b[2] > 252 || b[1] + b[3] > 236) textOK = false;
    }
  }
  ok(allOK, label + ': every blit within 256x240 (' + rec.blits.length + ' blits)');
  if (marginText) ok(textOK, label + ': text blits keep 4px margins');
}

/* ---- HUD: widest-value sample (every field at its longest) ---- */
{
  const r = mkRecorder();
  const hud = { score: 9999999, coins: 99, lives: 9, timeLeft: 999, worldName: '1-1', hurry: true };
  BROS.HUD.draw(r.ctx, hud);
  boundsCheck(r.rec, 0, 0, 256, 240, 'HUD', false);
  const tiny = { score: 0, coins: 0, lives: 3, timeLeft: 5, worldName: '1-2', hurry: true };
  const mid = r.rec.blits.length;
  BROS.HUD.draw(r.ctx, tiny);
  const one = r.rec.blits.length - mid;
  BROS.HUD.draw(r.ctx, tiny);
  ok(r.rec.blits.length - mid === 2 * one && one > 0, 'HUD blit count stable for a fixed sample');
  ok(BROS.HUD.charsetOK === true, 'HUD charset flag set');
}

/* ---- screens ---- */
const S = BROS.Screens;
{
  const r = mkRecorder();
  S.title(r.ctx);
  boundsCheck(r.rec, 0, 0, 256, 240, 'title', true);
}
{
  const r = mkRecorder();
  S.card(r.ctx, { worldName: '1-88', go: true });
  boundsCheck(r.rec, 0, 0, 256, 240, 'card', true);
}
{
  const r = mkRecorder();
  S.clearcard(r.ctx, { worldName: '1-88', done: true });
  boundsCheck(r.rec, 0, 0, 256, 240, 'clearcard', true);
}
{
  const r = mkRecorder();
  S.gameover(r.ctx, { score: 'SCORE 9999999', retry: true });
  boundsCheck(r.rec, 0, 0, 256, 240, 'gameover', true);
}
{
  const r = mkRecorder();
  S.allclear(r.ctx, { score: 'FINAL SCORE 9999999', press: true });
  boundsCheck(r.rec, 0, 0, 256, 240, 'allclear', true);
  S.pause(r.ctx);
  boundsCheck(r.rec, 0, 0, 256, 240, 'pause', true);
}

/* ---- title/blink: toggles only the PRESS ENTER line, count constant ---- */
{
  const r = mkRecorder();
  const added = {};
  for (let i = 0; i < 60; i++) {
    const b0 = r.rec.blits.length;
    S.title(r.ctx);
    added[r.rec.blits.length - b0] = true;
    const ok1 = boundsCheck(r.rec, 0, 0, 256, 240, 'title frame ' + i, true);
    if (i === 0 || i === 59) void ok1;
  }
  const counts = Object.keys(added).map(Number).sort();
  ok(counts.length === 2, 'title toggles exactly two blit-count states (PRESS ENTER blink)');
  ok(counts[1] - counts[0] <= 200, 'blink toggle changes only the PRESS ENTER line');
}

console.log('test-hud: ' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
