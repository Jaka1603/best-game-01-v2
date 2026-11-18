// The screenshot scenes behind ?shot=title|play|wall|victory. Each one
// drives the real simulation with a simple autopilot from a fresh world,
// so the frame is what an actual run looks like — and the same seed
// always stages the same frame.

import { STEP, TRACK } from './config.js';
import { MODE_VICTORY } from './game.js';

/**
 * A steady-handed pilot: aim at the next gate's heart (or the nearest
 * core when no gate is close), and swerve early around anything solid.
 */
export function autopilotInput(state, world) {
  let targetX = state.x;
  let bestDz = Infinity;
  for (const gate of world.gates) {
    if (gate.passed) continue;
    const dz = gate.z - state.z;
    if (dz > -4 && dz < bestDz) { bestDz = dz; targetX = gate.x; }
  }
  if (bestDz > 130) {
    let coreDz = Infinity;
    for (const core of world.cores) {
      if (core.taken) continue;
      const dz = core.z - state.z;
      if (dz > 0 && dz < coreDz) { coreDz = dz; targetX = core.x; }
    }
  }
  for (const ob of world.obstacles) {
    const dz = ob.z - state.z;
    if (dz < 2 || dz > 36) continue;
    if (Math.abs(ob.x - state.x) < ob.r + 2.4) {
      targetX = state.x + (state.x <= ob.x ? -1 : 1) * 7;
      break;
    }
  }
  targetX = Math.max(-TRACK.halfWidth, Math.min(TRACK.halfWidth, targetX));
  return { steer: 0, laneX: targetX, braking: false };
}

function runAutopilot(game, world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP, autopilotInput(game.state, world), world);
    game.fx.length = 0;
    if (game.state.mode !== 'playing') break;
  }
}

/**
 * Stage the named scene. `ctx` carries the live rig from main.js:
 * { game, world, length, poseCamera(x,y,z, lx,ly,lz), useChaseCamera(),
 *   burst(x,y,z,colour,count) }.
 */
export function stageShot(name, ctx) {
  const { game, world, length } = ctx;
  const state = game.state;
  game.reset(world);

  if (name === 'play') {
    game.start();
    runAutopilot(game, world, 13.5);
    ctx.useChaseCamera();
    return { screen: 'play' };
  }

  if (name === 'wall') {
    game.start();
    runAutopilot(game, world, 21);
    // The Wall, caught mid-lunge: close enough to fill the sky behind.
    state.wallZ = state.z - 23;
    world.setWallZ(state.wallZ);
    ctx.poseCamera(
      state.x + 8.6, 3.4, state.z + 12.5,
      state.x - 1.5, 1.6, state.z - 40,
    );
    return { screen: 'play' };
  }

  if (name === 'victory') {
    game.start();
    runAutopilot(game, world, 60);
    if (state.mode !== MODE_VICTORY) {
      // The pilot is honest but not perfect; walk the last metres in.
      state.z = length;
      game.setModeForStaging(MODE_VICTORY);
      state.victoryTime = state.time;
    }
    ctx.burst(0, 6, length - 2, 0xffd23c, 60);
    ctx.burst(state.x, 2, length - 4, 0x37f2e2, 30);
    ctx.poseCamera(
      state.x + 12, 4.2, length - 34,
      0, 6.5, length + 4,
    );
    return { screen: 'victory' };
  }

  // title (and anything unknown): the hero pose on the start line.
  state.z = 10;
  state.x = -1.6;
  world.setWallZ(state.wallZ);
  ctx.poseCamera(
    7.2, 2.2, 1.5,
    -0.8, 1.3, 24,
  );
  return { screen: 'title' };
}
