import * as THREE from 'three';
import { canvas, wrap } from './textures';

const cache = new Map<string, THREE.MeshPhysicalMaterial>();

/** Gold edge fingers on a board edge: a strip of pads with gaps, drawn once per layout and cached. */
export function fingerMaterial(key: string, lengthMm: number, heightMm: number, pitch: number, notches: [number, number][], base: string): THREE.MeshPhysicalMaterial {
  const k = `${key}|${lengthMm}|${heightMm}|${pitch}|${base}`;
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
    const short = Math.floor(x / pitch) % 2 === 0;
    const top = short ? heightMm * 0.22 : heightMm * 0.12;
    col.g.fillStyle = 'rgba(222,178,96,1)';
    col.g.fillRect((x - pad / 2) * ppm, top * ppm, pad * ppm, (heightMm - top - 0.25) * ppm);
    met.g.fillStyle = 'rgba(255,255,255,1)';
    met.g.fillRect((x - pad / 2) * ppm, top * ppm, pad * ppm, (heightMm - top - 0.25) * ppm);
  }
  const m = new THREE.MeshPhysicalMaterial({ map: wrap(col.canvas, { srgb: true, repeat: false }), metalnessMap: wrap(met.canvas, { repeat: false }), metalness: 1, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2 });
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
