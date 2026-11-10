import * as THREE from 'three';
import { brandName, K, type CaseSpec } from '../../data/catalog';
import { ATRIUM_FLOOR, ATRIUM_REAR_IN, ATRIUM_TRAY_BACK, ATRIUM_TRAY_FRONT } from '../layout/cases/atrium';
import { HOLES_UNION } from '../layout/cases/vitrine';
import type { CaseLayout } from '../layout/types';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, rbox, rrect, rrectHole, rrectShape, torus, xf } from '../kit/geometry';
import type { Labels } from '../kit/labels';
import type { CaseFinish } from '../kit/materials';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { stripLeds, uvAlong, Zone } from '../light/zones';
import type { CaseBuild } from './case';
import { HOLES4, hexStandoffs, perforated, screwsAt, trayGrommets, ZY } from './caseKit';

const PI = Math.PI;

/**
 * Atrium: a dual chamber showcase on a low plinth. Glass on the left and the front meet at a corner with no pillar; the
 * supply and drives hide behind the board tray; the bottom fans sit in a basin under a perforated floor; a light strip runs
 * along the plinth under both glass sides. Coordinates come from its layout.
 */
export function atriumCase(pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string): CaseBuild {
  void finish;
  const movers: Record<string, THREE.Object3D> = {};
  const x0 = -227.5; const x1 = 227.5; const z0 = -145; const z1 = 145; const y1 = 470;
  const plinthTop = 10; const basin = 12; const topIn = 466;
  const trayF = ATRIUM_TRAY_FRONT; const trayB = ATRIUM_TRAY_BACK; const rearIn = ATRIUM_REAR_IN;
  const frontIn = 221.5; const glassIn = 141;
  const light = F.light;
  const screwColor = light ? 0xd4d6da : 0x26272b;
  const main = (trayF + glassIn) / 2;

  // Plinth: a hollow ring just inside the body's outline, so the perforated floor over the basin breathes through it, with
  // rubber pads under it and the light strip on its face.
  const pw = x1 - x0 - 10; const pd = z1 - z0 - 10; const rail = 14;
  for (const sz of [1, -1]) pb.add(rbox(pw, plinthTop, rail, 2.4, 3), F.accent, at(0, plinthTop / 2, sz * (pd / 2 - rail / 2)));
  for (const sx of [1, -1]) pb.add(rbox(rail, plinthTop, pd - 2 * rail + 2, 2.4, 3), F.accent, at(sx * (pw / 2 - rail / 2), plinthTop / 2, 0));
  for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) pb.add(cyl(14, 1.4, 'y', 32), F.foot, at(px * 190, 0.7, pz * 112));

  // Body floor over the plinth: solid under the second chamber, perforated under the bottom fans, which draw air through it.
  const bodyFloor = rrectShape(x1 - x0, z1 - z0, 3);
  bodyFloor.holes.push(rrectHole(396, 128, 6, 22, -main));
  pb.add(extrude(bodyFloor, 2, 0.5, 'xz', 8), F.inner, at(0, plinthTop, 0));
  perforated(pb, F, 398, 130, xf({ p: [22, plinthTop + 1, main], r: [-PI / 2, 0, 0] }), 2.5, undefined, 2.6);

  // Frame: posts at the three corners that are not glass, rails along the top and bottom of the solid sides.
  const e = 8;
  const H = y1 - plinthTop; const cy = (plinthTop + y1) / 2;
  for (const [x, z] of [[x0 + e / 2, z1 - e / 2], [x0 + e / 2, z0 + e / 2], [x1 - e / 2, z0 + e / 2]] as [number, number][]) pb.add(rbox(e, H, e, 2.4, 3), F.shell, at(x, cy, z));
  for (const y of [plinthTop + e / 2, y1 - e / 2]) {
    pb.add(rbox(e, e, z1 - z0 - 2 * e, 2.4, 3), F.shell, at(x0 + e / 2, y, 0));
    pb.add(rbox(x1 - x0 - 2 * e, e, e, 2.4, 3), F.shell, at(0, y, z0 + e / 2));
  }

  // Right side: a solid panel with a folded return over the second chamber.
  // Its front half carries an intake field over the side fans behind the tray: air comes in here, through the second
  // chamber and the fans into the main chamber.
  const rp = rrectShape(x1 - x0 - 4, H - 4, 3, 0, cy);
  rp.holes.push(rrectHole(126, 380, 6, 140, 224));
  pb.add(extrude(rp, 4.2, 1.6, 'xy', 12, 3), F.shell, at(0, 0, z0));
  perforated(pb, F, 128, 382, xf({ p: [140, 224, z0 + 1.2], r: [0, PI, 0] }), 2.5, undefined, 2.6);
  screwsAt(pb, [xf({ p: [x0 - 0.2, y1 - 30, -128], r: [0, -PI / 2, 0] }), xf({ p: [x0 - 0.2, plinthTop + 30, -128], r: [0, -PI / 2, 0] })], 'button', screwColor, 3.6);

  // Top: a thick plate, fine perforation over the fan mounts and a dust filter under it.
  const top = rrectShape(x1 - x0, z1 - z0, 5);
  top.holes.push(rrectHole(390, 126, 6, -13, -main));
  pb.add(extrude(top, 4, 1.2, 'xz', 12, 2), F.shell, at(0, topIn, 0));
  perforated(pb, F, 392, 128, xf({ p: [-13, y1 - 2, main], r: [-PI / 2, 0, 0] }), 2.5, undefined, 2.6);
  const filter = pb.mesh(new THREE.PlaneGeometry(387, 123), pb.own(new THREE.MeshPhysicalMaterial({ color: light ? 0x55585f : 0x07070a, roughness: 0.95, transparent: true, opacity: 0.85, depthWrite: false })), xf({ p: [-13, topIn + 1.2, main], r: [-PI / 2, 0, 0] }));
  filter.renderOrder = 2;
  for (const sz of [1, -1]) pb.add(rbox(420, 2.5, 12, 0.8, 2), F.inner, at(-13, topIn - 1.25, main + sz * 62));

  // Rear wall: connector block opening, seven slots, the exhaust fan's vent, the supply opening in the second chamber.
  const anchor = L.boardAnchor;
  const ioZ = anchor[2] + 22.6; const ioY = anchor[1] - 78;
  const slotTop = anchor[1] - 155; const slotZ = anchor[2] + 55.1; const sp = K.slotPitch;
  const fan = L.fanMounts.find((m) => m.id === 'rear-1')!;
  const rear = new THREE.Shape(); rrect(rear, z0 + 1, plinthTop + 1, z1 - z0 - 2, H - 2, 4);
  rear.holes.push(rrectHole(46, 152, 2, ioZ, ioY));
  for (let k = 0; k < 7; k++) rear.holes.push(rrectHole(112, sp - 4.6, 1.2, slotZ, slotTop - sp * (k + 0.5)));
  const ps = L.supply;
  rear.holes.push(rrectHole(90, 151, 3, ps.rearFace[2] + 43, ps.rearFace[1] + 1.5));
  rear.holes.push(circleHole(fan.center[2], fan.center[1], 57.5));
  for (const [dy, dz] of HOLES4) rear.holes.push(rrectHole(4.4, 9, 2.2, fan.center[2] + dz, fan.center[1] + dy));
  pb.add(extrude(rear, 1.5, 0.7, 'xy', 24), F.shell, new THREE.Matrix4().makeTranslation(x0 + 1.5, 0, 0).multiply(ZY));
  pb.add(new THREE.CircleGeometry(57.2, 64), F.mesh, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [0, -PI / 2, 0] }));
  for (const rr of [20, 34, 47]) pb.add(lathe([[rr - 0.9, -0.75], [rr + 0.9, -0.75], [rr + 0.9, 0.75], [rr - 0.9, 0.75]], 64), F.shell, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [0, PI / 2, 0] }));
  for (let i = 0; i < 4; i++) pb.add(rbox(1.5, 110, 1.8, 0.6, 1), F.shell, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [i * PI / 4, 0, 0] }));
  const ledgeZ = slotZ + 62;
  const ledge = pb.group('slot-ledge', pb.root);
  pb.add(rbox(6, sp * 7 + 8, 7, 0.8, 2), F.shell, at(x0 - 3, slotTop - sp * 3.5, ledgeZ), { to: ledge });
  for (let k = 0; k < 7; k++) {
    const cover = pb.group(`slot-cover-${k + 1}`, pb.root, at(x0 + 1.5, slotTop - sp * (k + 0.5), slotZ + 14));
    const sh = new THREE.Shape(); rrect(sh, -66, -sp / 2 + 0.6, 118, sp - 1.2, 1);
    for (let v = 0; v < 6; v++) sh.holes.push(rrectHole(10, 2.6, 1.2, -50 + v * 15, 0));
    pb.add(extrude(sh, 0.8, 0.15, 'xy', 4, 1), F.shell, new THREE.Matrix4().multiply(ZY).multiply(at(0, 0, -0.8)), { to: cover });
    pb.add(rbox(8, sp - 1.6, 0.8, 0.3, 1), F.shell, at(-4.2, 0, 50.5), { to: cover });
    movers[`slot-cover-${k + 1}`] = cover;
  }
  screwsAt(pb, Array.from({ length: 7 }, (_, k) => xf({ p: [x0 - 6.2, slotTop - sp * (k + 0.5), ledgeZ], r: [0, -PI / 2, 0] })), 'pan', screwColor, 2.6);
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [x0 - 0.1, ps.rearFace[1] + a! * 66, ps.rearFace[2] + 43 + b! * 36], r: [0, -PI / 2, 0] })), 'pan', screwColor, 2.4);
  labels.text(`${brandName(spec.brand).toUpperCase()} ${spec.name.toUpperCase()} · ATX · ${spec.size.d} × ${spec.size.w} × ${spec.size.h} MM`, TINY_TYPE, 2.4, xf({ p: [x0 - 0.1, 446, -50], r: [0, -PI / 2, 0] }), { color: light ? '#6a6e78' : '#8a8e97' });

  // Front of the second chamber: a solid upright beside the front glass with the power button, ports and the wordmark.
  const fz0 = -140.8; const fz1 = trayB;
  pb.add(rbox(6, H, fz1 - fz0, 2.8, 4), F.shell, at(frontIn + 3, cy, (fz0 + fz1) / 2));
  const io = pb.group('front-io', pb.root, at(x1, 420, (fz0 + fz1) / 2));
  pb.add(rbox(1.2, 70, 24, 3, 2), F.trim, at(0.3, 0, 0), { to: io });
  pb.add(lathe([[0, 0], [5.6, 0], [5.6, 1.6], [5.0, 2.2], [0, 2.2]], 40), F.accent, xf({ p: [0.6, 26, 0], r: [0, 0, -PI / 2] }), { to: io });
  pb.add(lathe([[5.7, 0], [6.4, 0], [6.4, 1.2], [5.7, 1.2]], 40), 'nickel', xf({ p: [0.6, 26, 0], r: [0, 0, -PI / 2] }), { to: io });
  for (const y of [8, -8]) { pb.add(rbox(0.6, 13.6, 6.4, 0.5, 1), 'nickel', at(0.95, y, 0), { to: io }); pb.add(new THREE.BoxGeometry(0.5, 12, 5), 'darkVoid', at(1.1, y, 0), { to: io, uv: 'keep' }); }
  pb.add(rbox(0.6, 9.4, 3.6, 1.6, 2), 'nickel', at(0.95, -22, 0), { to: io });
  pb.add(rbox(0.5, 8, 2.4, 1, 1), 'darkVoid', at(1.1, -22, 0), { to: io, uv: 'keep' });
  labels.text(brandName(spec.brand).toUpperCase(), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 3.6, xf({ p: [x1 + 0.05, 200, (fz0 + fz1) / 2], r: [0, PI / 2, PI / 2] }), { color: light ? '#7b7f88' : '#8d919a' });

  // Board tray: the full wall between the chambers, with grommets, the processor cutout and the side fan openings.
  const tray = new THREE.Shape(); rrect(tray, rearIn, basin, frontIn - rearIn, topIn - basin, 2);
  for (const gr of L.grommets) if (gr.normal[2] === 1) tray.holes.push(rrectHole(gr.size[0], gr.size[1], Math.min(7, gr.size[0] / 2 - 0.5, gr.size[1] / 2 - 0.5), gr.center[0], gr.center[1]));
  tray.holes.push(rrectHole(110, 96, 6, anchor[0] + 112, anchor[1] - 82));
  const sides = L.fanMounts.filter((m) => m.group === 'side');
  for (const m of sides) tray.holes.push(circleHole(m.center[0], m.center[1], 57));
  pb.add(extrude(tray, 1.2, 0.3, 'xy', 24), F.inner, at(0, 0, trayB));
  trayGrommets(pb, L, F, trayB);
  hexStandoffs(pb, HOLES_UNION, anchor, trayF, light);
  for (const m of sides) {
    // A rolled lip around each side opening and the fan screws through the tray, so the openings read as mounts.
    pb.add(torus(57.6, 1.3, 10, 72), light ? F.accent : 'aluGunmetal', at(m.center[0], m.center[1], trayF + 0.3));
  }
  screwsAt(pb, sides.flatMap((m) => HOLES4.map(([dx, dy]) => at(m.center[0] + dx, m.center[1] + dy, trayF))), 'pan', light ? 0xd4d6da : 0x8a8d94, 2.6);

  // Raised floor: a perforated plate over the fan basin, standing on the tray's foot and the glass rails.
  const fx0 = rearIn; const fx1 = frontIn; const fzA = trayF; const fzB = glassIn;
  const plate = rrectShape(fx1 - fx0, fzB - fzA, 3, (fx0 + fx1) / 2, -(fzA + fzB) / 2);
  plate.holes.push(rrectHole(fx1 - fx0 - 24, fzB - fzA - 24, 6, (fx0 + fx1) / 2, -(fzA + fzB) / 2));
  pb.add(extrude(plate, 2, 0.5, 'xz', 8), F.shell, at(0, ATRIUM_FLOOR - 2, 0));
  perforated(pb, F, fx1 - fx0 - 22, fzB - fzA - 22, xf({ p: [(fx0 + fx1) / 2, ATRIUM_FLOOR - 1.4, (fzA + fzB) / 2], r: [-PI / 2, 0, 0] }), 2.5, undefined, 2.6);
  for (const x of [fx0 + 30, (fx0 + fx1) / 2, fx1 - 30]) pb.add(rbox(8, ATRIUM_FLOOR - 2 - basin - 2, 8, 2, 2), F.inner, at(x, (ATRIUM_FLOOR - 2 + basin + 2) / 2, fzB - 8));
  // Basin rails under the bottom fans, with their screw rows.
  for (const sz of [1, -1]) pb.add(rbox(fx1 - fx0 - 10, 2, 10, 0.6, 2), F.inner, at((fx0 + fx1) / 2, basin + 1.5, main + sz * 52.5));

  // Second chamber: a bracket for the drives and a support under the supply's far end.
  pb.add(rbox(212, 2, 32, 0.6, 2), F.inner, at(108, basin + 2, -126));
  pb.add(rbox(2, 150, 32, 0.6, 2), F.inner, at(4, basin + 75, -126));
  pb.add(rbox(4, 6, 80, 1, 2), 'rubber', at(-10, basin + 3, -97));

  // Base light: a frosted strip set into the plinth's top edge under both glass sides, one zone from the rear left corner
  // around the glass corner to the front right.
  const a = { x0: x0 + 11, x1: x1 - 5.6, z0: z0 + 11, z1: z1 - 5.6, y: plinthTop / 2 };
  const lenL = a.x1 - a.x0; const lenF = a.z1 - a.z0; const split = lenL / (lenL + lenF);
  const leds = [...stripLeds(new THREE.Vector3(a.x0, a.y, a.z1), new THREE.Vector3(a.x1, a.y, a.z1), 7.2), ...stripLeds(new THREE.Vector3(a.x1, a.y, a.z1), new THREE.Vector3(a.x1, a.y, a.z0), 7.2).slice(1)];
  const zone = new Zone('case:atrium:base', 'case', false, leds, 0.1);
  const diff = zone.diffuser(0.5, light ? 0xd9dbe0 : 0x1d1e23, 0.86);
  const left = rbox(lenL, 3, 3.2, 1, 2); uvAlong(left, 'x');
  const front = rbox(3.2, 3, lenF, 1, 2); uvAlong(front, 'z');
  const lu = left.getAttribute('uv'); for (let i = 0; i < lu.count; i++) lu.setX(i, lu.getX(i) * split);
  const fu = front.getAttribute('uv'); for (let i = 0; i < fu.count; i++) fu.setX(i, split + (1 - split) * (1 - fu.getX(i)));
  pb.mesh(left, diff, at((a.x0 + a.x1) / 2, a.y, a.z1 + 0.6), { uv: 'keep' });
  pb.mesh(front, diff, at(a.x1 + 0.6, a.y, (a.z0 + a.z1) / 2), { uv: 'keep' });
  zone.emit(new THREE.Vector3(0, a.y, a.z1 + 2), new THREE.Vector3(0, -0.3, 1), lenL, 6, 0.9, new THREE.Vector3(1, 0, 0));
  zone.emit(new THREE.Vector3(a.x1 + 2, a.y, 0), new THREE.Vector3(1, -0.3, 0), lenF, 6, 0.9, new THREE.Vector3(0, 0, 1));

  return {
    movers,
    boxes: [
      { min: [x0 - 7, slotTop - sp * 7 - 4, ledgeZ - 7], max: [x0, slotTop + 4, ledgeZ + 7], tag: 'slot-ledge' },
      { min: [x0 - 1, plinthTop + 10, -134], max: [x0, y1 - 10, -122], tag: 'thumbscrew' },
    ],
    zones: [zone],
  };
}
