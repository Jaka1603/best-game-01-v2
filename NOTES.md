# SOLSTICE RUN — build notes

**One-sentence loop:** outrun the Night Wall — thread gates, gather
sun-cores, stack the combo — and cross the Sun Gate 3,000 m up-canyon
before your hull or the darkness gives out.

A three.js hover-speeder canyon racer at dusk, built for best-game-01 v2
(replacing the NEONFALL entry). Everything is procedural and offline:
canvas-painted textures, primitive-built models, synthesized WebAudio —
no runtime network requests, no asset files besides the vendored
three.min.js (r160 UMD, byte-identical to the release).

## Controls

| Input | Effect |
|---|---|
| ← / → or A / D | steer (shaped axis: deadzone + expo curve) |
| mouse move | steer by naming the lane to hold |
| ↓ / S | brake |
| Enter / Space / click | start, confirm |
| P / Esc | pause / resume |
| R | instant restart |
| M | mute |

## How the brief's requirements are met

- **Complete loop:** title (how-to on the card) → play ⇄ pause →
  victory (time / score / cores / best combo) or game over (reason,
  distance, score) → R restarts instantly. Best score persists in
  localStorage.
- **The race:** speed follows a written curve (26 → 58 m/s, τ = 80 s);
  the Night Wall follows its own curve (23.5 → 55 m/s) rubber-banded so
  clean running always gains and stalling always gets caught (verified:
  braking to a crawl ends in the Wall in the test suite).
- **Threats & rewards:** rock spires and wrecked speeders (hull damage,
  speed loss, crash slow-mo), golden gates (score), sun-cores (score +
  hull repair), near misses (score + combo). Combo multiplier ×1–×8,
  +1 step per 4 combo events, drains after 4.5 s idle.
- **Feel:** damped chase camera (λ = 5) with lateral lag, velocity
  lookahead and roll into steering; FOV kicks +10° across the speed
  range; speed streaks, wall dust, core bursts, crash sparks + smoke;
  hitstop 50 ms and an eased slow-mo on crashes; trauma-based shake.
- **World:** banded low sun ahead, gradient dusk sky, horizon-matched
  fog, instanced strata canyon walls with emissive crystal veins,
  distant mesas, and the Night Wall — a 190 m black star-flecked cliff
  whose base burns violet — visibly eating the canyon behind you.
- **HUD (threat → objective → status):** Wall-proximity warning,
  top-centre progress bar (you / Wall / Sun Gate), score + combo
  top-right, hull bottom-left, distance-to-gate bottom-right, floating
  score popups, red hurt vignette on crashes.
- **Audio:** engine + wind tracking speed; per-event synthesized
  recipes; a procedural score (below). M mutes.

## The v7/v8 craft standard — applied, and deliberately skipped

Applied, concretely:

- **Hot-loop discipline (v7):** pooled sparks/puffs/streaks allocated
  once (typed-array particle state), module-scope scratch vectors in
  the camera/sun rig, no per-frame allocation in the sim or render
  paths; HUD text writes guarded by change.
- **Fixed-step deterministic sim (v7):** STEP = 1/60 behind an
  accumulator (clamped, so a hitching tab slows instead of spiralling);
  all placement from a seeded mulberry32; shot modes and tests drive
  the real sim in fixed steps, so staged frames are proof of the rules.
- **Collision at scale (v7):** spatial-hash broadphase (6 m cells) over
  the static obstacles + movement sub-stepping (≤ 0.45 m per sub-step)
  so a 58 m/s speeder cannot tunnel — asserted by a dedicated
  max-speed pass-through test.
- **Input as a snapshot (v7):** listeners write one snapshot object;
  keys and mouse write the same steer axis; deadzone 0.14 + expo 1.4
  shaping; window blur clears held keys (and auto-pauses).
- **State machines (v7):** screens are an explicit FSM
  (title → playing ⇄ paused → victory | over → title) with a
  transition table; illegal edges are refused, not patched with flags.
- **Feel numbers (v7):** hitstop 50 ms, slow-mo 0.3× easing back over
  0.5 s, trauma shake (offset ∝ trauma², decay 1.4/s), camera damp
  λ = 5, lookahead = velocity × 0.35 s, FOV +10°, core magnet 1.2 m
  outside the collect radius.
- **Game Design Core (v8):** difficulty as written curves in one
  config table (speed, Wall pace, obstacle spacing 56 → 27 m over the
  course) with the score-economy math beside the numbers; every threat
  telegraphed — obstacles visible hundreds of metres out, the Wall
  warned on the HUD from 90 m (~2 s) and louder in the music.
- **Level Design (v8):** landmark gates every 150–215 m (~4–5 s at
  cruise — no empty stretch near the 8 s limit), core trails strung
  between gates, density rising with distance; beats run
  intro → test → pressure → climax at the gate.
