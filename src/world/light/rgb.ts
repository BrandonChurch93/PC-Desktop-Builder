import * as THREE from 'three';
import type { LightTarget } from '../../data/catalog';
import { flowPosition, ledColor, profileFor, zoneTemp, type Led, type RGB } from '../../engine/lighting';
import type { Lighting, Temps } from '../../engine/types';
import type { Patch } from './patches';
import type { Zone } from './zones';

const MM = 0.001;
/** How far apart emitters of one kit (memory sticks, stacked fans) can be and still push their shared lamp outward. */
const KIT_REACH = 0.04;

type Lamp = { light: THREE.RectAreaLight; zones: Zone[]; gain: number };
type Pool = { mesh: THREE.Mesh; weights: { zone: Zone; w: number }[]; share: number };

/**
 * The case faces light leaves through: the front, the rear and the glass side. The tray side is solid in every case.
 * Only LEDs close to the front or rear wall shine out through it: a front fan's inner face also faces the rear, but its light
 * crosses the case and lands on the parts inside. Everything that faces the glass sees out through it.
 */
const POOL_DIRS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1)];
const POOL_REACH = [0.06, 0.06, Infinity];
const POOL_DEPTH = 0.42;
const POOL_HEIGHT = 0.22;
const POOL_GAIN = 0.16;

/** Strong at the case wall, falling off across the desk, soft at both ends. */
function poolTexture(): THREE.Texture {
  const W = 64; const H = 128;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (y + 0.5) / H; const u = (x + 0.5) / W;
    const side = Math.min(1, Math.min(u, 1 - u) / 0.22);
    const rise = Math.min(1, v / 0.14);
    const a = rise * rise * (3 - 2 * rise) * Math.exp(-4.2 * v) * (1 - v) * side * side * (3 - 2 * side);
    const i = (y * W + x) * 4; const k = Math.round(255 * a);
    data[i] = k; data[i + 1] = k; data[i + 2] = k; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, W, H);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/**
 * A lamp stands for several zones, and averaging different hues (pink, violet, cyan) gives a pale lavender that no LED shows.
 * Push the average away from its grey by the same factor the mix lost, then normalize to its peak.
 */
const CHROMA = 1.6;

/**
 * The room's share of the rig's light. A dim frame (a comet's trail, the low point of a breath) still tints the wall and the
 * desk the way the eye sees it, instead of vanishing under the backdrop; at a bright synced effect's level it is linear.
 */
const WASH_FULL = 0.85;
const WASH_CURVE = 0.3;
const roomShare = (peak: number) => (peak >= WASH_FULL ? peak : WASH_FULL * (Math.max(0, peak) / WASH_FULL) ** WASH_CURVE);
function saturate(r: number, g: number, b: number, out: THREE.Color) {
  const grey = (r + g + b) / 3;
  const rr = Math.max(0, grey + (r - grey) * CHROMA); const gg = Math.max(0, grey + (g - grey) * CHROMA); const bb = Math.max(0, grey + (b - grey) * CHROMA);
  const peak = Math.max(rr, gg, bb, 1e-5);
  out.setRGB(rr / peak, gg / peak, bb / peak);
}

/** Computes every LED each frame from the pure color function, writes the zone textures, and drives the lamps. */
export class RgbEngine {
  zones: Zone[] = [];
  lighting: Lighting | null = null;
  temps: Temps = { cpuC: null, gpuC: null };
  /** overall power level, 0 to 1 */
  power = 0;
  /** extra per target power level used by the power on sequence */
  readonly targetPower: Record<LightTarget, number> = { case: 1, board: 1, cooler: 1, ram: 1, gpu: 1, fans: 1 };
  private lamps: Lamp[] = [];
  private wall: THREE.RectAreaLight;
  private xmin = -0.25;
  private xmax = 0.25;
  private readonly out: RGB = { r: 0, g: 0, b: 0 };
  private readonly led: Led = { u: 0, pn: 0, phase: 0, hash: 0, tempC: 30 };
  readonly average = new THREE.Color(0, 0, 0);
  lampCount = 8;
  lampGain = 1;

  private pools: Pool[] = [];
  patches: Patch[] = [];
  private poolAlpha: THREE.Texture | null = null;
  readonly poolGroup = new THREE.Group();

