import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getCable, getCase, getGpu } from '../data/catalog';
import type { Build } from '../engine/types';
import { mat, sleeve } from './kit/materials';
import { rbox, rrect as rrectPath } from './kit/geometry';
import { plugSection } from './layout/boards';
import { CASE_LAYOUTS } from './layout/cases';
import { DIMS } from './layout/dims';
import type { CaseLayout } from './layout/types';
import type { Anchor } from './parts/types';
import type { RigItem } from './rig';

type V = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A path through corners, each corner rounded to at least the given radius, so straight runs stay straight. */

/** Geometry with no index, for merging; one that has none already is used as it is. */
const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
export function filletPath(points: V[], radius: number, step = 2.5, straight = 12, straightEnd = straight): V[] {
  const out: V[] = [points[0]!.clone()];
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1]!; const p1 = points[i]!; const p2 = points[i + 1]!;
    const a = p0.clone().sub(p1); const b = p2.clone().sub(p1);
    const la = a.length(); const lb = b.length();
    if (la < 1e-6 || lb < 1e-6) continue;
    a.normalize(); b.normalize();
    const cos = Math.min(0.9999, Math.max(-0.9999, a.dot(b)));
    const theta = Math.acos(cos);
    if (Math.PI - theta < 0.01) { out.push(p1.clone()); continue; }
    const limA = i - 1 === 0 ? la - straight : la * 0.5;
    const limB = i + 1 === points.length - 1 ? lb - straightEnd : lb * 0.5;
    const t = Math.max(0.5, Math.min(radius / Math.tan(theta / 2), limA, limB));
    const s = p1.clone().addScaledVector(a, t); const e = p1.clone().addScaledVector(b, t);
    const r = t * Math.tan(theta / 2);
    const bis = a.clone().add(b).normalize();
    const center = p1.clone().addScaledVector(bis, r / Math.sin(theta / 2));
    const u0 = s.clone().sub(center); const u1 = e.clone().sub(center);
    const ang = u0.angleTo(u1);
    const n = Math.max(2, Math.ceil((ang * r) / step));
    const axis = new THREE.Vector3().crossVectors(u0, u1).normalize();
    for (let k = 0; k <= n; k++) out.push(center.clone().add(u0.clone().applyAxisAngle(axis, (ang * k) / n)));
  }
  out.push(points[points.length - 1]!.clone());
  const dense: V[] = [out[0]!];
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1]!; const b = out[i]!;
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 8));
    for (let k = 1; k <= n; k++) dense.push(a.clone().lerp(b, k / n));
  }
  return dense;
}

/**
 * Tangent frames carried along a path without twist, then turned about the path where the run must lie a given way: at each
 * align point the row axis meets the given normal (either sense, as the rows are symmetric), and the turn between align points
 * spreads along the length, as a bundle twists gently over a long span.
 */
function frames(path: V[], firstNormal: V, align: Align[] = []) {
  const T: V[] = path.map((_, i) => {
    const a = path[Math.max(0, i - 1)]!; const b = path[Math.min(path.length - 1, i + 1)]!;
    return b.clone().sub(a).normalize();
  });
  const N: V[] = []; const B: V[] = [];
  let n = firstNormal.clone().addScaledVector(T[0]!, -firstNormal.dot(T[0]!)).normalize();
  for (let i = 0; i < path.length; i++) {
    const t = T[i]!;
    n = n.addScaledVector(t, -n.dot(t)).normalize();
    N.push(n.clone()); B.push(new THREE.Vector3().crossVectors(t, n).normalize());
  }
  if (!align.length) return { T, N, B };
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + path[i]!.distanceTo(path[i - 1]!));
  const keys: { s: number; a: number }[] = [{ s: 0, a: 0 }];
  for (const al of align) {
    let i = 0; let best = Infinity;
    path.forEach((p, k) => { const d = p.distanceToSquared(al.at); if (d < best) { best = d; i = k; } });
    const prev = keys[keys.length - 1]!.a;
    if (!al.normal) { keys.push({ s: cum[i]!, a: 0 }); continue; }
    const want = al.normal.clone().addScaledVector(T[i]!, -al.normal.dot(T[i]!)).normalize();
    let a = Math.atan2(new THREE.Vector3().crossVectors(N[i]!, want).dot(T[i]!), N[i]!.dot(want));
    while (a - prev > Math.PI / 2) a -= Math.PI;
    while (a - prev < -Math.PI / 2) a += Math.PI;
    keys.push({ s: cum[i]!, a });
  }
  keys.sort((p, q) => p.s - q.s);
  for (let i = 0; i < path.length; i++) {
    const s = cum[i]!;
    let k = 0; while (k < keys.length - 2 && keys[k + 1]!.s <= s) k++;
    const k0 = keys[k]!; const k1 = keys[Math.min(k + 1, keys.length - 1)]!;
    const f = k1.s > k0.s ? THREE.MathUtils.smoothstep(s, k0.s, k1.s) : 1;
    const a = s >= keys[keys.length - 1]!.s ? keys[keys.length - 1]!.a : k0.a + (k1.a - k0.a) * f;
    N[i]!.applyAxisAngle(T[i]!, a); B[i]!.applyAxisAngle(T[i]!, a);
  }
  return { T, N, B };
}

