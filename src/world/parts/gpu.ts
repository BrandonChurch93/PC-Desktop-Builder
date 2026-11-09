import * as THREE from 'three';
import { brandName, getGpu, K, type GpuSpec } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { gpuBoxes, slotsOf } from '../layout/partBoxes';
import { bladeGeometry, blurDiscTexture } from '../kit/blades';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, polyHole, rbox, roundedPoly, rrectHole, screwGeometry, torus, xf } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { mat, PART_FINISHES, type MatName } from '../kit/materials';
import { fingerMaterial } from '../kit/pcb';
import { seededFor } from '../kit/rng';
import { BRAND_TYPE, MODEL_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { spillStrip, spillStripRange, uvAlong, Zone } from '../light/zones';
import type { Anchor, GenOpts, PartObject, Rotor } from './types';

const PI = Math.PI;
/** Maps a shape drawn in (card x, card z) to the card: extrusion goes toward -y. */
const XZ = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
const xzAt = (y: number) => new THREE.Matrix4().makeTranslation(0, y, 0).multiply(XZ);

export type Card = {
  spec: GpuSpec; L: number; H: number; T: number; back: number; end: number; bp: number; clear: number;
  fanY: number; pcbTop: number; pcbEnd: number; slots: number;
  fanR: number; fanX: number[]; frost: boolean; key: string;
};

export function cardDims(spec: GpuSpec, key: string): Card {
  const back = -DIMS.fingerOffset;
  const L = spec.length; const H = spec.height - DIMS.fingerSeat; const T = spec.thickness;
  const end = L + back;
  const n = spec.fans;
  const span = end - back - 24;
  const fanR = Math.min((H - (DIMS.cardClear - DIMS.fingerSeat)) / 2 - 7, span / n / 2 - 3, 52);
  const fanX = Array.from({ length: n }, (_, i) => back + 12 + span * ((i + 0.5) / n));
  return {
    spec, L, H, T, back, end, bp: DIMS.backplateRise, clear: DIMS.cardClear - DIMS.fingerSeat,
    fanY: -(T - DIMS.backplateRise), pcbTop: Math.min(H - 9, 124), pcbEnd: Math.min(end - 4, back + Math.max(170, L * 0.68)),
    slots: slotsOf(T), fanR, fanX, frost: spec.finish === 'frost', key,
  };
}

// ---- shared pieces --------------------------------------------------------------------------

function pcb(pb: PartBuilder, labels: Labels, c: Card) {
  const o: [number, number][] = [
    [c.back + 1, 3], [-1.5, 3], [-1.5, 0.6], [0, 0], [11.2, 0], [11.2, 2.6], [13.1, 2.6], [13.1, 0], [DIMS.pcieX16Length, 0], [DIMS.pcieX16Length + 1.5, 0.6], [DIMS.pcieX16Length + 1.5, 3],
    [c.pcbEnd, 3], [c.pcbEnd, c.pcbTop], [c.back + 1, c.pcbTop],
  ];
  pb.add(extrude(roundedPoly(o, 0.4), 1.6, 0.2, 'xy', 4), c.frost ? 'pcbWhite' : 'pcbBlack', xzAt(0.8));
  const fm = fingerMaterial('pcie', DIMS.pcieX16Length, 7.5, 1.0, [[11.2, 13.1]], c.frost ? 'rgba(220,222,226,1)' : 'rgba(14,16,20,1)');
  for (const side of [1, -1]) {
    const g = new THREE.PlaneGeometry(DIMS.pcieX16Length, 7.5);
    g.translate(DIMS.pcieX16Length / 2, 3.75 + 0.2, 0);
    pb.mesh(g, fm, new THREE.Matrix4().makeTranslation(0, side * 0.82, 0).multiply(new THREE.Matrix4().makeRotationX(side > 0 ? -PI / 2 : PI / 2)).multiply(side > 0 ? new THREE.Matrix4() : new THREE.Matrix4().makeScale(1, -1, 1)), { uv: 'keep' });
  }
  const r = seededFor(`pcb-${c.key}`);
  for (let i = 0; i < 70; i++) {
    const x = c.back + 6 + r() * (c.pcbEnd - c.back - 12);
    const z = c.pcbTop - 2 - r() * 8;
    pb.add(rbox(1.0, 0.6, 0.5, 0.1, 1), r() > 0.5 ? 'ceramic' : 'chip', xf({ p: [x, -1.1, z] }));
  }
  for (let i = 0; i < 8; i++) pb.add(rbox(6, 4.2, 6, 0.6, 1), 'ferrite', xf({ p: [c.back + 14 + i * 7.2, -3, c.pcbTop - 8] }));
  labels.text(`${brandName(c.spec.brand).toUpperCase()} ${c.spec.name.toUpperCase()} · REV 1.0`, TINY_TYPE, 1.8, xf({ p: [c.pcbEnd - 30, -0.82, 5.5], r: [PI / 2, 0, 0] }), { color: c.frost ? '#5d616b' : '#a2a6ae' });
}

function bracket(pb: PartBuilder, labels: Labels, c: Card, style: 'slant' | 'grid') {
  const x = c.back;
  const y0 = c.bp - c.slots * K.slotPitch; const y1 = c.bp;
  const hy = y1 - y0;
  const s = roundedPoly([[-9, y0 + 3], [-2, y0 + 3], [-1, y0 + 1.5], [112, y0 + 1.5], [112, y1 - 0.5], [-1, y1 - 0.5], [-2, y0 + 11], [-9, y0 + 11]], 0.8) as THREE.Shape;
  const ports: [number, number, number, number][] = [];
  const portY = -9;
  for (let i = 0; i < 4; i++) ports.push([18 + i * 19, portY + (i === 3 ? 0.5 : 0), i === 3 ? 15 : 17.5, i === 3 ? 6.2 : 5.4]);
  for (const [pz, py, pw, ph] of ports) s.holes.push(rrectHole(pw, ph, 1.2, pz, py));
  const rows = Math.max(1, c.slots - 1);
  for (let rr = 0; rr < rows; rr++) {
    const cy = y0 + (rr + 0.5) * (hy - 22) / rows;
    for (let k = 0; k < 8; k++) {
      const z0 = 8 + k * 12;
      if (style === 'slant') s.holes.push(polyHole([[z0, cy - 4.5], [z0 + 6, cy - 4.5], [z0 + 9, cy + 4.5], [z0 + 3, cy + 4.5]]));
      else s.holes.push(rrectHole(8, 9, 1, z0 + 4, cy));
    }
  }
  s.holes.push(circleHole(104, -1.6, 2.2));
  const g = extrude(s, DIMS.bracketT, 0.15, 'xy', 6, 1);
  const plate: MatName = style === 'slant' ? 'powderBlack' : 'steelZinc';
  pb.add(g, plate, new THREE.Matrix4().makeTranslation(x + DIMS.bracketT, 0, 0).multiply(new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)));
  pb.add(rbox(10, hy - 2, 1, 0.3, 1), plate, xf({ p: [x - 5, (y0 + y1) / 2, 111.6] }));
  for (const [pz, py, pw, ph] of ports) {
    pb.add(rbox(14, ph + 1.2, pw + 1.2, 0.5, 1), 'nickel', xf({ p: [x + 8, py, pz] }));
    pb.add(new THREE.BoxGeometry(12, ph - 1.4, pw - 2), 'darkVoid', xf({ p: [x + 7.2, py, pz] }), { uv: 'keep' });
    pb.add(new THREE.BoxGeometry(11, 1.2, pw - 5), 'plasticDark', xf({ p: [x + 7, py, pz] }));
  }
  labels.text('HDMI', TINY_TYPE, 1.2, xf({ p: [x - 0.05, portY - 5.2, ports[3]![0]], r: [0, -PI / 2, 0] }), { color: '#4b4e55' });
  for (let i = 0; i < 3; i++) labels.text('DP', TINY_TYPE, 1.2, xf({ p: [x - 0.05, portY - 5.2, ports[i]![0]], r: [0, -PI / 2, 0] }), { color: '#4b4e55' });
  const screws = pb.group('bracket-screws', pb.root);
  const sg = screwGeometry(3.2, 2.4, 'pan');
  const sm = mat('nickel');
  for (let i = 0; i < Math.min(2, c.slots); i++) {
    const sgp = pb.group('screw', screws, xf({ p: [x - 6, y0 + 11 + i * K.slotPitch, 112.2] }));
    const ssm = sm.clone() as THREE.MeshPhysicalMaterial; ssm.vertexColors = true; pb.own(ssm);
    pb.add(sg.clone(), ssm, undefined, { to: sgp, uv: 'keep' });
  }
  sg.dispose();
  return screws;
}

