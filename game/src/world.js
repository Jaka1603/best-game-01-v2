// The canyon the run happens in: dusk sky and sun, a swept racing strip
// between strata walls, golden gates, sun-cores, rock spires and wrecked
// speeders — and, behind everything, the Night Wall. Placement is dealt
// by the seeded generator, so a seed always builds the same canyon.

const THREE = window.THREE;
import { CURVES, PALETTE, TRACK } from './config.js';
import { groundTexture, strataTexture, sunTexture, wallTexture, wallEdgeTexture, skyTexture } from './textures.js';

export function buildWorld(scene, rng, length, glowTex) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- sky, sun and far desert (a backdrop that travels with the player) ----
  const backdrop = new THREE.Group();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3600, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  backdrop.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(210, 40),
    new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  sun.position.set(0, 150, 1500);
  backdrop.add(sun);
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: PALETTE.sunGlow, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunHalo.scale.set(1250, 1250, 1);
  sunHalo.position.set(0, 150, 1490);
  backdrop.add(sunHalo);
  group.add(backdrop);

  // ---- ground: the racing strip, then open desert beyond the walls ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(46, length + 900),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, length / 2 + 60);
  ground.receiveShadow = true;
  group.add(ground);
  const desert = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, length + 2400),
    new THREE.MeshStandardMaterial({ color: PALETTE.sandDark, roughness: 1 }),
  );
  desert.rotation.x = -Math.PI / 2;
  desert.position.set(0, -0.08, length / 2);
  group.add(desert);

  // ---- canyon walls: instanced strata blocks with crystal veins ----
  const strata = strataTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: strata, roughness: 0.95 });
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const SEGMENTS = Math.floor((length + 240) / 9);
  const walls = new THREE.InstancedMesh(blockGeo, wallMat, SEGMENTS * 2);
  walls.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let wi = 0;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const z = -120 + i * 9 + rng.range(-1.5, 1.5);
    for (const side of [-1, 1]) {
      const h = rng.range(15, 42);
      dummy.position.set(side * (TRACK.wallInset + rng.range(2.5, 7)), h / 2 - 1, z);
      dummy.scale.set(rng.range(11, 17), h, rng.range(9, 13));
      dummy.rotation.y = rng.range(-0.05, 0.05);
      dummy.updateMatrix();
      walls.setMatrixAt(wi, dummy.matrix);
      tint.setHSL(0.06, 0.45, rng.range(0.42, 0.62));
      walls.setColorAt(wi, tint);
      wi += 1;
    }
  }
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  const crystalGeo = new THREE.OctahedronGeometry(0.55);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x0b2b28, emissive: PALETTE.crystal, emissiveIntensity: 1.6, roughness: 0.3,
  });
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, 130);
  crystals.frustumCulled = false;
  for (let i = 0; i < 130; i += 1) {
    const side = i % 2 ? 1 : -1;
    dummy.position.set(side * (TRACK.wallInset - 0.4), rng.range(2, 20), rng.range(-60, length + 60));
    dummy.scale.setScalar(rng.range(0.6, 1.7));
    dummy.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
    dummy.updateMatrix();
    crystals.setMatrixAt(i, dummy.matrix);
  }
  group.add(crystals);

  // Distant mesa silhouettes beyond the walls.
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0x5e2c1e, roughness: 1 });
  for (let i = 0; i < 12; i += 1) {
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(rng.range(120, 260), rng.range(40, 95), rng.range(60, 120)), mesaMat);
    const side = i % 2 ? 1 : -1;
    mesa.position.set(side * rng.range(150, 320), 18, (length / 12) * i + rng.range(-60, 60));
    group.add(mesa);
  }

  // ---- golden gates the run threads ----
  const gates = [];
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a00, emissive: PALETTE.gateGold, emissiveIntensity: 1.5, roughness: 0.35, metalness: 0.6,
  });
  const postMat = new THREE.MeshStandardMaterial({ color: PALETTE.strataC, roughness: 0.9 });
  for (let z = 175; z < length - 130; z += rng.range(150, 215)) {
    const x = rng.range(-6, 6);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.17, 10, 36), gateMat.clone());
    ring.position.set(x, 4.3, z);
    g.add(ring);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, 0.5), postMat);
      post.position.set(x + side * 4.3, 2.3, z);
      post.castShadow = true;
      g.add(post);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: PALETTE.gateGold, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(11, 11, 1);
    glow.position.set(x, 4.3, z);
    g.add(glow);
    group.add(g);
    gates.push({ x, z, ring, glow, pulse: 0, passed: false });
  }

  // ---- sun-cores: spinning gold shards in lines and arcs ----
  const coreSpots = [];
  for (let i = 0; i < gates.length; i += 1) {
    const a = gates[i];
    const b = gates[i + 1] || { x: 0, z: length };
    const n = 3 + Math.floor(rng.range(0, 3));
    for (let k = 0; k < n; k += 1) {
      const t = (k + 1) / (n + 1);
      const cx = a.x + (b.x - a.x) * t + rng.range(-1.6, 1.6);
      coreSpots.push({ x: cx, homeX: cx, z: a.z + (b.z - a.z) * t, taken: false });
    }
  }
  const coreGeo = new THREE.IcosahedronGeometry(0.55, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x7a5a00, emissive: PALETTE.coreGold, emissiveIntensity: 2.4, roughness: 0.25, metalness: 0.4,
  });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, coreSpots.length);
  cores.frustumCulled = false;
  group.add(cores);

  // ---- obstacles: rock spires (instanced) and wrecked speeders ----
  const obstacles = [];
  const spireGeo = new THREE.ConeGeometry(1, 1, 7);
  spireGeo.translate(0, 0.5, 0);
  const spireMat = new THREE.MeshStandardMaterial({ map: strata, roughness: 1 });
  const spireCount = Math.floor(length / 19);
  const spires = new THREE.InstancedMesh(spireGeo, spireMat, spireCount);
  spires.frustumCulled = false;
  spires.castShadow = true;
  let si = 0;
  function nearGateCorridor(x, z) {
    for (const g of gates) if (Math.abs(z - g.z) < 9 && Math.abs(x - g.x) < 4.2) return true;
    return false;
  }
  // Density follows the written spacing curve: open early, dense late.
  for (let z = 250; z < length - 60 && si < spireCount; z += CURVES.obstacleSpacingAt(z, length) * rng.range(0.75, 1.3)) {
    const x = rng.range(-TRACK.halfWidth, TRACK.halfWidth);
    if (nearGateCorridor(x, z)) continue;
    const r = rng.range(1.0, 1.9);
    const h = rng.range(3.2, 7.5);
    dummy.position.set(x, 0, z);
    dummy.scale.set(r, h, r);
    dummy.rotation.y = rng.range(0, 3);
    dummy.updateMatrix();
    spires.setMatrixAt(si, dummy.matrix);
    si += 1;
    obstacles.push({ x, z, r: r * 0.95, kind: 'spire' });
  }
  spires.count = si;
  group.add(spires);

  const wreckBody = new THREE.MeshStandardMaterial({ color: 0x3a2f38, roughness: 0.85, metalness: 0.4 });
  const wreckTrim = new THREE.MeshStandardMaterial({ color: 0x191420, roughness: 0.9 });
  for (let i = 0; i < 11; i += 1) {
    const z = length > 700 ? rng.range(420, length - 160) : rng.range(120, Math.max(160, length - 40));
    const x = rng.range(-TRACK.halfWidth + 1, TRACK.halfWidth - 1);
    if (nearGateCorridor(x, z)) continue;
    const wreck = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3.6), wreckBody);
    hull.position.y = 0.45;
    hull.castShadow = true;
    wreck.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 1.6), wreckTrim);
    cab.position.set(0.12, 0.85, -0.2);
    wreck.add(cab);
    wreck.position.set(x, 0, z);
    wreck.rotation.y = rng.range(0, Math.PI * 2);
    wreck.rotation.z = rng.range(-0.09, 0.09);
    group.add(wreck);
    obstacles.push({ x, z, r: 1.9, kind: 'wreck' });
  }

  // ---- the Sun Gate at the end of the canyon ----
  const sunGate = new THREE.Group();
  const sgRing = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.38, 12, 48), new THREE.MeshStandardMaterial({
    color: 0x8a6200, emissive: PALETTE.sunCore, emissiveIntensity: 2.6, roughness: 0.3, metalness: 0.6,
  }));
  sgRing.position.y = 7.6;
  sunGate.add(sgRing);
  const sgDisc = new THREE.Mesh(new THREE.CircleGeometry(7.2, 40), new THREE.MeshBasicMaterial({
    map: glowTex, color: 0xffdf8a, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  sgDisc.position.y = 7.6;
  sunGate.add(sgDisc);
  const sgGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: PALETTE.sunGlow, transparent: true, opacity: 0.32,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sgGlow.scale.set(18, 18, 1);
  sgGlow.position.y = 7.6;
  sunGate.add(sgGlow);
  const sgLight = new THREE.PointLight(PALETTE.sunCore, 2.4, 70, 1.9);
  sgLight.position.set(0, 8, 4);
  sunGate.add(sgLight);
  sunGate.position.set(0, 0, length);
  group.add(sunGate);

  // ---- the Night Wall ----
  const wallGroup = new THREE.Group();
  const wallFace = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 190),
    new THREE.MeshBasicMaterial({ map: wallTexture(), fog: false }),
  );
  wallFace.position.y = 95;
  wallGroup.add(wallFace);
  const wallEdge = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 190),
    new THREE.MeshBasicMaterial({
      map: wallEdgeTexture(), transparent: true, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  wallEdge.position.set(0, 95, 1.4);
  wallGroup.add(wallEdge);
  for (let i = 0; i < 7; i += 1) {
    const ember = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: PALETTE.wallEdge, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ember.scale.set(26, 10, 1);
    ember.position.set(-240 + i * 80, 3, 2.5);
    wallGroup.add(ember);
  }
  group.add(wallGroup);

  const coreDummy = new THREE.Object3D();
  return {
    group, gates, cores: coreSpots, obstacles, sunGate,
    backdrop,
    /** Slide the backdrop so the sun and sky always hang ahead of the player. */
    followBackdrop(playerZ) {
      backdrop.position.z = playerZ;
    },
    setWallZ(z) {
      wallGroup.position.z = z;
    },
    pulseGate(gate) {
      gate.pulse = 1;
    },
    /** Animate the living parts: cores spin, gates breathe, the Sun Gate turns. */
    update(dt, time, playerZ) {
      for (let i = 0; i < coreSpots.length; i += 1) {
        const c = coreSpots[i];
        if (c.taken || c.z < playerZ - 18 || c.z > playerZ + 170) continue;
        coreDummy.position.set(c.x, 1.35 + Math.sin(time * 2.2 + i * 1.7) * 0.22, c.z);
        coreDummy.rotation.set(0, time * 2.6 + i, 0.4);
        coreDummy.scale.setScalar(1);
        coreDummy.updateMatrix();
        cores.setMatrixAt(i, coreDummy.matrix);
      }
      cores.instanceMatrix.needsUpdate = true;
      for (const g of gates) {
        if (g.pulse > 0) {
          g.pulse = Math.max(0, g.pulse - dt * 1.8);
          const s = 1 + g.pulse * 0.22;
          g.ring.scale.set(s, s, 1);
          g.ring.material.emissiveIntensity = 1.5 + g.pulse * 2.4;
          g.glow.material.opacity = 0.3 + g.pulse * 0.5;
        }
      }
      sgRing.rotation.z = time * 0.25;
      sgDisc.material.opacity = 0.16 + Math.sin(time * 2.4) * 0.05;
      wallEdge.material.opacity = 0.7 + Math.sin(time * 5.2) * 0.12;
    },
    /** Hide a collected core (called once, at pickup). */
    hideCore(index) {
      coreDummy.position.set(0, -50, 0);
      coreDummy.scale.setScalar(0.001);
      coreDummy.rotation.set(0, 0, 0);
      coreDummy.updateMatrix();
      cores.setMatrixAt(index, coreDummy.matrix);
      cores.instanceMatrix.needsUpdate = true;
    },
    /** Place every core matrix once (the spin update only touches nearby ones). */
    layOutCores() {
      for (let i = 0; i < coreSpots.length; i += 1) {
        const c = coreSpots[i];
        coreDummy.position.set(c.x, 1.35, c.z);
        coreDummy.rotation.set(0, i, 0.4);
        coreDummy.scale.setScalar(1);
        coreDummy.updateMatrix();
        cores.setMatrixAt(i, coreDummy.matrix);
      }
      cores.instanceMatrix.needsUpdate = true;
    },
  };
}
