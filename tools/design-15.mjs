/* ============================================================================
 * tools/design-15.mjs — 2-1 TOFFEE TUNNEL: the cave gauntlet
 *
 * Beats: a hard-candy corridor with the Toffee Q row baked into the roof;
 * a hop-over gate; Hopper shelves; a trampoline chain over two pits with a
 * bonus island; a wide spike floor with a safe apron; a Chomper pipe pair;
 * a Shell corridor; one last pit and a staircase before the flagpole.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('2-1', 'TOFFEE TUNNEL', 'cave', 109, 440, 2);
  lv.baseGround();

  /* --- opening corridor with the Toffee row in the roof line --- */
  lv.bonbonLine(5, 7, 12);
  lv.ceiling(8, 9, 10);
  lv.qRow(10, 12, 10, 'R?B');                     // Toffee for the tight crawl
  lv.ceiling(13, 17, 10);
  lv.bonbonLine(14, 16, 12);

  /* --- first vault: a 2-tall gate, shells patrolling the loot --- */
  lv.gate(19, 11, 12, 'X');
  lv.ceiling(20, 24, 10);
  lv.bonbon(21, 12); lv.bonbon(23, 12);
  lv.spawn('shell', 22);
  lv.gate(25, 11, 12, 'X');

  lv.pit(28, 31);                                 // 4-wide, run-up helps
  lv.bonbonArc(28, 31, 9, 11);

  /* --- Hopper ledges --- */
  lv.ledge(33, 39, 11);
  lv.bonbon(33, 10); lv.bonbon(36, 10); lv.bonbon(39, 10);
  lv.spawn('hopper', 35);
  lv.spawn('hopper', 37);

  /* --- trampoline chain with a bonus island between the pits --- */
  lv.trampoline(42);
  lv.pit(43, 47);
  lv.bonbonArc(43, 47, 9, 11);
  lv.qRow(49, 50, 10, '??');                      // the island
  lv.trampoline(51);
  lv.pit(52, 56);
  lv.bonbonArc(52, 56, 9, 11);

  /* --- spike floors with a safe apron; Bubble block on the apron --- */
  lv.qRow(59, 59, 10, 'O');
  lv.spikes(61, 64);                              // 4-wide: the widest allowed
  lv.bonbon(62, 11);                              // risk/reward hop
  lv.spikes(67, 69);

  /* --- pipe pair with Chompers before the shell corridor --- */
  lv.pipe(74, 2);
  lv.chomper(74, 2);
  lv.pipe(77, 2);
  lv.chomper(77, 2);
  lv.ceiling(79, 84, 10);
  lv.spawn('shell', 79);
  lv.spawn('shell', 81);
  lv.spawn('shell', 83);

  lv.pit(86, 88);
  lv.bonbonArc(86, 88, 10, 11);

  lv.stairs(91, 4, 2, 'X');                       // 91-98, steps up
  lv.bonbon(92, 11); lv.bonbon(94, 10); lv.bonbon(96, 9); lv.bonbon(98, 8);

  lv.pole(101, 7);                                // stairs land at col 98
  lv.keep(104, 9);                                // cols 104-107; width 109
  return lv;
}
