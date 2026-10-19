/* ============================================================================
 * tools/design-12.mjs — 1-2 CANDY MINE: the cave level
 *
 * Beats (docs/plan/09-level-design.md): X-brick ceiling corridors with the
 * Ember Q-block row built into the first one; a 5-wide pit; Hopper debut on a
 * shelf; a gated treasure vault with bonbons guarded by Tinshells; a
 * trampoline gauntlet over two pits with an island between; a wide spike
 * floor crossed via a safe island with the Bubble block above it; a Tinshell
 * chain corridor; one last pit before the flagpole.  Caves keep ceilings at
 * row 10: big form can still walk under them (32px) but cannot jump.
 * ==========================================================================*/
'use strict';
import { LevelMap } from './genmaps-lib.mjs';

export function build() {
  const lv = new LevelMap('1-2', 'CANDY MINE', 'cave', 100, 350, 2);
  lv.baseGround();

  /* --- first low corridor: Ember Berry row built into the hard-candy roof --- */
  lv.ceiling(8, 9, 10);
  lv.qRow(10, 12, 10, 'BEB');                    // bump the 'E' with a 16px hop
  lv.ceiling(13, 20, 10);
  lv.bonbonLine(5, 7, 12);                       // open-air intro bonbons
  lv.bonbonLine(14, 16, 12);                     // bonbons under the roof

  lv.pit(22, 26);                                // 5 wide: run up, then fly
  lv.bonbonArc(22, 26, 9, 11);

  /* --- Hopper debut: a pair patrolling a raised candy shelf --- */
  lv.ledge(28, 34, 11);
  lv.bonbon(28, 10); lv.bonbon(30, 10); lv.bonbon(32, 10); lv.bonbon(34, 10);
  lv.spawn('hopper', 29);                        // rows default to surface-1
  lv.spawn('hopper', 31);

  /* --- treasure vault: 2-tall gates you hop over, shells guard the bonbons --- */
  lv.gate(38, 11, 12, 'X');
  lv.ceiling(39, 44, 10);
  lv.gate(45, 11, 12, 'X');
  lv.bonbon(40, 12); lv.bonbon(42, 12); lv.bonbon(44, 12);
  lv.spawn('shell', 41);
  lv.spawn('shell', 43);

  /* --- trampoline gauntlet: launch, land on the island, launch again --- */
  lv.trampoline(48);
  lv.pit(49, 52);
  lv.bonbonArc(49, 52, 9, 11);
  lv.qRow(54, 55, 10, '??');                     // bonus row over the island
  lv.trampoline(56);
  lv.pit(57, 60);
  lv.bonbonArc(57, 60, 9, 11);

  /* --- spike floor with a safe island; Bubble block bumped from the island --- */
  lv.spikes(65, 67);
  lv.bonbon(66, 11);                             // risk/reward over the spikes
  lv.qRow(69, 69, 10, 'O');                      // timed Bubble power-up
  lv.spikes(72, 74);
  lv.bonbon(73, 11);

  /* --- Tinshell chain corridor: kick the near shell into its partners --- */
  lv.ceiling(80, 86, 10);
  lv.spawn('shell', 81);
  lv.spawn('shell', 83);
  lv.spawn('shell', 85);

  lv.pit(87, 90);                                // last gap before the finale
  lv.bonbonArc(87, 90, 9, 11);

  lv.pole(92, 7);
  lv.keep(95, 9);                                // cols 95-98; width 100
  return lv;
}
