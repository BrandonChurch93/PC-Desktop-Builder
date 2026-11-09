import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, type MatName } from './materials';

export type Vec = [number, number, number];
export type Xf = { p?: Vec; r?: Vec; s?: number | Vec };

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function xf(o: Xf = {}): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  _e.set(...(o.r ?? [0, 0, 0]));
  _q.setFromEuler(_e);
  _v.set(...(o.p ?? [0, 0, 0]));
  const s = o.s ?? 1;
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(...s);
  return m.compose(_v, _q, _s);
}

export const at = (x: number, y: number, z: number, r?: Vec) => xf(r ? { p: [x, y, z], r } : { p: [x, y, z] });

// ---- shapes ---------------------------------------------------------------------------------

export function rrect<T extends THREE.Path>(p: T, x: number, y: number, w: number, h: number, r: number): T {
  const rr = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  p.moveTo(x + rr, y); p.lineTo(x + w - rr, y); p.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - rr); p.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  p.lineTo(x + rr, y + h); p.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + rr); p.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return p;
}

/** Rounded rectangle centered on cx, cy. */
export const rrectShape = (w: number, h: number, r: number, cx = 0, cy = 0) => rrect(new THREE.Shape(), cx - w / 2, cy - h / 2, w, h, r);

/** A hole path. Paths used as holes wind the other way. */
export function rrectHole(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Path {
  const p = new THREE.Path();
  const rr = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  const x = cx - w / 2; const y = cy - h / 2;
  p.moveTo(x + rr, y); p.absarc(x + rr, y + rr, rr, Math.PI * 1.5, Math.PI, true);
  p.lineTo(x, y + h - rr); p.absarc(x + rr, y + h - rr, rr, Math.PI, Math.PI / 2, true);
  p.lineTo(x + w - rr, y + h); p.absarc(x + w - rr, y + h - rr, rr, Math.PI / 2, 0, true);
  p.lineTo(x + w, y + rr); p.absarc(x + w - rr, y + rr, rr, 0, -Math.PI / 2, true);
  p.lineTo(x + rr, y);
  return p;
}

export function circleHole(cx: number, cy: number, r: number): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

export function circleShape(cx: number, cy: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return s;
}

export function polyShape(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

export function polyHole(pts: [number, number][]): THREE.Path {
  const p = new THREE.Path();
  const rev = [...pts].reverse();
  rev.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

/** A polygon with each corner rounded by r. */
export function roundedPoly(pts: [number, number][], r: number, hole = false): THREE.Shape {
  const s = hole ? new THREE.Path() as THREE.Shape : new THREE.Shape();
  const n = pts.length;
  const list = hole ? [...pts].reverse() : pts;
  for (let i = 0; i < n; i++) {
    const p0 = list[(i + n - 1) % n]!; const p1 = list[i]!; const p2 = list[(i + 1) % n]!;
    const d1 = [p0[0] - p1[0], p0[1] - p1[1]]; const d2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(d1[0]!, d1[1]!); const l2 = Math.hypot(d2[0]!, d2[1]!);
    const rr = Math.min(r, l1 / 2 - 0.01, l2 / 2 - 0.01);
    const a: [number, number] = [p1[0] + (d1[0]! / l1) * rr, p1[1] + (d1[1]! / l1) * rr];
    const b: [number, number] = [p1[0] + (d2[0]! / l2) * rr, p1[1] + (d2[1]! / l2) * rr];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}

// ---- geometries -----------------------------------------------------------------------------

export function rbox(w: number, h: number, d: number, r = 0.6, seg = 2): THREE.BufferGeometry {
  const rad = Math.max(0.05, Math.min(r, Math.min(w, h, d) / 2 - 0.02));
  return new RoundedBoxGeometry(w, h, d, seg, rad);
}

export type Plane = 'xy' | 'xz' | 'zy' | 'yz';

/** Extrude a shape so the solid spans 0..depth along the plane's normal, bevel included. */
export function extrude(shape: THREE.Shape | THREE.Shape[], depth: number, bevel = 0.4, plane: Plane = 'xy', curveSegments = 18, bevelSegments = 2): THREE.BufferGeometry {
  const b = Math.min(bevel, depth / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - 2 * Math.max(0, b)), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments, curveSegments,
  });
  g.translate(0, 0, Math.max(0, b));
  if (plane === 'xz') g.rotateX(-Math.PI / 2);
  else if (plane === 'zy') g.rotateY(Math.PI / 2);
  else if (plane === 'yz') { g.rotateY(Math.PI / 2); g.rotateX(Math.PI / 2); }
  return g;
}

export function cyl(r: number, h: number, axis: 'x' | 'y' | 'z' = 'y', seg = 32, rTop = r, open = false): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, open);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  return g;
}

