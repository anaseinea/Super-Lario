// PLAN: docs/plan/06-sprites-system.md
// 100% original pixel art, drawn procedurally onto offscreen canvases at load
// time. No images, no data URIs, no external files.
// PART A: lookup table, drawing primitives, character (Gumdrop), tiles.
(function () {
  'use strict';
  const BROS = window.BROS;

  // Every sprite made by this whole file (part A + part B) lives in `map`.
  const map = {};
  const tiles = map;

  function rep(ch, n) { return new Array(n + 1).join(ch); }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  /** Paint pixel rows inside a w x h cell, bottom-anchored so feet rest on the
   *  cell floor. Rows are clipped/padded to w: hand-counted art can never make
   *  a sprite the wrong size (a warning is printed when art overflows). */
  function paintRows(name, w, h, rows, palette) {
    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d');
    if (rows.length > h) console.warn('SPRITE ' + name + ': ' + rows.length + ' rows > ' + h);
    const dy = Math.max(0, h - rows.length);
    for (let i = 0; i < rows.length; i++) {
      const y = dy + i;
      if (y >= h) continue;
      const r = rows[i];
      if (r.length > w) console.warn('SPRITE ' + name + ' row ' + i + ': ' + r.length + ' > ' + w);
      for (let x = 0; x < w; x++) {
        const ch = x < r.length ? r[x] : '.';
        if (ch === '.') continue;
        const col = palette[ch];
        if (!col) { console.warn('SPRITE ' + name + ': unknown char "' + ch + '"'); continue; }
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    map[name] = cv;
    return cv;
  }

  function alias(name, src) { map[name] = map[src]; }

  function newFrame(name, w, h, draw) {
    const cv = makeCanvas(w, h);
    draw(cv.getContext('2d'), cv);
    map[name] = cv;
    return cv;
  }

  // ---- primitives (all maths, no hand-counted pixel strings) ----
  function px(ctx, x, y, c) { if (x < 0 || y < 0) return; ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // Upper half of an ellipse: a rounded dome sitting on `baseY`.
  function dome(ctx, cx, baseY, halfW, height, fill, edge, shine) {
    for (let d = 0; d < height; d++) {
      const y = baseY - d;
      const hw = Math.round(halfW * Math.sqrt(Math.max(0, 1 - (d * d) / (height * height))));
      if (hw < 0) continue;
      rect(ctx, cx - hw, y, hw * 2 + 1, 1, fill);
      px(ctx, cx + hw, y, edge);
      if (shine && hw >= 2 && d >= 1 && d <= height - 2) px(ctx, cx - hw, y, shine);
    }
  }

  // A gum blob: filled ellipse with a one-pixel outline plus a light column.
  function blob(ctx, cx, top, bottom, rx, pal) {
    const cy = (top + bottom) / 2, ry = Math.max(1, (bottom - top) / 2);
    for (let y = top; y <= bottom; y++) {
      const d = y - cy;
      let hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (d * d) / (ry * ry))));
      // clamp the taper so a blob never narrows to a nub where it meets its feet
      if (bottom - y < 3) hw = Math.max(hw, Math.min(rx - 1, 4));
      if (y - top < 2) hw = Math.max(hw, Math.min(rx - 2, 3));
      rect(ctx, cx - hw, y, hw * 2 + 1, 1, pal.E);
      px(ctx, cx - hw - 1, y, pal.D);
      px(ctx, cx + hw + 1, y, pal.D);
      if (hw >= 3) px(ctx, cx - hw + 1, y, pal.y);
      if (y === bottom) rect(ctx, cx - hw, y, hw * 2 + 1, 1, pal.D);   // sealed bottom
    }
  }

  // ============ PALETTES (colour-swap = palette variants) ============
  const P_GUM = {
    G: '#d0453c', g: '#a33026', S: '#ffb9c9', F: '#7c2b22',   // strawberry cap
    E: '#d64f9c', D: '#8f2f68', y: '#f08fb9',                 // gum body
    W: '#ffffff', K: '#21130d', M: '#5c1f3a', L: '#ef7a91',   // eyes and mouth
    R: '#57b65a', r: '#2e7031', w: '#b7f095'                  // boots
  };
  const P_FLAME = {
    G: '#e23b3b', g: '#8f1f1f', S: '#f2a08a', F: '#4a1414',
    E: '#f5d04e', D: '#b26f16', y: '#fff0b0',
    W: '#fffbe0', K: '#3a2210', M: '#7c2b22', L: '#f2a03c',
    R: '#f2564d', r: '#b3301f', w: '#ffd0c6'
  };

  const THEMES = {
    day: { X: '#59c95e', L: '#90e28d', g: '#357e36', T: '#a2602e', D: '#7d4620', d: '#592e15' },
    cave: { X: '#8f87c9', L: '#b8b0de', g: '#5a5390', T: '#5a5390', D: '#453f70', d: '#322c5a' },
    dusk: { X: '#e57ba1', L: '#f7b6cb', g: '#b23869', T: '#b23869', D: '#8f2c52', d: '#6e1e3c' }
  };
  const T_BRICK = {
    day: { B: '#c06a34', b: '#7c3c17', m: '#ecc9a2' },
    cave: { B: '#6b63ad', b: '#3e3872', m: '#a99fd8' },
    dusk: { B: '#c8476f', b: '#832748', m: '#e9a9c0' }
  };
  const T_Q = {
    day: { s: '#e7a13c', S: '#f0bd6a', k: '#a5611c', K: '#21160f' },
    cave: { s: '#4f9bd8', S: '#7cb9ea', k: '#2f6391', K: '#101a26' },
    dusk: { s: '#ef7fa0', S: '#f7a9c0', k: '#a34062', K: '#2b1020' }
  };
  const T_USED = {
    day: { s: '#7c5734', S: '#8a5028', k: '#4a2f1a' },
    cave: { s: '#453f70', S: '#524b7d', k: '#2b2557' },
    dusk: { s: '#6e3148', S: '#7c3b52', k: '#4a1e2e' }
  };
  const T_STONE = {
    day: { A: '#b0b7c1', a: '#6f7885' },
    cave: { A: '#7f78ad', a: '#4a4478' },
    dusk: { A: '#c99aaf', a: '#7c5b6e' }
  };
  const P_PIPE = { P: '#39a844', p: '#2c8038', d: '#1d5c28', h: '#7ede76' };

  // ============ PLAYER: "Gumdrop", a candy blob in a strawberry cap ============
  // Frames are drawn with primitives so every pose stays pixel-exact.
  // Sprite boxes: small 12x16, big 16x30, crouch small 12x16 / big 16x16.

  const POSES = {
    small: {
      idle: { capBase: 4, capH: 4, capHalf: 4, top: 6, bottom: 13, rx: 4, bootTop: 14, bootH: 2, eyes: 'open', mouth: 'smile', feet: [1, 6] },
      walk1: { capBase: 4, capH: 4, capHalf: 4, top: 6, bottom: 13, rx: 4, bootTop: 14, bootH: 2, eyes: 'open', mouth: 'flat', feet: [0, 6] },
      walk2: { capBase: 4, capH: 4, capHalf: 4, top: 6, bottom: 13, rx: 4, bootTop: 14, bootH: 2, eyes: 'open', mouth: 'flat', feet: [2, 7] },
      jump: { capBase: 3, capH: 4, capHalf: 4, top: 5, bottom: 12, rx: 4, bootTop: 13, bootH: 2, eyes: 'open', mouth: 'open', feet: [2, 5] },
      skid: { capBase: 4, capH: 4, capHalf: 4, top: 6, bottom: 13, rx: 4, bootTop: 14, bootH: 2, eyes: 'squint', mouth: 'flat', feet: [3, 5] },
      dead: { capBase: 5, capH: 3, capHalf: 4, top: 7, bottom: 13, rx: 4, bootTop: 14, bootH: 2, eyes: 'dead', mouth: 'open', feet: [2, 5] },
      victory: { capBase: 3, capH: 4, capHalf: 4, top: 5, bottom: 12, rx: 4, bootTop: 13, bootH: 2, eyes: 'happy', mouth: 'open', feet: [1, 6], arms: 'up' },
      crouch: { capBase: 8, capH: 4, capHalf: 4, top: 10, bottom: 13, rx: 4, bootTop: 14, bootH: 2, eyes: 'open', mouth: 'flat', feet: [0, 6] }
    },
    big: {
      idle: { capBase: 7, capH: 6, capHalf: 5, top: 10, bottom: 25, rx: 5, bootTop: 26, bootH: 4, eyes: 'open', mouth: 'smile', feet: [2, 9], arms: 'side' },
      walk1: { capBase: 7, capH: 6, capHalf: 5, top: 10, bottom: 25, rx: 5, bootTop: 26, bootH: 4, eyes: 'open', mouth: 'flat', feet: [1, 9], arms: 'side' },
      walk2: { capBase: 7, capH: 6, capHalf: 5, top: 10, bottom: 25, rx: 5, bootTop: 26, bootH: 4, eyes: 'open', mouth: 'flat', feet: [2, 10], arms: 'side' },
      jump: { capBase: 6, capH: 6, capHalf: 5, top: 9, bottom: 24, rx: 5, bootTop: 25, bootH: 4, eyes: 'open', mouth: 'open', feet: [3, 8], arms: 'up' },
      skid: { capBase: 7, capH: 6, capHalf: 5, top: 10, bottom: 25, rx: 5, bootTop: 26, bootH: 4, eyes: 'squint', mouth: 'flat', feet: [4, 8], arms: 'back' },
      dead: { capBase: 8, capH: 5, capHalf: 5, top: 11, bottom: 25, rx: 5, bootTop: 26, bootH: 4, eyes: 'dead', mouth: 'open', feet: [2, 9], arms: 'none' },
      victory: { capBase: 6, capH: 6, capHalf: 5, top: 9, bottom: 24, rx: 5, bootTop: 25, bootH: 4, eyes: 'happy', mouth: 'open', feet: [2, 9], arms: 'up' },
      crouch: { capBase: 7, capH: 5, capHalf: 5, top: 10, bottom: 12, rx: 5, bootTop: 13, bootH: 3, eyes: 'open', mouth: 'flat', feet: [1, 9], arms: 'side', canvasH: 16 }
    }
  };

  function drawEyes(ctx, y, leftX, rightX, w, h, pal, style) {
    for (let k = 0; k < 2; k++) {
      const x = k === 0 ? leftX : rightX;
      if (style === 'open' || style === 'squint') {
        const hh = style === 'squint' ? 1 : h;
        rect(ctx, x, y + (h - hh), w, hh, pal.W);
        const pupilX = k === 0 ? x + w - 2 : x;
        if (style === 'open') rect(ctx, pupilX, y + 1, 2, h - 1, pal.K);
        else rect(ctx, pupilX, y, 2, 1, pal.K);
        // angry inner corner
        px(ctx, k === 0 ? x + w - 1 : x, y + (h - hh), pal.D);
      } else if (style === 'dead') {
        for (let i = 0; i < 3; i++) {
          px(ctx, x + i, y + 1 + i, pal.K);
          px(ctx, x + (2 - i), y + 1 + i, pal.K);
        }
      } else if (style === 'happy') {
        px(ctx, x, y + 2, pal.K); px(ctx, x + 1, y + 1, pal.K);
        px(ctx, x + 2, y + 2, pal.K);
        if (w >= 4) { px(ctx, x + 3, y + 2, pal.K); px(ctx, x + 2, y + 1, pal.K); }
      }
    }
  }

  function drawMouth(ctx, cx, y, pal, style) {
    if (style === 'smile') {
      rect(ctx, cx - 2, y, 4, 1, pal.M);
      px(ctx, cx - 3, y - 1, pal.M); px(ctx, cx + 3, y - 1, pal.M);
    } else if (style === 'flat') {
      rect(ctx, cx - 2, y, 4, 1, pal.M);
    } else {
      rect(ctx, cx - 2, y, 5, 2, pal.M);
      px(ctx, cx - 2, y + 1, pal.L); px(ctx, cx - 1, y + 1, pal.L);
    }
  }

  function drawBoots(ctx, yTop, h, xL, xR, pal, footW) {
    for (let k = 0; k < 2; k++) {
      const x = k === 0 ? xL : xR;
      rect(ctx, x, yTop, footW, h - 1, pal.R);
      rect(ctx, x, yTop + h - 1, footW, 1, pal.r);
      px(ctx, x - 1, yTop + h - 2, pal.D);
      px(ctx, x + footW, yTop + h - 2, pal.D);
      px(ctx, x, yTop, pal.w);
      // taper the toe so feet read as feet
      px(ctx, x + footW - 1, yTop, pal.D);
    }
  }

  function drawArms(ctx, cx, rx, y, pal, style, big) {
    if (style === 'none') return;
    const armH = big ? 6 : 3;
    let ay = y;
    if (style === 'up') ay = y - 9;
    if (style === 'back') ay = y + 2;
    for (const side of [-1, 1]) {
      const x = cx + side * (rx + 1) - (side > 0 ? 0 : 1);
      rect(ctx, x, ay, 2, armH, pal.E);
      px(ctx, x, ay + armH - 1, pal.D);
      px(ctx, x + side, ay + armH - 1, pal.K);       // hand
      px(ctx, x, ay - 1, pal.D);
      if (style === 'up') { px(ctx, x, ay - 2, pal.K); px(ctx, x + 1, ay - 2, big ? pal.K : pal.D); }
    }
  }

  function buildPlayer() {
    for (const vk of ['gum', 'flame']) {
      const pal = vk === 'flame' ? P_FLAME : P_GUM;

      for (const pose of ['idle', 'walk1', 'walk2', 'jump', 'skid', 'dead', 'victory', 'crouch']) {
        // small: 12 x 16
        (function () {
          const p = POSES.small[pose];
          newFrame('p_small_' + pose + '_' + vk, 12, 16, function (ctx) {
            dome(ctx, 6, p.capBase, p.capHalf, p.capH, pal.G, pal.g, pal.S);
            rect(ctx, 1, p.capBase + 1, 11, 1, pal.F);            // brim
            blob(ctx, 6, p.top, p.bottom, p.rx, pal);
            drawEyes(ctx, p.capBase + 2, 3, 8, 2, 2, pal, p.eyes);
            drawMouth(ctx, 6, p.bottom - 3, pal, p.mouth);
            drawBoots(ctx, p.bootTop, p.bootH, p.feet[0], p.feet[1], pal, 5);
            if (p.arms) drawArms(ctx, 6, p.rx, p.capBase + 6, pal, p.arms, false);
          });
        })();

        // big: 16 x 30 (16 x 16 when crouched)
        (function () {
          const p = POSES.big[pose];
          const h = p.canvasH || 30;
          newFrame('p_big_' + pose + '_' + vk, 16, h, function (ctx) {
            dome(ctx, 8, p.capBase, p.capHalf, p.capH, pal.G, pal.g, pal.S);
            rect(ctx, 1, p.capBase + 1, 15, 2, pal.F);            // wide brim
            blob(ctx, 8, p.top, p.bottom, p.rx, pal);
            drawEyes(ctx, p.capBase + 3, 4, 10, 3, 3, pal, p.eyes);
            drawMouth(ctx, 8, p.bottom - 4, pal, p.mouth);
            drawBoots(ctx, p.bootTop, p.bootH, p.feet[0], p.feet[1], pal, 5);
            if (p.arms) drawArms(ctx, 8, p.rx, p.top + 4, pal, p.arms, true);
          });
        })();
      }
    }
  }

  // ============ TILES ============
  // Ground, stone and used blocks are generated so every row is exactly 16 px
  // and a run of tiles reads as blocks instead of one flat slab.
  function speckleRow(w, base, marks) {
    const line = new Array(w);
    for (let i = 0; i < w; i++) line[i] = base;
    for (const m of marks) if (m[1] >= 0 && m[1] < w) line[m[1]] = m[0];
    return line.join('');
  }
  function pick(rng, n, lo, hi, taken) {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 200) {
      const x = lo + Math.floor(rng() * (hi - lo + 1));
      if (taken.indexOf(x) === -1 && out.indexOf(x) === -1) { out.push(x); taken.push(x); }
    }
    return out;
  }
  // `cap` = grassed top; bare variants are used for tiles buried inside a run.
  function makeGround(seed, cap) {
    const rng = BROS.U.mulberry32(seed);
    const rows = [];
    for (let y = 0; y < 16; y++) {
      const taken = [];
      const marks = [];
      if (cap && y === 0) {
        for (const x of pick(rng, 3, 2, 13, taken)) marks.push(['g', x]);
        for (const x of pick(rng, 2, 2, 13, taken)) marks.push(['L', x]);
        rows.push(speckleRow(16, 'X', marks));
      } else if (cap && y === 1) {
        for (const x of pick(rng, 5, 1, 13, taken)) marks.push(['g', x]);
        for (const x of pick(rng, 1, 2, 13, taken)) marks.push(['L', x]);
        rows.push(speckleRow(16, 'X', marks));
      } else if (cap && y === 2) {
        const v = Math.floor(seed / 13) % 3;
        for (let x = 0; x < 16; x++) if ((x + v) % 3 === 0) marks.push(['g', x]);
        for (const x of pick(rng, 2, 1, 13, taken)) marks.push(['L', x]);
        rows.push(speckleRow(16, 'X', marks));
      } else if (cap && y === 3) {
        for (const x of pick(rng, 3, 1, 14, taken)) marks.push(['X', x]);
        for (const x of pick(rng, 3, 1, 14, taken)) marks.push(['T', x]);
        for (const x of pick(rng, 2, 1, 14, taken)) marks.push(['d', x]);
        rows.push(speckleRow(16, 'g', marks));
      } else if (cap && y === 4) {
        for (const x of pick(rng, 2, 2, 13, taken)) marks.push(['g', x]);   // grass roots
        for (const x of pick(rng, 3, 1, 14, taken)) marks.push(['D', x]);
        for (const x of pick(rng, 3, 1, 14, taken)) marks.push(['d', x]);
        rows.push(speckleRow(16, 'T', marks));
      } else if (y >= 13) {
        for (const x of pick(rng, 3, 1, 14, taken)) marks.push(['T', x]);   // buried pebbles catch light
        for (const x of pick(rng, 4, 1, 14, taken)) marks.push(['d', x]);
        rows.push(speckleRow(16, 'D', marks));
      } else {
        for (const x of pick(rng, 3, 1, 14, taken)) marks.push(['D', x]);
        for (const x of pick(rng, 4, 1, 14, taken)) marks.push(['d', x]);
        rows.push(speckleRow(16, 'T', marks));
      }
    }
    // right-edge shading: gives a run of ground visible block seams
    for (let y = 0; y < 16; y++) {
      const line = rows[y].split('');
      line[15] = (cap && y <= 3) ? 'g' : 'D';
      if (cap && y === 0) line[15] = 'X';
      if (cap && y === 3) line[15] = 'd';
      if (y === 15) line[15] = 'd';
      rows[y] = line.join('');
    }
    return rows;
  }

  const BRICK_ROWS = [
    rep('m', 16),
    rep('B', 6) + 'b' + 'm' + rep('B', 7) + 'b',
    rep('B', 6) + 'b' + 'm' + rep('B', 7) + 'b',
    rep('m', 16),
    rep('B', 2) + 'b' + 'm' + rep('B', 7) + 'b' + 'm' + rep('B', 2) + 'b',
    rep('B', 2) + 'b' + 'm' + rep('B', 7) + 'b' + 'm' + rep('B', 2) + 'b',
    rep('m', 16),
    rep('B', 6) + 'b' + 'm' + rep('B', 7) + 'b',
    rep('B', 6) + 'b' + 'm' + rep('B', 7) + 'b',
    rep('m', 16),
    rep('B', 2) + 'b' + 'm' + rep('B', 7) + 'b' + 'm' + rep('B', 2) + 'b',
    rep('B', 2) + 'b' + 'm' + rep('B', 7) + 'b' + 'm' + rep('B', 2) + 'b',
    rep('m', 16),
    rep('B', 6) + 'b' + 'm' + rep('B', 7) + 'b',
    rep('B', 6) + 'b' + 'm' + rep('B', 7) + 'b',
    rep('b', 16)
  ];

  function qFrame(mode) {
    // mode 0/1/2 pulse: a shine band travels down the block while the ? glints
    const rows = [];
    rows.push(rep('K', 16));
    const shine = mode === 0 ? 1 : (mode === 1 ? 3 : 5);
    for (let y = 1; y <= 4; y++) {
      rows.push('K' + (y >= shine && y <= shine + 2 ? rep('S', 14) : rep('s', 14)) + 'K');
    }
    rows.push('K' + rep('s', 4) + rep('k', 6) + rep('s', 4) + 'K');   // top bar of ?
    rows.push('K' + rep('s', 8) + 'kk' + rep('s', 4) + 'K');          // curve right
    rows.push('K' + rep('s', 6) + 'kk' + rep('s', 6) + 'K');
    rows.push('K' + rep('s', 14) + 'K');
    rows.push('K' + rep('s', 6) + 'kk' + rep('s', 6) + 'K');          // stem
    rows.push('K' + rep('s', 6) + 'kk' + rep('s', 6) + 'K');
    rows.push('K' + rep('s', 14) + 'K');
    rows.push('K' + rep('s', 6) + 'kk' + rep('s', 6) + 'K');          // dot
    rows.push('K' + rep('s', 14) + 'K');
    rows.push('K' + rep('s', 14) + 'K');
    rows.push(rep('K', 16));
    return rows;
  }

  const USED_ROWS = (function () {
    const r = [];
    r.push(rep('K', 16));
    for (let y = 1; y <= 14; y++) {
      if (y === 1) r.push('K' + 'n' + rep('s', 13) + 'w');
      else if (y === 14) r.push('K' + rep('w', 6) + 'n' + rep('w', 7) + 'n');
      else r.push('K' + rep('s', 14) + 'w');
    }
    r.push(rep('K', 16));
    return r.slice(0, 16);
  })();

  const STONE_ROWS = (function () {
    const r = [];
    r.push(rep('A', 16));
    r.push(speckleRow(16, 'A', [['a', 1], ['a', 2], ['a', 6], ['a', 11]]));
    for (let y = 2; y <= 12; y++) {
      const off = (y % 2) ? 1 : 4;
      r.push(speckleRow(16, 'A', [['a', off], ['a', off + 4], ['a', off + 8], ['a', off + 12]]));
    }
    r.push(speckleRow(16, 'A', [['a', 3], ['a', 8], ['a', 13]]));
    r.push(rep('a', 16));
    r.push(rep('a', 16));
    return r;
  })();

  const TRAMP_ROWS = (function () {
    const r = [];
    for (let y = 0; y < 2; y++) r.push(y === 0 ? 'y' + rep('R', 14) + 'y' : rep('R', 16));
    for (let y = 2; y <= 11; y++) r.push(y % 2 === 0 ? 'yy..yy..yy..yy..' : '..yy..yy..yy..yy');
    r.push('gggg' + 'DDDD' + 'gggg');   // springs compressed at the base
    r.push('g' + rep('D', 2) + 'ggggg' + rep('D', 2) + 'g');
    r.push(rep('R', 16));
    r.push('R' + rep('g', 14) + 'R');
    return r;
  })();

  // spikes: rasterized from a height field (three candy peaks), no hand rows
  function drawSpikes(cv) {
    const ctx = cv.getContext('2d');
    const peaks = [2, 8, 14];
    for (let x = 0; x < 16; x++) {
      let h = 1;
      for (const p of peaks) h = Math.max(h, 10 - Math.abs(x - p) * 2);
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = ((x + y) % 2) ? '#8e96a3' : '#cfd4da';
        ctx.fillRect(x, 9 - y, 1, 1);
      }
      ctx.fillStyle = '#454c57';
      ctx.fillRect(x, 10, 1, 6);                     // shared base bar
      ctx.fillStyle = '#2b323c';
      ctx.fillRect(x, 15, 1, 1);
    }
  }

  // pipes are built from one 16-wide pattern pair, half-cell per sprite
  const PIPE_RIM_L = [
    'd' + rep('P', 15),
    'd' + rep('P', 12) + 'hhh',
    rep('d', 16)
  ];
  const PIPE_RIM_R = [
    rep('P', 15) + 'd',
    'hhh' + rep('P', 12) + 'd',
    rep('d', 16)
  ];
  const PIPE_BODY_L = 'd' + 'pp' + rep('P', 12) + 'h';
  const PIPE_BODY_R = 'h' + rep('P', 12) + 'pp' + 'd';
  function pipeSprite(name, rim, body) {
    const rows = [rim[0], rim[1], rim[2]];
    for (let y = 3; y < 16; y++) rows.push(body);
    paintRows(name, 16, 16, rows, P_PIPE);
  }
  function pipeBodySprite(name, body) {
    const rows = [];
    for (let y = 0; y < 16; y++) rows.push(body);
    paintRows(name, 16, 16, rows, P_PIPE);
  }

  // candy-cane flagpole: one 16-tall spiralling segment, stacked by the renderer
  const CANE_ROWS = (function () {
    const rows = [];
    for (let y = 0; y < 16; y++) {
      let r = '';
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15) r += 'K';
        else if (x < 5 || x > 10) r += 'B';
        else r += ((x - 5) + 2 * y) % 8 < 4 ? 'R' : 'B';
      }
      rows.push(r);
    }
    return rows;
  })();

  const FLAG_ROWS = [
    rep('R', 16), rep('R', 16), rep('R', 16),
    rep('R', 4) + 'WWWWWW' + rep('R', 6),
    rep('R', 4) + 'WWWWWW' + rep('R', 6),
    rep('R', 4) + 'WWKWKW' + rep('R', 6),
    rep('R', 4) + 'WWWWWW' + rep('R', 6),
    rep('R', 4) + '.WWWW.' + rep('R', 6),
    rep('R', 4) + '..WW..' + rep('R', 6),
    rep('R', 14) + '..',
    rep('R', 11) + '.....',
    rep('R', 14) + '..',
    rep('R', 16), rep('R', 16)
  ];

  const BALL_ROWS = [
    '..YYYY..',
    '.YYYYYY.',
    'YYYYYYYY',
    'YYYYYYYY',
    'YYYYYYYY',
    'YYYYYyyy',
    'YYYYyyyy',
    '.yyyyyy.'
  ];
  const BALL2_ROWS = [
    '..yyyy..',
    '.yyyyyy.',
    'yyyyYYYY',
    'yyyyYYYY',
    'yyyyYYYY',
    'yyyYYYYY',
    'yyYYYYYY',
    '.YYYYYY.'
  ];

  function buildTiles(theme) {
    const pal = THEMES[theme] || THEMES.day;
    for (let v = 0; v < 4; v++) {
      paintRows('tile_ground_' + (v + 1), 16, 16, makeGround(101 + v * 13, true), pal);
      paintRows('tile_ground_bare' + (v + 1), 16, 16, makeGround(401 + v * 13, false), pal);
    }
    paintRows('tile_brick', 16, 16, BRICK_ROWS, T_BRICK[theme] || T_BRICK.day);
    const qpal = T_Q[theme] || T_Q.day;
    paintRows('tile_q0', 16, 16, qFrame(0), qpal);
    paintRows('tile_q1', 16, 16, qFrame(1), qpal);
    paintRows('tile_q2', 16, 16, qFrame(2), qpal);
    paintRows('tile_used', 16, 16, USED_ROWS, { K: '#21160f', s: T_USED[theme].s, n: '#31241a', w: '#3f3123' });
    paintRows('tile_stone', 16, 16, STONE_ROWS, T_STONE[theme] || T_STONE.day);
    paintRows('tile_trampoline', 16, 16, TRAMP_ROWS, { R: '#e23b5e', g: '#7c2b22', y: '#f5d04e', D: '#3a1010' });
    map['tile_spike'] = makeCanvas(16, 16);
    drawSpikes(map['tile_spike']);
    pipeSprite('pipe_tl', PIPE_RIM_L, PIPE_BODY_L);
    pipeSprite('pipe_tr', PIPE_RIM_R, PIPE_BODY_R);
    pipeBodySprite('pipe_bl', PIPE_BODY_L);
    pipeBodySprite('pipe_br', PIPE_BODY_R);
    pipeBodySprite('pipe_l', PIPE_BODY_L);
    pipeBodySprite('pipe_r', PIPE_BODY_R);
    paintRows('pole_segment', 16, 16, CANE_ROWS, { R: '#d0453c', B: '#f4f4f4', K: '#8f1f1f' });
    paintRows('flag', 16, 14, FLAG_ROWS, { R: '#d0453c', W: '#f7ede4', K: '#33221f' });
    paintRows('pole_ball', 8, 8, BALL_ROWS, { Y: '#f5d04e', y: '#c98d3f' });
    paintRows('pole_ball2', 8, 8, BALL2_ROWS, { Y: '#f5d04e', y: '#c98d3f' });
  }

  BROS.Sprites = {
    _map: map,
    tiles: tiles,
    makeCanvas: makeCanvas,
    paintRows: paintRows,
    newFrame: newFrame,
    alias: alias,
    rep: rep,
    dome: dome,
    blob: blob,
    px: px,
    rect: rect,
    P_GUM: P_GUM,
    P_FLAME: P_FLAME,
    THEMES: THEMES,
    T_BRICK: T_BRICK,
    T_Q: T_Q,
    T_USED: T_USED,
    T_STONE: T_STONE,
    buildPlayer: buildPlayer,
    buildTiles: buildTiles
  };
})();
// >>> PART B: items, FX, enemies, decor, keep, ensure() <<<
(function () {
  'use strict';
  const BROS = window.BROS;
  const S = BROS.Sprites;
  const map = S._map;
  const newFrame = S.newFrame, alias = S.alias;
  const rect = S.rect, px = S.px, dome = S.dome, blob = S.blob, rep = S.rep;

  // lower half of an ellipse (a bowl): used for flipped shells and clouds
  function bowl(ctx, cx, topY, halfW, height, fill, edge, shine) {
    for (let d = 0; d < height; d++) {
      const y = topY + d;
      const hw = Math.round(halfW * Math.sqrt(Math.max(0, 1 - (d * d) / (height * height))));
      if (hw < 0) continue;
      rect(ctx, cx - hw, y, hw * 2 + 1, 1, fill);
      px(ctx, cx - hw - 1, y, edge); px(ctx, cx + hw + 1, y, edge);
      if (d === height - 1) rect(ctx, cx - hw, y, hw * 2 + 1, 1, edge);
      if (shine && hw >= 2 && d < height - 2) px(ctx, cx - hw, y, shine);
    }
  }

  // ============ BONBONS (the collectible; spin = width pulsation) ============
  function ellipseBand(ctx, cx, cy, rx, ry, fill, edge, shine) {
    const top = Math.round(cy - ry), bot = Math.round(cy + ry);
    for (let y = top; y <= bot; y++) {
      const d = (y - cy) / ry;
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - d * d)));
      if (hw < 0) continue;
      rect(ctx, cx - hw, y, hw * 2 + 1, 1, fill);
      px(ctx, cx - hw - 1, y, edge); px(ctx, cx + hw + 1, y, edge);
      if (y === top || y === bot) rect(ctx, cx - hw, y, hw * 2 + 1, 1, edge);
      if (hw >= 2) { px(ctx, cx - hw + 1, y, shine); if (y < cy) px(ctx, cx - hw + 2, y, shine); }
    }
  }
  function buildBonbons() {
    const P = { E: '#e94d6f', D: '#8c2440', y: '#ffb9cb' };
    newFrame('bonbon0', 16, 16, function (ctx) { ellipseBand(ctx, 8, 8, 5, 6, P.E, P.D, P.y); });
    newFrame('bonbon1', 16, 16, function (ctx) { ellipseBand(ctx, 8, 8, 4, 6, P.E, P.D, P.y); });
    newFrame('bonbon2', 16, 16, function (ctx) { ellipseBand(ctx, 8, 8, 2, 7, P.E, P.D, P.y); });
    alias('bonbon3', 'bonbon1');
  }

  // ============ ITEMS ============
  function buildItems() {
    buildBonbons();

    // Jellydrop: wobbly gel dome with a highlight
    newFrame('jelly', 16, 16, function (ctx) {
      const E = '#4fbf57', D = '#256a2c', y = '#c7f5a8';
      dome(ctx, 8, 14, 6, 11, E, D, y);
      rect(ctx, 2, 14, 13, 1, D);
      px(ctx, 5, 8, y); px(ctx, 6, 7, y); px(ctx, 4, 9, y);
      px(ctx, 8, 3, D); px(ctx, 7, 4, E);                 // dimple on top
    });

    // Embershell: a burning ember with a flame notch
    newFrame('ember', 16, 16, function (ctx) {
      const R = '#e23b3b', r = '#8f1f1f', F = '#f5d04e', S = '#6fae52';
      ellipseBand(ctx, 8, 10, 6, 5, R, r, F);
      rect(ctx, 2, 13, 13, 2, r);
      px(ctx, 6, 3, F); px(ctx, 7, 2, F); px(ctx, 8, 4, F); px(ctx, 9, 3, F);
      px(ctx, 7, 5, F); px(ctx, 8, 6, F);                  // flame tongue
      px(ctx, 4, 5, S); px(ctx, 11, 5, S);                 // shell nubs
      px(ctx, 5, 9, F); px(ctx, 10, 11, F);
    });

    // Toffee Bar: wrapped candy, wrapper twists at both ends
    newFrame('toffee', 16, 16, function (ctx) {
      const T = '#b06a3a', t = '#7c421c', W = '#f0b6c9', K = '#3a1d0d';
      rect(ctx, 3, 6, 10, 7, T);
      rect(ctx, 3, 6, 10, 1, W);
      rect(ctx, 3, 12, 10, 1, t);
      rect(ctx, 3, 13, 10, 1, K);
      for (let i = 0; i < 4; i++) {                        // pinched wrapper ends
        px(ctx, 2, 7 + i, W); px(ctx, 13, 7 + i, W);
        px(ctx, 1, 8 + i, W); px(ctx, 14, 8 + i, W);
      }
      px(ctx, 5, 8, W); px(ctx, 6, 8, W); px(ctx, 9, 10, t); px(ctx, 10, 10, t);
    });

    // Bubble Shield pickup: thin soap ring with a specular
    newFrame('bubble_item', 16, 16, function (ctx) {
      const ctx2 = ctx;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x - 7.5, dy = y - 7.5, d = Math.sqrt(dx * dx + dy * dy);
          if (d >= 5.0 && d <= 6.4) { ctx2.fillStyle = 'rgba(190,233,255,0.9)'; ctx2.fillRect(x, y, 1, 1); }
          else if (d < 4.6 && (x + y) % 4 === 0) { ctx2.fillStyle = 'rgba(190,233,255,0.14)'; ctx2.fillRect(x, y, 1, 1); }
        }
      }
      ctx2.fillStyle = '#e8fbff';
      ctx2.fillRect(4, 5, 1, 1); ctx2.fillRect(5, 4, 1, 1); ctx2.fillRect(6, 4, 1, 1);
    });
  }

  // ============ FX ============
  function buildFx() {
    const pal = { B: '#c06a34', b: '#7c3c17', m: '#ecc9a2' };
    const rows = [
      rep('m', 8),
      rep('B', 6) + 'b' + 'm',
      rep('B', 6) + 'b' + 'm',
      rep('m', 8),
      'BBbmBBBB',
      'BBbmBBBB',
      rep('m', 8),
      rep('B', 6) + 'b' + 'm'
    ];
    S.paintRows('debris1', 8, 8, rows, pal);
    S.paintRows('debris2', 8, 8, rows.map(function (r) { return r.split('').reverse().join(''); }), pal);
  }

  // ============ ENEMIES ============
  function eyesRow(ctx, y, xs, w, pal, style) {
    for (let k = 0; k < xs.length; k++) {
      const x = xs[k];
      if (style === 'open') { rect(ctx, x, y, w, 2, pal.W); px(ctx, x + (k % 2 ? 0 : w - 1), y + 1, pal.K); }
      else if (style === 'squint') { rect(ctx, x, y + 1, w, 1, pal.W); px(ctx, x + (k % 2 ? 0 : w - 1), y + 1, pal.K); }
      else if (style === 'dead') { px(ctx, x, y, pal.K); px(ctx, x + 1, y + 1, pal.K); px(ctx, x + 2, y + 2, pal.K); px(ctx, x + 2, y, pal.K); px(ctx, x + 1, y + 1, pal.K); px(ctx, x, y + 2, pal.K); }
      else if (style === 'angry') { rect(ctx, x, y + 1, w, 2, pal.W); px(ctx, x + (k % 2 ? 0 : w - 1), y + 2, pal.K); px(ctx, x + (k % 2 ? w - 1 : 0), y, pal.D); }
    }
  }

  function buildEnemies() {
    const PUDGE = { E: '#a9764d', D: '#6e4226', y: '#d6a878', W: '#ffffff', K: '#21130d', M: '#4a2a14', F: '#7c4b2a' };
    const HOPPER = { E: '#e2903b', D: '#8f4d13', y: '#ffc987', W: '#ffffff', K: '#21130d', M: '#5c3a17', F: '#a85f1e' };

    // Pudge: a slow marshmallow lump on four stubby feet
    function pudge(ctx, pal, phase, style) {
      blob(ctx, 8, 3, 12, 6.5, pal);
      dome(ctx, 8, 4, 5, 3, pal.E, pal.D, pal.y);
      eyesRow(ctx, 6, [4, 10], 2, pal, style);
      rect(ctx, 6, 9, 4, 1, pal.M);                        // flat grumbly mouth
      px(ctx, 5, 8, pal.M); px(ctx, 10, 8, pal.M);         // jowl marks
      // four feet; phase shifts which pair is planted
      const feet = phase ? [1, 4, 9, 13] : [2, 5, 8, 12];
      for (let i = 0; i < 4; i++) {
        const x = feet[i];
        const up = phase && (i === 1 || i === 3);
        rect(ctx, x, up ? 13 : 14, 2, up ? 1 : 2, pal.F);
        px(ctx, x, 15, pal.D); px(ctx, x + 1, 15, pal.D);
      }
    }
    newFrame('pudge1', 16, 16, function (ctx) { pudge(ctx, PUDGE, false, 'angry'); });
    newFrame('pudge2', 16, 16, function (ctx) { pudge(ctx, PUDGE, true, 'angry'); });
    newFrame('pudge_flat', 16, 8, function (ctx) {
      blob(ctx, 8, 0, 5, 7, PUDGE);
      rect(ctx, 1, 5, 14, 1, PUDGE.D);
      eyesRow(ctx, 2, [4, 10], 2, PUDGE, 'dead');
      rect(ctx, 3, 6, 10, 1, PUDGE.F);
      rect(ctx, 2, 7, 12, 1, PUDGE.D);
    });

    // Hopper: a spring-backed lump; its coil flattens when it is not hopping
    function hopper(ctx, pal, compressed, style) {
      const bodyBottom = compressed ? 8 : 10;
      blob(ctx, 8, compressed ? 4 : 1, bodyBottom, 6, pal);
      eyesRow(ctx, compressed ? 6 : 4, [4, 10], 2, pal, style);
      rect(ctx, 6, compressed ? 9 : 7, 4, 1, pal.M);
      // coil spring
      const base = compressed ? 12 : 12;
      for (let i = 0; i < 3; i++) {
        const y = base + i * 1;
        const inset = i % 2 ? 3 : 1;
        rect(ctx, 3 + inset, y, 10 - 2 * inset, 1, pal.F);
      }
      if (compressed) { rect(ctx, 2, 13, 12, 1, pal.D); rect(ctx, 4, 14, 8, 1, pal.F); }
      else { rect(ctx, 4, 15, 3, 1, pal.D); rect(ctx, 9, 15, 3, 1, pal.D); }
    }
    newFrame('hopper1', 16, 16, function (ctx) { hopper(ctx, HOPPER, false, 'angry'); });
    newFrame('hopper2', 16, 16, function (ctx) { hopper(ctx, HOPPER, false, 'open'); });
    newFrame('hopper_flat', 16, 8, function (ctx) {
      blob(ctx, 8, 0, 4, 7, HOPPER);
      rect(ctx, 1, 4, 14, 1, HOPPER.D);
      eyesRow(ctx, 2, [4, 10], 2, HOPPER, 'dead');
      rect(ctx, 3, 5, 10, 1, HOPPER.F);
      rect(ctx, 2, 6, 12, 1, HOPPER.D);
      rect(ctx, 4, 7, 8, 1, HOPPER.F);
    });

    // Tinshell: a tin-domed critter that becomes a sliding hazard
    const SHELL = { E: '#4faf57', D: '#20602a', y: '#9fe3a4', W: '#ffffff', K: '#21130d', H: '#d9a066', h: '#2c7a36', F: '#20602a' };
    newFrame('shell_walk1', 16, 16, function (ctx) {
      rect(ctx, 0, 9, 4, 3, SHELL.H); px(ctx, 1, 10, SHELL.K); px(ctx, 2, 10, SHELL.K);   // head, eyes forward
      dome(ctx, 9, 13, 6, 9, SHELL.E, SHELL.D, SHELL.y);
      rect(ctx, 3, 13, 12, 1, SHELL.D);
      px(ctx, 7, 7, SHELL.h); px(ctx, 9, 6, SHELL.h); px(ctx, 11, 8, SHELL.h);            // lid rings
      rect(ctx, 4, 14, 3, 1, SHELL.F); rect(ctx, 10, 14, 3, 1, SHELL.F);
      rect(ctx, 5, 15, 2, 1, SHELL.D); rect(ctx, 11, 15, 2, 1, SHELL.D);
    });
    newFrame('shell_walk2', 16, 16, function (ctx) {
      rect(ctx, 0, 8, 4, 3, SHELL.H); px(ctx, 1, 9, SHELL.K); px(ctx, 2, 9, SHELL.K);
      dome(ctx, 9, 13, 6, 9, SHELL.E, SHELL.D, SHELL.y);
      rect(ctx, 3, 13, 12, 1, SHELL.D);
      px(ctx, 6, 8, SHELL.h); px(ctx, 10, 6, SHELL.h); px(ctx, 12, 9, SHELL.h);
      rect(ctx, 3, 14, 3, 1, SHELL.F); rect(ctx, 11, 14, 3, 1, SHELL.F);
      rect(ctx, 4, 15, 2, 1, SHELL.D); rect(ctx, 12, 15, 2, 1, SHELL.D);
    });
    newFrame('shell_still', 14, 12, function (ctx) {
      dome(ctx, 7, 10, 6, 8, SHELL.E, SHELL.D, SHELL.y);
      rect(ctx, 1, 10, 12, 1, SHELL.D);
      px(ctx, 5, 5, SHELL.h); px(ctx, 7, 4, SHELL.h); px(ctx, 9, 6, SHELL.h);
      rect(ctx, 3, 11, 3, 1, SHELL.F); rect(ctx, 8, 11, 3, 1, SHELL.F);
    });
    newFrame('shell_slide', 16, 12, function (ctx) {
      bowl(ctx, 8, 1, 7, 7, SHELL.E, SHELL.D, SHELL.y);          // dome tipped along the floor
      rect(ctx, 1, 1, 14, 1, SHELL.D);
      px(ctx, 5, 5, SHELL.h); px(ctx, 8, 4, SHELL.h); px(ctx, 11, 6, SHELL.h);
      rect(ctx, 2, 10, 12, 1, SHELL.D);
      for (let x = 0; x < 16; x += 4) px(ctx, x, 11, SHELL.h);   // scuff trail
    });
    newFrame('shell_flip', 16, 12, function (ctx) {
      bowl(ctx, 8, 0, 7, 9, SHELL.E, SHELL.D, SHELL.y);          // spinning through the air
      px(ctx, 4, 4, SHELL.h); px(ctx, 8, 3, SHELL.h); px(ctx, 12, 5, SHELL.h);
      rect(ctx, 1, 9, 14, 1, SHELL.D);
    });

    // Chompert: leafy snap-trap on a stem; jaws shut in frame 1
    const CHOMP = { P: '#cf4b4b', D: '#7c1f1f', M: '#3d1010', W: '#f7ede4', G: '#43a047', g: '#2e7031', L: '#79cf7c' };
    function chomper(ctx, open) {
      const mouthY = open ? 4 : 6;
      dome(ctx, 8, 5, 7, 6, CHOMP.P, CHOMP.D, CHOMP.W);           // upper jaw
      rect(ctx, 1, 5, 14, 1, CHOMP.D);
      dome(ctx, 8, 12, 6, 5, CHOMP.P, CHOMP.D, null);             // lower jaw (mirrored via bowl)
      bowl(ctx, 8, 7, 6, 5, CHOMP.P, CHOMP.D, null);
      rect(ctx, 1, 11, 14, 1, CHOMP.D);
      if (open) { rect(ctx, 2, 6, 12, 2, CHOMP.M); px(ctx, 3, 5, CHOMP.W); px(ctx, 6, 5, CHOMP.W); px(ctx, 10, 5, CHOMP.W); px(ctx, 4, 8, CHOMP.W); px(ctx, 8, 8, CHOMP.W); px(ctx, 12, 8, CHOMP.W); }
      else { rect(ctx, 1, 6, 14, 1, CHOMP.M); }
      // stem down to the floor with two pairs of leaves
      rect(ctx, 6, 12, 4, 18, CHOMP.G);
      rect(ctx, 10, 12, 1, 18, CHOMP.g);
      for (const ly of [14, 20]) {
        for (let i = 0; i < 4; i++) { rect(ctx, 2 - 0 + i, ly + i, 4 - i, 1, CHOMP.L); rect(ctx, 10 - i, ly + i, 4 - i, 1, CHOMP.L); }
        rect(ctx, 6, ly, 4, 1, CHOMP.g);
      }
      rect(ctx, 5, 29, 6, 1, CHOMP.g);                            // root
    }
    newFrame('chomper1', 16, 30, function (ctx) { chomper(ctx, false); });
    newFrame('chomper2', 16, 30, function (ctx) { chomper(ctx, true); });

    // Floatoo: balloon-headed drifter
    const FLOAT = { E: '#7ec8e3', D: '#2f6480', y: '#d7f1fb', W: '#ffffff', K: '#1f3a4d', B: '#e2c04b', b: '#8f6f16', F: '#37556d' };
    function floatoo(ctx, phase) {
      ellipseBand(ctx, 8, 6, 6.5, 6, FLOAT.E, FLOAT.D, FLOAT.y);   // balloon head
      eyesRow(ctx, 5, [4, 9], 2, FLOAT, 'open');
      rect(ctx, 6, 8, 4, 1, FLOAT.D);
      for (let i = 0; i < 3; i++) { px(ctx, 6, 12 + i, FLOAT.F); px(ctx, 9, 12 + i, FLOAT.F); }   // strings
      rect(ctx, 5, 15, 6, 3, FLOAT.B);                             // basket body
      rect(ctx, 5, 17, 6, 1, FLOAT.b);
      const lift = phase ? 0 : 1;
      rect(ctx, 4, 18 + lift, 3, 1, FLOAT.F);                      // little feet
      rect(ctx, 9, 18 + (phase ? 1 : 0), 3, 1, FLOAT.F);
      rect(ctx, 5, 19, 6, 1, FLOAT.b);
    }
    newFrame('floatoo1', 16, 20, function (ctx) { floatoo(ctx, false); });
    newFrame('floatoo2', 16, 20, function (ctx) { floatoo(ctx, true); });

    // fireballs (Ember power-up) - two spin frames
    function fireball(name, ox, oy) {
      const cv = S.makeCanvas(8, 8);
      const ctx = cv.getContext('2d');
      const ccX = 3.5 + ox, ccY = 3.5 + oy;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const dx = x - ccX, dy = y - ccY, d2 = dx * dx + dy * dy;
          if (d2 > 12.5) continue;
          ctx.fillStyle = d2 < 3 ? '#f5d04e' : (d2 < 8 ? '#e23b3b' : '#8f1f1f');
          ctx.fillRect(x, y, 1, 1);
        }
      }
      map[name] = cv;
    }
    fireball('fireball1', 0, 0);
    fireball('fireball2', -0.4, 0.4);
  }

  // ============ DECOR (parallax props; never collide) ============
  const DEC = {
    day: { g: '#43a047', gd: '#2e7031', gl: '#7ac97d', c: '#f7f9fc', cd: '#c8d2de', cl: '#ffffff' },
    cave: { g: '#3c3666', gd: '#2b2557', gl: '#5f5896', c: '#4a4478', cd: '#37315f', cl: '#645d9c' },
    dusk: { g: '#7c2446', gd: '#5f1832', gl: '#a8456b', c: '#f4c0d2', cd: '#c98fa4', cl: '#ffe3ec' }
  };
  function buildDecor(theme) {
    const pal = DEC[theme] || DEC.day;

    newFrame('hill_big', 48, 24, function (ctx) {
      dome(ctx, 23, 23, 22, 23, pal.g, pal.gd, pal.gl);
      px(ctx, 15, 14, pal.gl); px(ctx, 16, 13, pal.gl); px(ctx, 17, 12, pal.gl);
    });
    newFrame('hill_small', 32, 16, function (ctx) {
      dome(ctx, 15, 15, 14, 15, pal.g, pal.gd, pal.gl);
      px(ctx, 10, 9, pal.gl); px(ctx, 11, 8, pal.gl);
    });
    newFrame('bush', 48, 16, function (ctx) {
      dome(ctx, 10, 15, 9, 13, pal.g, pal.gd, pal.gl);
      dome(ctx, 24, 15, 13, 15, pal.g, pal.gd, pal.gl);
      dome(ctx, 38, 15, 9, 13, pal.g, pal.gd, pal.gl);
      px(ctx, 6, 4, pal.gl); px(ctx, 23, 2, pal.gl); px(ctx, 24, 1, pal.gl); px(ctx, 41, 4, pal.gl);
      px(ctx, 18, 13, pal.gd); px(ctx, 30, 13, pal.gd);
    });
    newFrame('cloud1', 32, 16, function (ctx) {
      dome(ctx, 9, 10, 8, 9, pal.c, pal.cd, pal.cl);
      dome(ctx, 21, 11, 9, 10, pal.c, pal.cd, pal.cl);
      rect(ctx, 2, 10, 29, 4, pal.c);
      rect(ctx, 3, 14, 25, 1, pal.cd);
    });
    newFrame('cloud2', 24, 12, function (ctx) {
      dome(ctx, 8, 8, 7, 8, pal.c, pal.cd, pal.cl);
      dome(ctx, 17, 9, 6, 7, pal.c, pal.cd, pal.cl);
      rect(ctx, 1, 8, 22, 3, pal.c);
      rect(ctx, 2, 11, 20, 1, pal.cd);
    });
  }

  // ============ GINGERBREAD KEEP (level art + goal house) ============
  function buildKeep() {
    const cv = S.makeCanvas(64, 64);
    const ctx = cv.getContext('2d');
    const GINGER = '#a05c2b', DARK = '#7c421c', ICING = '#f7ede4', DOOR = '#2b1c12';
    function rct(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
    rct(4, 12, 56, 52, GINGER);
    rct(56, 12, 4, 52, DARK);                      // self-shadow
    rct(4, 60, 56, 4, DARK);
    for (const x of [4, 12, 20, 28, 36, 44, 52]) { rct(x, 8, 6, 8, GINGER); rct(x, 8, 6, 1, DARK); }
    rct(24, 4, 16, 10, GINGER);
    rct(38, 4, 2, 10, DARK);
    for (const x of [24, 30, 36]) { rct(x, 0, 4, 4, GINGER); rct(x, 0, 4, 1, DARK); }
    rct(4, 12, 56, 2, ICING); rct(4, 28, 56, 2, ICING); rct(4, 44, 56, 2, ICING);
    rct(24, 10, 16, 2, ICING);
    rct(14, 16, 6, 8, DOOR); rct(44, 16, 6, 8, DOOR);              // icing windows
    rct(14, 16, 6, 1, ICING); rct(44, 16, 6, 1, ICING);
    rct(14, 32, 4, 6, DOOR); rct(46, 32, 4, 6, DOOR);
    rct(28, 42, 8, 22, DOOR);                                      // candy door
    rct(27, 40, 10, 2, ICING); rct(27, 42, 1, 22, ICING); rct(36, 42, 1, 22, ICING);
    const rng = BROS.U.mulberry32(42);
    const candy = ['#f5d04e', '#41b0dd', '#8ad24b', '#e23b3b', '#f7ede4'];
    for (let i = 0; i < 110; i++) {
      const x = 8 + Math.floor(rng() * 48);
      const y = 16 + Math.floor(rng() * 40);
      if (x >= 26 && x <= 38 && y >= 40) continue;
      ctx.fillStyle = candy[Math.floor(rng() * candy.length)];
      ctx.fillRect(x, y, 1, 1);
    }
    map['keep'] = cv;
  }

  // ============ ensure / get / has ============
  const INVENTORY = [
    'p_small_idle_gum', 'p_small_walk1_gum', 'p_small_walk2_gum', 'p_small_jump_gum',
    'p_small_skid_gum', 'p_small_dead_gum', 'p_small_victory_gum', 'p_small_crouch_gum',
    'p_small_idle_flame', 'p_small_walk1_flame', 'p_small_jump_flame', 'p_small_crouch_flame',
    'p_big_idle_gum', 'p_big_walk1_gum', 'p_big_walk2_gum', 'p_big_jump_gum', 'p_big_skid_gum',
    'p_big_dead_gum', 'p_big_victory_gum', 'p_big_crouch_gum', 'p_big_crouch_flame',
    'tile_ground_1', 'tile_ground_2', 'tile_ground_3', 'tile_ground_4',
    'tile_ground_bare1', 'tile_ground_bare4',
    'tile_brick', 'tile_q0', 'tile_q1', 'tile_q2', 'tile_used', 'tile_stone',
    'tile_trampoline', 'tile_spike',
    'pipe_tl', 'pipe_tr', 'pipe_bl', 'pipe_br', 'pipe_l', 'pipe_r',
    'pole_segment', 'pole_ball', 'pole_ball2', 'flag', 'keep',
    'bonbon0', 'bonbon1', 'bonbon2', 'bonbon3',
    'jelly', 'ember', 'toffee', 'bubble_item', 'fireball1', 'fireball2',
    'debris1', 'debris2',
    'pudge1', 'pudge2', 'pudge_flat', 'shell_walk1', 'shell_walk2', 'shell_still',
    'shell_slide', 'shell_flip', 'hopper1', 'hopper2', 'hopper_flat',
    'floatoo1', 'floatoo2', 'chomper1', 'chomper2',
    'hill_big', 'hill_small', 'bush', 'cloud1', 'cloud2'
  ];

  let builtOnce = false;
  S.ensure = function (theme) {
    theme = theme || 'day';
    if (!builtOnce) {
      S.buildPlayer();
      try { buildItems(); } catch (e) { console.warn('sprites items: ' + e.message); }
      try { buildEnemies(); } catch (e) { console.warn('sprites enemies: ' + e.message); }
      try { buildFx(); } catch (e) { console.warn('sprites fx: ' + e.message); }
      try { buildKeep(); } catch (e) { console.warn('sprites keep: ' + e.message); }
      builtOnce = true;
    }
    S.buildTiles(theme);
    try { buildDecor(theme); } catch (e) { console.warn('sprites decor: ' + e.message); }
    for (const name of INVENTORY) if (!map[name]) console.warn('MISSING SPRITE: ' + name);
  };
  S.get = function (name) {
    if (!map[name]) {
      console.error('Sprites.get: missing sprite "' + name + '"');
      const cv = S.makeCanvas(16, 16);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#000000'; ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(5, 5, 6, 2);
      map[name] = cv;
    }
    return map[name];
  };
  S.has = function (name) { return !!map[name]; };
})();
