// The run itself, as a pure simulation: state in, fixed step, events out.
// No rendering and no DOM in here — main.js turns the events into sound,
// particles and HUD, which is also what lets the screenshot scenes and
// the play-tests drive the exact same rules headlessly.
//
// Built to the v7 discipline: screens are an explicit state machine with
// a transition table (no flag soup), collisions run through a spatial
// hash broadphase, movement sub-steps so a full-speed speeder can never
// tunnel through a rock, and difficulty is the written curves in
// config.js — speed and the Wall's pace are functions of time, not
// scattered constants.

import { CURVES, DAMAGE, FEEL, SCORING, SPEEDER, TRACK, WALL } from './config.js';

export const MODE_TITLE = 'title';
export const MODE_PLAYING = 'playing';
export const MODE_PAUSED = 'paused';
export const MODE_VICTORY = 'victory';
export const MODE_OVER = 'over';

/** The only legal edges of the screen state machine. */
const TRANSITIONS = {
  title: [MODE_PLAYING],
  playing: [MODE_PAUSED, MODE_VICTORY, MODE_OVER],
  paused: [MODE_PLAYING, MODE_TITLE],
  victory: [MODE_TITLE],
  over: [MODE_TITLE],
};

/** Frame-rate independent exponential approach (THREE.MathUtils.damp). */
function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function createGame(length = TRACK.length) {
  const state = {
    mode: MODE_TITLE,
    time: 0,
    z: 0,
    x: 0,
    vx: 0,
    speed: 0,
    hull: SPEEDER.maxHull,
    score: 0,
    combo: 0,
    comboTimer: 0,
    mult: 1,
    cores: 0,
    wallZ: WALL.startZ,
    wallSpeed: WALL.startSpeed,
    invulnerable: 0,
    overReason: '',
    victoryTime: 0,
    bestCombo: 0,
  };
  /** One-shot happenings for main.js to dress up; drained every frame. */
  const fx = [];
  /** Spatial hash of the static obstacles, rebuilt on reset. */
  const hash = new Map();
  /** Broadphase candidates, reused across queries — never re-allocated. */
  const candidates = [];
  let gateCursor = 0;
  let coreCursor = 0;

  function cellKey(x, z) {
    const ix = Math.floor((x + 64) / FEEL.hashCell);
    const iz = Math.floor(z / FEEL.hashCell);
    return iz * 4096 + ix;
  }

  function buildHash(world) {
    hash.clear();
    for (const ob of world.obstacles) {
      const key = cellKey(ob.x, ob.z);
      let bucket = hash.get(key);
      if (!bucket) {
        bucket = [];
        hash.set(key, bucket);
      }
      bucket.push(ob);
    }
  }

  /** Fill `candidates` with the obstacles in the 3×3 cells around (x, z). */
  function queryObstacles(x, z) {
    candidates.length = 0;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const bucket = hash.get(cellKey(x + dx * FEEL.hashCell, z + dz * FEEL.hashCell));
        if (bucket) for (const ob of bucket) candidates.push(ob);
      }
    }
    return candidates;
  }

  function addCombo() {
    state.combo += 1;
    state.comboTimer = SCORING.comboWindow;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.mult = Math.min(SCORING.maxMultiplier, 1 + Math.floor(state.combo / SCORING.comboPerStep));
  }

  /** The one door between screens: illegal edges are refused, not patched. */
  function transition(to) {
    const legal = TRANSITIONS[state.mode];
    if (!legal || !legal.includes(to)) return false;
    state.mode = to;
    if (to === MODE_VICTORY) {
      state.victoryTime = state.time;
      const timeBonus = Math.max(0, Math.round(120 - state.time)) * SCORING.victorySecondBonus;
      state.score += Math.round(state.hull) * SCORING.victoryHullBonus + timeBonus;
      fx.push({ type: 'victory' });
    }
    if (to === MODE_OVER) fx.push({ type: 'over', reason: state.overReason });
    return true;
  }

  function finish(reason) {
    if (reason === 'gate') transition(MODE_VICTORY);
    else {
      state.overReason = reason;
      transition(MODE_OVER);
    }
  }

  /** One movement sub-step: short enough that nothing can be tunnelled. */
  function substep(sdt, input, world) {
    state.time += sdt;
    if (state.invulnerable > 0) state.invulnerable -= sdt;

    // Steering: the mouse names a lane, the keys shove sideways; the
    // snapshot has already shaped the axis (deadzone + expo).
    let vxTarget;
    if (input.laneX !== null && input.laneX !== undefined) {
      vxTarget = Math.max(-SPEEDER.lateralSpeed, Math.min(SPEEDER.lateralSpeed, (input.laneX - state.x) * 3.4));
      if (Math.abs(input.laneX - state.x) < 0.3) vxTarget = 0;
    } else {
      vxTarget = input.steer * SPEEDER.lateralSpeed;
    }
    state.vx = damp(state.vx, vxTarget, 9, sdt);
    state.x += state.vx * sdt;
    if (state.x > TRACK.halfWidth) state.x = TRACK.halfWidth;
    if (state.x < -TRACK.halfWidth) state.x = -TRACK.halfWidth;

    // Forward speed chases the difficulty curve; braking and crashes are
    // the only things allowed to argue with it.
    if (input.braking) {
      state.speed = Math.max(SPEEDER.brakeSpeed, state.speed - SPEEDER.brakeRate * sdt);
    } else {
      state.speed = damp(state.speed, CURVES.speedAt(state.time), SPEEDER.speedChase, sdt);
    }
    state.z += state.speed * sdt;

    // The Night Wall: its pace is the wall curve, rubber-banded so a
    // clean run always gains and a stalled run always gets caught.
    const gap = state.z - state.wallZ;
    let wallTarget = CURVES.wallAt(state.time);
    if (gap > WALL.easeGap) wallTarget *= WALL.easeFactor;
    if (gap < WALL.panicGap) wallTarget *= WALL.panicFactor;
    state.wallSpeed = damp(state.wallSpeed, wallTarget, 0.8, sdt);
    state.wallZ += state.wallSpeed * sdt;

    if (state.comboTimer > 0) {
      state.comboTimer -= sdt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.mult = 1;
      }
    }

    // Gates, judged in order as their line is crossed.
    while (gateCursor < world.gates.length && world.gates[gateCursor].z <= state.z) {
      const gate = world.gates[gateCursor];
      gateCursor += 1;
      gate.passed = true;
      if (Math.abs(state.x - gate.x) <= 4.4) {
        state.score += SCORING.gate * state.mult;
        addCombo();
        fx.push({ type: 'gate', gate });
      }
    }

    // Sun-cores: a magnet reach outside the collect radius, so a near
    // pass still gathers the core in (it visibly drifts to the craft).
    while (coreCursor < world.cores.length && world.cores[coreCursor].z < state.z - 6) coreCursor += 1;
    for (let i = coreCursor; i < world.cores.length; i += 1) {
      const core = world.cores[i];
      const dz = core.z - state.z;
      if (dz > 8) break;
      if (core.taken) continue;
      const dx = core.x - state.x;
      if (Math.abs(dz) < 2.4 && Math.abs(dx) < FEEL.collectRadius) {
        core.taken = true;
        state.cores += 1;
        state.score += SCORING.core * state.mult;
        state.hull = Math.min(SPEEDER.maxHull, state.hull + SCORING.coreRepair);
        addCombo();
        fx.push({ type: 'core', index: i, x: core.x, z: core.z });
      } else if (dz > -3 && dz < 7 && Math.abs(dx) < FEEL.collectRadius + FEEL.magnetRadius) {
        core.x += Math.max(-6 * sdt, Math.min(6 * sdt, state.x - core.x));
      }
    }

    // Obstacles through the broadphase: a hit, a near miss, or a clean
    // pass — each judged exactly once.
    const nearby = queryObstacles(state.x, state.z);
    for (const ob of nearby) {
      if (ob.judged) continue;
      const dz = ob.z - state.z;
      if (dz > 4) continue;
      if (dz < -2.2) { ob.judged = true; continue; }
      const dx = Math.abs(ob.x - state.x);
      if (Math.abs(dz) < 1.7 && dx < ob.r + 0.95) {
        ob.judged = true;
        if (state.invulnerable <= 0) {
          state.hull -= DAMAGE[ob.kind];
          state.speed *= SPEEDER.crashKeep;
          state.combo = 0;
          state.mult = 1;
          state.comboTimer = 0;
          state.invulnerable = SPEEDER.invulnerableSeconds;
          fx.push({ type: 'crash', kind: ob.kind, x: ob.x, z: ob.z });
          if (state.hull <= 0) {
            state.hull = 0;
            finish('hull');
            return;
          }
        }
      } else if (dz < -1.2 && dx >= ob.r + 0.95 && dx < ob.r + 2.8) {
        ob.judged = true;
        state.score += SCORING.nearMiss * state.mult;
        addCombo();
        fx.push({ type: 'near', x: ob.x, z: ob.z });
      }
    }

    if (state.z >= length) {
      state.z = length;
      finish('gate');
      return;
    }
    if (state.z - state.wallZ <= WALL.catchDistance) finish('wall');
  }

  return {
    state,
    fx,
    length,
    transition,
    /** Staging/tests only: place the machine in a mode directly. */
    setModeForStaging(mode) {
      state.mode = mode;
    },
    reset(world) {
      state.mode = MODE_TITLE;
      Object.assign(state, {
        time: 0, z: 0, x: 0, vx: 0, speed: 0,
        hull: SPEEDER.maxHull, score: 0, combo: 0, comboTimer: 0, mult: 1,
        cores: 0, wallZ: WALL.startZ, wallSpeed: WALL.startSpeed,
        invulnerable: 0, overReason: '', victoryTime: 0, bestCombo: 0,
      });
      fx.length = 0;
      gateCursor = 0;
      coreCursor = 0;
      for (const c of world.cores) {
        c.taken = false;
        c.x = c.homeX;
      }
      for (const g of world.gates) { g.passed = false; g.pulse = 0; }
      for (const o of world.obstacles) o.judged = false;
      buildHash(world);
    },
    start() {
      if (transition(MODE_PLAYING)) state.speed = SPEEDER.startSpeed;
    },
    pause() {
      transition(MODE_PAUSED);
    },
    resume() {
      transition(MODE_PLAYING);
    },
    /**
     * Advance one fixed step. `input` is the snapshot
     * { steer, laneX, braking }: steer −1..1 shaped, laneX a world-x
     * target from the mouse (or null), braking the brake key.
     */
    step(dt, input, world) {
      if (state.mode !== MODE_PLAYING) return;
      // Sub-step so per-step travel stays under the smallest target
      // radius — at 58 m/s a raw 1/60 step moves nearly a metre.
      const travel = state.speed * dt;
      const n = Math.max(1, Math.ceil(travel / FEEL.substepTravel));
      const sdt = dt / n;
      for (let i = 0; i < n && state.mode === MODE_PLAYING; i += 1) {
        substep(sdt, input, world);
      }
      // NaN guard at the sim boundary: a poisoned field is repaired to a
      // safe value here instead of silently killing everything downstream.
      if (!Number.isFinite(state.x)) state.x = 0;
      if (!Number.isFinite(state.z)) state.z = 0;
      if (!Number.isFinite(state.speed)) state.speed = SPEEDER.startSpeed;
      if (!Number.isFinite(state.wallZ)) state.wallZ = state.z - 100;
      if (!Number.isFinite(state.score)) state.score = 0;
    },
  };
}
