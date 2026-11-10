import * as THREE from 'three';
import { brandName, K, type CaseSpec } from '../../data/catalog';
import { CUB_ANCHOR, CUB_FLOOR, CUB_FRONT_IN, CUB_GLASS_IN, CUB_PSU_Y, CUB_REAR_IN, CUB_RIGHT_IN, CUB_RISER, CUB_TOP_IN, CUB_TRAY_BACK, CUB_TRAY_END, CUB_TRAY_FRONT, ITX_HOLES } from '../layout/cases/cub';
import { DIMS } from '../layout/dims';
import type { CaseLayout } from '../layout/types';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, rbox, rrect, rrectHole, rrectShape, xf } from '../kit/geometry';
import type { Labels } from '../kit/labels';
import type { CaseFinish } from '../kit/materials';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import type { CaseBuild } from './case';
import { hexStandoffs, perforated, screwsAt, trayGrommets, ZY } from './caseKit';

const PI = Math.PI;
/** Plate thickness of the shell. */
const PLATE = 4;
/** Outer corner radius of the shell's plates. */
const CORNER = 10;

/**
 * Cub: Paleforge's small form factor. Six thick bead blasted plates with large outer radii held by visible standoffs at the
 * corners; perforated top and right side; glass on the left; a small engraved mark on the front. Inside, the ITX board
 * stands at the rear, the SFX supply stands on a bracket at the front, and the card lies along the floor on a riser fed by a
 * short ribbon from the board's slot. Coordinates come from its layout.
 */
