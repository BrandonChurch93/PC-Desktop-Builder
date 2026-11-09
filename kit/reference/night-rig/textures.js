import * as THREE from 'three';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function wrap(c, { repeat = [1, 1], srgb = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

export function grain(size = 256, seed = 1, lo = 110, hi = 150) {
  const [c, g] = cv(size, size);
  const r = rng(seed);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = lo + r() * (hi - lo);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function brushed(size = 512, seed = 7) {
  const [c, g] = cv(size, size);
  const r = rng(seed);
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 14; i++) {
    const y = r() * size, x = r() * size, len = 40 + r() * size * 0.8;
    const v = r() > 0.5 ? 255 : 0;
    g.strokeStyle = `rgba(${v},${v},${v},${0.03 + r() * 0.09})`;
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    if (x + len > size) { g.beginPath(); g.moveTo(x - size, y); g.lineTo(x + len - size, y); g.stroke(); }
  }
  return c;
}

export function perforation(tile = 64, hole = 0.62) {
  const [c, g] = cv(tile * 2, Math.round(tile * 1.732));
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#000';
  const rad = tile * hole * 0.5;
  const pts = [[0, 0], [tile, 0], [tile * 2, 0], [tile * 0.5, c.height / 2], [tile * 1.5, c.height / 2], [0, c.height], [tile, c.height], [tile * 2, c.height]];
  for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
  return c;
}

export function braid(size = 64) {
  const [c, g] = cv(size, size);
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, size, size);
  const n = 4, s = size / n;
  for (let i = -n; i < n * 2; i++) {
    g.strokeStyle = '#c8c8c8'; g.lineWidth = s * 0.34;
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + size, size); g.stroke();
    g.strokeStyle = '#2c2c2c'; g.lineWidth = s * 0.3;
    g.beginPath(); g.moveTo(i * s + size, 0); g.lineTo(i * s, size); g.stroke();
  }
  return c;
}

export function stripes(size = 64, n = 8, soft = true) {
  const [c, g] = cv(size, size);
  for (let x = 0; x < size; x++) {
    const p = (x / size) * n % 1;
    const v = soft ? Math.round(128 + 127 * Math.sin(p * Math.PI * 2)) : (p < 0.5 ? 235 : 20);
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, size);
  }
  return c;
}

export function pcb(size = 1024, seed = 11, base = '#07090d') {
  const [c, g] = cv(size, size);
  const [h, hg] = cv(size, size);
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  hg.fillStyle = '#404040'; hg.fillRect(0, 0, size, size);
  const step = size / 128;
  const draw = (ctx, style, w) => { ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
  for (let i = 0; i < 260; i++) {
    let x = Math.round(r() * 128) * step, y = Math.round(r() * 128) * step;
    const segs = 2 + Math.floor(r() * 4);
    const path = [[x, y]];
    let dir = Math.floor(r() * 4);
    for (let s = 0; s < segs; s++) {
      const len = (2 + Math.floor(r() * 14)) * step;
      const d = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]][(dir + (r() > 0.6 ? 4 : 0)) % 8];
      x += d[0] * len; y += d[1] * len; path.push([x, y]);
      dir = (dir + (r() > 0.5 ? 1 : 3)) % 4;
    }
    const bundle = 1 + Math.floor(r() * 4);
    for (let b = 0; b < bundle; b++) {
      const o = b * step * 1.1;
      for (const [ctx, style, w] of [[g, 'rgba(26,34,48,0.9)', step * 0.42], [hg, '#8a8a8a', step * 0.5]]) {
        draw(ctx, style, w); ctx.beginPath();
        path.forEach(([px, py], k) => k ? ctx.lineTo(px + o, py + o) : ctx.moveTo(px + o, py + o));
        ctx.stroke();
      }
    }
    const [ex, ey] = path[path.length - 1];
    g.fillStyle = '#b9975a'; g.beginPath(); g.arc(ex, ey, step * 0.55, 0, 7); g.fill();
    g.fillStyle = base; g.beginPath(); g.arc(ex, ey, step * 0.22, 0, 7); g.fill();
    hg.fillStyle = '#b0b0b0'; hg.beginPath(); hg.arc(ex, ey, step * 0.6, 0, 7); hg.fill();
  }
  for (let i = 0; i < 520; i++) {
    const x = r() * size, y = r() * size, w = step * (0.7 + r() * 1.4), hh = step * (0.5 + r() * 0.5);
    const rot = r() > 0.5;
    g.fillStyle = r() > 0.7 ? '#2a2018' : '#15171c';
    g.fillRect(x, y, rot ? hh : w, rot ? w : hh);
    g.fillStyle = '#8f9299';
    if (rot) { g.fillRect(x, y, hh, w * 0.22); g.fillRect(x, y + w * 0.78, hh, w * 0.22); }
    else { g.fillRect(x, y, w * 0.22, hh); g.fillRect(x + w * 0.78, y, w * 0.22, hh); }
    hg.fillStyle = '#d0d0d0'; hg.fillRect(x, y, rot ? hh : w, rot ? w : hh);
  }
  g.fillStyle = 'rgba(210,214,222,0.55)';
  g.font = `600 ${step * 1.6}px monospace`;
  for (let i = 0; i < 90; i++) {
    const s = ['R', 'C', 'Q', 'U', 'L', 'D'][Math.floor(r() * 6)] + Math.floor(r() * 900 + 10);
    g.fillText(s, r() * size, r() * size);
  }
  return { color: c, height: h };
}

export function label(text, { font = '700 96px "Unbounded", sans-serif', color = '#ffffff', pad = 24, spacing = 0, h = 160 } = {}) {
  const [m, mg] = cv(4, 4);
  mg.font = font;
  if ('letterSpacing' in mg) mg.letterSpacing = spacing + 'px';
  const w = Math.ceil(mg.measureText(text).width) + pad * 2;
  const [c, g] = cv(w, h);
  g.font = font;
  if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
  g.fillStyle = color; g.textBaseline = 'middle';
  g.fillText(text, pad, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return { tex: t, aspect: w / h };
}

export function ledTexture(n, ring = false) {
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) data[i * 4 + 3] = 255;
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = ring ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function makeTextures() {
  const p = pcb();
  return {
    grain: wrap(grain(256, 3), { repeat: [6, 6] }),
    grainFine: wrap(grain(256, 9, 90, 170), { repeat: [14, 14] }),
    brushed: wrap(brushed(), { repeat: [1, 1], aniso: 16 }),
    perf: wrap(perforation(), { repeat: [60, 34] }),
    braid: wrap(braid(), { repeat: [60, 2] }),
    fins: wrap(stripes(64, 8), { repeat: [24, 1] }),
    pcbColor: wrap(p.color, { srgb: true, aniso: 16 }),
    pcbHeight: wrap(p.height, { aniso: 16 }),
  };
}
