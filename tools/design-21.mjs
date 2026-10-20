/* ============================================================================
 * tools/design-21.mjs — 4-2 CARAMBOW RIDGE: rolling day hill country
 *
 * Beats: Chomper pipe pairs alternate with spike belts; a lookout shelf
 * holds a pudge; a 5-pit with a tramp assist; a stepped mesa with a
 * floatoo bobbing over it; then a straight, fast ridge run into the
 * finale staircase.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('4-2', 'CARAMBOW RIDGE', 'day', 121, 560, 3);
  lv.baseGround();

  lv.qRow(7, 9, 10, 'J??');
  lv.bonbonLine(11, 13, 12);

  lv.pipe(16, 2);
  lv.chomper(16, 2);
  lv.spawn('pudge', 19);
  lv.spikes(22, 25);
  lv.spawn('shell', 28);
  lv.ledge(31, 34, 11);
  lv.spawn('pudge', 32);
  lv.bonbon(31, 10); lv.bonbon(34, 10);

  lv.pit(37, 41);
  lv.trampoline(42);                             // edge spring
  lv.bonbonArc(37, 41, 8, 10);
  lv.pipe(45, 3);
  lv.chomper(45, 3);
  lv.qRow(48, 51, 10, '?B?B');

  lv.ledge(54, 57, 10);                          // mesa step
  lv.spawn('floatoo', 55, 7);
  lv.bonbon(56, 8);
  lv.pit(60, 62);
  lv.bonbonArc(60, 62, 10, 11);
  lv.spawn('hopper', 64);
  lv.pipe(67, 3);
  lv.chomper(67, 3);
  lv.spikes(70, 73);
  lv.ledge(78, 80, 12);
  lv.spawn('pudge', 79);

  lv.qRow(81, 83, 9, '??E');
  lv.pit(86, 89);
  lv.bonbonArc(86, 89, 9, 11);
  lv.spawn('floatoo', 87, 8);
  lv.pipe(93, 2);
  lv.chomper(93, 2);
  lv.spawn('shell', 96);

  lv.stairs(99, 6, 2, 'X');                      // 99-110 ridge-top climb
  lv.pole(113, 7);
  lv.keep(116, 9);                               // cols 116-119; width 121
  return lv;
}
