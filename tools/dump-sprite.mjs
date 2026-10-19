import { installFakeBrowser, loadScripts } from './fakecanvas.mjs';
installFakeBrowser();
loadScripts(['js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js', 'js/06-sprites.js']);
const S = globalThis.BROS.Sprites;
S.ensure('day');
for (const name of (process.argv[2] || 'p_small_idle_gum,p_big_idle_gum,p_big_crouch_gum,tile_ground_1,tile_used,tile_stone').split(',')) {
  const cv = S._map[name];
  process.stdout.write('=== ' + name + ' ' + cv.width + 'x' + cv.height + ' ink=' + cv.inkCount() + '\n');
  const cols = {};
  for (let y = 0; y < cv.height; y++) {
    let line = '';
    for (let x = 0; x < cv.width; x++) {
      const c = cv.get(x, y);
      if (c[3] === 0) { line += '.'; continue; }
      const hex = '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
      cols[hex] = (cols[hex] || 0) + 1;
      line += (c[0] + c[1] + c[2]) > 600 ? ' ' : ((c[0] > c[2]) ? '+' : (c[2] > c[0]) ? '#' : (c[1] > 120 ? 'o' : '.'));
    }
    process.stdout.write(line + '\n');
  }
  process.stdout.write('colors: ' + Object.entries(cols).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' ') + '\n');
}