/** A cylinder with rounded rims: lathe of a rounded rectangle profile. Axis z, base at z=0. */
export function puck(r: number, h: number, edge = 0.5, seg = 40): THREE.BufferGeometry {
  const e = Math.min(edge, r / 2, h / 2);
  const pts: [number, number][] = [[0, 0], [r - e, 0]];
  for (let i = 1; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2); pts.push([r - e + Math.cos(a) * e, e + Math.sin(a) * e]); }
  pts.push([r, h - e]);
  for (let i = 1; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); pts.push([r - e + Math.cos(a) * e, h - e + Math.sin(a) * e]); }
  pts.push([0, h]);
  return lathe(pts, seg);
}

/** Lathe around the z axis from [radius, z] points. */
export function lathe(points: [number, number][], seg = 40): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

export const torus = (R: number, r: number, radial = 10, tubular = 64) => new THREE.TorusGeometry(R, r, radial, tubular);

export function tube(points: Vec[] | THREE.Curve<THREE.Vector3>, radius: number, segments = 48, radial = 10): THREE.BufferGeometry {
  const curve = Array.isArray(points) ? new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5) : points;
  return new THREE.TubeGeometry(curve, segments, radius, radial, false);
}

export const plane = (w: number, h: number) => new THREE.PlaneGeometry(w, h);

/** A cross recess screw head, origin at the underside of the head, axis +z. Vertex colors darken the recess. */
export function screwGeometry(headR = 2.6, headH = 1.4, kind: 'pan' | 'flat' | 'hex' | 'button' = 'pan'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'hex') {
    const s = new THREE.Shape();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; if (i) s.lineTo(Math.cos(a) * headR, Math.sin(a) * headR); else s.moveTo(Math.cos(a) * headR, Math.sin(a) * headR); }
    s.closePath();
    parts.push(extrude(s, headH, 0.18, 'xy', 6, 1));
    const recess = new THREE.Shape();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const rr = headR * 0.42; if (i) recess.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else recess.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    recess.closePath();
    const rg = new THREE.ShapeGeometry(recess); rg.translate(0, 0, headH + 0.02);
    parts.push(color(rg, 0.08));
  } else {
    const prof: [number, number][] = kind === 'flat'
      ? [[0, 0], [headR * 0.55, 0], [headR, headH * 0.7], [headR, headH], [0, headH]]
      : kind === 'button'
        ? [[0, 0], [headR, 0], [headR, headH * 0.35], [headR * 0.85, headH * 0.8], [headR * 0.5, headH], [0, headH]]
        : [[0, 0], [headR, 0], [headR, headH * 0.55], [headR * 0.82, headH * 0.92], [headR * 0.5, headH], [0, headH]];
    parts.push(color(lathe(prof, 20), 1));
    const a = new THREE.BoxGeometry(headR * 1.1, headR * 0.26, 0.25); a.translate(0, 0, headH + 0.02);
    const b = new THREE.BoxGeometry(headR * 0.26, headR * 1.1, 0.25); b.translate(0, 0, headH + 0.02);
    parts.push(color(a, 0.1), color(b, 0.1));
  }
  for (const p of parts) if (!p.getAttribute('color')) color(p, 1);
  const g = mergeGeometries(parts.map(clean));
  if (!g) throw new Error('screw merge failed');
  return g;
}

function color(g: THREE.BufferGeometry, v: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3).fill(v);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** Non indexed, with position, normal, uv and color only, so geometries merge. */
export function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let x = g.index ? g.toNonIndexed() : g;
  if (!x.getAttribute('normal')) x.computeVertexNormals();
  const n = x.getAttribute('position').count;
  const keep = new THREE.BufferGeometry();
  keep.setAttribute('position', x.getAttribute('position'));
  keep.setAttribute('normal', x.getAttribute('normal'));
  keep.setAttribute('uv', x.getAttribute('uv') ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const c = x.getAttribute('color');
  if (c) keep.setAttribute('color', c);
  const uv1 = x.getAttribute('uv1');
  if (uv1) keep.setAttribute('uv1', uv1);
  if (x !== g) g.dispose();
  x = keep;
  return x;
}

/** Box projected UVs in millimeters, so every surface shares one texel density. */
export function boxUV(g: THREE.BufferGeometry): void {
  const p = g.getAttribute('position'); const n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)); const ay = Math.abs(n.getY(i)); const az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) { uv[i * 2] = p.getY(i); uv[i * 2 + 1] = p.getZ(i); }
    else if (ay >= az) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
    else { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getY(i); }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---- the part builder -----------------------------------------------------------------------

