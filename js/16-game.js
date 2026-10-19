// PLAN: docs/plan/14-game-state-manager.md
// BROS.Game: the seven-state machine (title/card/play/pause/tally/allclear/
// gameover).  Owns lives + level progression; drives Level (update/tally) and
// draws HUD/Screens over it (z-order).  create() is the DOM-free core so Node
// tests can inject Input/Audio fakes; boot() wires canvas + rAF + touch.
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C;

  /* ---------------- the state machine (no DOM inside) ---------------- */
  function create(canvas, ctx, input) {
    const game = {};
    game.state = 'title';
    game.levelIdx = 0;
    game.level = null;
    game.gs = { score: 0, coins: 0, lives: C.LIVES_START };
    game.cardT = 0;
    game.lock = 0;                     // menu input lockout remaining frames
    game.paused = false;
    game.input = input || BROS.Input; // swap for Node self-tests
    game.tallyT = 0;

    game.newGame = function () {
      game.gs.score = 0; game.gs.coins = 0; game.gs.lives = C.LIVES_START;
      game.levelIdx = 0;
      game.state = 'card';
      game.cardT = 0;
      game.enterMenu();
    };
    game.enterMenu = function () {
      game.lock = C.MENU_LOCKOUT;      // block the same gesture from cascading
      game.input.clear();
    };
    game.acceptGesture = function () {
      return game.lock === 0 && game.input.consume('start');
    };
    game.buildLevel = function (idx) {
      game.levelIdx = idx;
      game.level = new BROS.Level(BROS.LEVELS[idx], game.gs);
      game.paused = false;
    };
    game.musicFor = function () {
      const A = BROS.Audio;
      if (!A || !A.playMusic) return;
      const t = game.level.theme;
      A.playMusic(t === 'cave' ? 'cave' : (t === 'dusk' ? 'dusk' : 'main'));
    };
    function pad7(v) {
      let s = String(Math.max(0, Math.floor(v)));
      while (s.length < 7) s = '0' + s;
      return s;
    }
    game.scoreText = function () { return 'SCORE ' + pad7(game.gs.score); };
    game.finalText = function () { return 'FINAL SCORE ' + pad7(game.gs.score); };

    game.step = function () {
      if (game.lock > 0) game.lock--;
      game.input.update();             // one input snapshot per logic frame
      const menuish = game.state === 'play' || game.state === 'card' ||
                      game.state === 'tally';
      if (game.paused) {               // pause freezes updates; music keeps ticking
        if (menuish && game.input.consume('pause')) {
          game.paused = false;
          const A0 = BROS.Audio;
          if (A0) { A0.setPaused(false); A0.sfx('pause'); }
        }
        return;
      }
      if (menuish && game.input.consume('pause')) {
        game.paused = true;
        const A9 = BROS.Audio;
        if (A9) { A9.setPaused(true); A9.sfx('pause'); }
        return;
      }
      switch (game.state) {
        case 'title':
          if (game.acceptGesture()) {
            game.newGame();
            const A = BROS.Audio;
            if (A && A.playMusic) A.playMusic('card');
          }
          break;

        case 'card':
          game.cardT++;
          if (game.cardT >= C.CARD_AUTO || game.acceptGesture()) {
            game.buildLevel(game.levelIdx);
            game.musicFor();
            game.state = 'play';
            game.enterMenu();                          // clear() + lockout on every entry
          }
          break;

        case 'play':
          game.level.update();
          if (game.level.finished === 'dead') {
            game.gs.lives--;                           // Game owns life loss
            if (game.gs.lives > 0) {                   // plan 14: lives>0 ? card(same)
              game.buildLevel(game.levelIdx);
              game.state = 'card';
              game.cardT = 0;
              game.enterMenu();
              const A1 = BROS.Audio;
              if (A1 && A1.playMusic) A1.playMusic('card');
            } else {
              game.state = 'gameover';
              game.enterMenu();
              const A2 = BROS.Audio;
              if (A2 && A2.playMusic) A2.playMusic('gameover');
            }
          } else if (game.level.finished === 'complete') {
            game.state = 'tally';
            game.tallyT = 0;
            game.enterMenu();
            const A3 = BROS.Audio;
            if (A3 && A3.stopMusic) A3.stopMusic(0.15);
          }
          break;

        case 'tally':
          game.tallyT++;
          if (game.acceptGesture()) {                  // plan 14: start-skip the tally
            while (!game.level.tally()) { game.tallyT++; }   // instant drain, same points
          }
          if (game.level.tally() || game.tallyT > 400) {  // auto path: 300s drains in ~2.5s; guard only breaks runaway
            game.state = 'clear';
            game.enterMenu();
            const A4 = BROS.Audio;
            if (A4 && A4.playMusic) A4.playMusic('clear');
          }
          break;

        case 'clear':
          if (game.acceptGesture()) {
            if (game.levelIdx >= BROS.LEVELS.length - 1) {
              game.state = 'allclear';
              game.enterMenu();
            } else {
              game.levelIdx++;                     // progression lives in Game
              game.state = 'card';
              game.cardT = 0;
              game.enterMenu();
            }
          }
          break;

        case 'allclear':
        case 'gameover':
          if (game.acceptGesture()) {
            game.state = 'title';
            game.enterMenu();
            const A = BROS.Audio;
            if (A && A.playMusic) A.playMusic('main');
          }
          break;
      }
    };

    /* ---------------- draw pass: Level -> HUD -> Screens (plan 14 z-order) ---- */
    game.draw = function () {
      switch (game.state) {
        case 'title':
          BROS.Screens.title(ctx);
          break;
        case 'card':
          BROS.Screens.card(ctx, { worldName: BROS.LEVELS[game.levelIdx].name,
            go: game.cardT >= 40 });
          if (game.paused) BROS.Screens.pause(ctx);
          break;
        case 'play':
          game.level.draw(ctx);
          BROS.HUD.draw(ctx, game.level.hudData());
          if (game.paused) BROS.Screens.pause(ctx);   // pause = play + dim overlay
          break;
        case 'tally':
          game.level.draw(ctx);
          BROS.HUD.draw(ctx, game.level.hudData());   // ticking HUD (plan 15)
          if (game.paused) BROS.Screens.pause(ctx);
          break;
        case 'clear':
          BROS.HUD.draw(ctx, game.level.hudData());
          BROS.Screens.clearcard(ctx, { worldName: BROS.LEVELS[game.levelIdx].name,
            done: game.lock === 0 });
          break;
        case 'gameover':
          BROS.Screens.gameover(ctx, { score: game.scoreText(), retry: game.lock === 0 });
          break;
        case 'allclear':
          BROS.Screens.allclear(ctx, { score: game.finalText(), press: game.lock === 0 });
          break;
      }
    };
    return game;
  }

  /* ---------------- debug hooks (plan 14 acceptance) ---------------- */
  let RUN = null;
  BROS.DEBUG = {
    grantCoins: function (n) { if (RUN) RUN.gs.coins = (RUN.gs.coins + n) % 100; },
    grantLives: function (n) { if (RUN) RUN.gs.lives = Math.min(9, RUN.gs.lives + n); }
  };

  /* ---------------- boot: canvas fit + fixed-step rAF loop ---------------- */
  BROS.Game = {
    create: create,                        // factory exposed for Node self-tests
    boot: function () {
      const cv = document.getElementById('screen');
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const game = create(cv, ctx, null);
      RUN = game;
      game.ctx = ctx;

      BROS.Input.attach();
      const touch = document.getElementById('touch');
      if (touch && !touch.hasChildNodes()) BROS.Input.buildTouch(touch);
      BROS.Sprites.ensure('day');          // title-screen art before any level exists

      /* plan 14 Game.resize(): integer scale, canvas style px size */
      const resize = function () {
        const availW = window.innerWidth, availH = window.innerHeight;
        let k = Math.floor(Math.min(availW / C.VIEW_W, availH / C.VIEW_H));
        if (k < 1) k = 1;
        cv.style.width = (C.VIEW_W * k) + 'px';
        cv.style.height = (C.VIEW_H * k) + 'px';
      };
      BROS.Game.resize = resize;

      let acc = 0, last = 0, gestured = false;
      const stepMs = 1000 / C.FPS;
      const loop = function (now) {
        requestAnimationFrame(loop);
        if (!last) { last = now; return; }
        acc += Math.min(now - last, 250);   // clamp catch-up (tab refocus)
        last = now;
        if (!gestured && BROS.Input.anyPressed()) {
          gestured = true;
          if (BROS.Audio) BROS.Audio.ensure();   // audio unlocks on first gesture
        }
        while (acc >= stepMs) {
          acc -= stepMs;
          game.step();
          game.draw();
          if (BROS.Audio) BROS.Audio.tickMusic();
        }
      };
      resize();
      window.addEventListener('resize', resize);
      requestAnimationFrame(loop);
    }
  };
})();
