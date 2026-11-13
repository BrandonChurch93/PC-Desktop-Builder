import * as THREE from 'three';
import type { PartObject } from './types';

/** A part as it was generated: each node's transform and visibility, and each mesh's own material. */
type Snapshot = { nodes: { o: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; v: boolean; cs: boolean; rs: boolean }[]; mats: { m: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] };

const snapshots = new WeakMap<PartObject, Snapshot>();

/** Records a freshly generated part, so it can be returned to exactly this state when it goes into the cache. */
export function track(part: PartObject): PartObject {
  const s: Snapshot = { nodes: [], mats: [] };
  part.root.traverse((o) => {
    s.nodes.push({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), v: o.visible, cs: o.castShadow, rs: o.receiveShadow });
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) s.mats.push({ m: o as THREE.Mesh, mat: o.material as THREE.Material });
  });
  snapshots.set(part, s);
  return part;
}

/** Puts a used part back as it was generated: fittings at rest, nothing hidden, its own materials, no shadow flags added. */
function reset(part: PartObject): boolean {
  const s = snapshots.get(part);
  if (!s) return false;
  for (const n of s.nodes) { n.o.position.copy(n.p); n.o.quaternion.copy(n.q); n.o.scale.copy(n.s); n.o.visible = n.v; n.o.castShadow = n.cs; n.o.receiveShadow = n.rs; }
  for (const x of s.mats) if (x.m.material !== x.mat) x.m.material = x.mat;
  part.root.removeFromParent();
  for (const z of part.zones) z.owner = null;
  return true;
}

/** Bytes a part holds on the GPU, roughly: its geometry buffers and its own canvas textures, each counted once. */
function bytesOf(part: PartObject, shared: Set<THREE.Texture>): number {
  const geos = new Set<THREE.BufferGeometry>(); const texs = new Set<THREE.Texture>();
  part.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.geometry) return;
    geos.add(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat) continue;
      for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture && !shared.has(v as THREE.Texture)) texs.add(v as THREE.Texture);
    }
  });
  let b = 0;
  for (const g of geos) { for (const a of Object.values(g.attributes)) b += (a as THREE.BufferAttribute).array.byteLength; if (g.index) b += g.index.array.byteLength; }
  for (const t of texs) { const img = t.image as { width?: number; height?: number } | null; if (img?.width && img.height) b += img.width * img.height * 4 * (t.generateMipmaps ? 1.34 : 1); }
  return b;
}

/**
 * Generated parts kept for reuse, least recently used first out, within a byte budget. A part that leaves the rig, the held
 * model, or the Inspector comes back here instead of being disposed, so the next time it is needed nothing generates and
 * nothing uploads. Keys carry everything a generator takes, so a key always means the same object.
 */
export class PartCache {
  private map = new Map<string, { part: PartObject; bytes: number }[]>();
  private order: { key: string; part: PartObject; bytes: number }[] = [];
  private used = 0;
  shared = new Set<THREE.Texture>();

  constructor(public budget: number) {}

  get bytes() { return this.used; }
  get count() { return this.order.length; }
  has(key: string) { return (this.map.get(key)?.length ?? 0) > 0; }

  take(key: string): PartObject | null {
    const list = this.map.get(key);
    const e = list?.pop();
    if (!e) return null;
    if (!list!.length) this.map.delete(key);
    this.order = this.order.filter((x) => x.part !== e.part);
    this.used -= e.bytes;
    return e.part;
  }

  /** Keeps a part for later. One it cannot reset to its generated state is disposed instead. */
  put(key: string, part: PartObject) {
    if (!reset(part)) { part.dispose(); return; }
    const bytes = bytesOf(part, this.shared);
    if (bytes > this.budget) { part.dispose(); return; }
    let list = this.map.get(key);
    if (!list) { list = []; this.map.set(key, list); }
    list.push({ part, bytes });
    this.order.push({ key, part, bytes });
    this.used += bytes;
    this.trim();
  }

  /** A new budget; a smaller one lets the oldest parts go now. */
  setBudget(bytes: number) { this.budget = bytes; this.trim(); }

  private trim() {
    while (this.used > this.budget && this.order.length) {
      const old = this.order.shift()!;
      const l = this.map.get(old.key);
      if (l) { const i = l.findIndex((x) => x.part === old.part); if (i >= 0) l.splice(i, 1); if (!l.length) this.map.delete(old.key); }
      this.used -= old.bytes;
      old.part.dispose();
    }
  }

  clear() {
    for (const e of this.order) e.part.dispose();
    this.map.clear(); this.order = []; this.used = 0;
  }
}

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
/** About 256 MB on a desktop, about 96 MB on a touch device. */
export const CACHE_BUDGET = (coarse ? 96 : 256) * 1024 * 1024;
export const partCache = new PartCache(CACHE_BUDGET);