  /** lampParent: what the LED lamps hang from. The Inspector turns its table after the lamps are laid out, so its lamps ride the table. */
  constructor(scene: THREE.Object3D, private wallWash = true, private deskPools = false, private lampParent: THREE.Object3D = scene) {
    this.wall = new THREE.RectAreaLight(0xffffff, 0, 0.5, 0.46);
    this.wall.visible = wallWash;
    this.wall.name = 'lamp:wall';
    scene.add(this.wall);
    this.poolGroup.name = 'led-pools';
    if (deskPools) scene.add(this.poolGroup);
  }

  setZones(zones: Zone[], bounds: THREE.Box3) {
    this.zones = zones;
    this.xmin = bounds.isEmpty() ? -0.25 : bounds.min.x;
    this.xmax = bounds.isEmpty() ? 0.25 : bounds.max.x;
    for (const z of zones) {
      if (!z.owner) continue;
      z.owner.updateWorldMatrix(true, false);
      z.leds.forEach((p, i) => {
        const w = z.world[i]!.copy(p).applyMatrix4(z.owner!.matrixWorld);
        z.pn[i] = flowPosition(w.x, w.y, this.xmin, this.xmax);
      });
    }
    this.buildLamps();
    const c = new THREE.Vector3(); bounds.getCenter(c);
    const size = new THREE.Vector3(); bounds.getSize(size);
    this.wall.position.set(c.x, c.y + size.y * 0.1, bounds.isEmpty() ? -0.2 : bounds.min.z - 0.02);
    this.wall.width = Math.max(0.3, size.x * 1.1); this.wall.height = Math.max(0.3, size.y * 0.95);
    this.wall.lookAt(c.x, c.y + size.y * 0.1, -5);
    if (this.deskPools) this.buildPools(bounds);
  }

