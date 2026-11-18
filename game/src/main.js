// Solstice Run — the conductor. Wires the simulation (game.js) to the
// renderer, the canyon (world.js), the HUD and the audio, and owns the
// frame loop: a fixed-step accumulator behind a time-scale that carries
// the feel numbers — hitstop and slow-mo on a crash, trauma-based shake,
// a damped chase camera whose FOV kicks open with speed.
//
// Shot mode (?shot=title|play|wall|victory&seed=N) stages a deterministic
// scene through shots.js instead of running the live loop, renders it,
// and raises window.__shotReady for the screenshot harness.

const THREE = window.THREE;
import { BEST_KEY, FEEL, PALETTE, SCORING, SPEEDER, STEP, TRACK } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import { createAudio } from './audio.js';
import { glowTexture } from './textures.js';
import { buildWorld } from './world.js';
import { createSpeeder } from './speeder.js';
import { createSparks, createPuffs, createStreaks } from './particles.js';
import { createGame, MODE_OVER, MODE_PAUSED, MODE_PLAYING, MODE_TITLE, MODE_VICTORY } from './game.js';
import { createHud } from './hud.js';
import { autopilotInput, stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7);
const length = Math.max(120, Number(params.get('gate') || TRACK.length));

// ---- renderer & scene (the look lives here: ACES, sRGB, soft shadows) ----
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if (shotName) {
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720, false);
} else {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 60, 430);
const camera = new THREE.PerspectiveCamera(FEEL.fovBase, 16 / 9, 0.1, 6000);
if (!shotName) camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();

const hemi = new THREE.HemisphereLight(0x8a6bc8, 0x7a4526, 0.85);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffb36b, 2.6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 280 });
sunLight.shadow.camera.updateProjectionMatrix();
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
const SUN_DIR = new THREE.Vector3(-0.3, 0.5, 0.62).normalize();
const _sunPos = new THREE.Vector3();
function updateSun(px, pz) {
  _sunPos.set(px, 0, pz).addScaledVector(SUN_DIR, 130);
  const texel = 110 / 2048; // snap to the shadow texel grid: no swimming
  _sunPos.x = Math.round(_sunPos.x / texel) * texel;
  _sunPos.z = Math.round(_sunPos.z / texel) * texel;
  sunLight.position.copy(_sunPos);
  sunLight.target.position.set(px, 0, pz);
  sunLight.target.updateMatrixWorld();
}

// ---- the world, the craft, the game ----
const glowTex = glowTexture();
const rng = createRandom(seed);
const world = buildWorld(scene, rng, length, glowTex);
world.layOutCores();
const speeder = createSpeeder(glowTex);
scene.add(speeder.object);
const sparks = createSparks(glowTex);
scene.add(sparks.object);
const puffs = createPuffs(glowTex);
scene.add(puffs.object);
const streaks = createStreaks();
scene.add(streaks.object);
const game = createGame(length);
game.reset(world);
const state = game.state;
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();

let best = Number(localStorage.getItem(BEST_KEY) || 0);
hud.setBestLine(best);
function recordBest() {
  if (state.score > best) {
    best = state.score;
    localStorage.setItem(BEST_KEY, String(best));
    hud.setBestLine(best);
  }
}

// ---- camera rig: damped chase, or a posed frame for shots ----
let camMode = 'chase';
const _camPos = new THREE.Vector3(0, 3.1, -9);
const _camLook = new THREE.Vector3(0, 1.3, 12);
const _posedPos = new THREE.Vector3();
const _posedLook = new THREE.Vector3();
let trauma = 0;
let fovNow = FEEL.fovBase;

const shotCtx = {
  game,
  world,
  length,
  poseCamera(x, y, z, lx, ly, lz) {
    camMode = 'posed';
    _posedPos.set(x, y, z);
    _posedLook.set(lx, ly, lz);
  },
  useChaseCamera() {
    camMode = 'chase';
    _camPos.set(state.x * 0.72, 3.1, state.z - 8.6);
    _camLook.set(state.x, 1.35, state.z + 14);
  },
  burst(x, y, z, colour, count) {
    sparks.spawn(x, y, z, { count, colour, speed: 9, up: 5, lift: 2, life: 0.9, gravity: 6 });
  },
};

