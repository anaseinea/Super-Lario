/* ============================================================================
 * 09-tiles.js — tile legend, level parser, tile mutation rules
 * (docs/plan/08-tiles-and-level-format.md)
 *
 * DOM free and Node testable: everything here is data plus arithmetic.  The
 * grid is a flat Uint8Array of tile ids with a parallel Int16Array of aux data
 * (pipe half index / block parity).  Gameplay modules never see map letters,
 * they use solidAt / tileAt / landTypeAt, so the ASCII legend lives in one file.
 *
 * Bounds convention (used by physics): columns outside the map are walls, rows
 * above the map are open sky and rows below it are open pits.
 * ==========================================================================*/
(function () {
  'use strict';

  const BROS = window.BROS;
  const C = BROS.C;
  const T = C.TILE;

  /* ------------------------------------------------------------------ *
   * tile ids and their behaviour flags
   * ------------------------------------------------------------------ */
  const EMPTY = 0, GROUND = 1, BRICK = 2, STONE = 3,
    Q_BONBON = 4, Q_JELLY = 5, Q_EMBER = 6, Q_TOFFEE = 7, Q_BUBBLE = 8,
    TRAMP = 9, SPIKE = 10, PIPE = 11, USED = 12, POLE = 13, KEEP = 14;

  const table = [];
  function def(id, o) {
    table[id] = {
      id: id,
      name: o.name,
      solid: !!o.solid,
      breakable: !!o.breakable,
      bumpable: o.bumpable === undefined ? !!o.solid : !!o.bumpable,
      qitem: o.qitem || null,
      trampoline: !!o.trampoline,
      spike: !!o.spike,
      collect: !!o.collect,
      pole: !!o.pole,
      keep: !!o.keep,
      pipe: !!o.pipe,
      deco: !!o.deco
    };
  }

  def(EMPTY, { name: 'empty' });
  def(GROUND, { name: 'ground', solid: true });
  def(BRICK, { name: 'brick', solid: true, breakable: true });
  def(STONE, { name: 'stone', solid: true });                  // hard candy: never breaks
  def(Q_BONBON, { name: 'q_bonbon', solid: true, qitem: 'bonbon' });
  def(Q_JELLY, { name: 'q_jelly', solid: true, qitem: 'jelly' });
  def(Q_EMBER, { name: 'q_ember', solid: true, qitem: 'ember' });
  def(Q_TOFFEE, { name: 'q_toffee', solid: true, qitem: 'toffee' });
  def(Q_BUBBLE, { name: 'q_bubble', solid: true, qitem: 'bubble' });
  def(TRAMP, { name: 'trampoline', solid: true, trampoline: true });
  def(SPIKE, { name: 'spike', spike: true });                  // damage zone, not solid
  def(PIPE, { name: 'pipe', solid: true, pipe: true });
  def(USED, { name: 'used', solid: true });
  def(POLE, { name: 'pole', pole: true });                     // non-solid finale column
  def(KEEP, { name: 'keep', keep: true });                     // non-solid finale target

  function isQ(id) { return id >= Q_BONBON && id <= Q_BUBBLE; }

  /* ------------------------------------------------------------------ *
   * the level legend
   * ------------------------------------------------------------------ */
  const LETTERS = {
    '.': EMPTY,
    'G': GROUND, 'B': BRICK, 'X': STONE, 'U': USED,
    '?': Q_BONBON, 'J': Q_JELLY, 'E': Q_EMBER, 'R': Q_TOFFEE, 'O': Q_BUBBLE,
    'C': TRAMP, 's': SPIKE, 'p': PIPE,
    'I': POLE, 'K': KEEP,
    'g': 'pudge', 'q': 'shell', 'h': 'hopper', 'f': 'floatoo', 'r': 'chomper',
    'o': 'bonbon'
  };
  const SPAWN_LETTERS = { 'g': 'pudge', 'q': 'shell', 'h': 'hopper', 'f': 'floatoo', 'r': 'chomper' };
  const Q_LETTERS = { '?': Q_BONBON, 'J': Q_JELLY, 'E': Q_EMBER, 'R': Q_TOFFEE, 'O': Q_BUBBLE };
  const Q_IDS = [Q_BONBON, Q_JELLY, Q_EMBER, Q_TOFFEE, Q_BUBBLE];

  /* ------------------------------------------------------------------ *
   * sprite-name selection (keeps id -> artwork mapping in one place)
   * ------------------------------------------------------------------ */
  /** Deterministic spread so a long run of ground tiles never looks striped. */
  function variantFor(col, row) {
    let h = Math.imul(col | 0, 374761393) ^ Math.imul(row | 0, 668265263);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) % 4;
  }
  /** Surface rows get the top-lit variants, buried rows the plain ones. */
  function groundSprite(col, row, isSurface) {
    const v = variantFor(col, row) + 1;
    return isSurface ? 'tile_ground_' + v : 'tile_ground_bare' + v;
  }
  function qSprite(frame) { return 'tile_q' + (frame % 3); }

  /** Which of the six pipe canvases draws this cell.  half: 0 left, 1 right. */
  function pipeSprite(hgt, rowIndexFromTop, half) {
    const side = half ? 'r' : 'l';
    if (rowIndexFromTop === 0) return 'pipe_t' + side;
    if (rowIndexFromTop === hgt - 1) return 'pipe_b' + side;
    return 'pipe_' + side;
  }

  /* ------------------------------------------------------------------ *
   * runtime tile mutation
   * ------------------------------------------------------------------ */
  /**
   * Resolve a head bump on a tile: returns
   *   {result:'none'|'bump'|'break'|'q', id, newId, qitem}
   * and mutates the grid for break/q.  Bounce handling stays in the player.
   */
  function hitTile(level, col, row) {
    const id = level.tileAt(col, row);
    const t = table[id];
    if (!t || !t.bumpable) return { result: 'none', id: id, newId: id };
    if (t.breakable) {
      level.setTileAt(col, row, EMPTY);
      return { result: 'break', id: id, newId: EMPTY, qitem: null };
    }
    if (isQ(id)) {
      level.setTileAt(col, row, USED);
      return { result: 'q', id: id, newId: USED, qitem: t.qitem };
    }
    return { result: 'bump', id: id, newId: id, qitem: null };
  }

  function clearTile(level, col, row) { level.setTileAt(col, row, EMPTY); }

  /* ------------------------------------------------------------------ *
   * parseLevel
   * ------------------------------------------------------------------ */
  /**
   * def = {name, theme:'day'|'cave'|'dusk', map:[equal-length strings],
   *        startCol, time}
   * Any structural problem throws: a bad map must never reach the game.
   */
  function parseLevel(def) {
    if (!def || !Array.isArray(def.map) || def.map.length < 3) throw new Error('parseLevel: map rows missing');
    const name = def.name || 'unnamed level';
    const rows = def.map.length;
    const cols = def.map[0].length;
    if (cols < 16) throw new Error('parseLevel(' + name + '): level is only ' + cols + ' cells wide');
    const grid = new Uint8Array(cols * rows);
    const aux = new Int16Array(cols * rows);
    for (let i = 0; i < aux.length; i++) aux[i] = -1;
    const idx = function (c, r) { return r * cols + c; };
    const letter = function (c, r) { return def.map[r].charAt(c); };

    /* pass 1: letters -> ids, uniform rows, legal characters */
    for (let r = 0; r < rows; r++) {
      const rowStr = def.map[r];
      if (typeof rowStr !== 'string') throw new Error('parseLevel(' + name + '): row ' + r + ' is not a string');
      if (rowStr.length !== cols) {
        throw new Error('parseLevel(' + name + '): row ' + r + ' is ' + rowStr.length +
          ' cells wide, every row must be ' + cols + ' (rows must be equal length)');
      }
      for (let c = 0; c < cols; c++) {
        const ch = rowStr.charAt(c);
        const v = LETTERS[ch];
        if (v === undefined) {
          throw new Error('parseLevel(' + name + '): unknown legend letter "' + ch + '" at col ' + c + ' row ' + r);
        }
        grid[idx(c, r)] = typeof v === 'number' ? v : EMPTY;
      }
    }

    const level = {
      name: name,
      theme: def.theme || 'day',
      cols: cols, rows: rows,
      startCol: def.startCol == null ? 2 : def.startCol,
      time: def.time == null ? C.LEVEL_TIME : def.time,
      tiles: grid, aux: aux,
      pipes: [], plants: [], spawns: [], bonbons: [], keepBlocks: [],
      poleCol: -1, poleTopRow: -1, poleBottomRow: -1,
      keepCol: -1, keepTopRow: -1, keepTargetX: -1,
      levelPx: cols * T
    };

    level.tileAt = function (c, r) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return EMPTY;
      return grid[idx(c, r)];
    };
    level.setTileAt = function (c, r, id) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      grid[idx(c, r)] = id;
    };
    level.auxAt = function (c, r) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return -1;
      return aux[idx(c, r)];
    };
    level.solidAt = function (c, r) {
      if (c < 0 || c >= cols) return true;                  // the level itself walls you in
      if (r < 0 || r >= rows) return false;                 // open sky, open pits
      return table[grid[idx(c, r)]].solid;
    };
    level.landTypeAt = function (c, r) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return null;
      return table[grid[idx(c, r)]].trampoline ? 'tramp' : null;
    };

    /* pass 2: spawns and collectibles leave the grid */
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = letter(c, r);
        if (SPAWN_LETTERS[ch]) {
          level.spawns.push({ kind: SPAWN_LETTERS[ch], col: c, row: r });
          grid[idx(c, r)] = EMPTY;
        } else if (ch === 'o') {
          level.bonbons.push({ col: c, row: r });
          grid[idx(c, r)] = EMPTY;
        }
      }
    }

    /* pass 3: pipes — vertical runs of 'p' paired across two adjacent columns */
    function runOf(c, r) {
      let top = r;
      while (top - 1 >= 0 && grid[idx(c, top - 1)] === PIPE) top--;
      let bottom = r;
      while (bottom + 1 < rows && grid[idx(c, bottom + 1)] === PIPE) bottom++;
      return { top: top, bottom: bottom, hgt: bottom - top + 1 };
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (grid[idx(c, r)] !== PIPE || aux[idx(c, r)] !== -1) continue;
        const run = runOf(c, r);
        let left = c;
        const pairOf = function (cc) {
          if (cc < 0 || cc >= cols) return null;
          if (grid[idx(cc, run.top)] !== PIPE) return null;
          const other = runOf(cc, run.top);
          if (other.top !== run.top || other.bottom !== run.bottom) {
            throw new Error('parseLevel(' + name + '): unpaired pipe at col ' + c + ' row ' + run.top +
              ' (the neighbouring column spans rows ' + other.top + '-' + other.bottom + ')');
          }
          return other;
        };
        if (pairOf(c + 1)) left = c;
        else if (pairOf(c - 1)) left = c - 1;
        else throw new Error('parseLevel(' + name + '): pipe column at col ' + c + ' row ' + run.top + ' has no twin');
        if (left !== c && aux[idx(left, run.top)] !== -1) continue;         // already claimed from the other side
        if (grid[idx(left + 2, run.top)] === PIPE) {
          throw new Error('parseLevel(' + name + '): pipe at col ' + left + ' row ' + run.top +
            ' is more than two columns wide');
        }
        if (run.hgt < 2) {
          throw new Error('parseLevel(' + name + '): pipe at col ' + left + ' is only ' + run.hgt + ' cell tall (minimum 2)');
        }
        const restRow = run.bottom + 1;
        if (restRow >= rows || !table[grid[idx(left, restRow)]].solid || !table[grid[idx(left + 1, restRow)]].solid) {
          throw new Error('parseLevel(' + name + '): pipe at col ' + left + ' row ' + run.top +
            ' does not rest on solid ground');
        }
        level.pipes.push({ col: left, row: run.top, hgt: run.hgt, bottomRow: run.bottom, mouthRow: restRow });
        for (let i = 0; i < run.hgt; i++) {
          aux[idx(left, run.top + i)] = 0;
          aux[idx(left + 1, run.top + i)] = 1;
        }
        r = run.bottom;
      }
    }
    level.pipes.sort(function (a, b) { return a.col - b.col; });

    /* pass 4: Chompers must sit directly on top of a pipe mouth */
    for (const s of level.spawns) {
      if (s.kind !== 'chomper') continue;
      let host = null;
      for (const p of level.pipes) {
        if (s.row + 1 === p.row && s.col >= p.col && s.col <= p.col + 1) host = p;
      }
      if (!host) {
        throw new Error('parseLevel(' + name + '): chomper at col ' + s.col + ' row ' + s.row +
          ' is not directly above a pipe mouth');
      }
      host.chomper = s;
      level.plants.push({ col: s.col, row: s.row, pipe: host });
    }

    /* pass 5: the candy-cane flagpole, one contiguous column of 'I' */
    const poleCols = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) if (grid[idx(c, r)] === POLE) { poleCols.push(c); break; }
    }
    if (poleCols.length > 1) {
      throw new Error('parseLevel(' + name + '): ' + poleCols.length + ' flagpole columns (col ' +
        poleCols.join(', ') + '), a level has exactly one');
    }
    if (poleCols.length === 0) throw new Error('parseLevel(' + name + '): no flagpole (letter I) in the map');
    {
      const c = poleCols[0];
      let top = -1, bottom = -1, count = 0;
      for (let r = 0; r < rows; r++) {
        if (grid[idx(c, r)] === POLE) {
          if (top < 0) top = r;
          bottom = r;
          count++;
        }
      }
      if (count !== bottom - top + 1) {
        throw new Error('parseLevel(' + name + '): flagpole column ' + c + ' has a gap (rows ' + top + '-' + bottom + ')');
      }
      const baseRow = bottom + 1;
      if (baseRow >= rows || !table[grid[idx(c, baseRow)]].solid) {
        throw new Error('parseLevel(' + name + '): flagpole at col ' + c + ' has no ground under its base');
      }
      level.poleCol = c;
      level.poleTopRow = top;
      level.poleBottomRow = bottom;
      for (let r = top; r <= bottom; r++) grid[idx(c, r)] = EMPTY;      // non-solid so the slide works
    }

    /* pass 6: Gingerbread Keep blocks, clean 4x4 footprints cleared from the grid */
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (grid[idx(c, r)] !== KEEP || aux[idx(c, r)] !== -1) continue;
        let w = 0;
        while (c + w < cols && grid[idx(c + w, r)] === KEEP) w++;
        let h = -1, square = w === 4;
        for (let cc = c; cc < c + w && square; cc++) {
          let hh = 0;
          while (r + hh < rows && grid[idx(cc, r + hh)] === KEEP) hh++;
          if (h < 0) h = hh;
          if (hh !== h) square = false;
        }
        if (!square || h !== 4) {
          throw new Error('parseLevel(' + name + '): Keep block at col ' + c + ' row ' + r +
            ' is ' + w + 'x' + h + ', it must be a clean 4x4');
        }
        const footRow = r + 4;
        if (footRow >= rows || !table[grid[idx(c + 1, footRow)]].solid) {
          throw new Error('parseLevel(' + name + '): Keep at col ' + c + ' row ' + r + ' is not standing on ground');
        }
        for (let cc = c; cc < c + 4; cc++) {
          for (let rr = r; rr < r + 4; rr++) { aux[idx(cc, rr)] = 0; grid[idx(cc, rr)] = EMPTY; }
        }
        level.keepBlocks.push({ col: c, row: r, w: 4, h: 4 });
      }
    }
    if (level.keepBlocks.length > 1) {
      throw new Error('parseLevel(' + name + '): ' + level.keepBlocks.length + ' Keep blocks, a level has exactly one');
    }
    if (level.keepBlocks.length === 1) {
      const b = level.keepBlocks[0];
      level.keepCol = b.col;
      level.keepTopRow = b.row;
      level.keepTargetX = b.col * T;         // the player walks here after the flagpole
      if (b.col <= level.poleCol) {
        throw new Error('parseLevel(' + name + '): Keep at col ' + b.col + ' must be right of the flagpole (col ' + level.poleCol + ')');
      }
    }

    /* start spot: the surface of the ground column under startCol (lowest solid
       run, lifted to its top), so floating blocks above the spawn cannot trap
       the player on top of them */
    let bottom = -1;
    for (let r = rows - 1; r >= 0; r--) {
      if (table[level.tileAt(level.startCol, r)].solid) { bottom = r; break; }
    }
    if (bottom < 0) throw new Error('parseLevel(' + name + '): no ground under startCol ' + level.startCol);
    let startRow = bottom;
    while (startRow - 1 >= 0 && table[level.tileAt(level.startCol, startRow - 1)].solid) startRow--;
    level.startRow = startRow;
    level.startX = level.startCol * T;
    level.startY = startRow * T;            // feet line; the player module lifts by its own height

    /** Cleared grid as ASCII, for tools/validate-levels.mjs and debugging. */
    level.debugGrid = function () {
      const glyph = [];
      glyph[EMPTY] = '.'; glyph[GROUND] = 'G'; glyph[BRICK] = 'B'; glyph[STONE] = 'X';
      glyph[USED] = 'U'; glyph[TRAMP] = 'C'; glyph[SPIKE] = 's'; glyph[PIPE] = 'p';
      glyph[POLE] = 'I'; glyph[KEEP] = 'K';
      let out = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = grid[idx(c, r)];
          out += glyph[id] !== undefined ? glyph[id] : (isQ(id) ? '?' : '#');
        }
        out += '\n';
      }
      return out;
    };
    return level;
  }

  BROS.Tiles = {
    EMPTY: EMPTY, GROUND: GROUND, BRICK: BRICK, STONE: STONE,
    Q_BONBON: Q_BONBON, Q_JELLY: Q_JELLY, Q_EMBER: Q_EMBER, Q_TOFFEE: Q_TOFFEE,
    Q_BUBBLE: Q_BUBBLE, TRAMP: TRAMP, SPIKE: SPIKE, PIPE: PIPE, USED: USED,
    POLE: POLE, KEEP: KEEP, Q_IDS: Q_IDS,
    table: table,
    /** id lookup by name, so gameplay code can write Tiles.ids.GROUND etc. */
    ids: {
      EMPTY: EMPTY, GROUND: GROUND, BRICK: BRICK, STONE: STONE,
      Q_BONBON: Q_BONBON, Q_JELLY: Q_JELLY, Q_EMBER: Q_EMBER, Q_TOFFEE: Q_TOFFEE,
      Q_BUBBLE: Q_BUBBLE, TRAMP: TRAMP, SPIKE: SPIKE, PIPE: PIPE, USED: USED,
      POLE: POLE, KEEP: KEEP
    },
    letters: LETTERS,
    spawnLetters: SPAWN_LETTERS,
    qLetters: Q_LETTERS,
    isQ: isQ,
    hitTile: hitTile,
    clearTile: clearTile,
    groundSprite: groundSprite,
    variantFor: variantFor,
    qSprite: qSprite,
    pipeSprite: pipeSprite,
    parseLevel: parseLevel,
    selfTest: selfTest
  };
  BROS.parseLevel = parseLevel;

  /* ------------------------------------------------------------------ *
   * self test — the sample map is the legend's worked example
   * ------------------------------------------------------------------ */
  /* columns:            012345678901234567
   *                     ..................  0
   *                     .........o........  1  bonbon at col 9
   *                     ..................  2
   *                     .........o........  3  (collectible lives in row 3)
   *                     .....B?X..........  4  brick / Q / hard candy row
   *                     .......r..........  5  chomper riding the pipe mouth
   *                     .......pp.........  6  pipe top
   *                     .......pp....IKKKK  7  pole col 13, Keep cols 14-17
   *                     .......pp....IKKKK  8
   *                     .......pp....IKKKK  9
   *                     g....qqppChssIKKKK  10 spawn row: Pudge, 2 Tinshells, pipe,
   *                                         trampoline, Hopper, spikes, pole, Keep
   *                     GGGGGGGGGGGGGGGGGG  11 ground surface
   *                     GGGGGGGGGGGGGGGGGG  12 ground */
  const SAMPLE = [
    '..................',
    '..................',
    '..................',
    '.........o........',
    '.....B?X..........',
    '.......r..........',
    '.......pp.........',
    '.......pp....IKKKK',
    '.......pp....IKKKK',
    '.......pp....IKKKK',
    'g....qqppChssIKKKK',
    'GGGGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGGGG'
  ];

  function selfTest() {
    const fails = [];
    function ok(cond, msg) { if (!cond) fails.push(msg); }
    function expectThrow(fn, want, label) {
      try { fn(); fails.push(label + ': expected a parse error, got none'); }
      catch (e) {
        if (want && String(e.message).indexOf(want) < 0) fails.push(label + ': wrong message "' + e.message + '"');
      }
    }
    function mutate(rows, row, col, ch) {
      const out = rows.slice();
      const r = out[row];
      out[row] = r.slice(0, col) + ch + r.slice(col + 1);
      return out;
    }
    function parse(map) { return parseLevel({ name: 'test', theme: 'day', map: map, startCol: 1, time: 300 }); }

    let lv = null;
    try { lv = parse(SAMPLE); } catch (e) { fails.push('sample map did not parse: ' + e.message); return fails; }

    ok(lv.cols === 18 && lv.rows === 13, 'wrong dimensions ' + lv.cols + 'x' + lv.rows);
    ok(lv.levelPx === 18 * T, 'levelPx wrong');

    /* pipes */
    ok(lv.pipes.length === 1, 'expected exactly one pipe, got ' + lv.pipes.length);
    const p = lv.pipes[0];
    ok(p && p.col === 7 && p.row === 6 && p.hgt === 5 && p.mouthRow === 11, 'pipe geometry wrong: ' + JSON.stringify(p));
    ok(lv.auxAt(7, 6) === 0 && lv.auxAt(8, 6) === 1, 'pipe half parity wrong');
    ok(lv.auxAt(7, 10) === 0 && lv.auxAt(8, 10) === 1, 'pipe half parity wrong at the base');
    ok(lv.solidAt(7, 6) && lv.solidAt(8, 10), 'pipe cells are not solid');
    ok(lv.tileAt(7, 6) === PIPE, 'pipe id wrong');

    /* chomper anchor */
    ok(lv.plants.length === 1 && lv.plants[0].col === 7 && lv.plants[0].row === 5, 'chomper anchor wrong: ' + JSON.stringify(lv.plants));
    ok(lv.plants[0].pipe === p, 'chomper is not linked to its pipe');

    /* spawns: recorded, and their cells are cleared so nothing is solid there */
    const kinds = lv.spawns.map(function (s) { return s.kind + s.col + ',' + s.row; }).sort().join(' ');
    ok(lv.spawns.length === 5, 'expected 5 spawns, got ' + lv.spawns.length + ': ' + kinds);
    ok(kinds === 'chomper7,5 hopper10,10 pudge0,10 shell5,10 shell6,10', 'spawn set wrong: ' + kinds);
    ok(!lv.solidAt(0, 10) && !lv.solidAt(5, 10) && !lv.solidAt(6, 10) && !lv.solidAt(10, 10), 'spawn cells must not be solid');
    ok(lv.solidAt(0, 11) && lv.solidAt(5, 11), 'spawn row should sit on ground so enemies do not fall');

    /* collectibles */
    ok(lv.bonbons.length === 1 && lv.bonbons[0].col === 9 && lv.bonbons[0].row === 3, 'bonbon record wrong');
    ok(lv.tileAt(9, 3) === EMPTY && !lv.solidAt(9, 3), 'bonbon cell was not cleared');

    /* legend behaviour flags */
    ok(lv.tileAt(5, 4) === BRICK && lv.solidAt(5, 4), 'brick wrong');
    ok(lv.tileAt(6, 4) === Q_BONBON, 'Q block id wrong');
    ok(lv.tileAt(7, 4) === STONE && lv.solidAt(7, 4), 'hard candy wrong');
    ok(lv.tileAt(9, 10) === TRAMP && lv.solidAt(9, 10) && lv.landTypeAt(9, 10) === 'tramp', 'trampoline wrong');
    ok(lv.landTypeAt(5, 11) === null, 'ground should not report a landing type');
    ok(lv.tileAt(11, 10) === SPIKE && !lv.solidAt(11, 10), 'spikes must stay non-solid');
    ok(lv.solidAt(-1, 5) && lv.solidAt(lv.cols, 5), 'map columns should act as walls');
    ok(!lv.solidAt(5, -1) && !lv.solidAt(5, lv.rows), 'sky and pits should stay open');
    ok(lv.tileAt(0, 0) === EMPTY && !lv.solidAt(0, 0), 'empty cells wrong');

    /* finale records */
    ok(lv.poleCol === 13 && lv.poleTopRow === 7 && lv.poleBottomRow === 10, 'pole records wrong: ' +
      lv.poleCol + '/' + lv.poleTopRow + '/' + lv.poleBottomRow);
    ok(!lv.solidAt(13, 8) && !lv.solidAt(13, 10), 'pole cells must be non-solid so the player can slide');
    ok(lv.solidAt(13, 11), 'the pole base needs solid ground');
    ok(lv.keepCol === 14 && lv.keepTopRow === 7, 'keep records wrong: ' + lv.keepCol + '/' + lv.keepTopRow);
    ok(lv.keepTargetX === 14 * T, 'keepTargetX wrong: ' + lv.keepTargetX);
    ok(!lv.solidAt(14, 7) && !lv.solidAt(17, 10), 'keep cells must be non-solid');
    ok(lv.keepBlocks[0].w === 4 && lv.keepBlocks[0].h === 4, 'keep footprint wrong');

    /* start spot */
    ok(lv.startRow === 11 && lv.startX === T && lv.startY === 11 * T, 'start spot wrong: ' +
      lv.startRow + '/' + lv.startX + '/' + lv.startY);

    /* mutation rules */
    ok(BROS.Tiles.hitTile(lv, 5, 4).result === 'break' && lv.tileAt(5, 4) === EMPTY, 'brick should break into nothing');
    const qr = BROS.Tiles.hitTile(lv, 6, 4);
    ok(qr.result === 'q' && qr.qitem === 'bonbon' && lv.tileAt(6, 4) === USED, 'Q block should become a used block');
    ok(BROS.Tiles.hitTile(lv, 7, 4).result === 'bump' && lv.tileAt(7, 4) === STONE, 'hard candy should only bump');
    ok(BROS.Tiles.hitTile(lv, 9, 10).result === 'bump', 'trampoline should bump, never break');
    ok(BROS.Tiles.hitTile(lv, 11, 10).result === 'none', 'spikes are not bumpable');
    ok(BROS.Tiles.hitTile(lv, 13, 11).result === 'bump', 'ground should bump');
    BROS.Tiles.clearTile(lv, 11, 10);
    ok(lv.tileAt(11, 10) === EMPTY, 'clearTile did not clear');

    /* sprite-name selection */
    ok(BROS.Tiles.pipeSprite(5, 0, 0) === 'pipe_tl' && BROS.Tiles.pipeSprite(5, 0, 1) === 'pipe_tr', 'pipe cap names wrong');
    ok(BROS.Tiles.pipeSprite(5, 4, 0) === 'pipe_bl' && BROS.Tiles.pipeSprite(5, 4, 1) === 'pipe_br', 'pipe base names wrong');
    ok(BROS.Tiles.pipeSprite(5, 1, 0) === 'pipe_l' && BROS.Tiles.pipeSprite(5, 3, 1) === 'pipe_r', 'pipe body names wrong');
    const names = {};
    for (let c = 0; c < 16; c++) names[BROS.Tiles.groundSprite(c, 11, true)] = (names[BROS.Tiles.groundSprite(c, 11, true)] || 0) + 1;
    ok(Object.keys(names).length === 4, 'ground variants should all appear across a 16 wide run, saw ' + Object.keys(names).join(','));
    const variants = [];
    for (let c = 0; c < 16; c++) variants.push(BROS.Tiles.variantFor(c, 11));
    ok(variants.join(',') !== new Array(16).fill(variants[0]).join(','), 'variants must not be constant along a run');
    ok(BROS.Tiles.variantFor(4, 11) === BROS.Tiles.variantFor(4, 11), 'variantFor must be deterministic');
    ok(BROS.Tiles.groundSprite(3, 12, false).indexOf('bare') > 0, 'buried ground should use the bare variants');
    ok(BROS.Tiles.qSprite(0) === 'tile_q0' && BROS.Tiles.qSprite(3) === 'tile_q0' && BROS.Tiles.qSprite(4) === 'tile_q1', 'Q frame names wrong');

    /* malformed maps must fail loudly */
    expectThrow(function () { parse(SAMPLE.slice(0, 2)); }, 'rows', 'too few rows');
    expectThrow(function () { parse(['GGGGGGGG', 'GGGGGGGG', 'II.GGGGG']); }, 'wide', 'level too narrow');
    expectThrow(function () { const m = SAMPLE.slice(); m[7] = m[7].slice(0, 17); parse(m); }, 'equal length', 'ragged rows');
    expectThrow(function () { parse(mutate(SAMPLE, 2, 4, '3')); }, 'unknown legend', 'illegal letter');
    expectThrow(function () {
      parse(SAMPLE.map(function (row) { return row.slice(0, 13) + '.' + row.slice(14); }));
    }, 'no flagpole', 'missing pole');
    expectThrow(function () { parse(mutate(mutate(SAMPLE, 8, 8, '.'), 9, 8, '.')); }, 'pipe', 'unpaired pipe');
    expectThrow(function () { parse(mutate(SAMPLE, 5, 5, 'r')); }, 'chomper', 'chomper off its pipe');
    expectThrow(function () { parse(mutate(SAMPLE, 7, 11, 'I')); }, 'flagpole columns', 'two poles');
    expectThrow(function () { parse(mutate(SAMPLE, 9, 13, '.')); }, 'gap', 'pole with a gap');
    expectThrow(function () {
      parse(SAMPLE.map(function (row, i) {
        if (i >= 6 && i <= 9) return row.slice(0, 14) + 'KKKK';
        if (i === 10) return 'g....qqppChssI....';      // Keep lifted one row, off its footing
        return row;
      }));
    }, 'standing on ground', 'keep floating off the ground');
    expectThrow(function () { parse(mutate(mutate(SAMPLE, 7, 16, '.'), 7, 17, '.')); }, '4x4', 'broken keep');
    expectThrow(function () {
      parse(SAMPLE.map(function (row, i) {
        if (i < 7 || i > 10) return row;
        return '..KKKK' + row.slice(6, 14) + '....';            // Keep moved left of the pole
      }));
    }, 'right of the flagpole', 'keep on the wrong side of the pole');
    expectThrow(function () {
      parse(SAMPLE.map(function (row, i) { return i >= 11 ? row.slice(0, 1) + '.' + row.slice(2) : row; }));
    }, 'startCol', 'start spot over a pit');
    expectThrow(function () {
      parse(SAMPLE.map(function (row, i) { return i === 10 ? row.slice(0, 9) + 'ppp' + row.slice(12) : row; }));
    }, 'columns wide', 'three column pipe');

    /* a trampoline straddling a pit parses: landing type must survive the fall */
    {
      const m = [
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '...............I..',
        '...............I..',
        '...............I..',
        '..........CC...I..',
        'GGGGGGGGGG..GGGGGG',
        'GGGGGGGGGG..GGGGGG'
      ];
      const l2 = parse(m);
      ok(l2.landTypeAt(10, 10) === 'tramp' && l2.landTypeAt(11, 10) === 'tramp', 'trampoline pair not tagged');
      ok(l2.solidAt(10, 10) && l2.solidAt(11, 10), 'trampolines must be solid');
      ok(!l2.solidAt(10, 11) && !l2.solidAt(11, 11), 'pit cells should be open');
      ok(l2.solidAt(9, 11) && l2.solidAt(12, 11), 'pit edges should be solid');
      ok(!l2.solidAt(10, 12) && !l2.solidAt(10, 13), 'below the map a pit stays open (fall to death)');
      ok(l2.pipes.length === 0 && l2.plants.length === 0 && l2.spawns.length === 0, 'phantom pipes, plants or spawns');
      ok(l2.bonbons.length === 0 && l2.keepCol === -1, 'phantom collectibles or Keep');
      ok(l2.poleCol === 15 && l2.poleTopRow === 7 && l2.poleBottomRow === 10, 'pole records wrong for the pit map');
      ok(l2.startRow === 11 && l2.startCol === 1, 'start spot wrong for the pit map');
    }

    /* a floating block row above the spawn must not become the start surface */
    {
      const m = [
        '..................',
        '..................',
        '..................',
        '.....BBB..........',
        '..................',
        '..................',
        '..................',
        '...............I..',
        '...............I..',
        '...............I..',
        '...............I..',
        'GGGGGGGGGGGGGGGGGG',
        'GGGGGGGGGGGGGGGGGG'
      ];
      const l3 = parse(m);
      ok(l3.startRow === 11, 'start surface should be the ground, not a floating block (got row ' + l3.startRow + ')');
      ok(l3.solidAt(5, 3), 'the floating brick row should still be solid and bumpable');
      ok(l3.startY === 11 * T, 'startY should be the feet line of the ground surface');
    }

    /* table integrity */
    for (let id = 0; id < table.length; id++) {
      if (!table[id] || !table[id].name) { fails.push('tile id ' + id + ' is missing from the table'); continue; }
      if (isQ(id) && !table[id].qitem) fails.push(table[id].name + ': Q block without a payload');
      if (id === EMPTY && table[id].solid) fails.push('empty tile must not be solid');
    }
    ok(BROS.Tiles.Q_IDS.length === 5, 'expected five Q payload ids');
    ok(table[SPIKE].solid === false && table[SPIKE].spike === true, 'spike flags wrong');
    ok(table[SPIKE].bumpable === false, 'spikes must not be bumpable');
    ok(table[Q_JELLY].qitem === 'jelly' && table[Q_EMBER].qitem === 'ember' &&
      table[Q_TOFFEE].qitem === 'toffee' && table[Q_BUBBLE].qitem === 'bubble', 'power-up payloads wrong');
    ok(table[PIPE].solid && table[USED].solid && table[GROUND].solid && table[STONE].solid, 'solid flags wrong');
    ok(table[BRICK].breakable && !table[STONE].breakable && !table[USED].breakable && !table[GROUND].breakable, 'breakable flags wrong');
    ok(!table[POLE].solid && table[POLE].pole && !table[KEEP].solid && table[KEEP].keep, 'finale flags wrong');
    ok(table[USED].bumpable && table[TRAMP].bumpable, 'used blocks and trampolines should still bump');
    ok(BROS.Tiles.ids.GROUND === GROUND && BROS.Tiles.ids.Q_BUBBLE === Q_BUBBLE &&
      Object.keys(BROS.Tiles.ids).length === table.length, 'Tiles.ids lookup wrong');
    ok(BROS.parseLevel === parseLevel, 'BROS.parseLevel was not exported');

    /* debug grid renders the cleared map */
    const dbg = lv.debugGrid();
    ok(dbg.split('\n').length === lv.rows + 1, 'debugGrid row count wrong');
    ok(dbg.indexOf('I') < 0 && dbg.indexOf('K') < 0 && dbg.indexOf('o') < 0, 'debugGrid should show the cleared grid');
    ok(dbg.split('\n')[6].indexOf('pp') === 7, 'debugGrid lost the pipe');

    return fails;
  }
})();
