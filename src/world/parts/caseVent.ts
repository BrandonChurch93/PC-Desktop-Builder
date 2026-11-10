import * as THREE from 'three';
import { brandName, K, type CaseSpec } from '../../data/catalog';
import { HOLES_UNION } from '../layout/cases/vitrine';
import { VENT_ANCHOR, VENT_FAN_FACE, VENT_FLOOR, VENT_GLASS_IN, VENT_RAIL_TOP, VENT_REAR_IN, VENT_SHROUD, VENT_SHROUD_END, VENT_TOP_IN, VENT_TRAY_BACK, VENT_TRAY_FRONT } from '../layout/cases/vent';
import { DIMS } from '../layout/dims';
import type { CaseLayout } from '../layout/types';
import { at, circleHole, extrude, lathe, PartBuilder, rbox, rrect, rrectHole, rrectShape, torus, xf } from '../kit/geometry';
import type { Labels } from '../kit/labels';
import type { CaseFinish } from '../kit/materials';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import type { CaseBuild } from './case';
import { hexStandoffs, perforated, screwsAt, trayGrommets, ZY } from './caseKit';

const PI = Math.PI;

/** Coarse hexagonal front: cells across flats and the steel between them, in mm. */
const HEX_CELL = 11;
const HEX_WALL = 2;
/** How far the front bows out at its middle, over the case's full width. */
const BOW = 9.5;
const BOW_HZ = 115;
const bowAt = (z: number) => BOW * (1 - Math.min(1, (z / BOW_HZ) ** 2));
/** Back face of the front bezel, flat; its front face bows out from 10 mm ahead of it. */
const BEZEL_BACK = 218;
const BEZEL_DEPTH = 10;

/** A corner post with chamfered edges, the family's corner, standing from y0 to y1. */
export function chamferPost(pb: PartBuilder, mat: string, x: number, z: number, e: number, c: number, y0: number, y1: number) {
  const h = e / 2;
  const s = new THREE.Shape();
  const pts: [number, number][] = [[-h + c, -h], [h - c, -h], [h, -h + c], [h, h - c], [h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c]];
  pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)));
  s.closePath();
  pb.add(extrude(s, y1 - y0, 0.4, 'xz', 1, 1), mat as never, at(x, y0, z));
}

/**
 * The bowed hexagonal mesh front: one hex ring instanced per cell, each placed on the bow and turned to its tangent, so the
 * fans show through real holes with walls.
 */
export function hexFront(pb: PartBuilder, mat: string, xBase: number, hz: number, y0: number, y1: number, bowed = true, zMin?: number, zMax?: number) {
  const ro = HEX_CELL / Math.sqrt(3); const ri = (HEX_CELL - HEX_WALL) / Math.sqrt(3);
  const ring = new THREE.Shape(); const hole = new THREE.Path();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2 + PI / 6; const p = [Math.cos(a), Math.sin(a)] as const; if (k) { ring.lineTo(p[0] * ro, p[1] * ro); } else ring.moveTo(p[0] * ro, p[1] * ro); }
  for (let k = 0; k < 6; k++) { const a = -(k / 6) * PI * 2 + PI / 6; const p = [Math.cos(a), Math.sin(a)] as const; if (k) hole.lineTo(p[0] * ri, p[1] * ri); else hole.moveTo(p[0] * ri, p[1] * ri); }
  ring.closePath(); hole.closePath(); ring.holes.push(hole);
  const g = extrude(ring, 1.1, 0, 'xy', 1, 1);
  const dz = HEX_CELL; const dy = HEX_CELL * Math.sqrt(3) / 2;
  const mats: THREE.Matrix4[] = [];
  for (let j = 0; y0 + j * dy <= y1; j++) {
    const y = y0 + j * dy;
    const lo = zMin ?? -(hz + ro); const hi = zMax ?? hz + ro;
    for (let i = -Math.ceil(Math.abs(lo) / dz) - 1; i * dz <= hi + dz; i++) {
      const z = i * dz + (j % 2 ? dz / 2 : 0);
      if (z < lo || z > hi) continue;
      const x = xBase + (bowed ? bowAt(z) : 0);
      const slope = bowed && Math.abs(z) < BOW_HZ ? -2 * BOW * z / (BOW_HZ * BOW_HZ) : 0;
      // The cell's plane faces +x (out of the front), turned about y to the bow's tangent.
      const m = new THREE.Matrix4().makeRotationY(PI / 2 + Math.atan(slope)).setPosition(x, y, z);
      mats.push(m.multiply(new THREE.Matrix4().makeRotationZ(PI / 2)).multiply(at(0, 0, -0.55)));
    }
  }
  pb.instanced(g, mat as never, mats);
}

