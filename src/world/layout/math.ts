export type V3 = [number, number, number];
export type Rot = [number, number, number];
export type Box = { min: V3; max: V3; tag: string };
export type Pose = { pos: V3; rot: Rot };
type M3 = [number, number, number, number, number, number, number, number, number];

const HALF = Math.PI / 2;
export const R0: Rot = [0, 0, 0];
export const Q = HALF;

const snap = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Math.abs(v - 1) < 1e-9 ? 1 : Math.abs(v + 1) < 1e-9 ? -1 : v);

function rx(a: number): M3 { const c = snap(Math.cos(a)); const s = snap(Math.sin(a)); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function ry(a: number): M3 { const c = snap(Math.cos(a)); const s = snap(Math.sin(a)); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rz(a: number): M3 { const c = snap(Math.cos(a)); const s = snap(Math.sin(a)); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
function mul(a: M3, b: M3): M3 {
  const o: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!);
  return o.map(snap) as M3;
}

/** Rotation matrix of a three.js style Euler in XYZ order. */
export function matrixOf(r: Rot): M3 { return mul(mul(rx(r[0]), ry(r[1])), rz(r[2])); }

export function rotate(r: Rot, v: V3): V3 {
  const m = matrixOf(r);
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

export function apply(p: Pose, v: V3): V3 { return add(p.pos, rotate(p.rot, v)); }

/** Compose: child pose given in parent space. */
export function compose(parent: Pose, child: Pose): Pose {
  const m = mul(matrixOf(parent.rot), matrixOf(child.rot));
  return { pos: apply(parent, child.pos), rot: eulerOf(m) };
}

/** Euler XYZ of a rotation matrix, as three.js Euler.setFromRotationMatrix does. */
export function eulerOf(m: M3): Rot {
  const m13 = m[2]; const clamp = Math.max(-1, Math.min(1, m13));
  const y = Math.asin(clamp);
  let x: number; let z: number;
  if (Math.abs(m13) < 0.9999999) { x = Math.atan2(-m[5], m[8]); z = Math.atan2(-m[1], m[0]); } else { x = Math.atan2(m[7], m[4]); z = 0; }
  return [x, y, z].map((a) => Math.round(a / HALF) * HALF + 0) as Rot;
}

export function box(min: V3, max: V3, tag: string): Box {
  return { min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])], max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])], tag };
}

/** Axis aligned box from center and size. */
export function cbox(center: V3, size: V3, tag: string): Box {
  return box(sub(center, scale(size, 0.5)), add(center, scale(size, 0.5)), tag);
}

export function transformBox(p: Pose, b: Box): Box {
  const a = apply(p, b.min); const c = apply(p, b.max);
  return box(a, c, b.tag);
}

/** Overlap depth of two boxes: the smallest of the three axis overlaps, or 0 when apart. */
export function overlap(a: Box, b: Box): number {
  let d = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = Math.min(a.max[i]!, b.max[i]!) - Math.max(a.min[i]!, b.min[i]!);
    if (o <= 0) return 0;
    d = Math.min(d, o);
  }
  return d;
}

export function union(boxes: Box[], tag = 'all'): Box {
  const min: V3 = [Infinity, Infinity, Infinity]; const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i]!, b.min[i]!); max[i] = Math.max(max[i]!, b.max[i]!); }
  return { min, max, tag };
}
