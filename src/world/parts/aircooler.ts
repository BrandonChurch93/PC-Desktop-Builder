import * as THREE from 'three';
import { brandName, getCooler, type CoolerSpec } from '../../data/catalog';
import { airCoolerBoxes, overhangZ } from '../layout/partBoxes';
import { at, extrude, lathe, PartBuilder, rbox, roundedPoly, screwGeometry, tube, xf, type Vec } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { mat, type MatName } from '../kit/materials';
import { BRAND_TYPE, MODEL_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import type { Zone } from '../light/zones';
import { buildFan, fanLook } from './fan';
import type { Anchor, GenOpts, PartObject, Rotor } from './types';

const PI = Math.PI;
const FIN_PITCH = 2.4;
const FIN_T = 0.5;
const PIPE_R = 3;

/** Frame: origin at the center of the contact plate, +z away from the board, +x toward the memory; air leaves toward -x. */

/** Nickel plated copper base with the pipes soldered in, and the X bracket with four sprung thumbscrews out to the socket's holes. */
function base(pb: PartBuilder) {
  pb.add(rbox(40, 40, 6, 0.8, 2), 'nickel', at(0, 0, 3));
  // Direct contact: the pipes' flattened faces show as bands across the underside, with the base's machined rings around them.
  for (let i = -2; i <= 2; i++) pb.add(rbox(36, 5.4, 0.3, 0.2, 1), 'copper', at(0, i * 6.6, -0.05));
  // Arms end just past the thumbscrews at 47 mm out, clear of a board's top regulator heatsink, which starts 48 mm above the socket.
  const A = 60; const hw = 6.5;
  const arm = roundedPoly([[-A, -hw], [-14, -hw], [-hw, -14], [-hw, -A], [hw, -A], [hw, -14], [14, -hw], [A, -hw], [A, hw], [14, hw], [hw, 14], [hw, A], [-hw, A], [-hw, 14], [-14, hw], [-A, hw]], 2.6);
  pb.add(extrude(arm, 2.4, 0.5, 'xy', 8), 'aluGunmetal', at(0, 0, 6).multiply(new THREE.Matrix4().makeRotationZ(PI / 4)));
  // The bracket is screwed to the base at four points round its middle.
  const bs = screwGeometry(2.0, 1.0, 'pan');
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) pb.add(bs.clone(), 'nickel', at(sx * 15, sy * 15, 8.4), { uv: 'keep' });
  bs.dispose();
  const screws = pb.group('cooler-screws', pb.root);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) {
    const s = pb.group('thumb', screws, at(sx * 42, sy * 42, 8.4));
    pb.add(lathe([[0, 0], [4.6, 0], [4.8, 0.6], [4.8, 3.2], [4.3, 4.0], [0, 4.0]], 24), 'nickel', undefined, { to: s });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; pb.add(rbox(0.6, 0.9, 2.6, 0.2, 1), 'nickel', xf({ p: [Math.cos(a) * 4.85, Math.sin(a) * 4.85, 1.9], r: [0, 0, a] }), { to: s }); }
    pb.add(new THREE.BoxGeometry(4.4, 0.8, 0.4), 'darkVoid', at(0, 0, 4.05), { to: s, uv: 'keep' });
    // The spring under each thumbscrew, a few turns of steel wire.
    const coil: Vec[] = Array.from({ length: 41 }, (_, i) => { const a = (i / 40) * PI * 2 * 4; return [Math.cos(a) * 2.6, Math.sin(a) * 2.6, -2.2 + (i / 40) * 2.0]; });
    pb.add(tube(coil, 0.35, 120, 6), 'steelBare', undefined, { to: s });
  }
  return screws;
}

/** Satin nickel for the pipes: the bright plate's highlight on a thin curved tube showed as single hot pixels. */
let pipeMat: { pb: PartBuilder; m: THREE.MeshPhysicalMaterial } | null = null;
function pipeNickel(pb: PartBuilder): THREE.MeshPhysicalMaterial {
  if (pipeMat?.pb === pb) return pipeMat.m;
  const m = pb.own((mat('nickel') as THREE.MeshPhysicalMaterial).clone()); m.roughness = 0.5; m.color.setHex(0xaeb0b5);
  pipeMat = { pb, m };
  return m;
}