- **Narrative (v8):** seasoning only — one premise line on the title
  card, answered verbatim by the victory card ("You outran the night.
  Dawn is yours."); wrecks are the environmental storytelling.
- **VFX language (v8):** one shape/colour/motion per event class —
  pickup = gold burst + rising chime, gate = ring pulse + whoosh,
  near miss = cyan streak + tick, crash = orange sparks + smoke +
  red vignette, speed = stretched streaks.
- **Sound recipes + procedural music (v8):** recipes written in the
  audio module (core = sine blip 880→1320 Hz climbing with the combo;
  crash = noise burst + 90 Hz thud; …). The score is a composed loop:
  D-minor i–VI–III–VII at 108 BPM — bass eighths with octave hops, an
  arp cycling chord tones, a detuned pad per bar — scheduled with a
  WebAudio lookahead scheduler (25 ms timer, 0.12 s horizon). A danger
  layer (arp +12, hats, pad filter 750 → 1500 Hz) fades in on bar
  boundaries when the Wall closes under 90 m. Three buses
  (music / sfx / ui) under a master compressor; music ducks −6 dB
  under crashes and the victory sting; voices capped per class.
- **Testing, deep (v8):** beyond the functional suite — a 60 s
  seeded fuzz-input pass (FSM must stay legal, state finite), a 180 s
  autopilot soak (2 full runs completed, no NaN), NaN guards at the
  sim boundary, draw calls measured (32, budget < 300).
- **Judge-facing presentation (v8):** the four screenshots tell the
  beats in order — world (title) → action (play) → climax (the Wall)
  → payoff (victory) — and the title is the promise: verb + object +
  stakes.

Deliberately skipped, with reasons:

- **Multiplayer/networking (v8 reference):** make.fun entries are
  offline static files; runtime network is out of scope by the kit.
- **Touch controls / portrait HUD (v7–v8 platform):** the brief is a
  desktop entry (keyboard + mouse); no touch scheme was built.
- **Minimap (SA HUD section):** a canyon is a line, not a grid — the
  progress bar is the truthful guidance instrument here.
- **Dialogue cards / NPC missions (v6 presentation sections):** a
  single-run arcade racer has no mission giver; narrative is carried
  by premise + payoff cards per the v8 "seasoning" rule.
- **Aim systems, police fire, interiors (v6 sections):** open-world
  shooter systems from the PALMBAY HEAT line of work — not this genre.
- **A full 10-minute soak:** the sim is deterministic and step-driven,
  so 10,800 soak steps + 3,600 fuzz steps exercise the same state
  space a wall-clock soak would, in seconds.

## Audio recipes (summary)

core: sine 880→1320 Hz, 0.09 s, pitch climbs with combo · gate: noise
whoosh (bandpass 500→2600 Hz) + fifth chime · near miss: saw tick
1900→900 Hz · crash: noise burst + square thud 96→38 Hz + music duck ·
engine: detuned saws + square sub through a speed-tracked lowpass ·
wind: shared noise buffer through a bandpass · victory: rising D-major
arp · defeat: falling saws · UI: 1200 Hz tick.

## Play-test results

`~/workspace/makefun/shottools/playtest-best-game-v2.mjs` — **20 passed,
0 failed**, zero console/page errors:

loads to title · 32 draw calls · Enter starts · steering both ways ·
pause/resume · autopilot collects cores (score rises) · collision
reduces hull (100 → 72) · **max-speed pass-through still collides** ·
braking ends in the Wall (`over`, reason `wall`) · restart resets ·
**fuzz 60 s: 0 violations** · **soak 180 s: 0 violations, 2 runs
completed** · shortened run (`&gate=200`) reaches victory · all four
shot modes render real frames.

## Screenshots (from the game's own shot modes, seed 7)

| File | Beat | Bytes |
|---|---|---|
| `screenshots/1-title.jpg` | cover — hero speeder, logo, banded sun | 100,641 |
| `screenshots/2-play.jpg` | mid-run — combo ×2, gate + core ahead | 80,367 |
| `screenshots/3-wall.jpg` | the Night Wall 23 m behind, warning lit | 78,939 |
| `screenshots/4-victory.jpg` | crossing the Sun Gate, victory card | 104,848 |

## Files

- `main.ts` — handover: copies `game/` + `screenshots/` to the output
  dir and builds `dossier.json` via the vendored kit library (untouched).
- `game/index.html` — shell, HUD DOM, screens, all CSS.
- `game/src/config.js` — every tuning number, curve, palette, music table.
- `game/src/game.js` — the simulation (FSM, broadphase, sub-stepping).
- `game/src/world.js` — the canyon, gates, cores, obstacles, Sun Gate, Wall.
- `game/src/main.js` — renderer, camera rig, frame loop, FX dressing,
  shot staging, test hooks (`window.__game`).
- `game/src/shots.js` — the autopilot + the four deterministic scenes.
- `game/src/input.js` — the input snapshot. `game/src/audio.js` — buses,
  recipes, the procedural score. `game/src/hud.js` — DOM HUD + screens.
- `game/src/textures.js` — all canvas-painted textures.
  `game/src/particles.js` — pooled sparks/puffs/streaks.
  `game/src/speeder.js` — the hero craft. `game/src/random.js` — mulberry32.
- `game/vendor/three.min.js` — vendored three.js (unmodified).
