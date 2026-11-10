import * as THREE from 'three';
import { brandName, getCase, K, type CaseSpec } from '../../data/catalog';
import { CASE_LAYOUTS } from '../layout/cases';
import { HOLES_UNION } from '../layout/cases/vitrine';
import type { CaseLayout } from '../layout/types';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, rbox, rrect, rrectHole, rrectShape, torus, xf } from '../kit/geometry';
import { glassCapBoxes, glassPanels, HOLES4, hexStandoffs, perforated, screwsAt, trayGrommets, ZY } from './caseKit';
import { atriumCase } from './caseAtrium';
import { ventCase } from './caseVent';
import { bulwarkCase } from './caseBulwark';
import { cubCase } from './caseCub';
import type { Zone } from '../light/zones';
import type { Box } from '../layout/math';
import { Labels } from '../kit/labels';
import { FINISHES, mat, type CaseFinish } from '../kit/materials';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import type { GenOpts, PartObject } from './types';

const PI = Math.PI;
function vitrine(pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string): Record<string, THREE.Object3D> {
  const movers: Record<string, THREE.Object3D> = {};
  const x0 = -230; const x1 = 230; const z0 = -117.5; const z1 = 117.5; const y0 = 18; const y1 = 498;
  const W = x1 - x0; const D = z1 - z0; const H = y1 - y0;
  const cy = (y0 + y1) / 2;
  const light = F.light;
  const screwColor = light ? 0xd4d6da : 0x26272b;

  // frame: corner posts and rails with rounded edges
  const e = 9;
  for (const [x, z] of [[x0 + e / 2, z1 - e / 2], [x1 - e / 2, z1 - e / 2], [x0 + e / 2, z0 + e / 2], [x1 - e / 2, z0 + e / 2]] as [number, number][]) pb.add(rbox(e, H, e, 2.6, 3), F.shell, at(x, cy, z));
  for (const y of [y0 + e / 2, y1 - e / 2]) {
    pb.add(rbox(W - 2 * e, e, e, 2.6, 3), F.shell, at(0, y, z1 - e / 2));
    pb.add(rbox(W - 2 * e, e, e, 2.6, 3), F.shell, at(0, y, z0 + e / 2));
    pb.add(rbox(e, e, D - 2 * e, 2.6, 3), F.shell, at(x0 + e / 2, y, 0));
    pb.add(rbox(e, e, D - 2 * e, 2.6, 3), F.shell, at(x1 - e / 2, y, 0));
  }

  // right side panel with a pressed return and its rear thumbscrews
  // The solid panel's edges fold inward into a return, so its outline is a rounded bend that catches a highlight; a flat
  // sheet with a fine bevel read as a cut slab.
  pb.add(rbox(W - 4, H - 4, 4.2, 2.0, 5), F.shell, at(0, cy, z0 + 2.1));
  pb.add(rbox(W - 40, H - 40, 0.8, 4, 2), F.inner, at(0, cy, z0 + 4.6));
  screwsAt(pb, [xf({ p: [x0 - 0.2, y1 - 30, -100], r: [0, -PI / 2, 0] }), xf({ p: [x0 - 0.2, y0 + 30, -100], r: [0, -PI / 2, 0] })], 'button', screwColor, 3.6);

  // floor with an intake field under the supply
  const floor = rrectShape(W - 2, D - 2, 3);
  floor.holes.push(rrectHole(150, 140, 6, -140, 30));
  pb.add(extrude(floor, 2, 0.5, 'xz', 8), F.inner, at(0, y0, 0));
  perforated(pb, F, 156, 146, xf({ p: [-140, y0 + 0.4, -30], r: [-PI / 2, 0, 0] }), 3);

  // top: frame, fine perforation over the mount, front I/O
  const top = rrectShape(W - 2, D - 2, 4);
  top.holes.push(rrectHole(406, 130, 6, -7, -46));
  pb.add(extrude(top, 1.6, 0.5, 'xz', 10), F.shell, at(0, y1 - 1.6, 0));
  // The top takes a coarser pitch than the front, as many top panels do, so it reads as perforated even foreshortened.
  perforated(pb, F, 408, 132, xf({ p: [-7, y1 - 1.0, 46], r: [-PI / 2, 0, 0] }), 2.5, undefined, 2.6);
  // A magnetic dust filter under the top perforation, as top vented cases carry: a fine woven sheet that hides most of the
  // rails below it, so the top reads as perforated steel over a filter and not as a tinted sheet.
  const filter = pb.mesh(new THREE.PlaneGeometry(403, 127), pb.own(new THREE.MeshPhysicalMaterial({ color: light ? 0x55585f : 0x07070a, roughness: 0.95, transparent: true, opacity: 0.85, depthWrite: false })), xf({ p: [-7, 496.75, 46], r: [-PI / 2, 0, 0] }));
  filter.renderOrder = 2;
  for (const sz of [1, -1]) pb.add(rbox(440, 2.5, 14, 0.8, 2), F.inner, at(-6, 494 + 1.25, 46 + sz * 62));
  const io = pb.group('front-io', pb.root, at(210, y1, 0));
  pb.add(rbox(26, 1.2, 96, 3, 2), F.trim, at(0, 0.3, 0), { to: io });
  pb.add(lathe([[0, 0], [5.6, 0], [5.6, 1.6], [5.0, 2.2], [0, 2.2]], 40), F.accent, xf({ p: [0, 0.6, -36], r: [-PI / 2, 0, 0] }), { to: io });
  pb.add(lathe([[5.7, 0], [6.4, 0], [6.4, 1.2], [5.7, 1.2]], 40), 'nickel', xf({ p: [0, 0.6, -36], r: [-PI / 2, 0, 0] }), { to: io });
  for (const z of [-18, -2]) { pb.add(rbox(6.4, 0.6, 13.6, 0.5, 1), 'nickel', at(0, 0.95, z), { to: io }); pb.add(new THREE.BoxGeometry(5, 0.5, 12), 'darkVoid', at(0, 1.1, z), { to: io, uv: 'keep' }); }
  pb.add(rbox(3.6, 0.6, 9.4, 1.6, 2), 'nickel', at(0, 0.95, 13), { to: io });
  pb.add(rbox(2.4, 0.5, 8, 1, 1), 'darkVoid', at(0, 1.1, 13), { to: io, uv: 'keep' });
  pb.add(cyl(2.4, 0.6, 'y', 20), 'nickel', at(0, 0.95, 26), { to: io });
  pb.add(cyl(1.7, 0.5, 'y', 20), 'darkVoid', at(0, 1.1, 26), { to: io, uv: 'keep' });
  pb.add(cyl(1.6, 0.6, 'y', 16), F.accent, at(0, 0.95, 38), { to: io });

  // rear panel: I/O opening, expansion slots, fan mount, supply opening
  const rear = new THREE.Shape(); rrect(rear, z0 + 1, y0 + 1, D - 2, H - 2, 4);
  rear.holes.push(rrectHole(46, 152, 2, -46.5, 352));
  const slotTop = 275; const sp = K.slotPitch;
  for (let k = 0; k < 7; k++) rear.holes.push(rrectHole(112, sp - 4.6, 1.2, -14, slotTop - sp * (k + 0.5)));
  rear.holes.push(rrectHole(146, 82, 3, -30, 64));
  rear.holes.push(circleHole(40, 372, 57.5));
  for (const [dy, dz] of HOLES4) rear.holes.push(rrectHole(4.4, 9, 2.2, 40 + dz, 372 + dy));
  pb.add(extrude(rear, 1.5, 0.4, 'xy', 24), F.shell, new THREE.Matrix4().makeTranslation(x0 + 1.5, 0, 0).multiply(ZY));
  const vent = new THREE.Shape(); vent.absarc(0, 0, 58.5, 0, PI * 2, false);
  vent.holes.push(rrectHole(50, 50, 25, 0, 0));
  const ventPlane = new THREE.CircleGeometry(57.2, 64);
  pb.add(ventPlane, F.mesh, xf({ p: [x0 + 0.75, 372, 40], r: [0, -PI / 2, 0] }));
  for (const rr of [20, 34, 47]) pb.add(lathe([[rr - 0.9, -0.75], [rr + 0.9, -0.75], [rr + 0.9, 0.75], [rr - 0.9, 0.75]], 64), F.shell, xf({ p: [x0 + 0.75, 372, 40], r: [0, PI / 2, 0] }));
  for (let i = 0; i < 4; i++) pb.add(rbox(1.5, 110, 1.8, 0.6, 1), F.shell, xf({ p: [x0 + 0.75, 372, 40], r: [i * PI / 4, 0, 0] }));
  const ledge = pb.group('slot-ledge', pb.root);
  pb.add(rbox(6, sp * 7 + 8, 7, 0.8, 2), F.shell, at(x0 - 3, slotTop - sp * 3.5, 48), { to: ledge });
  for (let k = 0; k < 7; k++) {
    const cover = pb.group(`slot-cover-${k + 1}`, pb.root, at(x0 + 1.5, slotTop - sp * (k + 0.5), 0));
    const sh = new THREE.Shape(); rrect(sh, -66, -sp / 2 + 0.6, 118, sp - 1.2, 1);
    for (let v = 0; v < 6; v++) sh.holes.push(rrectHole(10, 2.6, 1.2, -50 + v * 15, 0));
    pb.add(extrude(sh, 0.8, 0.15, 'xy', 4, 1), F.shell, new THREE.Matrix4().multiply(ZY).multiply(at(0, 0, -0.8)), { to: cover });
    pb.add(rbox(8, sp - 1.6, 0.8, 0.3, 1), F.shell, at(-4.2, 0, 50.5), { to: cover });
    movers[`slot-cover-${k + 1}`] = cover;
  }
  screwsAt(pb, Array.from({ length: 7 }, (_, k) => xf({ p: [x0 - 6.2, slotTop - sp * (k + 0.5), 48], r: [0, -PI / 2, 0] })), 'pan', screwColor, 2.6);
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [x0 - 0.1, 64 + a! * 36, -30 + b! * 66], r: [0, -PI / 2, 0] })), 'pan', screwColor, 2.4);
  labels.text(`${brandName(spec.brand).toUpperCase()} ${spec.name.toUpperCase()} · ATX · ${spec.size.d} × ${spec.size.w} × ${spec.size.h} MM`, TINY_TYPE, 1.6, xf({ p: [x0 - 0.1, 472, -40], r: [0, -PI / 2, 0] }), { color: light ? '#6a6e78' : '#8a8e97' });

  // front: frame with a fine round perforated insert, inner fan bracket
  const fr = new THREE.Shape(); rrect(fr, z0 + 1, y0 + 1, D - 2, H - 2, 6);
  fr.holes.push(rrectHole(D - 30, H - 30, 8, 0, cy));
  pb.add(extrude(fr, 3, 0.9, 'xy', 16), F.shell, new THREE.Matrix4().makeTranslation(x1, 0, 0).multiply(ZY));
  perforated(pb, F, D - 28, H - 28, xf({ p: [x1 - 1.8, cy, 0], r: [0, PI / 2, 0] }), 1.5);
  // Two rails on the fans' screw lines, tied by a bar at each end: a solid plate hid the fan frames behind the mesh.
  const br = new THREE.Shape(); rrect(br, -58.5, y0 + 4, 117, 474, 4);
  br.holes.push(rrectHole(93, 474 - 28, 3, 0, y0 + 4 + 237));
  pb.add(extrude(br, 1.5, 0.2, 'xy', 24, 1), F.inner, new THREE.Matrix4().makeTranslation(224.5, 0, 0).multiply(ZY));
  // Threaded fan screw holes: tapped into the bracket, so no light shows through them behind the mesh.
  for (const fy of [100, 222, 344]) for (const [dy, dz] of HOLES4) for (const sx of [1, -1]) pb.add(cyl(2.0, 0.2, 'x', 16), 'darkVoid', at(223.75 + sx * 0.85, fy + dy, dz), { uv: 'keep' });
  // Each tapped hole is a pressed in clinch nut, bare zinc, so the fan mounts show as rows of bright rings behind the mesh.
  for (const fy of [100, 222, 344]) for (const [dy, dz] of HOLES4) pb.add(torus(2.5, 0.55, 8, 24), 'steelZinc', xf({ p: [224.6, fy + dy, dz], r: [0, PI / 2, 0] }));
  labels.text(brandName(spec.brand), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 3.2, xf({ p: [x1 + 0.05, y0 + 8.5, 0], r: [0, PI / 2, 0] }), { color: light ? '#7b7f88' : '#8d919a' });

  // board tray: cutouts with rubber grommets, standoffs for every board size
  const trayT = 1.2; const trayZ = -76.65;
  const tray = new THREE.Shape(); rrect(tray, -228.5, 118, 424.5, 376, 2);
  for (const gr of L.grommets) if (gr.normal[2] === 1) tray.holes.push(rrectHole(gr.size[0], gr.size[1], Math.min(7, gr.size[0] / 2 - 0.5, gr.size[1] / 2 - 0.5), gr.center[0], gr.center[1]));
  tray.holes.push(rrectHole(110, 96, 6, -110, 350));
  pb.add(extrude(tray, trayT, 0.3, 'xy', 12), F.inner, at(0, 0, trayZ));
  trayGrommets(pb, L, F, trayZ);
  hexStandoffs(pb, HOLES_UNION, L.boardAnchor, -75.45, light);

  // supply shroud with a slotted vent field, cable cutout and brand plate
  const sx0 = -228.5; const sx1 = 165; const sz0 = -116; const sz1 = 111.5;
  const st = new THREE.Shape(); rrect(st, sx0, -sz1, sx1 - sx0, sz1 - sz0, 3);
  for (let rr = 0; rr < 4; rr++) for (let c = 0; c < 10; c++) st.holes.push(rrectHole(15, 4.6, 2.3, -200 + c * 19, -(-10 - rr * 12)));
  const gc = L.grommets.find((g) => g.id === 'gpu');
  if (gc) st.holes.push(rrectHole(gc.size[0], gc.size[1], 8, gc.center[0], -gc.center[2]));
  // A smoked window over the drive cage, so a drive in the upper bay shows its label from above.
  const shw = L.shroudWindow;
  if (shw) st.holes.push(rrectHole(shw.w, shw.d, 6, shw.x, -shw.z));
  pb.add(extrude(st, 1.5, 0.45, 'xy', 12), F.shell, new THREE.Matrix4().makeTranslation(0, 116.5, 0).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0)));
  if (gc) {
    const ring = rrectShape(gc.size[0] + 6, gc.size[1] + 6, 10, gc.center[0], -gc.center[2]);
    ring.holes.push(rrectHole(gc.size[0] - 2, gc.size[1] - 2, 7, gc.center[0], -gc.center[2]));
    pb.add(extrude(ring, 2.8, 0.9, 'xy', 12, 2), F.foot, new THREE.Matrix4().makeTranslation(0, 117.2, 0).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
  }
  if (shw) {
    const gasket = rrectShape(shw.w + 5, shw.d + 5, 8.5, shw.x, -shw.z);
    gasket.holes.push(rrectHole(shw.w - 3, shw.d - 3, 4.5, shw.x, -shw.z));
    pb.add(extrude(gasket, 2.2, 0.7, 'xy', 12, 2), F.foot, new THREE.Matrix4().makeTranslation(0, 117.0, 0).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
    const top = pb.mesh(rbox(shw.w - 1, 2, shw.d - 1, 0.6, 2), pb.own(Object.assign((mat('glassTint') as THREE.MeshPhysicalMaterial).clone(), { opacity: 0.5 })), at(shw.x, 117.0, shw.z), { shadow: true });
    top.renderOrder = 10; top.userData.glass = true;
    const topSpec = pb.mesh(new THREE.PlaneGeometry(shw.w - 2, shw.d - 2), mat('glassSpec'), xf({ p: [shw.x, 118.05, shw.z], r: [-PI / 2, 0, 0] }));
    topSpec.renderOrder = 11; topSpec.userData.glass = true; topSpec.userData.glassSpec = true;
  }
  pb.add(rbox(sz1 - sz0, 98, 1.5, 0.5, 2), F.shell, xf({ p: [164.25, 67.5, (sz0 + sz1) / 2], r: [0, PI / 2, 0] }));
  const sideW = new THREE.Shape(); rrect(sideW, sx0, y0 + 2, 163.5 - sx0, 96.5, 2);
  sideW.holes.push(rrectHole(150, 72, 5, 82, 64));
  pb.add(extrude(sideW, 1.5, 0.45, 'xy', 8), F.shell, at(0, 0, 110));
  const win = pb.mesh(rbox(152, 74, 1.6, 0.6, 2), pb.own(Object.assign((mat('glassTint') as THREE.MeshPhysicalMaterial).clone(), { opacity: 0.42 })), at(82, 64, 110.75));
  win.renderOrder = 10; win.userData.glass = true;
  const winSpec = pb.mesh(new THREE.PlaneGeometry(150, 72), mat('glassSpec'), at(82, 64, 111.6));
  winSpec.renderOrder = 11; winSpec.userData.glass = true; winSpec.userData.glassSpec = true;
  // The brand plate is dark anodized on every finish, so its print reads on the white case too.
  pb.add(rbox(76, 20, 0.8, 0.35, 2), 'aluBlack', at(-150, 66, 111.9));
  labels.text(brandName(spec.brand), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 3.6, at(-150, 66, 112.34), { color: '#d2d5dc' });
  pb.add(rbox(400, 0.8, 3.0, 0.3, 1), F.inner, at(-30, 117.6, 108));

  // 3.5 inch cage with two sleds, drives lying lengthwise behind the shroud window
  pb.add(rbox(162, 84, 2, 0.6, 2), F.inner, at(81, 62, -7));
  const cageEnd = rrectShape(112, 84, 0.6, -48, 62);
  for (const bay of L.bays35) cageEnd.holes.push(rrectHole(52, 14.4, 3, -60, bay.pose.pos[1] + 7.8));
  pb.add(extrude(cageEnd, 2, 0.5, 'zy', 8), F.inner, at(-2, 0, 0));
  pb.add(rbox(162, 2, 110, 0.6, 2), F.inner, at(81, 59, 49));
  // Tool-less sleds in grey plastic; the empty lower sled shows its floor, so the bay reads as a sled and not a black hole.
  const sled = light ? 'plasticWhite' : 'plasticGrey';
  for (const y of [22, 60]) {
    for (const s of [-1, 1]) pb.add(rbox(150, 6, 4, 0.8, 2), sled, at(82, y + 3, 46 + s * 53));
    pb.add(rbox(4, 8, 14, 1.6, 2), sled, at(159, y + 4, 46));
  }
  pb.add(rbox(146, 1.6, 102, 0.6, 2), sled, at(82, 22.8, 46));
  for (const hx of [30, 82, 134]) pb.add(cyl(3.2, 1.7, 'y', 20), 'darkVoid', at(hx, 22.9, 46), { uv: 'keep' });
  // 2.5 inch brackets behind the tray
  for (const bay of L.bays25) pb.add(rbox(74, 104, 1.0, 0.6, 2), F.inner, at(bay.pose.pos[0], bay.pose.pos[1] + 50, trayZ - 0.5));

  // feet
  // Feet near the corners, flush with the end panels, so they stand where the case's weight is and catch the light.
  for (const fx of [-198, 198]) {
    pb.add(rbox(60, 14, 210, 4, 3), F.trim, at(fx, 11, 0));
    pb.add(rbox(52, 4, 200, 1.6, 2), F.foot, at(fx, 2, 0));
  }
  void finish;
  return movers;
}

/** What a case builder adds beyond its layout's boxes: its movers, any extra collision boxes and its light zones. */
export type CaseBuild = { movers: Record<string, THREE.Object3D>; boxes: Box[]; zones: Zone[] };

function vitrineCase(pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string): CaseBuild {
  const movers = vitrine(pb, labels, spec, L, F, finish);
  return {
    movers,
    boxes: [
      { min: [-237, 125, 41], max: [-230, 283, 55], tag: 'slot-ledge' },
      { min: [-231, 20, -112], max: [-230, 480, -88], tag: 'thumbscrew' },
    ],
    zones: [],
  };
}

const BUILDERS: Record<string, (pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string) => CaseBuild> = {
  vitrine: vitrineCase,
  atrium: atriumCase,
  vent: ventCase,
  bulwark: bulwarkCase,
  cub: cubCase,
};

export function casePart(id: string, opts: GenOpts = {}): PartObject {
  const spec = getCase(id);
  const L = CASE_LAYOUTS[id];
  const make = BUILDERS[id];
  if (!spec || !L || !make) throw new Error(`no layout for case ${id}`);
  const finish = opts.finish && spec.finishes.some((f) => f === opts.finish) ? opts.finish : spec.finishes[0] ?? 'onyx';
  const F = FINISHES[finish] ?? FINISHES.onyx!;
  const pb = new PartBuilder(`case-${id}-${finish}`);
  const labels = new Labels(pb, 18);
  const made = make(pb, labels, spec, L, F, finish);
  made.movers.glass = glassPanels(pb, L, F);
  labels.finish();
  const done = pb.finish();
  for (const z of made.zones) z.owner = done.root;
  const boxes = [...L.boxes, ...glassCapBoxes(L), ...made.boxes];
  return { root: done.root, boxes, anchors: {}, zones: made.zones, rotors: [], movers: made.movers, dispose: () => { done.dispose(); for (const z of made.zones) z.dispose(); } };
}
