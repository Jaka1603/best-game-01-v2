// Keyboard and mouse, read as one input snapshot. Listeners write into
// this object and nothing else; the simulation consumes the snapshot and
// never touches a DOM event, which is what makes runs replayable in
// tests. The keyboard steers by direction, the mouse steers by naming
// the lane the craft should hold — both write the same steer axis.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

/** Steering feel: a small deadzone, then an expo curve so fine control
 *  lives near the centre and full lock is still reachable. */
const DEADZONE = 0.14;
const EXPO = 1.4;
export function shapeAxis(raw) {
  const a = Math.abs(raw);
  if (a <= DEADZONE) return 0;
  const scaled = (a - DEADZONE) / (1 - DEADZONE);
  return Math.sign(raw) * Math.pow(scaled, EXPO);
}

const STEER_KEYS_LEFT = ['ArrowLeft', 'KeyA'];
const STEER_KEYS_RIGHT = ['ArrowRight', 'KeyD'];
const BRAKE_KEYS = ['ArrowDown', 'KeyS'];

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseLane = null;
  let mouseSeenAt = -Infinity;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (STEER_KEYS_LEFT.includes(event.code) || STEER_KEYS_RIGHT.includes(event.code) || BRAKE_KEYS.includes(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseLane = Math.max(-1, Math.min(1, nx));
    mouseSeenAt = performance.now();
  }
  function onPointerDown() {
    actions |= ACTION_CONFIRM;
  }
  function onBlur() {
    held.clear(); // a key released while the window is unfocused must not stick
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** -1 (full left) .. 1 (full right), shaped; the mouse wins while fresh. */
    steer() {
      let axis = 0;
      for (const code of STEER_KEYS_LEFT) if (held.has(code)) axis -= 1;
      for (const code of STEER_KEYS_RIGHT) if (held.has(code)) axis += 1;
      return shapeAxis(axis);
    },
    /** The lane (-1..1 across the roam width) the mouse last named, or null. */
    laneTarget(now) {
      return now - mouseSeenAt < 4000 ? mouseLane : null;
    },
    braking() {
      for (const code of BRAKE_KEYS) if (held.has(code)) return true;
      return false;
    },
    /** Queued one-shot actions since the last call; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
