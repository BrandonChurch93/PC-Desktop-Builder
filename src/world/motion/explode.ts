import gsap from 'gsap';
import * as THREE from 'three';
import { rotate, type V3 } from '../layout/math';
import type { CaseLayout } from '../layout/types';
import type { Rig, RigItem } from '../rig';
import { Fader } from './fade';

/**
 * How far each part travels out, in mm. Parts on the board come out toward the open side in layers, so the board clears the
 * tray, the drive and the processor clear the board, the memory and the card clear those, and the cooler's head clears the
 * processor it sat on. Everything else leaves along its own mount.
 */
const LAYER: Record<string, number> = { board: 70, storage: 120, cpu: 150, ram: 175, gpu: 215, 'gpu-support': 215, cooler: 260 };
const MOUNT_OUT = 95;
const BAY_OUT = 120;
const SUPPLY_OUT = 150;
/** The glass leaves first and furthest, beyond every layer, and thins so the parts read through it. */
const GLASS_OUT = 340;
const GLASS_LEFT = 0.35;
const DURATION = 1.4;
/** Share of the amount between one part's start and the next, and the most the starts may spread over. */
const STAGGER = 0.025;
const STAGGER_WINDOW = 0.3;
const ORDER = ['glass', 'cooler', 'radiator', 'fan', 'gpu', 'gpu-support', 'ram', 'cpu', 'storage', 'psu', 'board'];

const OUTWARD: Record<string, V3> = { rear: [-1, 0, 0], front: [1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0], side: [0, 0, -1], spine: [1, 0, 0] };

/** Where a placed part goes in the exploded view, as an offset in case space, mm. */
export function explodeOffset(item: RigItem, L: CaseLayout | undefined): THREE.Vector3 {
  const p = item.placed;
  const ins = new THREE.Vector3(...p.insert);
  switch (p.kind) {
    case 'case': return new THREE.Vector3();
    case 'fan': {
      // Out along the fan's own axis, away from the middle of the case. A fan under the floor of the chamber would go into the
      // desk that way, so it comes out toward the open side instead.
      const m = L?.fanMounts.find((f) => f.id === p.meta.mount);
      if (!m || !L) return new THREE.Vector3(...(OUTWARD.top as V3)).multiplyScalar(MOUNT_OUT);
      const axis = new THREE.Vector3(...rotate(m.rot, [0, 0, 1]));
      const mid = new THREE.Vector3(...L.interior.min).add(new THREE.Vector3(...L.interior.max)).multiplyScalar(0.5);
      if (axis.dot(new THREE.Vector3(...m.center).sub(mid)) < 0) axis.negate();
      // Fans in the tray would go behind it out of sight, and fans under the floor into the desk: both come forward instead.
      if (axis.y < -0.5 || axis.z < -0.5) axis.set(0, 0, 1);
      return axis.normalize().multiplyScalar(MOUNT_OUT);
    }
    // A radiator seats outward against its mount from inside; it leaves the same way, through the panel it sits under.
    case 'radiator': return ins.normalize().multiplyScalar(MOUNT_OUT);
    case 'psu': return ins.normalize().multiplyScalar(-SUPPLY_OUT);
    case 'storage':
      if (p.id !== 'nvme') return ins.normalize().multiplyScalar(-BAY_OUT);
      return new THREE.Vector3(0, 0, LAYER.storage!);
    default: return new THREE.Vector3(0, 0, LAYER[p.kind] ?? LAYER.board!);
  }
}

/** The farthest any part goes, so the camera can frame the whole exploded rig. */
export const EXPLODE_REACH = { z: GLASS_OUT, side: Math.max(MOUNT_OUT, SUPPLY_OUT, BAY_OUT) };

/**
 * The Exploded view: one amount from 0 (assembled) to 1 (apart) drives every part along its own axis, the glass out ahead of
 * them, and the cables and tubes away. The same control puts it back.
 */
export class Exploder {
  readonly level = { e: 0 };
  private items: { item: RigItem; offset: THREE.Vector3; home: THREE.Vector3; delay: number }[] = [];
  private glass: { obj: THREE.Object3D; fader: Fader } | null = null;
  private cables: { group: THREE.Object3D; fader: Fader } | null = null;
  private window = 0;
  tl: gsap.core.Timeline | null = null;

