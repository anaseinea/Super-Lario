// PLAN: docs/plan/11-player-state-machine.md
// Gumdrop himself. Reads BROS.Input fresh every frame (so tools can swap in a
// scripted Input), moves with BROS.Phys against the duck-typed level world,
// and talks to the level ONLY through level callbacks:
//   level.onHeadBump(headCells)
//   level.onPlayerLanded(ev)          // brick feet-smash hook
//   level.onLandTrampolined()         // -> Level calls player.launchTrampoline(vy)
//   level.spawnFireball(player)
//   level.activeFireballCount()
// Enemy/spike/pit resolution lives in Level (it calls player.hurt(),
// player.bounceOff(), player.startDeath()).
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C, U = BROS.U, Phys = BROS.Phys;
  const T = C.TILE;

  function sfx(name) {
    if (BROS.Audio && BROS.Audio.sfx) BROS.Audio.sfx(name);
  }

  function spawn(startX, feetY) {
    const p = {
      x: startX, y: feetY - C.SMALL_H, w: C.SMALL_W, h: C.SMALL_H,
      vx: 0, vy: 0,
      facing: 1,
      power: 'small',                 // 'small' | 'big' | 'flame'
      pending: null,                  // 'big' | 'flame': grow blocked, retry when clear
      toffeeFrames: 0, bubbleFrames: 0,
      invuln: 0,
      onGround: false, coyote: 0, jumpHeld: false, jumpUsed: false,
      crouched: false, skid: false,
      state: 'normal',                // normal | dying | flag | victory
      control: true, poseOverride: null,
      dyingTimer: 0, deathDone: false,
      fireCooldown: 0,
      anim: 0, frame: 0,

      /* ---------------- form helpers ---------------- */
      big: function () { return (p.power === 'big' || p.power === 'flame') && !p.pending; },
      activeForm: function () {
        if (p.bubbleFrames > 0) return 'bubble';
        if (p.toffeeFrames > 0) return 'toffee';
        return p.power;               // flame | big | small
      },
      startToffee: function () { p.toffeeFrames = C.TOFFEE_FRAMES; },
      startBubble: function () { p.bubbleFrames = C.BUBBLE_FRAMES; },

      setFormBox: function () {
        const feet = p.y + p.h;
        if (!p.big()) { p.w = C.SMALL_W; p.h = C.SMALL_H; }
        else { p.w = C.BIG_W; p.h = p.crouched ? C.CROUCH_H : C.BIG_H; }
        p.y = feet - p.h;
      },
      /** box grows feet-anchored; returns false (optionally arming `pending`)
       *  when the extra 14px of headroom is occupied. */
      grow: function (level, targetPower) {
        const want = targetPower || 'big';
        if (p.big()) { p.pending = null; return true; }
        const feet = p.y + p.h;
        const newTop = feet - C.BIG_H;
        const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 1) / T);
        for (let r = Math.max(0, Math.floor(newTop / T)); r <= Math.floor((feet - 1) / T); r++) {
          for (let c = c0; c <= c1; c++) {
            if (level.solidAt(c, r)) { p.pending = want; return false; }
          }
        }
        p.power = want;
        p.pending = null;
        p.w = C.BIG_W; p.h = C.BIG_H;
        p.y = newTop;
        return true;
      },
      /** jelly collect: grow (or retry the pending upgrade); scoring is Level's job. */
      collectJelly: function (level) { p.grow(level, p.pending || 'big'); },
      collectEmber: function (level) {
        if (p.power === 'flame') return false;              // already flame: score instead
        if (p.big()) { p.power = 'flame'; return true; }
        p.grow(level, 'flame');
        return true;
      },

      /* ---------------- damage / death ---------------- */
      hurt: function () {               // returns 'bubble' | 'shrink' | 'die'
        if (p.state === 'dying') return 'die';
        if (p.bubbleFrames > 0) {
          p.bubbleFrames = 0;
          p.invuln = C.INVULN_HITS;
          sfx('deflate');
          return 'bubble';
        }
        if (!p.big()) { p.startDeath(); return 'die'; }
        if (p.power === 'flame') p.power = 'big';
        else {                                    // big -> small, feet-anchored
          p.power = 'small';
          p.crouched = false;
          p.setFormBox();
        }
        p.invuln = C.INVULN_HITS;
        sfx('powerdown');
        return 'shrink';
      },
      startDeath: function () {
        if (p.state === 'dying') return;
        p.state = 'dying'; p.control = false; p.crouched = false;
        p.setFormBox();
        p.dyingTimer = 0; p.vy = 0;
        sfx('die');
      },
      takeControl: function (on) {
        p.control = !!on;
        if (!on && p.state === 'normal') p.state = 'flag';
        if (on && p.state === 'flag') p.state = 'normal';
      },
      setVictory: function () { p.state = 'victory'; p.control = false; p.poseOverride = 'victory'; },

      /* ---------------- external launches ---------------- */
      launchTrampoline: function (vy) { p.vy = -vy; p.onGround = false; p.coyote = 0; },
      bounceOff: function (isPop) {    // called by Level after any stomp
        // Floatoo stomps bounce at the fixed POP_BOUNCE; toffee charge overrides all.
        let v = isPop ? C.POP_BOUNCE : (p.jumpHeld ? C.STOMP_BOUNCE_HELD : C.STOMP_BOUNCE);
        if (p.toffeeFrames > 0) v = C.TOFFEE_BOUNCE;
        p.vy = -v; p.onGround = false; p.coyote = 0; p.jumpUsed = false;
      },

      tryJump: function (level) {
        p.vy = -(p.big() ? C.JUMP_BIG : C.JUMP_SMALL);
        p.jumpUsed = true; p.onGround = false; p.coyote = 0;
        sfx(p.big() ? 'bigjump' : 'jump');
      },

      /* ---------------- main per-frame update ---------------- */
      update: function (level) {
        const I = BROS.Input;
        p.frame++;
        if (p.invuln > 0) p.invuln--;
        if (p.toffeeFrames > 0) { p.toffeeFrames--; if (p.toffeeFrames === 0) sfx('blipdown'); }
        if (p.bubbleFrames > 0) { p.bubbleFrames--; if (p.bubbleFrames === 0) sfx('deflate'); }
        if (p.fireCooldown > 0) p.fireCooldown--;
        if (p.pending) p.grow(level, p.pending);                 // retry blocked grow

        /* ---- dying: scripted pause -> pop up -> fall through everything ---- */
        if (p.state === 'dying') {
          p.dyingTimer++;
          if (p.dyingTimer > C.DEATH_PAUSE) {
            if (p.dyingTimer === C.DEATH_PAUSE + 1) p.vy = -C.DEATH_LAUNCH;
            p.vy = Math.min(p.vy + C.GRAVITY, C.MAX_FALL);
            p.y += p.vy;
            if (p.y > level.rows * T + 64) p.deathDone = true;
          }
          return;
        }
        if (!p.control) { p.anim++; return; }     // flag / victory takeover: poses only

        p.anim++;

        /* ---- input snapshot ---- */
        const inL = I.down('left'), inR = I.down('right'), inD = I.down('down');
        const inJump = I.down('jump'), inRun = I.down('run');
        const inputDir = (inR ? 1 : 0) - (inL ? 1 : 0);
        p.jumpHeld = inJump;
        const jumpEdge = I.pressed('jump');
        if (jumpEdge) p.jumpUsed = false;         // a fresh press arms jump + buffer
        if (I.released('jump')) p.jumpUsed = false;

        /* ---- crouch (big forms only) ---- */
        const wantCrouch = p.big() && inD && p.onGround;
        if (wantCrouch && !p.crouched) { p.crouched = true; p.setFormBox(); }
        else if (!wantCrouch && p.crouched) {
          const feet = p.y + p.h;
          const newTop = feet - C.BIG_H;
          const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 1) / T);
          let clear = true;
          for (let r = Math.floor(newTop / T); r <= Math.floor((feet - 1) / T); r++) {
            for (let c = c0; c <= c1; c++) if (level.solidAt(c, r)) clear = false;
          }
          if (clear) { p.crouched = false; p.setFormBox(); }
        }

        /* ---- horizontal control ---- */
        const maxSpeed = (inRun && !p.crouched) ? C.RUN_MAX : C.WALK_MAX;
        p.skid = false;
        if (inputDir !== 0) {
          // plan 11: skid triggers when INPUT opposes MOMENTUM (not facing — the skid branch
          // flips facing itself, so a facing-based check cancels the skid on frame 2 and the
          // hard decel never happens). The skid pose holds until the momentum flips.
          if (p.onGround && inputDir * p.vx < 0 && Math.abs(p.vx) > C.SKID_MIN_SPEED) {
            p.skid = true;
            p.facing = inputDir;
            p.vx = U.approach(p.vx, inputDir * maxSpeed, C.GROUND_ACCEL * C.SKID_ACCEL_MUL);
          } else {
            p.facing = inputDir;                                       // plan 11: crouch forbids RUN accel
            const accel = p.onGround ? C.GROUND_ACCEL : C.AIR_ACCEL;   // but duck-walking at
            p.vx = U.approach(p.vx, inputDir * maxSpeed, accel);       // WALK_MAX is allowed
          }
        } else if (p.onGround) {
          p.vx = U.approach(p.vx, 0, C.GROUND_FRICTION);
        } else {
          p.vx = U.approach(p.vx, 0, C.AIR_DRAG);
        }

        /* ---- jump (press) ---- */
        if (jumpEdge && (p.onGround || p.coyote > 0)) p.tryJump(level);

        /* ---- gravity (hold-float, bubble, toffee) ---- */
        let grav = C.GRAVITY, maxFall = C.MAX_FALL;
        if (p.toffeeFrames > 0) { grav *= C.TOFFEE_GRAV_MUL; maxFall = C.TOFFEE_MAX_FALL; }
        if (p.bubbleFrames > 0) { grav *= C.BUBBLE_GRAV_MUL; maxFall = C.BUBBLE_MAX_FALL; }
        if (p.vy < 0 && inJump) grav = C.GRAVITY_HOLD;
        p.vy = Math.min(p.vy + grav, maxFall);
        if (I.released('jump') && p.vy < -C.JUMP_CUT) p.vy = -C.JUMP_CUT;   // jump cut

        /* ---- move ---- */
        const wasOnGround = p.onGround;
        const ev = Phys.move(p, level, { grounded: wasOnGround, maxStep: T });
        if (ev.hitWall) p.vx = 0;
        if (ev.hitCeil) {
          p.vy = Math.max(p.vy, 0);
          level.onHeadBump(ev.headCells);
        }

        if (ev.landed && ev.landType === 'tramp') {
          p.onGround = false; p.coyote = 0;
          level.onLandTrampolined();              // Level -> launchTrampoline(TRAMPOLINE_VY)
        } else if (ev.landed) {
          p.vy = 0;
          p.onGround = true; p.coyote = 0;
          level.onPlayerLanded(ev);
          if (!p.jumpUsed && I.jumpBufferFrames() <= C.JUMP_BUFFER) p.tryJump(level);
        } else if (ev.onGround) {
          p.onGround = true; p.coyote = 0;
        } else {
          if (wasOnGround && ev.steppedOff) p.coyote = C.COYOTE;   // walked off a ledge
          p.onGround = false;
          if (p.coyote > 0) p.coyote--;
          if (p.crouched) { p.crouched = false; p.setFormBox(); }  // airborne cancels crouch
        }

        /* ---- flame fire request ('run' press doubles as fire) ---- */
        if (p.power === 'flame' && I.pressed('run') && p.fireCooldown === 0 &&
            level.activeFireballCount() < C.FIRE_MAX_PROJECTILES) {
          p.fireCooldown = C.FIRE_COOLDOWN;
          level.spawnFireball(p);
        }

        /* pit death & flagpole grabs are Level policy (player.y is public). */
      },

      /* ---------------- pose & sprites ---------------- */
      pose: function () {
        if (p.state === 'dying') return 'dead';
        if (p.poseOverride) return p.poseOverride;
        if (p.state === 'flag') return 'jump';
        if (p.state === 'victory') return 'victory';
        if (p.crouched) return 'crouch';
        if (!p.onGround) return 'jump';
        if (p.skid) return 'skid';
        if (Math.abs(p.vx) > 0.15) {
          const period = Math.abs(p.vx) > 2.6 ? 5 : 8;
          return 'walk' + (1 + (Math.floor(p.anim / period) % 2));
        }
        return 'idle';
      },
      spriteName: function () {
        const size = p.big() ? 'big' : 'small';
        const tint = p.power === 'flame' ? 'flame' : 'gum';
        return 'p_' + size + '_' + p.pose() + '_' + tint;
      },
      blinkHidden: function () {         // Level skips the draw on these frames
        return p.invuln > 40 && (p.frame % 8) < 4;
      },
      center: function () { return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; }
    };
    p.setFormBox();
    return p;
  }

  BROS.Player = { spawn: spawn };
})();
