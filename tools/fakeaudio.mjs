// PLAN: docs/plan/17-testing-and-tuning.md
// Minimal AudioContext double so the music sequencer and SFX recipes can be
// exercised in Node (no sound output, but every WebAudio call is checked).
class Param {
  constructor(v) { this.value = v; this.events = []; }
  setValueAtTime(v, t) {
    if (!(t >= 0)) throw new Error('setValueAtTime needs a time, got ' + t);
    this.value = v; this.events.push(['set', v, t]); return this;
  }
  linearRampToValueAtTime(v, t) {
    if (!(t >= 0)) throw new Error('linearRamp needs a time, got ' + t);
    if (!(v > 0) && v !== 0) throw new Error('linearRamp target must be a number, got ' + v);
    this.events.push(['lin', v, t]); return this;
  }
  exponentialRampToValueAtTime(v, t) {
    if (!(t >= 0)) throw new Error('exponentialRamp needs a time, got ' + t);
    if (!(v > 0)) throw new Error('exponentialRampToValueAtTime target must be > 0, got ' + v);
    const prev = this.events.length ? this.events[this.events.length - 1][1] : this.value;
    if (!(prev > 0)) throw new Error('exponentialRamp needs a non-zero previous value');
    this.events.push(['exp', v, t]); return this;
  }
  cancelScheduledValues(t) { this.events.length = 0; return this; }
  cancelAndHoldAtTime(t) { return this.cancelScheduledValues(t); }
}

class Node {
  constructor(ctx) { this.ctx = ctx; this._outs = []; ctx._nodes++; }
  connect(target) { this._outs.push(target); return target; }
  disconnect() { this._outs.length = 0; }
}

class SourceNode extends Node {
  constructor(ctx) {
    super(ctx);
    this.onended = null; this._started = null; this._stopped = null; this._ended = false;
    ctx._sources.push(this);
  }
  start(t) { if (this._started !== null) throw new Error('source started twice'); this._started = t; }
  stop(t) { this._stopped = t; }
}

class OscNode extends SourceNode {
  constructor(ctx) {
    super(ctx);
    this.type = 'sine'; this.frequency = new Param(440); this.detune = new Param(0);
    ctx._oscs++;
  }
}
class BufferSourceNode extends SourceNode {
  constructor(ctx) { super(ctx); this.buffer = null; this.loop = false; ctx._srcs++; }
}
class GainNode extends Node {
  constructor(ctx) { super(ctx); this.gain = new Param(1); ctx._gains++; }
}
class BiquadNode extends Node {
  constructor(ctx) { super(ctx); this.type = 'lowpass'; this.frequency = new Param(350); this.Q = new Param(1); this.detune = new Param(0); }
}
class DelayNode extends Node {
  constructor(ctx, max) { super(ctx); this.maxDelayTime = max || 1; this.delayTime = new Param(0); ctx._delays++; }
}

export class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.state = 'running';
    this.destination = new Node(this);
    this._sources = [];
    this._nodes = 0; this._oscs = 0; this._srcs = 0; this._gains = 0; this._delays = 0;
  }
  createGain() { return new GainNode(this); }
  createOscillator() { return new OscNode(this); }
  createBufferSource() { return new BufferSourceNode(this); }
  createBiquadFilter() { return new BiquadNode(this); }
  createDelay(max) { return new DelayNode(this, max); }
  createBuffer(channels, length, rate) {
    const data = new Float32Array(length);
    return { numberOfChannels: channels, length: length, sampleRate: rate, duration: length / rate, getChannelData() { return data; } };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  /** move the clock forward and fire onended for finished sources */
  advance(dt) {
    this.currentTime += dt;
    for (const s of this._sources) {
      if (s._ended) continue;
      if (s._stopped !== null && s._stopped <= this.currentTime) {
        s._ended = true;
        if (s.onended) s.onended();
      }
    }
  }
  stats() {
    return { nodes: this._nodes, oscs: this._oscs, srcs: this._srcs, gains: this._gains, delays: this._delays, sources: this._sources.length };
  }
}

export function installFakeAudio() {
  globalThis.window = globalThis.window || globalThis;
  globalThis.window.AudioContext = FakeAudioContext;
  globalThis.window.webkitAudioContext = FakeAudioContext;
}