  constructor(private rig: Rig, private dirty: () => void) {}

  get active() { return this.level.e > 0.0005; }

  /** Lays out the travel for the parts installed now. Call it again after the build changes. */
  prepare(L: CaseLayout | undefined) {
    this.restoreFaders();
    const order = (i: RigItem) => { const k = ORDER.indexOf(i.placed.kind); return k < 0 ? ORDER.length : k; };
    const list = [...this.rig.items.values()].filter((i) => i.placed.kind !== 'case').sort((a, b) => order(a) - order(b));
    this.window = Math.min(STAGGER_WINDOW, list.length * STAGGER);
    this.items = list.map((item, n) => ({ item, offset: explodeOffset(item, L), home: new THREE.Vector3(...item.placed.pose.pos), delay: list.length > 1 ? this.window * n / (list.length - 1) : 0 }));
    const g = this.rig.items.get('case')?.part.movers.glass;
    this.glass = g ? { obj: g, fader: new Fader(g) } : null;
    this.cables = this.rig.cables ? { group: this.rig.cables, fader: new Fader(this.rig.cables) } : null;
  }

  /** Places everything for the current amount. Each part moves on its own stagger inside the shared amount. */
  apply() {
    const e = this.level.e;
    // Each part starts a little after the one before it, inside the one shared amount, and all arrive together at 1.
    for (const x of this.items) {
      const k = THREE.MathUtils.clamp((e - x.delay) / (1 - this.window), 0, 1);
      const t = k * k * k * (k * (k * 6 - 15) + 10);
      x.item.holder.position.copy(x.home).addScaledVector(x.offset, t);
    }
    if (this.glass) {
      const t = THREE.MathUtils.smootherstep(Math.min(1, e * 1.4), 0, 1);
      this.glass.obj.position.set(0, 0, GLASS_OUT * t);
      this.glass.fader.set(1 - (1 - GLASS_LEFT) * t);
    }
    if (this.cables) this.cables.fader.set(1 - THREE.MathUtils.smoothstep(e, 0, 0.35));
    this.rig.group.updateMatrixWorld(true);
    this.dirty();
  }

  /** Plays to apart or back together. reduced: a short crossfade with no travel shown. */
  run(on: boolean, mode: 'instant' | 'motion' | 'fade', L: CaseLayout | undefined, scrub = false, onDone?: () => void) {
    this.tl?.kill();
    if (on || !this.items.length) this.prepare(L);
    const to = on ? 1 : 0;
    if (mode === 'instant') { this.level.e = to; this.apply(); this.finish(on); onDone?.(); return null; }
    const tl = gsap.timeline({ paused: scrub, onUpdate: () => this.apply(), onComplete: () => { this.finish(on); onDone?.(); } });
    tl.to(this.level, { e: to, duration: mode === 'fade' ? 0.15 : on ? DURATION : DURATION * 0.8, ease: mode === 'fade' ? 'none' : 'power3.inOut' });
    this.tl = tl;
    return tl;
  }

  private finish(on: boolean) {
    if (!on) { this.restoreFaders(); this.items = []; }
  }

  private restoreFaders() {
    for (const x of this.items) x.item.holder.position.set(...x.item.placed.pose.pos);
    if (this.glass) { this.glass.obj.position.set(0, 0, 0); this.glass.fader.dispose(); }
    this.cables?.fader.dispose();
    this.glass = null; this.cables = null;
  }

  /** Where each exploded part sits now, in case space mm, for labels. */
  labels(): { item: RigItem; center: V3 }[] {
    return this.items.map((x) => {
      const b = new THREE.Box3();
      for (const bx of x.item.placed.boxes) { b.expandByPoint(new THREE.Vector3(...bx.min)); b.expandByPoint(new THREE.Vector3(...bx.max)); }
      const c = b.getCenter(new THREE.Vector3()).add(x.item.holder.position).sub(x.home);
      return { item: x.item, center: [c.x, c.y, c.z] as V3 };
    });
  }
}
