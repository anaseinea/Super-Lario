// PLAN: docs/plan/13-items-blocks-effects.md
// Items, bonbon collectibles, bump FX (coin pops, debris, score popups) and
// fireballs.  All plain entities: Level owns the lists, calls update(level)
// every frame and removes anything with .dead.  Physics via BROS.Phys against
// the duck-typed level world (solidAt / landTypeAt).  No input, no DOM.
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C, Phys = BROS.Phys;
  const T = C.TILE;

  /* ------------------------------------------------------------------ *
   * shared helpers
   * ------------------------------------------------------------------ */
  function offBottom(e, level) {
    return e.y > level.rows * T + 32;
  }

  /* ------------------------------------------------------------------ *
   * bonbon collectible — static spinning candy sitting in its cell
   * ------------------------------------------------------------------ */
  function bonbon(col, row) {
    const e = {
      kind: 'bonbon',
      x: col * T, y: row * T, w: T, h: T,
      vx: 0, vy: 0, dead: false, frame: 0,
      update: function () { e.frame++; },
      spriteName: function () {
        const seq = [0, 1, 2, 3];                    // bonbon3 aliases bonbon1
        return 'bonbon' + seq[Math.floor(e.frame / 6) % 4];
      }
    };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * coin pop — visual only: rises COIN_POP_H px, spins, vanishes
   * ------------------------------------------------------------------ */
  function coinPop(x, y) {
    const e = {
      kind: 'fx', fx: 'coinpop',
      x: x, y: y, w: T, h: T,
      vx: 0, vy: 0, dead: false, frame: 0,
      update: function () {
        e.frame++;
        const t = e.frame / C.COIN_POP_FRAMES;
        e.y = y - C.COIN_POP_H * t;
        if (e.frame >= C.COIN_POP_FRAMES) e.dead = true;
      },
      spriteName: function () {
        const seq = [0, 1, 2, 3];
        return 'bonbon' + seq[Math.floor(e.frame / 2) % 4];
      }
    };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * debris shards — brick halves flung by a smash; no tile collision,
   * they fall straight off the map and despawn
   * ------------------------------------------------------------------ */
  function debris(x, y, vx, vy) {
    const e = {
      kind: 'fx', fx: 'debris',
      x: x, y: y, w: 8, h: 8,
      vx: vx, vy: vy, dead: false, frame: 0,
      update: function (level) {
        e.frame++;
        e.vy += C.GRAVITY;
        e.x += e.vx;
        e.y += e.vy;
        if (offBottom(e, level) || e.frame > 150) e.dead = true;
      },
      spriteName: function () { return 'debris' + (1 + (Math.floor(e.frame / 7) % 2)); },
      flip: function () { return e.vx < 0; }
    };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * score popup — 5x7 font text rising from the event spot
   * ------------------------------------------------------------------ */
  function popup(text, x, y) {
    const e = {
      kind: 'fx', fx: 'popup', text: text,
      x: x, y: y, w: 0, h: 0,
      vx: 0, vy: 0, dead: false, frame: 0,
      update: function () {
        e.frame++;
        e.y = y - C.POPUP_RISE * (e.frame / C.POPUP_FRAMES);
        if (e.frame >= C.POPUP_FRAMES) e.dead = true;
      }
    };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * power-up items.  All start kinematically on top of the block that
   * spat them out (level row/row+1 is that block's cell).
   *   jelly / toffee: emerge, then walk left under gravity, flip at walls
   *   ember:          static on the block until collected
   *   bubble:         floats up slowly with a sine drift, never falls
   * ------------------------------------------------------------------ */
  function item(power, col, row) {
    const walking = power === 'jelly' || power === 'toffee';
    const e = {
      kind: 'item', power: power,
      x: col * T, y: (row + 1) * T - T,     // feet on the block's bottom edge
      w: T, h: T,
      vx: 0, vy: 0, dead: false, frame: 0,
      emerged: false,
      homeX: col * T,
      update: function (level) {
        e.frame++;
        if (!e.emerged) {
          const t = Math.min(e.frame / C.ITEM_EMERGE_FRAMES, 1);
          e.y = (row + 1) * T - T - C.ITEM_EMERGE_H * t;   // slides up out of the block
          if (t >= 1) {
            e.emerged = true;
            if (walking) {
              e.vx = -1;                                    // dir, scaled below
              e.vy = 0;
            } else if (power === 'bubble') {
              e.vy = -C.BUBBLE_ITEM_RISE;
            }
          }
          return;
        }
        if (walking) {
          const dir = e.vx >= 0 ? 1 : -1;
          const speed = power === 'jelly' ? C.JELLY_SPEED : C.TOFFEE_ITEM_SPEED;
          e.vy = Math.min(e.vy + C.GRAVITY, C.MAX_FALL);
          e.vx = dir * speed;
          const ev = Phys.move(e, level, { grounded: false });
          if (ev.hitWall) { e.x -= e.vx; e.vx = -e.vx; }   // flip at walls
          if (offBottom(e, level)) e.dead = true;
        } else if (power === 'bubble') {
          e.y += -C.BUBBLE_ITEM_RISE;
          e.x = e.homeX + Math.sin(e.frame * 0.09) * 7;
          if (e.y + e.h < 0) e.dead = true;                // died off the top edge
        }
        /* ember: STATIC until touched (its wiggle is a draw-time effect) */
      },
      wiggle: function () { return Math.sin(e.frame * 0.28) * 1.6; },
      spriteName: function () { return power === 'bubble' ? 'bubble_item' : power; },
      flip: function () { return e.vx > 0; }
    };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * fireball — bounces on tiles via Phys, dies on walls / age / bounce cap
   * ------------------------------------------------------------------ */
  function fireball(x, y, dir) {
    const e = {
      kind: 'fireball',
      x: x, y: y, w: 8, h: 8,
      vx: C.FIREBALL_SPEED * dir, vy: 0,
      dead: false, frame: 0, bounces: 0, dir: dir,
      update: function (level) {
        e.frame++;
        e.vy = Math.min(e.vy + C.FIREBALL_GRAV, C.MAX_FALL);
        const ev = Phys.move(e, level, { grounded: false });
        if (ev.landed) {
          e.bounces++;
          e.vy = -C.FIREBALL_BOUNCE;
        }
        if (ev.hitWall) e.dead = true;
        if (e.bounces > C.FIREBALL_MAX_BOUNCES) e.dead = true;
        if (e.frame > C.FIREBALL_LIFE) e.dead = true;
        if (offBottom(e, level)) e.dead = true;
      },
      spriteName: function () { return 'fireball' + (1 + (Math.floor(e.frame / 4) % 2)); },
      flip: function () { return e.vx < 0; }
    };
    return e;
  }

  BROS.Objects = {
    bonbon: bonbon,
    coinPop: coinPop,
    debris: debris,
    popup: popup,
    item: item,
    fireball: fireball
  };
})();