/** Where a run must lie a given way: its row axis along the normal at the path point nearest to the given one, or untwisted there when no normal is given. */
export type Align = { at: V; normal?: V };

export type Run = {
  name: string;
  path: V[];
  rows: number; cols: number; pitch: number; wire: number;
  /** across the row direction at the path start */
  rowAxis: V;
  colors: string[];
  comb: string;
  plugAt: 'end' | 'start' | 'both' | 'none';
  /** a board plug with a latch arm over its header's ramp, or a plain housing with a clip */
  plug?: 'latch' | 'clip';
  /** sleeved runs carry combs; flat drive leads do not */
  combs?: boolean;
  /** arc length from the path start to the first comb */
  combFrom?: number;
  /** where the run must lie a given way along its length */
  align?: Align[];
  /** the tray's z where the run dives through a tray grommet: the wires darken as they go into the opening */
  intoTray?: number;
};

/** A comb's outline hugs each wire with a soft lobe, as molded combs do, so it reads as a comb and not as a bar. */
function combProfile(run: Run): THREE.Shape {
  const hole = run.wire + 0.12; const R = hole + 1.15; const dip = Math.min(0.8, run.pitch * 0.19);
  const xr = ((run.rows - 1) / 2) * run.pitch; const ym = ((run.cols - 1) / 2) * run.pitch;
  const lobe = (y: number) => {
    const d = Math.abs(((y + ym) % run.pitch + run.pitch) % run.pitch - run.pitch / 2);
    return R - dip + dip * (0.5 - 0.5 * Math.cos((2 * Math.PI * d) / run.pitch));
  };
  const pts: THREE.Vector2[] = [];
  const n = Math.max(2, (run.cols - 1) * 12);
  const cap = (from: number, cy: number) => { for (let k = 1; k < 18; k++) { const a = from + (k / 18) * Math.PI; pts.push(new THREE.Vector2((xr + R) * Math.cos(a), cy + R * Math.sin(a))); } };
  for (let k = 0; k <= n; k++) { const y = -ym + (2 * ym * k) / n; pts.push(new THREE.Vector2(xr + lobe(y), y)); }
  cap(0, ym);
  for (let k = 0; k <= n; k++) { const y = ym - (2 * ym * k) / n; pts.push(new THREE.Vector2(-(xr + lobe(y)), y)); }
  cap(Math.PI, -ym);
  const s = new THREE.Shape(pts);
  for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) {
    const h = new THREE.Path(); h.absarc((r - (run.rows - 1) / 2) * run.pitch, (c - (run.cols - 1) / 2) * run.pitch, hole, 0, Math.PI * 2, true); s.holes.push(h);
  }
  return s;
}

/**
 * A board plug: the housing, a collar of square cells the wires enter, and a latch arm that rides over the header's wall and
 * hooks behind the ramp on it. Built in the plug's frame: x out of the header along the wires, y toward the latch.
 */
function latchPlug(run: Run, frame: THREE.Matrix4): THREE.BufferGeometry[] {
  const { ph, pw } = plugSection(run.rows, run.cols, run.pitch);
  const len = DIMS.plugLength; const collar = 1.8; const wall = ph / 2 + DIMS.plugWall;
  const parts: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, x: number, y: number) => { g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, 0).premultiply(frame)); parts.push(g); };
  put(rbox(len - collar, ph, pw, 0.8, 2), (len - collar) / 2, 0);
  const cells = rrectPath(new THREE.Shape(), -(ph - 0.5) / 2, -(pw - 0.5) / 2, ph - 0.5, pw - 0.5, 0.7);
  const cell = run.wire * 2 + 0.45;
  for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) {
    cells.holes.push(rrectPath(new THREE.Path(), (r - (run.rows - 1) / 2) * run.pitch - cell / 2, (c - (run.cols - 1) / 2) * run.pitch - cell / 2, cell, cell, 0.5));
  }
  const cg = new THREE.ExtrudeGeometry(cells, { depth: collar, bevelEnabled: false, curveSegments: 3 });
  cg.applyMatrix4(new THREE.Matrix4().makeBasis(v(0, 1, 0), v(0, 0, 1), v(1, 0, 0)));
  put(cg, len - collar, 0);
  const arm = wall + 0.9 + 0.45;
  put(rbox(len + 3.6, 0.9, 4.4, 0.3, 1), (len + 3.6) / 2 - 3.4, arm);
  put(rbox(2.4, arm - ph / 2, 4.4, 0.3, 1), len * 0.45, (arm + ph / 2) / 2 - 0.2);
  put(rbox(1.2, 1.1, 4.4, 0.25, 1), -2.8, wall + 0.55);
  for (const x of [len - 0.6, len - 1.8, len - 3.0]) put(rbox(0.45, 0.5, 4.4, 0.15, 1), x, arm + 0.6);
  return parts;
}

