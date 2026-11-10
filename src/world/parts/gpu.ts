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
import { spillStrip, spillStripRange, Zone } from '../light/zones';
import type { Anchor, GenOpts, PartObject, Rotor } from './types';

const PI = Math.PI;
/** Spacing of side by side power sockets: their cutouts keep a solid web between them. */
const SOCKET_PITCH = 30;
// Cyan and lime went pale toward white on the bar end nearest the close camera at 0.52.
const CARD_BAR_GLOW = 0.44;
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
  for (const [pz, py, pw, ph] of ports) s.holes.push(rrectHole(pw + 1.6, ph + 1.6, 1.2, pz, py));
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
  const g = extrude(s, DIMS.bracketT, 0.3, 'xy', 6, 2);
  // Black on Veltrin cards; bare zinc on Dravik, whose industrial slabs show their steel, and whose black bracket melted into
  // the backdrop.
  const plate: MatName = style === 'slant' ? 'powderBlack' : 'steelZinc';
  pb.add(g, plate, new THREE.Matrix4().makeTranslation(x + DIMS.bracketT, 0, 0).multiply(new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)));
  pb.add(rbox(10, hy - 2, 1, 0.3, 1), plate, xf({ p: [x - 5, (y0 + y1) / 2, 111.6] }));
  for (const [pz, py, pw, ph] of ports) {
    // The plated shells pass through the bracket and stand flush with its face, so each port reads as a bright frame.
    pb.add(rbox(14, ph + 1.2, pw + 1.2, 0.5, 1), 'nickel', xf({ p: [x + 6.7, py, pz] }));
    pb.add(new THREE.BoxGeometry(12, ph - 1.4, pw - 2), 'darkVoid', xf({ p: [x + 7.4, py, pz] }), { uv: 'keep' });
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
/** fade: the light falls off from yb to ya instead of lying even over the fin tips. */
function finLight(pb: PartBuilder, zone: Zone, gain: number, fx0: number, fx1: number, bx0: number, bx1: number, ya: number, yb: number, zt: number, pitch = 1.9, skip: [number, number] | null = null, fade = false) {
  const pos: number[] = []; const uv: number[] = []; const col: number[] = [];
  const quad = (p: [number, number, number][], u: number, k: [number, number, number, number]) => {
    const v = [0, 0, 1, 1];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]!); uv.push(u, v[i]!); col.push(k[i]!, k[i]!, k[i]!); }
  };
  const n = Math.max(2, Math.floor((fx1 - fx0) / pitch));
  const half = FIN_T / 2;
  for (let i = 0; i < n; i++) {
    const x = fx0 + i * pitch;
    if (x < bx0 || x > bx1 || (skip && x > skip[0] && x < skip[1])) continue;
    const u = (x - bx0) / (bx1 - bx0);
    quad([[x - half, yb, zt + 0.02], [x + half, yb, zt + 0.02], [x + half, ya, zt + 0.02], [x - half, ya, zt + 0.02]], u, fade ? [1, 1, 0, 0] : [1, 1, 1, 1]);
    for (const s of [-1, 1]) { const xs = x + s * (half + 0.01); quad([[xs, yb, zt], [xs, yb, zt - 3], [xs, ya, zt - 3], [xs, ya, zt]], u, fade ? [1, 0, 0, 0] : [1, 0, 0, 1]); }
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
  pb.add(torus(r + 0.6, 1.0, 12, 192), c.frost ? rim : 'aluAnodized', xf({ p: [0, 0, -2.2] }), { to: holder });
  // The duct ring is satin molded: the stock matte grain, box mapped round a ring, broke into blotches up close.
  pb.add(lathe([[r + 0.2, -4.5], [r + 1.2, -4.5], [r + 1.2, 6], [r + 0.2, 6]], 192), c.frost ? 'plasticWhite' : 'plasticSatin', undefined, { to: holder });
  const rotor = pb.group(`card-rotor:${tag}`, holder);
  const bladeGroup = pb.group(`card-blades:${tag}`, rotor);
  const hub = Math.max(12, r * 0.3);
  // Dravik rotors are blunt: fewer, broader, nearly straight blades with no outer ring and a machined hub cap.
  const slab = c.spec.brand === 'dravik';
  const bg = slab
    ? bladeGeometry({ r0: hub - 0.4, r1: r - 1.4, c0: r * 0.42, c1: r * 0.7, pitch0: 0.7, pitch1: 0.42, sweep: 0.18, thick: 1.6, z: 0.5, nu: 32, nv: 16, tip: 0.1 })
    : bladeGeometry({ r0: hub - 0.4, r1: r - 1.4, c0: r * 0.26, c1: r * 0.52, pitch0: 0.78, pitch1: 0.38, sweep: 0.68, thick: 1.4, z: 0.5, nu: 32, nv: 16, tip: 0.3 });
  const bm = c.frost ? 'bladeWhite' : 'bladeBlack';
  for (let i = 0; i < blades; i++) pb.add(bg.clone(), bm, xf({ r: [0, 0, (i / blades) * PI * 2] }), { to: bladeGroup, uv: 'keep' });
  bg.dispose();
  if (!slab) { const ring = bladeRing(r - 1.2, 0.9); pb.add(ring, bm, xf({ p: [0, 0, 2.6] }), { to: bladeGroup }); }
  pb.add(lathe([[0, -3.4], [hub - 2.5, -3.4], [hub, -2.2], [hub, 6.5], [0, 6.5]], 48), c.frost ? 'plasticWhite' : 'plasticMatte', undefined, { to: rotor });
  const cap = new THREE.Shape(); cap.absarc(0, 0, hub - 2.6, 0, PI * 2, false);
  pb.add(extrude(cap, 0.3, 0, 'xy', 40), slab ? (c.frost ? 'aluWhite' : 'aluBrushedDark') : c.frost ? 'plasticWhiteGloss' : 'sticker', at(0, 0, -3.7), { to: rotor });
  labels.text(sticker, BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, hub * 0.2, xf({ p: [0, 0, -3.75], r: [0, PI, 0] }), { color: c.frost ? '#6a6e78' : slab ? '#d4d7dd' : '#a9adb6', to: rotor });
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
    const px = x + i * SOCKET_PITCH;
    pb.add(rbox(p.w, 10, 8, 0.6, 1), 'plasticDark', xf({ p: [px, -8.2, z - 4] }));
    // The housing is soldered to a small riser board that runs down to the main board's edge.
    const rz0 = Math.min(c.pcbTop, z - 8) - 4; const rz1 = z - 8;
    pb.add(rbox(p.w + 3, 1.6, rz1 - rz0 + 0.2, 0.3, 1), c.frost ? 'pcbWhite' : 'pcbBlack', xf({ p: [px, -3.4, (rz0 + rz1) / 2] }));
    for (let k = 0; k < p.cols; k++) pb.add(rbox(0.9, 0.6, 1.2, 0.2, 1), 'solder', xf({ p: [px + (k - (p.cols - 1) / 2) * p.pitch, -2.3, rz1 - 1.4] }));
    for (let r = 0; r < 2; r++) for (let k = 0; k < p.cols; k++) pb.add(new THREE.BoxGeometry(p.pitch * 0.74, p.pitch * 0.74, 1), 'darkVoid', xf({ p: [px + (k - (p.cols - 1) / 2) * p.pitch, (p.cols === 6 ? -7.4 : -8.2) + (r - 0.5) * p.pitch * 1.05, z - 0.48] }), { uv: 'keep' });
    // A tinned terminal in every cavity, seen as a bright slit in the dark, and the latch ramp on the housing's long side.
    for (let r = 0; r < 2; r++) for (let k = 0; k < p.cols; k++) for (const sx of [-1, 1]) pb.add(new THREE.BoxGeometry(p.pitch * 0.07, p.pitch * 0.3, 0.06), 'steelBare', xf({ p: [px + (k - (p.cols - 1) / 2) * p.pitch + sx * p.pitch * 0.22, (p.cols === 6 ? -7.4 : -8.2) + (r - 0.5) * p.pitch * 1.05, z + 0.05] }));
    pb.add(rbox(Math.min(5, p.w * 0.3), 1.4, 2.2, 0.4, 2), 'plasticDark', xf({ p: [px, -8.2 - 5.6, z - 1.2] }));
    pb.add(rbox(Math.min(5, p.w * 0.3) - 1.2, 0.5, 0.8, 0.2, 1), 'darkVoid', xf({ p: [px, -8.2 - 6.1, z - 0.5] }));
    if (p.cols === 6) for (let k = 0; k < 4; k++) pb.add(new THREE.BoxGeometry(1.2, 1.2, 1), 'darkVoid', xf({ p: [px + (k - 1.5) * 2.4, -11.4, z + 0.05] }), { uv: 'keep' });
    labels.text(c.spec.plugs.startsWith('12V') ? '12V-2x6' : '8 PIN', TINY_TYPE, 1.4, xf({ p: [px, -14.6, z + 0.12], r: [-PI / 2, 0, 0] }), { color: '#8c9098' });
    anchors[p.name] = { pos: [px, -8.2, z + 0.5], dir: [0, 0, 1] };
  });
  return anchors;
}

