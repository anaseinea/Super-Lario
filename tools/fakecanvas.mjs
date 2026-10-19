// PLAN: docs/plan/17-testing-and-tuning.md
// A tiny software canvas good enough for Node self-tests of the procedural
// sprite builder (no node-canvas dependency, nothing to install).
import fs from 'node:fs';

function parseColor(str) {
  const s = String(str).trim();
  if (s[0] === '#') {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), 255];
    }
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
  }
  const named = { white: [255, 255, 255, 255], black: [0, 0, 0, 255], transparent: [0, 0, 0, 0] };
  return named[s] || [255, 0, 255, 255];
}

export class FakeCanvas {
  constructor() { this.width = 0; this.height = 0; this._data = null; this._ctx = null; }
  _ensure() {
    const n = this.width * this.height * 4;
    if (!this._data || this._data.length !== n) this._data = new Uint8ClampedArray(n);
  }
  getContext() {
    if (!this._ctx) this._ctx = new FakeContext(this);
    return this._ctx;
  }
  /** opaque (alpha>0) pixel count */
  inkCount() {
    this._ensure();
    let n = 0;
    for (let i = 3; i < this._data.length; i += 4) if (this._data[i] > 0) n++;
    return n;
  }
  get(x, y) {
    this._ensure();
    const i = (y * this.width + x) * 4;
    return [this._data[i], this._data[i + 1], this._data[i + 2], this._data[i + 3]];
  }
}

class FakeImageData {
  constructor(w, h) {
    this.width = w; this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
}

class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.globalCompositeOperation = 'source-over';
    this.font = '10px monospace';
    this.textBaseline = 'top';
    this._textLog = [];
  }
  createImageData(w, h) { this.canvas._ensure(); return new FakeImageData(w, h); }
  getImageData(x, y, w, h) {
    this.canvas._ensure();
    const out = new FakeImageData(w, h);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const si = ((y + yy) * this.canvas.width + (x + xx)) * 4;
        const di = (yy * w + xx) * 4;
        out.data[di] = this.canvas._data[si];
        out.data[di + 1] = this.canvas._data[si + 1];
        out.data[di + 2] = this.canvas._data[si + 2];
        out.data[di + 3] = this.canvas._data[si + 3];
      }
    }
    return out;
  }
  putImageData(img, x, y) {
    const c = this.canvas; c._ensure();
    for (let yy = 0; yy < img.height; yy++) {
      for (let xx = 0; xx < img.width; xx++) {
        const si = (yy * img.width + xx) * 4;
        if (img.data[si + 3] === 0) continue;
        const dx = x + xx, dy = y + yy;
        if (dx < 0 || dy < 0 || dx >= c.width || dy >= c.height) continue;
        const di = (dy * c.width + dx) * 4;
        c._data[di] = img.data[si];
        c._data[di + 1] = img.data[si + 1];
        c._data[di + 2] = img.data[si + 2];
        c._data[di + 3] = img.data[si + 3];
      }
    }
  }
  fillRect(x, y, w, h) {
    const c = this.canvas; c._ensure();
    const col = parseColor(this.fillStyle);
    const comp = this.globalCompositeOperation;
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
        if (xx < 0 || yy < 0 || xx >= c.width || yy >= c.height) continue;
        const i = (yy * c.width + xx) * 4;
        if (comp === 'source-atop') {
          if (c._data[i + 3] === 0) continue;      // only shade existing ink
          c._data[i] = col[0]; c._data[i + 1] = col[1]; c._data[i + 2] = col[2];
          continue;
        }
        if (comp === 'lighter') {
          c._data[i] = Math.min(255, c._data[i] + col[0]);
          c._data[i + 1] = Math.min(255, c._data[i + 1] + col[1]);
          c._data[i + 2] = Math.min(255, c._data[i + 2] + col[2]);
          c._data[i + 3] = 255;
          continue;
        }
        c._data[i] = col[0]; c._data[i + 1] = col[1]; c._data[i + 2] = col[2]; c._data[i + 3] = col[3];
      }
    }
  }
  clearRect(x, y, w, h) {
    const c = this.canvas; c._ensure();
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
        if (xx < 0 || yy < 0 || xx >= c.width || yy >= c.height) continue;
        const i = (yy * c.width + xx) * 4;
        c._data[i] = c._data[i + 1] = c._data[i + 2] = c._data[i + 3] = 0;
      }
    }
  }
  drawImage(src, dx, dy) {
    const c = this.canvas; c._ensure();
    const sw = src.width, sh = src.height;
    for (let yy = 0; yy < sh; yy++) {
      for (let xx = 0; xx < sw; xx++) {
        const si = (yy * sw + xx) * 4;
        if (src._data[si + 3] === 0) continue;
        const tx = Math.round(dx) + xx, ty = Math.round(dy) + yy;
        if (tx < 0 || ty < 0 || tx >= c.width || ty >= c.height) continue;
        const di = (ty * c.width + tx) * 4;
        c._data[di] = src._data[si];
        c._data[di + 1] = src._data[si + 1];
        c._data[di + 2] = src._data[si + 2];
        c._data[di + 3] = src._data[si + 3];
      }
    }
  }
  fillText(txt, x, y) { this._textLog.push([String(txt), x, y]); }
  measureText(txt) { return { width: String(txt).length * 6 }; }
}

/** Install a fake browser environment onto globalThis and return helpers. */
export function installFakeBrowser() {
  globalThis.window = globalThis;
  globalThis.document = {
    createElement(tag) {
      if (String(tag).toLowerCase() === 'canvas') return new FakeCanvas();
      return { style: {}, appendChild() {}, addEventListener() {} };
    }
  };
  return { FakeCanvas };
}

/** Load the classic scripts (js/NN-*.js) in order into the current globals. */
export function loadScripts(files) {
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    // indirect eval => global scope, exactly like a classic <script>
    (0, eval)(src + '\n//# sourceURL=' + f);
  }
}