/**
 * Vent: Skarn's airflow tower. A bowed coarse hexagonal mesh front over three 140 mm fans, stamped ribs across the top
 * beside a perforated fan field, exposed hex head screws, chamfered corner posts, a stencil wordmark, and the glass carried
 * by a steel rail along its bottom edge. Coordinates come from its layout.
 */
export function ventCase(pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string): CaseBuild {
  void finish;
  const movers: Record<string, THREE.Object3D> = {};
  const x0 = -237.5; const x1 = 237.5; const z0 = -115; const z1 = 115; const y0 = 18; const y1 = 495;
  const W = x1 - x0; const D = z1 - z0; const H = y1 - y0; const cy = (y0 + y1) / 2;
  const light = F.light;
  const screwColor = light ? 0xc9ccd2 : 0x3a3d44;
  const rearIn = VENT_REAR_IN; const trayB = VENT_TRAY_BACK; const trayF = VENT_TRAY_FRONT;

  // Frame: chamfered corner posts and rails.
  const e = 10;
  const fx = BEZEL_BACK - e / 2 - 0.5;
  for (const [x, z] of [[x0 + e / 2, z1 - e / 2], [x0 + e / 2, z0 + e / 2], [fx, z1 - e / 2], [fx, z0 + e / 2]] as [number, number][]) chamferPost(pb, F.shell, x, z, e, 2.6, y0, y1);
  for (const y of [y0 + e / 2, y1 - e / 2]) {
    pb.add(rbox(fx - e / 2 - (x0 + e), e, e, 1.4, 2), F.shell, at((fx - e / 2 + x0 + e) / 2, y, z0 + e / 2));
    pb.add(rbox(e, e, D - 2 * e, 1.4, 2), F.shell, at(x0 + e / 2, y, 0));
  }

  // Right side: a solid steel panel with stamped ribs and exposed hex head screws at its corners.
  pb.add(rbox(BEZEL_BACK - (x0 + 2), H - 4, 3.5, 1.2, 3), F.shell, at((BEZEL_BACK + x0 + 2) / 2, cy, z0 + 1.75));
  for (let k = 0; k < 5; k++) pb.add(rbox(W - 80, 16, 2.6, 1.2, 4), F.shell, at(-3, cy - 160 + k * 80, z0 - 0.9));
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [a! > 0 ? BEZEL_BACK - 16 : x0 + 16, cy + b! * (H / 2 - 14), z0 - 0.3], r: [PI / 2, 0, 0] })), 'hex', screwColor, 4.2);

  // Floor with an intake under the supply.
  const floor = rrectShape(BEZEL_BACK - (x0 + 1), D - 2, 2, (BEZEL_BACK + x0 + 1) / 2, 0);
  floor.holes.push(rrectHole(150, 140, 6, -150, 30));
  pb.add(extrude(floor, 2, 0.5, 'xz', 8), F.inner, at(0, y0, 0));
  perforated(pb, F, 156, 146, xf({ p: [-150, y0 + 0.4, -30], r: [-PI / 2, 0, 0] }), 3, undefined, 2.0);

  // Top: a steel plate with a perforated field over the fan mounts and stamped ribs across it in front.
  const top = rrectShape(BEZEL_BACK - (x0 + 1), D - 2, 2, (BEZEL_BACK + x0 + 1) / 2, 0);
  top.holes.push(rrectHole(296, 138, 5, -49, -40));
  pb.add(extrude(top, 2.4, 0.6, 'xz', 8), F.shell, at(0, y1 - 2.4, 0));
  perforated(pb, F, 298, 140, xf({ p: [-49, y1 - 1.2, 40], r: [-PI / 2, 0, 0] }), 2.5, undefined, 2.6);
  // Stamped ribs across the top, in front of the fan field and behind it.
  for (const rx of [108, 121, 134, 147, 160, 173, 186, 199, -229, -217, -205]) pb.add(rbox(5, 1.6, 196, 2, 3), F.shell, at(rx, y1 + 0.3, 0));
  for (const sz of [1, -1]) pb.add(rbox(430, 2.5, 14, 0.8, 2), F.inner, at(-12, VENT_TOP_IN + 1.25, 40 + sz * 70));
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [a! > 0 ? BEZEL_BACK - 12 : x0 + 14, y1 + 0.1, b! * (D / 2 - 14)], r: [-PI / 2, 0, 0] })), 'hex', screwColor, 4.2);
  const io = pb.group('front-io', pb.root, at(205, y1, 0));
  pb.add(rbox(28, 1.2, 100, 2, 2), F.trim, at(0, 0.3, 0), { to: io });
  pb.add(lathe([[0, 0], [5.6, 0], [5.6, 1.6], [5.0, 2.2], [0, 2.2]], 40), F.accent, xf({ p: [0, 0.6, -38], r: [-PI / 2, 0, 0] }), { to: io });
  pb.add(lathe([[5.7, 0], [6.4, 0], [6.4, 1.2], [5.7, 1.2]], 40), 'nickel', xf({ p: [0, 0.6, -38], r: [-PI / 2, 0, 0] }), { to: io });
  for (const z of [-18, -2]) { pb.add(rbox(6.4, 0.6, 13.6, 0.5, 1), 'nickel', at(0, 0.95, z), { to: io }); pb.add(new THREE.BoxGeometry(5, 0.5, 12), 'darkVoid', at(0, 1.1, z), { to: io, uv: 'keep' }); }
  pb.add(rbox(3.6, 0.6, 9.4, 1.6, 2), 'nickel', at(0, 0.95, 13), { to: io });
  pb.add(rbox(2.4, 0.5, 8, 1, 1), 'darkVoid', at(0, 1.1, 13), { to: io, uv: 'keep' });

  // Rear wall: connector block, seven slots, the 140 mm exhaust, the supply opening, exposed hex screws.
  const anchor = VENT_ANCHOR;
  const ioZ = anchor[2] + 22.6; const ioY = anchor[1] - 78;
  const slotTop = anchor[1] - 155; const slotZ = anchor[2] + 55.1; const sp = K.slotPitch;
  const fan = L.fanMounts.find((m) => m.id === 'rear-1')!;
  const fh = DIMS.fan[140].holes / 2;
  const rear = new THREE.Shape(); rrect(rear, z0 + 1, y0 + 1, D - 2, H - 2, 3);
  rear.holes.push(rrectHole(46, 152, 2, ioZ, ioY));
  for (let k = 0; k < 7; k++) rear.holes.push(rrectHole(112, sp - 4.6, 1.2, slotZ, slotTop - sp * (k + 0.5)));
  rear.holes.push(rrectHole(146, 82, 3, -30, 64));
  rear.holes.push(circleHole(fan.center[2], fan.center[1], 67.5));
  for (const [dy, dz] of [[fh, fh], [fh, -fh], [-fh, fh], [-fh, -fh]]) rear.holes.push(rrectHole(4.4, 9, 2.2, fan.center[2] + dz!, fan.center[1] + dy!));
  pb.add(extrude(rear, 1.5, 0.6, 'xy', 24), F.shell, new THREE.Matrix4().makeTranslation(x0 + 1.5, 0, 0).multiply(ZY));
  // The exhaust grille: a hexagonal field like the front, flat.
  pb.add(new THREE.CircleGeometry(67.2, 64), F.mesh, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [0, -PI / 2, 0] }));
  for (const rr of [24, 40, 56]) pb.add(lathe([[rr - 1, -0.75], [rr + 1, -0.75], [rr + 1, 0.75], [rr - 1, 0.75]], 64), F.shell, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [0, PI / 2, 0] }));
  for (let i = 0; i < 3; i++) pb.add(rbox(1.5, 130, 2, 0.6, 1), F.shell, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [i * PI / 3, 0, 0] }));
  const ledgeZ = slotZ + 62;
  const ledge = pb.group('slot-ledge', pb.root);
  pb.add(rbox(6, sp * 7 + 8, 7, 0.8, 2), F.shell, at(x0 - 3, slotTop - sp * 3.5, ledgeZ), { to: ledge });
  for (let k = 0; k < 7; k++) {
    const cover = pb.group(`slot-cover-${k + 1}`, pb.root, at(x0 + 1.5, slotTop - sp * (k + 0.5), slotZ + 14));
    const sh = new THREE.Shape(); rrect(sh, -66, -sp / 2 + 0.6, 118, sp - 1.2, 1);
    for (let v = 0; v < 9; v++) sh.holes.push(rrectHole(6.2, 6.2 * 0.866, 1.4, -54 + v * 11, 0));
    pb.add(extrude(sh, 0.8, 0.15, 'xy', 4, 1), F.shell, new THREE.Matrix4().multiply(ZY).multiply(at(0, 0, -0.8)), { to: cover });
    pb.add(rbox(8, sp - 1.6, 0.8, 0.3, 1), F.shell, at(-4.2, 0, 50.5), { to: cover });
    movers[`slot-cover-${k + 1}`] = cover;
  }
  screwsAt(pb, Array.from({ length: 7 }, (_, k) => xf({ p: [x0 - 6.2, slotTop - sp * (k + 0.5), ledgeZ], r: [0, -PI / 2, 0] })), 'hex', screwColor, 2.6);
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [x0 - 0.1, 64 + a! * 36, -30 + b! * 66], r: [0, -PI / 2, 0] })), 'hex', screwColor, 2.4);
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [x0 - 0.1, cy + a! * (H / 2 - 12), b! * (D / 2 - 12)], r: [0, -PI / 2, 0] })), 'hex', screwColor, 2.8);
  labels.text(`${brandName(spec.brand).toUpperCase()} ${spec.name.toUpperCase()} · ATX · ${spec.size.d} × ${spec.size.w} × ${spec.size.h} MM`, TINY_TYPE, 2.2, xf({ p: [x0 - 0.1, 470, -30], r: [0, -PI / 2, 0] }), { color: light ? '#5d616b' : '#8a8e97' });

  // Front: a chamfered frame around the bowed hexagonal mesh, the fan bracket behind it, the stencil wordmark under it.
  const frontX = BEZEL_BACK + BEZEL_DEPTH;
  const fr = new THREE.Shape();
  const c = 8;
  const fpts: [number, number][] = [[z0 + c, y0 + 1], [z1 - c, y0 + 1], [z1, y0 + 1 + c], [z1, y1 - 1 - c], [z1 - c, y1 - 1], [z0 + c, y1 - 1], [z0, y1 - 1 - c], [z0, y0 + 1 + c]];
  fpts.forEach(([a, b], i) => (i ? fr.lineTo(a, b) : fr.moveTo(a, b)));
  fr.closePath();
  const hz = (D - 34) / 2; const my0 = y0 + 22; const my1 = y1 - 14;
  fr.holes.push(rrectHole(2 * hz, my1 - my0, 6, 0, (my0 + my1) / 2));
  const bezel = extrude(fr, BEZEL_DEPTH, 1.2, 'xy', 8, 2);
  bezel.applyMatrix4(new THREE.Matrix4().makeTranslation(frontX, 0, 0).multiply(ZY));
  // The bezel's front face bows; its back face stays flat against the posts and panels.
  const bp = bezel.getAttribute('position');
  for (let i = 0; i < bp.count; i++) { const k = THREE.MathUtils.clamp((bp.getX(i) - BEZEL_BACK) / BEZEL_DEPTH, 0, 1); bp.setX(i, bp.getX(i) + k * bowAt(bp.getZ(i))); }
  bezel.computeVertexNormals();
  pb.add(bezel, F.shell);
  hexFront(pb, F.shell, frontX - 2, hz + 3, my0 - 3, my1 + 3);
  // A fine filter behind the coarse mesh, as airflow fronts carry: it takes some light off the fans without hiding them.
  const filt = pb.mesh(new THREE.PlaneGeometry(2 * hz + 4, my1 - my0 + 4), pb.own(new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.95, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })), xf({ p: [frontX - 5.5, (my0 + my1) / 2, 0], r: [0, PI / 2, 0] }));
  filt.renderOrder = 2;
  labels.text(brandName(spec.brand).toUpperCase(), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 6, xf({ p: [x1 + 0.05, y0 + 11, 0], r: [0, PI / 2, 0] }), { color: light ? '#4a4e57' : '#9a9ea8' });
  const br = new THREE.Shape(); rrect(br, -72, y0 + 4, 144, H - 10, 4);
  br.holes.push(rrectHole(112, H - 38, 3, 0, y0 + 4 + (H - 10) / 2));
  pb.add(extrude(br, 1.5, 0.2, 'xy', 24, 1), F.inner, new THREE.Matrix4().makeTranslation(VENT_FAN_FACE + 2, 0, 0).multiply(ZY));
  for (const m of L.fanMounts.filter((f) => f.group === 'front')) for (const [dy, dz] of [[fh, fh], [fh, -fh], [-fh, fh], [-fh, -fh]]) pb.add(torus(2.5, 0.55, 8, 24), 'steelZinc', xf({ p: [VENT_FAN_FACE + 2.1, m.center[1] + dy!, dz!], r: [0, PI / 2, 0] }));

  // Board tray with grommets, the processor cutout and standoffs.
  const tray = new THREE.Shape(); rrect(tray, rearIn, VENT_SHROUD, 186 - rearIn, VENT_TOP_IN - VENT_SHROUD, 2);
  for (const gr of L.grommets) if (gr.normal[2] === 1) tray.holes.push(rrectHole(gr.size[0], gr.size[1], Math.min(7, gr.size[0] / 2 - 0.5, gr.size[1] / 2 - 0.5), gr.center[0], gr.center[1]));
  tray.holes.push(rrectHole(110, 96, 6, anchor[0] + 112, anchor[1] - 82));
  pb.add(extrude(tray, 1.2, 0.3, 'xy', 12), F.inner, at(0, 0, trayB));
  trayGrommets(pb, L, F, trayB);
  hexStandoffs(pb, HOLES_UNION, anchor, trayF, light);

  // Supply shroud: slotted vents, the graphics cable cutout with a rubber ring, the stencil wordmark on its glass side.
  const sx0 = rearIn; const sx1 = VENT_SHROUD_END; const sz0 = -111; const sz1 = 108;
  const st = new THREE.Shape(); rrect(st, sx0, -sz1, sx1 - sx0, sz1 - sz0, 2);
  for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 9; k++) st.holes.push(rrectHole(15, 4.6, 2.3, -200 + k * 19, -(-14 - rr * 12)));
  const gc = L.grommets.find((g) => g.id === 'gpu');
  if (gc) st.holes.push(rrectHole(gc.size[0], gc.size[1], 8, gc.center[0], -gc.center[2]));
  pb.add(extrude(st, 1.5, 0.45, 'xy', 12), F.shell, new THREE.Matrix4().makeTranslation(0, 116.5, 0).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
  if (gc) {
    const ring = rrectShape(gc.size[0] + 6, gc.size[1] + 6, 10, gc.center[0], -gc.center[2]);
    ring.holes.push(rrectHole(gc.size[0] - 2, gc.size[1] - 2, 7, gc.center[0], -gc.center[2]));
    pb.add(extrude(ring, 2.8, 0.9, 'xy', 12, 2), F.foot, new THREE.Matrix4().makeTranslation(0, 117.2, 0).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
  }
  pb.add(rbox(sz1 - sz0, 98, 1.5, 0.5, 2), F.shell, xf({ p: [sx1 - 0.75, 67.5, (sz0 + sz1) / 2], r: [0, PI / 2, 0] }));
  pb.add(rbox(sx1 - 1.5 - sx0, 96.5, 1.5, 0.5, 2), F.shell, at((sx0 + sx1 - 1.5) / 2, VENT_FLOOR + 48.25, 107.25));
  labels.text(brandName(spec.brand).toUpperCase(), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 12, at(-110, 68, 108.1), { color: light ? '#3a3e46' : '#a3a7b0' });
  screwsAt(pb, [-220, -60, 100].map((x) => xf({ p: [x, 104, 108.1] })), 'hex', screwColor, 2.4);

  // Drive cage under the shroud: three sleds on two shelves.
  pb.add(rbox(163, 94, 2, 0.6, 2), F.inner, at(71.5, 67, -13));
  pb.add(rbox(2, 94, 118, 0.6, 2), F.inner, at(-11, 67, 45));
  for (const y of [51, 82]) pb.add(rbox(163, 2, 116, 0.6, 2), F.inner, at(71.5, y, 46));
  const sled = 'plasticGrey';
  for (const bay of L.bays35) {
    const y = bay.pose.pos[1];
    for (const s of [-1, 1]) pb.add(rbox(150, 6, 4, 0.8, 2), sled, at(72, y + 3, 46 + s * 53));
    pb.add(rbox(4, 8, 14, 1.6, 2), sled, at(149, y + 4, 46));
  }
  for (const bay of L.bays25) pb.add(rbox(74, 104, 1.0, 0.6, 2), F.inner, at(bay.pose.pos[0], bay.pose.pos[1] + 50, trayB - 0.5));

  // The glass's bottom rail: a steel channel along the case with exposed hex screws.
  pb.add(rbox(458, VENT_RAIL_TOP - VENT_FLOOR, 9, 1.2, 2), F.accent, at(-5.5, (VENT_FLOOR + VENT_RAIL_TOP) / 2, 110.5));
  screwsAt(pb, [-200, -90, 20, 130].map((x) => xf({ p: [x, (VENT_FLOOR + VENT_RAIL_TOP) / 2, 115.05] })), 'hex', screwColor, 2.4);
  void VENT_GLASS_IN;

  // Feet: two steel runners with rubber pads.
  for (const fx of [-182, 182]) {
    pb.add(rbox(60, 14, 204, 3, 3), F.accent, at(fx, 11, 0));
    pb.add(rbox(52, 4, 196, 1.6, 2), F.foot, at(fx, 2, 0));
  }

  return {
    movers,
    boxes: [
      { min: [x0 - 7, slotTop - sp * 7 - 4, ledgeZ - 7], max: [x0, slotTop + 4, ledgeZ + 7], tag: 'slot-ledge' },
    ],
    zones: [],
  };
}
