// SOLSTICE RUN — a best-game-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: a three.js hover-speeder
// canyon racer for a desktop browser, plain static files that load
// offline (game/index.html, its ES modules, and one vendored three.min.js
// under game/vendor/ — no network request at runtime; every texture is
// canvas-generated and every sound is synthesized WebAudio). The player
// races the Night Wall — a wall of darkness sweeping up the canyon — to
// the Sun Gate 3,000 m ahead: steering with keys or mouse, threading
// golden gates, collecting sun-cores that build a combo multiplier and
// patch the hull, dodging rock spires and wrecks, with a full
// title → play ⇄ pause → victory / game-over → restart flow. This
// program hands it in: it copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`SOLSTICE RUN handed over to ${out} (game/ + screenshots/ + dossier.json).`);
