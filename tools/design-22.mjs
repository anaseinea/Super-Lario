/* ============================================================================
 * tools/design-22.mjs — 4-3 MARZIPAN SPIRE: the dusk gauntlet
 *
 * Beats: Chomper pipe pair opens; three spike belts break the run; twin
 * tramp-launched voids; a shell on a shelf over the second hole; a
 * floatoo scout hovers each pit; long staircase onto the spire's pole.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('4-3', 'MARZIPAN SPIRE', 'dusk', 125, 580, 3);
  lv.baseGround();

  lv.qRow(6, 8, 10, '??R');
  lv.bonbonLine(10, 12, 12);

  lv.pipe(14, 3);
  lv.chomper(14, 3);
  lv.spawn('pudge', 17);
  lv.spikes(20, 23);
  lv.pipe(26, 2);
  lv.chomper(26, 2);
  lv.spawn('shell', 29);
  lv.spikes(32, 35);
  lv.ledge(38, 41, 11);                          // shelf over the lookout
  lv.spawn('pudge', 39);
  lv.bonbon(38, 10); lv.bonbon(41, 10);

  lv.pit(44, 47);
  lv.bonbonArc(44, 47, 9, 11);
  lv.pipe(50, 3);
  lv.chomper(50, 3);
  lv.spawn('hopper', 53);
  lv.trampoline(56);
  lv.pit(57, 62);                                // 6-wide void, spring only
  lv.bonbonArc(57, 62, 8, 11);
  lv.spawn('floatoo', 59, 7);
  lv.spikes(64, 66);
  lv.ledge(72, 75, 11);
  lv.spawn('shell', 73);
  lv.pipe(76, 3);
  lv.chomper(76, 3);
  lv.pipe(80, 2);
  lv.chomper(80, 2);
  lv.qRow(83, 86, 10, 'B??E');
  lv.spawn('pudge', 88);

  lv.trampoline(91);
  lv.pit(92, 96);                                // 5-wide spring void
  lv.bonbonArc(92, 96, 8, 10);
  lv.spawn('floatoo', 94, 6);
  lv.spikes(97, 100);
  lv.spawn('hopper', 103);

  lv.stairs(105, 5, 2, 'X');                     // 105-114 spire climb
  lv.pole(117, 7);
  lv.keep(120, 9);                               // cols 120-123; width 125
  return lv;
}
