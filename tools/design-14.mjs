/* ============================================================================
 * tools/design-14.mjs — 1-4 MARZIPAN MEADOWS: the day-world finale
 *
 * Beats: an opening patrol; a Chomper pipe pair straddling a pit; candy
 * shelves with Tinshell guards; a spike patch flanked by pipes; a 5-wide
 * run-up pit; a trampoline over the last gap; an X staircase handing the
 * player onto the flagpole (SMB style).
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('1-4', 'MARZIPAN MEADOWS', 'day', 113, 420, 2);
  lv.baseGround();

  lv.bonbonLine(4, 8, 12);                        // walking-through treat line
  lv.qRow(11, 14, 10, '?B?B');                    // bonbons + a Jelly

  lv.spawn('pudge', 17);                          // first patrol
  lv.pipe(21, 2);
  lv.chomper(21, 2);
  lv.pit(25, 27);                                 // 3-wide hop
  lv.bonbonArc(25, 27, 10, 11);

  lv.ledge(31, 33, 11);
  lv.spawn('shell', 32);
  lv.bonbon(31, 10); lv.bonbon(33, 10);

  lv.pipe(35, 3);
  lv.chomper(35, 3);                              // the taller, scarier pipe
  lv.spikes(41, 43);                              // four flat cells on the left
  lv.ledge(45, 48, 11);                           // low shelf, Pudge on patrol
  lv.spawn('pudge', 46);
  lv.bonbon(45, 10); lv.bonbon(48, 10);

  lv.qRow(49, 51, 10, '?R?');                     // Toffee before the long pit
  lv.pit(54, 58);                                 // 5-wide: run-up then fly
  lv.bonbonArc(54, 58, 9, 11);

  lv.pipe(62, 2);
  lv.chomper(62, 2);
  lv.pipe(66, 3);
  lv.chomper(66, 3);
  lv.spawn('shell', 69);
  lv.spawn('pudge', 72);
  lv.spawn('shell', 75);

  lv.pit(78, 80);
  lv.bonbonArc(78, 80, 10, 11);
  lv.trampoline(83);                              // launch over the last gap
  lv.pit(84, 87);
  lv.bonbonArc(84, 87, 9, 10);
  lv.bonbonLine(89, 91, 12);

  lv.stairs(95, 4, 2, 'X');                       // the classic finale climb
  lv.bonbon(96, 11); lv.bonbon(98, 10); lv.bonbon(100, 9); lv.bonbon(102, 8);

  lv.pole(105, 7);                                // stairs land at col 102
  lv.keep(108, 9);                                // cols 108-111; width 113
  return lv;
}
