/* ============================================================================
 * tools/genmaps-lib.mjs — the level DSL used by tools/design-*.mjs
 *
 * A 15-row character grid plus the design rules of docs/plan/09-level-design.md
 * expressed as assertions, so an illegal map cannot be produced.  Row 13/14 are
 * the ground band, WALK (row 12) is the cell a small body occupies while
 * walking, so anything that must be jumped over or bumped into is placed
 * relative to those two rows.
 * ==========================================================================*/
'use strict';

export const TILE = 16;
export const ROWS = 15;
export const GROUND_TOP = 13;
export const WALK = 12;

export const SOLID = new Set(['G', 'B', 'X', 'C', 'p', 'U']);

/* Measured jump arcs from tools/test-physics.mjs: design limits in px. */
export const ARC = {
  standRise: 72.66,
  bigRunRise: 78.98,
  standReach: Math.round(5.3 * TILE),   // 85 px
  runReach: Math.round(7.9 * TILE)      // 126 px
};
export const MAX_STEP = 4;              // 4 tiles = 64 px < standRise
export const BUMP_RISE = 48;            // rise a bump is allowed to need (margin)
export const COLLECT_RISE = 5;          // max (surfaceRow - bonbonRow)

export function isSolidCh(ch) { return SOLID.has(ch); }

export class LevelMap {
  constructor(name, title, theme, cols, time, startCol) {
    this.name = name;
    this.title = title;
    this.theme = theme;
    this.cols = cols;
    this.time = time;
    this.startCol = startCol;
    this.grid = [];
    for (let r = 0; r < ROWS; r++) this.grid.push(new Array(cols).fill('.'));
    this.notes = [];
    this.errors = [];
    this._pole = null;            // {col, topRow}
    this._keep = null;            // {col, topRow}
    this.pipes = [];              // {col, hgt, chomper}
    this.ledges = [];             // {c0, c1, top}
    this.pits = [];               // {c0, c1}
    this.spawns = [];             // {kind, col, row}
    this.bonbons = [];            // {col, row}
    this.qblocks = [];            // {col, row, letter}
    this._spikes = [];            // {c0, c1, row}
    this.ceilings = [];           // {c0, c1, row}
    this.blockrows = [];          // {c0, c1, row, ch} plain block rows
  }

  /* ---------------- low level cell writing ---------------- */
  inBounds(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < ROWS; }
  at(c, r) { return this.inBounds(c, r) ? this.grid[r][c] : '.'; }
  chAt(c, r) { return this.at(c, r); }

  fail(msg) { this.errors.push(this.name + ': ' + msg); }
  note(msg) { this.notes.push(msg); }

  /** write a single cell that must currently be empty */
  put(c, r, ch) {
    if (!this.inBounds(c, r)) { this.fail('write outside the map at ' + c + ',' + r); return this; }
    if (this.grid[r][c] !== '.') this.fail('cell ' + c + ',' + r + ' already holds "' + this.grid[r][c] + '" (wanted "' + ch + '")');
    else this.grid[r][c] = ch;
    return this;
  }