function applyCamera(dt, time) {
  if (camMode === 'posed') {
    camera.position.copy(_posedPos);
    camera.lookAt(_posedLook);
    return;
  }
  const speedNorm = Math.min(1, state.speed / 58);
  const k = 1 - Math.exp(-FEEL.cameraDamp * dt);
  _camPos.x += (state.x * 0.72 - _camPos.x) * k;
  _camPos.y += (3.05 + speedNorm * 0.5 - _camPos.y) * k;
  _camPos.z += (state.z - 8.6 - _camPos.z) * Math.min(1, dt * 14);
  _camLook.x += (state.x + state.vx * FEEL.lookaheadSeconds - _camLook.x) * Math.min(1, dt * 9);
  _camLook.y += (1.35 - _camLook.y) * k;
  _camLook.z += (state.z + 13 + state.speed * 0.18 - _camLook.z) * Math.min(1, dt * 9);
  camera.position.copy(_camPos);
  // Trauma shake: offset ∝ trauma², smooth noise from layered sines.
  if (trauma > 0.001) {
    const sh = trauma * trauma;
    camera.position.x += Math.sin(time * 61.7) * 0.14 * sh;
    camera.position.y += Math.sin(time * 55.3 + 1.7) * 0.11 * sh;
  }
  camera.lookAt(_camLook);
  const roll = -state.vx * 0.0035 + (trauma > 0.001 ? Math.sin(time * 49.1) * 0.01 * trauma * trauma : 0);
  camera.rotateZ(roll);
  const fovTarget = FEEL.fovBase + FEEL.fovKick * speedNorm;
  fovNow += (fovTarget - fovNow) * Math.min(1, dt * 3.2);
  if (Math.abs(fovNow - camera.fov) > 0.05) {
    camera.fov = fovNow;
    camera.updateProjectionMatrix();
  }
}

// ---- run flow ----
let hitstop = 0;
let slowmo = 0;
let dustTimer = 0;

function resetRun() {
  game.reset(world);
  world.layOutCores();
  for (const g of world.gates) {
    g.ring.scale.set(1, 1, 1);
    g.ring.material.emissiveIntensity = 1.5;
    g.glow.material.opacity = 0.3;
  }
  trauma = 0;
  hitstop = 0;
  slowmo = 0;
  camMode = 'chase';
  _camPos.set(0, 3.1, state.z - 8.6);
  _camLook.set(0, 1.35, state.z + 14);
}

function startRun() {
  resetRun();
  game.start();
  audio.wake();
  audio.click();
}

/** Dress every simulation event in sound, particles and HUD feedback. */
function drainFx() {
  for (const ev of game.fx) {
    if (ev.type === 'core') {
      world.hideCore(ev.index);
      sparks.spawn(ev.x, 1.4, ev.z, { count: 14, colour: PALETTE.coreGold, speed: 6, up: 4, lift: 2, life: 0.7, gravity: 5 });
      audio.core(state.combo);
      hud.showFloater(`+${SCORING.core * state.mult}`, '#ffd23c');
    } else if (ev.type === 'gate') {
      world.pulseGate(ev.gate);
      audio.gate();
      hud.showFloater(`GATE +${SCORING.gate * state.mult}`, '#ffcf4d');
    } else if (ev.type === 'near') {
      sparks.spawn(state.x, 1.2, state.z, { count: 6, colour: PALETTE.crystal, speed: 3, up: 2, lift: 1, life: 0.4, gravity: 2 });
      audio.nearMiss();
      hud.showFloater(`NEAR MISS +${SCORING.nearMiss * state.mult}`, '#37f2e2');
    } else if (ev.type === 'crash') {
      sparks.spawn(ev.x, 1, ev.z, { count: 26, colour: 0xffa040, speed: 10, up: 6, lift: 2, life: 0.8, gravity: 8 });
      for (let i = 0; i < 3; i += 1) {
        puffs.spawn(ev.x + (i - 1) * 0.8, 1, ev.z, { colour: 0x554455, opacity: 0.35, size: 2.2, life: 1.1, grow: 1.6, rise: 1.2 });
      }
      trauma = Math.min(1, trauma + FEEL.traumaCrash);
      hitstop = FEEL.hitstopSeconds;
      slowmo = FEEL.slowmoSeconds;
      audio.crash();
      hud.flashHurt();
      hud.showFloater('CRASH!', '#ff5d5d');
    } else if (ev.type === 'victory') {
      audio.victory();
      recordBest();
      sparks.spawn(state.x, 3, length - 2, { count: 60, colour: PALETTE.sunCore, speed: 12, up: 8, lift: 2, life: 1.2, gravity: 5 });
    } else if (ev.type === 'over') {
      audio.defeat();
      recordBest();
    }
  }
  game.fx.length = 0;
}

