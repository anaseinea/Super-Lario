// PLAN: docs/plan/17-testing-and-tuning.md
// Headless self-test of the tile table and level parser.
// Run:  node tools/test-tiles.mjs
import { load } from './loadmodules.mjs';

const { BROS } = load(['js/01-namespace.js', 'js/02-constants.js', 'js/03-utils.js', 'js/09-tiles.js']);

const fails = BROS.Tiles.selfTest();

// the parser must stay DOM free: nothing in the sandbox may reference document
if (fails.length === 0) {
  let lv = null;
  try {
    lv = BROS.parseLevel({
      name: 'probe', theme: 'cave', startCol: 1, time: 320,
      map: [
        '................',
        '................',
        '................',
        '.........o......',
        '...XBBX.........',
        '........r.......',
        '........pp......',
        '........pp.IKKKK',
        '........pp.IKKKK',
        '........pp.IKKKK',
        '...q.h..pp.IKKKK',
        'GGGGGGGGGGGGGGGG',
        'GGGGGGGGGGGGGGGG'
      ]
    });
  } catch (e) {
    fails.push('cave probe map did not parse: ' + e.message);
  }
  if (lv) {
    if (lv.theme !== 'cave') fails.push('theme not carried through');
    if (lv.time !== 320) fails.push('time not carried through');
    if (lv.pipes.length !== 1) fails.push('probe pipe count ' + lv.pipes.length);
    if (lv.plants.length !== 1) fails.push('probe plant count ' + lv.plants.length);
    if (lv.poleCol !== 11 || lv.keepCol !== 12) fails.push('probe finale cols ' + lv.poleCol + '/' + lv.keepCol);
    if (lv.startRow !== 11) fails.push('probe start row ' + lv.startRow);
    if (lv.spawns.length !== 3) fails.push('probe spawn count ' + lv.spawns.length);
  }
}

if (fails.length) {
  console.log('tiles self-test FAILURES (' + fails.length + '):');
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}

const lv = BROS.parseLevel({
  name: 'sample', theme: 'day', startCol: 1, time: 300,
  map: [
    '..................',
    '..................',
    '..................',
    '.........o........',
    '.....B?X..........',
    '.......r..........',
    '.......pp.........',
    '.......pp....IKKKK',
    '.......pp....IKKKK',
    '.......pp....IKKKK',
    'g....qqppChssIKKKK',
    'GGGGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGGGG'
  ]
});
console.log('tiles self-test OK');
console.log('sample level: ' + lv.cols + 'x' + lv.rows + '  pipes ' + lv.pipes.length +
  '  spawns ' + lv.spawns.length + '  plants ' + lv.plants.length +
  '  bonbons ' + lv.bonbons.length);
console.log('  pole col ' + lv.poleCol + ' rows ' + lv.poleTopRow + '-' + lv.poleBottomRow +
  ', keep col ' + lv.keepCol + ' row ' + lv.keepTopRow + ' target x ' + lv.keepTargetX);
console.log('  start col ' + lv.startCol + ' row ' + lv.startRow + ' at px ' + lv.startX + ',' + lv.startY);
console.log(lv.debugGrid().replace(/^/gm, '    '));
