/* ============================================================================
 * tools/design-18.mjs — 3-1 GINGER COLOSSUS: the cave gauntlet, harder
 *
 * Beats: roofed corridors with a Q row baked in; a hop-over gate; spike
 * floors guarded by wide aprons; Chomper pipes; a Hopper shelf; a shell
 * corridor; a trampoline over the widest pit; a mid-staircase; the finale
 * flat walk.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('3-1', 'GINGER COLOSSUS', 'cave', 110, 500, 2);
  lv.baseGround();

  lv.ceiling(5, 10, 10);
  lv.qRow(11, 13, 10, 'B?B');
  lv.bonbonLine(6, 8, 12);
  lv.gate(16, 11, 12, 'X');                       // hop over the candy wall
  lv.spikes(19, 22);                              // 4-wide: right apron run
  lv.bonbon(20, 11);

  lv.pit(28, 30);
  lv.bonbonArc(28, 30, 10, 11);
  lv.pipe(33, 2);
  lv.chomper(33, 2);
  lv.spawn('shell', 35);
  lv.pipe(38, 2);
  lv.chomper(38, 2);
  lv.spawn('shell', 40);
  lv.spawn('pudge', 43);
  lv.qRow(45, 47, 10, 'J?O');

  lv.stairs(48, 3, 2, 'X');                       // 48-53: short climb
  lv.bonbon(52, 9);
  lv.pit(55, 57);                                 // drop past the stairfoot
  lv.bonbonArc(55, 57, 10, 11);

  lv.ledge(60, 64, 11);
  lv.spawn('hopper', 62);
  lv.bonbon(61, 10); lv.bonbon(63, 10);

  lv.ceiling(67, 73, 10);                         // shell corridor
  lv.spawn('shell', 68);
  lv.spawn('shell', 70);
  lv.spawn('shell', 72);

  lv.spikes(76, 79);                              // 4-wide, runs both sides
  lv.trampoline(82);
  lv.pit(83, 87);                                 // widest launch pad pit
  lv.bonbonArc(83, 87, 9, 11);
  lv.qRow(89, 91, 10, '???');

  lv.pipe(94, 2);
  lv.chomper(94, 2);
  lv.pit(97, 99);
  lv.bonbonArc(97, 99, 10, 11);

  lv.pole(102, 7);
  lv.keep(105, 9);                                // cols 105-108; width 110
  return lv;
}
