import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getCase, getCooler, K } from '../data/catalog';
import { thermalHue } from '../engine/lighting';
import { radMount } from '../engine/rules';
import type { Build, Temps } from '../engine/types';
import type { CaseLayout } from './layout/types';
import type { Placed } from './layout/place';
import { rotate, type V3 } from './layout/math';

/** Streams at full density on the High tier; the tier's dashes factor scales it. */
const STREAMS = 34;
/** A case with no fans still breathes through its vents, faintly. */
const PASSIVE = 0.3;
const TUBE_RADIUS = 1.1;
const SAMPLES = 72;
/** How far past an exhaust a stream runs before it fades, and how close to an intake it starts, in mm. */
const EXIT = 55;
const ENTRY = 8;
/** Distance the air keeps from a part it passes, in mm. */
const CLEAR = 6;
/** Dash spacing along a stream and air speed at idle and full load, mm and mm per second. */
const PERIOD = 34;
const SPEED_IDLE = 170;
const SPEED_FULL = 420;

type Port = { c: V3; n: V3; r: number; weight: number };

/** A small seeded random source, so a frozen frame draws the same streams every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** The way into the case through a mount: its fan axis, turned toward the interior. */
function inwardOf(L: CaseLayout, c: V3, rot: V3, group: string): V3 {
  const rm = L.radMounts.find((m) => m.group === group);
  if (rm) return rm.inward;
  const axis = rotate(rot, [0, 0, 1]);
  const mid: V3 = [(L.interior.min[0] + L.interior.max[0]) / 2, (L.interior.min[1] + L.interior.max[1]) / 2, (L.interior.min[2] + L.interior.max[2]) / 2];
  const d = axis[0] * (mid[0] - c[0]) + axis[1] * (mid[1] - c[1]) + axis[2] * (mid[2] - c[2]);
  return d >= 0 ? axis : [-axis[0], -axis[1], -axis[2]];
}

/** Where air comes in and goes out: each fan, each radiator fan, or with no fans on a side, that side's empty mounts. */
function ports(b: Build, L: CaseLayout): { intake: Port[]; exhaust: Port[]; fans: number } {
  const spec = b.case ? getCase(b.case.id) : undefined;
  const intake: Port[] = []; const exhaust: Port[] = [];
  if (!spec) return { intake, exhaust, fans: 0 };
  const rm = radMount(b);
  const k = b.cooler ? getCooler(b.cooler.id) : undefined;
  const radMounts = new Set(rm && k?.radSize ? spec.fanMounts.filter((f) => f.group === rm.group).slice(0, Math.round(k.radSize / 120)).map((f) => f.id) : []);
  let fans = 0;
  const passive = { intake: [] as Port[], exhaust: [] as Port[] };
  for (const m of spec.fanMounts) {
    const lm = L.fanMounts.find((f) => f.id === m.id);
    if (!lm) continue;
    const port: Port = { c: lm.center, n: inwardOf(L, lm.center, lm.rot, lm.group), r: lm.size * 0.36, weight: 1 };
    const live = !!b.fans[m.id] || radMounts.has(m.id);
    if (live) fans++;
    (live ? (m.role === 'intake' ? intake : exhaust) : (m.role === 'intake' ? passive.intake : passive.exhaust)).push(port);
  }
  if (!intake.length) intake.push(...passive.intake.map((p) => ({ ...p, weight: PASSIVE })));
  if (!exhaust.length) exhaust.push(...passive.exhaust.map((p) => ({ ...p, weight: PASSIVE })));
  return { intake, exhaust, fans };
}

const inside = (p: THREE.Vector3, b: THREE.Box3) => p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z;

/** How far a stream may bow toward the glass to clear the parts, in steps of this many mm. */
const BOW_STEP = 8;

/**
 * One stream: a straight jet out of its fan that bends into its exhaust, a cubic curve, so it never kinks. Where parts are
 * in the way it bows toward the glass, as air does over the face of the card, by the least amount that clears them. A
 * stream that cannot clear without leaving the chamber is dropped and another one is drawn.
 */
