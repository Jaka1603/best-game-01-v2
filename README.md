# SOLSTICE RUN

[![Competition](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/Jaka1603/best-game-01-v2/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/Jaka1603/best-game-01-v2/reward.svg)](https://make.fun/bounty/best-game-01)

**Outrun the Night Wall. Reach the Sun Gate.**

A three.js hover-speeder canyon racer at dusk. Behind you, a wall of
living darkness — black, star-flecked, burning violet at its base — is
sweeping up the canyon and it never stops. Ahead, 3,000 m of rock
spires, wrecked speeders and golden gates lead to the Sun Gate and
dawn. Thread the gates, gather sun-cores to stack your combo up to ×8
and patch your hull, shave past the rocks for near-miss bonuses — and
whatever you do, don't slow down.

What makes it feel different: a chase camera that lags, rolls and
widens with speed; hitstop and slow-mo on every crash; a Night Wall
that rubber-bands against your pace — patient while you run clean,
hungry the moment you stall; and a fully synthesized soundtrack — a
procedural D-minor driving loop that grows a danger layer as the Wall
closes in. No audio files, no image files, no network: every texture
is painted on a canvas at load and every sound is synthesized live.

## Play

Open `game/index.html` in a desktop browser (or serve the entry with
`node serve.ts`).

- **← / →** or **A / D** or **mouse** — steer · **↓ / S** — brake
- **Enter / click** — start · **P / Esc** — pause · **R** — restart · **M** — mute

## The four beats

1. **Title** — the speeder on the start line, the banded sun waiting.
2. **Play** — mid-run: gates, cores, combo ×2 and climbing.
3. **The Wall** — 23 m behind you and closing; the warning is lit.
4. **Victory** — through the Sun Gate: time, score, cores, dawn.

Full design notes, the tuning curves and the test results live in
[NOTES.md](NOTES.md).