const FIN_T = 0.42;

function fins(pb: PartBuilder, c: Card, material: MatName, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, pitch = 1.9) {
  const n = Math.max(2, Math.floor((x1 - x0) / pitch));
  const geo = new THREE.BoxGeometry(FIN_T, y1 - y0, z1 - z0);
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < n; i++) mats.push(xf({ p: [x0 + i * pitch, (y0 + y1) / 2, (z0 + z1) / 2] }));
  const m = pb.instanced(geo, material, mats);
  // Seen edge on, a fin is thinner than a pixel; the occlusion pass has no multisampling and turned it into dotted noise.
  if (m) m.userData.noAO = true;
  void c;
}

/**
 * The bar's light on the fins seen through the window below it: a thin layer on each fin's top and on the upper part of its
 * faces, fading down the face, so the gaps between fins stay dark. One flat layer over the window lit every fin face evenly
 * at every depth and read as a neon grille.
 */
function finLight(pb: PartBuilder, zone: Zone, gain: number, fx0: number, fx1: number, bx0: number, bx1: number, ya: number, yb: number, zt: number, pitch = 1.9) {
  const pos: number[] = []; const uv: number[] = []; const col: number[] = [];
  const quad = (p: [number, number, number][], u: number, k: [number, number, number, number]) => {
    const v = [0, 0, 1, 1];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]!); uv.push(u, v[i]!); col.push(k[i]!, k[i]!, k[i]!); }
  };
  const n = Math.max(2, Math.floor((fx1 - fx0) / pitch));
  const half = FIN_T / 2;
  for (let i = 0; i < n; i++) {
    const x = fx0 + i * pitch;
    if (x < bx0 || x > bx1) continue;
    const u = (x - bx0) / (bx1 - bx0);
    quad([[x - half, yb, zt + 0.02], [x + half, yb, zt + 0.02], [x + half, ya, zt + 0.02], [x - half, ya, zt + 0.02]], u, [1, 1, 1, 1]);
    for (const s of [-1, 1]) { const xs = x + s * (half + 0.01); quad([[xs, yb, zt], [xs, yb, zt - 3], [xs, ya, zt - 3], [xs, ya, zt]], u, [1, 0, 0, 1]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = pb.own(zone.spill(gain).clone()); m.vertexColors = true;
  pb.mesh(g, m, undefined, { uv: 'keep' }).userData.spill = true;
}

function heatpipes(pb: PartBuilder, c: Card, count: number, y: number, z0: number, z1: number) {
  for (let i = 0; i < count; i++) {
    const z = z0 + ((z1 - z0) * (i + 0.5)) / count;
    const x0 = c.back + 22; const x1 = c.end - 14;
    pb.add(cyl(3, x1 - x0, 'x', 14), 'pipeNickel', at((x0 + x1) / 2, y, z));
    for (const x of [x0, x1]) pb.add(lathe([[0, -1.2], [2.6, -1.2], [3, -0.6], [3, 0], [0, 0]], 14), 'nickel', xf({ p: [x, y, z], r: [0, x > x0 ? PI / 2 : -PI / 2, 0] }));
  }
}

/** A card fan: hub with sticker, blades, a thin rim ring. Spins on the card's y axis. */
function cardFan(pb: PartBuilder, labels: Labels, c: Card, x: number, z: number, r: number, blades: number, rim: MatName, sticker: string, tag: string): Rotor {
  const holder = pb.group(`card-fan:${tag}`, pb.root, xf({ p: [x, c.fanY + 6, z], r: [-PI / 2, 0, 0] }));
  pb.add(torus(r + 0.6, 1.0, 10, 96), c.frost ? rim : 'aluAnodized', xf({ p: [0, 0, -2.2] }), { to: holder });
  pb.add(lathe([[r + 0.2, -4.5], [r + 1.2, -4.5], [r + 1.2, 6], [r + 0.2, 6]], 72), c.frost ? 'plasticWhite' : 'plasticMatte', undefined, { to: holder });
  const rotor = pb.group(`card-rotor:${tag}`, holder);
  const bladeGroup = pb.group(`card-blades:${tag}`, rotor);
  const hub = Math.max(12, r * 0.3);
  const bg = bladeGeometry({ r0: hub - 0.4, r1: r - 1.4, c0: r * 0.26, c1: r * 0.52, pitch0: 0.78, pitch1: 0.38, sweep: 0.68, thick: 1.4, z: 0.5, nu: 32, nv: 16, tip: 0.3 });
  const bm = c.frost ? 'bladeWhite' : 'bladeBlack';
  for (let i = 0; i < blades; i++) pb.add(bg.clone(), bm, xf({ r: [0, 0, (i / blades) * PI * 2] }), { to: bladeGroup, uv: 'keep' });
  bg.dispose();
  const ring = bladeRing(r - 1.2, 0.9);
  pb.add(ring, bm, xf({ p: [0, 0, 2.6] }), { to: bladeGroup });
  pb.add(lathe([[0, -3.4], [hub - 2.5, -3.4], [hub, -2.2], [hub, 6.5], [0, 6.5]], 48), c.frost ? 'plasticWhite' : 'plasticMatte', undefined, { to: rotor });
  const cap = new THREE.Shape(); cap.absarc(0, 0, hub - 2.6, 0, PI * 2, false);
  pb.add(extrude(cap, 0.3, 0, 'xy', 40), c.frost ? 'plasticWhiteGloss' : 'sticker', at(0, 0, -3.7), { to: rotor });
  labels.text(sticker, BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, hub * 0.2, xf({ p: [0, 0, -3.75], r: [0, PI, 0] }), { color: c.frost ? '#6a6e78' : '#a9adb6', to: rotor });
  const disc = pb.mesh(new THREE.RingGeometry(hub, r - 1.2, 64, 1), pb.own(new THREE.MeshBasicMaterial({ map: pb.own(blurDiscTexture(blades, c.frost)), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })), at(0, 0, 0.5), { to: rotor });
  disc.visible = false; disc.userData.flexible = true;
  return { obj: rotor, axis: 'z', speed: 0.8, blades: bladeGroup, disc };
}

function bladeRing(r: number, w: number) {
  return lathe([[r - w, 0], [r, 0], [r, 1.2], [r - w, 1.2]], 72);
}

function socketList(c: Card) {
  const p = c.spec.plugs;
  return p.startsWith('12V') ? [{ w: 20.6, cols: 6, pitch: 3.0, name: 'power' }] : p.startsWith('2x') ? [{ w: 21.2, cols: 4, pitch: 4.2, name: 'power' }, { w: 21.2, cols: 4, pitch: 4.2, name: 'power2' }] : [{ w: 21.2, cols: 4, pitch: 4.2, name: 'power' }];
}

function powerSockets(pb: PartBuilder, labels: Labels, c: Card, x: number): Record<string, Anchor> {
  const anchors: Record<string, Anchor> = {};
  const z = c.H - 1.6;
  const list = socketList(c);
  list.forEach((p, i) => {
    const px = x + i * 25;
    pb.add(rbox(p.w, 10, 8, 0.6, 1), 'plasticDark', xf({ p: [px, -5.4, z - 4] }));
    for (let r = 0; r < 2; r++) for (let k = 0; k < p.cols; k++) pb.add(new THREE.BoxGeometry(p.pitch * 0.66, p.pitch * 0.66, 1), 'darkVoid', xf({ p: [px + (k - (p.cols - 1) / 2) * p.pitch, -5.4 + (r - 0.5) * p.pitch * 1.05, z + 0.05] }), { uv: 'keep' });
    if (p.cols === 6) for (let k = 0; k < 4; k++) pb.add(new THREE.BoxGeometry(1.2, 1.2, 1), 'darkVoid', xf({ p: [px + (k - 1.5) * 2.4, -10.4 + 0.2, z + 0.05] }), { uv: 'keep' });
    labels.text(c.spec.plugs.startsWith('12V') ? '12V-2x6' : '8 PIN', TINY_TYPE, 1.4, xf({ p: [px, -11.6, z + 0.12], r: [-PI / 2, 0, 0] }), { color: '#8c9098' });
    anchors[p.name] = { pos: [px, -5.4, z + 0.5], dir: [0, 0, 1] };
  });
  return anchors;
}

// ---- Veltrin --------------------------------------------------------------------------------

function veltrin(pb: PartBuilder, labels: Labels, c: Card): { zones: Zone[]; rotors: Rotor[]; anchors: Record<string, Anchor> } {
  const zones: Zone[] = []; const rotors: Rotor[] = [];
  const fin = PART_FINISHES[c.frost ? 'frost' : 'graphite'];
  const shell: MatName = c.frost ? 'plasticWhite' : 'plasticSatin';
  const trim: MatName = c.frost ? 'aluBrushed' : 'aluSatinDark';
  const ch = Math.min(26, c.H * 0.2);
  const outline: [number, number][] = [
    [c.back + 2, c.clear + 6], [c.back + 8, c.clear], [c.end - 34, c.clear], [c.end, c.clear + ch], [c.end, c.H - ch * 0.7], [c.end - ch * 0.9, c.H], [c.back + 12, c.H], [c.back + 2, c.H - 10],
  ];
  const plateT = 3.2;
  const plate = roundedPoly(outline, 1.2) as THREE.Shape;
  for (const fx of c.fanX) plate.holes.push(circleHole(fx, (c.clear + c.H) / 2, c.fanR + 1.6));
  pb.add(extrude(plate, plateT, 0.9, 'xy', 48, 2), shell, xzAt(c.fanY + plateT));
  const mid = (c.clear + c.H) / 2;
  for (const fx of c.fanX) {
    const bez = new THREE.Shape(); bez.absarc(0, 0, c.fanR + 6, 0, PI * 2, false);
    bez.holes.push(circleHole(0, 0, c.fanR + 1.6));
    pb.add(extrude(bez, 2.2, 0.8, 'xy', 72, 2), c.frost ? trim : 'aluAnodized', xzAt(c.fanY).multiply(new THREE.Matrix4().makeTranslation(fx, mid, 0)));
  }
  for (let i = 0; i < c.fanX.length - 1; i++) {
    const xm = (c.fanX[i]! + c.fanX[i + 1]!) / 2;
    const rib = roundedPoly([[xm - 4, c.clear + 4], [xm + 2, c.clear + 4], [xm + 7, c.H - 4], [xm + 1, c.H - 4]], 1);
    pb.add(extrude(rib, 2.4, 0.7, 'xy', 4, 2), trim, xzAt(c.fanY));
  }
  const accent = roundedPoly([[c.end - 30, c.clear + 3], [c.end - 3, c.clear + ch], [c.end - 3, c.H - ch * 0.75], [c.end - 12, c.H - 6], [c.end - 20, c.H - 6], [c.end - 20, c.clear + 10]], 1);
  pb.add(extrude(accent, 1.6, 0.5, 'xy', 4, 1), trim, xzAt(c.fanY - 0.2));
  const skirt = 8;
  const wallY0 = c.fanY + plateT; const wallY1 = -2;
  const sideH = wallY1 - wallY0;
  const glassSide = roundedPoly([[c.back + 12, 0], [c.end - ch * 0.9, 0], [c.end - ch * 0.9 + 2, sideH * 0.55], [c.end - ch * 0.9, sideH], [c.back + 12, sideH]], 1.2) as THREE.Shape;
  const win = [[c.back + 34, 3.2], [c.end - 46, 3.2], [c.end - 40, sideH * 0.42], [c.back + 28, sideH * 0.42]] as [number, number][];
  glassSide.holes.push(polyHole(win));
  const sockX = Math.min(c.pcbEnd - 26, c.back + c.L * 0.62);
  socketList(c).forEach((p, i) => glassSide.holes.push(rrectHole(p.w + 3, 9.4, 1.2, sockX + i * 25, sideH - 5.2)));
  const sideM = new THREE.Matrix4().makeTranslation(0, wallY0, c.H).multiply(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
  pb.add(extrude(glassSide, 2.6, 0.7, 'xy', 6, 2), shell, sideM.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -2.6)));
  const boardSide = roundedPoly([[c.back + 8, 0], [c.end - 34, 0], [c.end - 34, sideH], [c.back + 8, sideH]], 1.2) as THREE.Shape;
  boardSide.holes.push(polyHole([[c.back + 30, 3], [c.end - 50, 3], [c.end - 50, sideH * 0.5], [c.back + 30, sideH * 0.5]]));
  pb.add(extrude(boardSide, 2.4, 0.6, 'xy', 6, 2), shell, new THREE.Matrix4().makeTranslation(0, wallY0, c.clear));
  pb.add(rbox(3.2, sideH, c.H - c.clear - ch * 1.7 + 2, 1, 2), shell, xf({ p: [c.end - 1.6, (wallY0 + wallY1) / 2, (c.clear + ch + c.H - ch * 0.7) / 2] }));
  for (const [x0, z0, x1, z1] of [[c.end - ch * 0.9, c.H, c.end, c.H - ch * 0.7], [c.end - 34, c.clear, c.end, c.clear + ch], [c.back + 2, c.H - 10, c.back + 12, c.H]] as [number, number, number, number][]) {
    const len = Math.hypot(x1 - x0, z1 - z0); const th = Math.atan2(z1 - z0, x1 - x0);
    const mx = (x0 + x1) / 2; const mz = (z0 + z1) / 2;
    let nx = (z1 - z0) / len; let nz = -(x1 - x0) / len;
    if (nx * (mx - (c.back + c.end) / 2) + nz * (mz - mid) > 0) { nx = -nx; nz = -nz; }
    pb.add(rbox(len + 1.5, sideH, 2.6, 0.8, 2), shell, xf({ p: [mx + nx * 1.3, (wallY0 + wallY1) / 2, mz + nz * 1.3], r: [0, -th, 0] }));
  }
  void skirt;

  fins(pb, c, fin.fin, c.back + 10, c.end - 10, c.fanY + plateT + 1.5, -6.5, c.clear + 3, c.H - 5);
  // Through the middle of the stack: just under the fin tops they read as bars lying on the fins from above.
  heatpipes(pb, c, c.spec.fans >= 3 ? 5 : 4, -16, c.clear + 14, c.H - 18);
  c.fanX.forEach((fx, i) => rotors.push(cardFan(pb, labels, c, fx, mid, c.fanR, 11, trim, brandName(c.spec.brand).toUpperCase(), `${c.key}-${i}`)));
  {
    const shg = screwGeometry(1.7, 0.9, 'button');
    const shm = pb.own(new THREE.MeshPhysicalMaterial({ color: c.frost ? 0xd2d4d8 : 0x1c1d21, metalness: 1, roughness: 0.4, vertexColors: true }));
    for (const x of [c.back + 12, c.end - 40]) for (const z of [c.clear + 7, c.H - 9]) pb.add(shg.clone(), shm, xf({ p: [x, c.fanY - 0.05, z], r: [PI / 2, 0, 0] }), { uv: 'keep' });
    for (const x of [c.back + 26, c.end - ch - 18]) pb.add(shg.clone(), shm, xf({ p: [x, wallY0 + sideH * 0.3, c.H + 0.05] }), { uv: 'keep' });
    // The shroud is screwed down on both sides of the power socket's cutout, and the connector is named beside it.
    const sk = socketList(c); const skEnd = sockX + (sk.length - 1) * 25 + sk[0]!.w / 2;
    for (const x of [sockX - sk[0]!.w / 2 - 7, skEnd + 19]) pb.add(shg.clone(), shm, xf({ p: [x, wallY0 + sideH - 5.2, c.H + 0.05] }), { uv: 'keep' });
    labels.text(c.spec.plugs.startsWith('12V') ? '12V-2x6' : '8 PIN', TINY_TYPE, 1.5, xf({ p: [skEnd + 9.5, wallY0 + sideH - 5.2, c.H + 0.05] }), { color: c.frost ? '#6a6e78' : '#8c9098' });
    shg.dispose();
  }

  const bpY = 0.8 + 1.4; const bpT = 2.0;
  const bpo: [number, number][] = [[c.back + 2, c.clear + 2], [c.end - 30, c.clear + 2], [c.end, c.clear + ch], [c.end, c.H - ch * 0.7], [c.end - ch * 0.9, c.H], [c.back + 12, c.H], [c.back + 2, c.H - 10]];
  const bp = roundedPoly(bpo, 1.6) as THREE.Shape;
  const cutX0 = Math.max(c.pcbEnd + 4, c.end - 72);
  const flow = c.end - cutX0 > 24;
  if (flow) bp.holes.push(polyHole([[cutX0, c.clear + 18], [c.end - 16, c.clear + 18 + 10], [c.end - 16, c.H - 22], [cutX0 + 8, c.H - 22]]));
  const ventX0 = c.back + 120; const ventX1 = (flow ? cutX0 : c.end) - 12;
  for (let x = ventX0; x + 10 < ventX1; x += 13) bp.holes.push(polyHole([[x, c.H - 30], [x + 6, c.H - 30], [x + 14, c.H - 10], [x + 8, c.H - 10]]));
  pb.add(extrude(bp, bpT, 0.6, 'xy', 8, 2), c.frost ? 'aluBrushed' : 'aluBrushedPlate', xzAt(bpY + bpT));
  const sg = screwGeometry(1.9, 1.0, 'button');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: c.frost ? 0xd0d2d6 : 0x1d1e22, metalness: 1, roughness: 0.32, vertexColors: true }));
  const core: [number, number] = [c.back + 78, (c.clear + c.H) / 2 - 4];
  const armEnd = 18.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) pb.add(sg.clone(), sm, xf({ p: [core[0] + sx * armEnd, bpY + bpT + 1.2, core[1] + sz * armEnd], r: [-PI / 2, 0, 0] }), { uv: 'keep' });
  const pts: [number, number][] = [
    [c.back + 10, c.clear + 8], [c.back + 10, c.H - 8], [c.pcbEnd - 8, c.clear + 8], [c.pcbEnd - 8, c.H - 8], [(c.back + c.pcbEnd) / 2 + 40, c.clear + 8], [(c.back + c.pcbEnd) / 2 + 40, c.H - 8]];
  for (const [x, z] of pts) pb.add(sg.clone(), sm, xf({ p: [x, bpY + bpT, z], r: [-PI / 2, 0, 0] }), { uv: 'keep' });
  sg.dispose();
  const arm = 30.5; const half = 4.5; const k = Math.SQRT1_2;
  const plus: [number, number][] = [[-arm, -half], [-half, -half], [-half, -arm], [half, -arm], [half, -half], [arm, -half], [arm, half], [half, half], [half, arm], [-half, arm], [-half, half], [-arm, half]];
  const xb = roundedPoly(plus.map(([x, y]) => [k * (x - y), k * (x + y)] as [number, number]), 2.2);
  pb.add(extrude(xb, 1.2, 0.3, 'xy', 4, 1), c.frost ? 'powderWhite' : 'aluAnodized', xzAt(bpY + bpT + 1.2).multiply(new THREE.Matrix4().makeTranslation(core[0], core[1], 0)));
  const bpPrint = c.frost ? '#5e626b' : '#c0c4cc';
  // The backplate print reads the right way up through the side glass with the card installed, as real backplates do.
  labels.text(brandName(c.spec.brand), BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, 6.5, xf({ p: [c.back + 150, bpY + bpT + 0.06, c.clear + 12], r: [-PI / 2, 0, 0] }), { color: bpPrint, align: 'left' });
  labels.text(c.spec.name, MODEL_TYPE, 3.2, xf({ p: [c.back + 150, bpY + bpT + 0.06, c.clear + 22], r: [-PI / 2, 0, 0] }), { color: c.frost ? '#7d818a' : '#878b94', align: 'left' });

  const barZ = c.H + 0.1;
  const barX0 = c.back + 16; const barX1 = c.end - ch * 0.9 - 6;
  const zones2: Zone[] = [];
  const lit = c.spec.lightZones;
  if (lit >= 1) {
    const count = Math.round((barX1 - barX0) / 7) + 1;
    const zone = new Zone(`${c.key}:bar`, 'gpu', false, Array.from({ length: count }, (_, i) => new THREE.Vector3(barX0 + ((barX1 - barX0) * i) / (count - 1), wallY0 + sideH * 0.78, barZ)), 0.45);
    const bar = rbox(barX1 - barX0, 3.4, 2.4, 1.0, 3);
    uvAlong(bar, 'x');
    pb.mesh(bar, zone.diffuser(0.74, 0x1f2026, 0.35), xf({ p: [(barX0 + barX1) / 2, wallY0 + sideH * 0.78, barZ] }), { uv: 'keep' });
    pb.add(rbox(barX1 - barX0 + 4, 5.6, 1.2, 0.5, 2), trim, xf({ p: [(barX0 + barX1) / 2, wallY0 + sideH * 0.78, barZ - 1] }));
    const spill = zone.spill(c.frost ? 0.3 : 0.6);
    const by = wallY0 + sideH * 0.78; const bx = (barX0 + barX1) / 2;
    pb.mesh(spillStrip(barX1 - barX0, Math.max(2, by - 2.9 - (wallY0 + sideH * 0.56 + 5)), 16), spill, at(bx, by - 2.9, c.H + 0.07), { uv: 'keep' }).userData.spill = true;
    finLight(pb, zone, c.frost ? 0.12 : 0.22, c.back + 10, c.end - 10, barX0, barX1, wallY0 + 3, wallY0 + sideH * 0.42, c.H - 5);
    const upDepth = Math.max(1, Math.min(6, wallY1 - (by + 2.9) - 1.5));
    // Above the bar the light stops at the power socket recess, or its pin holes glow as if the bar ran through them.
    const sk0 = sockX - 14; const sk1 = sockX + (socketList(c).length - 1) * 25 + 14;
    for (const [a, b] of [[barX0, Math.min(barX1, sk0)], [Math.max(barX0, sk1), barX1]] as [number, number][]) {
      if (b - a > 1) pb.mesh(spillStripRange(barX1 - barX0, a - bx, b - bx, upDepth, 8), spill, xf({ p: [bx, by + 2.9, c.H + 0.07], r: [PI, 0, 0] }), { uv: 'keep' }).userData.spill = true;
    }
    zone.emit(new THREE.Vector3((barX0 + barX1) / 2, wallY0 + sideH * 0.78, barZ + 1), new THREE.Vector3(0, 0, 1), barX1 - barX0, 10, 1, new THREE.Vector3(1, 0, 0));
    zone.emit(new THREE.Vector3((barX0 + barX1) / 2, wallY0 + sideH * 0.78, barZ), new THREE.Vector3(0, 1, 0.3), barX1 - barX0, 10, 0.5, new THREE.Vector3(1, 0, 0));
    zones2.push(zone);
  }
  const wordX = c.back + 78; const wordV = 0.56;
  if (lit >= 2) {
    const word = new Zone(`${c.key}:word`, 'gpu', false, Array.from({ length: 11 }, (_, i) => new THREE.Vector3(wordX - 35 + i * 7, wallY0 + sideH * wordV, barZ)), 0.9);
    labels.text(brandName(c.spec.brand), BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, 6.2, xf({ p: [wordX, wallY0 + sideH * wordV, c.H + 0.05], r: [0, 0, 0] }), { lit: { tex: word.secondary(), intensity: 0.6 } });
    word.emit(new THREE.Vector3(wordX, wallY0 + sideH * wordV, c.H + 1), new THREE.Vector3(0, 0, 1), 60, 10, 0.6, new THREE.Vector3(1, 0, 0));
    zones2.push(word);
  } else {
    labels.text(brandName(c.spec.brand), BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, 5.2, xf({ p: [wordX, wallY0 + sideH * wordV, c.H + 0.05] }), { color: c.frost ? '#5f636c' : '#b9bdc5' });
  }
  if (lit >= 3) {
    const rc = new THREE.Vector3(core[0] + 70, bpY + bpT + 0.6, (c.clear + c.H) / 2);
    const ring = new Zone(`${c.key}:ring`, 'gpu', true, Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * PI * 2; return new THREE.Vector3(rc.x + Math.cos(a) * 22, rc.y, rc.z + Math.sin(a) * 22); }), 0.2);
    const tg = torus(22, 1.3, 8, 80);
    pb.mesh(tg, ring.diffuser(0.8, 0x1f2026, 0.35), xf({ p: [rc.x, rc.y, rc.z], r: [PI / 2, 0, 0] }), { uv: 'keep' });
    pb.add(torus(24.6, 1.0, 8, 80), trim, xf({ p: [rc.x, rc.y - 0.2, rc.z], r: [PI / 2, 0, 0] }));
    ring.emit(rc.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 1, 0), 50, 50, 0.7, new THREE.Vector3(1, 0, 0));
    zones2.push(ring);
  }
  zones.push(...zones2);
  labels.text(`${c.spec.name.toUpperCase()}`, MODEL_TYPE, 2.4, xf({ p: [c.end - ch - 12, wallY0 + sideH * wordV, c.H + 0.05] }), { color: c.frost ? '#7a7e87' : '#7d818a', align: 'right' });
  const anchors = powerSockets(pb, labels, c, sockX);
  return { zones, rotors, anchors };
}

