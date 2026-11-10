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
  private spills = new Map<number, THREE.MeshBasicMaterial>();
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
  diffuser(intensity: number, base = 0x1d1e23, rough = 0.7): THREE.MeshStandardMaterial {
    const key = `${intensity}|${base}|${rough}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: base, roughness: rough, metalness: 0, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: intensity });
      m.name = `diffuser:${this.key}`;
      this.mats.set(key, m);
    }
    return m;
  }

  /**
   * Light a diffuser throws on the surface right beside it: the zone's live colors along u, fading out along v.
   * The lamps are few and broad, so they cannot tint a spreader lip or a fan frame a few millimeters from the LEDs.
   */
  spill(gain: number): THREE.MeshBasicMaterial {
    let m = this.spills.get(gain);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ map: this.tex, alphaMap: falloff(), color: new THREE.Color(gain, gain, gain), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -0.5, polygonOffsetUnits: -2 });
      m.name = `spill:${this.key}`;
      this.spills.set(gain, m);
    }
    return m;
  }

  /**
   * Light glowing through a frosted white surface beside a zone: the surface takes the LED color over its own white, as
   * much as the LEDs are lit. An added spill cannot tint white, which already reflects every channel of the studio light.
   */
  tint(gain: number, cover: number, fade = true): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ map: this.tex, ...(fade ? { alphaMap: falloff() } : {}), color: new THREE.Color(gain, gain, gain), transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    m.name = `tint:${this.key}`;
    m.onBeforeCompile = (sh) => {
      // The tint takes the LEDs' hue at full value and their brightness as its cover.
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\nfloat tintMax = max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b);\nfloat tintLed = tintMax / ${gain.toFixed(3)};\ndiffuseColor.rgb *= 0.9 / max(tintLed, 1e-4);\ndiffuseColor.a *= ${cover.toFixed(3)} * smoothstep(0.0, 0.35, tintLed);`);
    };
    m.customProgramCacheKey = () => `zone-tint-${gain}-${cover}`;
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
      const k = diffuserScale(cr, cg, cb);
      d[i * 4] = Math.round(Math.min(1, toSrgb(cr * k)) * 255);
      d[i * 4 + 1] = Math.round(Math.min(1, toSrgb(cg * k)) * 255);
      d[i * 4 + 2] = Math.round(Math.min(1, toSrgb(cb * k)) * 255);
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
    for (const m of this.spills.values()) m.dispose();
    this.spills.clear();
  }
}

/**
 * Light colors with a high luminance (lime, cyan, yellow) clip to white on an emissive diffuser long before pink or blue do.
 * The diffuser texture gets a soft luminance ceiling so every hue stays saturated at the same brightness setting.
 */
const LUMA_CEILING = 0.4;
function diffuserScale(r: number, g: number, b: number): number {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > LUMA_CEILING ? LUMA_CEILING / luma : 1;
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

let falloffTex: THREE.DataTexture | null = null;
function falloff(): THREE.DataTexture {
  if (falloffTex) return falloffTex;
  const n = 64;
  const d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const a = Math.round(255 * Math.pow(1 - i / (n - 1), 2.2)); d[i * 4] = a; d[i * 4 + 1] = a; d[i * 4 + 2] = a; d[i * 4 + 3] = 255; }
  falloffTex = new THREE.DataTexture(d, 1, n);
  falloffTex.magFilter = THREE.LinearFilter; falloffTex.minFilter = THREE.LinearFilter;
  falloffTex.needsUpdate = true;
  return falloffTex;
}

/** A spill strip in the xy plane: u runs along x over its length, v from its top edge (y = 0) down to y = -depth. */
/**
 * Surfaces that mark themselves in the stencil buffer, and spills that only land on them. A spill plane laid over fins also
 * lit the dark gaps between them; limited to its receivers it lights the fin tops and faces only.
 */
const SPILL_STENCIL = 1;
export function spillReceiver<M extends THREE.Material>(m: M): M {
  m.stencilWrite = true; m.stencilRef = SPILL_STENCIL; m.stencilFunc = THREE.AlwaysStencilFunc; m.stencilZPass = THREE.ReplaceStencilOp;
  return m;
}
export function onReceivers<M extends THREE.Material>(m: M): M {
  m.stencilWrite = true; m.stencilWriteMask = 0; m.stencilRef = SPILL_STENCIL; m.stencilFunc = THREE.EqualStencilFunc; m.stencilZPass = THREE.KeepStencilOp;
  return m;
}

export function spillStrip(length: number, depth: number, segments = 1): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(length, depth, segments, 1);
  g.translate(0, -depth / 2, 0);
  const p = g.getAttribute('position'); const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / length + 0.5, -p.getY(i) / depth);
  return g;
}

/** Fades a spill strip out over its last few millimeters at both ends, as light falls off past the end of its strip. */
export function fadeEnds(g: THREE.BufferGeometry, fade: number): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  let x0 = Infinity; let x1 = -Infinity;
  for (let i = 0; i < p.count; i++) { x0 = Math.min(x0, p.getX(i)); x1 = Math.max(x1, p.getX(i)); }
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.min(p.getX(i) - x0, x1 - p.getX(i)) / fade);
    const k = t * t * (3 - 2 * t);
    col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Part of a spill strip: the piece from 'from' to 'to' along a strip of length 'total' centered on x = 0, so u still matches the LEDs. */
export function spillStripRange(total: number, from: number, to: number, depth: number, segments = 1): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(to - from, depth, segments, 1);
  g.translate((from + to) / 2, -depth / 2, 0);
  const p = g.getAttribute('position'); const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / total + 0.5, -p.getY(i) / depth);
  return g;
}

/** A spill ring in the xy plane: u around the ring as the LEDs run, v from the edge at radius 'from' to radius 'to'. */
export function spillRing(from: number, to: number, segments = 96): THREE.BufferGeometry {
  const inner = Math.min(from, to); const outer = Math.max(from, to);
  const g = new THREE.RingGeometry(inner, outer, segments, 1);
  const uv = g.getAttribute('uv');
  for (let j = 0; j <= 1; j++) for (let i = 0; i <= segments; i++) {
    const r = j === 0 ? inner : outer;
    uv.setXY(j * (segments + 1) + i, i / segments, Math.abs(r - from) / Math.abs(to - from));
  }
  return g;
}