function handleActions() {
  const a = input.takeActions();
  if (state.mode === MODE_TITLE) {
    if (a & ACTION_CONFIRM) startRun();
  } else if (state.mode === MODE_PLAYING) {
    if (a & ACTION_PAUSE) game.pause();
    else if (a & ACTION_RESTART) startRun();
  } else if (state.mode === MODE_PAUSED) {
    if (a & ACTION_RESTART) startRun();
    else if (a & (ACTION_PAUSE | ACTION_CONFIRM)) {
      game.resume();
      audio.click();
    }
  } else if (state.mode === MODE_VICTORY || state.mode === MODE_OVER) {
    if (a & (ACTION_CONFIRM | ACTION_RESTART)) startRun();
  }
}

/** The feel time-scale: hitstop freezes a breath, slow-mo eases back. */
function timeScale(rdt) {
  if (hitstop > 0) {
    hitstop -= rdt;
    return 0.05;
  }
  if (slowmo > 0) {
    slowmo -= rdt;
    const k = 1 - Math.max(0, slowmo) / FEEL.slowmoSeconds;
    return FEEL.slowmoScale + (1 - FEEL.slowmoScale) * k * k;
  }
  return 1;
}

// ---- the live loop ----
const clock = new THREE.Clock();
let accumulator = 0;
let visualTime = 0;

function frame() {
  const rdt = Math.min(clock.getDelta(), 0.25);
  visualTime += rdt;
  handleActions();

  if (state.mode === MODE_PLAYING) {
    accumulator += rdt * timeScale(rdt);
    if (accumulator > STEP * 5) accumulator = STEP * 5; // a hitching tab slows the game, never spirals
    const steer = input.steer();
    const lane = steer === 0 ? input.laneTarget(performance.now()) : null;
    const snapshot = {
      steer,
      laneX: lane === null ? null : lane * TRACK.halfWidth,
      braking: input.braking(),
    };
    while (accumulator >= STEP) {
      game.step(STEP, snapshot, world);
      accumulator -= STEP;
      if (state.mode !== MODE_PLAYING) {
        accumulator = 0;
        break;
      }
    }
    drainFx();
  }

  // Pose the craft: on the start line it idles, in a run it flies.
  if (state.mode === MODE_TITLE) {
    speeder.pose(0, 4, 0, 0, visualTime, false);
    camera.position.set(Math.sin(visualTime * 0.12) * 9.5, 2.7 + Math.sin(visualTime * 0.3) * 0.4, 4 + Math.cos(visualTime * 0.12) * 9.5);
    camera.lookAt(0, 1.1, 7);
  } else {
    speeder.pose(
      state.x, state.z,
      state.vx / SPEEDER.lateralSpeed,
      Math.min(1, state.speed / SPEEDER.topSpeed),
      visualTime,
      state.invulnerable > 0.6,
    );
    applyCamera(rdt, visualTime);
  }

  world.setWallZ(state.wallZ);
  world.followBackdrop(state.z);
  world.update(rdt, visualTime, state.z);
  if (state.mode === MODE_PLAYING) {
    dustTimer -= rdt;
    if (dustTimer <= 0) {
      for (let i = 0; i < 2; i += 1) {
        puffs.spawn(state.x + (Math.random() - 0.5) * 38, 1.6, state.wallZ + 3, { colour: 0x2a1a3a, opacity: 0.3, size: 6, life: 1.6, grow: 1.2, rise: 0.8 });
      }
      dustTimer = 0.14;
    }
  }
  streaks.update(state.z, state.mode === MODE_PLAYING ? Math.min(1, state.speed / SPEEDER.topSpeed) : 0);
  sparks.update(rdt);
  puffs.update(rdt);
  updateSun(state.x, state.z);
  trauma = Math.max(0, trauma - FEEL.traumaDecay * rdt);

  const gap = state.z - state.wallZ;
  audio.setEngine(Math.min(1, state.speed / SPEEDER.topSpeed), state.mode === MODE_PLAYING);
  audio.setDanger(state.mode === MODE_PLAYING && gap < 90);
  hud.update(state, length);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  if (shotName) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
window.addEventListener('blur', () => {
  if (state.mode === MODE_PLAYING) game.pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === MODE_PLAYING) game.pause();
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') audio.toggleMute();
});

