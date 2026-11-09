import * as THREE from 'three';
import { seeded, type Rng } from './rng';

export type Canvas2D = { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D };

export function canvas(w: number, h: number): Canvas2D {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d', { willReadFrequently: false });
  if (!g) throw new Error('2d canvas unavailable');
  return { canvas: c, g };
}

let maxAniso = 8;
export function setMaxAnisotropy(n: number) { maxAniso = Math.max(1, n); }

export function wrap(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean } = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (opts.repeat !== false) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Tileable value noise with smooth interpolation, summed over octaves. Returns values 0..1. */
export function fbm(size: number, cells: number, octaves: number, rng: Rng, gain = 0.5): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1; let total = 0; let freq = cells;
  for (let o = 0; o < octaves; o++) {
    const n = Math.max(1, Math.round(freq));
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n; const y0 = Math.floor(fy); const ty = fy - y0; const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n; const x0 = Math.floor(fx); const tx = fx - x0; const sx = tx * tx * (3 - 2 * tx);
        const a = grid[(y0 % n) * n + (x0 % n)]!; const b = grid[(y0 % n) * n + ((x0 + 1) % n)]!;
        const c = grid[((y0 + 1) % n) * n + (x0 % n)]!; const d = grid[((y0 + 1) % n) * n + ((x0 + 1) % n)]!;
        out[y * size + x] = out[y * size + x]! + amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp; amp *= gain; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / total;
  return out;
}

function fromValues(size: number, values: Float32Array, lo: number, hi: number): HTMLCanvasElement {
  const { canvas: c, g } = canvas(size, size);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(lo + (hi - lo) * values[i]!);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function grain(size: number, seed: number, lo: number, hi: number): HTMLCanvasElement {
  const r = seeded(seed);
  const v = new Float32Array(size * size);
  const coarse = fbm(size, 16, 3, seeded(seed + 1));
  for (let i = 0; i < v.length; i++) v[i] = 0.55 * r() + 0.45 * coarse[i]!;
  return fromValues(size, v, lo, hi);
}

function brushed(size: number, seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  const rows = new Float32Array(size);
  for (let y = 0; y < size; y++) rows[y] = r();
  const smoothRows = new Float32Array(size);
  for (let y = 0; y < size; y++) smoothRows[y] = 0.6 * rows[y]! + 0.2 * rows[(y + 1) % size]! + 0.2 * rows[(y + size - 1) % size]!;
  const along = fbm(size, 4, 3, seeded(seed + 7));
  const v = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const streak = Math.sin((x / size) * Math.PI * 2 * (1 + (y % 5)) + rows[y]! * 6.28) * 0.08;
    v[y * size + x] = 0.62 * smoothRows[y]! + 0.28 * along[(y % size) * size + x]! + streak + 0.1 * r();
  }
  return fromValues(size, v, 70, 190);
}

function perforation(tile: number, hole: number): HTMLCanvasElement {
  const w = tile; const h = Math.round(tile * Math.sqrt(3));
  const { canvas: c, g } = canvas(w, h);
  g.fillStyle = 'rgba(255,255,255,1)'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,1)';
  const rad = (tile * hole) / 2;
  for (const [x, y] of [[0, 0], [w, 0], [w / 2, h / 2], [0, h], [w, h]] as [number, number][]) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
  return c;
}

function braid(size: number): HTMLCanvasElement {
  const { canvas: c, g } = canvas(size, size);
  const img = g.createImageData(size, size);
  const n = 8;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size; const v = y / size;
    const a = (u * n + v * n) % 1; const b = (u * n - v * n + n) % 1;
    const strandA = Math.sin(a * Math.PI); const strandB = Math.sin(b * Math.PI);
    const cell = (Math.floor(u * n * 2) + Math.floor(v * n * 2)) % 2;
    const over = cell === 0 ? strandA : strandB;
    const fiber = 0.5 + 0.5 * Math.sin((cell === 0 ? a : b) * Math.PI * 14);
    const val = 0.25 + 0.6 * over + 0.15 * fiber * over;
    const k = Math.round(Math.min(1, val) * 255);
    const i = (y * size + x) * 4;
    img.data[i] = k; img.data[i + 1] = k; img.data[i + 2] = k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export type TextureSet = {
  grain: THREE.Texture; grainFine: THREE.Texture; peel: THREE.Texture; brushed: THREE.Texture; bead: THREE.Texture;
  perf: THREE.Texture; braid: THREE.Texture; mottle: THREE.Texture; soft: THREE.Texture;
};

/** Every texture is mapped in millimeters: a repeat of 1/tile makes one tile cover that many mm. */
export const TILE_MM = { grain: 24, grainFine: 9, peel: 18, brushed: 48, bead: 10, perf: 3.2, braid: 2.2, mottle: 160, soft: 60 } as const;

let cached: TextureSet | null = null;
let cachedScale = 0;

export function textures(scale = 1): TextureSet {
  if (cached && cachedScale === scale) return cached;
  const s = (n: number) => Math.max(64, Math.round((n * scale) / 64) * 64);
  const tile = (t: THREE.Texture, mm: number) => { t.repeat.set(1 / mm, 1 / mm); return t; };
  cached = {
    grain: tile(wrap(grain(s(256), 3, 96, 164)), TILE_MM.grain),
    grainFine: tile(wrap(grain(s(256), 9, 80, 176)), TILE_MM.grainFine),
    peel: tile(wrap(fromValues(s(512), fbm(s(512), 22, 4, seeded(21), 0.55), 40, 215)), TILE_MM.peel),
    brushed: tile(wrap(brushed(s(1024), 7)), TILE_MM.brushed),
    bead: tile(wrap(grain(s(512), 31, 60, 196)), TILE_MM.bead),
    perf: tile(wrap(perforation(64, 0.62)), TILE_MM.perf),
    braid: tile(wrap(braid(s(256))), TILE_MM.braid),
    mottle: tile(wrap(fromValues(s(512), fbm(s(512), 6, 5, seeded(55), 0.6), 90, 165)), TILE_MM.mottle),
    soft: tile(wrap(fromValues(s(256), fbm(s(256), 8, 3, seeded(77), 0.5), 100, 156)), TILE_MM.soft),
  };
  cachedScale = scale;
  return cached;
}

/** A small data texture of LED colors, one texel per LED, written each frame. */
export function ledTexture(count: number, ring: boolean): THREE.DataTexture {
  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) data[i * 4 + 3] = 255;
  const t = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = ring ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
