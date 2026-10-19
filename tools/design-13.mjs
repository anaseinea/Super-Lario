/* ============================================================================
 * tools/design-13.mjs — 1-3 PEPPERMINT DUSK: the dusk showcase level
 *
 * Beats (docs/plan/09-level-design.md): Floatoo debut over the opening pits;
 * a Chomper pair on pipes h3 and h2; a Hopper pair on a shelf with a Toffee
 * Q row hung three rows above it; a Pudge pack; the showpiece — a trampoline
 * chain over three consecutive 6-wide pits with bonbon arcs overhead; mixed
 * pressure before the finale; a spike band guarding the approach; and a
 * final X-block staircase (SMB style) that hands the player straight onto
 * the flagpole.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('1-3', 'PEPPERMINT DUSK', 'dusk', 118, 400, 2);
  lv.baseGround();

  lv.bonbonLine(4, 6, 12);                       // gentle opening

  /* --- Floatoo debut: balloons chasing you over the first two pits --- */
  lv.pit(8, 11);
  lv.bonbonArc(8, 11, 9, 11);
  lv.spawn('floatoo', 10, 10);
  lv.pit(14, 17);
  lv.bonbonArc(14, 17, 9, 11);
  lv.spawn('floatoo', 16, 10);

  lv.qRow(19, 20, 10, '??');                     // a breather with bonus blocks

  /* --- Chomper pair: the pipes you must hop past --- */
  lv.pipe(21, 3);
  lv.chomper(21, 3);
  lv.pipe(25, 2);
  lv.chomper(25, 2);

  /* --- Hopper pair on a shelf, Toffee row hung where you bump from the top --- */
  lv.bonbon(28, 12);
  lv.ledge(30, 35, 11);
  lv.bonbon(30, 10); lv.bonbon(32, 10); lv.bonbon(34, 10); lv.bonbon(35, 10);
  lv.spawn('hopper', 31, 10);
  lv.spawn('hopper', 33, 10);
  lv.qRow(31, 33, 8, '?R?');                     // 2 clear cells over the shelf

  lv.spawn('pudge', 37);                         // Pudge pack
  lv.spawn('pudge', 39);
  lv.spawn('shell', 40);

  /* --- the showpiece: trampoline chain over three consecutive 6-wide pits --- */
  lv.trampoline(41);
  lv.pit(42, 47);
  lv.bonbonArc(42, 47, 9, 10);
  lv.trampoline(51);
  lv.pit(52, 57);
  lv.bonbonArc(52, 57, 9, 10);
  lv.spawn('floatoo', 54, 8);                    // one more balloon over the chain
  lv.trampoline(61);
  lv.pit(62, 67);
  lv.bonbonArc(62, 67, 9, 10);                   // land on the 68-71 apron

  /* --- mixed pressure before the climb --- */
  lv.spawn('hopper', 74);
  lv.spawn('pudge', 76);
  lv.spawn('pudge', 78);
  lv.spawn('shell', 80);
  lv.qRow(78, 80, 10, '?R?');                    // Toffee to recharge mid-run
  lv.bonbonLine(82, 83, 12);

  lv.pit(84, 87);
  lv.bonbonArc(84, 87, 9, 11);
  lv.spawn('floatoo', 86, 7);                    // a lazy balloon to loiter under

  /* --- the spike band, then the final X-block staircase --- */
  lv.bonbonLine(89, 91, 12);                     // walk-up through the band
  lv.spikes(92, 94);
  lv.bonbon(93, 11);                             // hop the spikes, grab it mid-air
  lv.stairs(97, 6, 2, 'X');                      // steps 97-98 ... 107-108
  lv.bonbon(98, 11); lv.bonbon(100, 10); lv.bonbon(102, 9);
  lv.bonbon(104, 8); lv.bonbon(106, 7); lv.bonbon(108, 6);

  /* --- the staircase hands the player straight onto the pole --- */
  lv.pole(110, 7);
  lv.keep(113, 9);                               // cols 113-116; width 118
  return lv;
}