let capMat: { pb: PartBuilder; m: THREE.MeshPhysicalMaterial } | null = null;
function capNickel(pb: PartBuilder): THREE.MeshPhysicalMaterial {
  if (capMat?.pb === pb) return capMat.m;
  const m = pb.own((mat('nickel') as THREE.MeshPhysicalMaterial).clone()); m.roughness = 0.38; m.metalness = 0.55; m.color.setHex(0xc2c4c9);
  capMat = { pb, m };
  return m;
}

/** One heat pipe: a smooth nickel tube through its points, capped where it ends in the top of the stack. */
function pipe(pb: PartBuilder, pts: Vec[], capAt: Vec[] = [], r = PIPE_R) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
  pb.add(tube(curve, r, Math.max(64, Math.round(curve.getLength() / 2)), 16), pipeNickel(pb), undefined, { uv: 'keep' });
  // Satin, part metallic caps: fully metallic, their domes mirrored a dark case interior and read as empty holes (critic 268).
  for (const c of capAt) pb.add(lathe([[0, 0], [r, 0], [r, 0.6], [r * 0.8, 1.2], [0, 1.4]], 24), capNickel(pb), xf({ p: c, r: [PI / 2, 0, 0] }));
}

/** A stack of thin fins in the xy plane, with holes where the pipes pass, instanced from z0 to z1. */
function finStack(pb: PartBuilder, outline: [number, number][], holes: [number, number][], z0: number, z1: number, material: MatName) {
  const s = new THREE.Shape(roundedPoly(outline, 1.2).getPoints(6));
  for (const [hx, hy] of holes) { const h = new THREE.Path(); h.absarc(hx, hy, PIPE_R + 0.15, 0, PI * 2, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth: FIN_T, bevelEnabled: false, curveSegments: 10 });
  const mats: THREE.Matrix4[] = [];
  for (let z = z0; z <= z1 - FIN_T; z += FIN_PITCH) mats.push(at(0, 0, z));
  pb.instanced(g, material, mats);
  g.dispose();
  // The fins' collars stack into a tube round each pipe: a slightly darker sleeve between them.
  for (const [hx, hy] of holes) pb.add(new THREE.CylinderGeometry(PIPE_R + 0.18, PIPE_R + 0.18, z1 - z0, 20, 1, true).rotateX(PI / 2), 'finCoated', at(hx, hy, (z0 + z1) / 2));
}

/** A fan held to a stack's face by two wire clips, top and bottom, hooked into its corner holes and a notch in the fins. */
function clips(pb: PartBuilder, face: number, zc: number, toStack: number, out = 2.6) {
  const dir = Math.sign(face - toStack) || 1;
  for (const zz of [zc + 52.5, zc - 52.5]) for (const s of [1, -1]) {
    // The far end turns in and hooks into a notch in the fins' edge.
    const pts: Vec[] = [[face - dir * 2.5, s * 52.5, zz], [face + dir * (out - 1), s * 52.5, zz], [face + dir * out, s * 57, zz], [face + dir * (out - 1.6), s * 61.4, zz], [face - dir * 8, s * 61.8, zz], [toStack + dir * 6, s * 62.6, zz], [toStack + dir * 1.5, s * 62.8, zz], [toStack - dir * 1.2, s * 61.6, zz], [toStack - dir * 3.2, s * 60.2, zz]];
    pb.add(tube(pts, 0.75, 64, 8), 'steelBare', undefined, { uv: 'keep' });
  }
}

