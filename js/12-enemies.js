// PLAN: docs/plan/12-enemies.md
// Enemy factories. Enemies only read their own state + the duck-typed level
// world (solidAt / landTypeAt) and level.player for chase decisions — never
// Input, never each other. Death semantics (used by Level's cull/anim pass):
//   e.dead + e.deadTimer countdown; e.flat -> squish-flat sprite (30f),
//   otherwise flip-fade (40f). Level awards combo score on e.kill().
//
// DEVIATION (docs/plan/12): Tinshell walk hitbox is 16x16 here, not 16x24 —
// the shipped shell art is 16x16 (walk) / 16x12 (still, slide), and hitboxes
// must match art so stomps feel fair.  Noted in docs/plan/09.
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C, U = BROS.U, Phys = BROS.Phys;
  const T = C.TILE;

  /* ------------------------------------------------------------------ *
   * shared skeleton
   * ------------------------------------------------------------------ */
  function base(kind, x, y, w, h) {
    const e = {
      kind: kind,
      x: x, y: y, w: w, h: h,
      vx: 0, vy: 0, dir: -1,
      dead: false, deadTimer: 0, flat: false,
      grounded: false,
      anim: 0,
      seed: 0,             // per-enemy animation desync offset (Level sets)
      /* generic physics step for gravity-bound enemies (Pudge/Shell/Hopper) */
      stepPhysics: function (level) {
        e.vy = Math.min(e.vy + C.GRAVITY, C.MAX_FALL);
        const ev = Phys.move(e, level, { grounded: e.grounded });
        e.grounded = ev.onGround;
        if (ev.landed && ev.landType === 'tramp') e.vy = -C.TRAMPOLINE_VY * 0.6;
        return ev;
      },
      /* keep feet planted when the hitbox height changes (shell states) */
      setHeight: function (newH) {
        const feet = e.y + e.h;
        e.h = newH;
        e.y = feet - newH;
      },
      kill: function (cause) {
        if (e.dead) return;
        e.dead = true;
        e.cause = cause || 'stomp';
        e.deadTimer = e.flat ? 30 : 40;
      },
      stompable: function () { return true; },
      sideKillable: function () { return true; },   // toffee charge crush
      fireKillable: function () { return true; },
      /* ctx: { face: ±1 player facing, playerCenterX } — Level mediates */
      onStomp: function (ctx) { e.flat = true; e.kill('stomp'); },
      onSideHit: function () { /* default: Level decides damage elsewhere */ },
      onFireHit: function () { e.kill('fire'); },
      update: function () {},
      spriteName: function () { return e.kind; },
      flip: function () { return e.vx > 0; },
      blinking: function () { return false; }
    };
    return e;
  }

  function anim2(e, period) {
    return Math.floor((e.anim + e.seed) / period) % 2 ? 2 : 1;
  }

  /* ------------------------------------------------------------------ *
   * Pudge — 16x16 shuffling blob. Flips at walls, walks off ledges.
   * ------------------------------------------------------------------ */
  function pudge(col, row) {
    const e = base('pudge', col * T, (row + 1) * T - 16, 16, 16);
    e.update = function (level) {
      if (e.dead) return;
      e.anim++;
      e.vx = e.dir * C.PUDGE_SPEED;
      const ev = e.stepPhysics(level);
      if (ev.hitWall) { e.dir = -e.dir; e.vx = 0; }
    };
    e.spriteName = function () { return e.dead ? 'pudge_flat' : 'pudge' + anim2(e, 8); };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * Tinshell — walk / still / slide state machine.
   *   stomp walk      -> still   (revive timer starts)
   *   side still      -> slide   (kick, away from player)      no damage
   *   stomp slide     -> still
   *   side slide      -> damages player (Level rule)
   *   hit by sliding  -> converts to slide (chain)
   *   wall            -> slide flips dir (keeps sliding)
   * ------------------------------------------------------------------ */
  function tinshell(col, row) {
    const e = base('tinshell', col * T, (row + 1) * T - 16, 16, 16);
    e.state = 'walk';
    e.revive = 0;

    const toStill = function () {
      e.state = 'still';
      e.vx = 0;
      e.setHeight(12);            // retracts; sprite shell_still 14x12
      e.revive = 0;
    };
    const toSlide = function (dir) {
      e.state = 'slide';
      e.setHeight(16);
      e.dir = dir || e.dir || -1;
      e.vx = e.dir * C.SHELL_SLIDE;
    };

    e.update = function (level) {
      if (e.dead) return;
      e.anim++;
      if (e.state === 'walk') e.vx = e.dir * C.SHELL_SPEED_WALK;
      else if (e.state === 'slide') e.vx = e.dir * C.SHELL_SLIDE;
      else {
        e.vx = 0;
        e.revive++;
        if (e.revive >= C.SHELL_REVIVE) {
          if (Phys.groundProbe(e, level)) {          // stand back up
            e.state = 'walk';
            e.setHeight(16);
            e.dir = Math.floor(e.seed / 2) % 2 ? 1 : -1;
          } else {                                   // revive-fall
            toSlide(e.dir);
          }
        }
      }
      const ev = e.stepPhysics(level);
      if (ev.hitWall) {
        if (e.state === 'slide') e.dir = -e.dir;    // SMB: slides back forever
        else if (e.state === 'walk') e.dir = -e.dir;
        e.vx = 0;
      }
    };

    e.onStomp = function (ctx) {
      if (e.dead) return;
      if (e.state === 'slide') { toStill(); return; }          // stomp slide -> still
      if (e.state === 'walk') { toStill(); return; }           // stomp walk  -> still
      // stomp on a still shell kicks it sliding, away from the stomper
      const away = (ctx && ctx.playerCenterX != null && ctx.playerCenterX > e.x + 8) ? -1 : 1;
      toSlide(away);
    };
    e.onSideHit = function (ctx) {
      if (e.dead) return;
      if (e.state === 'still') {                               // kick, no damage
        const away = (ctx && ctx.playerCenterX != null && ctx.playerCenterX > e.x + 8) ? -1 : 1;
        toSlide(away);
      }
    };
    e.kick = function (dir) { toSlide(dir); };
    e.chainConvert = function (dir) {                          // hit by a slider
      if (e.state === 'slide') return false;
      toSlide(dir);
      return true;
    };
    e.isSliding = function () { return e.state === 'slide' && !e.dead; };
    e.canKick = function () { return e.state === 'still' && !e.dead; };
    e.blinking = function () {
      return e.state === 'still' && e.revive > C.SHELL_REVIVE - C.SHELL_REVIVE_BLINK;
    };
    e.spriteName = function () {
      if (e.dead) return 'shell_flip';
      if (e.state === 'still') return 'shell_still';
      if (e.state === 'slide') return 'shell_slide';
      return 'shell_walk' + anim2(e, 7);
    };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * Hopper — 16x16 patroller that hops toward the player.
   * ------------------------------------------------------------------ */
  function hopper(col, row) {
    const e = base('hopper', col * T, (row + 1) * T - 16, 16, 16);
    e.hopTimer = 0;
    e.hopping = false;
    e.update = function (level) {
      if (e.dead) return;
      e.anim++;
      if (e.grounded) {
        e.hopTimer++;
        e.vx = e.dir * C.HOPPER_SPEED;
        const p = level.player;
        const near = p && !p.dead &&
          Math.abs((p.x + p.w / 2) - (e.x + e.w / 2)) < 90;
        if (e.hopTimer >= C.HOPPER_WAIT || near) {
          e.vy = -C.HOPPER_JUMP_VY;
          e.hopping = true;
          e.hopTimer = 0;
          const target = p ? Math.sign((p.x + p.w / 2) - (e.x + e.w / 2)) || e.dir : e.dir;
          e.vx = target * 0.55;              // drift toward player while airborne
        }
      } else {
        const target = level.player && !level.player.dead
          ? Math.sign((level.player.x + level.player.w / 2) - (e.x + e.w / 2)) || e.dir
          : e.dir;
        e.vx = target * 0.55;
      }
      const ev = e.stepPhysics(level);
      if (ev.hitWall) { e.dir = -e.dir; e.vx = e.grounded ? e.dir * C.HOPPER_SPEED : 0; }
      if (ev.landed && e.hopping) { e.hopping = false; e.hopTimer = 0; }  // re-landing while walking must NOT reset the timer
    };
    e.spriteName = function () { return e.dead ? 'hopper_flat' : 'hopper' + anim2(e, e.hopping ? 3 : 9); };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * Floatoo — 16x20 balloon. Sinusoidal bob around spawnY, slow chase,
   * reverses at solids, stops chasing when the player is off-screen left.
   * ------------------------------------------------------------------ */
  function floatoo(col, row) {
    const h = 20;
    const e = base('floatoo', col * T, (row + 1) * T - h, 16, h);
    e.spawnY = e.y;
    e.bobT = 0;
    e.chaseTimer = 0;
    e.drift = 0;
    e.update = function (level) {
      if (e.dead) return;
      e.anim++;
      e.bobT++;
      e.chaseTimer++;
      const p = level.player;
      const playerLeftOfView = p && p.x + p.w < level.camX;
      if (e.chaseTimer >= 60) {
        e.chaseTimer = 0;
        e.drift = 0;
        if (p && !p.dead && !playerLeftOfView) {
          const d = Math.sign((p.x + p.w / 2) - (e.x + e.w / 2));
          if (d !== 0) e.drift = d;
        }
      }
      e.vx = e.drift * C.FLOATOO_SPEED;
      e.vy = 0;
      const ev = Phys.move(e, level, { grounded: false });
      if (ev.hitWall) {
        e.x -= e.vx;
        if (e.drift !== 0) { e.drift = -e.drift; e.chaseTimer = 0; }  // reverse, keep hovering
        e.vx = 0;
      }
      /* bob: kinematic y with a soft vertical push-out of solids */
      const wantY = e.spawnY + Math.sin((e.bobT + e.seed) * (Math.PI * 2 / C.FLOATOO_BOB_PERIOD)) * C.FLOATOO_BOB_AMP;
      e.y = wantY;
      for (const c of Phys.cellsTouched(e)) {
        if (!level.solidAt(c.col, c.row)) continue;
        if (e.y + e.h / 2 < c.row * T + T / 2) e.y = c.row * T - e.h;      // sit on it
        else e.y = (c.row + 1) * T;                                        // hang below it
        break;
      }
    };
    e.onStomp = function () { e.kill('pop'); };        // pops like the balloon it is
    e.spriteName = function () { return 'floatoo' + anim2(e, 12); };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * Chomper — 16x30, anchored in a pipe mouth.  e.y/e.h always describe
   * only the EXPOSED band above the mouth (h = 0 while resting hidden),
   * so plain AABB overlap is automatically safe when it is down.
   * ------------------------------------------------------------------ */
  function chomper(col, row, pipe) {
    const mouthTopY = pipe.row * T;
    const e = base('chomper', col * T, mouthTopY, 16, 0);
    e.pipe = pipe;
    e.mouthTopY = mouthTopY;
    e.raise = 0;
    e.phase = 0;
    e.stompable = function () { return false; };      // never stompable
    e.fullSpriteY = function () { return mouthTopY - e.raise; };  // top of the 16x30 art
    e.update = function (level) {
      if (e.dead) return;
      e.anim++;
      e.phase = (e.phase + 1) % C.CHOMPER_PERIOD;
      const p = e.phase / C.CHOMPER_PERIOD;
      let r = 0;
      if (p < 0.30) r = C.CHOMPER_AMP * (p / 0.30);             // rise
      else if (p < 0.45) r = C.CHOMPER_AMP;                     // hold out
      else if (p < 0.75) r = C.CHOMPER_AMP * (1 - (p - 0.45) / 0.30); // retract
      else r = 0;                                               // rest hidden
      e.raise = r;
      e.h = r;                                                  // exposed height
      e.y = mouthTopY - r;
    };
    e.onSideHit = function () {};      // damage is decided by Level (never stomp)
    e.spriteName = function () { return 'chomper' + anim2(e, 10); };
    return e;
  }

  /* ------------------------------------------------------------------ *
   * spawn pass: turn level.spawns into live entities
   * ------------------------------------------------------------------ */
  function spawnAll(level) {
    const out = [];
    for (const s of level.spawns) {
      let e = null;
      if (s.kind === 'pudge') e = pudge(s.col, s.row);
      else if (s.kind === 'shell') e = tinshell(s.col, s.row);   // parse calls them 'shell'
      else if (s.kind === 'hopper') e = hopper(s.col, s.row);
      else if (s.kind === 'floatoo') e = floatoo(s.col, s.row);
      else if (s.kind === 'chomper') {
        let pipe = null;
        for (const p of level.pipes) {
          if (s.row + 1 === p.row && s.col >= p.col && s.col <= p.col + 1) pipe = p;
        }
        if (!pipe) continue;                 // parseLevel guarantees one; paranoia
        e = chomper(s.col, s.row, pipe);
      }
      if (!e) continue;
      e.seed = (s.col * 31 + s.row * 7) % 37;
      out.push(e);
    }
    return out;
  }

  BROS.Enemies = {
    pudge: pudge,
    tinshell: tinshell,
    hopper: hopper,
    floatoo: floatoo,
    chomper: chomper,
    spawnAll: spawnAll
  };
})();