function runLength(path: V[]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += path[i]!.distanceTo(path[i - 1]!);
  return n;
}

function sweep(points: V[], r: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const len = curve.getLength();
  const g = new THREE.TubeGeometry(curve, Math.max(12, Math.round(len / 2.4)), r, radial, false);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * r * 2 * Math.PI);
  return g;
}

/**
 * Sleeving for single wires, with a per vertex shade over all its light, sheen included: a run going into a grommet falls into
 * the ring's shadow and the dark cable space. Lit to its end, the turn away from the glass read as wires capped in mid air.
 */
const wireSleeves = new Map<string, THREE.MeshPhysicalMaterial>();
function wireSleeve(color: string): THREE.MeshPhysicalMaterial {
  let m = wireSleeves.get(color);
  if (!m) {
    m = sleeve(color).clone();
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float shade;\nvarying float vShade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = shade;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vShade;').replace('#include <opaque_fragment>', 'outgoingLight *= vShade;\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'wire-shade';
    wireSleeves.set(color, m);
  }
  return m;
}

/** Builds one run: each wire its own tube, combs along the straights, a plug housing at the connector end. */
export function buildRun(run: Run, group: THREE.Group, detail = 1) {
  const { T, N, B } = frames(run.path, run.rowAxis, run.align);
  const byColor = new Map<string, THREE.BufferGeometry[]>();
  for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) {
    const or = (r - (run.rows - 1) / 2) * run.pitch; const oc = (c - (run.cols - 1) / 2) * run.pitch;
    const pts = run.path.map((p, i) => p.clone().addScaledVector(N[i]!, or).addScaledVector(B[i]!, oc));
    const color = run.colors.length > 1 && c % 2 === 0 ? run.colors[1]! : run.colors[0]!;
    const list = byColor.get(color) ?? [];
    const tube = sweep(pts, run.wire, detail >= 1 ? 8 : 6);
    const tu = tube.getAttribute('uv'); const shade = new Float32Array(tu.count);
    // The shade falls along the wire from a little before it starts to drop toward the tray, so the whole turn away from the
    // glass darkens into the opening. The tube's u is its length in millimeters.
    let drop = Infinity;
    if (run.intoTray !== undefined) { let acc = 0; for (let k = 1; k < pts.length; k++) { if (pts[k]!.z < pts[0]!.z - 0.5) { drop = acc; break; } acc += pts[k]!.distanceTo(pts[k - 1]!); } }
    for (let k = 0; k < tu.count; k++) shade[k] = 1 - 0.94 * THREE.MathUtils.smoothstep(tu.getX(k), drop - 14, drop + 12);
    tube.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
    list.push(tube);
    byColor.set(color, list);
  }
  for (const [color, geos] of byColor) {
    const merged = mergeGeometries(geos.map(flat), false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, color.startsWith('#') ? wireSleeve(color) : mat('rubber'));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.flexible = true; mesh.name = `run:${run.name}`;
    // For growing in: the run's length in mm (the tubes' u runs along it) and which end the supply is at.
    mesh.userData.run = run.name; mesh.userData.length = runLength(run.path); mesh.userData.fromEnd = run.plugAt === 'start';
    group.add(mesh);
  }
  if (run.rows * run.cols < 2 && run.plugAt === 'none') return;
  const cum: number[] = [0];
  for (let i = 1; i < run.path.length; i++) cum.push(cum[i - 1]! + run.path[i]!.distanceTo(run.path[i - 1]!));
  const total = cum[cum.length - 1]!;
  // Molded combs are glossier than the braid, so a black comb on black wires still reads by its sheen.
  const combMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(run.comb), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const cw = run.cols * run.pitch + 3; const ch = run.rows * run.pitch + 3;
  const comb = new THREE.ExtrudeGeometry(combProfile(run), { depth: 4.2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.4, bevelOffset: -0.4, bevelSegments: 2, curveSegments: 12 });
  comb.translate(0, 0, -2.1);
  const holes: THREE.BufferGeometry[] = [];
  const combs: THREE.Matrix4[] = [];
  const straightAt = (i: number) => T[Math.max(0, i - 1)]!.dot(T[Math.min(T.length - 1, i + 2)]!) >= 0.995;
  let s = run.combFrom ?? 34; let slip = 0;
  while (run.combs !== false && s < total - 24) {
    let i = 0; while (i < cum.length - 2 && cum[i + 1]! <= s) i++;
    if (!straightAt(i) && slip < 20) { s += 2.5; slip += 2.5; continue; }
    const f = (s - cum[i]!) / Math.max(1e-6, cum[i + 1]! - cum[i]!);
    const t = T[i]!.clone().lerp(T[i + 1]!, f).normalize();
    const n = N[i]!.clone().lerp(N[i + 1]!, f); n.addScaledVector(t, -n.dot(t)).normalize();
    combs.push(new THREE.Matrix4().makeBasis(n, new THREE.Vector3().crossVectors(t, n), t).setPosition(run.path[i]!.clone().lerp(run.path[i + 1]!, f)));
    s += 50; slip = 0;
  }
  for (const m of combs) {
    const g = comb.clone(); g.applyMatrix4(m); holes.push(g);
  }
  if (holes.length) {
    const merged = mergeGeometries(holes.map(flat), false);
    if (merged) { const mesh = new THREE.Mesh(merged, combMat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.flexible = true; mesh.name = `comb:${run.name}`; mesh.userData.run = run.name; group.add(mesh); }
  }
  for (const g of holes) g.dispose();
  comb.dispose();
  const ends = run.plugAt === 'both' ? [false, true] : run.plugAt === 'none' ? [] : [run.plugAt === 'end'];
  for (const atEnd of ends) plugAt(run, atEnd, T, N, ch, cw, group);
}

