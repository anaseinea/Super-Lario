// PLAN: docs/plan/04-input-system.md
(function () {
  'use strict';
  const BROS = window.BROS;

  const ACTIONS = ['left', 'right', 'down', 'jump', 'run', 'start', 'pause', 'mute'];
  const CODE_TO_ACTION = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyW: 'jump', ArrowUp: 'jump',
    KeyX: 'run', ShiftLeft: 'run', ShiftRight: 'run',
    Enter: 'start', NumpadEnter: 'start',
    KeyP: 'pause', KeyM: 'mute'
  };

  let keyHeld = mkHeld();
  let virtualHeld = mkHeld();
  let prevHeld = mkHeld();
  let held = mkHeld();
  let justPressed = mkHeld();
  let justReleased = mkHeld();
  let jumpBuf = 99;
  let attached = false;

  function mkHeld() {
    const o = Object.create(null);
    for (const a of ACTIONS) o[a] = false;
    return o;
  }
  function setVirtual(action, v) { virtualHeld[action] = !!v; }

  function makeBtn(container, id, label, action) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      setVirtual(action, true);
    });
    const off = function (e) { e.preventDefault(); setVirtual(action, false); };
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    container.appendChild(b);
  }

  BROS.Input = {
    attach: function () {
      if (attached) return;
      attached = true;
      window.addEventListener('keydown', function (e) {
        const a = CODE_TO_ACTION[e.code];
        if (!a) return;
        if (CODE_TO_ACTION.hasOwnProperty(e.code)) e.preventDefault();
        if (e.repeat) return;
        keyHeld[a] = true;
        if (a === 'mute' && BROS.Audio && BROS.Audio.toggleMute) BROS.Audio.toggleMute();
      });
      window.addEventListener('keyup', function (e) {
        const a = CODE_TO_ACTION[e.code];
        if (a) keyHeld[a] = false;
      });
      window.addEventListener('blur', function () { keyHeld = mkHeld(); });
    },

    buildTouch: function (container) {
      const left = document.createElement('div');
      left.className = 'cluster';
      const right = document.createElement('div');
      right.className = 'cluster';
      makeBtn(left, 'btn-left', '\u25C0', 'left');
      makeBtn(left, 'btn-down', '\u25BC', 'down');
      makeBtn(left, 'btn-right', '\u25B6', 'right');
      makeBtn(right, 'btn-run', 'B', 'run');
      makeBtn(right, 'btn-jump', 'A', 'jump');
      container.appendChild(left);
      container.appendChild(right);
    },

    update: function () {
      for (const a of ACTIONS) {
        const h = keyHeld[a] || virtualHeld[a];
        held[a] = h;
        justPressed[a] = h && !prevHeld[a];
        justReleased[a] = !h && prevHeld[a];
        prevHeld[a] = h;
      }
      if (justPressed.jump) jumpBuf = 0;
      else jumpBuf = Math.min(jumpBuf + 1, 99);
    },

    down: function (a) { return !!held[a]; },
    pressed: function (a) { return !!justPressed[a]; },
    released: function (a) { return !!justReleased[a]; },
    consume: function (a) {
      if (justPressed[a]) { justPressed[a] = false; return true; }
      return false;
    },
    clear: function () {
      keyHeld = mkHeld();
      virtualHeld = mkHeld();
      prevHeld = mkHeld();
      held = mkHeld();
      justPressed = mkHeld();
      justReleased = mkHeld();
      jumpBuf = 99;
    },
    anyPressed: function () { return ACTIONS.some(function (a) { return justPressed[a]; }); },
    jumpBufferFrames: function () { return jumpBuf; }
  };
})();
