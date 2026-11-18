// Solstice Run — every tuning number, curve and colour in one place, so
// the game is balanced from a single table instead of hunted through the
// code. Difficulty is written as curves of time and distance (v8 Game
// Design Core): each curve has a start, an asymptote and a time constant,
// and those three numbers are the whole difficulty dial.

export const STEP = 1 / 60;

export const TRACK = {
  /** Metres from the start line to the Sun Gate. */
  length: 3000,
  /** The speeder may roam this far either side of the canyon centre line. */
  halfWidth: 11.5,
  /** Canyon walls stand a little beyond the roam width. */
  wallInset: 16.5,
};

/** 1 − e^(−t/τ): the saturating rise every difficulty curve shares. */
function rise(t, tau) {
  return 1 - Math.exp(-t / tau);
}

export const CURVES = {
  /** The speeder's cruising speed (m/s) t seconds into a clean run: 26 → 58. */
  speedAt(t) {
    return SPEEDER.startSpeed + (SPEEDER.topSpeed - SPEEDER.startSpeed) * rise(t, 80);
  },
  /** The Night Wall's base pace (m/s) before rubber-banding: 23.5 → 55. */
  wallAt(t) {
    return WALL.startSpeed + (WALL.topSpeed - WALL.startSpeed) * rise(t, 95);
  },
  /** Mean metres between rock spires at distance z: open early, dense late. */
  obstacleSpacingAt(z, length) {
    const k = Math.min(1, Math.max(0, z / length));
    return 56 + (27 - 56) * k;
  },
};

export const SPEEDER = {
  startSpeed: 26,
  topSpeed: 58,
  /** How eagerly the actual speed chases the curve (damp λ, per second). */
  speedChase: 1.1,
  /** Braking (down / S) drags the craft toward this crawl. */
  brakeSpeed: 6,
  brakeRate: 26,
  /** How fast the craft slides sideways at full steer, metres a second. */
  lateralSpeed: 17,
  /** A crash keeps this share of forward speed. */
  crashKeep: 0.45,
  /** Seconds of ghost time after a crash, so one rock cannot chain-hit. */
  invulnerableSeconds: 1.1,
  maxHull: 100,
};

export const WALL = {
  /** The Night Wall starts this far behind the start line. */
  startZ: -150,
  startSpeed: 23.5,
  topSpeed: 55,
  /** Closer than this (metres) and the run ends. */
  catchDistance: 7,
  /** Past this gap the Wall eases off a little; inside the panic gap it surges. */
  easeGap: 250,
  easeFactor: 0.93,
  panicGap: 55,
  panicFactor: 1.05,
};

/** The score economy, with the session math it is tuned to hit: a clean
 *  ~75 s run threads ~15 gates and ~45 cores at an average ×3 combo,
 *  landing near 20 000; a scrappy run lands near 6 000. */
export const SCORING = {
  core: 100,
  gate: 50,
  nearMiss: 25,
  /** Combo events needed per +1 multiplier step. */
  comboPerStep: 4,
  maxMultiplier: 8,
  /** Seconds without a combo event before the combo drains away. */
  comboWindow: 4.5,
  /** Hull a sun-core patches back. */
  coreRepair: 4,
  victoryHullBonus: 10,
  victorySecondBonus: 15,
};

export const DAMAGE = { spire: 18, wreck: 14 };

/** Feel numbers (v7): the constants that make the game feel fast and fair.
 *  Hitstop freezes the sim a breath on a crash, slow-mo eases back rather
 *  than cutting, shake is trauma-based (offset ∝ trauma²), the camera
 *  damps at λ≈5 with velocity lookahead, and cores magnet in from 1.2 m
 *  outside the collect radius so pickups never demand pixel precision. */
export const FEEL = {
  hitstopSeconds: 0.05,
  slowmoSeconds: 0.5,
  slowmoScale: 0.3,
  traumaCrash: 0.55,
  traumaDecay: 1.4,
  fovBase: 62,
  fovKick: 10,
  cameraDamp: 5,
  lookaheadSeconds: 0.35,
  magnetRadius: 1.2,
  collectRadius: 1.5,
  /** Sub-stepping: no sub-step may move the speeder further than this. */
  substepTravel: 0.45,
  /** Spatial-hash cell for the obstacle broadphase (metres). */
  hashCell: 6,
};

/** The procedural score (v8 Music Composition): D minor, the Andalusian
 *  i–VI–III–VII at 108 BPM. Bass roots and arp chord roots as MIDI notes;
 *  chord kinds line up with the roots. The danger layer is the same loop
 *  with the arp an octave up and the pad filter opened. */
export const MUSIC = {
  bpm: 108,
  bassRoots: [38, 34, 41, 36],
  chordRoots: [62, 58, 65, 60],
  chordKinds: ['min', 'maj', 'maj', 'maj'],
  bassPattern: [0, 0, 12, 0, 0, 7, 0, 12],
  arpPattern: [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1],
};

/** The dusk palette: one art direction, named once, used everywhere. */
export const PALETTE = {
  skyTop: 0x1b1035,
  skyMid: 0x6e2358,
  horizon: 0xff7a3c,
  sunCore: 0xffd23c,
  sunGlow: 0xff9a3c,
  fog: 0x4a2144,
  sand: 0xc96f3f,
  sandDark: 0x9a4e2a,
  strataA: 0x8a4a2b,
  strataB: 0xa55a33,
  strataC: 0x6e3a22,
  crystal: 0x37f2e2,
  gateGold: 0xffcf4d,
  coreGold: 0xffd23c,
  wallBlack: 0x05030d,
  wallEdge: 0xb26bff,
  speederBody: 0xff4d6d,
  speederTrim: 0x2b1030,
  thruster: 0x37f2e2,
};

export const BEST_KEY = 'solstice-run-best';
