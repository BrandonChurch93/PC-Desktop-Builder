import * as THREE from 'three';
import type { Build } from '../engine/types';
import { getGpu } from '../data/catalog';
import { buildCables, cableSignature } from './cables';
import { CASE_LAYOUTS } from './layout/cases';
import { slotsOf } from './layout/partBoxes';
import { rotate, type V3 } from './layout/math';
import { place, type Placed } from './layout/place';
import type { Zone } from './light/zones';
import { generate } from './parts';
import { wellShades } from './well';
import { interiorPatches, type Patch } from './light/patches';
import type { GenOpts, PartObject, Rotor } from './parts/types';

const MM = 0.001;

export type RigItem = { key: string; sig: string; placed: Placed; part: PartObject; holder: THREE.Group };

const OUTWARD: Record<string, V3> = { rear: [-1, 0, 0], front: [1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0], side: [0, 0, -1], spine: [1, 0, 0] };

/** The assembled rig: one object per placed part, posed from the layout, scaled to meters. */
export class Rig {
  readonly group = new THREE.Group();
  readonly items = new Map<string, RigItem>();
  detail = 1;
  onChange: () => void = () => {};

  constructor() {
    this.group.name = 'rig';
    this.group.scale.setScalar(MM);
  }

  private optsFor(p: Placed): GenOpts {
    const o: GenOpts = { detail: this.detail, key: p.key };
    if (p.kind === 'case') o.finish = String(p.meta.finish);
    if (p.kind === 'fan') {
      o.size = Number(p.meta.size) as 120 | 140;
      const L = p.category === 'fan' ? CASE_LAYOUTS[this.caseId ?? ''] : undefined;
      const m = L?.fanMounts.find((f) => f.id === p.meta.mount);
      if (m) {
        const z = rotate(m.rot, [0, 0, 1]);
        const out = OUTWARD[m.group] ?? [0, 1, 0];
        o.mountSide = z[0] * out[0] + z[1] * out[1] + z[2] * out[2] > 0 ? 1 : -1;
      }
    }
    if (p.kind === 'radiator') {
      o.order = p.meta.order as GenOpts['order']; o.pitch = Number(p.meta.pitch); o.airInward = Boolean(p.meta.airInward);
      const cols = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as V3[]).map((e) => rotate(p.pose.rot, e));
      const r = (n: number) => Math.round(n * 1000) / 1000;
      o.localUp = [r(cols[0]![1]), r(cols[1]![1]), r(cols[2]![1])];
      o.localView = [r(cols[0]![2]), r(cols[1]![2]), r(cols[2]![2])];
    }
    if (p.kind === 'gpu-support') o.openFrame = false;
    return o;
  }

  caseId: string | null = null;
  cables: THREE.Group | null = null;
  patches: Patch[] = [];
  private cableSig = '';

  sync(build: Build): void {
    this.caseId = build.case?.id ?? null;
    const placed = place(build);
    const seen = new Set<string>();
    for (const p of placed) {
      const opts = this.optsFor(p);
      const sig = `${p.kind}|${p.id}|${JSON.stringify(opts)}`;
      seen.add(p.key);
      let item = this.items.get(p.key);
      if (item && item.sig !== sig) { this.drop(item); item = undefined; }
      if (!item) {
        const part = generate(p.kind, p.id, opts);
        const holder = new THREE.Group();
        holder.name = p.key;
        holder.add(part.root);
        this.group.add(holder);
        item = { key: p.key, sig, placed: p, part, holder };
        this.items.set(p.key, item);
      }
      item.placed = p;
      item.holder.position.set(...p.pose.pos);
      item.holder.rotation.set(...p.pose.rot);
    }
    for (const item of [...this.items.values()]) if (!seen.has(item.key)) this.drop(item);
    this.group.updateMatrixWorld(true);
    for (const item of this.items.values()) for (const z of item.part.zones) if (!z.owner) z.owner = item.part.root;
    const kase = this.items.get('case');
    const glass = kase?.part.movers.glass;
    if (glass) glass.visible = build.glass;
    const g = build.gpu ? getGpu(build.gpu) : undefined;
    const used = g ? slotsOf(g.thickness) : 0;
    for (let k = 1; k <= 7; k++) { const c = kase?.part.movers[`slot-cover-${k}`]; if (c) c.visible = k > used; }
    const sig = `${cableSignature(build)}|${[...this.items.keys()].join(',')}`;
    if (sig !== this.cableSig) {
      if (this.cables) { this.cables.removeFromParent(); disposeTree(this.cables); }
      this.cables = buildCables(build, this.items, this.detail);
      const layout = build.case ? CASE_LAYOUTS[build.case.id] : undefined;
      const shades = layout ? wellShades(layout, this.items) : null;
      if (shades) this.cables.add(shades);
      const tubes = this.cables.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && o.name === 'tube');
      const inner = layout ? interiorPatches(layout, this.items, tubes) : null;
      if (inner) this.cables.add(inner.group);
      this.patches = inner?.patches ?? [];
      this.group.add(this.cables);
      this.cableSig = sig;
    }
    this.onChange();
  }

  private drop(item: RigItem) {
    item.holder.removeFromParent();
    item.part.dispose();
    this.items.delete(item.key);
  }

  get zones(): Zone[] { return [...this.items.values()].flatMap((i) => i.part.zones); }
  get rotors(): Rotor[] { return [...this.items.values()].flatMap((i) => i.part.rotors); }

  /** Objects the occlusion pass and the mirror must not see. */
  glassObjects(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    this.group.traverse((o) => { if (o.userData.glass || o.userData.spill || o.userData.noAO || o.userData.label) out.push(o); });
    return out;
  }

  /** LED diffusers: in the occlusion depth, but their own pixels take none. */
  emitters(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    this.group.traverse((o) => { if (o instanceof THREE.Mesh && typeof (o.material as THREE.Material).name === 'string' && (o.material as THREE.Material).name.startsWith('diffuser:')) out.push(o); });
    return out;
  }

  glassSpecular(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    this.group.traverse((o) => { if (o.userData.glassSpec) out.push(o); });
    return out;
  }

  bounds(target = new THREE.Box3()): THREE.Box3 {
    target.makeEmpty();
    const c = this.items.get('case');
    if (c) {
      const L = CASE_LAYOUTS[c.placed.id];
      if (L) { target.min.set(...L.outer.min).multiplyScalar(MM); target.max.set(...L.outer.max).multiplyScalar(MM); return target; }
    }
    for (const item of this.items.values()) for (const b of item.placed.boxes) { target.expandByPoint(new THREE.Vector3(...b.min).multiplyScalar(MM)); target.expandByPoint(new THREE.Vector3(...b.max).multiplyScalar(MM)); }
    return target;
  }

  /** World bounds of the placed boxes of one item, in meters. */
  itemBounds(key: string): THREE.Box3 | null {
    const item = this.items.get(key);
    if (!item) return null;
    const b = new THREE.Box3();
    for (const x of item.placed.boxes) { b.expandByPoint(new THREE.Vector3(...x.min).multiplyScalar(MM)); b.expandByPoint(new THREE.Vector3(...x.max).multiplyScalar(MM)); }
    return b;
  }

  dispose() {
    for (const item of [...this.items.values()]) this.drop(item);
    if (this.cables) disposeTree(this.cables);
  }
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => { if (x instanceof THREE.Mesh) x.geometry.dispose(); });
}
