/* ============================================================================
 * tools/design-16.mjs — 2-2 LICORICE LEDGE: the high-road day level
 *
 * Beats: low candy shelves stepped up two at a time; a black-brick loft
 * above a shelf you bump from its top; Floatoo patrols over pits; Chomper
 * pipes; a trampoline to the upper road; a 5-wide launch pit; the usual
 * staircase finale.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('2-2', 'LICORICE LEDGE', 'day', 110, 460, 2);
  lv.baseGround();

  lv.bonbonLine(4, 7, 12);
  lv.qRow(8, 10, 10, '?B?');

  /* --- stepping shelves: one low, one needs a short run-up --- */
  lv.ledge(13, 16, 12);                           // 1-tile step, no assist
  lv.bonbon(14, 11); lv.bonbon(16, 11);
  lv.ledge(20, 24, 10);                           // 3-tile step from flat run
  lv.bonbonLine(21, 23, 9);
  lv.spawn('shell', 24);
  lv.blockRow(21, 23, 7, 'B');                    // loft above the shelf
  lv.bonbon(22, 6);

  lv.pipe(28, 2);
  lv.chomper(28, 2);
  lv.pit(32, 34);
  lv.bonbonArc(32, 34, 10, 11);
  lv.spawn('floatoo', 33, 9);                     // balloon over the gap

  lv.ledge(37, 41, 11);
  lv.spawn('pudge', 38);
  lv.bonbon(39, 10); lv.bonbon(41, 10);
  lv.pipe(44, 3);
  lv.chomper(44, 3);

  lv.qRow(47, 49, 10, '?E?');                     // Ember before the drops
  lv.pit(52, 55);                                 // 4-wide hop
  lv.bonbonArc(52, 55, 9, 11);
  lv.spawn('floatoo', 54, 8);

  lv.trampoline(59);                              // launch onto the high road
  lv.ledge(60, 64, 10);
  lv.bonbonLine(61, 63, 9);
  lv.spawn('shell', 64);
  lv.pit(66, 69);
  lv.bonbonArc(66, 69, 9, 10);

  lv.pipe(71, 2);
  lv.chomper(71, 2);
  lv.spikes(77, 79);
  lv.ledge(80, 84, 11);
  lv.spawn('shell', 81);
  lv.bonbon(82, 10); lv.bonbon(84, 10);

  lv.pit(87, 89);
  lv.bonbonArc(87, 89, 10, 11);
  lv.bonbonLine(90, 92, 12);

  lv.stairs(93, 4, 2, 'X');                       // 93-100, climb to the pole
  lv.bonbon(94, 11); lv.bonbon(96, 10); lv.bonbon(98, 9); lv.bonbon(100, 8);

  lv.pole(102, 7);                                // stairs land at col 100
  lv.keep(105, 9);                                // cols 105-108; width 107... 
  return lv;
}
