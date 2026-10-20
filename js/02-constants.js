// PLAN: docs/plan/03-constants-and-utils.md
// The ONLY tuning surface in the game. Units: pixels and 60Hz frames.
(function () {
  'use strict';
  const BROS = window.BROS;

  BROS.C = {
    // world / render
    TILE: 16, ROWS: 15, VIEW_W: 256, VIEW_H: 240, FPS: 60,
    LIVES_START: 3, BONUS_LIFE_AT: 100, LEVEL_TIME: 300,
    TIME_UNIT_FRAMES: 30, HURRY_AT: 100, HURRY_AT2: 50,

    // physics core
    GRAVITY: 0.55, GRAVITY_HOLD: 0.34, MAX_FALL: 9,
    WALK_MAX: 2.3, RUN_MAX: 3.4,
    GROUND_ACCEL: 0.12, AIR_ACCEL: 0.1,
    GROUND_FRICTION: 0.17, AIR_DRAG: 0.03,
    SKID_ACCEL_MUL: 2.6, SKID_MIN_SPEED: 1.2,   // plan 11: sharp turn-around skid
    JUMP_SMALL: 7.2, JUMP_BIG: 7.5, JUMP_CUT: 2.3,
    JUMP_BUFFER: 8, COYOTE: 6,

    // forms / hitboxes
    SMALL_W: 11, SMALL_H: 16, BIG_W: 12, BIG_H: 30, CROUCH_H: 16,
    BUBBLE_GRAV_MUL: 0.52, BUBBLE_MAX_FALL: 4.6, BUBBLE_FRAMES: 480,
    TOFFEE_GRAV_MUL: 1.8, TOFFEE_MAX_FALL: 12.5, TOFFEE_FRAMES: 480,
    TOFFEE_BOUNCE: 8.6, TOFFEE_KILL_SIDE: true,
    TOFFEE_THUD_VY: 9,
    FIRE_MAX_PROJECTILES: 2, FIRE_COOLDOWN: 14,
    FIREBALL_SPEED: 5, FIREBALL_GRAV: 0.4,
    FIREBALL_BOUNCE: 5.6, FIREBALL_LIFE: 180, FIREBALL_MAX_BOUNCES: 6,

    // enemies
    PUDGE_SPEED: 0.72,
    SHELL_SPEED_WALK: 0.55, SHELL_SLIDE: 4.2,
    SHELL_REVIVE: 480, SHELL_REVIVE_BLINK: 180,
    HOPPER_SPEED: 0.55, HOPPER_JUMP_VY: 5.6, HOPPER_WAIT: 60,
    FLOATOO_SPEED: 0.6, FLOATOO_BOB_AMP: 10, FLOATOO_BOB_PERIOD: 96,
    CHOMPER_AMP: 26, CHOMPER_PERIOD: 140,
    TRAMPOLINE_VY: 11.2,

    // scoring
    COMBO_WINDOW: 45,
    COMBO_VALUES: [100, 200, 400, 800, 1000, 2000, 4000, 8000],
    COMBO_1UP_EVERY: 8,
    SCORE_COIN: 200, SCORE_BRICK: 50, SCORE_FIREBALL: 200,
    SCORE_FLAG: [100, 400, 800, 2000, 4000, 8000],
    TALLY_RATE: 50, TIME_FLAG_BONUS: 50,
    INVULN_HITS: 120,
    STOMP_BOUNCE: 6.6, STOMP_BOUNCE_HELD: 8.2, POP_BOUNCE: 5.2,
    DEATH_PAUSE: 30, DEATH_LAUNCH: 6.4, DEATH_FRAMES: 140,
    FLAG_SLIDE_SPEED: 2.4, FLAG_WALK_SPEED: 1.6,
    // flag-sequence timings (Level takeover state machine, plan 14)
    FLAG_GRAB_FRAMES: 12, FLAG_HOP_FRAMES: 20, FLAG_RAISE_FRAMES: 40,
    FLAG_ENTER_FRAMES: 60, FLAG_GRAB_X: 6, FLAG_HOP_HEIGHT: 12,
    // tally drain scheme: 2 units/frame => a 300-unit tally finishes in ~150f
    // (< 3s, plan 14 acceptance). 'tick' per >=4 drained units, >=3 frames
    // apart (<= 20/s).  TALLY_RATE above is a legacy knob this scheme ignores.
    TALLY_DRAIN_PER_FRAME: 2, TALLY_TICK_UNITS: 4, TALLY_TICK_GAP: 3,
    // enemy cull / activation margins (plan 10 camera section)
    CULL_LEFT: 48, CULL_RIGHT: 80, CULL_BOTTOM: 32,

    // items / effects
    JELLY_SPEED: 0.7, TOFFEE_ITEM_SPEED: 0.7, BUBBLE_ITEM_RISE: 0.35,
    ITEM_EMERGE_FRAMES: 24, ITEM_EMERGE_H: 16,
    COIN_POP_H: 48, COIN_POP_FRAMES: 24,
    BUMP_FRAMES: 14, BUMP_PEAK: 8,
    DEBRIS_VX1: 1.6, DEBRIS_VX2: 0.9, DEBRIS_VY1: -6, DEBRIS_VY2: -4,
    POPUP_RISE: 40, POPUP_FRAMES: 50,
    SPREAD_COOLDOWN: 0, // unused knob placeholder
    SPIKE_COOLDOWN: 30, SPIKE_BOUNCE: 4.5,
    SHELL_KILL_WINDOW: 2,

    // game flow / screens / juice (plans 14-16)
    MENU_LOCKOUT: 30, CARD_AUTO: 90,
    DEATH_SHAKE: [10, 3],
    TALLY_POPUP_EVERY: 8,
    TITLE_CLOUD_DRIFT: 0.1,

    // audio (all gain knobs live here; 0 = silent, 1 = full)
    MASTER_GAIN: 0.6, MUSIC_GAIN: 0.55, SFX_GAIN: 0.9,
    MAX_VOICES: 18, MUSIC_LOOKAHEAD: 0.35,
    // background music switch: false = no BGM anywhere (SFX + the M mute key
    // are unaffected); flip to true to bring the 8-bit tracks back
    MUSIC: false,

    // 2.5D POP render mode (js/17-render25d.js): depths in world units
    // (16px = 1 unit); angles in radians. The camera rig is derived from
    // FOV + VIEW_H, so these stay valid at any window width.
    R3D: {
      FOV: 52, Z_EXTRUDE: 0.62, Z_POP: 0.62, Z_BACK: -1.15, SKY_Z: -18,
      PITCH: -0.035, SWAY_Y: 0.032, SWAY_P: 0.02, SWAY_T: 0.021,
      FOCUS_Y: 0.1, FOCUS_P: 0.05
    }
  };
})();
