/* ============================================================================
 * 08-physics.js — AABB tile collision (docs/plan/10-physics-and-camera.md)
 *
 * Pure, level-format agnostic and DOM free: it is the one module testable in
 * plain Node, and the tests below are run by tools/test-physics.mjs.
 * The world object is duck typed:
 *      solidAt(col, row)      -> truthy for anything that blocks movement
 *      landTypeAt(col, row)   -> optional string tag ('tramp'), tile-id agnostic
 *      oneWayAt(col, row)     -> optional pass-through-from-below platform
 * Out of bounds is solid for every level's own reasons (Level handles the left
 * edge and the pit fall), so this module never invents invisible walls.
 * ==========================================================================*/
(function () {
  'use strict';

  const C = BROS.C, U = BROS.U;
  const T = C.TILE;
  const EPS = 1e-6;
  const MAX_STEP = T * 0.45;          // sub-step size, well under half a tile

  /* ------------------------------------------------------------------ *
   * cell spans
   * ------------------------------------------------------------------ */
  function cellOf(v) { return Math.floor(v / T); }

  function rowsOf(e) {
    const a = cellOf(e.y), b = cellOf(e.y + e.h - EPS);
    const out = [];
    for (let r = a; r <= b; r++) out.push(r);
    return out;
  }

  function colsOf(e) {
    const a = cellOf(e.x), b = cellOf(e.x + e.w - EPS);
    const out = [];
    for (let c = a; c <= b; c++) out.push(c);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * probing helpers
   * ------------------------------------------------------------------ */
  /** Is there solid ground directly under the entity's feet? */
  function groundProbe(entity, world) {
    const row = cellOf(entity.y + entity.h + 1);
    for (const col of colsOf(entity)) if (world.solidAt(col, row)) return { col: col, row: row };
    return null;
  }

  /** Ground just past the leading edge — used for ledge turning. */
  function groundAhead(x, y, w, h, dir, world) {
    const col = cellOf(dir > 0 ? x + w + 2 : x - 2);
    const row = cellOf(y + h + 2);
    return world.solidAt(col, row);
  }

  function bodyBlocked(entity, world) {
    const cs = colsOf(entity), rs = rowsOf(entity);
    for (const c of cs) for (const r of rs) if (world.solidAt(c, r)) return true;
    return false;
  }

  function snapFeetToCell(entity, row) { entity.y = row * T - entity.h; }
  function snapHeadToCell(entity, row) { entity.y = (row + 1) * T; }

  /** Nudge the entity down onto a floor that is at most `max` px below. */
  function settleOnFloor(entity, world, max) {
    const limit = max == null ? T : max;
    for (let d = 1; d <= limit; d++) {
      const row = cellOf(entity.y + entity.h + d);
      if (world.solidAt(cellOf(entity.x), row) || world.solidAt(cellOf(entity.x + entity.w - EPS), row)) {
        snapFeetToCell(entity, row);
        return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * axis stepping
   * ------------------------------------------------------------------ */
  function stepX(e, world, dx, ev) {
    if (!dx) return;
    const dir = dx > 0 ? 1 : -1;
    const rows = rowsOf(e);
    let remaining = Math.abs(dx);
    let cursor = e.x;

    while (remaining > EPS) {
      const d = remaining > MAX_STEP ? MAX_STEP : remaining;
      const target = cursor + dir * d;
      const edge = dir > 0 ? target + e.w : target;      // leading edge
      const col = cellOf(edge);
      let blocker = -1;
      for (let i = 0; i < rows.length; i++) {
        if (world.solidAt(col, rows[i])) { blocker = rows[i]; break; }
      }
      if (blocker >= 0) {
        // snap flush against the tile face
        cursor = dir > 0 ? col * T - e.w - EPS : (col + 1) * T + EPS;
        e.x = cursor;
        ev.hitWall = dir > 0 ? 'right' : 'left';
        ev.wallRow = blocker;
        return;
      }
      cursor = target;
      remaining -= d;
    }
    e.x = cursor;
  }

  function stepY(e, world, dy, ev) {
    if (!dy) return;
    const cols = colsOf(e);

    if (dy > 0) {                                       // falling
      let remaining = dy;
      let cursor = e.y;
      while (remaining > EPS) {
        const d = remaining > MAX_STEP ? MAX_STEP : remaining;
        const target = cursor + d;
        const row = cellOf(target + e.h);              // row the feet enter
        let blocked = false;
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i];
          if (world.solidAt(c, row)) { blocked = true; break; }
          if (world.oneWayAt && world.oneWayAt(c, row) && cursor + e.h <= row * T + EPS) { blocked = true; break; }
        }
        if (blocked) {
          e.y = row * T - e.h;                         // stand exactly on top
          ev.landed = true;
          ev.landRow = row;
          ev.landCols = cols.slice();
          if (world.landTypeAt) {
            for (let i = 0; i < cols.length; i++) {
              const t = world.landTypeAt(cols[i], row);
              if (t) { ev.landType = t; break; }
            }
          }
          return;
        }
        cursor = target;
        remaining -= d;
      }
      e.y = cursor;
      return;
    }

    /* rising: head may bump tiles — remember every cell we touched */
    let remaining = -dy;
    let cursor = e.y;
    while (remaining > EPS) {
      const d = remaining > MAX_STEP ? MAX_STEP : remaining;
      const target = cursor - d;
      const row = cellOf(target);                      // row the head enters
      const touched = [];
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (world.solidAt(c, row)) touched.push({ col: c, row: row });
        else if (world.oneWayAt && world.oneWayAt(c, row) && cursor >= (row + 1) * T + EPS) touched.push({ col: c, row: row });
      }
      if (touched.length) {
        e.y = (row + 1) * T + EPS;                     // hang exactly below
        ev.hitCeil = true;
        ev.ceilRow = row;
        // nearest-column-first, so a head bump breaks a block straight above
        const centre = e.x + e.w / 2;
        touched.sort(function (a, b) {
          return Math.abs((a.col + 0.5) * T - centre) - Math.abs((b.col + 0.5) * T - centre);
        });
        for (let i = 0; i < touched.length; i++) ev.headCells.push(touched[i]);
        return;
      }
      cursor = target;
      remaining -= d;
    }
    e.y = cursor;
  }

  /* ------------------------------------------------------------------ *
   * main move
   * ------------------------------------------------------------------ */
  /**
   * Move `entity` by its vx/vy through a tile world and fill `ev`.
   * Does not alter vx/vy — the caller zeroes or bounces them as needed.
   */
  function move(entity, world, opts) {
    const o = opts || {};
    const ev = {
      hitWall: null, wallRow: -1, hitCeil: false, ceilRow: -1,
      landed: false, landRow: -1, landCols: [], landType: null,
      headCells: [], onGround: false, steppedOff: false, steps: 0
    };

    if (o.wallEvents === false) ev.hitWall = undefined;

    /* X then Y: landing is resolved last, which keeps feet placement exact */
    stepX(entity, world, entity.vx, ev);
    if (o.wallEvents === false && ev.hitWall) ev.hitWall = undefined;

    const wasGrounded = !!o.grounded;
    stepY(entity, world, entity.vy, ev);

    if (!ev.landed && wasGrounded) {
      // left the floor: the caller needs to know so it can start a fall
      ev.steppedOff = !groundProbe(entity, world);
    }

    if (o.maxStep > 0 && ev.hitWall) {
      /* optional auto step-up: try rising a whole tile at a time, then nudging
       * forward and falling back onto the ledge.  Used by nothing by default
       * (the player jumps over steps instead), but handy for riding entities. */
      const dir = ev.hitWall === 'right' ? 1 : -1;
      const saveX = entity.x, saveY = entity.y;
      let climbed = false;
      for (let rise = T; rise <= o.maxStep; rise += T) {
        entity.x = saveX;
        entity.y = saveY - rise;
        ev.hitWall = null;
        stepX(entity, world, dir * (T * 0.5), ev);
        settleOnFloor(entity, world, rise + 2);
        if (ev.hitWall || bodyBlocked(entity, world)) continue;
        if (groundProbe(entity, world)) { climbed = true; break; }
      }
      if (climbed) ev.hitWall = null;
      else {
        entity.x = saveX; entity.y = saveY;
        ev.hitWall = dir > 0 ? 'right' : 'left';
      }
    }

    ev.onGround = !!groundProbe(entity, world);
    ev.cells = cellsTouched(entity);
    return ev;
  }

  /** Every tile cell the entity's bounding box currently overlaps. */
  function cellsTouched(entity) {
    const out = [];
    const cs = colsOf(entity), rs = rowsOf(entity);
    for (const r of rs) for (const c of cs) out.push({ col: c, row: r });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * entity vs entity
   * ------------------------------------------------------------------ */
  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
  }

  function entitiesOverlap(a, b) {
    return rectOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
  }

  BROS.Phys = {
    move: move,
    settleOnFloor: settleOnFloor,
    groundProbe: groundProbe,
    groundAhead: groundAhead,
    cellsTouched: cellsTouched,
    bodyBlocked: bodyBlocked,
    rectOverlap: rectOverlap,
    entitiesOverlap: entitiesOverlap,
    cellOf: cellOf,
    snapFeetToCell: snapFeetToCell,
    snapHeadToCell: snapHeadToCell,
    selfTest: selfTest
  };

  /* ------------------------------------------------------------------ *
   * self test
   * ------------------------------------------------------------------ */
  function tinyWorld(rows) {
    const h = rows.length, w = rows[0].length;
    return {
      cols: w, rows: h,
      solidAt: function (c, r) {
        if (c < 0 || c >= w || r < 0 || r >= h) return false;
        const ch = rows[r].charAt(c);
        return ch === '#' || ch === 'H';
      },
      landTypeAt: function (c, r) {
        return r >= 0 && r < h && c >= 0 && c < w && rows[r].charAt(c) === 'H' ? 'tramp' : null;
      }
    };
  }

  function selfTest() {
    const fails = [];
    function ok(cond, msg) { if (!cond) fails.push(msg); }
    function ent(x, y, w, h, vx, vy) { return { x: x, y: y, w: w, h: h, vx: vx, vy: vy }; }

    /* 1. landing snaps the feet exactly onto the tile top, and resting is stable */
    {
      const wld = tinyWorld(['..............', '..............', '##############']);
      const e = ent(30, 20, 12, 16, 0, 7.1);
      let ev = null;
      for (let i = 0; i < 40; i++) {
        ev = BROS.Phys.move(e, wld, { grounded: ev ? ev.onGround : false });
        if (ev.landed) break;
      }
      ok(ev && ev.landed, 'never landed on the floor');
      ok(e.y + e.h === 32, 'feet not snapped to the floor top: bottom=' + (e.y + e.h));
      ok(Math.abs(e.y - 16) < 0.01, 'body not one tile above the floor: y=' + e.y);
      ok(ev && ev.onGround, 'onGround not reported after landing');
      const rest = BROS.Phys.move(e, wld, { grounded: true });
      ok(e.y + e.h === 32 && rest.onGround && !rest.hitCeil, 'resting entity drifted: y=' + e.y);
    }

    /* 2. walls stop movement flush and report which side */
    {
      const wld = tinyWorld(['..........####', '..........####', '##############']);
      const e = ent(100, 16, 12, 16, 4, 0);
      let ev = null;
      for (let i = 0; i < 60; i++) { ev = BROS.Phys.move(e, wld, {}); if (ev.hitWall) break; }
      ok(ev && ev.hitWall === 'right', 'right wall not reported: ' + JSON.stringify(ev));
      ok(Math.abs((e.x + e.w) - 10 * 16) < 0.01, 'not flush against the right face: x=' + e.x);
      const again = BROS.Phys.move(e, wld, {});
      ok(Math.abs((e.x + e.w) - 10 * 16) < 0.01, 'jittered while pressed against the wall: x=' + e.x);
      ok(again.hitWall === 'right', 'wall event lost while pressed against the wall');

      const wld2 = tinyWorld(['####..........', '####..........', '##############']);
      const left = ent(100, 16, 12, 16, -5, 0);
      let ev2 = null;
      for (let i = 0; i < 40; i++) { ev2 = BROS.Phys.move(left, wld2, {}); if (ev2.hitWall) break; }
      ok(ev2 && ev2.hitWall === 'left', 'left wall not reported');
      ok(Math.abs(left.x - 4 * 16) < 0.01, 'not flush at the left face: x=' + left.x);
    }

    /* 3. no vertical tunnelling through a one-tile-thick floor */
    {
      const rows = [];
      for (let r = 0; r < 13; r++) rows.push('..............');
      rows.push('##############');
      const wld = tinyWorld(rows);
      const e = ent(60, 13 * 16 - 16 - 3, 12, 16, 0, 13);      // 13 px/frame = 0.8 tiles
      let ev = null;
      for (let i = 0; i < 6; i++) { ev = BROS.Phys.move(e, wld, {}); if (ev.landed) break; }
      ok(ev && ev.landed, 'tunnelled through a one-tile floor at 13 px/frame');
      ok(e.y + e.h === 13 * 16, 'wrong landing row: bottom=' + (e.y + e.h));
    }

    /* 4. no horizontal tunnelling through a one-tile-thick wall */
    {
      const rows = [];
      for (let r = 0; r < 13; r++) rows.push('.........#......');
      rows.push('##############');
      const wld = tinyWorld(rows);
      const e = ent(9 * 16 - 12 - 3, 11 * 16, 12, 16, 11, 0);   // 11 px/frame
      let ev = null;
      for (let i = 0; i < 8; i++) { ev = BROS.Phys.move(e, wld, {}); if (ev.hitWall) break; }
      ok(ev && ev.hitWall === 'right', 'tunnelled a one-tile wall at 11 px/frame: x=' + e.x);
      ok(Math.abs((e.x + e.w) - 9 * 16) < 0.01, 'not flush against the tested wall: x=' + e.x);
    }

    /* 5. head bump snaps under the tile and reports the nearest column first */
    {
      const wld = tinyWorld(['..............', '.....#......', '..............', '##############']);
      const e = ent(5 * 16 + 2, 2 * 16, 12, 16, 0, -7);
      const ev = BROS.Phys.move(e, wld, {});
      ok(ev.hitCeil, 'no head bump detected');
      ok(Math.abs(e.y - 2 * 16) < 0.01, 'head not snapped under the tile: y=' + e.y);
      ok(ev.headCells.length >= 1 && ev.headCells[0].col === 5 && ev.headCells[0].row === 1,
        'headCells wrong: ' + JSON.stringify(ev.headCells));
    }

    /* 6. a wide head bump is ordered by distance from the entity centre */
    {
      const wld = tinyWorld(['..............', '#########.....', '..............', '##############']);
      const e = ent(5 * 16 + 4, 2 * 16, 16, 16, 0, -7);   // straddles columns 5 and 6, closer to 5
      const ev = BROS.Phys.move(e, wld, {});
      ok(ev.hitCeil, 'wide head bump not detected');
      ok(ev.headCells.length >= 2, 'wide head bump should report both columns: ' + JSON.stringify(ev.headCells));
      ok(ev.headCells.length >= 2 && ev.headCells[0].col === 5, 'nearest column should come first: ' + JSON.stringify(ev.headCells));
      const centre = e.x + e.w / 2;
      let ordered = true;
      for (let i = 1; i < ev.headCells.length; i++) {
        const d0 = Math.abs((ev.headCells[i - 1].col + 0.5) * 16 - centre);
        const d1 = Math.abs((ev.headCells[i].col + 0.5) * 16 - centre);
        if (d0 > d1 + 0.001) ordered = false;
      }
      ok(ordered, 'headCells not sorted nearest first: ' + JSON.stringify(ev.headCells));
    }

    /* 7. one-way platform: passes upward, lands on top */
    {
      const wld = {
        cols: 14, rows: 8,
        solidAt: function () { return false; },
        oneWayAt: function (c, r) { return r === 5 && c >= 4 && c <= 8; },
        landTypeAt: function () { return null; }
      };
      const e = ent(5 * 16, 6 * 16, 12, 16, 0, -6);
      const evUp = BROS.Phys.move(e, wld, {});
      ok(!evUp.hitCeil, 'blocked through a one-way platform from below');
      e.y = 3 * 16; e.vy = 6;
      let landed = null;
      for (let i = 0; i < 20; i++) { const ev = BROS.Phys.move(e, wld, {}); if (ev.landed) { landed = ev; break; } }
      ok(landed, 'did not land on a one-way platform');
      ok(landed && e.y + e.h === 5 * 16, 'one-way landing not snapped: bottom=' + (e.y + e.h));
    }

    /* 8. steppedOff and onGround bookkeeping while walking off a ledge */
    {
      const wld = tinyWorld(['..............', '..............', '########......']);
      const e = ent(20, 16, 12, 16, 3, 0);
      const a = BROS.Phys.move(e, wld, { grounded: true });
      ok(a.onGround, 'should be on the ground at x=' + e.x);
      ok(!a.steppedOff, 'reported steppedOff while still on the ledge');
      let stepped = false, airborne = false;
      for (let i = 0; i < 80; i++) {
        const ev = BROS.Phys.move(e, wld, { grounded: true });
        if (!ev.onGround) airborne = true;
        if (ev.steppedOff) { stepped = true; break; }
      }
      ok(stepped, 'steppedOff never reported when walking off the ledge');
      ok(airborne, 'onGround stayed true after walking off the ledge');
    }

    /* 9. trampoline land type is reported through the duck typed hook */
    {
      const wld = tinyWorld(['..............', '..............', 'HHHHHHHHHHHHHH']);
      const e = ent(30, 14, 12, 16, 0, 4);
      const ev = BROS.Phys.move(e, wld, {});
      ok(ev.landed && ev.landType === 'tramp', 'landTypeAt not reported: ' + JSON.stringify(ev));
    }

    /* 10. auto step up only when asked for (maxStep), and only over one tile */
    {
      const wld = tinyWorld(['..............', '......########', '##############']);
      const e = ent(4 * 16 + 4, 1 * 16, 12, 16, 3, 0);
      let climbed = false;
      for (let i = 0; i < 60; i++) {
        BROS.Phys.move(e, wld, { maxStep: 16, grounded: true });
        if (e.y + e.h === 1 * 16) { climbed = true; break; }
      }
      ok(climbed, 'maxStep did not climb the one-tile ledge: y=' + e.y + ' x=' + e.x);
      ok(climbed && e.x + e.w > 6 * 16, 'climbed but never got onto the step: x=' + e.x);
      for (let i = 0; i < 40; i++) BROS.Phys.move(e, wld, { maxStep: 16, grounded: true });
      ok(e.x >= 6 * 16 - 0.01 && e.y + e.h === 1 * 16,
        'should keep walking along the step after climbing: x=' + e.x + ' y=' + e.y);

      const plain = ent(4 * 16 + 4, 1 * 16, 12, 16, 3, 0);
      let blocked = null;
      for (let i = 0; i < 60; i++) { blocked = BROS.Phys.move(plain, wld, { grounded: true }); if (blocked.hitWall) break; }
      ok(blocked && blocked.hitWall === 'right', 'default behaviour should block a step, not climb it: x=' + plain.x);
      ok(Math.abs((plain.x + plain.w) - 6 * 16) < 0.01, 'not flush against the step: x=' + plain.x);
    }

    /* 11. overlap helpers */
    {
      ok(BROS.Phys.rectOverlap(0, 0, 10, 10, 9, 9, 10, 10), 'rectOverlap false negative');
      ok(!BROS.Phys.rectOverlap(0, 0, 10, 10, 10, 0, 10, 10), 'rectOverlap treats touching edges as overlap');
      ok(BROS.Phys.entitiesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 4, h: 4 }), 'entitiesOverlap false negative');
    }

    /* 12. a tall entity occupies the right rows */
    {
      const wld = tinyWorld(['#.............', '..............', '..............', '##############']);
      const e = ent(0, 4 * 16 - 30, 16, 30, 0, 0);      // big form standing on the row-3 floor
      const rowsSeen = BROS.Phys.cellsTouched(e).map(function (c) { return c.row; });
      ok(rowsSeen.indexOf(0) < 0, 'big form wrongly touches the empty ceiling row: ' + rowsSeen.join(','));
      const ev = BROS.Phys.move(e, wld, {});
      ok(!ev.hitWall, 'big form blocked by a tile in a column it does not reach: x=' + e.x);
    }

    return fails;
  }
})();
