// The hero craft: a low hover-speeder built from boxes and a canopy —
// magenta livery, dark trim, cyan thrusters that breathe with the speed.
// It hovers (bob and sway), banks into steering and pitches under power,
// so a still frame already reads as motion.

const THREE = window.THREE;
import { PALETTE } from './config.js';

export function createSpeeder(glowTex) {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: PALETTE.speederBody, roughness: 0.35, metalness: 0.55 });
  const trim = new THREE.MeshStandardMaterial({ color: PALETTE.speederTrim, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.12, metalness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: PALETTE.gateGold, roughness: 0.3, metalness: 0.8, emissive: 0x694a00, emissiveIntensity: 0.6 });

  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  }

  // Hull: a long wedge — wide tail, tapered nose built from two boxes.
  box(1.7, 0.42, 3.4, body, 0, 0.52, 0);
  const nose = box(1.15, 0.3, 1.5, body, 0, 0.44, 2.25);
  nose.rotation.x = 0.1;
  box(1.74, 0.14, 1.1, trim, 0, 0.3, -1.15);
  // Gold spine stripe and nose tip.
  box(0.3, 0.06, 3.2, gold, 0, 0.76, -0.1);
  box(0.5, 0.1, 0.3, gold, 0, 0.5, 2.95);
  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 12), glass);
  canopy.scale.set(1.05, 0.62, 1.7);
  canopy.position.set(0, 0.78, 0.35);
  canopy.castShadow = true;
  group.add(canopy);
  // Side pods with intake glow slots.
  for (const side of [-1, 1]) {
    box(0.42, 0.34, 2.2, trim, side * 1.02, 0.46, -0.5);
    const fin = box(0.08, 0.55, 0.9, body, side * 1.05, 0.85, -1.55);
    fin.rotation.x = -0.25;
  }
  // Rear wing.
  const wing = box(2.3, 0.07, 0.5, trim, 0, 0.95, -1.8);
  wing.rotation.x = 0.06;
  box(0.09, 0.3, 0.3, body, -0.8, 0.78, -1.8);
  box(0.09, 0.3, 0.3, body, 0.8, 0.78, -1.8);

  // Thruster glows: two additive sprites + one shared point light.
  const thrusterMat = new THREE.SpriteMaterial({
    map: glowTex, color: PALETTE.thruster, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const thrusters = [];
  for (const side of [-1, 1]) {
    const s = new THREE.Sprite(thrusterMat.clone());
    s.position.set(side * 0.55, 0.5, -2.0);
    s.scale.set(1.1, 1.1, 1);
    group.add(s);
    thrusters.push(s);
  }
  const light = new THREE.PointLight(PALETTE.thruster, 2.5, 6.5, 1.8);
  light.position.set(0, 0.6, -2.1);
  group.add(light);
  // Headlight glow at the nose.
  const head = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffe9b0, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  head.position.set(0, 0.5, 3.1);
  head.scale.set(1.5, 0.8, 1);
  group.add(head);

  return {
    object: group,
    /** Pose the craft for this frame: hover bob, bank and pitch from motion. */
    pose(x, z, steerVel, speedNorm, time, crashed) {
      group.position.set(x, 0.18 + Math.sin(time * 2.3) * 0.07, z);
      group.rotation.z = -steerVel * 0.55;
      group.rotation.x = (crashed ? 0.22 : 0.02 + speedNorm * 0.045) + Math.sin(time * 3.1) * 0.008;
      group.rotation.y = -steerVel * 0.3;
      const flicker = 0.9 + Math.sin(time * 31) * 0.1 + speedNorm * 0.5;
      for (const s of thrusters) s.scale.set(0.9 * flicker + speedNorm * 0.45, 0.9 * flicker, 1);
      light.intensity = 1.6 + speedNorm * 2.2;
    },
  };
}