  /**
   * Light that leaves the case through the front mesh, the rear grille and the glass lands on the desk beside it. Each open
   * face gets a soft pool on the desk, colored by the LEDs that face out through it, weighted toward the low ones.
   */
  private buildPools(bounds: THREE.Box3) {
    for (const p of this.pools) { p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); p.mesh.removeFromParent(); }
    this.pools = [];
    if (bounds.isEmpty() || !this.zones.length) return;
    this.poolAlpha ??= poolTexture();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [d, dir] of POOL_DIRS.entries()) {
      const weights = new Map<Zone, number>();
      const wall = dir.x > 0 ? bounds.max.x : dir.x < 0 ? -bounds.min.x : bounds.max.z;
      for (const z of this.zones) {
        if (!z.owner) continue;
        const q = new THREE.Quaternion(); z.owner.getWorldQuaternion(q);
        const s = new THREE.Vector3(); z.owner.getWorldScale(s);
        for (const e of z.emitters) {
          const n = e.normal.clone().applyQuaternion(q).normalize();
          const facing = n.dot(dir);
          if (facing < 0.5) continue;
          const c = e.center.clone().applyMatrix4(z.owner.matrixWorld);
          const gap = wall - c.dot(dir);
          if (gap > POOL_REACH[d]!) continue;
          const y = c.y - bounds.min.y;
          const w = facing * e.weight * e.w * e.h * s.x * s.x / (1 + (y / POOL_HEIGHT) ** 2);
          weights.set(z, (weights.get(z) ?? 0) + w);
        }
      }
      const total = [...weights.values()].reduce((a, b) => a + b, 0);
      if (total <= 0) continue;
      const along = dir.clone().cross(up);
      const span = Math.abs(along.x) * (bounds.max.x - bounds.min.x) + Math.abs(along.z) * (bounds.max.z - bounds.min.z);
      const edge = dir.x > 0 ? bounds.max.x : dir.x < 0 ? bounds.min.x : dir.z > 0 ? bounds.max.z : bounds.min.z;
      const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: this.poolAlpha, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.2, POOL_DEPTH), mat);
      const center = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.min.y + 0.0009, (bounds.min.z + bounds.max.z) / 2);
      if (dir.x !== 0) center.x = edge; else center.z = edge;
      center.addScaledVector(dir, POOL_DEPTH / 2);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.makeBasis(along, dir, up).setPosition(center);
      mesh.renderOrder = 2;
      mesh.name = 'pool';
      this.poolGroup.add(mesh);
      this.pools.push({ mesh, weights: [...weights.entries()].map(([zone, w]) => ({ zone, w: w / total })), share: total });
    }
    const most = Math.max(...this.pools.map((p) => p.share), 1e-9);
    for (const p of this.pools) p.share = Math.min(1, p.share / most);
  }

  private buildLamps() {
    for (const l of this.lamps) { l.light.removeFromParent(); l.light.dispose(); }
    this.lamps = [];
    type E = { c: THREE.Vector3; n: THREE.Vector3; r: THREE.Vector3; w: number; h: number; weight: number; zone: Zone };
    const all: E[] = [];
    this.lampParent.updateWorldMatrix(true, false);
    const toParent = this.lampParent.matrixWorld.clone().invert();
    const parentQ = new THREE.Quaternion(); this.lampParent.getWorldQuaternion(parentQ); parentQ.invert();
    for (const z of this.zones) {
      if (!z.owner) continue;
      const q = new THREE.Quaternion(); z.owner.getWorldQuaternion(q); q.premultiply(parentQ);
      for (const e of z.emitters) {
        const c = e.center.clone().applyMatrix4(z.owner.matrixWorld).applyMatrix4(toParent);
        const n = e.normal.clone().applyQuaternion(q).normalize();
        const rr = e.right.clone().applyQuaternion(q).normalize();
        const s = new THREE.Vector3(); z.owner.getWorldScale(s);
        all.push({ c, n, r: rr, w: e.w * s.x, h: e.h * s.x, weight: e.weight, zone: z });
      }
    }
    all.sort((a, b) => b.weight * b.w * b.h - a.weight * a.w * a.h);
    // Each lamp sits on the plane of its strongest emitter and only takes emitters facing the same way. A lamp placed between
    // emitters puts its one sided plane through the parts around it, and they show a hard edge where the plane cuts them.
    type G = { members: E[]; anchor: E };
    const groups: G[] = [];
    const limit = Math.max(1, this.lampCount - 1);
    const NEAR = 0.3;
    const onPlane = (g: G, m: E) => Math.abs(m.c.clone().sub(g.anchor.c).dot(g.anchor.n)) < 0.02;
    for (const e of all) {
      let best: G | null = null; let bestD = Infinity;
      for (const g of groups) {
        if (g.anchor.n.dot(e.n) < 0.8) continue;
        const d = g.anchor.c.distanceTo(e.c);
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best && ((bestD < NEAR && onPlane(best, e)) || groups.length >= limit)) best.members.push(e);
      else if (groups.length < limit) groups.push({ members: [e], anchor: e });
    }
    for (const g of groups) {
      const n = g.anchor.n;
      const right = g.anchor.r.clone().addScaledVector(n, -g.anchor.r.dot(n)).normalize();
      const up = new THREE.Vector3().crossVectors(n, right).normalize();
      let u0 = Infinity; let u1 = -Infinity; let v0 = Infinity; let v1 = -Infinity;
      for (const m of g.members) {
        if (m !== g.anchor && (m.c.distanceTo(g.anchor.c) > NEAR || !onPlane(g, m))) continue;
        const d = m.c.clone().sub(g.anchor.c);
        const mu = new THREE.Vector3().crossVectors(m.n, m.r).normalize();
        const ew = (Math.abs(m.r.dot(right)) * m.w + Math.abs(mu.dot(right)) * m.h) * 0.85;
        const eh = (Math.abs(m.r.dot(up)) * m.w + Math.abs(mu.dot(up)) * m.h) * 0.85;
        u0 = Math.min(u0, d.dot(right) - ew / 2); u1 = Math.max(u1, d.dot(right) + ew / 2);
        v0 = Math.min(v0, d.dot(up) - eh / 2); v1 = Math.max(v1, d.dot(up) + eh / 2);
      }
      // A lamp stands in front of every close member facing its way. On the anchor's plane it cut through the next memory
      // stick of a kit, and the horizon clip drew a hard edge across that stick's bar.
      let out = 0;
      for (const m of g.members) if (m.c.distanceTo(g.anchor.c) < KIT_REACH && m.n.dot(n) > 0.8) out = Math.max(out, m.c.clone().sub(g.anchor.c).dot(n));
      const center = g.anchor.c.clone().addScaledVector(right, (u0 + u1) / 2).addScaledVector(up, (v0 + v1) / 2);
      const light = new THREE.RectAreaLight(0xffffff, 0, Math.min(Math.max(u1 - u0, 0.01), 0.45), Math.min(Math.max(v1 - v0, 0.01), 0.45));
      light.position.copy(center).addScaledVector(n, out + 0.004);
      light.up.copy(up);
      light.lookAt(center.clone().add(n));
      light.name = `lamp:${g.members[0]!.zone.key}`;
      this.lampParent.add(light);
      const zones = [...new Set(g.members.map((m) => m.zone))];
      const gain = g.members.reduce((s, m) => s + m.weight, 0) / Math.max(1, g.members.length);
      this.lamps.push({ light, zones, gain });
    }
  }

  update(time: number) {
    const L = this.lighting;
    let ar = 0; let ag = 0; let ab = 0; let an = 0;
    for (const z of this.zones) {
      const profile = L ? profileFor(L, z.target) : null;
      const pw = this.power * this.targetPower[z.target];
      if (!profile || pw <= 0) {
        z.colors.fill(0);
      } else {
        const temp = zoneTemp(z.target, this.temps);
        for (let i = 0; i < z.count; i++) {
          this.led.u = z.u(i); this.led.pn = z.pn[i]!; this.led.phase = z.phase; this.led.hash = z.hashes[i]!; this.led.tempC = temp;
          ledColor(profile, time, this.led, pw, this.out);
          z.colors[i * 3] = this.out.r; z.colors[i * 3 + 1] = this.out.g; z.colors[i * 3 + 2] = this.out.b;
        }
      }
      z.write();
      ar += z.avg.r; ag += z.avg.g; ab += z.avg.b; an++;
    }
    this.average.setRGB(an ? ar / an : 0, an ? ag / an : 0, an ? ab / an : 0);
    for (const l of this.lamps) {
      let r = 0; let g = 0; let b = 0;
      for (const z of l.zones) { r += z.avg.r; g += z.avg.g; b += z.avg.b; }
      const n = Math.max(1, l.zones.length);
      saturate(r / n, g / n, b / n, l.light.color);
      const peak = Math.max(r, g, b, 1e-5) / n;
      l.light.intensity = 4.5 * l.gain * this.lampGain * peak;
    }
    const peak = Math.max(this.average.r, this.average.g, this.average.b, 1e-5);
    saturate(this.average.r, this.average.g, this.average.b, this.wall.color);
    this.wall.intensity = this.wallWash ? 14 * this.lampGain * roomShare(peak) : 0;
    for (const p of this.pools) {
      let r = 0; let g = 0; let b = 0;
      for (const { zone, w } of p.weights) { r += zone.avg.r * w; g += zone.avg.g * w; b += zone.avg.b * w; }
      const m = p.mesh.material as THREE.MeshBasicMaterial;
      saturate(r, g, b, m.color);
      m.color.multiplyScalar(roomShare(Math.max(r, g, b)) * POOL_GAIN * Math.sqrt(p.share));
    }
    for (const p of this.patches) {
      const a = p.zone.avg; const m = p.mesh.material as THREE.MeshBasicMaterial;
      saturate(a.r, a.g, a.b, m.color);
      m.color.multiplyScalar(Math.max(a.r, a.g, a.b) * p.gain);
    }
  }

  get lampObjects(): THREE.RectAreaLight[] { return [...this.lamps.map((l) => l.light), this.wall]; }

  /** For the hook: every zone and the colors written this frame. */
  snapshot(): { part: string; target: LightTarget; colors: number[][] }[] {
    return this.zones.map((z) => ({ part: z.key, target: z.target, colors: Array.from({ length: z.count }, (_, i) => [z.colors[i * 3]!, z.colors[i * 3 + 1]!, z.colors[i * 3 + 2]!]) }));
  }

  dispose() {
    for (const l of this.lamps) { l.light.removeFromParent(); l.light.dispose(); }
    this.wall.removeFromParent(); this.wall.dispose();
    for (const p of this.pools) { p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); }
    this.poolGroup.removeFromParent();
    this.poolAlpha?.dispose();
  }
}

export { MM };
