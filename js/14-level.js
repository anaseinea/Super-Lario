/* ====================================================================
 * js/14-level.js — the level runtime BROS.Level + BROS.Camera.
 * docs/plan/14-game-state-manager.md, camera rules from docs/plan/10.
 *
 * Owns: the parsed grid (world delegation), camera, player, enemies,
 * items, fireballs, fx, tile bumps, combo scoring, bonbon economy,
 * spike/pit policy, the flagpole takeover sequence, death and tally.
 *
 * Deviation notes (mirrored in docs/plan/09-level-design.md):
 *  - Plan 14 budgets the end-of-level tally at TALLY_RATE per time-unit;
 *    that (300 units at 30f each) breaks the plan's own "<3s tally"
 *    acceptance line.  Level instead drains TALLY_DRAIN_PER_FRAME units
 *    per frame (300 units -> ~150 frames = 2.5s) and plays 'tick' per
 *    TALLY_TICK_UNITS drained units with a TALLY_TICK_GAP frame floor
 *    (<= 20/s).  TALLY_RATE becomes a legacy knob (precedent:
 *    SPREAD_COOLDOWN in this same file).
 *  - The flag sequence is fully kinematic: player.takeControl(false)
 *    makes player.update() a pure anim ticker (js/13 line 153), so
 *    Level drives x/y/facing/poseOverride itself through
 *    grab -> slide -> hop -> walk -> enter -> done.
 *  - Chomper is never stompable (its stompable() returns false, js/12
 *    line 270); every chomper contact therefore routes to side policy.
 *  - Toffee Charge kills everything on side contact INCLUDING sliding
 *    shells (docs/plan/12 line 28).  Bubble absorbs any side contact.
 *  - player.hurt() has no internal invulnerability guard, so Level
 *    skips contact while p.invuln > 0 and skips the draw while
 *    p.blinkHidden().
 *  - GROUND / TRAMP / USED tiles do not bump visually when head-butted.
 *  - SKY colors, background decor anchors and the bubble dome overlay
 *    are Level-owned (Sprites only palettises tiles).
 *  - A sliding shell that clips the player keeps sliding (SMB).
 * ==================================================================== */
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C;
  const TILES = BROS.Tiles;
  const T = C.TILE;

  const SKY = { day: '#5c94fc', cave: '#211a2e', dusk: '#4b2c4d' };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ------------------------------------------------------------------ *
   * BROS.Camera — one-way horizontal scroll, never back-tracks (plan 10):
   *   camX = max(camX, clamp(playerCenter - 96, 0, levelPx - VIEW_W))
   * ------------------------------------------------------------------ */
  function Camera(levelPx) {
    const maxScroll = Math.max(0, levelPx - C.VIEW_W);
    let shakeT = 0, shakeAmp = 0;
    const cam = {
      camX: 0,
      follow: function (playerCenterX) {
        cam.camX = Math.max(cam.camX, clamp(playerCenterX - 96, 0, maxScroll));
        return cam.camX;
      },
      shake: function (frames, amp) { shakeT = frames; shakeAmp = amp; },
      tick: function () { if (shakeT > 0) shakeT--; },
      offsetX: function () {
        return shakeT > 0 ? Math.round(Math.sin(shakeT * 1.7) * shakeAmp) : 0;
      },
      offsetY: function () {
        return shakeT > 0 ? Math.round(Math.cos(shakeT * 1.3) * shakeAmp * 0.6) : 0;
      },
      visibleCols: function (cols) {
        const c0 = Math.max(0, Math.floor(cam.camX / T));
        const c1 = Math.min(cols - 1, Math.floor((cam.camX + C.VIEW_W - 1) / T));
        return [c0, c1];
      }
    };
    return cam;
  }
  BROS.Camera = Camera;

  /* ================================================================== *
   * BROS.Level
   * ================================================================== */
  function Level(def, gs) {
    const self = this;
    const parsed = BROS.Tiles.parseLevel(def);
    if (BROS.Sprites && BROS.Sprites.ensure) BROS.Sprites.ensure(parsed.theme);

    /* ---------- level record + world delegation (physics/enemies) ---------- */
    this.def = def;
    this.parsed = parsed;
    this.name = parsed.name;
    this.theme = parsed.theme;
    this.cols = parsed.cols;
    this.rows = parsed.rows;
    this.levelPx = parsed.cols * T;
    this.pipes = parsed.pipes;
    this.keepBlocks = parsed.keepBlocks;
    this.gs = gs;                       // shared {score, coins, lives} (Game-owned)

    this.solidAt = function (c, r) { return parsed.solidAt(c, r); };
    this.landTypeAt = function (c, r) { return parsed.landTypeAt(c, r); };
    this.tileAt = function (c, r) { return parsed.tileAt(c, r); };
    this.setTileAt = function (c, r, id) { parsed.setTileAt(c, r, id); };
    this.auxAt = function (c, r) { return parsed.auxAt(c, r); };

    /* pipe cell lookup for drawing: "col,row" -> {hgt, i, half} */
    const pipeCell = {};
    parsed.pipes.forEach(function (pp) {
      const top = pp.bottomRow - pp.hgt + 1;
      for (let r = top; r <= pp.bottomRow; r++) {
        pipeCell[pp.col + ',' + r] = { hgt: pp.hgt, i: r - top, half: 0 };
        pipeCell[pp.col + 1 + ',' + r] = { hgt: pp.hgt, i: r - top, half: 1 };
      }
    });

    /* deterministic background decor anchors: no data file, column hashes.
       cave gets none (the dark sky is the mood); surface decor only sits on
       columns whose top solid tile is ground, away from pipes/pole/keep. */
    const decor = [];
    if (this.theme !== 'cave') {
      for (let c = 0; c < this.cols; c++) {
        let s = -1;
        for (let r = 0; r < this.rows; r++) {
          if (parsed.solidAt(c, r) && !parsed.solidAt(c, r - 1)) { s = r; break; }
        }
        const surfaceOK = s >= 0 && parsed.tileAt(c, s) === TILES.GROUND && !pipeCell[c + ',' + s];
        const nearPole = parsed.poleCol >= 0 && c >= parsed.poleCol - 2 && c <= parsed.poleCol + 3;
        let onKeep = false;
        for (let k = 0; k < this.keepBlocks.length; k++) {
          const kb = this.keepBlocks[k];
          if (c >= kb.col - 1 && c <= kb.col + 4) onKeep = true;
        }
        if (c % 9 === 2) decor.push({ name: 'cloud1', x: c * T, y: T });
        if (c % 11 === 7) decor.push({ name: 'cloud2', x: c * T, y: 3 * T });
        if (surfaceOK && !nearPole && !onKeep) {
          if (c % 6 === 3) decor.push({ name: 'bush', x: c * T, bottom: s * T });
          if (c % 11 === 2) decor.push({ name: 'hill_big', x: c * T, bottom: s * T });
          if (c % 9 === 6) decor.push({ name: 'hill_small', x: c * T, bottom: s * T });
        }
      }
    }

    /* ---------- entities ---------- */
    this.player = BROS.Player.spawn(parsed.startX, parsed.startY);
    this.camera = Camera(this.levelPx);
    this.camX = 0;                      // enemies read this for chase policy (js/12)
    this.enemies = BROS.Enemies.spawnAll(parsed);
    this.bonbons = parsed.bonbons.map(function (b) { return BROS.Objects.bonbon(b.col, b.row); });
    this.items = [];
    this.fireballs = [];
    this.fx = [];                       // coinPop / debris / popup
    this.bumps = [];                    // {col, row, t} tile bump animations

    /* ---------- state ---------- */
    this.timeLeft = parsed.time;
    this.timeFrames = 0;
    this.frame = 0;
    this.comboT = 0;
    this.comboChain = 0;
    this.flagPhase = null;              // 'grab'|'slide'|'hop'|'walk'|'enter'|'done'
    this.flagT = 0;
    this.flagTicks = 0;
    this.dying = false;
    this.dyingT = 0;
    this.dyingCause = null;
    this.finished = null;               // null | 'dead' | 'complete'
    this.lastSpikeFrame = -999;
    this.prevJumpUsed = false;
    this.preFallVy = 0;
    this.tallyDrained = 0;
    this.tallyUnitsLastTick = 0;
    this.tallyFrameLastTick = 0;
    this.tallyTicks = 0;
    this.tallyTickN = 0;

    const hasPole = parsed.poleCol != null && parsed.poleCol >= 0;
    const poleBaseFeet = hasPole ? (parsed.poleBottomRow + 1) * T : 0;
    const flagRest = hasPole ? poleBaseFeet - 14 : 0;   // flag sprite is 16x14, rests at the pole base
    this.flagY = flagRest;
    const enterCut = Math.floor(C.FLAG_ENTER_FRAMES * 0.6);

    /* ---------- tiny helpers ---------- */
    function sfx(name) {
      const A = BROS.Audio;
      if (A && A.sfx) A.sfx(name);
    }
    function overlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    function stepList(list, step) {
      for (let i = list.length - 1; i >= 0; i--) {
        step(list[i]);
        if (list[i].dead) list.splice(i, 1);
      }
    }

    /* ---------- scoring / damage policies ---------- */
    function awardKill(e) {
      if (self.comboT > 0) self.comboChain++; else self.comboChain = 1;
      self.comboT = C.COMBO_WINDOW;
      if (self.comboChain >= C.COMBO_1UP_EVERY) {           // 8th chain kill: 1UP, no points (SMB)
        self.comboChain = 0;
        self.comboT = 0;
        self.gs.lives++;
        sfx('oneup');
        self.fx.push(BROS.Objects.popup('1UP', e.x, e.y - 4));
      } else {
        const v = C.COMBO_VALUES[Math.min(self.comboChain - 1, C.COMBO_VALUES.length - 1)];
        self.gs.score += v;
        self.fx.push(BROS.Objects.popup(String(v), e.x, e.y - 4));
      }
    }
    function hurtPlayer() {
      const res = self.player.hurt();                       // player plays its own deflate/powerdown
      if (res === 'die') { sfx('hurt'); self.die('hurt'); } // small mario: hurt sfx then death jingle
    }
    function collectBonbonAt(x, y) {
      self.gs.score += C.SCORE_COIN;
      self.gs.coins++;
      sfx('bonbon');
      self.fx.push(BROS.Objects.coinPop(x, y));
      if (self.gs.coins % C.BONUS_LIFE_AT === 0) { self.gs.lives++; sfx('oneup'); }
    }

    /* ================================================================== *
     * update — plan 14 order: camera, player (callbacks), enemies,
     * items/fireballs/fx, bump tick, clock, player-vs-enemy, player-vs-
     * items, fireball-vs-enemy, shell-vs-enemy, bonbons/spikes/pits,
     * flag sequence, death.
     * ================================================================== */
    this.update = function () {
      if (self.finished) return;
      self.frame++;

      const p = self.player;
      self.camX = self.camera.follow(p.x + p.w / 2);
      if (p.x < self.camX) {                                // soft camera wall (plan 10)
        p.x = self.camX;
        if (p.vx < 0) p.vx = 0;
      }

      if (self.flagPhase) { updateFlag(); self.camera.tick(); return; }
      if (self.dying) { updateDeath(); return; }

      const prevUsed = self.prevJumpUsed;
      self.preFallVy = p.vy;                            // pre-update fall speed (plan 16 thud)
      p.update(self);
      if (!prevUsed && p.jumpUsed && p.vy < -1) sfx(p.big() ? 'bigjump' : 'jump');
      self.prevJumpUsed = p.jumpUsed;
      if (p.x < self.camX) {                               // soft wall re-assert AFTER physics (plan 10)
        p.x = self.camX;
        if (p.vx < 0) p.vx = 0;
      }

      /* enemies: cull + activation gating (holds spawn spot off-screen) */
      const camR = self.camX + C.VIEW_W;
      for (let i = self.enemies.length - 1; i >= 0; i--) {
        const e = self.enemies[i];
        if (e.dead) {
          e.deadTimer--;                                    // enemy updates freeze on death; Level ticks
          if (e.deadTimer <= 0) self.enemies.splice(i, 1);
          continue;
        }
        if (e.x + e.w < self.camX - C.CULL_LEFT) { self.enemies.splice(i, 1); continue; }
        if (e.x > self.levelPx + C.CULL_RIGHT) { self.enemies.splice(i, 1); continue; }
        if (e.y > self.rows * T + C.CULL_BOTTOM) { self.enemies.splice(i, 1); continue; }
        if (e.x > camR + C.CULL_RIGHT) continue;
        e.update(self);
      }

      stepList(self.items, function (it) { it.update(self); });
      stepList(self.fireballs, function (f) { f.update(self); });
      stepList(self.bonbons, function (b) { b.update(); });
      stepList(self.fx, function (f) { if (f.update) f.update(self); });

      for (let i = self.bumps.length - 1; i >= 0; i--) {
        if (--self.bumps[i].t <= 0) self.bumps.splice(i, 1);
      }

      if (++self.timeFrames >= C.TIME_UNIT_FRAMES) {
        self.timeFrames = 0;
        self.timeLeft--;
        if (self.timeLeft === C.HURRY_AT || self.timeLeft === C.HURRY_AT2) sfx('warn');
        if (self.timeLeft <= 0) { self.timeLeft = 0; self.die('time'); return; }
      }
      if (self.comboT > 0) { self.comboT--; if (self.comboT === 0) self.comboChain = 0; }

      resolvePlayerEnemies();
      resolvePlayerItems();
      resolveFireballs();
      resolveShells();
      resolveBonbons();
      resolveSpikes();
      resolvePit();
      checkFlag();

      self.camera.tick();
    };

    /* ---------- resolution passes ---------- */
    function resolvePlayerEnemies() {
      if (self.dying || self.flagPhase) return;
      const p = self.player;
      const ctx = { face: p.facing, playerCenterX: p.x + p.w / 2 };
      for (let i = 0; i < self.enemies.length; i++) {
        const e = self.enemies[i];
        if (e.dead || !overlap(p, e)) continue;
        const feet = p.y + p.h;
        if (e.stompable() && p.vy > 0.5 && feet >= e.y && feet <= e.y + 12) {
          e.onStomp(ctx);
          p.bounceOff(e.kind === 'floatoo');
          sfx(e.kind === 'floatoo' ? 'pop' : 'stomp');
          if (e.isSliding && e.isSliding()) sfx('shellkick');  // a still shell shot away
          if (e.dead) awardKill(e);
          continue;
        }
        /* side contact — Level owns the invulnerability policy */
        if (p.invuln > 0) continue;
        if (p.bubbleFrames > 0) { p.hurt(); continue; }        // bubble absorbs any contact; enemy safe
        if (C.TOFFEE_KILL_SIDE && p.toffeeFrames > 0 && e.sideKillable()) {
          e.kill('toffee'); sfx('pop'); awardKill(e);          // crushes even sliding shells (plan 12)
          continue;
        }
        if (e.isSliding && e.isSliding()) { hurtPlayer(); continue; }   // sliding shell: hazard
        if (e.canKick && e.canKick()) { e.onSideHit(ctx); sfx('shellkick'); continue; }  // tap: no damage
        hurtPlayer();                                          // walkers / chompers hurt
      }
    }
    function resolvePlayerItems() {
      if (self.dying || self.flagPhase) return;
      const p = self.player;
      for (let i = self.items.length - 1; i >= 0; i--) {
        const it = self.items[i];
        if (it.dead || !overlap(p, it)) continue;
        it.dead = true;
        if (it.power === 'jelly') { p.collectJelly(self); sfx('powerup'); }
        else if (it.power === 'ember') { p.collectEmber(self); sfx('powerup'); }
        else if (it.power === 'toffee') { p.startToffee(); sfx('blipup'); }
        else if (it.power === 'bubble') { p.startBubble(); sfx('inflate'); }
      }
    }
    function resolveFireballs() {
      for (let i = 0; i < self.fireballs.length; i++) {
        const f = self.fireballs[i];
        if (f.dead) continue;
        for (let j = 0; j < self.enemies.length; j++) {
          const e = self.enemies[j];
          if (e.dead) continue;
          if (!overlap(f, e)) continue;
          f.dead = true;
          e.onFireHit();                                     // flip death, cause 'fire'
          sfx('pop');
          awardKill(e);
          if (e.kind === 'chomper') self.camera.shake(6, 2);  // chomper kill thud (plan 16)
          break;                                             // one kill per fireball
        }
      }
    }
    function resolveShells() {
      for (let i = 0; i < self.enemies.length; i++) {
        const s = self.enemies[i];
        if (!s.isSliding || !s.isSliding()) continue;
        for (let j = 0; j < self.enemies.length; j++) {
          const t = self.enemies[j];
          if (t === s || t.dead) continue;
          if (t.isSliding && t.isSliding()) continue;
          if (!overlap(s, t)) continue;
          if (t.kind === 'tinshell') {
            if (t.chainConvert(s.dir)) sfx('shellkick');     // shell chain: shot away, no score
          } else {
            t.kill('shell'); sfx('stomp'); awardKill(t);     // shell flattens a monster
          }
        }
      }
    }
    function resolveBonbons() {
      if (self.dying || self.flagPhase) return;
      const p = self.player;
      for (let i = self.bonbons.length - 1; i >= 0; i--) {
        const b = self.bonbons[i];
        if (b.dead || !overlap(p, b)) continue;
        b.dead = true;
        collectBonbonAt(b.x, b.y);
      }
    }
    function resolveSpikes() {
      if (self.dying || self.flagPhase) return;
      const p = self.player;
      const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 1) / T);
      const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 1) / T);
      let hit = false;
      for (let r = r0; r <= r1 && !hit; r++) {
        for (let c = c0; c <= c1; c++) {
          if (parsed.tileAt(c, r) === TILES.SPIKE) { hit = true; break; }
        }
      }
      if (!hit || p.invuln > 0 || self.frame < self.lastSpikeFrame) return;
      self.lastSpikeFrame = self.frame + C.SPIKE_COOLDOWN;
      sfx('spike');
      p.vy = -C.SPIKE_BOUNCE;
      p.onGround = false;
      hurtPlayer();
    }
    function resolvePit() {
      if (self.dying || self.flagPhase) return;
      const p = self.player;
      if (p.y > self.rows * T) self.die('pit');              // fully below the view, any power
    }

    /* ================================================================== *
     * death
     * ================================================================== */
    this.die = function (cause) {
      if (self.dying || self.flagPhase || self.finished) return;
      self.dying = true;
      self.dyingT = 0;
      self.dyingCause = cause;
      const dsh = C.DEATH_SHAKE;
      self.camera.shake(dsh[0], dsh[1]);          // death thud (plan 16 #1)
      self.player.startDeath();          // player owns the 140f arc + the 'die' jingle
    };
    function updateDeath() {
      const p = self.player;
      p.update(self);
      self.camera.tick();                          // decay the death shake (plan 16)                       // dying branch: pause, launch, fall; sets deathDone off-screen
      self.dyingT++;
      // backstop covers dying on solid ground (time-out): the fall never leaves the map
      if (p.deathDone || self.dyingT > C.DEATH_FRAMES + 20) self.finished = 'dead';
    }

    /* ================================================================== *
     * flagpole takeover (fully kinematic — player.update is a pure
     * anim ticker while control=false, js/13 line 153)
     * ================================================================== */
    function checkFlag() {
      if (self.dying || self.flagPhase) return;
      const p = self.player;
      if (p.state !== 'normal' || !hasPole) return;
      const mid = parsed.poleCol * T + T / 2;
      if (p.x + p.w / 2 >= mid) startFlag();
    }
    function startFlag() {
      const p = self.player;
      const mid = parsed.poleCol * T + T / 2;
      const topFeet = parsed.poleTopRow * T;
      const feet = p.y + p.h;
      const frac = clamp((poleBaseFeet - feet) / Math.max(1, poleBaseFeet - topFeet), 0, 1);
      const band = C.SCORE_FLAG[Math.min(Math.floor(frac * C.SCORE_FLAG.length), C.SCORE_FLAG.length - 1)];
      self.gs.score += band;
      self.fx.push(BROS.Objects.popup(String(band), p.x, p.y - 6));
      sfx('flagpole');
      const A = BROS.Audio;
      if (A && A.stopMusic) A.stopMusic(0.3);               // only the Level stops music here
      p.takeControl(false);
      p.facing = -1;
      p.x = mid - p.w + C.FLAG_GRAB_X;                      // straddling the candy cane, facing left
      if (p.y + p.h < topFeet) p.y = topFeet - p.h;         // never above the pole tip
      self.flagPhase = 'grab';
      self.flagT = 0;
    }
    function updateFlag() {
      const p = self.player;
      p.update(self);                                       // anim++ only; zero physics while !control
      self.flagT++;
      self.flagTicks++;
      switch (self.flagPhase) {
        case 'grab':
          if (self.flagT >= C.FLAG_GRAB_FRAMES) { self.flagPhase = 'slide'; self.flagT = 0; }
          break;
        case 'slide':
          p.y += C.FLAG_SLIDE_SPEED;
          if (p.y + p.h >= poleBaseFeet) {
            p.y = poleBaseFeet - p.h;
            self.hopBase = p.y;
            self.flagPhase = 'hop';
            self.flagT = 0;
          }
          break;
        case 'hop': {
          const t = Math.min(1, self.flagT / C.FLAG_HOP_FRAMES);
          p.y = self.hopBase - Math.sin(Math.PI * t) * C.FLAG_HOP_HEIGHT;   // Level-owned arc
          if (self.flagT >= C.FLAG_HOP_FRAMES) {
            p.y = self.hopBase;
            p.facing = 1;
            self.flagPhase = 'walk';
            self.flagT = 0;
          }
          break;
        }
        case 'walk':
          p.x += C.FLAG_WALK_SPEED;
          p.facing = 1;
          // poseOverride beats the 'flag' pose in pose(): walk frames during the auto-walk
          p.poseOverride = 'walk' + (1 + (Math.floor(p.anim / 6) % 2));
          if (p.x + p.w / 2 >= parsed.keepTargetX) {
            p.poseOverride = null;
            self.flagPhase = 'enter';
            self.flagT = 0;
            sfx('gate');
          }
          break;
        case 'enter':
          if (self.flagT < enterCut) {
            p.x += C.FLAG_WALK_SPEED;
            p.poseOverride = 'walk' + (1 + (Math.floor(p.anim / 6) % 2));
          }
          if (self.flagT >= C.FLAG_ENTER_FRAMES) {
            p.poseOverride = null;
            self.flagPhase = 'done';
            self.finished = 'complete';                     // Game tallies, then shows the card
          }
          break;
      }
      if (hasPole) {                                        // flag climbs while Mario slides
        const from = poleBaseFeet - 14;
        const to = parsed.poleTopRow * T + 2;
        const prog = clamp(self.flagTicks / C.FLAG_RAISE_FRAMES, 0, 1);
        self.flagY = from + (to - from) * prog;
      }
    }

    /* ================================================================== *
     * player callbacks (js/13 lines 5-9 contract)
     * ================================================================== */
    this.onHeadBump = function (headCells) {
      if (self.dying || self.flagPhase) return;
      if (!headCells || !headCells.length) return;
      const cell = headCells[0];                            // first touched cell bumps (classic)
      const col = cell.col, row = cell.row;
      const res = TILES.hitTile(self, col, row);
      if (res.result === 'break') {
        const bx = col * T, by = row * T;
        self.fx.push(BROS.Objects.debris(bx, by, -C.DEBRIS_VX1, C.DEBRIS_VY1));
        self.fx.push(BROS.Objects.debris(bx + 8, by, C.DEBRIS_VX1, C.DEBRIS_VY1));
        self.fx.push(BROS.Objects.debris(bx, by + 4, -C.DEBRIS_VX2, C.DEBRIS_VY2));
        self.fx.push(BROS.Objects.debris(bx + 8, by + 4, C.DEBRIS_VX2, C.DEBRIS_VY2));
        self.gs.score += C.SCORE_BRICK;
        sfx('shellkick');                                   // brick smash shares the kick recipe
        self.camera.shake(6, 2);
        for (let i = 0; i < self.enemies.length; i++) {     // monsters resting on the smashed brick
          const e = self.enemies[i];
          if (e.dead) continue;
          if (e.x + e.w <= bx || e.x >= bx + T) continue;
          const feet = e.y + e.h;
          if (feet < by - 8 || feet > by + 8) continue;
          e.flat = true;
          e.kill('stomp'); sfx('stomp'); awardKill(e);
        }
        return;
      }
      if (res.result === 'q') {
        self.bumps.push({ col: col, row: row, t: C.BUMP_FRAMES });
        sfx('bump');                                       // ?-blocks clunk too (classic)
        if (res.qitem === 'bonbon') {
          collectBonbonAt(col * T, (row - 1) * T);          // coin pops above the used block
        } else if (res.qitem) {
          self.items.push(BROS.Objects.item(res.qitem, col, row));
        }
        return;
      }
      if (res.result === 'bump') {
        // ground / trampoline / used blocks stay inert when head-butted (deviation note)
        if (res.id === TILES.GROUND || res.id === TILES.TRAMP || res.id === TILES.USED) return;
        self.bumps.push({ col: col, row: row, t: C.BUMP_FRAMES });
        sfx('bump');
      }
    };
    this.onPlayerLanded = function (ev) {
      if (self.dying || self.flagPhase) return;
      if (self.player.toffeeFrames > 0 && self.preFallVy >= C.TOFFEE_THUD_VY) {
        self.camera.shake(6, 2);                          // toffee landing thud (plan 16 #1)
        sfx('bump');
      }
    };
    this.onLandTrampolined = function () {
      if (self.dying || self.flagPhase) return;
      self.player.launchTrampoline(C.TRAMPOLINE_VY);        // js/13 line 7 contract
      sfx('trampoline');
    };
    this.spawnFireball = function (pl) {
      const dir = pl.facing || 1;
      const x = pl.x + pl.w / 2 + dir * 10 - 4;
      const y = pl.y + (pl.big() ? 14 : 6);
      self.fireballs.push(BROS.Objects.fireball(x, y, dir));
      sfx('fireball');
    };
    this.activeFireballCount = function () {
      let n = 0;
      for (let i = 0; i < self.fireballs.length; i++) if (!self.fireballs[i].dead) n++;
      return n;
    };

    /* ================================================================== *
     * HUD data + tally (plan 14)
     * ================================================================== */
    this.hudData = function () {
      return {
        score: self.gs.score,
        coins: self.gs.coins,
        lives: self.gs.lives,
        timeLeft: self.timeLeft,
        worldName: self.name,
        hurry: self.timeLeft <= C.HURRY_AT
      };
    };
    this.tally = function () {
      if (self.finished !== 'complete' || self.timeLeft <= 0) return true;
      self.frame++;                                        // frame first: gap checks compare against it
      const drain = Math.min(C.TALLY_DRAIN_PER_FRAME, self.timeLeft);
      self.timeLeft -= drain;
      self.gs.score += drain * C.TIME_FLAG_BONUS;
      self.tallyDrained += drain;
      if (self.tallyDrained - self.tallyUnitsLastTick >= C.TALLY_TICK_UNITS &&
          self.frame - self.tallyFrameLastTick >= C.TALLY_TICK_GAP) {
        // tally runs outside level.update(), so drive the frame counter here too
        self.tallyUnitsLastTick = self.tallyDrained;
        self.tallyFrameLastTick = self.frame;
        sfx('tick');
        this.tallyTicks++;
        if (this.tallyTicks % C.TALLY_POPUP_EVERY === 0) {
          this.fx.push(BROS.Objects.popup(String(C.TALLY_TICK_UNITS * C.TIME_FLAG_BONUS),
            this.player.x + 8, this.player.y - 8));                 // animated tally (plan 16 #8)
        }
      }
      return self.timeLeft <= 0;
    };

    /* ================================================================== *
     * draw
     * ================================================================== */
    function drawSprite(ctx, name, x, y, flip, srcH) {
      const S = BROS.Sprites;
      if (!S || !S.get) return;
      const cv = S.get(name);
      if (!cv) return;
      const h = srcH == null ? cv.height : srcH;
      if (h <= 0) return;
      x = Math.round(x); y = Math.round(y);
      if (flip) {
        ctx.save();
        ctx.translate(x + cv.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(cv, 0, 0, cv.width, h, 0, 0, cv.width, h);
        ctx.restore();
      } else {
        ctx.drawImage(cv, 0, 0, cv.width, h, x, y, cv.width, h);
      }
    }

    this.draw = function (ctx) {
      const S = BROS.Sprites;
      ctx.fillStyle = SKY[self.theme] || SKY.day;
      ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
      ctx.save();
      ctx.translate(self.camera.offsetX(), self.camera.offsetY());

      /* background decor (behind tiles) */
      const camR = self.camX + C.VIEW_W;
      for (let i = 0; i < decor.length; i++) {
        const d = decor[i];
        if (d.x + 64 < self.camX || d.x > camR) continue;
        if (!S || !S.get) continue;
        const cv = S.get(d.name);
        if (!cv) continue;
        const y = d.y != null ? d.y : d.bottom - cv.height;
        drawSprite(ctx, d.name, d.x, y, false);
      }

      /* tiles */
      const range = this.camera.visibleCols(this.cols);
      const qAnim = Math.floor(this.frame / 10);
      for (let c = range[0]; c <= range[1]; c++) {
        for (let r = 0; r < this.rows; r++) {
          const id = parsed.tileAt(c, r);
          let name = null;
          if (id === TILES.GROUND) name = TILES.groundSprite(c, r, !parsed.solidAt(c, r - 1));
          else if (id === TILES.BRICK) name = 'tile_brick';
          else if (id === TILES.STONE) name = 'tile_stone';
          else if (id === TILES.USED) name = 'tile_used';
          else if (id === TILES.TRAMP) name = 'tile_trampoline';
          else if (id === TILES.SPIKE) name = 'tile_spike';
          else if (id === TILES.PIPE) {
            const pc = pipeCell[c + ',' + r];
            if (pc) name = TILES.pipeSprite(pc.hgt, pc.i, pc.half);
          } else if (TILES.isQ(id)) name = TILES.qSprite(qAnim);
          if (!name) continue;                              // POLE/KEEP drawn separately
          let oy = 0;
          for (let bi = 0; bi < this.bumps.length; bi++) {
            const bm = this.bumps[bi];
            if (bm.col === c && bm.row === r) {
              oy = -Math.round(C.BUMP_PEAK * Math.sin(Math.PI * (1 - bm.t / C.BUMP_FRAMES)));
              break;
            }
          }
          drawSprite(ctx, name, c * T, r * T + oy, false);
        }
      }

      /* Gingerbread Keeps (stripped from the grid at parse time) */
      for (let i = 0; i < this.keepBlocks.length; i++) {
        const b = this.keepBlocks[i];
        drawSprite(ctx, 'keep', b.col * T, b.row * T, false);
      }

      /* candy-cane flagpole + flag */
      if (hasPole) {
        const px = parsed.poleCol * T;
        for (let r = parsed.poleTopRow; r <= parsed.poleBottomRow; r++) {
          drawSprite(ctx, 'pole_segment', px, r * T, false);
        }
        drawSprite(ctx, (this.frame % 16) < 8 ? 'pole_ball' : 'pole_ball2',
          px + 4, parsed.poleTopRow * T - 8, false);
        drawSprite(ctx, 'flag', px, this.flagY, false);
      }

      /* bonbons */
      for (let i = 0; i < this.bonbons.length; i++) {
        const b = this.bonbons[i];
        if (b.dead) continue;
        if (b.x + b.w < self.camX - 16 || b.x > camR + 16) continue;
        drawSprite(ctx, b.spriteName(), b.x, b.y, false);
      }

      /* items (ember/bubble wiggle is visual; bubble drifts via its update) */
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (it.dead) continue;
        const dx = it.power === 'bubble' ? 0 : Math.round(it.wiggle());
        drawSprite(ctx, it.spriteName(), it.x + dx, it.y, it.flip && it.flip());
      }

      /* fireballs */
      for (let i = 0; i < this.fireballs.length; i++) {
        const f = this.fireballs[i];
        if (f.dead) continue;
        drawSprite(ctx, f.spriteName(), f.x, f.y, false);
      }

      /* enemies */
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead && e.deadTimer <= 0) continue;
        if (e.x + e.w < self.camX - 16 || e.x > camR + 16) continue;
        if (e.blinking && e.blinking() && (this.frame % 12) < 3) continue;  // pre-revive blink
        let srcH = null;
        if (e.kind === 'chomper') {                         // only the exposed band of the 16x30 art
          srcH = Math.max(0, e.h);
          if (srcH < 2) continue;                           // retracted into the pipe
        }
        ctx.globalAlpha = e.dead ? Math.max(0.18, e.deadTimer / 40) : 1;    // flip-fade (plan 12)
        drawSprite(ctx, e.spriteName(), e.x, e.y, e.flip ? e.flip() : e.vx > 0, srcH);
        ctx.globalAlpha = 1;
        if (e.kind === 'floatoo' && !e.dead) {          // dangling candy string (plan 16 #9)
          const sx = Math.round(e.x + 8);
          for (let k = 0; k < 12; k += 2) {
            ctx.fillStyle = (k % 4 === 0) ? '#dce2f0' : '#b85577';
            ctx.fillRect(sx, Math.round(e.y) + 18 + k, 1, 2);
          }
        }
      }

      /* fx: popups are text, the rest are sprites */
      for (let i = 0; i < this.fx.length; i++) {
        const f = this.fx[i];
        if (f.dead) continue;
        if (f.fx === 'popup') {
          if (BROS.Font && BROS.Font.drawText) {
            BROS.Font.drawText(ctx, f.text, Math.round(f.x), Math.round(f.y), { color: '#ffffff' });
          }
          continue;
        }
        drawSprite(ctx, f.spriteName(), f.x, f.y, f.flip ? f.flip() : false);
      }

      /* player (blink-hidden frames are skipped: Level owns the invuln presentation) */
      const p = this.player;
      let show = !p.blinkHidden() && this.flagPhase !== 'done';
      if (this.flagPhase === 'enter' && this.flagT >= enterCut) show = false;
      if (show) {
        let alpha = 1;
        if (this.flagPhase === 'enter') alpha = clamp(1 - this.flagT / enterCut, 0, 1);
        ctx.globalAlpha = alpha;
        if (p.toffeeFrames > 0) {                            // toffee amber tint + outline (plan 16 #7)
          ctx.fillStyle = 'rgba(240, 148, 40, 0.30)';
          ctx.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
          ctx.fillStyle = '#f29a3c';
          ctx.fillRect(p.x - 2, p.y - 2, p.w + 4, 1);
          ctx.fillRect(p.x - 2, p.y + p.h + 1, p.w + 4, 1);
          ctx.fillRect(p.x - 2, p.y - 1, 1, p.h + 2);
          ctx.fillRect(p.x + p.w + 1, p.y - 1, 1, p.h + 2);
        }
        drawSprite(ctx, p.spriteName(), p.x, p.y, p.facing < 0);
        if (p.activeForm() === 'bubble' && S && S.dome) {
          S.dome(ctx, p.x + p.w / 2, p.y + p.h, p.w / 2 + 2, p.h + 10,
            'rgba(140,210,255,0.40)', '#9fd7ff', '#eaf8ff');
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      /* entering-the-Keep fade-to-black + final blackout */
      if (this.flagPhase === 'enter' && this.flagT >= enterCut) {
        const a = clamp((this.flagT - enterCut) / (C.FLAG_ENTER_FRAMES - enterCut), 0, 1);
        ctx.fillStyle = 'rgba(12,9,20,' + a.toFixed(3) + ')';
        ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
      } else if (this.flagPhase === 'done' || this.flagPhase === 'walk') {
        // walk phase keeps the world lit; 'done' holds a full blackout under the card/tally
        if (this.flagPhase === 'done') {
          ctx.fillStyle = 'rgba(12,9,20,1)';
          ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
        }
      }
    };
  }

  BROS.Level = Level;
})();
