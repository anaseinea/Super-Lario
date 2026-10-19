// PLAN: docs/plan/17-testing-and-tuning.md
// Headless self-test of the procedural sprite system.
// Run:  node tools/test-sprites.mjs
import { installFakeBrowser, loadScripts } from './fakecanvas.mjs';

installFakeBrowser();

const warnings = [];
const realWarn = console.warn, realError = console.error;
console.warn = (m) => warnings.push('warn: ' + m);
console.error = (m) => warnings.push('error: ' + m);

loadScripts(['js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js', 'js/06-sprites.js']);

const S = globalThis.BROS.Sprites;
for (const theme of ['day', 'cave', 'dusk']) S.ensure(theme);

console.warn = realWarn; console.error = realError;

// expected sizes: name pattern -> [w,h]; first matching rule wins
const SIZE_RULES = [
  [/^p_small_/, [12, 16]],
  [/^p_big_crouch_/, [16, 16]],
  [/^p_big_/, [16, 30]],
  [/^tile_/, [16, 16]],
  [/^pipe_/, [16, 16]],
  [/^pole_segment$/, [16, 16]],
  [/^pole_ball\d?$/, [8, 8]],
  [/^flag$/, [16, 14]],
  [/^keep$/, [64, 64]],
  [/^bonbon/, [16, 16]],
  [/^(jelly|ember|toffee|bubble_item)$/, [16, 16]],
  [/^fireball/, [8, 8]],
  [/^debris/, [8, 8]],
  [/^pudge_flat$/, [16, 8]],
  [/^hopper_flat$/, [16, 8]],
  [/^(pudge|hopper)\d/, [16, 16]],
  [/^shell_walk/, [16, 16]],
  [/^shell_still$/, [14, 12]],
  [/^shell_slide$/, [16, 12]],
  [/^shell_flip$/, [16, 12]],
  [/^floatoo/, [16, 20]],
  [/^chomper/, [16, 30]]
];

// openwork tiles (trampoline lattice, spike gaps) are not meant to be solid
const SOLID_OK = /^(tile_ground|tile_brick|tile_q|tile_used|tile_stone|pipe_)/;

const MIN_INK = { tile_trampoline: 120, tile_spike: 150, tile: 150, pipe: 140, p_small: 60, p_big_crouch: 70, p_big: 150, default: 8 };

let problems = warnings.slice();
let checked = 0;
const names = Object.keys(S._map).sort();
for (const name of names) {
  const cv = S._map[name];
  if (!cv || !cv.width || !cv.height) { problems.push(name + ': not a canvas'); continue; }
  for (const [re, wh] of SIZE_RULES) {
    if (re.test(name)) {
      if (cv.width !== wh[0] || cv.height !== wh[1]) {
        problems.push(name + ': size ' + cv.width + 'x' + cv.height + ' expected ' + wh[0] + 'x' + wh[1]);
      }
      break;
    }
  }
  const ink = cv.inkCount();
  let min = MIN_INK.default;
  for (const key of Object.keys(MIN_INK)) {
    if (name.indexOf(key) === 0) { min = MIN_INK[key]; break; }
  }
  if (ink < min) problems.push(name + ': only ' + ink + ' ink pixels (min ' + min + ')');
  if (SOLID_OK.test(name) && ink < 200) problems.push(name + ': not solid enough (' + ink + ')');
  checked++;
}

// player silhouettes must be symmetric-ish and centred
function centreOfMass(name) {
  const cv = S._map[name];
  let sx = 0, n = 0;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (cv.get(x, y)[3] > 0) { sx += x; n++; }
    }
  }
  return n ? sx / n : -1;
}
for (const n of ['p_small_idle_gum', 'p_big_idle_gum', 'p_big_crouch_gum']) {
  if (!S._map[n]) { problems.push(n + ': missing'); continue; }
  const cv = S._map[n];
  const com = centreOfMass(n);
  if (com < cv.width * 0.35 || com > cv.width * 0.65) problems.push(n + ': silhouette off-centre (com=' + com.toFixed(1) + '/' + cv.width + ')');
  // bottom row should be mostly solid (the blob stands on it)
  let bottom = 0;
  for (let x = 0; x < cv.width; x++) if (cv.get(x, cv.height - 1)[3] > 0) bottom++;
  if (bottom < cv.width * 0.5) problems.push(n + ': bottom row too sparse (' + bottom + '/' + cv.width + ')');
}

// flame variant must actually be a different palette (verify red ink present)
function hasColor(name, predicate) {
  const cv = S._map[name];
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      const c = cv.get(x, y);
      if (c[3] > 0 && predicate(c)) return true;
    }
  }
  return false;
}
if (!hasColor('p_small_idle_flame', (c) => c[0] > 200 && c[1] < 110 && c[2] < 110)) {
  problems.push('p_small_idle_flame: no flame-red pixels found');
}
if (!hasColor('p_big_idle_gum', (c) => c[0] > 180 && c[1] < 120 && c[2] > 120)) {
  problems.push('p_big_idle_gum: no gum-magenta pixels found');
}

// aliases resolve to the same canvas object (cheap memory)
if (S._map['bonbon3'] !== S._map['bonbon1']) problems.push('bonbon3 should alias bonbon1');

// theme-varying tiles must differ between themes
const g1day = S._map['tile_ground_1'];
S.ensure('cave');
const g1cave = S._map['tile_ground_1'];
if (g1day === g1cave) problems.push('tile_ground_1 was not rebuilt for theme change');

if (warnings.length) problems.push('console noise: ' + warnings.join(' | '));

process.stdout.write('sprites checked: ' + checked + '\n');
if (problems.length) {
  process.stdout.write('FAIL\n' + problems.join('\n') + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write('sprite self-test OK\n');
}
