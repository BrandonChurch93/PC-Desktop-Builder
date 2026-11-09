import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getCable, getGpu } from '../data/catalog';
import type { Build } from '../engine/types';
import { mat, sleeve } from './kit/materials';
import { rbox, rrect as rrectPath } from './kit/geometry';
import { CASE_LAYOUTS } from './layout/cases';
import type { CaseLayout } from './layout/types';
import type { Anchor } from './parts/types';
import type { RigItem } from './rig';

type V = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A path through corners, each corner rounded to at least the given radius, so straight runs stay straight. */
export function filletPath(points: V[], radius: number, step = 2.5, straight = 12): V[] {
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
    const limB = i + 1 === points.length - 1 ? lb - straight : lb * 0.5;
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

/** Tangent frames carried along a path without twist. */
function frames(path: V[], firstNormal: V) {
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
  return { T, N, B };
}

export type Run = {
  name: string;
  path: V[];
  rows: number; cols: number; pitch: number; wire: number;
  /** across the row direction at the path start */
  rowAxis: V;
  colors: string[];
  comb: string;
  plugAt: 'end' | 'start' | 'none';
};

function sweep(points: V[], r: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const len = curve.getLength();
  const g = new THREE.TubeGeometry(curve, Math.max(12, Math.round(len / 2.4)), r, radial, false);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * r * 2 * Math.PI);
  return g;
}

/** Builds one run: each wire its own tube, combs along the straights, a plug housing at the connector end. */
export function buildRun(run: Run, group: THREE.Group, detail = 1) {
  const { T, N, B } = frames(run.path, run.rowAxis);
  const byColor = new Map<string, THREE.BufferGeometry[]>();
  for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) {
    const or = (r - (run.rows - 1) / 2) * run.pitch; const oc = (c - (run.cols - 1) / 2) * run.pitch;
    const pts = run.path.map((p, i) => p.clone().addScaledVector(N[i]!, or).addScaledVector(B[i]!, oc));
    const color = run.colors.length > 1 && c % 2 === 0 ? run.colors[1]! : run.colors[0]!;
    const list = byColor.get(color) ?? [];
    list.push(sweep(pts, run.wire, detail >= 1 ? 8 : 6));
    byColor.set(color, list);
  }
  for (const [color, geos] of byColor) {
    const merged = mergeGeometries(geos.map((x) => x.toNonIndexed()), false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, color.startsWith('#') ? sleeve(color) : mat('rubber'));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.flexible = true; mesh.name = `run:${run.name}`;
    group.add(mesh);
  }
  if (run.rows * run.cols < 2) return;
  const total = run.path.reduce((s, p, i) => (i ? s + p.distanceTo(run.path[i - 1]!) : 0), 0);
  const combMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(run.comb), roughness: 0.32, clearcoat: 0.5 });
  const cw = run.cols * run.pitch + 3; const ch = run.rows * run.pitch + 3;
  const combShape = new THREE.Shape(); rrectPath(combShape, -ch / 2, -cw / 2, ch, cw, 1.6);
  for (let r = 0; r < run.rows; r++) for (let c = 0; c < run.cols; c++) { const h = new THREE.Path(); h.absarc((r - (run.rows - 1) / 2) * run.pitch, (c - (run.cols - 1) / 2) * run.pitch, run.wire + 0.12, 0, Math.PI * 2, true); combShape.holes.push(h); }
  const comb = new THREE.ExtrudeGeometry(combShape, { depth: 4.2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelOffset: -0.5, bevelSegments: 2, curveSegments: 12 });
  comb.translate(0, 0, -2.1);
  const holes: THREE.BufferGeometry[] = [];
  const combs: THREE.Matrix4[] = [];
  let acc = 0; let next = 34;
  for (let i = 1; i < run.path.length - 1; i++) {
    acc += run.path[i]!.distanceTo(run.path[i - 1]!);
    if (acc >= next && acc < total - 24) {
      const bend = T[i - 1]!.dot(T[Math.min(T.length - 1, i + 2)]!) < 0.995;
      if (!bend || acc - next > 20) {
        const m = new THREE.Matrix4().makeBasis(N[i]!, B[i]!, T[i]!).setPosition(run.path[i]!);
        combs.push(m);
        next = acc + 50;
      }
    }
  }
  for (const m of combs) {
    const g = comb.clone(); g.applyMatrix4(m); holes.push(g);
  }
  if (holes.length) {
    const merged = mergeGeometries(holes.map((x) => x.toNonIndexed()), false);
    if (merged) { const mesh = new THREE.Mesh(merged, combMat); mesh.castShadow = true; mesh.userData.flexible = true; group.add(mesh); }
  }
  for (const g of holes) g.dispose();
  comb.dispose();
  if (run.plugAt !== 'none') {
    const i = run.plugAt === 'end' ? run.path.length - 1 : 0;
    const dir = run.plugAt === 'end' ? T[i]!.clone() : T[i]!.clone().negate();
    const m = new THREE.Matrix4().makeBasis(dir, N[i]!, new THREE.Vector3().crossVectors(dir, N[i]!)).setPosition(run.path[i]!.clone().addScaledVector(dir, -4.5));
    const housing = rbox(9, ch - 0.6, cw - 0.6, 0.8, 2);
    housing.applyMatrix4(m);
    const clip = rbox(6, 2.4, 6, 0.6, 1);
    clip.applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, ch / 2 + 0.8, 0)));
    const merged = mergeGeometries([housing.toNonIndexed(), clip.toNonIndexed()], false);
    housing.dispose(); clip.dispose();
    if (merged) { const mesh = new THREE.Mesh(merged, mat('plasticDark')); mesh.castShadow = true; mesh.userData.flexible = true; group.add(mesh); }
  }
}