// ---- shot mode, or the live game ----
if (shotName) {
  const VT = 8.0; // a fixed visual clock: the same frame every run
  stageShot(shotName, shotCtx);
  world.setWallZ(state.wallZ);
  world.followBackdrop(state.z);
  world.update(0, VT, state.z);
  speeder.pose(state.x, state.z, state.vx / SPEEDER.lateralSpeed, Math.min(1, state.speed / SPEEDER.topSpeed), VT, false);
  updateSun(state.x, state.z);
  applyCamera(0.016, VT);
  hud.update(state, length);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  renderer.setAnimationLoop(frame);
}

// ---- hooks for the play-test harness ----
window.__game = {
  state,
  game,
  world,
  renderer,
  scene,
  camera,
  debug: {
    start: () => startRun(),
    restart: () => startRun(),
    setHull: (v) => { state.hull = v; },
    setWallGap: (m) => { state.wallZ = state.z - m; },
    setZ: (z) => { state.z = z; },
    setSpeed: (v) => { state.speed = v; },
    /** Drive the real sim with the shots.js autopilot for N sim-seconds. */
    autopilot(seconds) {
      const steps = Math.floor(seconds * 60);
      for (let i = 0; i < steps; i += 1) {
        game.step(STEP, autopilotInput(state, world), world);
        game.fx.length = 0;
        if (state.mode !== MODE_PLAYING) break;
      }
      return { mode: state.mode, score: state.score, cores: state.cores, hull: state.hull, z: Math.round(state.z), time: state.time };
    },
    /** 60 s of seeded random inputs: the FSM must stay legal and finite. */
    fuzz(seconds) {
      let s = (seed ^ 0x9e3779b9) >>> 0;
      const rnd = () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
      };
      const legal = [MODE_TITLE, MODE_PLAYING, MODE_PAUSED, MODE_VICTORY, MODE_OVER];
      let violations = 0;
      let runs = 0;
      startRun();
      const steps = Math.floor(seconds * 60);
      for (let i = 0; i < steps; i += 1) {
        game.step(STEP, { steer: Math.floor(rnd() * 3) - 1, laneX: null, braking: rnd() < 0.08 }, world);
        game.fx.length = 0;
        if (!legal.includes(state.mode)) violations += 1;
        if (!Number.isFinite(state.x + state.z + state.speed + state.score + state.hull)) violations += 1;
        if (state.mode === MODE_OVER || state.mode === MODE_VICTORY) {
          runs += 1;
          startRun();
        }
      }
      return { steps, violations, runs, endMode: state.mode };
    },
    /** Autopilot soak: minutes of play compressed into pure sim steps. */
    soak(seconds) {
      let violations = 0;
      let runs = 0;
      let maxZ = 0;
      startRun();
      const steps = Math.floor(seconds * 60);
      for (let i = 0; i < steps; i += 1) {
        game.step(STEP, autopilotInput(state, world), world);
        game.fx.length = 0;
        maxZ = Math.max(maxZ, state.z);
        if (!Number.isFinite(state.x + state.z + state.speed + state.score)) violations += 1;
        if (state.mode === MODE_OVER || state.mode === MODE_VICTORY) {
          runs += 1;
          startRun();
        }
      }
      return { steps, violations, runs, maxZ, endMode: state.mode };
    },
  },
};