function plugAt(run: Run, atEnd: boolean, T: V[], N: V[], ch: number, cw: number, group: THREE.Group) {
  if (run.plug === 'latch') {
    const i = atEnd ? run.path.length - 1 : 0;
    const out = atEnd ? T[i]!.clone().negate() : T[i]!.clone();
    const frame = new THREE.Matrix4().makeBasis(out, N[i]!, new THREE.Vector3().crossVectors(out, N[i]!)).setPosition(run.path[i]!);
    const parts = latchPlug(run, frame);
    const merged = mergeGeometries(parts.map(flat), false);
    for (const g of parts) g.dispose();
    if (merged) { const mesh = new THREE.Mesh(merged, mat('plasticDark')); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.flexible = true; mesh.name = `plug:${run.name}`; mesh.userData.run = run.name; group.add(mesh); }
  } else {
    const i = atEnd ? run.path.length - 1 : 0;
    const dir = atEnd ? T[i]!.clone() : T[i]!.clone().negate();
    const m = new THREE.Matrix4().makeBasis(dir, N[i]!, new THREE.Vector3().crossVectors(dir, N[i]!)).setPosition(run.path[i]!.clone().addScaledVector(dir, -4.5));
    const housing = rbox(9, ch - 0.6, cw - 0.6, 0.8, 2);
    housing.applyMatrix4(m);
    const clip = rbox(6, 2.4, 6, 0.6, 1);
    clip.applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, ch / 2 + 0.8, 0)));
    const merged = mergeGeometries([flat(housing), flat(clip)], false);
    housing.dispose(); clip.dispose();
    if (merged) { const mesh = new THREE.Mesh(merged, mat('plasticDark')); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.flexible = true; mesh.name = `plug:${run.name}`; mesh.userData.run = run.name; group.add(mesh); }
  }
}

const toCase = (item: RigItem, a: Anchor): { p: V; d: V } => {
  item.holder.updateMatrix();
  const m = item.holder.matrix;
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return { p: new THREE.Vector3(...a.pos).applyMatrix4(m), d: new THREE.Vector3(...a.dir).applyQuaternion(q).normalize() };
};

/**
 * Cable routing on an open frame, where the plate's back is seen: every board run goes through its grommet, turns down the
 * plate's back lying flat, and comes forward into one grommet beside the supply; the supply's own runs leave its sockets, rise,
 * and go back into the same grommet. The two halves of a cable meet inside the plate. Lanes across that grommet keep the
 * bundles apart on both faces.
 */
function openRouting(L: CaseLayout) {
  const gp = L.grommets.find((g) => g.id === 'psu');
  const tray = L.boxes.find((b) => b.tag === 'tray');
  if (!gp || !tray) return null;
  const back = tray.min[2]; const mid = (tray.min[2] + tray.max[2]) / 2;
  // An 18 mm turn out of the grommet and along the plate.
  const zr = back - 19; const yr = gp.center[1];
  const x0 = gp.center[0] - gp.size[0] / 2;
  return {
    zr, yr, mid, back,
    lane: { eps: x0 + 12, atx24: x0 + 56, gpu: [x0 + 92, x0 + 111] },
    psu: { eps: x0 + 16, atx24: x0 + 28, atx10: x0 + 40, gpu: [x0 + 52, x0 + 64] } as Record<string, number | number[]>,
    /** right of every supply lane: where a supply lead to a higher grommet climbs the plate */
    psuRise: x0 + 76,
    /** untwisted through the grommet, then flat on the plate's back on the way down */
    flat: (hold: V, x: number, y: number): Align[] => [{ at: hold }, { at: v(x, (y + yr) / 2, zr), normal: v(0, 0, 1) }],
    behind: (pts: V[], x: number, straight = DIMS.plugLength + 12) => filletPath([...pts, v(x, yr, zr), v(x, yr, mid)], 18, 2.5, straight, 4),
  };
}


