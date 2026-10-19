// PLAN: docs/plan/03-constants-and-utils.md
// DOM-free utilities (Node-testable).
(function () {
  'use strict';
  const BROS = window.BROS;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function sign(v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); }
  function approach(v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  }
  // Rects are {x, y, w, h} with x/y = top-left px.
  function aabb(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w &&
           a.y < b.y + b.h && b.y < b.y + b.h;
  }
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randRange(rng, a, b) { return a + rng() * (b - a); }
  function hsl(h, s, l) { return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  BROS.U = {
    clamp, sign, approach, aabb, mulberry32, randRange, hsl, lerp, dist2
  };
})();