function streamPath(a: Port, e: Port, L: CaseLayout, obstacles: THREE.Box3[], rand: () => number): THREE.Vector3[] | null {
  // One place on the disk for both ends, in each fan's own frame with depth (z) kept as one axis, so streams between the
  // same two fans run side by side instead of crossing.
  const ang = rand() * Math.PI * 2; const rad = Math.sqrt(rand());
  // Each disk's second axis points at the other fan, so the near edge of the intake feeds the near edge of the exhaust.
  const disk = (p: Port, other: Port) => {
    const n = v(p.n).normalize();
    const depth = new THREE.Vector3(0, 0, 1);
    const t1 = Math.abs(n.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : depth.clone().addScaledVector(n, -n.z).normalize();
    const t2 = v(other.c).sub(v(p.c));
    t2.addScaledVector(n, -t2.dot(n)).addScaledVector(t1, -t2.dot(t1));
    if (t2.lengthSq() < 1e-6) t2.crossVectors(n, t1);
    t2.normalize();
    return v(p.c).addScaledVector(t1, Math.cos(ang) * rad * p.r).addScaledVector(t2, Math.sin(ang) * rad * p.r);
  };
  const s = disk(a, e); const x = disk(e, a);
  const na = v(a.n).normalize(); const ne = v(e.n).normalize();
  const room = new THREE.Box3(v(L.interior.min), v(L.interior.max)).expandByScalar(-4);
  const zGlass = Math.min(L.sideInner, L.interior.max[2]) - 12;
  const reach = s.distanceTo(x);
  const bez = new THREE.CubicBezierCurve3(
    s.clone().addScaledVector(na, ENTRY),
    s.clone().addScaledVector(na, reach * (0.44 + 0.04 * rand())),
    x.clone().addScaledVector(ne, reach * (0.34 + 0.04 * rand())),
    x.clone().addScaledVector(ne, -EXIT),
  );
  const base = bez.getSpacedPoints(SAMPLES - 1);
  const grown = obstacles.map((o) => o.clone().expandByScalar(CLEAR));
  const exitAt = (p: THREE.Vector3) => !room.containsPoint(p);
  const maxBow = Math.max(0, ...base.map((p) => zGlass - p.z));
  for (let bow = 0; bow <= maxBow + BOW_STEP; bow += BOW_STEP) {
    const pts = base.map((p, i) => {
      const t = i / (SAMPLES - 1);
      // The bow rises and falls smoothly over the middle of the run and leaves the fans straight.
      const w = Math.sin(Math.PI * t) ** 1.6;
      const q = p.clone(); q.z = Math.min(q.z + bow * w, Math.max(q.z, zGlass));
      return q;
    });
    let clear = true;
    for (let i = 1; i < pts.length - 1 && clear; i++) {
      const p = pts[i]!;
      const t = i / (SAMPLES - 1);
      // Only the ends pass through a fan and out of the case; the run between them stays in the chamber.
      if (exitAt(p)) { if (t > 0.12 && t < 0.86) clear = false; continue; }
      for (const o of grown) if (inside(p, o)) { clear = false; break; }
    }
    if (clear) return pts;
  }
  return null;
}

const TRIES = 12;

const VERT = /* glsl */ `
attribute float aU;
attribute float aLen;
attribute float aSeed;
varying float vU;
varying float vLen;
varying float vSeed;
void main() {
  vU = aU; vLen = aLen; vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTravel;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform float uLevel;
varying float vU;
varying float vLen;
varying float vSeed;
void main() {
  float ph = fract((vU * vLen - uTravel) / ${PERIOD.toFixed(1)} + vSeed);
  float dash = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.34, 0.42, ph));
  float ends = smoothstep(0.0, 0.07, vU) * (1.0 - smoothstep(0.8, 1.0, vU));
  vec3 col = mix(uCool, uWarm, smoothstep(0.2, 0.85, vU));
  // A faint trace of the whole stream under its dashes, so each one reads as a path and not as loose ticks.
  gl_FragColor = vec4(col * (dash + 0.06) * ends * uLevel, 1.0);
}`;

/** Air through the case: streams of short dashes from each intake through the chamber and out each exhaust. */
export class Airflow {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private readonly material: THREE.ShaderMaterial;
  private travel = 0;
  private fans = 0;

  constructor() {
    this.group.name = 'airflow';
    this.group.visible = false;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTravel: { value: 0 }, uCool: { value: new THREE.Color() }, uWarm: { value: new THREE.Color() }, uLevel: { value: 1 } },
    });
  }

  /** Lays the streams out for a build. density is the tier's share of the full stream count. */
  build(b: Build, L: CaseLayout | undefined, placed: Placed[], density: number) {
    this.clear();
    if (!L || !b.case) return;
    const { intake, exhaust, fans } = ports(b, L);
    this.fans = fans;
    if (!intake.length || !exhaust.length) return;
    const room = new THREE.Box3(v(L.interior.min), v(L.interior.max));
    const obstacles: THREE.Box3[] = [];
    for (const p of placed) {
      // Air passes through fans, radiators and an air cooler's fin stack; everything else it goes around.
      if (p.category === 'case' || p.category === 'fan' || p.kind === 'radiator') continue;
      if (p.category === 'cooler' && getCooler(p.id)?.type !== 'aio') continue;
      for (const bx of p.boxes) obstacles.push(new THREE.Box3(v(bx.min), v(bx.max)));
    }
    for (const bx of L.boxes) {
      const o = new THREE.Box3(v(bx.min), v(bx.max));
      if (room.containsBox(o)) obstacles.push(o);
    }
    const rand = rng(0x5eed + b.case.id.length * 977 + fans * 131);
    const total = Math.max(6, Math.round(STREAMS * density * (fans ? 1 : PASSIVE * 2)));
    const pick = (list: Port[]) => {
      const sum = list.reduce((a, p) => a + p.weight, 0);
      let r = rand() * sum;
      for (const p of list) { r -= p.weight; if (r <= 0) return p; }
      return list[list.length - 1]!;
    };
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < total; i++) {
      const a = intake[i % intake.length]!;
      let pts: THREE.Vector3[] | null = null;
      for (let k = 0; k < TRIES && !pts; k++) pts = streamPath(a, pick(exhaust), L, obstacles, rand);
      if (!pts) continue;
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const len = curve.getLength();
      const g = new THREE.TubeGeometry(curve, Math.max(24, Math.round(len / 6)), TUBE_RADIUS, 5, false);
      const n = g.getAttribute('position').count;
      const uv = g.getAttribute('uv');
      const aU = new Float32Array(n); const aLen = new Float32Array(n).fill(len); const aSeed = new Float32Array(n).fill(rand());
      for (let k = 0; k < n; k++) aU[k] = uv.getX(k);
      g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
      g.setAttribute('aLen', new THREE.BufferAttribute(aLen, 1));
      g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
      g.deleteAttribute('normal'); g.deleteAttribute('uv');
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) return;
    this.mesh = new THREE.Mesh(merged, this.material);
    this.mesh.name = 'airflow-streams';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.group.add(this.mesh);
  }

  /**
   * Advances the dashes. The air moves with the fans: its speed follows the load and how fast the fans turn, and with the
   * power off it stands still and dims. Color runs from intake air to the build's simulated temperature.
   */
  get moving() { return !!this.mesh && this.group.visible; }

  update(dt: number, frozen: number | null, load: number, spin: number, t: Temps) {
    if (!this.mesh) return;
    const speed = (SPEED_IDLE + (SPEED_FULL - SPEED_IDLE) * load) * (this.fans ? 1 : PASSIVE);
    if (frozen !== null) this.travel = frozen * speed * spin; else this.travel += dt * speed * spin;
    const u = this.material.uniforms;
    u.uTravel!.value = this.travel;
    u.uLevel!.value = (0.35 + 0.65 * spin) * (this.fans ? 1 : 0.6);
    const temp = t.cpuC !== null && t.gpuC !== null ? (t.cpuC + t.gpuC) / 2 : t.cpuC ?? t.gpuC ?? K.thermal.tempMin;
    (u.uCool!.value as THREE.Color).setHSL(thermalHue(K.thermal.tempMin), 1, 0.55).multiplyScalar(0.9);
    (u.uWarm!.value as THREE.Color).setHSL(thermalHue(temp), 1, 0.55).multiplyScalar(0.9);
  }

  clear() {
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.removeFromParent(); this.mesh = null; }
  }

  dispose() { this.clear(); this.material.dispose(); }
}
