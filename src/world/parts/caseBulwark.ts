import * as THREE from 'three';
import { brandName, K, type CaseSpec } from '../../data/catalog';
import { BULWARK_ANCHOR, BULWARK_BEZEL_BACK, BULWARK_FAN_FACE, BULWARK_FLOOR, BULWARK_GLASS_IN, BULWARK_REAR_IN, BULWARK_SHROUD, BULWARK_SHROUD_END, BULWARK_TOP_IN, BULWARK_TRAY_BACK, BULWARK_TRAY_FRONT } from '../layout/cases/bulwark';
import { HOLES_UNION } from '../layout/cases/vitrine';
import { DIMS } from '../layout/dims';
import type { CaseLayout } from '../layout/types';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, rbox, rrect, rrectHole, rrectShape, torus, xf } from '../kit/geometry';
import type { Labels } from '../kit/labels';
import type { CaseFinish } from '../kit/materials';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { fadeEnds, spillStrip, stripLeds, uvAlong, Zone } from '../light/zones';
import type { CaseBuild } from './case';
import { hexStandoffs, perforated, screwsAt, trayGrommets, ZY } from './caseKit';
import { chamferPost, hexFront } from './caseVent';

const PI = Math.PI;
/** Width of the front's solid center spine, which carries the light bar. */
const SPINE = 44;

/**
 * Bulwark: Skarn's full tower. The front is a chamfered bezel with a solid center spine carrying a vertical light bar and
 * two coarse hex intakes either side; the top carries stamped ribs and a fan field; the glass is a large door on two hinges
 * at its rear edge; four drive sleds stand open to the glass in the front of the lower chamber; two fans stand on the
 * shroud floor. Exposed hex screws throughout. Coordinates come from its layout.
 */
