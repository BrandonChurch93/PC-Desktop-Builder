import * as THREE from 'three';
import { brandName, K, type CaseSpec } from '../../data/catalog';
import {
  GANTRY_ANCHOR, GANTRY_FEET, GANTRY_FOOT_X, GANTRY_GLASS_IN, GANTRY_PILLAR_R, GANTRY_PILLARS, GANTRY_PSU_REAR, GANTRY_PSU_STOP, GANTRY_PSU_Z, GANTRY_REAR_IN,
  GANTRY_SHELF, GANTRY_SHELF_X, GANTRY_SPINE_FACE, GANTRY_SPINE_HALF, GANTRY_SPINE_IN, GANTRY_SPINE_OUT, GANTRY_SPINE_RAIL, GANTRY_SPINE_Y, GANTRY_TRAY_BACK, GANTRY_TRAY_FRONT,
} from '../layout/cases/gantry';
import { HOLES_UNION } from '../layout/cases/vitrine';
import type { CaseLayout } from '../layout/types';
import { at, circleHole, extrude, lathe, PartBuilder, rbox, rrect, rrectHole, rrectShape, xf } from '../kit/geometry';
import type { Labels } from '../kit/labels';
import type { CaseFinish } from '../kit/materials';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import type { CaseBuild } from './case';
import { hexStandoffs, screwsAt, ZY } from './caseKit';

const PI = Math.PI;
const PLATE = GANTRY_TRAY_FRONT - GANTRY_TRAY_BACK;
const TOP = 540;
const OUT_X0 = GANTRY_REAR_IN - 1.5;
/** Front panel controls on the spine's flange, beside the channel. */
const IO_Z = -85.5;
const IO_BUTTON_Y = 500;
const IO_PORTS_Y = [474, 458];
/** Half the spine opening's width, and the fan screw holes beyond it in the flange border. */
const FAN_OPEN = 46;
const FAN_HOLE = 52.5;
const SPINE_SCREWS_Y = [45, 160, 360, 522];

/**
 * A rubber grommet through the thick plate: a ring on each face, a liner through the cut, and a split membrane across the
 * middle that the cables push through. Both halves of a cable that comes back to the supply end at the membrane, so neither
 * face shows a cut end.
 */
function plateGrommet(pb: PartBuilder, F: CaseFinish, cx: number, cy: number, gw: number, gh: number) {
  for (const z of [GANTRY_TRAY_FRONT - 1, GANTRY_TRAY_BACK - 1.8]) {
    const ring = rrectShape(gw + 6, gh + 6, Math.min(9, (gw + 6) / 2 - 0.5), cx, cy);
    ring.holes.push(rrectHole(gw - 2, gh - 2, Math.min(6, gw / 2 - 1.5, gh / 2 - 1.5), cx, cy));
    pb.add(extrude(ring, 2.8, 0.9, 'xy', 12, 2), F.foot, at(0, 0, z));
  }
  // A liner through the plate's thickness, so the cut reads as a rubber edge and not bare metal.
  const liner = rrectShape(gw + 0.4, gh + 0.4, Math.min(7, gw / 2 - 0.3, gh / 2 - 0.3), cx, cy);
  liner.holes.push(rrectHole(gw - 2, gh - 2, Math.min(6, gw / 2 - 1.5, gh / 2 - 1.5), cx, cy));
  pb.add(extrude(liner, PLATE, 0, 'xy', 12), F.foot, at(0, 0, GANTRY_TRAY_BACK));
  const mid = (GANTRY_TRAY_FRONT + GANTRY_TRAY_BACK) / 2;
  const membrane = rrectShape(gw - 1.6, gh - 1.6, Math.min(5.5, gw / 2 - 1.3, gh / 2 - 1.3), cx, cy);
  pb.add(extrude(membrane, 0.8, 0, 'xy', 12), 'rubber', at(0, 0, mid - 0.4));
  // The split along the membrane's length, a dark line on each face.
  const along = gh >= gw;
  for (const z of [mid + 0.42, mid - 0.42]) pb.add(new THREE.PlaneGeometry(along ? 0.5 : gw - 6, along ? gh - 6 : 0.5), 'darkVoid', at(cx, cy, z).multiply(new THREE.Matrix4().makeRotationY(z < mid ? PI : 0)), { uv: 'keep' });
}

