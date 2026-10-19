# 04 — Input System (keyboard + touch)

Depends on: 02. Produces: `BROS.Input`. Consumed by: 11 (player), 14/15 (menus),
16 (glue). DOM allowed.

## Public API (exact)
```
BROS.Input.attach()            // bind keyboard listeners + create touch UI
BROS.Input.buildTouch(containerEl)
BROS.Input.update()            // called ONCE per frame before game update
BROS.Input.down(a)             // held this frame
BROS.Input.pressed(a)          // went down this frame
BROS.Input.released(a)         // went up this frame
BROS.Input.consume(a)          // true once if pressed (and clears press state)
BROS.Input.clear()             // wipe held+pressed (call on state changes!)
BROS.Input.anyPressed()
BROS.Input.jumpBufferFrames()  // frames since last jump press (99 if none)
```
Actions (fixed names): `left right down jump run start pause mute`.

## Key map
- left: ArrowLeft / KeyA · right: ArrowRight / KeyD · down: ArrowDown / KeyS
- jump: Space / KeyZ / KeyW / ArrowUp
- run: KeyX / ShiftLeft / ShiftRight
- start: Enter / NumpadEnter
- pause: KeyP · mute: KeyM
Ignore repeats (`e.repeat`). preventDefault for game keys.

## Rules
- `update()` shifts prev-frame state; `pressed/released` derived. Presses are
  buffered: jump press sets a countdown buffer (`jumpBufferFrames`) so late
  landings still jump (see COYOTE handling in step 11 — Player reads Input).
- Menu safety: game states call `Input.clear()` when entering a new state;
  screens use `consume('start')` or `consume('jump')` after a 30-frame lockout
  owned by Game (Game counts, not Input).
- `mute` press toggles `BROS.Audio.toggleMute()` if Audio exists.
- Touch: container gets a left cluster (◀ ▼ ▶) and right cluster (A=jump,
  B=run); buttons set virtual held-state on pointerdown/up/cancel/leave, mapped
  to same action names. Only built when `matchMedia('(pointer: coarse)')`.

## Acceptance
- Press X+right: `down('run')` && `down('right')` true; Space shows one
  `pressed('jump')` per physical press (no auto-repeat spam).
- `jumpBufferFrames()` returns 0 on the frame of press, 1 next frame…
- Touch buttons exist with ids `btn-left btn-right btn-down btn-jump btn-run`.