/** The liquid cooler's two tubes, from the pump and the radiator where they stand now, so they flex as either moves. */
export function coolerTubes(items: Map<string, RigItem>): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const pump = items.get('cooler'); const rad = items.get('radiator');
  if (!pump || !rad || !pump.part.anchors.fitting0 || !rad.part.anchors.fitting0) return out;
  const frost = rad.placed.id.includes('frost');
  // Two tubes run side by side: each keeps its own depth along the run and meets the fitting on its own side, so they never cross.
  const from = [0, 1].map((i) => toCase(pump, pump.part.anchors[`fitting${i}`]!)).sort((p, q) => p.p.x - q.p.x);
  const to = [0, 1].map((i) => toCase(rad, rad.part.anchors[`fitting${i}`]!)).sort((p, q) => p.p.z - q.p.z);
  const zMid = (to[0]!.p.z + to[1]!.p.z) / 2;
  for (let i = 0; i < 2; i++) {
    const a = from[i]!; const b = to[i]!;
    const dz = i === 0 ? -9 : 9;
    const up = a.p.clone().addScaledVector(a.d, 14);
    const near = b.p.clone().addScaledVector(b.d, 28);
    const side = near.clone().addScaledVector(b.d, 2); side.x -= 36 * Math.sign(b.p.x - a.p.x || 1); side.z = zMid + dz;
    // Stepped in height as well as depth, so from the glass the two runs read as two tubes and not one thick hose.
    if (i === 0) side.y -= 12;
    const p1 = a.p.clone().addScaledVector(a.d, 30); p1.z = a.p.z + 14 + dz;
    const pts = [a.p, up, p1, side, near, b.p];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const len = curve.getLength();
    const geo = new THREE.TubeGeometry(curve, Math.max(64, Math.round(len / 3)), 6.1, 18, false);
    const uv = geo.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len, uv.getY(k) * 6.1 * 2 * Math.PI);
    const m = new THREE.Mesh(geo, sleeve(frost ? '#f1f2f5' : '#2c2c34', 2.2));
    m.castShadow = true; m.receiveShadow = true; m.userData.flexible = true; m.name = 'tube';
    out.push(m);
  }
  return out;
}