/**
 * Gantry: Paleforge's open frame. A thick bead blasted backplate stands on two machined feet and carries the board; a shelf
 * across the feet holds the supply and a drive; a C channel spine at the front carries three fans with a radiator nested in it;
 * the glass stands off the left side on four turned pillars, two from the plate and two from the spine's rail. Every face is
 * seen, so the plate's back carries the two 2.5 inch drives, the cables and a small spec print.
 */
export function gantryCase(pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string): CaseBuild {
  void finish;
  const movers: Record<string, THREE.Object3D> = {};
  const light = F.light;
  const plate = light ? 'aluRaw' : 'plateAnoBlack';
  const turned = light ? 'capSilver' : 'capDark';
  const screwColor = light ? 0xc9ccd2 : 0x3a3d44;
  const anchor = GANTRY_ANCHOR;
  const x0 = GANTRY_REAR_IN; const x1 = GANTRY_SPINE_OUT;

  // The backplate: 6 mm, chamfered all round, with the processor window and a grommet at every cable crossing.
  const bp = new THREE.Shape(); rrect(bp, x0, GANTRY_FEET, x1 - x0, TOP - GANTRY_FEET, 12);
  for (const gr of L.grommets) bp.holes.push(rrectHole(gr.size[0] + 0.4, gr.size[1] + 0.4, Math.min(7, gr.size[0] / 2 - 0.3, gr.size[1] / 2 - 0.3), gr.center[0], gr.center[1]));
  bp.holes.push(rrectHole(110, 96, 6, anchor[0] + 112.5, anchor[1] - 80));
  pb.add(extrude(bp, PLATE, 1.0, 'xy', 16, 2), plate, at(0, 0, GANTRY_TRAY_BACK));
  for (const gr of L.grommets) plateGrommet(pb, F, gr.center[0], gr.center[1], gr.size[0], gr.size[1]);
  hexStandoffs(pb, HOLES_UNION, anchor, GANTRY_TRAY_FRONT, light);
  labels.text(`${brandName(spec.brand).toUpperCase()} ${spec.name.toUpperCase()} · OPEN FRAME · ATX · ${spec.size.d} × ${spec.size.w} × ${spec.size.h} MM`, TINY_TYPE, 3.0, xf({ p: [-60, 512, GANTRY_TRAY_BACK - 0.05], r: [0, PI, 0] }), { color: light ? '#4a4e57' : '#9a9ea7' });

  // Feet: machined bars across the frame with rubber pads, and a clamp block behind the plate bolted through it.
  const footLen = 100 - (-127.5); const footZ = (100 - 127.5) / 2;
  for (const fx of GANTRY_FOOT_X) {
    pb.add(rbox(30, GANTRY_FEET - 2, footLen, 3, 3), plate, at(fx, 2 + (GANTRY_FEET - 2) / 2, footZ));
    for (const pz of [-118, 90]) pb.add(rbox(24, 2, 14, 0.8, 2), F.foot, at(fx, 1, pz));
    pb.add(rbox(30, 22, 12, 2, 3), plate, at(fx, GANTRY_FEET + 11, GANTRY_TRAY_BACK - 6));
    screwsAt(pb, [-8, 8].map((dx) => xf({ p: [fx + dx, GANTRY_FEET + 12, GANTRY_TRAY_BACK - 12.1], r: [0, PI, 0] })), 'hex', screwColor, 2.6);
    screwsAt(pb, [-8, 8].map((dx) => xf({ p: [fx + dx, GANTRY_SHELF + 0.1, 60], r: [-PI / 2, 0, 0] })), 'button', screwColor, 2.4);
  }

  // The shelf across the feet, its back edge against the plate: rubber strips under the supply, a stop at the end of the bay.
  const [sx0, sx1] = GANTRY_SHELF_X;
  pb.add(rbox(sx1 - sx0, GANTRY_SHELF - GANTRY_FEET, 80 - GANTRY_TRAY_FRONT, 1.2, 2), plate, at((sx0 + sx1) / 2, (GANTRY_FEET + GANTRY_SHELF) / 2, (80 + GANTRY_TRAY_FRONT) / 2));
  for (const dz of [-60, 40]) pb.add(rbox(150, 0.8, 8, 0.3, 1), F.foot, at(GANTRY_PSU_REAR + 80, GANTRY_SHELF - 0.3, GANTRY_PSU_Z + dz));
  pb.add(rbox(3, 8, 150, 0.8, 2), plate, at(GANTRY_PSU_STOP + 1.5, GANTRY_SHELF + 4, GANTRY_PSU_Z));
  for (const dz of [-73, 73]) pb.add(rbox(5, 10, 6, 1, 2), F.foot, at(GANTRY_PSU_REAR - 2.5, GANTRY_SHELF + 5, GANTRY_PSU_Z + dz));

  // The spine: a C channel standing at the front edge. Its flange spans from the plate to the glass side rail, open over the
  // fans; its two rails hold the fans on their inner edges and a radiator between them.
  const H = GANTRY_SPINE_HALF; const R = GANTRY_SPINE_RAIL; const [sy0, sy1] = GANTRY_SPINE_Y;
  const fl = rrectShape(H + R - GANTRY_TRAY_FRONT, sy1 - sy0, 6, (H + R + GANTRY_TRAY_FRONT) / 2, (sy0 + sy1) / 2);
  fl.holes.push(rrectHole(2 * FAN_OPEN, 404, 6, 0, 284));
  const fanY = L.fanMounts.map((m) => m.center[1]);
  // Slotted holes at every fan corner, for a fan or a radiator behind the flange.
  for (const y of fanY) for (const dy of [1, -1]) for (const s of [1, -1]) fl.holes.push(rrectHole(4.4, 9, 2.2, s * FAN_HOLE, y + dy * FAN_HOLE));
  fl.holes.push(circleHole(IO_Z, IO_BUTTON_Y, 6.4));
  for (const y of IO_PORTS_Y) fl.holes.push(rrectHole(9.6, 4.2, 1.6, IO_Z, y));
  pb.add(extrude(fl, x1 - GANTRY_SPINE_FACE, 0.8, 'xy', 12, 2), plate, new THREE.Matrix4().makeTranslation(x1, 0, 0).multiply(ZY));
  for (const s of [1, -1]) pb.add(rbox(GANTRY_SPINE_FACE - GANTRY_SPINE_IN, sy1 - sy0, R, 1.2, 2), plate, at((GANTRY_SPINE_IN + GANTRY_SPINE_FACE) / 2, (sy0 + sy1) / 2, s * (H + R / 2)));
  // Flat screws down the flange where it closes on the plate's edge.
  screwsAt(pb, SPINE_SCREWS_Y.map((y) => xf({ p: [x1 + 0.1, y, GANTRY_TRAY_FRONT + 4.5], r: [0, PI / 2, 0] })), 'flat', screwColor, 2.0);
  // The power button in a turned bezel and two ports on the flange; the wordmark down the flange below them.
  const faceX = { r: [0, PI / 2, 0] as [number, number, number] };
  pb.add(lathe([[0, -2.6], [5.4, -2.6], [5.4, 0.6], [4.9, 1.1], [0, 1.1]], 40), turned, xf({ p: [x1, IO_BUTTON_Y, IO_Z], ...faceX }));
  pb.add(lathe([[5.7, -2.8], [6.8, -2.8], [6.8, 0.3], [6.4, 0.6], [5.7, 0.6]], 40), 'nickel', xf({ p: [x1, IO_BUTTON_Y, IO_Z], ...faceX }));
  for (const y of IO_PORTS_Y) {
    pb.add(rbox(4, 4.6, 10, 0.4, 1), 'nickel', at(x1 - 2, y, IO_Z));
    pb.add(new THREE.BoxGeometry(0.5, 3.6, 8.8), 'darkVoid', at(x1 - 3.6, y, IO_Z), { uv: 'keep' });
    pb.add(rbox(3.4, 1.2, 6.4, 0.3, 1), 'plasticDark', at(x1 - 2.2, y, IO_Z));
  }
  labels.text(brandName(spec.brand).toUpperCase(), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 4.2, xf({ p: [x1 + 0.05, 250, IO_Z], r: [PI / 2, PI / 2, 0] }), { color: light ? '#7a7e87' : '#7b7f88', rough: 0.4 });

  // The slot bracket: a plate at the rear edge with seven openings, covers screwed to a ledge.
  const slotTop = anchor[1] - 155; const slotZ = anchor[2] + 55.1; const sp = K.slotPitch;
  const br = new THREE.Shape(); rrect(br, GANTRY_TRAY_BACK, slotTop - sp * 7 - 8, 40 - GANTRY_TRAY_BACK, sp * 7 + 14, 3);
  for (let k = 0; k < 7; k++) br.holes.push(rrectHole(112, sp - 4.6, 1.2, slotZ, slotTop - sp * (k + 0.5)));
  pb.add(extrude(br, 1.5, 0.5, 'xy', 8), plate, new THREE.Matrix4().makeTranslation(OUT_X0 + 1.5, 0, 0).multiply(ZY));
  const ledgeZ = slotZ + 62;
  pb.add(rbox(6, sp * 7 + 8, 7, 0.8, 2), plate, at(OUT_X0 - 3, slotTop - sp * 3.5, ledgeZ));
  for (let k = 0; k < 7; k++) {
    const cover = pb.group(`slot-cover-${k + 1}`, pb.root, at(OUT_X0 + 1.5, slotTop - sp * (k + 0.5), slotZ + 14));
    const sh = new THREE.Shape(); rrect(sh, -66, -sp / 2 + 0.6, 118, sp - 1.2, 1);
    for (let v = 0; v < 6; v++) sh.holes.push(rrectHole(10, 2.6, 1.2, -50 + v * 15, 0));
    pb.add(extrude(sh, 0.8, 0.15, 'xy', 4, 1), plate, new THREE.Matrix4().multiply(ZY).multiply(at(0, 0, -0.8)), { to: cover });
    pb.add(rbox(8, sp - 1.6, 0.8, 0.3, 1), plate, at(-4.2, 0, 50.5), { to: cover });
    movers[`slot-cover-${k + 1}`] = cover;
  }
  screwsAt(pb, Array.from({ length: 7 }, (_, k) => xf({ p: [OUT_X0 - 6.2, slotTop - sp * (k + 0.5), ledgeZ], r: [0, -PI / 2, 0] })), 'hex', screwColor, 2.6);

  // Glass pillars: turned posts with a waist groove, the rear two from the plate, the front two from the spine's rail.
  for (const [px, py] of GANTRY_PILLARS) {
    const z0 = px > 0 ? H + R : GANTRY_TRAY_FRONT; const len = GANTRY_GLASS_IN - z0 - 0.6;
    const r = GANTRY_PILLAR_R;
    pb.add(lathe([[0, 0], [r - 0.8, 0], [r, 0.8], [r, len / 2 - 2.2], [r - 0.9, len / 2 - 1.2], [r - 0.9, len / 2 + 1.2], [r, len / 2 + 2.2], [r, len - 0.8], [r - 0.8, len], [0, len]], 40), turned, at(px, py, z0));
  }

  return { movers, boxes: [], zones: [] };
}
