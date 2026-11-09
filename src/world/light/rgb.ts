import * as THREE from 'three';
import type { LightTarget } from '../../data/catalog';
import { flowPosition, ledColor, profileFor, zoneTemp, type Led, type RGB } from '../../engine/lighting';
import type { Lighting, Temps } from '../../engine/types';
import type { Zone } from './zones';

const MM = 0.001;

type Lamp = { light: THREE.RectAreaLight; zones: Zone[]; gain: number };

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

  constructor(private scene: THREE.Object3D, private wallWash = true) {
    this.wall = new THREE.RectAreaLight(0xffffff, 0, 0.5, 0.46);
    this.wall.visible = wallWash;
    this.wall.name = 'lamp:wall';
    scene.add(this.wall);
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
  }

  private buildLamps() {
    for (const l of this.lamps) { l.light.removeFromParent(); l.light.dispose(); }
    this.lamps = [];
    type E = { c: THREE.Vector3; n: THREE.Vector3; r: THREE.Vector3; w: number; h: number; weight: number; zone: Zone };
    const all: E[] = [];
    for (const z of this.zones) {
      if (!z.owner) continue;
      const q = new THREE.Quaternion(); z.owner.getWorldQuaternion(q);
      for (const e of z.emitters) {
        const c = e.center.clone().applyMatrix4(z.owner.matrixWorld);
        const n = e.normal.clone().applyQuaternion(q).normalize();
        const rr = e.right.clone().applyQuaternion(q).normalize();
        const s = new THREE.Vector3(); z.owner.getWorldScale(s);
        all.push({ c, n, r: rr, w: e.w * s.x, h: e.h * s.x, weight: e.weight, zone: z });
      }
    }
    all.sort((a, b) => b.weight * b.w * b.h - a.weight * a.w * a.h);
    type G = { members: E[]; c: THREE.Vector3; n: THREE.Vector3; r: THREE.Vector3 };
    const groups: G[] = [];
    const limit = Math.max(1, this.lampCount - 1);
    for (const e of all) {
      let best: G | null = null; let bestD = Infinity;
      for (const g of groups) {
        const d = g.c.distanceTo(e.c) - (g.n.dot(e.n) > 0.6 ? 0.06 : -0.2);
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best && (bestD < 0.09 || groups.length >= limit)) {
        best.members.push(e);
        best.c.set(0, 0, 0); best.n.set(0, 0, 0);
        let wsum = 0;
        for (const m of best.members) { best.c.addScaledVector(m.c, m.weight); best.n.addScaledVector(m.n, m.weight); wsum += m.weight; }
        best.c.multiplyScalar(1 / wsum); best.n.normalize();
      } else groups.push({ members: [e], c: e.c.clone(), n: e.n.clone(), r: e.r.clone() });
    }
    for (const g of groups) {
      let w = 0.01; let h = 0.01;
      const right = g.r.clone().addScaledVector(g.n, -g.r.dot(g.n)).normalize();
      const up = new THREE.Vector3().crossVectors(g.n, right).normalize();
      for (const m of g.members) {
        const d = m.c.clone().sub(g.c);
        const mu = new THREE.Vector3().crossVectors(m.n, m.r).normalize();
        const ew = Math.abs(m.r.dot(right)) * m.w + Math.abs(mu.dot(right)) * m.h;
        const eh = Math.abs(m.r.dot(up)) * m.w + Math.abs(mu.dot(up)) * m.h;
        w = Math.max(w, Math.abs(d.dot(right)) * 2 + ew * 0.85);
        h = Math.max(h, Math.abs(d.dot(up)) * 2 + eh * 0.85);
      }
      const light = new THREE.RectAreaLight(0xffffff, 0, Math.min(w, 0.5), Math.min(h, 0.5));
      light.position.copy(g.c).addScaledVector(g.n, 0.004);
      light.up.copy(up);
      light.lookAt(g.c.clone().add(g.n));
      light.name = `lamp:${g.members[0]!.zone.key}`;
      this.scene.add(light);
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
      const peak = Math.max(r, g, b, 1e-5) / n;
      l.light.color.setRGB(r / n / peak, g / n / peak, b / n / peak);
      l.light.intensity = 3.2 * l.gain * this.lampGain * peak;
    }
    const peak = Math.max(this.average.r, this.average.g, this.average.b, 1e-5);
    this.wall.color.setRGB(this.average.r / peak, this.average.g / peak, this.average.b / peak);
    this.wall.intensity = this.wallWash ? 9 * this.lampGain * peak : 0;
  }

  get lampObjects(): THREE.RectAreaLight[] { return [...this.lamps.map((l) => l.light), this.wall]; }

  /** For the hook: every zone and the colors written this frame. */
  snapshot(): { part: string; target: LightTarget; colors: number[][] }[] {
    return this.zones.map((z) => ({ part: z.key, target: z.target, colors: Array.from({ length: z.count }, (_, i) => [z.colors[i * 3]!, z.colors[i * 3 + 1]!, z.colors[i * 3 + 2]!]) }));
  }

  dispose() {
    for (const l of this.lamps) { l.light.removeFromParent(); l.light.dispose(); }
    this.wall.removeFromParent(); this.wall.dispose();
  }
}

export { MM };
