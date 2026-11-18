// Pooled particles, allocated once and reused forever — nothing in here
// creates an object while the game runs. Two pools: additive sparks with
// per-particle colour (impacts, core bursts, gate flashes) and soft
// sprites for dust and smoke that need to fade on their own schedule.

const THREE = window.THREE;

const SPARK_MAX = 420;

export function createSparks(glowTex) {
  const positions = new Float32Array(SPARK_MAX * 3);
  const colours = new Float32Array(SPARK_MAX * 3);
  const velocity = new Float32Array(SPARK_MAX * 3);
  const life = new Float32Array(SPARK_MAX);
  const maxLife = new Float32Array(SPARK_MAX);
  const gravity = new Float32Array(SPARK_MAX);
  for (let i = 0; i < SPARK_MAX; i += 1) positions[i * 3 + 1] = -999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({
    size: 0.55, map: glowTex, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let cursor = 0;
  const colour = new THREE.Color();

  function spawn(x, y, z, opts) {
    const count = opts.count;
    colour.set(opts.colour);
    for (let n = 0; n < count; n += 1) {
      const i = cursor;
      cursor = (cursor + 1) % SPARK_MAX;
      const i3 = i * 3;
      positions[i3] = x; positions[i3 + 1] = y; positions[i3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const r = (0.3 + Math.random() * 0.7) * opts.speed;
      velocity[i3] = Math.cos(a) * r;
      velocity[i3 + 1] = Math.random() * opts.up + opts.lift;
      velocity[i3 + 2] = Math.sin(a) * r + (opts.driftZ || 0);
      const jitter = 0.85 + Math.random() * 0.3;
      colours[i3] = colour.r * jitter; colours[i3 + 1] = colour.g * jitter; colours[i3 + 2] = colour.b * jitter;
      life[i] = maxLife[i] = opts.life * (0.6 + Math.random() * 0.7);
      gravity[i] = opts.gravity;
    }
  }

  function update(dt) {
    for (let i = 0; i < SPARK_MAX; i += 1) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const i3 = i * 3;
      if (life[i] <= 0) { positions[i3 + 1] = -999; continue; }
      velocity[i3 + 1] -= gravity[i] * dt;
      positions[i3] += velocity[i3] * dt;
      positions[i3 + 1] += velocity[i3 + 1] * dt;
      positions[i3 + 2] += velocity[i3 + 2] * dt;
      if (positions[i3 + 1] < 0.05) positions[i3 + 1] = 0.05;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { object: points, spawn, update };
}

const PUFF_MAX = 30;

export function createPuffs(glowTex) {
  const group = new THREE.Group();
  const pool = [];
  for (let i = 0; i < PUFF_MAX; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    group.add(sprite);
    pool.push({ sprite, life: 0, maxLife: 1, grow: 1, rise: 0.5, driftZ: 0, peak: 0.3 });
  }
  let cursor = 0;

  function spawn(x, y, z, opts) {
    const p = pool[cursor];
    cursor = (cursor + 1) % PUFF_MAX;
    p.sprite.position.set(x, y, z);
    p.sprite.material.color.set(opts.colour);
    p.sprite.material.opacity = opts.opacity;
    p.sprite.scale.setScalar(opts.size);
    p.sprite.visible = true;
    p.life = p.maxLife = opts.life;
    p.grow = opts.grow;
    p.rise = opts.rise;
    p.driftZ = opts.driftZ || 0;
    p.peak = opts.opacity;
  }

  function update(dt) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.sprite.visible = false; p.sprite.material.opacity = 0; continue; }
      const t = 1 - p.life / p.maxLife;
      p.sprite.position.y += p.rise * dt;
      p.sprite.position.z += p.driftZ * dt;
      p.sprite.scale.multiplyScalar(1 + p.grow * dt);
      p.sprite.material.opacity = p.peak * (1 - t) * Math.min(1, t * 6 + 0.15);
    }
  }

  return { object: group, spawn, update };
}

/** Speed streaks: thin additive slivers recycled in a bubble around the craft. */
export function createStreaks() {
  const COUNT = 64;
  const geo = new THREE.BoxGeometry(0.03, 0.03, 3.2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xbfefff, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const seeds = [];
  for (let i = 0; i < COUNT; i += 1) {
    seeds.push({
      x: (Math.random() - 0.5) * 30,
      y: 0.3 + Math.random() * 4.5,
      off: Math.random() * 70,
    });
  }
  function update(playerZ, speedNorm) {
    mat.opacity = Math.max(0, (speedNorm - 0.35)) * 0.55;
    if (mat.opacity <= 0.01) { mesh.visible = false; return; }
    mesh.visible = true;
    for (let i = 0; i < COUNT; i += 1) {
      const s = seeds[i];
      let rel = (s.off + playerZ * 1.9) % 70;
      if (rel < 0) rel += 70;
      dummy.position.set(s.x, s.y, playerZ + 34 - rel);
      dummy.scale.set(1, 1, 0.6 + speedNorm * 1.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { object: mesh, update };
}
