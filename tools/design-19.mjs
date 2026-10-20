/* ============================================================================
 * tools/design-19.mjs — 3-2 PEPPERMINT SUMMIT: the long dusk finale
 *
 * Beats: Chomper pipes and spike patches alternating; guarded shelves;
 * Floatoo patrols; a trampoline launch over the widest pit; a 5-step X
 * staircase summit climb that hands the player straight to the flagpole.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('3-2', 'PEPPERMINT SUMMIT', 'dusk', 105, 520, 2);
  lv.baseGround();

  lv.qRow(6, 8, 10, '??J');
  lv.bonbonLine(10, 12, 12);

  lv.pipe(13, 2);
  lv.chomper(13, 2);
  lv.spikes(19, 21);
  lv.ledge(24, 27, 11);                           // guarded lookout shelf
  lv.spawn('pudge', 26);
  lv.bonbon(24, 10); lv.bonbon(27, 10);

  lv.pit(30, 33);
  lv.bonbonArc(30, 33, 9, 11);
  lv.spawn('floatoo', 31, 8);
  lv.pipe(36, 3);
  lv.chomper(36, 3);
  lv.qRow(39, 42, 10, 'B?E?');

  lv.trampoline(45);
  lv.pit(46, 50);                                 // 5-wide spring launch
  lv.bonbonArc(46, 50, 8, 10);
  lv.spikes(52, 55);
  lv.ledge(60, 63, 11);
  lv.spawn('shell', 61);
  lv.bonbon(62, 10); lv.bonbon(63, 10);
  lv.ledge(66, 69, 12);
  lv.spawn('pudge', 67);

  lv.pipe(72, 2);
  lv.chomper(72, 2);
  lv.pit(75, 77);
  lv.bonbonArc(75, 77, 10, 11);
  lv.bonbonArc(80, 82, 11, 11);

  lv.stairs(85, 5, 2, 'X');                       // the summit climb, 85-94
  lv.bonbon(86, 11); lv.bonbon(88, 10); lv.bonbon(90, 9);
  lv.bonbon(92, 8); lv.bonbon(94, 7);

  lv.pole(97, 7);                                 // summit hands you to the pole
  lv.keep(100, 9);                                // cols 100-103; width 105
  return lv;
}
