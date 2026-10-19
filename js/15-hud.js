// PLAN: docs/plan/15-hud-and-screens.md
// BROS.HUD.draw(ctx, hudData) + BROS.Screens.{title,card,pause,clearcard,gameover,allclear}.
// All text via BROS.Font; every screen copy charset-asserted at load (plan 15
// acceptance). Layout constants are screen coords here (not BROS.C per plan).
// Deviation note: the plan's own HUD anchors overlap (WORLD ends past TIME's
// 184), so TIME/LIVES are re-anchored; the acceptance test is bounds-only.
// The label is 'GUM' (this game's brand) rather than the plan's SMB1 'MARIO'.
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C;
  const F = BROS.Font;
  const S = BROS.Sprites;

  function pad(v, w) {
    let s = String(Math.max(0, Math.floor(v)));
    while (s.length < w) s = '0' + s;
    return s;
  }

  /* ---------- HUD row (fixed screen-space, y0..14, drawn over the level) ---- */
  const HUD_Y = 2, HUD_ICON_Y = 0;
  const HUD_LABEL = 16, HUD_SCORE = 46, HUD_ICON = 88, HUD_COINS = 104,
        HUD_WORLD = 132, HUD_TIME = 188, HUD_LIVES = 238;
  const HUD_WHITE = '#ffffff', HUD_RED = '#ff3b30';

  BROS.HUD = { charsetOK: true };
  BROS.HUD.draw = function (ctx, hud) {
    F.drawText(ctx, 'GUM', HUD_LABEL, HUD_Y, { color: HUD_WHITE });
    F.drawText(ctx, pad(hud.score % 10000000, 7), HUD_SCORE, HUD_Y,
      { color: HUD_WHITE });
    const icon = S.get ? S.get('bonbon0') : null;
    if (icon) ctx.drawImage(icon, HUD_ICON, HUD_ICON_Y);
    F.drawText(ctx, 'X' + pad(hud.coins, 3), HUD_COINS, HUD_Y, { color: HUD_WHITE });
    F.drawText(ctx, 'WORLD ' + hud.worldName, HUD_WORLD, HUD_Y, { color: HUD_WHITE });
    F.drawText(ctx, 'TIME ' + pad(hud.timeLeft, 3), HUD_TIME, HUD_Y,
      { color: hud.hurry ? HUD_RED : HUD_WHITE });
    F.drawText(ctx, 'X' + hud.lives, HUD_LIVES, HUD_Y, { color: HUD_WHITE });
  };
  for (const s of ['GUM', 'WORLD ', 'TIME ', 'X'])
    for (const ch of s) if (!F.hasChar(ch)) BROS.HUD.charsetOK = false;

  /* ---------------- screens: strings pre-validated at build (charset) ------- */
  const T_SUPER = 'SUPER GUMDROP', T_BROS = 'BROS.', T_PRESS = 'PRESS ENTER';
  const T_CTRL1 = 'ARROWS MOVE  SPACE JUMP  X RUN/FIRE';
  const T_CTRL2 = 'P PAUSE  M MUTE';
  const T_LEGEND1 = 'JELLY GROWS YOU  EMBER SPITS FIRE';
  const T_LEGEND2 = 'TOFFEE CHARGE  BUBBLE FLOAT GUARD';
  const T_CREDIT1 = 'ALL CODE ART AUDIO ORIGINAL';
  const T_CREDIT2 = 'ENTER TO BEGIN';
  const T_CARD = 'WORLD ', T_GO = 'GO!', T_PAUSE = 'PAUSED';
  const T_CLEAR = 'CLEAR!', T_OVER = 'GAME OVER', T_SCORE = 'SCORE ';
  const T_FINAL = 'FINAL SCORE ', T_ALLCLEAR = 'ALL CLEAR!';
  const T_THANKS = 'THANKS FOR PLAYING';
  const T_MADE = 'MADE BY: THIS ONE FILE REPO';
  const SCREEN_COPY = [T_SUPER, T_BROS, T_PRESS, T_CTRL1, T_CTRL2,
    T_LEGEND1, T_LEGEND2, T_CREDIT1, T_CREDIT2, T_CARD, T_GO, T_PAUSE, T_CLEAR,
    T_OVER, T_SCORE, T_FINAL, T_ALLCLEAR, T_THANKS, T_MADE];
  let bad = 0;
  for (const s of SCREEN_COPY)
    for (const ch of s) if (!F.hasChar(ch)) bad++;
  if (bad > 0) throw new Error('plan 15 charset assert failed: ' + bad + ' glyphs');

  const SKY_DAY = '#5c94fc', GOLD = '#ffd23c', PINK = '#ff7fae', MINT = '#9ff0c8';
  const TAUPE = '#e0b4d8', WHITE = '#ffffff', BLACK = '#000000';

  BROS.Screens = { blink: 0 };                    // blink clock (toggle 30f)
  const blinkOn = function () { return (BROS.Screens.blink++ % 60) < 30; };

  const center = function (ctx, text, y, scale, color) {
    const w = F.width(text, scale);
    F.drawText(ctx, text, Math.floor((C.VIEW_W - w) / 2), y, { scale: scale, color: color });
  };

  BROS.Screens.title = function (ctx) {
    ctx.fillStyle = SKY_DAY;
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    const drift = (BROS.Screens.blink * C.TITLE_CLOUD_DRIFT) % 216;
    for (const seed of [[4, 16, 'cloud1'], [90, 40, 'cloud2'], [180, 24, 'cloud1']]) {
      const im = S.get(seed[2]);
      if (im) ctx.drawImage(im, 4 + ((seed[0] + drift) % 216), seed[1]);
    }
    center(ctx, T_SUPER, 56, 2, GOLD);
    center(ctx, T_BROS, 80, 1, PINK);
    if ((BROS.Screens.blink++ % 60) < 30) center(ctx, T_PRESS, 130, 1, WHITE);
    center(ctx, T_CTRL1, 160, 1, MINT);
    center(ctx, T_CTRL2, 172, 1, MINT);
    center(ctx, T_LEGEND1, 184, 1, TAUPE);
    center(ctx, T_LEGEND2, 196, 1, TAUPE);
    /* ground strip along the bottom (tiles, not level sprites) */
    for (let c = 0; c < 16; c++) {
      const g = S.get(BROS.Tiles.groundSprite(c, 13, true));
      if (g) ctx.drawImage(g, c * 16, 208);
      const d = S.get(BROS.Tiles.groundSprite(c, 14, false));
      if (d) ctx.drawImage(d, c * 16, 224);
    }
    center(ctx, T_CREDIT1, 214, 1, WHITE);
    center(ctx, T_CREDIT2, 226, 1, GOLD);
  };

  BROS.Screens.card = function (ctx, data) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    center(ctx, T_CARD + data.worldName, 112, 2, WHITE);
    if (data.go) center(ctx, T_GO, 140, 2, GOLD);
  };

  BROS.Screens.pause = function (ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    center(ctx, T_PAUSE, 104, 2, GOLD);
  };

  BROS.Screens.clearcard = function (ctx, data) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    center(ctx, T_CARD + data.worldName, 96, 2, WHITE);
    center(ctx, T_CLEAR, 124, 2, GOLD);
    if (data.done && (BROS.Screens.blink++ % 60) < 30) center(ctx, T_PRESS, 158, 1, WHITE);
  };

  BROS.Screens.gameover = function (ctx, data) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    center(ctx, T_OVER, 112, 2, PINK);
    center(ctx, data.score, 150, 1, WHITE);
    if (data.retry && (BROS.Screens.blink++ % 60) < 30) center(ctx, T_PRESS, 190, 1, WHITE);
  };

  BROS.Screens.allclear = function (ctx, data) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    center(ctx, T_ALLCLEAR, 96, 2, GOLD);
    center(ctx, data.score, 130, 1, WHITE);
    center(ctx, T_THANKS, 160, 1, MINT);
    center(ctx, T_MADE, 172, 1, TAUPE);
    if (data.press && (BROS.Screens.blink++ % 60) < 30) center(ctx, T_PRESS, 196, 1, WHITE);
  };
})();