// ---- Dravik (Phase 3) uses the same pieces ---------------------------------------------------

export function gpuPart(id: string, opts: GenOpts = {}): PartObject {
  const spec = getGpu(id);
  if (!spec) throw new Error(`unknown card ${id}`);
  const key = opts.key ?? `gpu:${id}`;
  const c = cardDims(spec, key);
  const pb = new PartBuilder(`gpu-${id}`);
  const labels = new Labels(pb, 36);
  pcb(pb, labels, c);
  const screws = bracket(pb, labels, c, spec.brand === 'dravik' ? 'grid' : 'slant');
  const built = veltrin(pb, labels, c);
  labels.finish();
  const done = pb.finish();
  return {
    root: done.root, boxes: gpuBoxes(id), anchors: built.anchors, zones: built.zones, rotors: built.rotors, movers: { 'bracket-screws': screws },
    dispose: () => { done.dispose(); for (const z of built.zones) z.dispose(); },
  };
}

/** The post that holds up the far end of the longest card. */
export function supportPart(id: string, opts: GenOpts = {}): PartObject {
  void opts;
  const pb = new PartBuilder(`support-${id}`);
  pb.add(cyl(6, 6, 'y', 32), 'aluBlack', at(0, 3, 0));
  pb.add(cyl(3.2, 60, 'y', 24), 'aluSatinDark', at(0, 36, 0));
  const done = pb.finish();
  return { root: done.root, boxes: [], anchors: {}, zones: [], rotors: [], movers: {}, dispose: done.dispose };
}