/** Everything flexible between parts: sleeved power runs, fan leads and liquid cooler tubes. Built in case space, mm. */
export function buildCables(build: Build, items: Map<string, RigItem>, detail = 1): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cables';
  const L: CaseLayout | undefined = build.case ? CASE_LAYOUTS[build.case.id] : undefined;
  if (!L) return group;
  const cw = getCable(build.cables);
  const colors = cw?.colors ?? ['#0d0d10'];
  const comb = cw?.comb ?? '#0a0a0c';
  const grommet = (id: string) => L.grommets.find((g) => g.id === id);
  const board = items.get('board'); const psu = items.get('psu'); const gpu = items.get('gpu');
  const runs: Run[] = [];
  const open = getCase(build.case?.id)?.open === true ? openRouting(L) : null;
  if (board && psu && open) {
    const a = board.part.anchors.atx24; const g = grommet('atx24');
    if (a && g) {
      const { p } = toCase(board, a);
      const x = g.center[0] - 4;
      runs.push({ name: 'atx24', rows: 2, cols: 12, pitch: 4.2, wire: 1.65, rowAxis: v(0, 0, 1), colors, comb, plugAt: 'start', plug: 'latch', combFrom: DIMS.plugLength + 6.5,
        path: open.behind([p.clone(), v(x, p.y, p.z), v(x, p.y, open.zr), v(open.lane.atx24, p.y, open.zr)], open.lane.atx24) });
    }
    const e = board.part.anchors.eps; const ge = grommet('eps');
    if (e && ge) {
      const { p } = toCase(board, e);
      const x = open.lane.eps;
      runs.push({ name: 'eps', rows: 2, cols: 4, pitch: 4.2, wire: 1.65, rowAxis: v(0, 1, 0), colors, comb, plugAt: 'start',
        align: [{ at: v(p.x, ge.center[1], open.zr) }, { at: v((p.x + x) / 2, ge.center[1], open.zr), normal: v(0, 0, 1) }, ...open.flat(v(x, ge.center[1], open.zr), x, ge.center[1]).slice(1)],
        path: open.behind([p.clone(), v(p.x, p.y, p.z + 31), v(p.x, ge.center[1], p.z + 31), v(p.x, ge.center[1], open.zr), v(x, ge.center[1], open.zr)], x) });
    }
  }
  if (board && psu && !open) {
    const a = board.part.anchors.atx24; const g = grommet('atx24');
    if (a && g) {
      const { p } = toCase(board, a);
      const gz = g.center[2];
      runs.push({ name: 'atx24', rows: 2, cols: 12, pitch: 4.2, wire: 1.65, rowAxis: v(0, 0, 1), colors, comb, plugAt: 'start', plug: 'latch', combFrom: DIMS.plugLength + 6.5, intoTray: gz,
        // A 24 pin bundle bends on a wide radius: it bends toward the tray before the slot and dives back under the board's edge behind it, so the turn shows through the opening, and goes through the split
        // membrane into the dark cable space; a tight bend at the slot's middle hid the turn and read as wires ending there.
        // The turn starts before the slot and sweeps through it on a 20 mm radius, so from the glass it reads as a curve into the
        // grommet; a 12 mm turn straight away from the eye was seen end on and read as wires capped in mid air (critic 262).
        path: filletPath([p.clone(), v(g.center[0] + 14, p.y, p.z), v(g.center[0] - 4, p.y, gz - 2), v(g.center[0] - 30, p.y, gz - 30)], 20, 2.5, DIMS.plugLength + 12) });
    }
    const e = board.part.anchors.eps; const ge = grommet('eps');
    if (e && ge) {
      const { p } = toCase(board, e);
      runs.push({ name: 'eps', rows: 2, cols: 4, pitch: 4.2, wire: 1.65, rowAxis: v(0, 1, 0), colors, comb, plugAt: 'start', intoTray: ge.center[2],
        path: filletPath([p.clone(), v(p.x, p.y, p.z + 31), v(p.x, ge.center[1], p.z + 31), v(p.x, ge.center[1], ge.center[2] - 14)], 18.5) });
    }
  }
  if (gpu && psu) {
    const spec = getGpu(gpu.placed.id);
    const sockets = ['power', 'power2'].map((k) => gpu.part.anchors[k]).filter((x): x is Anchor => !!x);
    const g = grommet('gpu');
    sockets.forEach((a, i) => {
      const { p } = toCase(gpu, a);
      const twelve = spec?.plugs.startsWith('12V');
      const cols = twelve ? 6 : 4; const pitch = twelve ? 3.0 : 4.2;
      const down = g ? g.center[1] - 20 : 100;
      const gx = g ? Math.min(Math.max(p.x, g.center[0] - g.size[0] / 2 + 14), g.center[0] + g.size[0] / 2 - 14) : p.x;
      const gz = g ? g.center[2] : p.z + 20;
      if (open && g) {
        // Out toward the glass, down in front of the card, back under it through the plate, and down behind it to the supply.
        const x = open.lane.gpu[i] ?? open.lane.gpu[0]!; const gy = g.center[1] + i * 9;
        runs.push({ name: `gpu-power-${i}`, rows: 2, cols, pitch, wire: twelve ? 1.35 : 1.65, rowAxis: v(0, 1, 0), colors, comb, plugAt: 'start', combFrom: DIMS.plugLength + 6,
          align: open.flat(v(x, gy, open.zr), x, gy), path: open.behind([p.clone(), v(p.x, p.y, p.z + 30.4), v(p.x, gy, p.z + 30.4), v(x, gy, p.z + 30.4), v(x, gy, open.zr)], x) });
        return;
      }
      // A comb sits just past the plug, where the macros see the run.
      // A grommet in the tray (a dual chamber case): out toward the glass, down in front of the card, back under it to the tray.
      const path = g && g.normal[2] === 1
        ? filletPath([p.clone(), v(p.x, p.y, p.z + 30.4), v(p.x, g.center[1] + i * 9, p.z + 30.4), v(g.center[0], g.center[1] + i * 9, p.z + 30.4), v(g.center[0], g.center[1] + i * 9, gz - 20)], 18.4)
        : filletPath([p.clone(), v(p.x, p.y, Math.max(p.z + 30.4, gz + 11)), v(gx, down, Math.max(p.z + 30.4, gz + 11))], 18.4);
      runs.push({ name: `gpu-power-${i}`, rows: 2, cols, pitch, wire: twelve ? 1.35 : 1.65, rowAxis: v(0, 1, 0), colors, comb, plugAt: 'start', combFrom: DIMS.plugLength + 6, ...(g && g.normal[2] === 1 ? { intoTray: gz } : {}), path });
    });
  }
  if (open && psu) {
    // The supply's half of each cable: out of its socket, up beside the socket panel, and back into the plate.
    const out: { socket: string; lane: number; cols: number; pitch: number; wire: number }[] = [];
    if (board) {
      const split = !!psu.part.anchors.atx10;
      out.push({ socket: 'atx24', lane: open.psu.atx24 as number, cols: split ? 9 : 12, pitch: 4.2, wire: 1.65 });
      if (split) out.push({ socket: 'atx10', lane: open.psu.atx10 as number, cols: 5, pitch: 4.2, wire: 1.65 });
      if (board.part.anchors.eps) out.push({ socket: 'eps', lane: open.psu.eps as number, cols: 4, pitch: 4.2, wire: 1.65 });
    }
    if (gpu) {
      const spec = getGpu(gpu.placed.id);
      const twelve = spec?.plugs.startsWith('12V');
      const n = ['power', 'power2'].filter((k) => gpu.part.anchors[k]).length;
      for (let i = 0; i < n; i++) out.push({ socket: twelve ? 'hpwr' : `pcie${i + 1}`, lane: (open.psu.gpu as number[])[i]!, cols: twelve ? 6 : 4, pitch: twelve ? 3.0 : 4.2, wire: twelve ? 1.35 : 1.65 });
    }
    for (const o of out) {
      const s = psu.part.anchors[o.socket];
      if (!s) continue;
      const { p } = toCase(psu, s);
      runs.push({ name: `psu-${o.socket}`, rows: 2, cols: o.cols, pitch: o.pitch, wire: o.wire, rowAxis: v(0, 1, 0), colors, comb, plugAt: 'start', plug: 'latch', combFrom: DIMS.plugLength + 6,
        path: filletPath([p.clone(), v(o.lane, p.y, p.z), v(o.lane, open.yr, p.z), v(o.lane, open.yr, open.mid)], 18, 2.5, DIMS.plugLength + 2, 4) });
    }
  }
  const pump = items.get('cooler');
  for (const t of coolerTubes(items)) group.add(t);
  const pumpCable = pump?.part.anchors.cable; const header = board?.part.anchors.fan1;
  if (pump && board && pumpCable && header) {
    const e = toCase(pump, pumpCable); const h = toCase(board, header);
    const p1 = e.p.clone().addScaledVector(e.d, 14);
    const top = Math.max(p1.z, h.p.z + 32);
    runs.push({ name: 'pump-lead', rows: 1, cols: 3, pitch: 1.6, wire: 0.75, rowAxis: v(0, 0, 1), colors: ['rubber'], comb, plugAt: 'end', combs: false,
      path: filletPath([e.p, p1, v(p1.x, p1.y, top), v(h.p.x, h.p.y, top), h.p], 10, 2.5, 8, 12) });
  }
  for (const [key, item] of items) {
    if (item.placed.kind !== 'fan') continue;
    const mount = String(item.placed.meta.mount);
    const gid = mount.split('-')[0] ?? 'front';
    const g = grommet(gid);
    const lead = item.part.anchors.lead;
    if (!g || !lead) continue;
    const { p } = toCase(item, lead);
    // A fan recessed behind the tray keeps its lead in the cable space there.
    if (g.normal[2] === 1 && p.z < g.center[2]) continue;
    const target = v(g.center[0], g.center[1], g.center[2]);
    const mid = p.clone().lerp(target, 0.5); mid.z = Math.min(mid.z, g.center[2] + 15.45);
    runs.push({ name: `lead-${key}`, rows: 1, cols: 1, pitch: 0, wire: 1.2, rowAxis: v(0, 1, 0), colors: ['rubber'], comb, plugAt: 'none', path: filletPath([p, mid, v(target.x, target.y, target.z + 8), v(target.x, target.y, target.z - 10)], 12) });
  }
  if (board) {
    const ports = Object.entries(board.part.anchors).filter(([k]) => /^sata\d+$/.test(k)).map(([, a]) => toCase(board, a));
    ports.sort((a, b) => a.p.y - b.p.y || a.p.z - b.p.z);
    const tray = L.grommets.filter((g) => g.normal[2] === 1);
    const behind = (tray[0]?.center[2] ?? -75) - 24;
    let used = 0; let socket = 1; let backDrives = 0;
    for (const [key, item] of items) {
      if (item.placed.kind !== 'storage') continue;
      const da = item.part.anchors.sataData; const pa = item.part.anchors.sataPower;
      if (!da || !pa) continue;
      const thin = toCase(item, { pos: [0, 0, 0], dir: [0, 1, 0] }).d;
      const lead = (name: string, cols: number, pitch: number, wire: number, rowAxis: V, path: V[]): Run => ({ name, rows: 1, cols, pitch, wire, rowAxis, colors: ['rubber'], comb, plugAt: 'start', combs: false, path });
      if (open) {
        // Every lead is seen on an open frame. A drive on the shelf takes one lead from the supply and one to the board, each
        // plugged at both ends; a drive on the plate's back runs its leads flat along the plate into the drive grommet, where
        // the front halves from the board's port and the supply's socket meet them at the membrane.
        const d = toCase(item, da); const pw = toCase(item, pa);
        const s = psu?.part.anchors[`sata${socket}`] ?? psu?.part.anchors.sata;
        const port = ports[used];
        const gs = grommet('sata');
        const ahead = (a: { p: V; d: V }, n: number) => a.p.clone().addScaledVector(a.d, n);
        if (d.p.z > open.mid) {
          if (psu && s) { socket++; const sk = toCase(psu, s); runs.push({ ...lead(`sata-power-${key}`, 4, 2.4, 1.0, v(0, 1, 0), filletPath([sk.p, ahead(sk, 22), ahead(pw, 22), pw.p], 12, 2.5, 8, 8)), plugAt: 'both' }); }
          if (port && gs) {
            // Back to the plate, up beside the supply grommet, under the board's edge and up to the port.
            used++;
            const gp = grommet('psu')!; const zf = gs.center[2] + 6;
            const climb = gp.center[0] - gp.size[0] / 2 - 8; const hop = gp.center[1] + gp.size[1] / 2 + 20; const up = gs.center[0] - 14;
            const a = ahead(d, 16); const b = ahead(port, 16);
            runs.push({ ...lead(`sata-data-${key}`, 2, 3.0, 1.4, thin, filletPath([d.p, a, v(a.x, a.y, zf), v(climb, a.y, zf), v(climb, hop, zf), v(up, hop, zf), v(up, b.y, zf), b, port.p], 10, 2.5, 8, 8)), plugAt: 'both' });
          }
          continue;
        }
        if (!gs) continue;
        const zb = open.back - 4; const zf = gs.center[2] + 6;
        const back = (a: { p: V; d: V }, y: number, x: number) => filletPath([a.p, ahead(a, 14), v(ahead(a, 14).x, ahead(a, 14).y, zb), v(x, ahead(a, 14).y, zb), v(x, y, zb), v(x, y, open.mid)], 8, 2.5, 8, 2);
        const front = (a: { p: V; d: V }, y: number, x: number, via = x) => filletPath([a.p, ahead(a, 16), v(via, ahead(a, 16).y, zf), v(via, y, zf), v(x, y, zf), v(x, y, open.mid)], 10, 2.5, 8, 2);
        // Each drive on the back takes a power and a data slot across the grommet; the supply's lead climbs to the right of
        // every supply lane before it turns in.
        const slot = (k: number) => gs.center[1] - gs.size[1] / 2 + 6 + k * 8;
        const i = backDrives++;
        if (psu && s) {
          socket++;
          const sk = toCase(psu, s); const y = slot(2 * i);
          runs.push(lead(`sata-power-${key}`, 4, 2.4, 1.0, thin, back(pw, y, gs.center[0] - 4)));
          runs.push(lead(`sata-power-psu-${key}`, 4, 2.4, 1.0, v(0, 1, 0), front(sk, y, gs.center[0] - 4, open.psuRise)));
        }
        if (port) {
          used++;
          const y = slot(2 * i + 1);
          runs.push(lead(`sata-data-${key}`, 2, 3.0, 1.4, thin, back(d, y, gs.center[0] + 4)));
          runs.push(lead(`sata-data-board-${key}`, 2, 3.0, 1.4, v(0, 0, 1), front(port, y, gs.center[0] + 4)));
        }
        continue;
      }
      if (toCase(item, da).p.z < (tray[0]?.center[2] ?? -75)) continue;
      const s = psu?.part.anchors[`sata${socket}`];
      if (psu && s) {
        socket++;
        const pw = toCase(item, pa); const sk = toCase(psu, s);
        const out = pw.p.clone().addScaledVector(pw.d, 40); const sOut = sk.p.clone().addScaledVector(sk.d, 40);
        const mid = out.clone().lerp(sOut, 0.5);
        runs.push(lead(`sata-power-${key}`, 4, 2.4, 1.0, thin, filletPath([pw.p, out, mid], 18, 2.5, 12, 0)));
        runs.push(lead(`sata-power-psu-${key}`, 4, 2.4, 1.0, v(0, 1, 0), filletPath([sk.p, sOut, mid], 18, 2.5, 12, 0)));
      }
      const port = ports[used];
      const g = port ? grommet('sata') ?? tray.filter((t) => Math.abs(t.center[1] - port.p.y) < t.size[1] / 2 - 8).sort((a, b) => Math.abs(a.center[0] - port.p.x) - Math.abs(b.center[0] - port.p.x))[0] : undefined;
      if (port && g) {
        used++;
        const d = toCase(item, da);
        const out = d.p.clone().addScaledVector(d.d, 32);
        const j = v(out.x, out.y, behind);
        runs.push(lead(`sata-data-${key}`, 2, 3.0, 1.4, thin, filletPath([d.p, out, j], 18, 2.5, 12, 0)));
        const pOut = port.p.clone().addScaledVector(port.d, 16);
        const onTray = g.center[2] + 2.2;
        const gy = Math.min(Math.max(port.p.y, g.center[1] - g.size[1] / 2 + 6), g.center[1] + g.size[1] / 2 - 6);
        runs.push(lead(`sata-data-board-${key}`, 2, 3.0, 1.4, v(0, 0, 1), filletPath([port.p, pOut, v(g.center[0] - 4, gy, onTray + 2), v(g.center[0], gy, behind + 10), v(g.center[0], gy, behind), j], 10, 2.5, 12, 0)));
      }
    }
  }
  for (const r of runs) buildRun(r, group, detail);
  return group;
}

export function cableSignature(build: Build): string {
  return JSON.stringify([build.case, build.board, build.gpu, build.psu, build.cooler, build.fans, build.cables, build.storage]);
}