// ---- Veltrin --------------------------------------------------------------------------------

function veltrin(pb: PartBuilder, labels: Labels, c: Card): { zones: Zone[]; rotors: Rotor[]; anchors: Record<string, Anchor> } {
  const zones: Zone[] = []; const rotors: Rotor[] = [];
  const fin = PART_FINISHES[c.frost ? 'frost' : 'graphite'];
  const shell: MatName = c.frost ? 'plasticWhite' : 'plasticSatin';
  const trim: MatName = c.frost ? 'aluBrushed' : 'aluSatinDark';
  // The flagship's end is cut back far deeper, so its outline is its own and not a longer Apex 3X.
  const ch = c.spec.lightZones >= 3 ? Math.min(46, c.H * 0.34) : Math.min(26, c.H * 0.2);
  const outline: [number, number][] = [
    [c.back + 2, c.clear + 6], [c.back + 8, c.clear], [c.end - 34, c.clear], [c.end, c.clear + ch], [c.end, c.H - ch * 0.7], [c.end - ch * 0.9, c.H], [c.back + 12, c.H], [c.back + 2, c.H - 10],
  ];
  const plateT = 3.2;
  const plate = roundedPoly(outline, 1.2) as THREE.Shape;
  for (const fx of c.fanX) plate.holes.push(circleHole(fx, (c.clear + c.H) / 2, c.fanR + 1.6));
  pb.add(extrude(plate, plateT, 0.9, 'xy', 160, 2), shell, xzAt(c.fanY + plateT));
  const mid = (c.clear + c.H) / 2;
  for (const fx of c.fanX) {
    const bez = new THREE.Shape(); bez.absarc(0, 0, c.fanR + 6, 0, PI * 2, false);
    bez.holes.push(circleHole(0, 0, c.fanR + 1.6));
    pb.add(extrude(bez, 2.2, 0.8, 'xy', 160, 2), c.frost ? trim : 'aluAnodized', xzAt(c.fanY).multiply(new THREE.Matrix4().makeTranslation(fx, mid, 0)));
  }
  for (let i = 0; i < c.fanX.length - 1; i++) {
    const xm = (c.fanX[i]! + c.fanX[i + 1]!) / 2;
    const rib = roundedPoly([[xm - 4, c.clear + 4], [xm + 2, c.clear + 4], [xm + 7, c.H - 4], [xm + 1, c.H - 4]], 1);
    pb.add(extrude(rib, 2.4, 0.7, 'xy', 4, 2), trim, xzAt(c.fanY));
  }
  if (c.spec.lightZones >= 3) {
    // The flagship's fans sit in one brushed frame plate that follows the shroud's chamfered outline, with a raised lip
    // round each fan, and a brushed rail runs the length of its glass facing edge.
    const m0 = c.fanX[0]! - c.fanR - 9.5; const m1 = c.fanX[c.fanX.length - 1]! + c.fanR + 9.5; const r0 = mid - c.fanR - 9.5; const r1 = mid + c.fanR + 9.5;
    // Holes just outside each fan bezel, so neighbouring holes keep a web between them.
    const hr = Math.min(c.fanR + 6.4, (c.fanX.length > 1 ? (c.fanX[1]! - c.fanX[0]!) / 2 : 99) - 2.5);
    // Pointed notches between the fans on both long edges give the flagship its own crowned outline; each stops short of
    // the fan holes beside it.
    const gaps = c.fanX.slice(1).map((fx, i) => (fx + c.fanX[i]!) / 2);
    const depth = 9;
    const lower: [number, number][] = gaps.flatMap((g) => [[g - 10, r0], [g, r0 + depth], [g + 10, r0]] as [number, number][]);
    const upper: [number, number][] = [...gaps].reverse().flatMap((g) => [[g + 10, r1], [g, r1 - depth], [g - 10, r1]] as [number, number][]);
    // Its far end follows the shroud's end chamfers 3 mm inside them, so the armor never shows past the shroud.
    const ea = c.end - 34 - 3; const eb = c.end - ch * 0.9 - 3;
    const farEnd: [number, number][] = m1 > Math.min(ea, eb)
      ? [[ea, r0], [c.end - 3, c.clear + ch - 2], [c.end - 3, c.H - ch * 0.7 + 2], [eb, r1]]
      : [[m1 - 10, r0], [m1, r0 + 10], [m1, r1 - 10], [m1 - 10, r1]];
    const fr = roundedPoly([[m0, r0], ...lower, ...farEnd, ...upper, [m0, r1]], 2) as THREE.Shape;
    for (const fx of c.fanX) fr.holes.push(circleHole(fx, mid, hr));
    // Brushed silver armor round the fans: in the shroud's black, and in dark gunmetal, it read as the Apex 3X.
    const armor: MatName = c.frost ? trim : 'aluBrushed'; const lip: MatName = c.frost ? trim : 'aluBrushed';
    pb.add(extrude(fr, 1.2, 0.4, 'xy', 72, 1), armor, xzAt(c.fanY - 0.1));
    for (const fx of c.fanX) pb.add(torus(hr + 0.8, 0.8, 8, 96), lip, xzAt(c.fanY - 0.6).multiply(new THREE.Matrix4().makeTranslation(fx, mid, 0)));
  }
  // The end accent follows both end chamfers 3 mm inside them, whatever their depth; a fixed top corner stood out past the
  // flagship's deeper chamfer.
  const accent = roundedPoly([[c.end - 30, c.clear + 3], [c.end - 3, c.clear + ch], [c.end - 3, c.H - ch * 0.7 - 1], [c.end - ch * 0.9 + 2, c.H - 4], [c.end - ch * 0.9 - 6, c.H - 4], [c.end - 20, c.H - ch * 0.7 - 6], [c.end - 20, c.clear + 10]], 1);
  pb.add(extrude(accent, 1.6, 0.5, 'xy', 4, 1), trim, xzAt(c.fanY - 0.2));
  const skirt = 8;
  const wallY0 = c.fanY + plateT; const wallY1 = -2;
  const sideH = wallY1 - wallY0;
  const glassSide = roundedPoly([[c.back + 12, 0], [c.end - ch * 0.9, 0], [c.end - ch * 0.9 + 2, sideH * 0.55], [c.end - ch * 0.9, sideH], [c.back + 12, sideH]], 1.2) as THREE.Shape;
  const win = [[c.back + 34, 3.2], [c.end - 46, 3.2], [c.end - 40, sideH * 0.42], [c.back + 28, sideH * 0.42]] as [number, number][];
  glassSide.holes.push(polyHole(win));
  const sockX = Math.min(c.pcbEnd - 26, c.back + c.L * 0.62);
  socketList(c).forEach((p, i) => glassSide.holes.push(rrectHole(p.w + 3, 8.6, 1.2, sockX + i * SOCKET_PITCH, sideH - 6.2)));
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

  // The stack stops short of the chamfered end cap, which it poked through.
  fins(pb, c, fin.fin, c.back + 10, c.end - ch - 2, c.fanY + plateT + 1.5, -6.5, c.clear + 3, c.H - 5);
  // Through the middle of the stack: just under the fin tops they read as bars lying on the fins from above.
  heatpipes(pb, c, c.spec.fans >= 3 ? 5 : 4, -16, c.clear + 14, c.H - 18);
  c.fanX.forEach((fx, i) => rotors.push(cardFan(pb, labels, c, fx, mid, c.fanR, 11, trim, brandName(c.spec.brand).toUpperCase(), `${c.key}-${i}`)));
  {
    const shg = screwGeometry(1.7, 0.9, 'button');
    const shm = pb.own(new THREE.MeshPhysicalMaterial({ color: c.frost ? 0xd2d4d8 : 0x1c1d21, metalness: 1, roughness: 0.4, vertexColors: true }));
    for (const x of [c.back + 12, c.end - 40]) for (const z of [c.clear + 7, c.H - 9]) pb.add(shg.clone(), shm, xf({ p: [x, c.fanY - 0.05, z], r: [PI / 2, 0, 0] }), { uv: 'keep' });
    // The far screw stands on solid shroud between the window's end and the chamfer.
    for (const x of [c.back + 26, Math.max(c.end - ch - 18, c.end - 34)]) pb.add(shg.clone(), shm, xf({ p: [x, wallY0 + sideH * 0.3, c.H + 0.05] }), { uv: 'keep' });
    // The shroud is screwed down on both sides of the power socket's cutout, and the connector is named beside it.
    const sk = socketList(c); const skEnd = sockX + (sk.length - 1) * SOCKET_PITCH + sk[0]!.w / 2;
    for (const x of [sockX - sk[0]!.w / 2 - 7, skEnd + 19]) pb.add(shg.clone(), shm, xf({ p: [x, wallY0 + sideH - 6.2, c.H + 0.05] }), { uv: 'keep' });
    labels.text(c.spec.plugs.startsWith('12V') ? '12V-2x6' : '8 PIN', TINY_TYPE, 1.5, xf({ p: [skEnd + 9.5, wallY0 + sideH - 6.2, c.H + 0.05] }), { color: c.frost ? '#6a6e78' : '#8c9098' });
    shg.dispose();
  }

  const bpY = 0.8 + 1.4; const bpT = 2.0;
  const bpo: [number, number][] = [[c.back + 2, c.clear + 2], [c.end - 30, c.clear + 2], [c.end, c.clear + ch], [c.end, c.H - ch * 0.7], [c.end - ch * 0.9, c.H], [c.back + 12, c.H], [c.back + 2, c.H - 10]];
  const bp = roundedPoly(bpo, 1.6) as THREE.Shape;
  const cutX0 = Math.max(c.pcbEnd + 4, c.end - 72);
  const plainBp = c.spec.lightZones === 0;
  const flow = !plainBp && c.end - cutX0 > 24;
  if (flow) bp.holes.push(polyHole([[cutX0, c.clear + 18], [c.end - 16, c.clear + 18 + 10], [c.end - 16, c.H - 22], [cutX0 + 8, c.H - 22]]));
  const ventX0 = c.back + 120; const ventX1 = (flow ? cutX0 : c.end) - 12;
  if (!plainBp) for (let x = ventX0; x + 10 < ventX1; x += 13) bp.holes.push(polyHole([[x, c.H - 30], [x + 6, c.H - 30], [x + 14, c.H - 10], [x + 8, c.H - 10]]));
  pb.add(extrude(bp, bpT, 0.6, 'xy', 8, 2), c.frost ? 'aluBrushed' : 'aluBrushedPlate', xzAt(bpY + bpT));
  // Behind the GPU the board's back is packed with ceramic capacitors in rows, which is why the plate is vented there; seen
  // through the vents their tin ends catch light and the vents read as openings, not lines drawn on the plate.
  {
    const rr = seededFor(`mlcc-${c.key}`);
    // Matte tin: bright plated ends caught the key light through the vents as a row of white specks.
    const tinEnd = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x6f7277, metalness: 1, roughness: 0.62 }));
    const zTop = Math.min(c.H - 9, c.pcbTop - 1.5);
    for (let x = ventX0 - 2; x < Math.min(ventX1 + 6, c.pcbEnd - 3); x += 3.6) for (let z = c.H - 31; z < zTop; z += 3.0) {
      if (rr() < 0.25) continue;
      const big = rr() < 0.35; const lx = big ? 2.0 : 1.6; const lw = big ? 1.25 : 0.8;
      const p = [x + (rr() - 0.5) * 0.3, 0.8 + lw / 2, z];
      pb.add(rbox(lx * 0.62, lw, lw, 0.08, 1), rr() > 0.3 ? 'ceramic' : 'chip', xf({ p: [p[0]!, p[1]!, p[2]!] }));
      for (const s of [-1, 1]) pb.add(rbox(lx * 0.2, lw + 0.02, lw + 0.02, 0.06, 1), tinEnd, xf({ p: [p[0]! + s * lx * 0.41, p[1]!, p[2]!] }));
    }
  }
  const sg = screwGeometry(1.9, 1.0, 'button');
  // Zinc plated backplate screws: black ones vanished into the dark plate, so the plate read as unfastened.
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: c.frost ? 0xd0d2d6 : 0x8a8d94, metalness: 1, roughness: 0.34, vertexColors: true }));
  const core: [number, number] = [c.back + 78, (c.clear + c.H) / 2 - 4];
  const armEnd = 18.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) pb.add(sg.clone(), sm, xf({ p: [core[0] + sx * armEnd, bpY + bpT + 1.2, core[1] + sz * armEnd], r: [-PI / 2, 0, 0] }), { uv: 'keep' });
  // The print sits at the bracket end, below the brace: further along, the memory overhangs the plate and seen from above
  // its sticks crossed the wordmark.
  const shortBp = c.L < 200; const printX = shortBp ? c.back + 30 : c.back + 10;
  // The middle screws step clear of the print block: on the Crest one sat over the E of the wordmark like an accent.
  let midX = (c.back + c.pcbEnd) / 2 + 40;
  if (midX > printX - 8 && midX < printX + 80) midX = printX + 84;
  const pts: [number, number][] = [
    [c.back + 10, c.clear + 8], [c.back + 10, c.H - 8], [c.pcbEnd - 8, c.clear + 8], [c.pcbEnd - 8, c.H - 8], [midX, c.clear + 8], [midX, c.H - 8]];
  for (const [x, z] of pts) pb.add(sg.clone(), sm, xf({ p: [x, bpY + bpT, z], r: [-PI / 2, 0, 0] }), { uv: 'keep' });
  sg.dispose();
  const arm = 30.5; const half = 4.5; const k = Math.SQRT1_2;
  const plus: [number, number][] = [[-arm, -half], [-half, -half], [-half, -arm], [half, -arm], [half, -half], [arm, -half], [arm, half], [half, half], [half, arm], [-half, arm], [-half, half], [-arm, half]];
  const xb = roundedPoly(plus.map(([x, y]) => [k * (x - y), k * (x + y)] as [number, number]), 2.2);
  pb.add(extrude(xb, 1.2, 0.3, 'xy', 4, 1), c.frost ? 'powderWhite' : 'aluAnodized', xzAt(bpY + bpT + 1.2).multiply(new THREE.Matrix4().makeTranslation(core[0], core[1], 0)));
  const bpPrint = c.frost ? '#5e626b' : '#c0c4cc';
  // The backplate print reads the right way up through the side glass with the card installed, as real backplates do.
  // A short plate has no room past its X brace, so its print sits below the brace.
  labels.text(brandName(c.spec.brand), BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, shortBp ? 6.5 : 4.3, xf({ p: [printX, bpY + bpT + 0.06, shortBp ? c.clear + 13 : c.H - 27], r: [-PI / 2, 0, 0] }), { color: bpPrint, align: 'left' });
  labels.text(c.spec.name, MODEL_TYPE, shortBp ? 3.2 : 2.8, xf({ p: [printX, bpY + bpT + 0.06, shortBp ? c.clear + 21.5 : c.H - 20], r: [-PI / 2, 0, 0] }), { color: c.frost ? '#7d818a' : '#878b94', align: 'left' });

  const barZ = c.H + 0.1;
  const barX0 = c.back + 16; const barX1 = c.end - ch * 0.9 - 6;
  const zones2: Zone[] = [];
  const lit = c.spec.lightZones;
  if (lit >= 1) {
    const count = Math.round((barX1 - barX0) / 7) + 1;
    const zone = new Zone(`${c.key}:bar`, 'gpu', false, Array.from({ length: count }, (_, i) => new THREE.Vector3(barX0 + ((barX1 - barX0) * i) / (count - 1), wallY0 + sideH * 0.78, barZ)), 0.45);
    // The bar stops short of the power socket on both sides: the socket's housing is set into the same edge.
    const skA = sockX - socketList(c)[0]!.w / 2 - 12; const skB = sockX + (socketList(c).length - 1) * SOCKET_PITCH + socketList(c)[0]!.w / 2 + 25;
    for (const [a, b] of [[barX0, Math.min(barX1, skA)], [Math.max(barX0, skB), barX1]] as [number, number][]) {
      if (b - a < 6) continue;
      const seg = rbox(b - a, 3.4, 2.4, 1.0, 3);
      const sp = seg.getAttribute('position'); const su = seg.getAttribute('uv');
      for (let i = 0; i < sp.count; i++) su.setXY(i, ((sp.getX(i) + (a + b) / 2) - barX0) / (barX1 - barX0), 0.5);
      pb.mesh(seg, zone.diffuser(CARD_BAR_GLOW, 0x1a1b20, 0.86), xf({ p: [(a + b) / 2, wallY0 + sideH * 0.78, barZ] }), { uv: 'keep' });
      if (c.spec.lightZones >= 3) {
        // The flagship's bar is doubled: a slimmer second line runs just below the first.
        const s2 = rbox(b - a, 1.4, 1.8, 0.6, 2);
        const p2 = s2.getAttribute('position'); const u2 = s2.getAttribute('uv');
        for (let i = 0; i < p2.count; i++) u2.setXY(i, ((p2.getX(i) + (a + b) / 2) - barX0) / (barX1 - barX0), 0.5);
        pb.mesh(s2, zone.diffuser(CARD_BAR_GLOW, 0x1a1b20, 0.86), xf({ p: [(a + b) / 2, wallY0 + sideH * 0.78 - 5.4, barZ] }), { uv: 'keep' });
        pb.add(rbox(b - a + 3, 3.0, 1.2, 0.5, 2), trim, xf({ p: [(a + b) / 2, wallY0 + sideH * 0.78 - 5.4, barZ - 1] }));
      }
      pb.add(rbox(b - a + 4, 5.6, 1.2, 0.5, 2), trim, xf({ p: [(a + b) / 2, wallY0 + sideH * 0.78, barZ - 1] }));
    }
    const spill = zone.spill(c.frost ? 0.3 : 0.6);
    const by = wallY0 + sideH * 0.78; const bx = (barX0 + barX1) / 2;
    pb.mesh(spillStrip(barX1 - barX0, Math.max(2, by - 2.9 - (wallY0 + sideH * 0.56 + 5)), 16), spill, at(bx, by - 2.9, c.H + 0.07), { uv: 'keep' }).userData.spill = true;
    finLight(pb, zone, c.frost ? 0.18 : 0.38, c.back + 10, c.end - 10, barX0, barX1, wallY0 + 3, wallY0 + sideH * 0.42, c.H - 5);
    const upDepth = Math.max(1, Math.min(6, wallY1 - (by + 2.9) - 1.5));
    // Above the bar the light stops at the power socket recess, or its pin holes glow as if the bar ran through them.
    // Past the socket the strip starts after its label and screw, which sit on that edge.
    const sk0 = sockX - 14; const sk1 = sockX + (socketList(c).length - 1) * SOCKET_PITCH + socketList(c)[0]!.w / 2 + 25;
    for (const [a, b] of [[barX0, Math.min(barX1, sk0)], [Math.max(barX0, sk1), barX1]] as [number, number][]) {
      if (b - a > 1) pb.mesh(spillStripRange(barX1 - barX0, a - bx, b - bx, upDepth, 8), spill, xf({ p: [bx, by + 2.9, c.H + 0.07], r: [PI, 0, 0] }), { uv: 'keep' }).userData.spill = true;
    }
    zone.emit(new THREE.Vector3((barX0 + barX1) / 2, wallY0 + sideH * 0.78, barZ + 1), new THREE.Vector3(0, 0, 1), barX1 - barX0, 10, 1, new THREE.Vector3(1, 0, 0));
    zone.emit(new THREE.Vector3((barX0 + barX1) / 2, wallY0 + sideH * 0.78, barZ), new THREE.Vector3(0, 1, 0.3), barX1 - barX0, 10, 0.5, new THREE.Vector3(1, 0, 0));
    zones2.push(zone);
  }
  if (c.spec.lightZones >= 3) {
    const ry = wallY0 + sideH * 0.94; const sk = socketList(c);
    const ra = sockX - sk[0]!.w / 2 - 14; const rb = sockX + (sk.length - 1) * SOCKET_PITCH + sk[0]!.w / 2 + 28;
    for (const [a, b] of [[c.back + 16, ra], [rb, c.end - ch * 0.9 - 6]] as [number, number][]) if (b - a > 8) pb.add(rbox(b - a, 2.2, 1.0, 0.4, 2), trim, at((a + b) / 2, ry, c.H + 0.3));
  }
  const wordX = Math.min(c.back + 78, sockX - socketList(c)[0]!.w / 2 - 34); const wordV = 0.56;
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

