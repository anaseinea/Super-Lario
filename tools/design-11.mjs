/* ============================================================================
 * tools/design-11.mjs — 1-1 SUGAR MEADOWS, the teaching level
 *
 * Beat (docs/plan/09-level-design.md): run/jump; bonbon line; Q row with the
 * first Jelly; single Pudge patrol; first Tinshell; pits; pipe h2 with the
 * first Chomper scare; first trampoline over a 3-wide pit; second Jelly;
 * Toffee Q-block before a Pudge pack; final bonbon arc; pole + Keep.
 * No spikes, no Hopper, no Floatoo yet (pacing).
 *
 * Q rows sit at row 10: 3 rows above the ground surface gives big form 32px
 * of headroom to walk underneath, and a bump only needs a 16px rise.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('1-1', 'SUGAR MEADOWS', 'day', 112, 300, 2);
  lv.baseGround();

  lv.bonbonLine(5, 8, 12);                    // walk-through bonbon line

  lv.qRow(14, 17, 10, '?BJB');                // first Q row: bonbons + Jelly

  lv.spawn('pudge', 22);                      // first Pudge patrols here
  lv.pit(25, 27);                             // first pit: 3 columns
  lv.bonbonArc(25, 27, 10, 11);               // bonbons trace the jump arc

  lv.spawn('shell', 30);                      // first Tinshell: stomp, then kick
  lv.pit(33, 37);                             // 5-wide pit, run-up from the left
  lv.bonbonArc(33, 37, 9, 11);

  lv.ledge(40, 44, 11);                       // raised candy shelf
  lv.bonbonLine(41, 43, 10);                  // reward on top

  lv.pipe(47, 2);                             // first pipe...
  lv.chomper(47, 2);                          // ...and the first Chomper scare

  lv.bonbon(51, 12);

  lv.trampoline(54);                          // first trampoline (flush pad)
  lv.pit(55, 57);                             // over a 3-wide pit
  lv.bonbonArc(55, 57, 10, 11);

  lv.qRow(60, 62, 10, '?J?');                 // second Jelly

  lv.ledge(64, 68, 10);                       // higher shelf (3-tile step)
  lv.bonbonLine(65, 67, 9);                   // bonbons on top

  lv.qRow(70, 72, 10, 'BRB');                 // Toffee before the Pudge pack
  lv.spawn('pudge', 74);
  lv.spawn('pudge', 78);
  lv.spawn('shell', 81);

  lv.pit(84, 87);                             // plain 4-wide pit
  lv.bonbonArc(84, 87, 9, 11);

  lv.spawn('shell', 90);
  lv.ledge(92, 94, 11);                       // little shelf with bonbons
  lv.bonbonLine(92, 94, 10);

  lv.trampoline(96);                          // final assist...
  lv.pit(97, 101);                            // across a 5-wide pit
  lv.bonbonArc(97, 101, 9, 10);
  lv.qRow(102, 103, 10, '??');                // bonus blocks past the pit

  lv.pole(104, 7);                            // candy-cane flagpole
  lv.keep(107, 9);                            // Gingerbread Keep (cols 107-110)
  return lv;                                    // width 112 = keepCol + 5
}
