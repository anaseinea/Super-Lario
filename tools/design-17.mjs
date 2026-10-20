/* ============================================================================
 * tools/design-17.mjs — 2-3 FIZZING SPRINGS: trampoline dusk
 *
 * Beats: an opening pit with a Floatoo; Chomper pipes; a trampoline chain
 * over 5-wide pits with a bonus island; shelves patrolled by a Pudge; spike
 * floors; a final climb staircase handing you onto the flagpole.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('2-3', 'FIZZING SPRINGS', 'dusk', 111, 480, 2);
  lv.baseGround();

  lv.qRow(6, 8, 10, '??J');
  lv.bonbonLine(10, 12, 12);

  lv.pit(15, 17);
  lv.bonbonArc(15, 17, 10, 11);
  lv.spawn('floatoo', 16, 9);                     // balloon patrol

  lv.pipe(20, 2);
  lv.chomper(20, 2);
  lv.trampoline(25);
  lv.pit(26, 30);                                 // 5-wide: springs do it
  lv.bonbonArc(26, 30, 8, 10);

  lv.qRow(33, 35, 10, '?E?');
  lv.ledge(38, 42, 11);
  lv.spawn('pudge', 39);
  lv.bonbon(38, 10); lv.bonbon(41, 10); lv.bonbon(42, 10);
  lv.spawn('floatoo', 43, 9);

  lv.pipe(46, 2);
  lv.chomper(46, 2);
  lv.spikes(50, 52);
  lv.trampoline(56);
  lv.pit(57, 61);                                 // 5-wide launch
  lv.bonbonArc(57, 61, 8, 10);

  lv.qRow(64, 66, 10, 'R??');                     // Toffee before the low road
  lv.ledge(68, 72, 12);                           // low shelf walk
  lv.spawn('shell', 69);
  lv.bonbon(70, 11); lv.bonbon(72, 11);
  lv.pipe(75, 3);
  lv.chomper(75, 3);

  lv.trampoline(80);
  lv.pit(81, 84);
  lv.bonbonArc(81, 84, 8, 10);
  lv.spawn('floatoo', 81, 8);
  lv.spikes(86, 88);

  lv.stairs(93, 4, 2, 'X');                       // 93-100
  lv.bonbon(94, 11); lv.bonbon(96, 10); lv.bonbon(98, 9); lv.bonbon(100, 8);

  lv.pole(103, 7);                                // climb hands you to the pole
  lv.keep(106, 9);                                // cols 106-109; width 111
  return lv;
}