// ---- Dravik ---------------------------------------------------------------------------------

/**
 * Dravik: a slab. Flat faces meeting at hard right angles (small radii only), the fin stack left exposed through a long window
 * in the glass facing side, a block wordmark, and light only as thin seams cut into the shell.
 */
function dravik(pb: PartBuilder, labels: Labels, c: Card): { zones: Zone[]; rotors: Rotor[]; anchors: Record<string, Anchor> } {
  const zones: Zone[] = []; const rotors: Rotor[] = [];
  const fin = PART_FINISHES[c.frost ? 'frost' : 'graphite'];
  const industrial = c.spec.lightZones === 0;
  const shell: MatName = c.frost ? 'paintWhiteCard' : industrial ? 'aluBeadGunmetal' : 'paintBlackCard';
  const edge: MatName = c.frost ? 'aluWhite' : 'aluSatinDark';
  const x0 = c.back + 2; const x1 = c.end;
  const plateT = 3.0;
  // Fan face: one flat plate with round openings, square outer corners.
  const face = roundedPoly([[x0, c.clear], [x1, c.clear], [x1, c.H], [x0, c.H]], 0.8) as THREE.Shape;
  const mid = (c.clear + c.H) / 2;
  for (const fx of c.fanX) face.holes.push(circleHole(fx, mid, c.fanR + 1.6));
  pb.add(extrude(face, plateT, 0.5, 'xy', 64, 1), shell, xzAt(c.fanY + plateT));
  // A square bezel round each fan, with corner screws: the slab's grid language.
  const shg = screwGeometry(1.8, 1.0, industrial ? 'hex' : 'button');
  const shm = pb.own(new THREE.MeshPhysicalMaterial({ color: c.frost ? 0xd2d4d8 : industrial ? 0x9a9da3 : 0x26272b, metalness: 1, roughness: 0.4, vertexColors: true }));
  // One square bezel frame round all the fans, with screws at its corners and between fans, top and bottom.
  const sq = c.fanR + 5;
  const bx0 = c.fanX[0]! - sq; const bx1 = c.fanX[c.fanX.length - 1]! + sq;
  const frame = roundedPoly([[bx0, -sq], [bx1, -sq], [bx1, sq], [bx0, sq]], 1.0) as THREE.Shape;
  for (const fx of c.fanX) frame.holes.push(circleHole(fx, 0, c.fanR + 1.6));
  pb.add(extrude(frame, 1.6, 0.4, 'xy', 64, 1), edge, xzAt(c.fanY).multiply(new THREE.Matrix4().makeTranslation(0, mid, 0)));
  const screwXs = [bx0 + 3.5, ...c.fanX.slice(0, -1).map((fx, i) => (fx + c.fanX[i + 1]!) / 2), bx1 - 3.5];
  for (const x of screwXs) for (const sz of [1, -1]) pb.add(shg.clone(), shm, xf({ p: [x, c.fanY - 1.6, mid + sz * (sq - 3.5)], r: [PI / 2, 0, 0] }), { uv: 'keep' });
  // Side walls, flat and square: the glass facing wall carries a long window onto the fins.
  const wallY0 = c.fanY + plateT; const wallY1 = -2; const sideH = wallY1 - wallY0;
  const glassSide = roundedPoly([[x0, 0], [x1, 0], [x1, sideH], [x0, sideH]], 0.8) as THREE.Shape;
  const sockX = Math.min(c.pcbEnd - 26, c.back + c.L * 0.62);
  const skL = sockX - socketList(c)[0]!.w / 2 - 1.5; const skR = sockX + (socketList(c).length - 1) * SOCKET_PITCH + socketList(c)[0]!.w / 2 + 1.5;
  // The fin window runs the length of the edge in two parts, broken by the power socket block on solid shroud; the seams
  // run the whole length and break there too.
  const wx0 = x0 + 22; const wx1 = x1 - 16;
  const spans = ([[wx0, skL - 8], [skR + 8, wx1]] as [number, number][]).filter(([a, b]) => b - a > 24);
  // The window and its upper seam stay below the power socket cutouts on the same edge.
  const winTop = Math.min(sideH * 0.6, sideH - 17); const winBot = sideH * 0.16;
  for (const [a, b] of spans) glassSide.holes.push(rrectHole(b - a, winTop - winBot, 1.2, (a + b) / 2, (winTop + winBot) / 2));
  socketList(c).forEach((p, i) => glassSide.holes.push(rrectHole(p.w + 3, 8.6, 1.2, sockX + i * SOCKET_PITCH, sideH - 6.2)));
  pb.add(extrude(glassSide, 2.6, 0.4, 'xy', 6, 1), shell, new THREE.Matrix4().makeTranslation(0, wallY0, c.H - 2.6));
  const boardSide = roundedPoly([[x0, 0], [x1, 0], [x1, sideH], [x0, sideH]], 0.8) as THREE.Shape;
  boardSide.holes.push(rrectHole(x1 - x0 - 50, sideH * 0.5, 1.2, (x0 + x1) / 2, sideH * 0.4));
  pb.add(extrude(boardSide, 2.4, 0.4, 'xy', 6, 1), shell, new THREE.Matrix4().makeTranslation(0, wallY0, c.clear));
  // The end: a square cap with a grid of vent slots.
  const endCap = roundedPoly([[0, c.clear], [sideH, c.clear], [sideH, c.H], [0, c.H]], 0.8) as THREE.Shape;
  // A solid end with raised horizontal ribs: open slots looked onto the dark face of the last fin.
  for (let r = 0; r < 5; r++) pb.add(rbox(1.2, sideH - 10, 2.4, 0.5, 2), shell, at(x1 + 0.5, wallY0 + sideH / 2, c.clear + 16 + r * ((c.H - c.clear - 32) / 4)));
  pb.add(extrude(endCap, 2.6, 0.4, 'xy', 6, 1), shell, // A proper rotation (no mirror): a mirrored basis turned the cap's faces inward and the renderer culled it.
    new THREE.Matrix4().makeTranslation(x1 - 2.6, wallY0, 0).multiply(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)));
  // Fins: a deep stack in the card's own fin metal, seen whole through the window.
  // The stack runs to the end cap, so its vents look onto fins.
  // Cut round the power socket housings, which stand down into the stack from the edge.
  const fm: MatName = c.frost ? 'finPale' : fin.fin;
  fins(pb, c, fm, c.back + 10, c.end - 3.2, wallY0 + 1.2, -6.5, c.clear + 3, c.H - 13, 2.2);
  for (const [a, b] of [[c.back + 10, skL], [skR, c.end - 3.2]] as [number, number][]) if (b - a > 4) fins(pb, c, fm, a, b, wallY0 + 1.2, -6.5, c.H - 13, c.H - 3.5, 2.2);
  heatpipes(pb, c, c.spec.fans >= 3 ? 6 : 4, -16, c.clear + 14, c.H - 18);
  const fanBlades = industrial ? 7 : 9;
  c.fanX.forEach((fx, i) => rotors.push(cardFan(pb, labels, c, fx, mid, c.fanR, fanBlades, edge, brandName(c.spec.brand).toUpperCase(), `${c.key}-${i}`)));
  for (const x of [x0 + 10, x1 - 8]) pb.add(shg.clone(), shm, xf({ p: [x, wallY0 + sideH * 0.82, c.H + 0.05] }), { uv: 'keep' });
  shg.dispose();
  // Backplate: a flat plate with a rectangular grid of vents over the GPU's back, held by screws in a grid.
  const bpY = 0.8 + 1.4; const bpT = 2.0;
  const bp = roundedPoly([[x0, c.clear + 2], [x1, c.clear + 2], [x1, c.H], [x0, c.H]], 0.8) as THREE.Shape;
  const plain = c.spec.lightZones === 0;
  // Vents over the GPU only: over the power socket block they showed the housings through the plate.
  if (!plain) for (let k = 0; k < 6; k++) { const vx = c.back + 130 + k * 13; if (vx + 6 > skL - 8 && vx - 6 < skR + 8) continue; bp.holes.push(rrectHole(9, 22, 0.6, vx, c.H - 22)); }
  // White cards carry a brushed white aluminum plate: a painted plate read as a flat CG field from the back.
  pb.add(extrude(bp, bpT, 0.4, 'xy', 8, 1), c.frost ? 'aluWhiteBrushed' : 'aluBrushedPlate', xzAt(bpY + bpT));
  if (c.frost) {
    // The white plate is stamped with a row of shallow raised panels between the brace screws, the slab's grid in relief,
    // whose bevels catch the light where a flat white field showed nothing.
    const bz = (c.clear + c.H) / 2 - 4; const ba = x0 + 24; const bb = x1 - 24; const n = 4; const gapP = 5;
    const pw = (bb - ba - (n - 1) * gapP) / n;
    // Raised brushed panels, each sat in a shallow grey shadow gap, so their edges and grain read against the plate.
    for (let k = 0; k < n; k++) {
      const px = ba + pw / 2 + k * (pw + gapP);
      pb.add(rbox(pw + 1.6, 0.4, 25.6, 0.2, 1), 'powderWhiteInner', at(px, bpY + bpT + 0.15, bz));
      pb.add(rbox(pw, 1.8, 24, 0.9, 4), 'aluWhiteBrushed', at(px, bpY + bpT + 0.9, bz));
    }
  }
  const sg = screwGeometry(1.9, 1.0, industrial ? 'hex' : 'button');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: c.frost ? 0xd0d2d6 : 0x8a8d94, metalness: 1, roughness: 0.34, vertexColors: true }));
  const short = c.L < 200;
  // A short plate keeps its screws to the corners, so the print has room between them.
  for (const x of short ? [x0 + 8, c.pcbEnd - 8] : [x0 + 8, (x0 + c.pcbEnd) / 2, c.pcbEnd - 8]) for (const z of [c.clear + 8, c.H - 8]) pb.add(sg.clone(), sm, xf({ p: [x, bpY + bpT, z], r: [-PI / 2, 0, 0] }), { uv: 'keep' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) pb.add(sg.clone(), sm, xf({ p: [c.back + 78 + sx * 18.6, bpY + bpT, mid - 4 + sz * 18.6], r: [-PI / 2, 0, 0] }), { uv: 'keep' });
  sg.dispose();
  const bpPrint = c.frost ? '#5e626b' : '#c0c4cc';
  labels.text(brandName(c.spec.brand), BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, short ? 7.5 : 9, xf({ p: [(c.back + 40 + Math.min(80, Math.max(0, c.L - 180))), bpY + bpT + 0.06, c.clear + (short ? 17 : 18)], r: [-PI / 2, 0, 0] }), { color: bpPrint, align: 'left' });
  labels.text(c.spec.name.toUpperCase(), MODEL_TYPE, 3.2, xf({ p: [(c.back + 40 + Math.min(80, Math.max(0, c.L - 180))), bpY + bpT + 0.06, c.clear + (short ? 8.5 : 30)], r: [-PI / 2, 0, 0] }), { color: c.frost ? '#7d818a' : '#878b94', align: 'left' });
  // Block wordmark on the glass facing side, above the window.
  const wordY = wallY0 + sideH * 0.82;
  // Left of the power sockets, clear of their cutouts.
  labels.text(brandName(c.spec.brand), BRAND_TYPE[c.spec.brand] ?? SPEC_TYPE, 7.2, xf({ p: [wx0, wordY, c.H + 0.05] }), { color: c.frost ? '#4f535c' : '#cfd2d9', align: 'left' });
  labels.text(c.spec.name.toUpperCase(), MODEL_TYPE, 2.4, xf({ p: [skR + 6, wordY, c.H + 0.05] }), { color: c.frost ? '#7a7e87' : '#7d818a', align: 'left' });
  // Light seams: thin lines cut into the glass facing side, under the window, over it, and down the end.
  const seams: { a: THREE.Vector3; b: THREE.Vector3; n: THREE.Vector3 }[] = [
    { a: new THREE.Vector3(wx0, wallY0 + sideH * 0.07, c.H + 0.1), b: new THREE.Vector3(wx1, wallY0 + sideH * 0.07, c.H + 0.1), n: new THREE.Vector3(0, 0, 1) },
    { a: new THREE.Vector3(wx0, wallY0 + winTop + 2.4, c.H + 0.1), b: new THREE.Vector3(wx1, wallY0 + winTop + 2.4, c.H + 0.1), n: new THREE.Vector3(0, 0, 1) },
    { a: new THREE.Vector3(x1 + 0.1, wallY0 + sideH * 0.5, c.clear + 10), b: new THREE.Vector3(x1 + 0.1, wallY0 + sideH * 0.5, c.H - 10), n: new THREE.Vector3(1, 0, 0) },
  ];
  seams.slice(0, c.spec.lightZones).forEach((s, i) => {
    const len = s.a.distanceTo(s.b); const count = Math.max(8, Math.round(len / 8));
    const zone = new Zone(`${c.key}:seam${i}`, 'gpu', false, Array.from({ length: count }, (_, k) => s.a.clone().lerp(s.b, k / (count - 1))), 0.3 + i * 0.2);
    const along = s.b.clone().sub(s.a).normalize();
    const mid3 = s.a.clone().add(s.b).multiplyScalar(0.5);
    const rot = new THREE.Matrix4().makeBasis(along, new THREE.Vector3().crossVectors(s.n, along), s.n);
    // White cards get a smoked seam: a pale body reflected the white studio light into the cyan and washed it out.
    const dm = c.frost ? zone.diffuser(0.42, 0x4a4d55, 0.5) : zone.diffuser(0.7, 0x1f2026, 0.5);
    // Pieces along the seam, in seam coordinates from its middle: the upper seam skips the socket block above it.
    const pieces: [number, number][] = i === 1 ? spans.map(([a, b]) => [a - mid3.x, b - mid3.x]) : [[-len / 2, len / 2]];
    for (const [a, b] of pieces) {
      const g = rbox(b - a, 1.1, 1.1, 0.3, 2);
      const gp = g.getAttribute('position'); const gu = g.getAttribute('uv');
      for (let k = 0; k < gp.count; k++) gu.setXY(k, (gp.getX(k) + (a + b) / 2 + len / 2) / len, 0.5);
      pb.mesh(g, dm, rot.clone().multiply(new THREE.Matrix4().makeTranslation((a + b) / 2, 0, 0)).setPosition(mid3.clone().addScaledVector(along, (a + b) / 2)), { uv: 'keep' });
    }
    // A white seam steps its body down from white as its LEDs come up, so the light keeps its color.
    if (c.frost) { const w = new THREE.Color(0xd8dadf); const lit = new THREE.Color(0x2c2e34); zone.listeners.push((col) => dm.color.copy(w).lerp(lit, Math.min(1, 1.6 * Math.max(col.r, col.g, col.b)))); }
    const spill = c.frost ? pb.own(zone.tint(1.0, 0.8, 'soft')) : zone.spill(0.4);
    // Away from the window the light spreads over the face to the next edge; toward it, it stops at the window's edge.
    const away = i === 0 ? -1 : i === 1 ? 1 : 0;
    for (const side of [1, -1]) {
      // On white the light shows only as a tint, so it spreads further over the face.
      const depth = side === away ? (c.frost ? 8 : i === 0 ? 2.5 : 3.6) : i === 2 ? 3 : c.frost ? 3 : 1.8;
      const m2 = rot.clone().multiply(new THREE.Matrix4().makeRotationZ(side > 0 ? 0 : PI)).setPosition(mid3.clone().addScaledVector(new THREE.Vector3().crossVectors(s.n, along), side * 0.6).addScaledVector(s.n, 0.06));
      for (const [a, b] of pieces) {
        // Turned half a turn for the lower strip, so its range runs the other way along the seam.
        const st = side > 0 ? spillStripRange(len, a, b, depth, 16) : spillStripRange(len, -b, -a, depth, 16);
        // Turned half a turn, its u runs backwards along the seam: flip it so the colors line up with the seam's.
        if (side < 0) { const su = st.getAttribute('uv'); for (let k = 0; k < su.count; k++) su.setX(k, 1 - su.getX(k)); }
        pb.mesh(st, spill, m2, { uv: 'keep' }).userData.spill = true;
      }
    }
    zone.emit(mid3.clone().addScaledVector(s.n, 1), s.n.clone(), len, 6, 0.9, along.clone());
    zones.push(zone);
  });
  // Only a band under the top seam takes its light, fading out: lit over the window's full height, the fins read as a broad
  // light bar, Veltrin's signature, not Dravik's thin seams (critic 264).
  const band = Math.max(wallY0 + 3, wallY0 + winTop - 8);
  if (c.frost && zones[1]) finLight(pb, zones[1], 0.2, c.back + 10, c.end - 8, wx0, wx1, band, wallY0 + winTop, c.H - 3.5, 2.2, [skL, skR], true);
  if (c.spec.lightZones >= 1) finLight(pb, zones[0]!, c.frost ? 0.2 : 0.14, c.back + 10, c.end - 8, wx0, wx1, band, wallY0 + winTop, c.H - 3.5, 2.2, [skL, skR], true);
  const anchors = powerSockets(pb, labels, c, sockX);
  return { zones, rotors, anchors };
}

export function gpuPart(id: string, opts: GenOpts = {}): PartObject {
  const spec = getGpu(id);
  if (!spec) throw new Error(`unknown card ${id}`);
  const key = opts.key ?? `gpu:${id}`;
  const c = cardDims(spec, key);
  const pb = new PartBuilder(`gpu-${id}`);
  const labels = new Labels(pb, 36);
  pcb(pb, labels, c);
  const screws = bracket(pb, labels, c, spec.brand === 'dravik' ? 'grid' : 'slant');
  const built = spec.brand === 'dravik' ? dravik(pb, labels, c) : veltrin(pb, labels, c);
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