export function bulwarkCase(pb: PartBuilder, labels: Labels, spec: CaseSpec, L: CaseLayout, F: CaseFinish, finish: string): CaseBuild {
  void finish;
  const movers: Record<string, THREE.Object3D> = {};
  const x0 = -280; const z0 = -122.5; const z1 = 122.5; const y0 = 18; const y1 = 590;
  const D = z1 - z0; const H = y1 - y0; const cy = (y0 + y1) / 2;
  const light = F.light;
  const screwColor = light ? 0xc9ccd2 : 0x3a3d44;
  const rearIn = BULWARK_REAR_IN; const trayB = BULWARK_TRAY_BACK; const trayF = BULWARK_TRAY_FRONT;
  const bezelBack = BULWARK_BEZEL_BACK;

  // Frame: chamfered corner posts and rails.
  const e = 11;
  const fx = bezelBack - e / 2 - 0.5;
  for (const [x, z] of [[x0 + e / 2, z1 - e / 2], [x0 + e / 2, z0 + e / 2], [fx, z1 - e / 2], [fx, z0 + e / 2]] as [number, number][]) chamferPost(pb, F.shell, x, z, e, 3, y0, y1);
  for (const y of [y0 + e / 2, y1 - e / 2]) {
    pb.add(rbox(fx - e / 2 - (x0 + e), e, e, 1.4, 2), F.shell, at((fx - e / 2 + x0 + e) / 2, y, z0 + e / 2));
    pb.add(rbox(e, e, D - 2 * e, 1.4, 2), F.shell, at(x0 + e / 2, y, 0));
  }

  // Right side: a solid panel with stamped ribs and large hex screws.
  pb.add(rbox(bezelBack - (x0 + 2), H - 4, 3.5, 1.2, 3), F.shell, at((bezelBack + x0 + 2) / 2, cy, z0 + 1.75));
  for (let k = 0; k < 6; k++) pb.add(rbox(bezelBack - x0 - 90, 18, 5, 1.8, 4), F.shell, at((bezelBack + x0) / 2, cy - 225 + k * 90, z0 - 1.6));
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [a! > 0 ? bezelBack - 18 : x0 + 18, cy + b! * (H / 2 - 16), z0 - 0.3], r: [PI / 2, 0, 0] })), 'hex', screwColor, 4.2);

  // Floor with an intake under the supply.
  const floor = rrectShape(bezelBack - (x0 + 1), D - 2, 2, (bezelBack + x0 + 1) / 2, 0);
  floor.holes.push(rrectHole(150, 140, 6, -190, 30));
  pb.add(extrude(floor, 2, 0.5, 'xz', 8), F.inner, at(0, y0, 0));
  perforated(pb, F, 156, 146, xf({ p: [-190, y0 + 0.4, -30], r: [-PI / 2, 0, 0] }), 3, undefined, 2.0);

  // Top: a steel plate with a perforated field over the fans, stamped ribs across it in front and behind, ports in front.
  const top = rrectShape(bezelBack - (x0 + 1), D - 2, 2, (bezelBack + x0 + 1) / 2, 0);
  top.holes.push(rrectHole(450, 148, 5, -6, -30));
  pb.add(extrude(top, 2.4, 0.6, 'xz', 8), F.shell, at(0, y1 - 2.4, 0));
  perforated(pb, F, 452, 150, xf({ p: [-6, y1 - 1.2, 30], r: [-PI / 2, 0, 0] }), 2.5, undefined, 2.6);
  for (const rx of [-272, -262, 233, 243]) pb.add(rbox(5, 1.6, 208, 2, 3), F.shell, at(rx, y1 + 0.3, 0));
  for (const sz of [1, -1]) pb.add(rbox(520, 2.5, 14, 0.8, 2), F.inner, at(-14, BULWARK_TOP_IN + 1.25, 30 + sz * 80));
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [a! > 0 ? bezelBack - 12 : x0 + 14, y1 + 0.1, b! * (D / 2 - 14)], r: [-PI / 2, 0, 0] })), 'hex', screwColor, 4.2);
  const io = pb.group('front-io', pb.root, at(234, y1, -60));
  pb.add(rbox(24, 1.2, 100, 2, 2), F.trim, at(0, 0.3, 0), { to: io });
  pb.add(lathe([[0, 0], [5.6, 0], [5.6, 1.6], [5.0, 2.2], [0, 2.2]], 40), F.accent, xf({ p: [0, 0.6, -38], r: [-PI / 2, 0, 0] }), { to: io });
  pb.add(lathe([[5.7, 0], [6.4, 0], [6.4, 1.2], [5.7, 1.2]], 40), 'nickel', xf({ p: [0, 0.6, -38], r: [-PI / 2, 0, 0] }), { to: io });
  for (const z of [-18, -2, 14]) { pb.add(rbox(6.4, 0.6, 13.6, 0.5, 1), 'nickel', at(0, 0.95, z), { to: io }); pb.add(new THREE.BoxGeometry(5, 0.5, 12), 'darkVoid', at(0, 1.1, z), { to: io, uv: 'keep' }); }
  pb.add(rbox(3.6, 0.6, 9.4, 1.6, 2), 'nickel', at(0, 0.95, 30), { to: io });
  pb.add(rbox(2.4, 0.5, 8, 1, 1), 'darkVoid', at(0, 1.1, 30), { to: io, uv: 'keep' });

  // Rear wall: connector block, eight slots, the 140 mm exhaust, the supply opening, hex screws.
  const anchor = BULWARK_ANCHOR;
  const ioZ = anchor[2] + 22.6; const ioY = anchor[1] - 78;
  const slotTop = anchor[1] - 155; const slotZ = anchor[2] + 55.1; const sp = K.slotPitch; const slots = 8;
  const fan = L.fanMounts.find((m) => m.id === 'rear-1')!;
  const fh = DIMS.fan[140].holes / 2;
  const rear = new THREE.Shape(); rrect(rear, z0 + 1, y0 + 1, D - 2, H - 2, 3);
  rear.holes.push(rrectHole(46, 152, 2, ioZ, ioY));
  for (let k = 0; k < slots; k++) rear.holes.push(rrectHole(112, sp - 4.6, 1.2, slotZ, slotTop - sp * (k + 0.5)));
  rear.holes.push(rrectHole(146, 82, 3, -30, 64));
  rear.holes.push(circleHole(fan.center[2], fan.center[1], 67.5));
  for (const [dy, dz] of [[fh, fh], [fh, -fh], [-fh, fh], [-fh, -fh]]) rear.holes.push(rrectHole(4.4, 9, 2.2, fan.center[2] + dz!, fan.center[1] + dy!));
  pb.add(extrude(rear, 1.5, 0.6, 'xy', 24), F.shell, new THREE.Matrix4().makeTranslation(x0 + 1.5, 0, 0).multiply(ZY));
  pb.add(new THREE.CircleGeometry(67.2, 64), F.mesh, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [0, -PI / 2, 0] }));
  for (const rr of [24, 40, 56]) pb.add(lathe([[rr - 1, -0.75], [rr + 1, -0.75], [rr + 1, 0.75], [rr - 1, 0.75]], 64), F.shell, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [0, PI / 2, 0] }));
  for (let i = 0; i < 3; i++) pb.add(rbox(1.5, 130, 2, 0.6, 1), F.shell, xf({ p: [x0 + 0.75, fan.center[1], fan.center[2]], r: [i * PI / 3, 0, 0] }));
  const ledgeZ = slotZ + 62;
  const ledge = pb.group('slot-ledge', pb.root);
  pb.add(rbox(6, sp * slots + 8, 7, 0.8, 2), F.shell, at(x0 - 3, slotTop - sp * slots / 2, ledgeZ), { to: ledge });
  for (let k = 0; k < slots; k++) {
    const cover = pb.group(`slot-cover-${k + 1}`, pb.root, at(x0 + 1.5, slotTop - sp * (k + 0.5), slotZ + 14));
    const sh = new THREE.Shape(); rrect(sh, -66, -sp / 2 + 0.6, 118, sp - 1.2, 1);
    for (let v = 0; v < 9; v++) sh.holes.push(rrectHole(6.2, 6.2 * 0.866, 1.4, -54 + v * 11, 0));
    pb.add(extrude(sh, 0.8, 0.15, 'xy', 4, 1), F.shell, new THREE.Matrix4().multiply(ZY).multiply(at(0, 0, -0.8)), { to: cover });
    pb.add(rbox(8, sp - 1.6, 0.8, 0.3, 1), F.shell, at(-4.2, 0, 50.5), { to: cover });
    movers[`slot-cover-${k + 1}`] = cover;
  }
  screwsAt(pb, Array.from({ length: slots }, (_, k) => xf({ p: [x0 - 6.2, slotTop - sp * (k + 0.5), ledgeZ], r: [0, -PI / 2, 0] })), 'hex', screwColor, 2.6);
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [x0 - 0.1, 64 + a! * 36, -30 + b! * 66], r: [0, -PI / 2, 0] })), 'hex', screwColor, 2.4);
  screwsAt(pb, [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => xf({ p: [x0 - 0.1, cy + a! * (H / 2 - 14), b! * (D / 2 - 14)], r: [0, -PI / 2, 0] })), 'hex', screwColor, 4.2);
  labels.text(`${brandName(spec.brand).toUpperCase()} ${spec.name.toUpperCase()} · E-ATX · ${spec.size.d} × ${spec.size.w} × ${spec.size.h} MM`, TINY_TYPE, 2.4, xf({ p: [x0 - 0.1, 566, -30], r: [0, -PI / 2, 0] }), { color: light ? '#5d616b' : '#8a8e97' });

  // Front: a chamfered bezel, a solid spine down its middle with the light bar, coarse hex intakes either side.
  const bezelD = 12; const frontX = bezelBack + bezelD;
  const c = 9;
  const fr = new THREE.Shape();
  const fpts: [number, number][] = [[z0 + c, y0 + 1], [z1 - c, y0 + 1], [z1, y0 + 1 + c], [z1, y1 - 1 - c], [z1 - c, y1 - 1], [z0 + c, y1 - 1], [z0, y1 - 1 - c], [z0, y0 + 1 + c]];
  fpts.forEach(([a, b], i) => (i ? fr.lineTo(a, b) : fr.moveTo(a, b)));
  fr.closePath();
  const my0 = y0 + 26; const my1 = y1 - 16; const side = 14;
  const iw = D / 2 - SPINE / 2 - side;
  for (const s of [1, -1]) fr.holes.push(rrectHole(iw, my1 - my0, 4, s * (SPINE / 2 + iw / 2), (my0 + my1) / 2));
  pb.add(extrude(fr, bezelD, 1.4, 'xy', 8, 2), F.shell, new THREE.Matrix4().makeTranslation(frontX, 0, 0).multiply(ZY));
  for (const s of [1, -1]) hexFront(pb, F.shell, frontX - 3, D / 2, my0 - 2, my1 + 2, false, s > 0 ? SPINE / 2 - 2 : -(SPINE / 2 + iw + 2), s > 0 ? SPINE / 2 + iw + 2 : -(SPINE / 2 - 2));
  const filt = pb.mesh(new THREE.PlaneGeometry(D - 30, my1 - my0 + 4), pb.own(new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.95, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })), xf({ p: [frontX - 8, (my0 + my1) / 2, 0], r: [0, PI / 2, 0] }));
  filt.renderOrder = 2;
  labels.text(brandName(spec.brand).toUpperCase(), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 6.5, xf({ p: [frontX + 0.05, y0 + 12, 0], r: [0, PI / 2, 0] }), { color: light ? '#4a4e57' : '#9a9ea8' });
  const br = new THREE.Shape(); rrect(br, -78, y0 + 4, 156, H - 10, 4);
  br.holes.push(rrectHole(122, H - 38, 3, 0, y0 + 4 + (H - 10) / 2));
  pb.add(extrude(br, 1.5, 0.2, 'xy', 24, 1), F.inner, new THREE.Matrix4().makeTranslation(BULWARK_FAN_FACE + 2, 0, 0).multiply(ZY));
  for (const m of L.fanMounts.filter((f) => f.group === 'front')) for (const [dy, dz] of [[fh, fh], [fh, -fh], [-fh, fh], [-fh, -fh]]) pb.add(torus(2.5, 0.55, 8, 24), 'steelZinc', xf({ p: [BULWARK_FAN_FACE + 2.1, m.center[1] + dy!, dz!], r: [0, PI / 2, 0] }));

  // The spine's light bar: a frosted strip down the spine's face, one zone, bottom to top.
  const ly0 = my0 + 20; const ly1 = my1 - 20;
  const zone = new Zone('case:bulwark:spine', 'case', false, stripLeds(new THREE.Vector3(frontX, ly0, 0), new THREE.Vector3(frontX, ly1, 0), 7.2), 0.3);
  const bar = rbox(3.2, ly1 - ly0, 7, 1.2, 2); uvAlong(bar, 'y');
  pb.mesh(bar, zone.diffuser(0.5, light ? 0xd9dbe0 : 0x1d1e23, 0.86), at(frontX + 0.9, (ly0 + ly1) / 2, 0), { uv: 'keep' });
  pb.add(rbox(1.2, ly1 - ly0 + 8, 11, 0.5, 2), F.accent, at(frontX + 0.2, (ly0 + ly1) / 2, 0));
  zone.emit(new THREE.Vector3(frontX + 3, (ly0 + ly1) / 2, 0), new THREE.Vector3(1, 0, 0), ly1 - ly0, 10, 0.9, new THREE.Vector3(0, 1, 0));
  // Its light on the spine's face either side of it, so the bar lights its channel and not only itself (critic 271).
  for (const sd of [1, -1]) {
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, sd), new THREE.Vector3(sd, 0, 0)).setPosition(frontX + 0.15, (ly0 + ly1) / 2, -sd * 4);
    pb.mesh(fadeEnds(spillStrip(ly1 - ly0, SPINE / 2 - 4, 24), 20), pb.own(Object.assign(zone.spill(1.4).clone(), { vertexColors: true })), m, { uv: 'keep' }).userData.spill = true;
  }

  // Board tray with grommets, the processor cutout and standoffs.
  const tray = new THREE.Shape(); rrect(tray, rearIn, BULWARK_SHROUD, 215 - rearIn, BULWARK_TOP_IN - BULWARK_SHROUD, 2);
  for (const gr of L.grommets) if (gr.normal[2] === 1) tray.holes.push(rrectHole(gr.size[0], gr.size[1], Math.min(7, gr.size[0] / 2 - 0.5, gr.size[1] / 2 - 0.5), gr.center[0], gr.center[1]));
  tray.holes.push(rrectHole(110, 96, 6, anchor[0] + 112, anchor[1] - 82));
  pb.add(extrude(tray, 1.2, 0.3, 'xy', 12), F.inner, at(0, 0, trayB));
  trayGrommets(pb, L, F, trayB);
  hexStandoffs(pb, HOLES_UNION, anchor, trayF, light);

  // Shroud: a floor over the whole lower chamber that the two bottom fans stand on, over a fan cutout each; its glass side
  // wall covers only the supply, so the drive sleds in front stand open to the glass.
  const sx0 = rearIn; const sx1 = BULWARK_SHROUD_END; const sz0 = -118.5; const sz1 = 115;
  const st = new THREE.Shape(); rrect(st, sx0, -sz1, sx1 - sx0, sz1 - sz0, 2);
  for (const m of L.fanMounts.filter((f) => f.group === 'bottom')) st.holes.push(circleHole(m.center[0], -m.center[2], 66));
  const gc = L.grommets.find((g) => g.id === 'gpu');
  if (gc) st.holes.push(rrectHole(gc.size[0], gc.size[1], 8, gc.center[0], -gc.center[2]));
  pb.add(extrude(st, 1.5, 0.45, 'xy', 12), F.shell, new THREE.Matrix4().makeTranslation(0, BULWARK_SHROUD - 1.5, 0).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
  for (const m of L.fanMounts.filter((f) => f.group === 'bottom')) {
    // Each opening carries a hex grille, a rolled lip and the fan's four hex screws through the shroud.
    pb.add(torus(66.6, 1.2, 10, 72), F.accent, xf({ p: [m.center[0], BULWARK_SHROUD + 0.2, m.center[2]], r: [PI / 2, 0, 0] }));
    pb.add(new THREE.CircleGeometry(65.6, 64), F.mesh, xf({ p: [m.center[0], BULWARK_SHROUD - 0.8, m.center[2]], r: [-PI / 2, 0, 0] }));
    for (const rr of [24, 45]) pb.add(lathe([[rr - 1, -0.6], [rr + 1, -0.6], [rr + 1, 0.6], [rr - 1, 0.6]], 64), F.shell, xf({ p: [m.center[0], BULWARK_SHROUD - 0.8, m.center[2]] }));
    const h = DIMS.fan[140].holes / 2;
    screwsAt(pb, [[h, h], [h, -h], [-h, h], [-h, -h]].map(([a, b]) => xf({ p: [m.center[0] + a!, BULWARK_SHROUD + 0.05, m.center[2] + b!], r: [-PI / 2, 0, 0] })), 'hex', screwColor, 2.6);
  }
  if (gc) {
    const ring = rrectShape(gc.size[0] + 6, gc.size[1] + 6, 10, gc.center[0], -gc.center[2]);
    ring.holes.push(rrectHole(gc.size[0] - 2, gc.size[1] - 2, 7, gc.center[0], -gc.center[2]));
    pb.add(extrude(ring, 2.8, 0.9, 'xy', 12, 2), F.foot, new THREE.Matrix4().makeTranslation(0, BULWARK_SHROUD + 0.7, 0).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
  }
  pb.add(rbox(-22 - sx0, BULWARK_SHROUD - 1.5 - BULWARK_FLOOR, 1.5, 0.5, 2), F.shell, at((sx0 - 22) / 2, (BULWARK_SHROUD - 1.5 + BULWARK_FLOOR) / 2, 114.25));
  pb.add(rbox(1.5, BULWARK_SHROUD - 1.5 - BULWARK_FLOOR, sz1 - sz0, 0.5, 2), F.shell, at(-21, (BULWARK_SHROUD - 1.5 + BULWARK_FLOOR) / 2, (sz0 + sz1) / 2));
  labels.text(brandName(spec.brand).toUpperCase(), BRAND_TYPE[spec.brand] ?? SPEC_TYPE, 14, at(-150, 90, 115.1), { color: light ? '#3a3e46' : '#a3a7b0' });
  screwsAt(pb, [-262, -150, -40].map((x) => xf({ p: [x, 148, 115.1] })), 'hex', screwColor, 2.4);
  pb.add(rbox(sx1 - sx0, 3, 3, 0.8, 1), F.accent, at((sx0 + sx1) / 2, BULWARK_SHROUD - 3, 113.5));

  // Drive cage: four tool-less sleds between two side plates, open to the glass.
  for (const x of [29, 181]) pb.add(rbox(2, 130, 116, 0.6, 2), F.inner, at(x, BULWARK_FLOOR + 65, 6));
  const sled = light ? 'plasticWhite' : 'plasticGrey';
  for (const bay of L.bays35) {
    const y = bay.pose.pos[1];
    for (const s of [-1, 1]) pb.add(rbox(150, 6, 4, 0.8, 2), sled, at(105, y + 3, 6 + s * 53));
    pb.add(rbox(4, 8, 14, 1.6, 2), sled, at(182.5, y + 4, 6));
    // The pull tab faces the glass, with its own grip, so an empty sled reads as a sled.
    pb.add(rbox(30, 18, 3, 1.4, 2), sled, at(105, y + 8, 62));
    for (const gx of [-8, 0, 8]) pb.add(rbox(2, 10, 1, 0.6, 1), 'darkVoid', at(105 + gx, y + 8, 63.6), { uv: 'keep' });
  }
  for (const bay of L.bays25) pb.add(rbox(74, 104, 1.0, 0.6, 2), F.inner, at(bay.pose.pos[0], bay.pose.pos[1] + 50, trayB - 0.5));

  // The glass is a door: two hinges on its rear edge and a pull at its front edge.
  const gl = L.glass[0]!;
  for (const hy of [gl.rect.min[1] + 70, gl.rect.max[1] - 70]) {
    pb.add(rbox(14, 34, 8, 2, 2), F.accent, at(gl.rect.min[0] - 4, hy, gl.outer - 2));
    pb.add(cyl(3.2, 38, 'y', 24), 'steelBare', at(gl.rect.min[0] - 6, hy, gl.outer + 2.4));
  }
  pb.add(rbox(8, 90, 6, 2.6, 3), F.accent, at(gl.rect.max[0] - 8, cy, gl.outer + 3));
  void BULWARK_GLASS_IN;

  // Feet: two long steel runners with rubber pads.
  for (const fxp of [-227, 227]) {
    pb.add(rbox(70, 14, 220, 3, 3), F.accent, at(fxp, 11, 0));
    pb.add(rbox(62, 4, 212, 1.6, 2), F.foot, at(fxp, 2, 0));
  }

  return {
    movers,
    boxes: [
      { min: [x0 - 7, slotTop - sp * slots - 4, ledgeZ - 7], max: [x0, slotTop + 4, ledgeZ + 7], tag: 'slot-ledge' },
      { min: [gl.rect.max[0] - 12, cy - 45, gl.outer], max: [gl.rect.max[0] - 4, cy + 45, gl.outer + 6], tag: 'pull' },
    ],
    zones: [zone],
  };
}