  /** write a rectangle whose cells must all be empty */
  fill(c0, c1, r0, r1, ch) {
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (!this.inBounds(c, r)) { this.fail('fill outside the map at ' + c + ',' + r); continue; }
        if (this.grid[r][c] !== '.') {
          this.fail('fill ' + c + ',' + r + ' collides with "' + this.grid[r][c] + '" (wanted "' + ch + '")');
        } else this.grid[r][c] = ch;
      }
    }
    return this;
  }

  /* ---------------- terrain ---------------- */
  /** the base floor: rows GROUND_TOP..14 filled with ground */
  baseGround(c0 = 0, c1 = this.cols - 1) {
    this.fill(c0, c1, GROUND_TOP, ROWS - 1, 'G');
    return this;
  }

  /** open a pit: removes the ground band for those columns */
  pit(c0, c1) {
    for (let c = c0; c <= c1; c++) {
      for (let r = GROUND_TOP; r <= ROWS - 1; r++) {
        if (this.at(c, r) !== 'G') this.fail('pit carve at ' + c + ',' + r + ' is not ground ("' + this.at(c, r) + '")');
        else this.grid[r][c] = '.';
      }
    }
    this.pits.push({ c0: c0, c1: c1 });
    return this;
  }

  /** raised ground: rows top..WALK filled, ground band stays underneath */
  ledge(c0, c1, top, ch = 'G') {
    this.fill(c0, c1, top, WALK, ch);
    this.ledges.push({ c0: c0, c1: c1, top: top });
    return this;
  }

  /** classic ascending staircase of solid columns, one tile taller per step */
  stairs(c0, steps, stepW = 2, ch = 'X') {
    if (steps > 8) this.fail('staircases stop at 8 steps (got ' + steps + ')');
    for (let i = 0; i < steps; i++) {
      const a = c0 + i * stepW;
      this.fill(a, a + stepW - 1, WALK - i, WALK, ch);
      this.ledges.push({ c0: a, c1: a + stepW - 1, top: WALK - i, stair: true, step: i, stepW: stepW });
    }
    return this;
  }

  /** a horizontal run of blocks (bricks / hard candy / used blocks) */
  blockRow(c0, c1, row, ch) {
    this.fill(c0, c1, row, row, ch);
    this.blockrows.push({ c0: c0, c1: c1, row: row, ch: ch });
    if (ch === 'X') this.ceilings.push({ c0: c0, c1: c1, row: row });
    return this;
  }

  /** low hard-candy ceiling: the corridor between it and the floor stays passable */
  ceiling(c0, c1, row) {
    this.blockRow(c0, c1, row, 'X');
    return this;
  }

  /** a run of solid ceiling/floor cells forming an alcove gate */
  gate(col, fromRow, toRow, ch = 'X') {
    this.fill(col, col, fromRow, toRow, ch);
    return this;
  }

  /** trampoline pad, flush with the ground surface (replaces the surface cell) */
  trampoline(c0, c1 = c0) {
    for (let c = c0; c <= c1; c++) {
      if (this.at(c, GROUND_TOP) !== 'G') this.fail('trampoline at ' + c + ' must sit in the ground surface (found "' + this.at(c, GROUND_TOP) + '")');
      else this.grid[GROUND_TOP][c] = 'C';
    }
    this.trampCols = (this.trampCols || []).concat(range(c0, c1));
    return this;
  }

  /** spikes standing on the surface: they occupy the walk band, never solid */
  spikes(c0, c1, row = WALK) {
    this.fill(c0, c1, row, row, 's');
    this._spikes.push({ c0: c0, c1: c1, row: row });
    return this;
  }

  /** 2-wide pipe of height hgt standing on the ground band */
  pipe(col, hgt) {
    if (hgt < 2) this.fail('pipe at col ' + col + ' is only ' + hgt + ' tall (min 2)');
    const top = GROUND_TOP - hgt;
    this.fill(col, col + 1, top, WALK, 'p');
    const rec = { col: col, hgt: hgt, top: top, chomper: null };
    this.pipes.push(rec);
    return this;
  }

  /** Chomper seed directly on top of a pipe mouth */
  chomper(col, hgt) {
    const found = this.pipes.filter(function (p) { return p.col === col; })[0];
    if (!found) { this.fail('chomper at col ' + col + ' has no pipe there'); return this; }
    if (found.hgt !== hgt) this.fail('chomper at col ' + col + ' asks height ' + hgt + ' but the pipe is ' + found.hgt);
    const row = GROUND_TOP - hgt - 1;
    this.put(col, row, 'r');
    this.spawns.push({ kind: 'chomper', col: col, row: row });
    found.chomper = { col: col, row: row };
    return this;
  }

  /* ---------------- items and entities ---------------- */
  /** one letter, or a run of letters (one per column) at a row */
  qRow(c0, c1, row, letters) {
    const chars = letters.length === 1 ? new Array(c1 - c0 + 1).fill(letters) : letters;
    if (chars.length !== c1 - c0 + 1) {
      this.fail('qRow ' + c0 + '-' + c1 + ' row ' + row + ' got ' + chars.length + ' letters for ' + (c1 - c0 + 1) + ' cells');
      return this;
    }
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '.') continue;                       // gap in the block row
      if ('?JERO'.indexOf(ch) < 0 && ch !== 'B' && ch !== 'X') { this.fail('qRow unknown letter "' + ch + '"'); continue; }
      this.put(c0 + i, row, ch);
      if ('?JERO'.indexOf(ch) >= 0) this.qblocks.push({ col: c0 + i, row: row, letter: ch });
    }
    return this;
  }

  bonbon(col, row) {
    this.put(col, row, 'o');
    this.bonbons.push({ col: col, row: row });
    return this;
  }

  /** a bonbon arc over a gap: edges low, peak in the middle */
  bonbonArc(c0, c1, peakRow, edgeRow) {
    const lo = edgeRow === undefined ? 11 : edgeRow;
    const mid = (c0 + c1) / 2;
    const half = Math.max(1, (c1 - c0) / 2);
    for (let c = c0; c <= c1; c++) {
      const t = (c - mid) / half;
      const row = Math.round(lo + (peakRow - lo) * (1 - t * t));
      this.bonbon(c, row);
    }
    return this;
  }

  bonbonLine(c0, c1, row) {
    for (let c = c0; c <= c1; c++) this.bonbon(c, row);
    return this;
  }

  /** ground enemies default to standing on the surface at that column */
  spawn(kind, col, row) {
    const r = row === undefined ? this.surface(col) - 1 : row;
    const letter = { pudge: 'g', shell: 'q', hopper: 'h', floatoo: 'f', chomper: 'r' }[kind];
    if (!letter) { this.fail('unknown spawn kind ' + kind); return this; }
    this.put(col, r, letter);
    this.spawns.push({ kind: kind, col: col, row: r });
    return this;
  }

  /* ---------------- finale ---------------- */
  pole(col, topRow) {
    if (this._pole) this.fail('only one flagpole per level');
    const top = topRow === undefined ? 7 : topRow;
    this.fill(col, col, top, WALK, 'I');
    this._pole = { col: col, topRow: top };
    return this;
  }

  /** 4x4 Gingerbread Keep standing on the ground band */
  keep(col, topRow) {
    if (this._keep) this.fail('only one Keep per level');
    const top = topRow === undefined ? 9 : topRow;
    this.fill(col, col + 3, top, top + 3, 'K');
    this._keep = { col: col, topRow: top };
    return this;
  }

  /* ---------------- queries used by the checks ---------------- */
  /** the surface a player standing in this column would be on: the top of the
   *  solid run that reaches down from the bottom of the map (matches the
   *  start-spot rule of BROS.parseLevel) */
  surface(col) {
    let low = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (isSolidCh(this.at(col, r))) { low = r; break; }
    }
    if (low < 0) return ROWS;                       // a void: nothing to stand on
    let top = low;
    while (top - 1 >= 0 && isSolidCh(this.at(col, top - 1))) top--;
    return top;
  }
  hasGround(col) { return isSolidCh(this.at(col, GROUND_TOP)); }
  isTramp(col) { return this.at(col, GROUND_TOP) === 'C'; }
  walkBandClear(col, row) {
    return !isSolidCh(this.at(col, row)) && !isSolidCh(this.at(col, row - 1));
  }
  /** columns you can build speed on, ending just left of c0 (or starting at c1) */
  runUpLeft(c0, surfaceRow) {
    let n = 0;
    for (let c = c0 - 1; c >= 0; c--) {
      if (this.surface(c) !== surfaceRow) break;
      if (!this.walkBandClear(c, surfaceRow - 1)) break;
      if (this.at(c, surfaceRow - 1) === 's') break;      // spikes block the run-up
      n++;
    }
    return n;
  }
  runUpRight(c1, surfaceRow) {
    let n = 0;
    for (let c = c1 + 1; c < this.cols; c++) {
      if (this.surface(c) !== surfaceRow) break;
      if (!this.walkBandClear(c, surfaceRow - 1)) break;
      if (this.at(c, surfaceRow - 1) === 's') break;
      n++;
    }
    return n;
  }
}

