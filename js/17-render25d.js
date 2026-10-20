// PLAN: docs/plan/18-visual-2-5d.md — see README ("2.5D POP render mode")
// BROS.R3D: optional "POP" mode. In flat mode wrap() forwards ctx ops untouched;
// in pop mode the Level draw ctx is proxied and its ops recorded, then end()
// replays them through three.js (vendor/three.min.js, UMD r149 vendored from the
// npm `three` package): tile prisms (extruded fronts + lit top faces) at z=0,
// decor at Z_BACK with apparent size preserved, sprites pulled to Z_POP, sky
// as the clear color, full-view washes replayed straight onto the 2D overlay.
// HUD/Screens always draw to the overlay ctx (create()'s `hud` arg), so js/15
// and js/14 stay pixel-crisp in both modes. depthTest=false + renderOrder
// reproduces the exact 2D painter order. Toggling: V key + ?pop=1 URL param.
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C;
  const K = C.R3D;
  const U = 16;

  const R3D = {
    pop: false,
    fx: null,
    fy: null,
    focus: function (x, y) { R3D.fx = x; R3D.fy = y; },
    begin: function () {},
    end: function () {},      // browser boot replaces both with the pop cycle
    setMode: function () {}
  };
  BROS.R3D = R3D;

  /* ---------- DOM + three.js state ---------- */
  let scr = null, glCv = null, ovCv = null, ovCtx = null;
  let rend = null, scene = null, cam = null, THREE = null, dist = 0, tSway = 0;
  let unitGeo = null, unitMat = null;
  const pool = [];
  let poolN = 0;

  /* ---------- per-frame op recorder ---------- */
  let ops = [], sky = null;
  let M = [1, 0, 0, 1, 0, 0], stack = [], depth = 0, alpha = 1, fill = '#000000';
  let baseE = 0, baseF = 0, baseSet = false, camE = 0, camF = 0, camSet = false;
  let firstTile = false;
  let tileSet = new WeakSet();

  function clampX(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------- recording (proxied ctx, pop mode only) ---------- */
  function frameReset() {
    M = [1, 0, 0, 1, 0, 0]; stack = []; depth = 0; alpha = 1;
    baseSet = false; camSet = false; firstTile = false;
  }
  R3D.begin = function () {
    ops = []; sky = null; frameReset();
    refreshTiles();   // theme swaps re-generate tile canvases: re-snapshot every frame
  };
  R3D.wrap = function (real) {
    const api = {};
    const store = { fillStyle: '#000000', globalAlpha: 1, imageSmoothingEnabled: true };
    api.save = function () {
      stack.push([M[0], M[1], M[2], M[3], M[4], M[5], depth, baseE, baseF]);
      depth++;
    };
    api.restore = function () {
      const p = stack.pop();
      M = [p[0], p[1], p[2], p[3], p[4], p[5]]; depth = p[6]; baseE = p[7]; baseF = p[8];
    };
    api.translate = function (x, y) {
      M[4] += M[0] * x + M[2] * y; M[5] += M[1] * x + M[3] * y;
      if (depth === 1 && !baseSet) { baseE = M[4]; baseF = M[5]; baseSet = true; }
    };
    api.scale = function (sx, sy) { M[0] *= sx; M[1] *= sx; M[2] *= sy; M[3] *= sy; };
    api.rotate = function (an) {
      const co = Math.cos(an), si = Math.sin(an), a0 = M[0], b0 = M[1], c0 = M[2], d0 = M[3];
      M[0] = a0 * co + c0 * si; M[1] = b0 * co + d0 * si;
      M[2] = c0 * co - a0 * si; M[3] = d0 * co - b0 * si;
    };
    api.fillRect = function (x, y, w, h) {
      if (!R3D.pop) { real.fillRect(x, y, w, h); return; }
      if (w >= C.VIEW_W && h >= C.VIEW_H && M[4] === 0 && M[5] === 0) {
        if (sky === null) { sky = fill; return; }        // sky fill = scene clear color
        ops.push({ k: 'wash', x: x, y: y, w: w, h: h, fill: fill, a: alpha });
        return;                                          // blackout/fade = 2D overlay replay
      }
      ops.push({ k: 'r', x: x, y: y, w: w, h: h, a: alpha, z: firstTile ? K.Z_POP : K.Z_BACK });
    };
    api.drawImage = function (img, b, c, d, e, f, g, h, i) {
      const n = arguments.length;
      if (!R3D.pop) {
        if (n === 3) real.drawImage(img, b, c);
        else if (n === 5) real.drawImage(img, b, c, d, e);
        else real.drawImage(img, b, c, d, e, f, g, h, i);
        return;
      }
      let sx, sy, sw, sh, x, y, w, hh;
      if (n === 3) { sx = 0; sy = 0; sw = img.width; sh = img.height; x = b; y = c; w = img.width; hh = img.height; }
      else if (n === 5) { sx = 0; sy = 0; sw = img.width; sh = img.height; x = b; y = c; w = d; hh = e; }
      else { sx = b; sy = c; sw = d; sh = e; x = f; y = g; w = h; hh = i; }
      // corner-apply the matrix, then strip the active camera push -> Level's coord space
      const p0x = M[0] * x + M[2] * y + M[4], p0y = M[1] * x + M[3] * y + M[5];
      const p1x = M[0] * (x + w) + M[2] * (y + hh) + M[4], p1y = M[1] * (x + w) + M[3] * (y + hh) + M[5];
      const x0 = p0x - baseE, x1 = p1x - baseE, y0 = p0y - baseF, y1 = p1y - baseF;
      const fl = x1 < x0;
      let tile = false;
      if (!sx && !sy && sw === 16 && sh === 16 && w === 16 && hh === 16 && tileSet.has(img)) {
        tile = true; firstTile = true;
      }
      if (!camSet) { camSet = true; camE = baseE; camF = baseF; }
      ops.push({ k: 's', img: img, sw: sw, sh: sh,
        x: fl ? x1 : x0, y: y0 < y1 ? y0 : y1, w: x1 > x0 ? x1 - x0 : x0 - x1,
        h: y1 > y0 ? y1 - y0 : y0 - y1, fl: fl, a: alpha, tile: tile,
        z: tile ? 0 : (firstTile ? K.Z_POP : K.Z_BACK) });
    };
    const bound = {};
    const handler = {
      get: function (t, name) {
        if (api[name]) return api[name];
        if (name === 'fillStyle' || name === 'globalAlpha' || name === 'imageSmoothingEnabled') return store[name];
        let v = Reflect.get(real, name);
        if (typeof v === 'function') {
          let b2 = bound[name];
          if (!b2) { b2 = v.bind(real); bound[name] = b2; }
          return b2;
        }
        return v;
      },
      set: function (t, name, v) {
        if (name === 'fillStyle') { fill = v; store.fillStyle = v; if (!R3D.pop) real.fillStyle = v; return true; }
        if (name === 'globalAlpha') { alpha = v; store.globalAlpha = v; if (!R3D.pop) real.globalAlpha = v; return true; }
        if (name === 'imageSmoothingEnabled') { store.imageSmoothingEnabled = v; if (!R3D.pop) real.imageSmoothingEnabled = v; return true; }
        return Reflect.set(real, name, v);   // custom props (ctx.playerCenterX) land on the backing ctx
      }
    };
    return new Proxy(store, handler);
  };

  /* ---------- three.js replay ---------- */
  const idOf = new WeakMap();
  const texOf = new WeakMap();
  let idN = 0;
  function cid(cv) { let k = idOf.get(cv); if (k) return k; idOf.set(cv, ++idN); return idN; }
  function geoS(w, h) {
    const key = 'g' + w + '_' + h;
    let g = geoOf.get(key);
    if (!g) { g = new THREE.PlaneGeometry(w / U, h / U); geoOf.set(key, g); }
    return g;
  }
  const geoOf = new Map();
  function geoSub(cv, w, h, sw, sh) {
    const key = w + '_' + h + '_' + sw + '_' + sh + '_' + cid(cv);
    let g = geoOf.get(key);
    if (!g) {
      g = new THREE.PlaneGeometry(w / U, h / U);
      const au = g.attributes.uv.array;
      const ru = sw / cv.width, rv = sh / cv.height;
      for (let q = 0; q < au.length; q += 2) { au[q] *= ru; au[q + 1] = (1 - rv) + au[q + 1] * rv; }
      geoOf.set(key, g);
    }
    return g;
  }
  function sprMat(cv, sw, sh, a) {
    const key = cid(cv) + '|' + sw + '|' + sh + '|' + Math.round(a * 8);
    let mat = matOf.get(key);
    if (!mat) {
      let tex = texOf.get(cv);
      if (!tex) {
        tex = new THREE.CanvasTexture(cv);
        tex.magFilter = tex.minFilter = THREE.NearestFilter;
        texOf.set(cv, tex);
      }
      mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: Math.min(1, a),
        depthTest: false, side: THREE.DoubleSide
      });
      matOf.set(key, mat);
    }
    return mat;
  }
  const matOf = new Map();
  function fillMat(str, a) {
    const key = str + '|' + Math.round(a * 8);
    let mat = matOf.get(key);
    if (!mat) {
      const p = parseFill(str);
      mat = new THREE.MeshBasicMaterial({
        color: p[0], transparent: true, opacity: p[1] * Math.min(1, a), depthTest: false
      });
      matOf.set(key, mat);
    }
    return mat;
  }
  const colOf = new Map();
  function parseFill(str) {
    let p = colOf.get(str);
    if (!p) {
      const m = /rgba\(([^)]+)\)/.exec(str);
      if (m) {
        const n = m[1].split(',');
        p = [new THREE.Color('rgb(' + n[0] + ',' + n[1] + ',' + n[2] + ')'), parseFloat(n[3]) / 255];
      } else p = [new THREE.Color(str), 1];
      colOf.set(str, p);
    }
    return p;
  }
  function avgPix(cv, y0, y1) {
    const d = cv.getContext('2d').getImageData(0, y0, cv.width, y1 - y0).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let q = 0; q < d.length; q += 4)
      if (d[q + 3] > 127) { r += d[q]; g += d[q + 1]; b += d[q + 2]; n++; }
    return n ? [r / n / 255, g / n / 255, b / n / 255] : null;
  }
  const topOf = new WeakMap();
  function topMat(cv) {
    const key = 't' + cid(cv);
    let mat = matOf.get(key);
    if (!mat) {
      let c = topOf.get(cv);
      if (!c) {
        const a = avgPix(cv, 0, Math.min(3, cv.height));
        c = a ? new THREE.Color(a[0], a[1], a[2]) : new THREE.Color(0.66, 0.69, 0.74);
        c.lerp(new THREE.Color(1, 1, 1), 0.18);   // sunlit top face: top edge average, nudged bright
        topOf.set(cv, c);
      }
      mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false });
      matOf.set(key, mat);
    }
    return mat;
  }
  const sideOf = new WeakMap();
  function sideMat(cv) {
    const key = 's' + cid(cv);
    let mat = matOf.get(key);
    if (!mat) {
      let c = sideOf.get(cv);
      if (!c) {
        const a = avgPix(cv, 0, cv.height);
        c = a ? new THREE.Color(a[0] * 0.5, a[1] * 0.55, a[2] * 0.72)
          : new THREE.Color(0.3, 0.34, 0.46);      // shaded sides: cool-leaning, so prisms read solid
        sideOf.set(cv, c);
      }
      mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false });
      matOf.set(key, mat);
    }
    return mat;
  }
  const skyOf = new Map();
  function rgbStr(c) {
    return 'rgb(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ')';
  }
  function skyMat(str) {
    let m = skyOf.get(str);
    if (!m) {
      const c = parseFill(str)[0];
      const top = c.clone().multiplyScalar(0.68);
      const mid = c.clone();
      const bot = c.clone().lerp(new THREE.Color(1, 1, 1), 0.26);
      const cvg = document.createElement('canvas');
      cvg.width = 4; cvg.height = 128;
      const cx = cvg.getContext('2d');
      const gr = cx.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, rgbStr(top));
      gr.addColorStop(0.45, rgbStr(mid));
      gr.addColorStop(1, rgbStr(bot));
      cx.fillStyle = gr;
      cx.fillRect(0, 0, 4, 128);
      const tex = new THREE.CanvasTexture(cvg);
      m = new THREE.MeshBasicMaterial({ map: tex, depthTest: false });
      skyOf.set(str, m);
    }
    return m;
  }
  function quad(geo, mat, cx, cy, cz, sx, sy, rx, ry, ord) {
    let qd = pool[poolN];
    if (!qd) { qd = new THREE.Mesh(unitGeo, unitMat); pool.push(qd); scene.add(qd); }
    poolN++;
    qd.geometry = geo; qd.material = mat;
    qd.position.set(cx, cy, cz);
    qd.rotation.set(rx, ry, 0);
    qd.scale.set(sx, sy, 1);
    qd.renderOrder = ord;
    qd.visible = true;
  }
  function updateCam() {
    const kx = C.VIEW_W / 2 - camE, ky = C.VIEW_H / 2 - camF;
    cam.position.set(kx / U, -ky / U, dist);
    cam.aspect = C.VIEW_W / C.VIEW_H;
    cam.updateProjectionMatrix();
    tSway++;
    const yaw = Math.sin(tSway * K.SWAY_T) * K.SWAY_Y +
      (R3D.fx === null ? 0 : clampX((R3D.fx - kx) / C.VIEW_W, -0.5, 0.5) * K.FOCUS_Y);
    const pit = K.PITCH + Math.sin(tSway * K.SWAY_T * 0.61 + 2) * K.SWAY_P -
      (R3D.fy === null ? 0 : clampX((R3D.fy - ky) / C.VIEW_H, -0.4, 0.4) * K.FOCUS_P);
    cam.rotation.set(pit, yaw, 0);
  }
  let skyLast = null;
  R3D.end = function (octx) {
    // the world fills don't reach the overlay anymore, so each world frame
    // starts by wiping stale card/HUD pixels (flat mode relies on this too)
    octx.clearRect(0, 0, C.VIEW_W, C.VIEW_H);
    if (!R3D.pop) return;
    if (!ensureGL()) { R3D.pop = false; R3D.setMode(); return; }
    updateCam();
    if (sky !== null) skyLast = sky;
    poolN = 0;
    let ro = 1;
    if (skyLast !== null) {
      rend.setClearColor(parseFill(skyLast)[0]);   // base tone still backs everything
      const hz = (dist - K.SKY_Z) * Math.tan(K.FOV * Math.PI / 360) * 2.1;
      quad(unitGeo, skyMat(skyLast), cam.position.x, cam.position.y, K.SKY_Z,
        hz * cam.aspect, hz, 0, 0, 0);             // far gradient sky, painted first
    }
    // this frame's tile occupancy: interior side faces are hidden by neighbours,
    // so only true silhouette edges get sides (keeps the block read clean)
    const grid = {};
    for (let q = 0; q < ops.length; q++) {
      const op = ops[q];
      if (op.k === 's' && op.tile) grid[op.x / U + ',' + Math.round(op.y / U)] = true;
    }
    for (let q = 0; q < ops.length; q++) {
      const op = ops[q];
      if (op.k === 'wash') {
        octx.globalAlpha = op.a; octx.fillStyle = op.fill; octx.fillRect(op.x, op.y, op.w, op.h);
        octx.globalAlpha = 1;
        continue;
      }
      if (op.k === 'r') {
        quad(geoS(op.w, op.h), fillMat(op.fill, op.a),
          (op.x + op.w / 2) / U, -(op.y + op.h / 2) / U, op.z, 1, 1, 0, 0, ro++);
        continue;
      }
      if (op.tile) {   // prism: lit top, shaded silhouette sides, then the textured front
        const cz = -K.Z_EXTRUDE / 2;
        const cy = -(op.y + op.h / 2) / U;
        const col = op.x / U, row = Math.round(op.y / U);
        quad(unitGeo, topMat(op.img), (op.x + op.w / 2) / U, -op.y / U, cz,
          op.w / U, K.Z_EXTRUDE, -Math.PI / 2, 0, ro++);
        if (!grid[(col - 1) + ',' + row])
          quad(unitGeo, sideMat(op.img), op.x / U, cy, cz, K.Z_EXTRUDE, op.h / U, 0, -Math.PI / 2, ro++);
        if (!grid[(col + 1) + ',' + row])
          quad(unitGeo, sideMat(op.img), (op.x + op.w) / U, cy, cz, K.Z_EXTRUDE, op.h / U, 0, Math.PI / 2, ro++);
        quad(geoSub(op.img, 16, 16, op.sw, op.sh), sprMat(op.img, op.sw, op.sh, op.a),
          (op.x + op.w / 2) / U, -(op.y + op.h / 2) / U, 0, 1, 1, 0, 0, ro++);
        continue;
      }
      const s = op.z < 0 ? 1 - op.z / dist : 1;   // pushed-back decor keeps its apparent 2D size
      quad(geoSub(op.img, op.w, op.h, op.sw, op.sh), sprMat(op.img, op.sw, op.sh, op.a),
        (op.x + op.w / 2) / U, -(op.y + op.h / 2) / U, op.z, s, s, 0, op.fl ? Math.PI : 0, ro++);
    }
    for (let q = poolN; q < pool.length; q++) if (pool[q].visible) pool[q].visible = false;
    rend.render(scene, cam);
    octx.drawImage(vignette(C.VIEW_W, C.VIEW_H), 0, 0);   // soft frame shading under the HUD
    ops = [];
  };

  function refreshTiles() {
    const s = new WeakSet();
    const m = BROS.Sprites._map;
    for (const name in m)
      if (name.indexOf('tile_') === 0 || name.indexOf('pipe_') === 0 || name === 'pole_segment') s.add(m[name]);
    tileSet = s;
  }
  function ensureGL() {
    if (rend) return true;
    THREE = window.THREE;
    if (!THREE) return false;
    unitGeo = new THREE.PlaneGeometry(1, 1);
    unitMat = new THREE.MeshBasicMaterial({ visible: false });
    rend = new THREE.WebGLRenderer({ canvas: glCv, antialias: false });
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(K.FOV, 1, 0.1, 64);
    cam.rotation.order = 'YXZ';
    dist = (C.VIEW_H / 2 / U) / Math.tan(K.FOV * Math.PI / 360);
    cam.position.set(0, 0, dist);
    refreshTiles();
    R3D.info = rend.info;
    R3D.glCanvas = glCv;
    return true;
  }

  /* soft frame-edge shading, drawn over the world under the HUD (cached per size) */
  let vig = null, vigW = 0, vigH = 0;
  function vignette(W, H) {
    if (vigW === W && vigH === H) return vig;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.45,
      W / 2, H * 0.5, Math.hypot(W, H) * 0.66);
    gr.addColorStop(0, 'rgba(6, 10, 26, 0)');
    gr.addColorStop(1, 'rgba(6, 10, 26, 0.34)');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, W, H);
    vig = cv; vigW = W; vigH = H;
    return vig;
  }

  /* ---------- mode + DOM plumbing ---------- */
  R3D.boot = function (cv, want) {
    scr = cv;
    // #stage keeps the three canvases in one shared layout slot, so the overlay
    // and the GL canvas always sit exactly over the pixel canvas — no measuring
    const wrapEl = document.getElementById('wrap');
    const stage = document.createElement('div');
    stage.id = 'stage';
    wrapEl.insertBefore(stage, cv);
    stage.appendChild(cv);
    glCv = document.createElement('canvas');
    glCv.id = 'gl';
    stage.appendChild(glCv);
    ovCv = document.createElement('canvas');
    ovCv.id = 'overlay';
    stage.appendChild(ovCv);
    ovCtx = ovCv.getContext('2d');
    ovCtx.imageSmoothingEnabled = false;
    if (want && window.THREE) { R3D.pop = true; R3D.applyDom(); }
    return ovCtx;
  };
  R3D.applyDom = function () {
    if (R3D.pop) { scr.classList.add('pop'); glCv.classList.add('show'); }
    else { scr.classList.remove('pop'); glCv.classList.remove('show'); }
  };
  R3D.setMode = function () {
    R3D.applyDom();
    R3D.resize(scr);
  };
  R3D.resize = function (cv) {
    ovCv.width = cv.width; ovCv.height = cv.height;
    glCv.width = cv.width; glCv.height = cv.height;
    ovCv.style.width = cv.style.width; ovCv.style.height = cv.style.height;
    glCv.style.width = cv.style.width; glCv.style.height = cv.style.height;
    if (rend) rend.setSize(cv.width, cv.height, false);
  };
  R3D.toggle = function () { R3D.pop = !R3D.pop; R3D.setMode(); };
})();
