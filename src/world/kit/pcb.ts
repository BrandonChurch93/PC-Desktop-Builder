import * as THREE from 'three';
import { seededFor } from './rng';
import { canvas, wrap } from './textures';

const cache = new Map<string, THREE.MeshPhysicalMaterial>();

/** Gold edge fingers on a board edge: a strip of pads with gaps, drawn once per layout and cached. */
export function fingerMaterial(key: string, lengthMm: number, heightMm: number, pitch: number, notches: [number, number][], base: string, rough = 0.42, gold = 'rgba(222,178,96,1)'): THREE.MeshPhysicalMaterial {
  const k = `${key}|${lengthMm}|${heightMm}|${pitch}|${base}|${rough}|${gold}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const ppm = 14;
  const W = Math.round(lengthMm * ppm); const H = Math.round(heightMm * ppm);
  const col = canvas(W, H); const met = canvas(W, H);
  col.g.fillStyle = base; col.g.fillRect(0, 0, W, H);
  met.g.fillStyle = 'rgba(0,0,0,1)'; met.g.fillRect(0, 0, W, H);
  const pad = pitch * 0.7;
  for (let x = pitch / 2; x < lengthMm; x += pitch) {
    if (notches.some(([a, b]) => x > a - pad && x < b + pad)) continue;
    const top = heightMm * 0.16;
    col.g.fillStyle = gold;
    col.g.fillRect((x - pad / 2) * ppm, top * ppm, pad * ppm, (heightMm - top - 0.25) * ppm);
    met.g.fillStyle = 'rgba(255,255,255,1)';
    met.g.fillRect((x - pad / 2) * ppm, top * ppm, pad * ppm, (heightMm - top - 0.25) * ppm);
  }
  const m = new THREE.MeshPhysicalMaterial({ map: wrap(col.canvas, { srgb: true, repeat: false }), metalnessMap: wrap(met.canvas, { repeat: false }), metalness: 1, roughness: rough });
  m.name = `fingers:${key}`;
  cache.set(k, m);
  return m;
}

/** A plane with uv 0..1 across its width (u) and height (v), facing +z, with its bottom edge at y=0. */
export function stripPlane(w: number, h: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  return g;
}

const boardCache = new Map<string, THREE.MeshPhysicalMaterial>();

/** Solder mask for a small board (drive, card edge): traces, vias and tidy clusters of passives, drawn in mm with uv in mm. */
/**
 * Routed traces as a board house lays them out: bundles of parallel traces in their own lanes, running straight with one
 * 45 degree jog and ending in a via at each end, kept inside the board's margin. Random single traces crossed each other
 * and ran off the edges, and read as scribbles.
 */
type Rect = [number, number, number, number];
const hits = (c: Rect[], x0: number, y0: number, x1: number, y1: number) => c.some(([a, b, cc, d]) => x0 < cc && x1 > a && y0 < d && y1 > b);

function routedTraces(g: CanvasRenderingContext2D, r: () => number, wMm: number, hMm: number, ppm: number, look: { mask: string; trace: string; pad: string }, clear: Rect[]) {
  const margin = 1.2; const lane = 2.8; const pitch = 0.42;
  const lanes = Math.floor((hMm - 2 * margin) / lane);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 0.2 * ppm; g.strokeStyle = look.trace;
  const via = (x: number, y: number) => {
    g.fillStyle = look.pad; g.beginPath(); g.arc(x * ppm, y * ppm, 0.24 * ppm, 0, Math.PI * 2); g.fill();
    g.fillStyle = look.mask; g.beginPath(); g.arc(x * ppm, y * ppm, 0.1 * ppm, 0, Math.PI * 2); g.fill();
  };
  for (let l = 0; l < lanes; l++) {
    let x = margin + r() * 4;
    while (x < wMm - margin - 8) {
      const len = 6 + r() * 16; const x1 = Math.min(wMm - margin, x + len);
      const n = 2 + Math.floor(r() * 4);
      const y0 = margin + l * lane + 0.4; const jog = r() > 0.5 ? (r() > 0.5 ? 1 : -1) * pitch * 2 : 0;
      const xj = x + (x1 - x) * (0.3 + r() * 0.4);
      if (hits(clear, x - 0.6, y0 - 1, x1 + 0.6, y0 + n * pitch + 1)) { x = x1 + 2 + r() * 6; continue; }
      for (let k = 0; k < n; k++) {
        const y = y0 + k * pitch; const yb = Math.max(margin, Math.min(hMm - margin, y + jog));
        g.beginPath(); g.moveTo(x * ppm, y * ppm); g.lineTo(xj * ppm, y * ppm); g.lineTo((xj + Math.abs(jog)) * ppm, yb * ppm); g.lineTo(x1 * ppm, yb * ppm); g.stroke();
        via(x + (k % 2) * 0.55, y); via(x1 - (k % 2) * 0.55, yb);
      }
      x = x1 + 2 + r() * 6;
    }
  }
}

export function smallBoardMaterial(key: string, wMm: number, hMm: number, look: { mask: string; trace: string; pad: string; body: string }, origin: [number, number] = [0, 0], density = 1, routed = false, clear: Rect[] = []): THREE.MeshPhysicalMaterial {
  const hit = boardCache.get(key);
  if (hit) return hit;
  const ppm = 10;
  const W = Math.round(wMm * ppm); const H = Math.round(hMm * ppm);
  const { canvas: c, g } = canvas(W, H);
  const r = seededFor(`small-board-${key}`);
  g.fillStyle = look.mask; g.fillRect(0, 0, W, H);
  g.strokeStyle = look.trace; g.lineWidth = 0.3 * ppm; g.lineCap = 'round'; g.lineJoin = 'round';
  const step = 1.27;
  if (routed) routedTraces(g, r, wMm, hMm, ppm, look, clear);
  for (let i = 0; i < (routed ? 0 : Math.round((wMm * hMm * density) / 90)); i++) {
    let x = Math.round((r() * wMm) / step) * step; let y = Math.round((r() * hMm) / step) * step;
    g.beginPath(); g.moveTo(x * ppm, y * ppm);
    let dir = Math.floor(r() * 4);
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
      const len = (3 + Math.floor(r() * 12)) * step; const diag = r() > 0.55;
      const d = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]][dir]! : [[1, 0], [0, 1], [-1, 0], [0, -1]][dir]!;
      x += d[0]! * len; y += d[1]! * len; g.lineTo(x * ppm, y * ppm);
      dir = (dir + (r() > 0.5 ? 1 : 3)) % 4;
    }
    g.stroke();
    if (i % 3 === 0) { g.fillStyle = look.pad; g.beginPath(); g.arc(x * ppm, y * ppm, 0.34 * ppm, 0, Math.PI * 2); g.fill(); g.fillStyle = look.mask; g.beginPath(); g.arc(x * ppm, y * ppm, 0.14 * ppm, 0, Math.PI * 2); g.fill(); }
  }
  for (let i = 0; i < Math.round((wMm * hMm * density) / 400); i++) {
    const x0 = 3 + r() * (wMm - 12); const y0 = 3 + r() * (hMm - 12); const along = r() > 0.5; const n = 3 + Math.floor(r() * 5);
    if (hits(clear, x0 - 1, y0 - 1, x0 + 10, y0 + 10)) continue;
    for (let k = 0; k < n; k++) {
      const x = along ? x0 + k * 1.8 : x0; const y = along ? y0 : y0 + k * 1.8;
      const bw = along ? 0.6 : 1.1; const bh = along ? 1.1 : 0.6;
      g.fillStyle = look.body; g.fillRect(x * ppm, y * ppm, bw * ppm, bh * ppm);
      g.fillStyle = look.pad;
      if (along) { g.fillRect(x * ppm, y * ppm, bw * ppm, 0.24 * ppm); g.fillRect(x * ppm, (y + bh - 0.24) * ppm, bw * ppm, 0.24 * ppm); }
      else { g.fillRect(x * ppm, y * ppm, 0.24 * ppm, bh * ppm); g.fillRect((x + bw - 0.24) * ppm, y * ppm, 0.24 * ppm, bh * ppm); }
    }
  }
  const map = wrap(c, { srgb: true, repeat: false });
  map.repeat.set(1 / wMm, 1 / hMm);
  map.offset.set(-origin[0] / wMm, -origin[1] / hMm);
  const m = new THREE.MeshPhysicalMaterial({ map, metalness: 0.05, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  m.name = `small-board:${key}`;
  boardCache.set(key, m);
  return m;
}