export function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/* ------------------------------------------------------------------ *
 * design rules (docs/plan/09-level-design.md), asserted before export
 * ------------------------------------------------------------------ */
function pitRuns(lv) {
  const runs = [];
  let c = 0;
  while (c < lv.cols) {
    if (!lv.hasGround(c)) {
      let end = c;
      while (end + 1 < lv.cols && !lv.hasGround(end + 1)) end++;
      runs.push({ c0: c, c1: end, w: end - c + 1 });
      c = end + 1;
    } else c++;
  }
  return runs;
}

export function checkDesign(lv) {
  /* --- finale shape --- */
  if (!lv._pole) lv.fail('no flagpole placed');
  if (!lv._keep) lv.fail('no Keep placed');
  if (lv._pole && lv._keep) {
    if (lv._keep.col !== lv._pole.col + 3) {
      lv.fail('Keep must sit 3 columns right of the pole (pole ' + lv._pole.col + ', keep ' + lv._keep.col + ')');
    }
    if (lv.cols !== lv._keep.col + 5) lv.fail('level width must be keepCol+5 (' + (lv._keep.col + 5) + ', got ' + lv.cols + ')');
    if (!lv.hasGround(lv._pole.col)) lv.fail('flagpole at col ' + lv._pole.col + ' has no ground under it');
    if (!lv.hasGround(lv._keep.col + 1)) lv.fail('Keep at col ' + lv._keep.col + ' is not standing on ground');
    for (let r = lv._keep.topRow; r <= lv._keep.topRow + 3; r++) {
      for (let c = lv._keep.col; c <= lv._keep.col + 3; c++) {
        if (lv.at(c, r) !== 'K') lv.fail('Keep footprint is not a clean 4x4 at ' + c + ',' + r);
      }
    }
    /* the walk from the pole to the Keep door must be unobstructed */
    const stairs = lv.ledges.filter(function (l) { return l.stair; });
    const stairFinish = stairs.some(function (l) { return l.c1 >= lv._pole.col - 6; });
    if (stairFinish) {
      /* SMB style: the staircase hands the player straight onto the pole */
      let last = stairs[0];
      for (const s of stairs) if (s.c1 > last.c1) last = s;
      if (lv._pole.col - last.c1 > 4) {
        lv.fail('the staircase ends at col ' + last.c1 + ', too far from the flagpole at ' + lv._pole.col);
      }
      if (lv._pole.topRow > last.top + 1) {
        lv.fail('flagpole top row ' + lv._pole.topRow + ' sits above the staircase top row ' + last.top + ' (unreachable)');
      }
    }
    for (let c = lv._pole.col; c <= lv._keep.col; c++) {
      const s = lv.surface(c);
      if (s !== GROUND_TOP) { lv.fail('the path to the Keep is not flat at col ' + c + ' (surface row ' + s + ')'); break; }
      if (isSolidCh(lv.at(c, WALK)) || isSolidCh(lv.at(c, WALK - 1))) {
        lv.fail('the path to the Keep is blocked at ' + c + ',' + WALK + ' by "' + lv.at(c, WALK) + '"');
        break;
      }
    }
  }

  /* --- start spot --- */
  const ss = lv.surface(lv.startCol);
  if (ss !== GROUND_TOP) lv.fail('startCol ' + lv.startCol + ' is not on the ground surface (row ' + ss + ')');
  if (isSolidCh(lv.at(lv.startCol, WALK)) || isSolidCh(lv.at(lv.startCol, WALK - 1))) {
    lv.fail('the start cell at col ' + lv.startCol + ' is blocked');
  }

  /* --- pits: width limits, assist requirements, bonbon reward overhead --- */
  for (const run of pitRuns(lv)) {
    const leftSurface = lv.hasGround(run.c0 - 1) ? lv.surface(run.c0 - 1) : -1;
    const rightSurface = lv.hasGround(run.c1 + 1) ? lv.surface(run.c1 + 1) : -1;
    if (leftSurface !== GROUND_TOP || rightSurface !== GROUND_TOP) {
      lv.fail('pit ' + run.c0 + '-' + run.c1 + ' must be entered and left at ground level (' + leftSurface + '/' + rightSurface + ')');
    }
    if (run.w > 6) { lv.fail('pit ' + run.c0 + '-' + run.c1 + ' is ' + run.w + ' wide (hard cap 6)'); continue; }
    const tramp = lv.isTramp(run.c0 - 1) || lv.isTramp(run.c1 + 1) || lv.isTramp(run.c0) || lv.isTramp(run.c1);
    const lu = lv.runUpLeft(run.c0, GROUND_TOP);
    const ru = lv.runUpRight(run.c1, GROUND_TOP);
    const runUp = Math.max(lu, ru) >= 5;
    if (run.w > 5 && !tramp) lv.fail('pit ' + run.c0 + '-' + run.c1 + ' (' + run.w + ' wide) needs a trampoline at its edge');
    if (run.w > 4 && run.w <= 5 && !tramp && !runUp) {
      lv.fail('pit ' + run.c0 + '-' + run.c1 + ' (' + run.w + ' wide) needs 5 columns of run-up (got ' + lu + '/' + ru + ') or a trampoline');
    }
    const arc = lv.bonbons.some(function (b) { return b.col >= run.c0 - 2 && b.col <= run.c1 + 2 && b.row <= WALK; });
    if (!arc) lv.fail('pit ' + run.c0 + '-' + run.c1 + ' has no bonbon arc overhead');
    run.lu = lu; run.ru = ru; run.tramp = tramp;
  }

  /* --- ledges and stairs --- */
  for (const lg of lv.ledges) {
    if (lg.top > WALK) { lv.fail('ledge ' + lg.c0 + '-' + lg.c1 + ' top row ' + lg.top + ' is below the walk band'); continue; }
    /* its top must be walkable: the two cells above the surface stay clear */
    for (let c = lg.c0; c <= lg.c1; c++) {
      if (isSolidCh(lv.at(c, lg.top - 1)) || isSolidCh(lv.at(c, lg.top - 2))) {
        lv.fail('ledge ' + lg.c0 + '-' + lg.c1 + ' top surface is not clear above col ' + c);
        break;
      }
    }
    if (lg.stair) {
      if (lg.step > 0) {
        const prev = lv.ledges.some(function (o) { return o.stair && o.step === lg.step - 1 && o.c1 === lg.c0 - 1; });
        if (!prev) lv.fail('stair step ' + lg.step + ' at col ' + lg.c0 + ' is not continuous with the step before it');
      }
      if (lv._pole && lg.c1 >= lv._pole.col - 1) lv.fail('stair step at col ' + lg.c0 + ' crowds the flagpole at ' + lv._pole.col);
      continue;
    }
    const rise = GROUND_TOP - lg.top;
    if (rise > MAX_STEP) lv.fail('ledge ' + lg.c0 + '-' + lg.c1 + ' rises ' + rise + ' tiles from the ground (max ' + MAX_STEP + ')');
    if (rise > 1 && lg.top < WALK - 1) {
      const approach = lv.runUpLeft(lg.c0, GROUND_TOP);
      if (approach < 3) lv.fail('ledge ' + lg.c0 + '-' + lg.c1 + ' (top ' + lg.top + ') has only ' + approach + ' columns of run-up');
    }
  }

  /* --- pipes: height, and headroom for the Chomper --- */
  for (const p of lv.pipes) {
    if (p.hgt > MAX_STEP) lv.fail('pipe at col ' + p.col + ' is ' + p.hgt + ' tall (max ' + MAX_STEP + ')');
    if (p.hgt === MAX_STEP) {
      const assist = lv.isTramp(p.col - 2) || lv.isTramp(p.col + 3) || lv.runUpLeft(p.col, GROUND_TOP) >= 6;
      if (!assist) lv.fail('the ' + p.hgt + ' tall pipe at col ' + p.col + ' needs run-up room or a trampoline');
    }
    if (!lv.hasGround(p.col) || !lv.hasGround(p.col + 1)) lv.fail('pipe at col ' + p.col + ' is not standing on ground');
    if (lv._pole && p.col + 1 >= lv._pole.col - 2) lv.fail('pipe at col ' + p.col + ' is too close to the flagpole');
    if (p.chomper) {
      const r = p.chomper.row;
      if (isSolidCh(lv.at(p.chomper.col, r)) || isSolidCh(lv.at(p.chomper.col, r - 1))) {
        lv.fail('chomper at ' + p.chomper.col + ',' + r + ' has no headroom');
      }
    }
  }

  /* --- spikes: sit on a surface, and stay jumpable from a flat run-up --- */
  for (const sp of lv._spikes) {
    const row = sp.row;
    for (let c = sp.c0; c <= sp.c1; c++) {
      if (!isSolidCh(lv.at(c, row + 1))) lv.fail('spike at ' + c + ',' + row + ' is not standing on a solid cell');
      if (isSolidCh(lv.at(c, row))) lv.fail('spike at ' + c + ',' + row + ' must not be solid');
    }
    const w = sp.c1 - sp.c0 + 1;
    if (w > 4) lv.fail('spike run ' + sp.c0 + '-' + sp.c1 + ' is ' + w + ' wide; the player can only clear 4 at a time');
    const lu = lv.runUpLeft(sp.c0, row + 1);
    const ru = lv.runUpRight(sp.c1, row + 1);
    if (Math.max(lu, ru) < 4) lv.fail('spike run ' + sp.c0 + '-' + sp.c1 + ' has only ' + lu + '/' + ru + ' columns of flat approach');
  }

  /* --- plain block rows one row above the walk band wall off big form --- */
  for (let c = 0; c < lv.cols; c++) {
    const ch = lv.at(c, WALK - 1);
    if (ch !== 'B' && ch !== 'X') continue;
    if (lv.surface(c) !== GROUND_TOP) continue;          // owned by a raised surface: fine
    let end = c;
    while (end + 1 < lv.cols && (lv.at(end + 1, WALK - 1) === 'B' || lv.at(end + 1, WALK - 1) === 'X') && lv.surface(end + 1) === GROUND_TOP) end++;
    lv.note('row-11 "' + ch + '" run ' + c + '-' + end + ' walls big form out at ground level (jump onto it or break it first)');
    c = end;
  }

  /* --- ceilings: a corridor needs at least one clear cell of headroom --- */
  for (const cl of lv.ceilings) {
    for (let c = cl.c0; c <= cl.c1; c++) {
      const s = lv.surface(c);
      const gap = s - cl.row - 1;
      if (gap < 1) lv.fail('ceiling at ' + c + ',' + cl.row + ' leaves no room to walk (gap ' + gap + ')');
      if (gap === 1) lv.note('corridor at col ' + c + ' row ' + cl.row + ' is a crouch passage (16px)');
    }
  }

  /* --- Q blocks: bumpable from below, reachable, high enough that big form
       can still walk under the row (32px of clearance = 3 rows of separation) --- */
  for (const q of lv.qblocks) {
    if (q.row >= WALK) lv.fail('Q block at ' + q.col + ',' + q.row + ' sits in or below the walk band');
    const below = lv.at(q.col, q.row + 1);
    if (isSolidCh(below)) lv.fail('Q block at ' + q.col + ',' + q.row + ' cannot be bumped: "' + below + '" blocks it from below');
    const s = lv.surface(q.col);
    const headroomPx = TILE * (s - q.row - 1);
    if (headroomPx < 32) lv.fail('Q block at ' + q.col + ',' + q.row + ' leaves only ' + headroomPx + 'px of headroom over surface row ' + s + ' (big form needs 32px)');
    const risePx = TILE * (s - q.row - 2);
    if (risePx > BUMP_RISE) lv.fail('Q block at ' + q.col + ',' + q.row + ' needs a ' + risePx + 'px rise from surface ' + s + ' (max ' + BUMP_RISE + ')');
    /* the column above a Q block must stay clear, or bumping it welds the player in */
    if (isSolidCh(lv.at(q.col, q.row - 1))) lv.fail('Q block at ' + q.col + ',' + q.row + ' has a solid cell directly above it');
  }

  /* --- collectibles must be reachable from some surface --- */
  for (const b of lv.bonbons) {
    let best = 99;
    for (let c = b.col - 3; c <= b.col + 3; c++) {      // launch pads may be a few columns away
      if (!lv.inBounds(c, 0)) continue;
      const s = lv.surface(c);
      if (s >= ROWS) continue;
      if (s - b.row < 0) continue;      // a surface *above* the bonbon is no launch pad
      best = Math.min(best, s - b.row);
    }
    if (best === 99) lv.fail('bonbon at ' + b.col + ',' + b.row + ' has no launchable surface within 3 columns below it');
    else if (best > COLLECT_RISE) lv.fail('bonbon at ' + b.col + ',' + b.row + ' is ' + best + ' rows above the nearest surface (max ' + COLLECT_RISE + ')');
  }

  /* --- enemy placement --- */
  for (const sp of lv.spawns) {
    if (sp.kind === 'chomper') continue;                    // checked with its pipe
    if (sp.kind === 'floatoo') {
      if (sp.row > WALK) lv.fail('floatoo at ' + sp.col + ',' + sp.row + ' is not in the air');
      const nearPit = lv.pits.some(function (p) { return sp.col >= p.c0 - 4 && sp.col <= p.c1 + 4; });
      const nearLedge = lv.ledges.some(function (l) { return sp.col >= l.c0 - 4 && sp.col <= l.c1 + 4; });
      if (!nearPit && !nearLedge) lv.fail('floatoo at ' + sp.col + ',' + sp.row + ' should hover over a pit or ledge');
      continue;
    }
    if (!isSolidCh(lv.at(sp.col, sp.row + 1))) lv.fail(sp.kind + ' at ' + sp.col + ',' + sp.row + ' has no ground under it');
    if (sp.row >= WALK + 1) lv.fail(sp.kind + ' at ' + sp.col + ',' + sp.row + ' is buried in the ground band');
    const clear = lv.walkBandClear(sp.col, sp.row);
    if (!clear) lv.fail(sp.kind + ' at ' + sp.col + ',' + sp.row + ' has no headroom');
    if (lv.at(sp.col, sp.row + 1) === 's') lv.fail(sp.kind + ' at ' + sp.col + ',' + sp.row + ' is standing on spikes');
  }

  /* --- pacing: a level may not be empty of enemies or of items --- */
  if (lv.spawns.length < 3) lv.fail('level has only ' + lv.spawns.length + ' enemies');
  if (lv.bonbons.length < 8) lv.fail('level has only ' + lv.bonbons.length + ' bonbons');
  if (lv.qblocks.length < 2) lv.fail('level has only ' + lv.qblocks.length + ' Q blocks');

  return lv.errors;
}

