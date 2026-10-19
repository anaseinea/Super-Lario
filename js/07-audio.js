// PLAN: docs/plan/07-audio-system.md
// WebAudio only: every sound is synthesized. No samples, no external files.
// Two busses (music / sfx). SFX are short recipes; music is a 16th-note
// step sequencer fed by compact bar strings written in note tokens.
(function () {
  'use strict';
  const BROS = window.BROS;
  const C = BROS.C;

  const A = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    muted: false, paused: false, ready: false,
    _noiseBuf: null, _active: 0, MAX_VOICES: 18
  };

  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  A.ensure = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { A.ctx = new AC(); } catch (e) { console.warn('audio unavailable: ' + e.message); return false; }
    A.master = A.ctx.createGain();
    A.master.gain.value = A.muted ? 0 : C.MASTER_GAIN;
    A.master.connect(A.ctx.destination);
    A.musicGain = A.ctx.createGain();
    A.musicGain.gain.value = C.MUSIC_GAIN;
    A.musicGain.connect(A.master);
    A.sfxGain = A.ctx.createGain();
    A.sfxGain.gain.value = C.SFX_GAIN;
    A.sfxGain.connect(A.master);

    // one reusable noise buffer (white + a touch of pink shaping)
    const len = Math.floor(A.ctx.sampleRate * 1.2);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.72 * last + 0.28 * white;
      d[i] = white * 0.55 + last * 0.75;
    }
    A._noiseBuf = buf;
    A.ready = true;
    return true;
  };

  A.unlock = function () {
    if (!A.ctx) return A.ensure();
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return true;
  };

  A.toggleMute = function () {
    A.muted = !A.muted;
    if (A.master) A.master.gain.value = A.muted ? 0 : C.MASTER_GAIN;
    return A.muted;
  };
  A.setPaused = function (p) {
    A.paused = p;
    if (!A.ctx) return;
    const g = A.musicGain.gain;
    g.cancelScheduledValues(A.ctx.currentTime);
    g.setValueAtTime(p ? 0.0001 : C.MUSIC_GAIN, A.ctx.currentTime);
    g.linearRampToValueAtTime(p ? 0.0001 : C.MUSIC_GAIN, A.ctx.currentTime + 0.12);
  };

  // ---------- voices ----------
  // Music notes are scheduled a bit ahead of the clock, so they get their own
  // headroom: gameplay SFX must never be starved by the sequencer.
  function claim(isMusic) {
    if (!A.ready) return false;
    const cap = (C.MAX_VOICES || 18) + (isMusic ? 10 : 0);
    if (A._active >= cap) return false;
    A._active++;
    return true;
  }
  function release(node) {
    if (!node) return;
    node.onended = function () { A._active = Math.max(0, A._active - 1); };
  }

  // One enveloped oscillator (optionally a second, slightly detuned voice).
  function tone(freq, t0, dur, type, vol, dest, opts) {
    opts = opts || {};
    if (!claim(!!opts.music)) return null;
    const ctx = A.ctx;
    const g = ctx.createGain();
    const a = Math.min(opts.attack === undefined ? 0.006 : opts.attack, dur * 0.6);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
    if (opts.sustain) {
      g.gain.setValueAtTime(Math.max(0.0002, vol), t0 + dur * 0.7);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(dest || A.sfxGain);

    const oscs = [];
    const mk = (det) => {
      const o = ctx.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + dur * (opts.slideAt || 1));
      if (opts.slideFrom) {
        o.frequency.cancelScheduledValues(t0);
        o.frequency.setValueAtTime(Math.max(20, opts.slideFrom), t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, freq), t0 + dur * (opts.slideAt || 1));
      }
      if (det) o.detune.value = det;
      o.connect(g);
      oscs.push(o);
      return o;
    };
    mk(0);
    if (opts.fat) mk(opts.fat);
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opts.vibrato.rate || 6;
      lg.gain.value = opts.vibrato.depth || 12;
      lfo.connect(lg); lg.connect(oscs[0].frequency);
      lfo.start(t0); lfo.stop(t0 + dur);
    }
    for (const o of oscs) { o.start(t0); o.stop(t0 + dur + 0.02); }
    release(oscs[0]);
    return oscs[0];
  }

  // Noise voice with an optional band-pass sweep (thumps, skids, bursts).
  function noise(t0, dur, vol, dest, opts) {
    opts = opts || {};
    if (!claim(!!opts.music)) return null;
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.buffer = A._noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.hp ? 'highpass' : (opts.lp ? 'lowpass' : 'bandpass');
    f.frequency.setValueAtTime(opts.freq || 900, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, opts.freqTo), t0 + dur);
    f.Q.value = opts.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.01, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || A.sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
    release(src);
    return src;
  }

  // quick arpeggio helper used by pickups and flourishes
  function arp(midis, t0, step, dur, type, vol, dest) {
    for (let i = 0; i < midis.length; i++) {
      tone(midiHz(midis[i]), t0 + i * step, dur, type || 'square', vol, dest);
    }
  }

  // ---------------- SFX recipes ----------------
  const SFX = {
    jump(t) { tone(300, t, 0.16, 'square', 0.30, null, { slideTo: 660 }); },
    bigjump(t) { tone(240, t, 0.22, 'square', 0.34, null, { slideTo: 700, fat: 7 }); },
    stomp(t) {
      noise(t, 0.10, 0.42, null, { lp: 1, freq: 420, freqTo: 120 });
      tone(180, t, 0.12, 'triangle', 0.40, null, { slideTo: 70 });
      tone(520, t + 0.02, 0.07, 'square', 0.18, null, { slideTo: 240 });
    },
    bump(t) { tone(210, t, 0.07, 'square', 0.30, null, { slideTo: 120 }); },
    bonbon(t) { tone(midiHz(79), t, 0.07, 'square', 0.26); tone(midiHz(84), t + 0.06, 0.12, 'square', 0.24); },
    powerup(t) { arp([67, 71, 74, 79], t, 0.055, 0.16, 'square', 0.26); },
    powerdown(t) { arp([74, 71, 67], t, 0.06, 0.16, 'triangle', 0.26); },
    oneup(t) { arp([72, 76, 79, 84, 88], t, 0.075, 0.30, 'triangle', 0.30); },
    hurt(t) { tone(430, t, 0.26, 'sawtooth', 0.30, null, { slideTo: 110, fat: -9 }); },
    die(t) {
      arp([79, 75, 72, 68, 65], t, 0.09, 0.22, 'square', 0.26);
      noise(t + 0.36, 0.30, 0.20, null, { lp: 1, freq: 700, freqTo: 90 });
    },
    fireball(t) { noise(t, 0.10, 0.26, null, { freq: 1600, freqTo: 400, q: 2 }); tone(880, t, 0.09, 'square', 0.16, null, { slideTo: 320 }); },
    shellkick(t) { noise(t, 0.08, 0.36, null, { freq: 1200, freqTo: 300 }); tone(160, t, 0.10, 'square', 0.32, null, { slideTo: 420 }); },
    pop(t) { tone(700, t, 0.10, 'square', 0.24, null, { slideTo: 1400 }); },
    inflate(t) { tone(220, t, 0.35, 'sine', 0.30, null, { slideTo: 760 }); noise(t, 0.20, 0.08, null, { freq: 2400, freqTo: 5000 }); },
    deflate(t) { tone(760, t, 0.35, 'sine', 0.26, null, { slideTo: 200 }); },
    spike(t) { tone(1200, t, 0.22, 'sawtooth', 0.28, null, { slideTo: 90 }); noise(t, 0.18, 0.22, null, { freq: 2600, freqTo: 400 }); },
    trampoline(t) { tone(300, t, 0.20, 'sine', 0.34, null, { slideTo: 980 }); tone(150, t, 0.20, 'triangle', 0.20, null, { slideTo: 500 }); },
    flagpole(t) { arp([88, 86, 84, 82, 80, 78, 76, 74], t, 0.055, 0.16, 'triangle', 0.24); },
    fireworks(t) { noise(t, 0.14, 0.30, null, { freq: 3000, freqTo: 400, q: 0.7 }); tone(1400, t, 0.10, 'square', 0.14, null, { slideTo: 300 }); },
    gate(t) { arp([60, 64, 67, 72], t, 0.07, 0.5, 'sawtooth', 0.22); noise(t, 0.28, 0.16, null, { lp: 1, freq: 500, freqTo: 120 }); },
    tick(t) { tone(1600, t, 0.05, 'square', 0.18); },
    warn(t) { tone(1100, t, 0.09, 'square', 0.24); tone(1100, t + 0.12, 0.09, 'square', 0.24); },
    blipup(t) { tone(660, t, 0.06, 'square', 0.22, null, { slideTo: 990 }); },
    blipdown(t) { tone(660, t, 0.06, 'square', 0.22, null, { slideTo: 440 }); },
    pause(t) { tone(880, t, 0.05, 'square', 0.20); tone(1320, t + 0.05, 0.07, 'square', 0.20); },
    victory(t) { arp([72, 76, 79, 84], t, 0.09, 0.5, 'square', 0.26); }
  };

  A.sfx = function (name, opts) {
    if (!A.ready || A.muted) return;
    const r = SFX[name];
    if (!r) { console.warn('A.sfx: unknown sound "' + name + '"'); return; }
    const t = A.ctx.currentTime + 0.005 + ((opts && opts.delay) || 0);
    try { r(t, opts || {}); } catch (e) { console.warn('A.sfx ' + name + ': ' + e.message); }
  };

  // ---------------- music sequencer ----------------
  // A bar is 16 space-separated tokens: "c4" play, "," hold previous, "." rest,
  // "k" kick, "s" snare, "h" hat. Notes are scientific pitch, accidentals allowed.
  const NOTE_RE = /^([a-g])([#b]?)([0-9])$/;
  const LETTER = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function tokenMidi(tok) {
    const m = NOTE_RE.exec(tok);
    if (!m) return null;
    let semi = LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 12 * (parseInt(m[3], 10) + 1) + semi;
  }

  function compileTrack(def) {
    const evs = [];
    def.lines.forEach(function (line, barIndex) {
      const toks = line.trim().split(/\s+/);
      if (toks.length > 16) console.warn('music bar ' + barIndex + ' has ' + toks.length + ' tokens (truncated)');
      for (let i = 0; i < 16; i++) {
        const tok = toks[i] === undefined ? '.' : toks[i];
        const step = barIndex * 16 + i;
        if (tok === '.' || tok === ',') continue;
        if (tok === 'k' || tok === 's' || tok === 'h') { evs.push({ step: step, drum: tok }); continue; }
        const midi = tokenMidi(tok);
        if (midi === null) { console.warn('music: bad token "' + tok + '"'); continue; }
        let hold = 1;
        while (toks[i + hold] === ',') hold++;
        evs.push({ step: step, midi: midi, hold: hold });
      }
    });
    return evs;
  }

  const TRACKS = {
    main: {
      bpm: 148, oneShot: false, loopBars: 0,
      parts: [
        { type: 'square', vol: 0.34, fat: 8, lines: [
          'c4 .  e4 .  g4 .  ,   .  e4 .  c4 .  ,   .  .',
          'a4 .  c5 .  e5 .  ,   .  c5 .  a4 .  e4 .  ,   .',
          'f4 .  a4 .  c5 .  ,   .  a4 .  f4 .  d4 .  ,   .',
          'g4 .  b4 .  d5 .  ,   .  b4 .  g4 .  ,   .  .',
          'c5 .  b4 .  g4 .  e4 .  c4 .  e4 .  g4 .  ,   .',
          'a4 .  f4 .  d4 .  ,   .  e4 .  g4 .  b4 .  ,   .',
          'c5 .  ,   .  a4 .  f4 .  ,   .  d4 .  b4 .  g4 .',
          'c5 .  b4 .  a4 .  g4 .  ,   .  .   .  c4 .  ,   .'
        ] },
        { type: 'triangle', vol: 0.44, lines: [
          'c3 .  .   .  g3 .  .   .  c3 .  .   .  g3 .  .   .',
          'a2 .  .   .  e3 .  .   .  a2 .  .   .  e3 .  .   .',
          'f2 .  .   .  c3 .  .   .  f2 .  .   .  c3 .  .   .',
          'g2 .  .   .  d3 .  .   .  g2 .  .   .  d3 .  .   .',
          'c3 .  .   .  g3 .  .   .  c3 .  .   .  g3 .  .   .',
          'f2 .  .   .  c3 .  .   .  g2 .  .   .  d3 .  .   .',
          'a2 .  .   .  e3 .  .   .  f2 .  .   .  c3 .  .   .',
          'c3 .  .   .  g3 .  .   .  c3 .  .   .  g2 .  .   .'
        ] },
        { type: 'drum', vol: 0.30, lines: [
          'k  .  .   h  s  .  .   h  k  .  .   h  s  .  h   .',
          'k  .  .   h  s  .  .   h  k  .  .   h  s  .  h   .',
          'k  .  .   h  s  .  .   h  k  .  .   h  s  .  h   .',
          'k  .  .   h  s  .  .   h  k  .  h   s  .  s  .   .',
          'k  .  .   h  s  .  .   h  k  .  .   h  s  .  h   .',
          'k  .  .   h  s  .  .   h  k  .  .   h  s  .  h   .',
          'k  .  .   h  s  .  .   h  k  .  .   h  s  .  h   .',
          'k  .  .   h  s  .  .   h  k  .  h   s  .  s  s   .'
        ] }
      ]
    },

    cave: {
      bpm: 96, oneShot: false, loopBars: 0, echo: [0.31, 0.34],
      parts: [
        { type: 'square', vol: 0.24, lines: [
          'a4 .  .   .  c5 .  .   .  e5 ,  .   .  .  c5 .  .',
          'd5 .  .   .  c5 .  .   .  a4 ,  .   .  .  e4 .  .',
          'f4 .  .   .  a4 .  .   .  c5 ,  .   .  .  a4 .  .',
          'e5 .  .   .  b4 .  .   .  g4 ,  .   .  .  e4 .  .',
          'a4 .  .   .  c5 .  .   .  e5 ,  .   .  .  g5 .  .',
          'f5 .  .   .  e5 .  .   .  c5 ,  .   .  .  a4 .  .',
          'd5 .  .   .  b4 .  .   .  g4 ,  .   .  .  e4 .  .',
          'a4 ,  .   .  .   .  .   .  e4 ,  .   .  .  .   .'
        ] },
        { type: 'triangle', vol: 0.40, lines: [
          'a2 .  .   .  .   .  .   .  a2 .  .   .  e3 .  .   .',
          'a2 .  .   .  .   .  .   .  e3 .  .   .  g3 .  .   .',
          'f2 .  .   .  .   .  .   .  f2 .  .   .  c3 .  .   .',
          'e2 .  .   .  .   .  .   .  e3 .  .   .  b3 .  .   .',
          'a2 .  .   .  .   .  .   .  a2 .  .   .  e3 .  .   .',
          'f2 .  .   .  .   .  .   .  f2 .  .   .  c3 .  .   .',
          'd3 .  .   .  .   .  .   .  g2 .  .   .  b2 .  .   .',
          'a2 .  .   .  .   .  .   .  a2 ,  .   .  .   .   .'
        ] }
      ]
    },

    dusk: {
      bpm: 128, oneShot: false, loopBars: 0, echo: [0.23, 0.22],
      parts: [
        { type: 'sawtooth', vol: 0.22, fat: -11, lines: [
          'd4 .  a4 .  d5 .  .   c5 .  a4 .  .   f4 .  a4 .',
          'c5 .  g4 .  c5 .  .   b4 .  g4 .  .   e4 .  g4 .',
          'a4 .  e4 .  a4 .  .   g4 .  e4 .  .   c4 .  e4 .',
          'd5 ,  .   .  b4 .  g4 .  .   e4 .  g4 .  b4 .  .',
          'd5 .  c5 .  a4 .  f4 .  d4 .  f4 .  a4 .  ,   .',
          'g4 .  e4 .  c4 .  ,   .  e4 .  g4 .  b4 .  ,   .',
          'a4 .  c5 .  e5 .  ,   .  c5 .  a4 .  f4 .  ,   .',
          'd5 .  b4 .  a4 .  g4 .  ,   .  .   .  d4 ,  .   .'
        ] },
        { type: 'square', vol: 0.26, lines: [
          'd2 .  .   d3 .  .   a2 .  .   d3 .  .   f3 .  .   .',
          'g2 .  .   g3 .  .   d3 .  .   g3 .  .   b3 .  .   .',
          'a2 .  .   a3 .  .   e3 .  .   a3 .  .   c4 .  .   .',
          'd3 .  .   .   .  b2 .  .   .  g2 .  .   b2 .  .   .',
          'd3 .  .   d3 .  .   a2 .  .   f2 .  .   a2 .  .   .',
          'g2 .  .   g3 .  .   d3 .  .   b2 .  .   d3 .  .   .',
          'a2 .  .   a3 .  .   e3 .  .   c3 .  .   e3 .  .   .',
          'd3 .  .   .   .  a2 .  .   .  d3 ,  .   .   .   .'
        ] },
        { type: 'drum', vol: 0.22, lines: [
          'k  .  .   .  s  .  .   h  .  .  k  .  s  .  .   h',
          'k  .  .   .  s  .  .   h  .  .  k  .  s  .  h   .',
          'k  .  .   .  s  .  .   h  .  .  k  .  s  .  .   h',
          'k  .  .   h  s  .  .   .  k  .  .   h  s  .  s   .',
          'k  .  .   .  s  .  .   h  .  .  k  .  s  .  .   h',
          'k  .  .   .  s  .  .   h  .  .  k  .  s  .  h   .',
          'k  .  .   .  s  .  .   h  .  .  k  .  s  .  .   h',
          'k  .  .   h  s  .  .   .  k  .  .   h  s  .  s   s'
        ] }
      ]
    },

    clear: {
      bpm: 140, oneShot: true,
      parts: [
        { type: 'square', vol: 0.34, fat: 6, lines: [
          'c5 .  e5 .  g5 .  c6 ,  .   .  .  g5 .  e5 .  .',
          'c6 ,  .   .  .   .  g5 .  e5 .  c5 ,  .   .  .  .',
          'a4 .  c5 .  e5 .  a5 ,  .   .  .  e5 .  c5 .  .',
          'd5 .  f5 .  a5 .  d6 ,  .   .  .  .   .  .   .'
        ] },
        { type: 'triangle', vol: 0.42, lines: [
          'c3 .  g3 .  c4 .  ,   .  .   .  g3 .  c4 .  .   .',
          'c3 .  g3 .  c4 ,  .   .   .  g3 .  c4 .  .   .   .',
          'a2 .  e3 .  a3 ,  .   .   .  e3 .  a3 .  .   .   .',
          'd3 .  a3 .  d4 ,  .   .   .  .   .  .   .  .   .'
        ] }
      ]
    },

    gameover: {
      bpm: 100, oneShot: true,
      parts: [
        { type: 'square', vol: 0.30, lines: [
          'a4 .  .   .  g4 .  .   .  f4 .  .   .  e4 .  .   .',
          'd4 .  .   .  c4 .  .   .  a3 ,  .   .  .   .   .',
          'e4 .  .   .  a4 .  .   .  c5 ,  .   .  b4 .  .   .',
          'a4 ,  .   .  .   .  .   .  e4 .  .   .  .   .   .'
        ] },
        { type: 'triangle', vol: 0.36, lines: [
          'a2 .  .   .  e3 .  .   .  a2 .  .   .  c3 .  .   .',
          'd3 .  .   .  g2 .  .   .  a2 ,  .   .  .   .   .',
          'c3 .  .   .  a2 .  .   .  e3 ,  .   .  g3 .  .   .',
          'a2 ,  .   .  .   .  .   .  a2 .  .   .  .   .   .'
        ] }
      ]
    },

    card: {
      bpm: 112, oneShot: true,
      parts: [
        { type: 'triangle', vol: 0.36, lines: [
          'e5 .  .   .  d5 .  .   .  c5 ,  .   .  .   .   .',
          'g4 .  .   .  c5 ,  .   .  e5 ,  .   .  .   .   .',
          'd5 .  .   .  b4 .  .   .  g4 ,  .   .  .   .   .',
          'c5 ,  .   .  .   .  .   .  g4 .  .   .  .   .   .'
        ] },
        { type: 'sine', vol: 0.26, lines: [
          'c3 .  .   .  g3 .  .   .  c4 ,  .   .  .   .   .',
          'e3 .  .   .  c4 ,  .   .  g3 ,  .   .  .   .   .',
          'b3 .  .   .  g3 .  .   .  e3 ,  .   .  .   .   .',
          'c4 ,  .   .  .   .  .   .  g3 .  .   .  .   .   .'
        ] }
      ]
    }
  };

  let seq = null;

  function buildEcho(delayTime, feedback) {
    const ctx = A.ctx;
    const d = ctx.createDelay(1.0);
    d.delayTime.value = delayTime;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    d.connect(fb); fb.connect(d);
    d.connect(wet); wet.connect(A.musicGain);
    return d;
  }

  // The sequencer schedules a small window ahead of the audio clock each tick
  // (WebAudio does the sample-accurate timing). Looping just restarts the cursor.
  A.playMusic = function (name) {
    if (!A.ready) A.ensure();
    if (!A.ready) return;
    A.stopMusic(0.08);
    const def = TRACKS[name];
    if (!def) { console.warn('A.playMusic: unknown track "' + name + '"'); return; }
    const stepDur = 60 / def.bpm / 4;
    const totalSteps = def.parts[0].lines.length * 16;
    const bus = A.ctx.createGain();
    bus.gain.value = 1;
    bus.connect(A.musicGain);
    const echoNode = def.echo ? buildEcho(def.echo[0], def.echo[1]) : null;
    if (echoNode) bus.connect(echoNode);

    const parts = def.parts.map(function (p) {
      const evs = compileTrack({ lines: p.lines });
      evs.sort(function (a, b) { return a.step - b.step; });
      return { part: p, evs: evs, ptr: 0 };
    });

    seq = {
      name: name, def: def, bus: bus, echoNode: echoNode, parts: parts,
      stepDur: stepDur, totalSteps: totalSteps,
      passStart: A.ctx.currentTime + 0.12, done: false
    };
    A.musicName = name;
  };

  function scheduleParts(seq, untilTime) {
    for (const entry of seq.parts) {
      const evs = entry.evs, part = entry.part;
      while (entry.ptr < evs.length) {
        const ev = evs[entry.ptr];
        const when = seq.passStart + ev.step * seq.stepDur;
        if (when > untilTime) break;
        if (when >= A.ctx.currentTime - 0.02) playEvent(ev, part, when, seq.bus);
        entry.ptr++;
      }
    }
  }

  function playEvent(ev, part, when, dest) {
    const stepDur = seq.stepDur;
    if (ev.drum) {
      if (part.type !== 'drum') return;
      if (ev.drum === 'k') tone(92, when, 0.14, 'sine', part.vol * 1.4, dest, { slideTo: 40, music: true });
      else if (ev.drum === 's') noise(when, 0.11, part.vol, dest, { freq: 1900, freqTo: 800, q: 0.8, music: true });
      else noise(when, 0.035, part.vol * 0.5, dest, { hp: 1, freq: 6500, music: true });
      return;
    }
    if (part.type === 'drum') return;
    const dur = Math.max(stepDur * ev.hold * 0.94, stepDur * 0.55);
    tone(midiHz(ev.midi), when, dur, part.type, part.vol, dest,
      { fat: part.fat, sustain: part.sustain !== false, music: true });
  }

  A.tickMusic = function () {
    A.tickCleanup();
    if (!A.ready || !seq) return;
    const now = A.ctx.currentTime;
    scheduleParts(seq, now + (C.MUSIC_LOOKAHEAD || 0.35));

    const ended = seq.passStart + seq.totalSteps * seq.stepDur;
    const exhausted = seq.parts.every(function (e) { return e.ptr >= e.evs.length; });
    if (seq.def.oneShot) {
      if (exhausted && now > ended + 0.35) {
        const dead = seq;
        seq = null;
        A.musicName = null;
        setTimeoutSafe(function () { try { dead.bus.disconnect(); } catch (e) {} }, 400);
      }
      return;
    }
    if (exhausted && now >= ended - 0.02) {
      seq.passStart = Math.max(ended, now + 0.02);
      for (const e of seq.parts) e.ptr = 0;
    }
  };

  A.musicDone = function () { return seq === null || seq.done === true; };
  A.currentMusic = function () { return seq ? seq.name : null; };

  A.stopMusic = function (fade) {
    if (!A.ready || !seq) { seq = null; return; }
    const t = A.ctx.currentTime;
    const f = fade === undefined ? 0.2 : fade;
    try {
      seq.bus.gain.cancelScheduledValues(t);
      seq.bus.gain.setValueAtTime(seq.bus.gain.value, t);
      seq.bus.gain.linearRampToValueAtTime(0.0001, t + f);
    } catch (e) { /* ignore */ }
    if (seq.echoNode) { try { seq.echoNode.disconnect(); } catch (e) {} }
    const dead = seq;
    setTimeoutSafe(function () { try { dead.bus.disconnect(); } catch (e) {} }, (f + 0.2) * 1000);
    seq = null;
    A.musicName = null;
  };

  // WebAudio-safe deferred cleanup (no dependency on timers for gameplay)
  const pendingCleanups = [];
  function setTimeoutSafe(fn, ms) { pendingCleanups.push({ fn: fn, at: (typeof performance !== 'undefined' ? performance.now() : Date.now()) + ms }); }
  A.tickCleanup = function () {
    if (!pendingCleanups.length) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    for (let i = pendingCleanups.length - 1; i >= 0; i--) {
      if (pendingCleanups[i].at <= now) { try { pendingCleanups[i].fn(); } catch (e) {} pendingCleanups.splice(i, 1); }
    }
  };

  BROS.Audio = A;
})();
