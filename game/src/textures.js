// Every texture is painted on a canvas at load — the game ships no image
// files. One helper makes a CanvasTexture with the colour space three.js
// expects for colour maps, and each painter below owns one surface.

const THREE = window.THREE;

function canvasTexture(width, height, painter, repeat) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  painter(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/** Canyon floor: warm sand noise with a paler racing strip down the middle. */
export function groundTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c96f3f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i += 1) {
      const shade = ['#b86234', '#d97f49', '#a95527', '#e08a52'][i % 4];
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    // The strip the speeder runs on: lighter, swept clean, edged with glow lines.
    const strip = ctx.createLinearGradient(56, 0, 200, 0);
    strip.addColorStop(0, 'rgba(255,190,120,0)');
    strip.addColorStop(0.5, 'rgba(255,205,140,0.35)');
    strip.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = strip;
    ctx.fillRect(56, 0, 144, h);
    ctx.fillStyle = 'rgba(55,242,226,0.5)';
    ctx.fillRect(58, 0, 2, h);
    ctx.fillRect(196, 0, 2, h);
    ctx.fillStyle = 'rgba(90,40,20,0.35)';
    for (let i = 0; i < 26; i += 1) ctx.fillRect(70 + Math.random() * 116, Math.random() * h, 8, 1.5);
  }, [1, 190]);
}

/** Canyon wall strata: horizontal bands of baked rock with a dark base. */
export function strataTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const bands = ['#8a4a2b', '#a55a33', '#6e3a22', '#b06a3a', '#7c4526', '#93502c'];
    let y = 0;
    let i = 0;
    while (y < h) {
      const bandH = 18 + ((i * 37) % 26);
      ctx.fillStyle = bands[i % bands.length];
      ctx.fillRect(0, y, w, bandH);
      ctx.fillStyle = 'rgba(30,12,6,0.35)';
      ctx.fillRect(0, y + bandH - 2, w, 2);
      y += bandH;
      i += 1;
    }
    for (let n = 0; n < 1500; n += 1) {
      ctx.fillStyle = n % 3 ? 'rgba(0,0,0,0.16)' : 'rgba(255,200,140,0.13)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // Cracks running down the face.
    ctx.strokeStyle = 'rgba(25,10,5,0.4)';
    ctx.lineWidth = 1.4;
    for (let c = 0; c < 7; c += 1) {
      ctx.beginPath();
      let x = Math.random() * w;
      ctx.moveTo(x, 0);
      for (let yy = 0; yy <= h; yy += 32) {
        x += (Math.random() - 0.5) * 14;
        ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }, [3, 1]);
}

/** The low sun: a hot disc cut by synthwave scanline bands. */
export function sunTexture() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(128, 118, 8, 128, 128, 126);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.35, '#ffd23c');
    g.addColorStop(0.75, '#ff9a3c');
    g.addColorStop(1, 'rgba(255,110,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Bands of sky cut across the lower half, widening toward the base.
    ctx.globalCompositeOperation = 'destination-out';
    let y = 138;
    let gap = 3;
    while (y < h) {
      ctx.fillRect(0, y, w, gap);
      y += gap + 13;
      gap += 2.4;
    }
    ctx.globalCompositeOperation = 'source-over';
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Soft radial glow, shared by thrusters, gates, cores and the sun halo. */
export function glowTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** The Night Wall's face: near-black, flecked with cold stars. */
export function wallTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0618');
    g.addColorStop(0.8, '#05030d');
    g.addColorStop(1, '#030208');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i += 1) {
      const a = Math.random();
      ctx.fillStyle = a > 0.85 ? 'rgba(178,107,255,0.9)' : 'rgba(220,225,255,0.75)';
      ctx.globalAlpha = 0.25 + Math.random() * 0.7;
      const s = Math.random() > 0.92 ? 2.2 : 1.2;
      ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    ctx.globalAlpha = 1;
  }, [6, 3]);
}

/** The Wall's leading edge: darkness until the base, where it burns violet. */
export function wallEdgeTexture() {
  const tex = canvasTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(138,43,226,0)');
    g.addColorStop(0.88, 'rgba(150,60,255,0)');
    g.addColorStop(0.95, 'rgba(170,90,255,0.45)');
    g.addColorStop(1, 'rgba(205,140,255,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Sky dome: dusk gradient, deep violet up top melting to ember horizon. */
export function skyTexture() {
  const tex = canvasTexture(64, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#12082b');
    g.addColorStop(0.42, '#3d1454');
    g.addColorStop(0.62, '#6e2358');
    g.addColorStop(0.78, '#c94b4b');
    g.addColorStop(0.92, '#ff7a3c');
    g.addColorStop(1, '#ffb35c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Early stars in the upper dark.
    for (let i = 0; i < 130; i += 1) {
      const y = Math.random() * h * 0.4;
      ctx.fillStyle = 'rgba(230,235,255,0.8)';
      ctx.globalAlpha = 0.2 + Math.random() * 0.5 * (1 - y / (h * 0.4));
      ctx.fillRect(Math.random() * w, y, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