/* ------------------------------------------------------------------ *
 * printing
 * ------------------------------------------------------------------ */
export function renderRows(lv) {
  return lv.grid.map(function (row) { return row.join(''); });
}

export function drawMap(lv) {
  const out = [];
  out.push('    ' + headerRuler(lv.cols));
  for (let r = 0; r < ROWS; r++) {
    let s = '';
    for (let c = 0; c < lv.cols; c++) s += lv.grid[r][c];
    out.push((r < 10 ? ' ' : '') + r + '  ' + s);
  }
  out.push('    ' + headerRuler(lv.cols));
  return out.join('\n');
}
function headerRuler(cols) {
  let tens = '';
  for (let c = 0; c < cols; c++) tens += (c % 10 === 0 ? String(Math.floor(c / 10) % 10) : ' ');
  return tens;
}

export function summarize(lv) {
  const lines = [];
  lines.push(lv.name + ' "' + lv.title + '" theme ' + lv.theme + '  ' + lv.cols + ' cols  time ' + lv.time +
    '  startCol ' + lv.startCol);
  lines.push('  pole col ' + (lv._pole ? lv._pole.col + ' rows ' + lv._pole.topRow + '-' + WALK : 'MISSING') +
    '   keep col ' + (lv._keep ? lv._keep.col + ' rows ' + lv._keep.topRow + '-' + (lv._keep.topRow + 3) : 'MISSING'));
  const runs = pitRuns(lv).map(function (r) {
    return r.c0 + '-' + r.c1 + ' (' + r.w + (r.tramp ? ', tramp' : '') + ', run-up ' + (r.lu === undefined ? '?' : r.lu) + '/' + (r.ru === undefined ? '?' : r.ru) + ')';
  });
  lines.push('  pits: ' + (runs.length ? runs.join('  ') : 'none'));
  lines.push('  ledges: ' + lv.ledges.map(function (l) { return l.c0 + '-' + l.c1 + ' top ' + l.top; }).join('  '));
  lines.push('  pipes: ' + lv.pipes.map(function (p) { return 'col ' + p.col + ' h' + p.hgt + (p.chomper ? ' +chomper' : ''); }).join('  '));
  lines.push('  spikes: ' + lv._spikes.map(function (s) { return s.c0 + '-' + s.c1 + '@' + s.row; }).join('  '));
  lines.push('  ceilings: ' + lv.ceilings.map(function (c) { return c.c0 + '-' + c.c1 + '@' + c.row; }).join('  '));
  const byKind = {};
  for (const s of lv.spawns) byKind[s.kind] = (byKind[s.kind] || 0) + 1;
  lines.push('  enemies: ' + Object.keys(byKind).sort().map(function (k) { return k + ' x' + byKind[k]; }).join(', ') +
    '   [' + lv.spawns.map(function (s) { return s.kind[0] + s.col + '@' + s.row; }).join(' ') + ']');
  lines.push('  Q blocks: ' + lv.qblocks.map(function (q) { return q.letter + q.col + '@' + q.row; }).join(' '));
  lines.push('  bonbons: ' + lv.bonbons.length + '  trampolines: ' + (lv.trampCols || []).length);
  return lines.join('\n');
}

