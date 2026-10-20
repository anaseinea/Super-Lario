/* ============================================================================
 * tools/design-20.mjs — 4-1 GINGHAM HOLLOW: a candy-mine opener
 *
 * Beats: a Chomper pipe guards the first steps; pudge patrol with a hopper
 * side-kick; a guarded lookout shelf; a 4-pit and a 5-pit, the wide one
 * launched from a trampoline; a hard-candy slab over the spring board;
 * a staircase straight onto the flagpole.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('4-1', 'GINGHAM HOLLOW', 'cave', 114, 540, 3);
  lv.baseGround();

  lv.qRow(6, 8, 10, '??J');
  lv.bonbonLine(9, 11, 12);

  lv.pipe(13, 2);
  lv.chomper(13, 2);
  lv.spawn('pudge', 16);
  lv.spikes(19, 21);
  lv.spawn('hopper', 23);
  lv.ledge(26, 29, 11);                          // lookout shelf
  lv.spawn('pudge', 28);
  lv.bonbon(26, 10); lv.bonbon(29, 10);

  lv.pit(32, 35);                                // 4-wide first hole
  lv.bonbonArc(32, 35, 9, 11);
  lv.spawn('floatoo', 33, 8);
  lv.pipe(38, 3);
  lv.chomper(38, 3);
  lv.qRow(41, 44, 10, 'B?E?');

  lv.blockRow(47, 50, 9, 'X');                   // candy slab ceiling
  lv.trampoline(51);
  lv.pit(52, 56);                                // 5-wide spring launch
  lv.bonbonArc(52, 56, 8, 10);
  lv.spikes(58, 61);
  lv.ledge(66, 69, 11);
  lv.spawn('shell', 67);
  lv.bonbon(68, 10);
  lv.ledge(72, 75, 12);
  lv.spawn('pudge', 73);

  lv.pit(78, 80);
  lv.bonbonArc(78, 80, 10, 11);
  lv.pipe(83, 3);
  lv.chomper(83, 3);
  lv.spawn('shell', 87);
  lv.spawn('pudge', 91);

  lv.stairs(94, 5, 2, 'X');                      // 94-103 straight to the pole
  lv.pole(106, 7);
  lv.keep(109, 9);                               // cols 109-112; width 114
  return lv;
}
