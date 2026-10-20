// PLAN: docs/plan/17-testing-and-tuning.md
// Headless check of the audio engine: every SFX recipe fires cleanly, every
// music track compiles and schedules notes, loops loop, one-shots finish.
// Run: node tools/test-audio.mjs
import fs from 'node:fs';
import { installFakeBrowser, loadScripts } from './fakecanvas.mjs';
import { installFakeAudio, FakeAudioContext } from './fakeaudio.mjs';

installFakeBrowser();
installFakeAudio();

const warnings = [];
const realWarn = console.warn, realError = console.error;
console.warn = (m) => warnings.push('warn: ' + m);
console.error = (m) => warnings.push('error: ' + m);

loadScripts(['js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js', 'js/07-audio.js']);
const A = globalThis.BROS.Audio;

const problems = [];

// the shipped game boots with C.MUSIC = false (BGM off); assert that switch
// silences music...
globalThis.BROS.C.MUSIC = false;
A.playMusic('main');
if (A.currentMusic() !== null) problems.push('C.MUSIC=false did not suppress music');
// ...then flip it on so the sequencer itself can be exercised below
globalThis.BROS.C.MUSIC = true;

if (!A.ensure()) problems.push('Audio.ensure() returned false');
const ctx = A.ctx;
if (!ctx) problems.push('no AudioContext after ensure()');

// ---- 1. every SFX recipe in the source must fire without noise ----
const src = fs.readFileSync('js/07-audio.js', 'utf8');
const recipeNames = [];
{
  const re = /^    ([a-z][a-z0-9]*)\(t(?:, opts)?\) \{/gm;
  let m;
  while ((m = re.exec(src)) !== null) recipeNames.push(m[1]);
}
if (recipeNames.length < 15) problems.push('could not find SFX recipes in source (found ' + recipeNames.length + ')');

for (const name of recipeNames) {
  const before = ctx.stats();
  A.sfx(name);
  const after = ctx.stats();
  if (after.oscs + after.srcs <= before.oscs + before.srcs) problems.push('sfx "' + name + '" made no voices');
  ctx.advance(1.5);
  A.tickCleanup();
}
if (A._active !== 0) problems.push('voice counter did not drain after SFX: ' + A._active);
A.sfx('__definitely_not_a_sound__');
if (!warnings.some((w) => /unknown sound/.test(w))) problems.push('unknown sfx name did not warn');
warnings.length = 0;

// ---- 2. music: compile, schedule, loop / finish ----
const names = ['main', 'cave', 'dusk', 'clear', 'gameover', 'card'];
for (const name of names) {
  warnings.length = 0;
  A.playMusic(name);
  if (A.currentMusic() !== name) problems.push(name + ': playMusic did not set currentMusic');
  const before = ctx.stats().oscs;
  // simulate 12 seconds of frames
  for (let f = 0; f < 720; f++) { ctx.advance(1 / 60); A.tickMusic(); }
  const scheduled = ctx.stats().oscs - before;
  // sparse tracks hold notes for a long time, so a low count is legitimate
  if (scheduled < 18) problems.push(name + ': only ' + scheduled + ' notes scheduled in 12s');
  if (warnings.length) problems.push(name + ': compile warnings: ' + warnings.join(' | '));

  const loopish = name === 'main' || name === 'cave' || name === 'dusk';
  if (loopish) {
    if (A.musicDone() !== false) problems.push(name + ': looping track reported musicDone()');
    const mid = ctx.stats().oscs;
    for (let f = 0; f < 720; f++) { ctx.advance(1 / 60); A.tickMusic(); }
    if (ctx.stats().oscs <= mid) problems.push(name + ': loop produced no notes on the second pass');
    if (A.currentMusic() !== name) problems.push(name + ': loop lost currentMusic');
  } else {
    if (A.musicDone() !== true) problems.push(name + ': one-shot track never reported done');
    if (A.currentMusic() !== null) problems.push(name + ': one-shot track left currentMusic set');
  }
  A.stopMusic(0.1);
  for (let f = 0; f < 60; f++) { ctx.advance(1 / 60); A.tickCleanup(); }
  if (A.currentMusic() !== null) problems.push(name + ': stopMusic left currentMusic');
}

// ---- 3. music must not starve gameplay SFX ----
A.playMusic('main');
for (let f = 0; f < 120; f++) { ctx.advance(1 / 60); A.tickMusic(); }
let starved = 0;
for (let i = 0; i < 24; i++) {
  const before = ctx.stats();
  A.sfx('jump');
  if (ctx.stats().oscs === before.oscs) starved++;
  ctx.advance(1 / 60);
  A.tickMusic();
}
if (starved > 2) problems.push('music starved sfx voices ' + starved + '/24 times (voice cap too tight)');
A.stopMusic(0.1);
ctx.advance(1); A.tickCleanup();

// ---- 4. mute / pause do not throw ----
if (A.toggleMute() !== true) problems.push('toggleMute did not mute');
A.sfx('bonbon');
A.playMusic('cave');
A.setPaused(true);
for (let f = 0; f < 60; f++) { ctx.advance(1 / 60); A.tickMusic(); }
A.setPaused(false);
if (A.toggleMute() !== false) problems.push('toggleMute did not unmute');
A.stopMusic(0.1);
ctx.advance(1); A.tickCleanup();

// ---- 4b. lookahead health: 8 s of continuous scheduling, no stall or flood
const oscsBefore = ctx.stats().oscs;
A.playMusic('main');
for (let f = 0; f < 480; f++) { ctx.advance(1 / 60); A.tickMusic(); }
const notes8s = ctx.stats().oscs - oscsBefore;
const slots = 8 * 144 / 60 * 4;   // 8 s of 16th-note grid at 144 bpm
console.log('sfx recipes: ' + recipeNames.length + '  ctx stats: ' + JSON.stringify(ctx.stats()) + '\n');
console.log('lookahead check: 8 s of music scheduled ' + notes8s + ' voices over ' + slots + ' slots');
if (notes8s < slots * 0.2 || notes8s > slots * 1.5) problems.push('music lookahead stalled or flooded');
A.stopMusic(0.1); ctx.advance(1); A.tickCleanup();

const extraWarnings = warnings.filter((w) => !/unknown sound/.test(w));
if (extraWarnings.length) problems.push('console noise: ' + extraWarnings.join(' | '));

console.warn = realWarn; console.error = realError;

process.stdout.write('sfx recipes: ' + recipeNames.length + '  ctx stats: ' + JSON.stringify(ctx.stats()) + '\n');
if (problems.length) {
  process.stdout.write('FAIL\n' + problems.join('\n') + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write('audio self-test OK\n');
}