export function cubCase(pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string): CaseBuild {
  void finish;
  const movers: Record<string, THREE.Object3D> = {};
  const x0 = -167.5; const x1 = 167.5; const z0 = -97.5; const z1 = 97.5; const y1 = 315;
  const W = x1 - x0; const D = z1 - z0;
  const light = F.light;
  const screwColor = light ? 0xc9ccd2 : 0x3a3d44;
  const anchor = CUB_ANCHOR;

  // Front and rear plates: thick, with large radii on every outer corner.
  const front = rrectShape(D, y1, CORNER, 0, y1 / 2);
  // The supply's inlet and switch face out through the front plate.
  front.holes.push(rrectHole(127, 65.5, 3, -30, CUB_PSU_Y + 31.75));
  pb.add(extrude(front, PLATE, 1.6, 'xy', 16, 3), F.shell, new THREE.Matrix4().makeTranslation(x1, 0, 0).multiply(ZY));
  // The power button and two ports high on the front, a small engraved mark low.
  pb.add(lathe([[0, 0], [6.2, 0], [6.2, 1.6], [5.6, 2.2], [0, 2.2]], 40), F.accent, xf({ p: [x1, 280, 60], r: [0, 0, -PI / 2] }));
  pb.add(lathe([[6.3, 0], [7.0, 0], [7.0, 1.2], [6.3, 1.2]], 40), 'nickel', xf({ p: [x1, 280, 60], r: [0, 0, -PI / 2] }));
  for (const z of [34, 18]) { pb.add(rbox(0.6, 6.4, 13.6, 0.5, 1), 'nickel', at(x1 + 0.3, 280, z)); pb.add(new THREE.BoxGeometry(0.5, 5, 12), 'darkVoid', at(x1 + 0.45, 280, z), { uv: 'keep' }); }
  labels.text(brandName(spec.brand).toUpperCase(), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 3.2, xf({ p: [x1 + 0.05, 22, 0], r: [0, PI / 2, 0] }), { color: light ? '#8a8e97' : '#7b7f88', rough: 0.4 });
  const rear = rrectShape(D, y1, CORNER, 0, y1 / 2);
  const ioZ = anchor[2] + 22.6; const ioY = anchor[1] - 78;
  rear.holes.push(rrectHole(46, 152, 2, ioZ, ioY));
  const sp = K.slotPitch; const slotTop = CUB_RISER[1] + 6;
  for (let k = 0; k < 3; k++) rear.holes.push(rrectHole(112, sp - 4.6, 1.2, CUB_RISER[2] + 55.1, slotTop - sp * (k + 0.5)));
  const fan = L.fanMounts.find((m) => m.id === 'rear-1')!;
  rear.holes.push(circleHole(fan.center[2], fan.center[1], 57.5));
  const fh = DIMS.fan[120].holes / 2;
  for (const [dy, dz] of [[fh, fh], [fh, -fh], [-fh, fh], [-fh, -fh]]) rear.holes.push(rrectHole(4.4, 4.4, 2.2, fan.center[2] + dz!, fan.center[1] + dy!));
  pb.add(extrude(rear, PLATE, 1.6, 'xy', 16, 3), F.shell, new THREE.Matrix4().makeTranslation(x0 + PLATE, 0, 0).multiply(ZY));
  // A machined grille over the exhaust: concentric slots.
  for (const rr of [16, 28, 40, 52]) pb.add(lathe([[rr - 1.2, -1.5], [rr + 1.2, -1.5], [rr + 1.2, 1.5], [rr - 1.2, 1.5]], 72), F.shell, xf({ p: [x0 + 2, fan.center[1], fan.center[2]], r: [0, PI / 2, 0] }));
  for (let i = 0; i < 2; i++) pb.add(rbox(3, 112, 2.4, 0.8, 1), F.shell, xf({ p: [x0 + 2, fan.center[1], fan.center[2]], r: [i * PI / 2, 0, 0] }));
  for (let k = 0; k < 3; k++) {
    const cover = pb.group(`slot-cover-${k + 1}`, pb.root, at(x0 + PLATE, slotTop - sp * (k + 0.5), CUB_RISER[2] + 55.1 + 14));
    const sh = new THREE.Shape(); rrect(sh, -66, -sp / 2 + 0.6, 118, sp - 1.2, 1);
    for (let v = 0; v < 6; v++) sh.holes.push(rrectHole(10, 2.6, 1.2, -50 + v * 15, 0));
    pb.add(extrude(sh, 0.8, 0.15, 'xy', 4, 1), F.inner, new THREE.Matrix4().multiply(ZY).multiply(at(0, 0, -0.8)), { to: cover });
    movers[`slot-cover-${k + 1}`] = cover;
  }
  screwsAt(pb, Array.from({ length: 3 }, (_, k) => xf({ p: [x0 - 0.2, slotTop - sp * (k + 0.5), CUB_RISER[2] + 55.1 + 62], r: [0, -PI / 2, 0] })), 'button', screwColor, 2.4);
  labels.text(`${brandName(spec.brand).toUpperCase()} ${spec.name.toUpperCase()} · MINI ITX · ${spec.size.d} × ${spec.size.w} × ${spec.size.h} MM`, TINY_TYPE, 2.0, xf({ p: [x0 - 0.1, 296, -30], r: [0, -PI / 2, 0] }), { color: light ? '#6a6e78' : '#8a8e97' });

  // Top and right: thick plates with perforated fields, the right one over the board's back and the supply.
  const topPlate = rrectShape(W - 2 * PLATE, D, CORNER, 0, 0);
  topPlate.holes.push(rrectHole(W - 2 * PLATE - 36, D - 40, 6, 0, -6));
  pb.add(extrude(topPlate, PLATE, 1.6, 'xz', 16, 3), F.shell, at(0, y1 - PLATE, 0));
  perforated(pb, F, W - 2 * PLATE - 34, D - 38, xf({ p: [0, y1 - 1.4, 6], r: [-PI / 2, 0, 0] }), 2, undefined, 1.6);
  const right = rrectShape(W - 2 * PLATE, y1 - 2 * PLATE, 6, 0, y1 / 2);
  right.holes.push(rrectHole(W - 2 * PLATE - 36, y1 - 2 * PLATE - 36, 6, 0, y1 / 2));
  pb.add(extrude(right, PLATE, 1.6, 'xy', 12, 3), F.shell, at(0, 0, z0));
  perforated(pb, F, W - 2 * PLATE - 34, y1 - 2 * PLATE - 34, xf({ p: [0, y1 / 2, z0 + 1.4], r: [0, PI, 0] }), 2, undefined, 1.6);
  // Floor plate with an intake under the card's fans.
  const floor = rrectShape(W - 2 * PLATE, D, CORNER, 0, 0);
  floor.holes.push(rrectHole(270, 110, 6, 0, -2));
  pb.add(extrude(floor, PLATE, 1.2, 'xz', 16, 3), F.shell, at(0, CUB_FLOOR - PLATE, 0));
  perforated(pb, F, 272, 112, xf({ p: [0, CUB_FLOOR - 2, 2], r: [-PI / 2, 0, 0] }), 2, undefined, 1.6);
  // Visible standoffs: the machined posts that tie the plates together at the corners, with their caps on the outside.
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) {
    const px = sx * (x1 - PLATE - 7); const pz = sz * (z1 - 7);
    pb.add(cyl(4.5, y1 - 2 * PLATE, 'y', 24), F.accent, at(px, y1 / 2, pz));
    for (const py of [y1 - 0.2, CUB_FLOOR - PLATE - 0.2]) pb.add(lathe([[0, 0], [4.2, 0], [4.6, 0.5], [4.6, 1.4], [0, 1.6]], 24), F.accent, xf({ p: [px, py, pz], r: [py > 100 ? 0 : PI, 0, 0] }));
  }
  // Small feet under the floor.
  for (const [fx, fz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) pb.add(cyl(9, CUB_FLOOR - PLATE, 'y', 28), F.foot, at(fx * 135, (CUB_FLOOR - PLATE) / 2, fz * 68));

  // The board tray, full height, ending before the supply.
  const tray = new THREE.Shape(); rrect(tray, CUB_REAR_IN, CUB_FLOOR, CUB_TRAY_END - CUB_REAR_IN, CUB_TOP_IN - CUB_FLOOR, 2);
  for (const gr of L.grommets) if (gr.normal[2] === 1) tray.holes.push(rrectHole(gr.size[0], gr.size[1], Math.min(7, gr.size[0] / 2 - 0.5, gr.size[1] / 2 - 0.5), gr.center[0], gr.center[1]));
  tray.holes.push(rrectHole(84, 84, 6, anchor[0] + 86, anchor[1] - 76));
  pb.add(extrude(tray, 1.2, 0.3, 'xy', 12), F.inner, at(0, 0, CUB_TRAY_BACK));
  trayGrommets(pb, L, F, CUB_TRAY_BACK);
  hexStandoffs(pb, ITX_HOLES, anchor, CUB_TRAY_FRONT, light);

  // The riser: a slot on a small board on the tray under the main board, and a short ribbon from the board's slot to it.
  const rx0 = CUB_RISER[0]; const rlen = DIMS.pcieX16Length;
  pb.add(rbox(rlen + 18, 26, 1.6, 0.6, 1), 'pcbCore', at(rx0 + rlen / 2, CUB_RISER[1] - 2, CUB_TRAY_FRONT + 0.8));
  pb.add(rbox(rlen, DIMS.pcieSlotWidth, CUB_RISER[2] - CUB_TRAY_FRONT - 1.4, 0.4, 1), light ? 'plasticWhite' : 'plasticDark', at(rx0 + rlen / 2, CUB_RISER[1], (CUB_RISER[2] + CUB_TRAY_FRONT + 1.4) / 2 + 0.7));
  const slotY = anchor[1] - 160; const slotZ = anchor[2] + 1.6 + DIMS.pcieSlotHeight;
  const rib = new THREE.CatmullRomCurve3([new THREE.Vector3(0, slotY, slotZ), new THREE.Vector3(0, slotY - 2, slotZ + 4), new THREE.Vector3(0, (slotY + CUB_RISER[1]) / 2, slotZ + 4), new THREE.Vector3(0, CUB_RISER[1] + 8, CUB_TRAY_FRONT + 6), new THREE.Vector3(0, CUB_RISER[1] + 4, CUB_TRAY_FRONT + 2.4)]);
  const pts = rib.getPoints(24);
  const ribbon = new THREE.BufferGeometry();
  const pos: number[] = []; const idx: number[] = [];
  pts.forEach((p) => { pos.push(rx0, p.y, p.z, rx0 + rlen, p.y, p.z); });
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ribbon.setIndex(idx); ribbon.computeVertexNormals();
  const ribbonMat = pb.own(new THREE.MeshPhysicalMaterial({ color: light ? 0xd8dade : 0x1c1d21, roughness: 0.55, side: THREE.DoubleSide }));
  pb.mesh(ribbon, ribbonMat);

  // The supply's bracket: a plate across its inner end and a ledge it stands on, screwed to the right plate.
  pb.add(rbox(1.5, 64, 126, 0.5, 2), F.inner, at(14.75, CUB_PSU_Y + 32, -30));
  pb.add(rbox(150, 2, 30, 0.6, 2), F.inner, at(89, CUB_PSU_Y - 1, CUB_RIGHT_IN + 15));
  screwsAt(pb, [CUB_PSU_Y + 12, CUB_PSU_Y + 52].map((y) => xf({ p: [15.6, y, -70], r: [0, PI / 2, 0] })), 'pan', screwColor, 2.2);
  void CUB_FRONT_IN; void CUB_GLASS_IN;

  return { movers, boxes: [], zones: [] };
}