const toCase = (item: RigItem, a: Anchor): { p: V; d: V } => {
  item.holder.updateMatrix();
  const m = item.holder.matrix;
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return { p: new THREE.Vector3(...a.pos).applyMatrix4(m), d: new THREE.Vector3(...a.dir).applyQuaternion(q).normalize() };
};

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
  if (board && psu) {
    const a = board.part.anchors.atx24; const g = grommet('atx24');
    if (a && g) {
      const { p } = toCase(board, a);
      const gz = g.center[2];
      runs.push({ name: 'atx24', rows: 2, cols: 12, pitch: 4.2, wire: 1.65, rowAxis: v(1, 0, 0), colors, comb, plugAt: 'start',
        path: filletPath([p.clone(), v(p.x, p.y, p.z + 40), v(g.center[0], p.y + (g.center[1] - p.y) * 0.5, p.z + 40), v(g.center[0], g.center[1], gz - 14)], 19) });
    }
    const e = board.part.anchors.eps; const ge = grommet('eps');
    if (e && ge) {
      const { p } = toCase(board, e);
      runs.push({ name: 'eps', rows: 2, cols: 4, pitch: 4.2, wire: 1.65, rowAxis: v(0, 1, 0), colors, comb, plugAt: 'start',
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
      runs.push({ name: `gpu-power-${i}`, rows: 2, cols, pitch, wire: twelve ? 1.35 : 1.65, rowAxis: v(0, 1, 0), colors, comb, plugAt: 'start',
        path: filletPath([p.clone(), v(p.x, p.y, Math.max(p.z + 30.4, gz + 11)), v(gx, down, Math.max(p.z + 30.4, gz + 11))], 18.4) });
    });
  }
  const pump = items.get('cooler'); const rad = items.get('radiator');
  if (pump && rad && pump.part.anchors.fitting0 && rad.part.anchors.fitting0) {
    const frost = rad.placed.id.includes('frost');
    for (let i = 0; i < 2; i++) {
      const a = toCase(pump, pump.part.anchors[`fitting${i}`]!); const b = toCase(rad, rad.part.anchors[`fitting${1 - i}`]!);
      const up = a.p.clone().addScaledVector(a.d, 14);
      const near = b.p.clone().addScaledVector(b.d, 28);
      const side = near.clone().addScaledVector(b.d, 2); side.x -= 36 * Math.sign(b.p.x - a.p.x || 1);
      const p1 = a.p.clone().addScaledVector(a.d, 30); p1.z += 14;
      const pts = [a.p, up, p1, side, near, b.p];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
      const len = curve.getLength();
      const geo = new THREE.TubeGeometry(curve, Math.max(64, Math.round(len / 3)), 6.1, 18, false);
      const uv = geo.getAttribute('uv');
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len, uv.getY(k) * 6.1 * 2 * Math.PI);
      const m = new THREE.Mesh(geo, sleeve(frost ? '#dcdee3' : '#1c1c21'));
      m.castShadow = true; m.receiveShadow = true; m.userData.flexible = true; m.name = 'tube';
      group.add(m);
    }
  }
  for (const [key, item] of items) {
    if (item.placed.kind !== 'fan') continue;
    const mount = String(item.placed.meta.mount);
    const gid = mount.startsWith('front') ? 'front' : mount.startsWith('top') ? 'top' : mount.startsWith('rear') ? 'rear' : 'front';
    const g = grommet(gid);
    const lead = item.part.anchors.lead;
    if (!g || !lead) continue;
    const { p } = toCase(item, lead);
    const target = v(g.center[0], g.center[1], g.center[2]);
    const mid = p.clone().lerp(target, 0.5); mid.z = Math.min(mid.z, -60);
    runs.push({ name: `lead-${key}`, rows: 1, cols: 1, pitch: 0, wire: 1.2, rowAxis: v(0, 1, 0), colors: ['rubber'], comb, plugAt: 'none', path: filletPath([p, mid, v(target.x, target.y, target.z + 8), v(target.x, target.y, target.z - 10)], 12) });
  }
  for (const r of runs) buildRun(r, group, detail);
  return group;
}

export function cableSignature(build: Build): string {
  return JSON.stringify([build.case, build.board, build.gpu, build.psu, build.cooler, build.fans, build.cables]);
}
