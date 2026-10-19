# 07 — Audio System (synthesized SFX + original chiptune)

Depends on: 02, 03. Produces: `BROS.Audio`. Consumed by: 11–16.
Music policy: ALL melodies are original compositions written as note tables in
code (square lead + triangle bass + noise hats). No transcriptions of existing
songs; progressions/pacing homage is fine, notes are ours.

## Public API
```
BROS.Audio.ensure()               // create AudioContext lazily (on first gesture)
BROS.Audio.sfx(name)              // one-shot; names below
BROS.Audio.music.play(trackName)  // starts/replaces loop; frame-stepped
BROS.Audio.music.stop()
BROS.Audio.music.hurry(on)        // faster tempo + hat emphasis while timer<100
BROS.Audio.toggleMute()           // also called by Input 'mute'
BROS.Audio.muted                  // boolean
BROS.Audio.tick(frame)            // advance sequencer (1 == one 60Hz frame)
```

## SFX inventory (synth recipe sketch)
`jump` square up-sweep 340->560Hz .18s · `stomp` tri 240->90 + noise .12 ·
`pop` noise burst .08 tri chirp down · `coin` square C6->G6 two blips ·
`bump` square 170->110 .07 quiet · `break` highpass noise .18 + blip ·
`kick` square 520->120 .08 · `shell_hit` tri 300->150 .1 ·
`fire` sawtooth chirp 700->200 .07 · `powerup` square arp C E G B D .04 gap ·
`grow` square gliss 150->420 .28 · `shrink` square gliss 420->150 .22 ·
`toffee` low square thud C3+C4 double .2 · `bubble` sine gliss 380->950 .35 +
shimmer arp · `popbubble` noise .15 · `boing` square 210->760 .2 ·
`spike` harsh detuned square duo F4 .12 · `hurt` square 300->140 .18 ·
`die` arp A5 F5 C4 F3 square + noise thud · `1up` pentatonic up fast C G A C E .06 ·
`flag` square gliss 300->1300 .5 · `tally_tick` square tick .03 ·
`hurry_warn` two 1100Hz beeps .1 · `clear` rising fanfare 8 notes ·
`gameover` descending 4 notes slow · `card` 3-note chime · `pause_blip` .
All through one master gain 0.55 -> destination.

## Music sequencer (frame-stepped, no lookahead scheduler)
Track format: `{bpm, hats, lead:[ [pitch,durEighths], … ], bass:[ … ]}` built
into start-indexed maps at load. `tick(frame)` counts 8th-notes from
frames-per-8th = 60*60/bpm*2… implemented as accumulator `framesPerEighth`.
Hurry mode multiplies rate by 1.33. Track names: `main` (day), `cave`
(minor, stiffer), `dusk` (laid-back major), `clear` (fanfare, non-looping),
`gameover` (non-looping), `card` (non-looping). Level loader picks loop by
theme. Loop lengths 16–32 eighths (2–4s) so short loops never annoy.

## Unlock policy
No AudioContext until first user gesture (keydown/pointerdown anywhere) —
`Game` calls `Audio.ensure()` there. Music only starts after ensure. Muted state
persists across levels until toggled again.

## Acceptance
- First keypress unlocks audio (autoplay-safe). `sfx('jump')` from title makes
  sound; `music.play('main')` loops glitch-free >3 loops; `music.hurry(true)`
  audibly speeds up; mute silences everything including music resumption.