type Batch = { geos: THREE.BufferGeometry[]; material: THREE.Material; shadow: boolean };

export type AddOpts = { uv?: 'box' | 'keep'; shadow?: boolean; to?: THREE.Object3D };

/** Collects geometry per target and material, then merges it so a part costs few draw calls. */
export class PartBuilder {
  readonly root = new THREE.Group();
  private batches = new Map<THREE.Object3D, Map<string, Batch>>();
  private owned: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[] = [];

  constructor(name: string) { this.root.name = name; }

  add(geo: THREE.BufferGeometry, material: MatName | THREE.Material, m?: THREE.Matrix4, opts: AddOpts = {}): this {
    const g = clean(geo);
    if (m) g.applyMatrix4(m);
    if ((opts.uv ?? 'box') === 'box') boxUV(g);
    const target = opts.to ?? this.root;
    const materialObj = typeof material === 'string' ? mat(material) : material;
    const key = materialObj.uuid;
    let map = this.batches.get(target);
    if (!map) { map = new Map(); this.batches.set(target, map); }
    let b = map.get(key);
    if (!b) { b = { geos: [], material: materialObj, shadow: opts.shadow ?? true }; map.set(key, b); }
    b.geos.push(g);
    return this;
  }

  /** Many copies of one geometry, as one instanced mesh. */
  instanced(geo: THREE.BufferGeometry, material: MatName | THREE.Material, matrices: THREE.Matrix4[], opts: AddOpts = {}): THREE.InstancedMesh | null {
    if (matrices.length === 0) return null;
    const g = clean(geo);
    if ((opts.uv ?? 'box') === 'box') boxUV(g);
    const m = new THREE.InstancedMesh(g, typeof material === 'string' ? mat(material) : material, matrices.length);
    matrices.forEach((x, i) => m.setMatrixAt(i, x));
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = opts.shadow ?? true; m.receiveShadow = true;
    m.computeBoundingSphere();
    (opts.to ?? this.root).add(m);
    this.owned.push(g);
    return m;
  }

  /** A child group that moves on its own: latches, plates, rotors. */
  group(name: string, parent: THREE.Object3D = this.root, m?: THREE.Matrix4): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    if (m) m.decompose(g.position, g.quaternion, g.scale);
    parent.add(g);
    return g;
  }

  /** A mesh that must stay separate, with its own material. */
  mesh(geo: THREE.BufferGeometry, material: THREE.Material, m?: THREE.Matrix4, opts: AddOpts = {}): THREE.Mesh {
    const g = clean(geo);
    if (m) g.applyMatrix4(m);
    if (opts.uv === 'box') boxUV(g);
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = opts.shadow ?? false; mesh.receiveShadow = true;
    (opts.to ?? this.root).add(mesh);
    this.owned.push(g);
    return mesh;
  }

  own<T extends THREE.Material | THREE.Texture | THREE.BufferGeometry>(x: T): T { this.owned.push(x); return x; }

  finish(): { root: THREE.Group; dispose: () => void } {
    for (const [target, map] of this.batches) {
      for (const b of map.values()) {
        const names = new Set<string>();
        for (const g of b.geos) for (const n of Object.keys(g.attributes)) names.add(n);
        for (const g of b.geos) {
          const count = g.getAttribute('position').count;
          if (names.has('color') && !g.getAttribute('color')) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
          if (names.has('uv1') && !g.getAttribute('uv1')) g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
        }
        const merged = mergeGeometries(b.geos, false);
        for (const g of b.geos) g.dispose();
        if (!merged) continue;
        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        const mesh = new THREE.Mesh(merged, b.material);
        mesh.name = `${this.root.name}:${b.material.name}`;
        mesh.castShadow = b.shadow; mesh.receiveShadow = true;
        target.add(mesh);
        this.owned.push(merged);
      }
    }
    this.batches.clear();
    const owned = this.owned;
    return { root: this.root, dispose: () => { for (const o of owned) o.dispose(); owned.length = 0; } };
  }
}

/** Vertices of a mesh tree in the root's space, for bounds checks. */
export function forEachVertex(root: THREE.Object3D, fn: (v: THREE.Vector3) => void) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3(); const m = new THREE.Matrix4(); const im = new THREE.Matrix4();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.flexible || !o.visible) return;
    const pos = o.geometry.getAttribute('position');
    m.multiplyMatrices(inv, o.matrixWorld);
    if (o instanceof THREE.InstancedMesh) {
      for (let k = 0; k < o.count; k++) {
        o.getMatrixAt(k, im);
        const mm = new THREE.Matrix4().multiplyMatrices(m, im);
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mm); fn(v); }
      }
    } else {
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); fn(v); }
    }
  });
}
