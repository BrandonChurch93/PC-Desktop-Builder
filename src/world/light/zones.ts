import * as THREE from 'three';
import type { LightTarget } from '../../data/catalog';
import { ledHash } from '../../engine/lighting';
import { ledTexture } from '../kit/textures';

export type Emitter = { center: THREE.Vector3; normal: THREE.Vector3; right: THREE.Vector3; w: number; h: number; weight: number };

/** One addressable strip or ring of LEDs. Its colors are written each frame into a small texture its diffusers sample. */
export class Zone {
  readonly tex: THREE.DataTexture;
  readonly colors: Float32Array;
  readonly hashes: Float32Array;
  readonly avg = new THREE.Color(0, 0, 0);
  /** LED positions in the space of `owner`, in mm */
  readonly leds: THREE.Vector3[];
  owner: THREE.Object3D | null = null;
  readonly emitters: Emitter[] = [];
  readonly world: THREE.Vector3[];
  readonly pn: Float32Array;
  temp = 30;
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private second: THREE.Texture | null = null;
  readonly listeners: ((c: THREE.Color, z: Zone) => void)[] = [];

  constructor(readonly key: string, readonly target: LightTarget, readonly ring: boolean, leds: THREE.Vector3[], readonly phase: number) {
    this.leds = leds;
    this.tex = ledTexture(leds.length, ring);
    this.colors = new Float32Array(leds.length * 3);
    this.hashes = new Float32Array(leds.map((_, i) => ledHash(key, i)));
    this.world = leds.map(() => new THREE.Vector3());
    this.pn = new Float32Array(leds.length);
  }

  get count() { return this.leds.length; }

  /** u of LED i along the zone */
  u(i: number) { return this.ring ? i / this.count : this.count > 1 ? i / (this.count - 1) : 0; }

  /** A diffuser that samples this zone along its uv x. */
  diffuser(intensity: number, base = 0x1d1e23, rough = 0.32): THREE.MeshStandardMaterial {
    const key = `${intensity}|${base}|${rough}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: base, roughness: rough, metalness: 0, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: intensity });
      m.name = `diffuser:${this.key}`;
      this.mats.set(key, m);
    }
    return m;
  }

  /** The same colors on the second uv set, for lit marks whose shape comes from an alpha map. */
  secondary(): THREE.Texture {
    if (!this.second) { this.second = this.tex.clone(); this.second.channel = 1; }
    return this.second;
  }

  /** A patch of emitted light: its center and normal, w along the right axis and h across it, in the owner's space. */
  emit(center: THREE.Vector3, normal: THREE.Vector3, w: number, h: number, weight = 1, right?: THREE.Vector3) {
    const n = normal.clone().normalize();
    const r = (right ?? (Math.abs(n.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0))).clone();
    r.addScaledVector(n, -r.dot(n)).normalize();
    this.emitters.push({ center, normal: n, right: r, w, h, weight });
  }

  write() {
    const d = this.tex.image.data as Uint8Array;
    let r = 0; let g = 0; let b = 0;
    for (let i = 0; i < this.count; i++) {
      const cr = this.colors[i * 3]!; const cg = this.colors[i * 3 + 1]!; const cb = this.colors[i * 3 + 2]!;
      r += cr; g += cg; b += cb;
      d[i * 4] = Math.round(Math.min(1, toSrgb(cr)) * 255);
      d[i * 4 + 1] = Math.round(Math.min(1, toSrgb(cg)) * 255);
      d[i * 4 + 2] = Math.round(Math.min(1, toSrgb(cb)) * 255);
    }
    this.tex.needsUpdate = true;
    if (this.second) this.second.needsUpdate = true;
    const n = Math.max(1, this.count);
    this.avg.setRGB(r / n, g / n, b / n);
    for (const fn of this.listeners) fn(this.avg, this);
  }

  dispose() {
    this.tex.dispose();
    this.second?.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
  }
}

const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export function ringLeds(radius: number, count: number, z = 0): THREE.Vector3[] {
  return Array.from({ length: count }, (_, i) => { const a = (i / count) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z); });
}

export function stripLeds(from: THREE.Vector3, to: THREE.Vector3, spacing = 7): THREE.Vector3[] {
  const n = Math.max(2, Math.round(from.distanceTo(to) / spacing) + 1);
  return Array.from({ length: n }, (_, i) => from.clone().lerp(to, i / (n - 1)));
}

/** Sets uv x along one axis from 0 to 1 over the geometry's extent, for strip diffusers. */
export function uvAlong(g: THREE.BufferGeometry, axis: 'x' | 'y' | 'z'): THREE.BufferGeometry {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const p = g.getAttribute('position');
  const lo = b.min[axis]; const span = Math.max(1e-6, b.max[axis] - lo);
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = ((axis === 'x' ? p.getX(i) : axis === 'y' ? p.getY(i) : p.getZ(i)) - lo) / span; uv[i * 2 + 1] = 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Sets uv x to the angle around the z axis, for rings that wrap. */
export function uvAround(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)); uv[i * 2] = (a / (Math.PI * 2) + 1) % 1; uv[i * 2 + 1] = 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