/** The stamped top cover over a tower, with the wordmark and the model line, and the pipe tips showing through it. */
function topPlate(pb: PartBuilder, labels: Labels, k: CoolerSpec, outline: [number, number][], z: number, tips: [number, number][]) {
  const s = new THREE.Shape(roundedPoly(outline, 2.4).getPoints(6));
  for (const [hx, hy] of tips) { const h = new THREE.Path(); h.absarc(hx, hy, PIPE_R + 0.6, 0, PI * 2, true); s.holes.push(h); }
  // A painted stamped cover: a bare metal one mirrored the softboxes and swallowed its print.
  pb.add(extrude(s, 2.6, 0.9, 'xy', 24, 3), 'powderBlack', at(0, 0, z));
  const xs = outline.map((p) => p[0]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  // Across the plate's width in the free band past the pipe tips, reading from the fan side.
  const up2 = new THREE.Matrix4();
  // Narrower plates take a smaller mark, so it keeps a margin to the plate's edges.
  const fit = Math.min(1, (Math.max(...xs) - Math.min(...xs) - 12) / 38);
  // Clear of the pipe tips, which take the middle of the plate; read from the fan side, the model line below the wordmark.
  labels.text(brandName(k.brand).toUpperCase(), BRAND_TYPE[k.brand] ?? SPEC_TYPE, 5.2 * fit, at(cx, -45, z + 2.65).multiply(up2), { color: '#dfe1e7' });
  labels.text(k.name.toUpperCase(), MODEL_TYPE, 2.6 * fit, at(cx, -54, z + 2.65).multiply(up2), { color: '#a9adb6' });
}

/** Legs of a tower's pipes: two staggered rows across its depth, spread across its width. */
function legs(xa: number, xb: number, ys: number[]): [number, number][] {
  return ys.map((y, i) => [i % 2 ? xb : xa, y]);
}

function tower(pb: PartBuilder, labels: Labels, k: CoolerSpec, key: string, opts: GenOpts) {
  const h = k.height ?? 158;
  const x0 = -37.5; const x1 = 12.5;
  // Six U pipes: twelve legs on a grid of three rows across the stack's depth and four across its width.
  const rows = [-22, -9.5, 3]; const levels = [24, 8];
  const L: [number, number][] = rows.flatMap((x) => [-24, -8, 8, 24].map((y): [number, number] => [x, y]));
  const outline: [number, number][] = [[x0 + 0.5, -62], [x1 - 0.5, -62], [x1 - 0.5, -24], [x1 - 3.5, 0], [x1 - 0.5, 24], [x1 - 0.5, 62], [x0 + 0.5, 62]];
  finStack(pb, outline, L, 42, h - 5, 'finCoated');
  topPlate(pb, labels, k, [[x0, -62.5], [x1, -62.5], [x1, 62.5], [x0, 62.5]], h - 3, L);
  // In the base the six lie side by side; each rises to its row, the outer pair from the outer base positions.
  const bases = [-15, -9, -3, 3, 9, 15];
  rows.forEach((xr, r) => levels.forEach((l, j) => {
    const xb = bases[r * 2 + j]!;
    pipe(pb, [[xr, -l, h - 2], [xr, -l, 46], [(xr + xb) / 2, -l * 0.85, 20], [xb, -14, 6], [xb, -10, 3], [xb, 10, 3], [xb, 14, 6], [(xr + xb) / 2, l * 0.85, 20], [xr, l, 46], [xr, l, h - 2]], [[xr, -l, h - 1.6], [xr, l, h - 1.6]]);
  }));
  const fanX = 25.5; const fanZ = h - 62;
  return { fans: [{ m: at(fanX, 0, fanZ).multiply(new THREE.Matrix4().makeRotationY(-PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(PI)), thick: 25 }], clip: [{ face: fanX + 12.5, z: fanZ, stack: x1, out: 2.6 }], lit: k.id === 'pillar-lux', key, opts };
}

function twin(pb: PartBuilder, labels: Labels, k: CoolerSpec, key: string, opts: GenOpts) {
  const h = k.height ?? 166;
  const under = overhangZ(k.ramClearance ?? 45);
  const T1: [number, number] = [-50, -7.5]; const T2: [number, number] = [21.5, 64];
  const ys = [-27, -18, -9, 0, 9, 18, 27];
  const L1 = legs(-36, -20, ys); const L2 = legs(34, 50, ys);
  for (const [[a, b], L] of [[T1, L1], [T2, L2]] as [[number, number], [number, number][]][]) {
    const outline: [number, number][] = [[a + 0.5, -62], [b - 0.5, -62], [b - 0.5, -24], [b - 3.5, 0], [b - 0.5, 24], [b - 0.5, 62], [a + 0.5, 62]];
    finStack(pb, outline, L, under + 1.5, h - 5, 'finCoated');
    topPlate(pb, labels, k, [[a, -62.5], [b, -62.5], [b, 62.5], [a, 62.5]], h - 3, L);
  }
  // Seven pipes, each one U from the first tower down through the base and up into the second.
  for (let i = 0; i < 7; i++) {
    const yb = -17.1 + i * 5.7;
    const [xa, ya] = L1[i]!; const [xc, yc] = L2[i]!;
    pipe(pb, [[xa, ya, h - 2], [xa, ya, under + 10], [-28, ya * 0.95, under - 2], [-17, yb, 6], [-12, yb, 3], [12, yb, 3], [17, yb, 6], [28, yc * 0.95, under - 2], [xc, yc, under + 10], [xc, yc, h - 2]], [[xa, ya, h - 1.6], [xc, yc, h - 1.6]], 2.8);
  }
  const fanZ = (under + 3 + h - 2) / 2;
  const rot = new THREE.Matrix4().makeRotationY(-PI / 2).multiply(new THREE.Matrix4().makeRotationZ(PI));
  return { fans: [{ m: at(77.5, 0, fanZ).multiply(rot), thick: 25 }, { m: at(7, 0, fanZ).multiply(rot.clone()), thick: 25 }], clip: [{ face: 90, z: fanZ, stack: T2[1], out: 2.6 }, { face: 19.5, z: fanZ, stack: T1[1], out: 1.0 }], lit: false, key, opts };
}

function lowProfile(pb: PartBuilder, labels: Labels, k: CoolerSpec, key: string, opts: GenOpts) {
  const h = k.height ?? 58;
  const under = overhangZ(k.ramClearance ?? 34);
  const top = h - 15;
  const x0 = -38; const x1 = 86;
  const zr = (under + top) / 2;
  // Fins stand on edge across the stack's length, so the fan above blows down between them and the air leaves through the
  // long sides, where every fin edge shows. The pipes run along the stack through them; stamped end caps carry the print.
  const runs = [-50, -24, 24, 50];
  const fin = new THREE.Shape(roundedPoly([[-61.5, under + 0.2], [61.5, under + 0.2], [61.5, top - 0.2], [-61.5, top - 0.2]], 0.8).getPoints(4));
  for (const ry of runs) { const p = new THREE.Path(); p.absarc(ry, zr, PIPE_R + 0.15, 0, PI * 2, true); fin.holes.push(p); }
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.5, bevelEnabled: false, curveSegments: 10 });
  fg.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  const mats: THREE.Matrix4[] = [];
  for (let x = x0 + 3; x <= x1 - 3.5; x += 2.2) mats.push(at(x, 0, 0));
  pb.instanced(fg, 'finCoated', mats);
  fg.dispose();
  for (const s of [1, -1]) {
    const ex = s > 0 ? x1 - 1.2 : x0 + 1.2;
    pb.add(rbox(2.0, 122.6, top - under - 0.4, 0.9, 3), 'aluGunmetal', at(ex, 0, zr));
    const face = (y: number, z: number) => at(ex + s * 1.05, y, z).multiply(new THREE.Matrix4().makeRotationZ(s > 0 ? PI / 2 : -PI / 2)).multiply(new THREE.Matrix4().makeRotationX(PI / 2));
    // The pipes enter through the cap at the open end, so the print goes on the other one.
    if (s < 0) continue;
    labels.text(brandName(k.brand).toUpperCase(), BRAND_TYPE[k.brand] ?? SPEC_TYPE, 4.0, face(-s * 16, zr + 0.4), { color: '#c3c6ce' });
    labels.text(k.name.toUpperCase(), MODEL_TYPE, 2.8, face(s * 36, zr), { color: '#a3a7b0' });
  }
  // Four J pipes, as on many low profile coolers: sealed in the base, out past the stack's open end, up in a tight bend and
  // back in through the end cap along the whole stack, so the bends stand in the light outside the stack.
  runs.forEach((ry, i) => {
    const yb = -9 + i * 6; const xo = x0 - 7;
    pipe(pb, [[16, yb, 3], [-8, yb, 3], [-20, yb, 3.2], [xo + 4, (yb + ry) / 2, 4.5], [xo, ry, 10], [xo - 1, ry, zr - 8], [xo + 2, ry, zr - 1.5], [x0 + 2, ry, zr], [x1 - 2.5, ry, zr]], [[16, yb, 3]]);
    pb.add(new THREE.TorusGeometry(PIPE_R + 0.5, 0.5, 8, 24).rotateY(PI / 2), 'aluGunmetal', at(x0 - 0.1, ry, zr), { uv: 'keep' });
  });
  // The slim fan is screwed down through its corner holes into the stack's top rails.
  const sg = screwGeometry(2.3, 1.2, 'pan');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x2a2b30, metalness: 1, roughness: 0.38, vertexColors: true }));
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) pb.add(sg.clone(), sm, at(24 + sx * 52.5, sy * 52.5, h + 0.7), { uv: 'keep' });
  sg.dispose();
  return { fans: [{ m: at(24, 0, top + 7.5).multiply(new THREE.Matrix4().makeRotationX(PI)), thick: 15 }], clip: [], lit: false, key, opts };
}

export function airCoolerPart(id: string, opts: GenOpts = {}): PartObject {
  const k = getCooler(id);
  if (!k) throw new Error(`no cooler ${id}`);
  const key = opts.key ?? `cooler:${id}`;
  const pb = new PartBuilder(`cooler-${id}`);
  const labels = new Labels(pb, 22);
  const screws = base(pb);
  const build = k.type === 'lowprofile' ? lowProfile(pb, labels, k, key, opts) : k.fans >= 2 ? twin(pb, labels, k, key, opts) : tower(pb, labels, k, key, opts);
  const zones: Zone[] = []; const rotors: Rotor[] = [];
  const look = build.lit ? fanLook('gale-lux') : fanLook('gale');
  build.fans.forEach((f, i) => {
    const fb = buildFan(pb, labels, look, 120, f.m, `${key}:fan${i}`, { detail: opts.detail, thick: f.thick, tucked: !opts.loose || i > 0, loose: !!opts.loose && i === 0, daisy: i > 0 });
    // The fan's exhaust face is against the fins, which take its light: only the intake face lights the room.
    for (const z of fb.zones) {
      for (let j = z.emitters.length - 1; j >= 0; j--) if (z.emitters[j]!.normal.z > 0.5) z.emitters.splice(j, 1);
      (z as { target: string }).target = 'cooler'; zones.push(z);
    }
    rotors.push(...fb.rotors);
  });
  for (const c of build.clip) clips(pb, c.face, c.z, c.stack, c.out);
  labels.text(`TDP ${k.capacity} W · 4-PIN PWM`, TINY_TYPE, 1.2, xf({ p: [0, -20.05, 3], r: [PI / 2, 0, 0] }).multiply(new THREE.Matrix4().makeRotationY(PI)), { color: '#8a8e97' });
  labels.finish();
  const done = pb.finish();
  const lead: Anchor = { pos: [build.fans[0] ? 20 : 0, -66, 30], dir: [0, -1, 0] };
  return { root: done.root, boxes: airCoolerBoxes(id), anchors: { cable: lead }, zones, rotors, movers: { screws }, dispose: () => { done.dispose(); for (const z of zones) z.dispose(); } };
}

