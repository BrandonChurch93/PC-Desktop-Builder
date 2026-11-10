import * as THREE from 'three';
import { brandName, getCooler, type CoolerSpec } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { pumpBoxes, radiatorBoxes } from '../layout/partBoxes';
import { transformBox, type Box } from '../layout/math';
import { at, cyl, extrude, lathe, PartBuilder, puck, rbox, roundedPoly, rrectShape, screwGeometry, torus, tube, xf, type Vec } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { mat, sleeve, type MatName } from '../kit/materials';
import { BRAND_TYPE, MODEL_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { spillRing, Zone } from '../light/zones';
import { airCoolerPart } from './aircooler';
import { buildFan, fanLook, type FanLook } from './fan';
import { boxesPart } from './stub';
import type { Anchor, GenOpts, PartObject, Rotor } from './types';

const PI = Math.PI;
/** Maps a shape drawn in (x, z) onto x and z, extruding toward -y. */
const XZ = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);

const isFrost = (k: CoolerSpec | undefined) => k?.finish === 'frost';

/** The look of the fans that ship on a liquid cooler. */
function radFanLook(k: CoolerSpec): FanLook {
  if (k.id === 'tarn360-lux') return fanLook('gale-lux');
  if (k.id === 'tarn240-frost') return { ...fanLook('gale-lux'), key: 'gale-lux-frost', frame: 'plasticWhite', blade: 'frost', hub: 'plasticWhite' };
  return fanLook('gale');
}

/** Pump head: copper cold plate, cross bracket with captive screws, cylindrical body, gloss cap with a lit ring. */
function buildPump(pb: PartBuilder, labels: Labels, k: CoolerSpec, key: string, m?: THREE.Matrix4, loose = false) {
  const frost = isFrost(k);
  const root = pb.group(`pump:${key}`, pb.root, m);
  const body: MatName = frost ? 'aluWhite' : 'aluBlack';
  pb.add(puck(27, 2.4, 0.4, 64), 'copper', undefined, { to: root });
  // An X bracket out to the socket's four corner holes, so its arms and thumbscrews stand clear of the pump body.
  const A = 64; const hw = 6.5;
  const arm = roundedPoly([[-A, -hw], [-14, -hw], [-hw, -14], [-hw, -A], [hw, -A], [hw, -14], [14, -hw], [A, -hw], [A, hw], [14, hw], [hw, 14], [hw, A], [-hw, A], [-hw, 14], [-14, hw], [-A, hw]], 2.6);
  pb.add(extrude(arm, 2.4, 0.5, 'xy', 8), frost ? 'powderWhite' : 'aluGunmetal', at(0, 0, 2.4).multiply(new THREE.Matrix4().makeRotationZ(PI / 4)), { to: root });
  const screws = pb.group('pump-screws', root);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) {
    const s = pb.group('thumb', screws, at(sx * 42, sy * 42, 4.8));
    pb.add(lathe([[0, 0], [4.6, 0], [4.8, 0.6], [4.8, 3.2], [4.3, 4.0], [0, 4.0]], 24), 'nickel', undefined, { to: s });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; pb.add(rbox(0.6, 0.9, 2.6, 0.2, 1), 'nickel', xf({ p: [Math.cos(a) * 4.85, Math.sin(a) * 4.85, 1.9], r: [0, 0, a] }), { to: s }); }
    pb.add(new THREE.BoxGeometry(4.4, 0.8, 0.4), 'darkVoid', at(0, 0, 4.05), { to: s, uv: 'keep' });
  }
  pb.add(lathe([[0, 6], [33, 6], [34.6, 7.2], [34.6, 40], [33.8, 44.6], [31.5, 47.2], [0, 47.2]], 96), body, undefined, { to: root });
  pb.add(lathe([[34.4, 14], [35.2, 14], [35.2, 15.2], [34.4, 15.2]], 96), frost ? 'aluSilver' : 'aluSatinDark', undefined, { to: root });
  const cap = new THREE.Shape(); cap.absarc(0, 0, 29.4, 0, PI * 2, false);
  pb.add(extrude(cap, 1.4, 0.5, 'xy', 96), frost ? 'plasticWhiteGloss' : 'plasticGloss', at(0, 0, 46.2), { to: root });
  const zone = new Zone(`${key}:pump`, 'cooler', true, Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * PI * 2; return new THREE.Vector3(Math.cos(a) * 31.5, Math.sin(a) * 31.5, 47); }), 0.3);
  // The rings are thin, so they run brighter than a fan ring for the same LEDs; a blue comet head barely read at 1.0.
  pb.mesh(torus(31.6, 1.35, 10, 128), zone.diffuser(frost ? 0.56 : 1.2, frost ? 0xd8dadf : 0x1c1d21), at(0, 0, 46.9), { to: root, uv: 'keep' });
  pb.mesh(torus(23, 0.6, 8, 128), zone.diffuser(frost ? 0.42 : 0.82, frost ? 0xd8dadf : 0x1c1d21), at(0, 0, 47.6), { to: root, uv: 'keep' });
  // On the white cap the rings' light takes their hue over the white; added light cannot tint white.
  pb.mesh(spillRing(30.3, frost ? 17 : 12, 96), frost ? pb.own(zone.tint(1.0, 0.85)) : zone.spill(0.3), at(0, 0, 47.66), { to: root, uv: 'keep' }).userData.spill = true;
  if (frost) {
    // Lit, the frosted white rings carry the LEDs' color: their body steps down from white as the LEDs come up.
    const white = new THREE.Color(0xd8dadf); const lit = new THREE.Color(0x2c2e34);
    const rings = [zone.diffuser(0.56, 0xd8dadf), zone.diffuser(0.42, 0xd8dadf)];
    zone.listeners.push((c) => { const k = Math.min(1, 1.6 * Math.max(c.r, c.g, c.b)); for (const r of rings) r.color.copy(white).lerp(lit, k); });
  }
  // Standing alone in the Inspector the pump sits a few centimeters from the radiator's fans, and its light at rig strength
  // lit an unlit fan as if the fan were lit. In the rig the light behind the ring falls on the bracket and the board.
  zone.emit(new THREE.Vector3(0, 0, 48.5), new THREE.Vector3(0, 0, 1), 70, 70, loose ? 0.4 : 0.9);
  // Alone, the pump has nothing behind it to light but the radiator, and an area light casts no shadow: it shone through the
  // fans and lit the core's back as if light passed through it.
  if (!loose) zone.emit(new THREE.Vector3(0, 0, 30), new THREE.Vector3(0, 0, -1), 90, 90, 0.5);
  zone.owner = root;
  labels.text(brandName(k.brand), BRAND_TYPE[k.brand] ?? SPEC_TYPE, 3.6, at(0, 1.4, 47.66, [0, 0, 0]), { color: frost ? '#555a63' : '#c9ccd4', to: root });
  labels.text(k.name.toUpperCase(), MODEL_TYPE, 1.5, at(0, -4.4, 47.66), { color: frost ? '#7a7e87' : '#7d818a', to: root });
  labels.text('12 V · 0.3 A · MADE FOR THE BENCH', TINY_TYPE, 1, xf({ p: [0, -33.4, 24], r: [PI / 2, 0, 0] }).multiply(new THREE.Matrix4().makeRotationY(PI)), { color: frost ? '#6a6e78' : '#8a8e97', to: root });
  const fittings: Anchor[] = [];
  for (const [i, x] of [[0, -9], [1, 9]] as [number, number][]) {
    const f = pb.group(`fitting:${i}`, root, at(x, 33.5, 38));
    pb.add(cyl(5.2, 6, 'y', 32), frost ? 'aluSilver' : 'aluSatinDark', at(0, 2.6, 0), { to: f });
    pb.add(cyl(6.4, 7, 'y', 32), frost ? 'aluSilver' : 'aluSatinDark', at(0, 9, 0), { to: f });
    for (let r = 0; r < 3; r++) pb.add(torus(6.5, 0.35, 6, 32), 'nickel', xf({ p: [0, 6.2 + r * 2.4, 0], r: [PI / 2, 0, 0] }), { to: f });
    fittings.push({ pos: [x, 33.5 + 12.5, 38], dir: [0, 1, 0] });
  }
  const cableAt: Anchor = { pos: [28.5, 28.5, 34], dir: [Math.SQRT1_2, Math.SQRT1_2, 0] };
  pb.add(cyl(2.6, 6, 'y', 16, 1.9), 'rubber', xf({ p: [26.5, 26.5, 34], r: [0, 0, -PI / 4] }), { to: root });
  if (loose) {
    const cable = pb.mesh(tube([[24.5, 24.5, 34], [36, 36, 34], [48, 40, 28], [60, 38, 18], [72, 30, 12]], 1.6, 32, 6), mat('rubber'), undefined, { to: root });
    cable.userData.flexible = true;
    pb.add(rbox(10.2, 5.2, 7.2, 0.6, 2), 'plasticDark', xf({ p: [77, 27.5, 10], r: [0, 0, -0.45] }), { to: root });
  }
  return { root, zone, screws, fittings, cableAt };
}

/** A radiator: corrugated fin core between flat tubes, end tanks, side plates, fittings and its fans. */
function buildRadiator(pb: PartBuilder, labels: Labels, k: CoolerSpec, key: string, o: { order: 'fans-first' | 'rad-first'; airInward: boolean; localUp?: [number, number, number]; localView?: [number, number, number] }, m?: THREE.Matrix4, detail = 1) {
  const frost = isFrost(k);
  const size = k.radSize ?? 360;
  const L = DIMS.radLength[size] ?? 397;
  const n = Math.round(size / 120);
  const root = pb.group(`radiator:${key}`, pb.root, m);
  const fanT = DIMS.fan[120].thick;
  const rz0 = o.order === 'rad-first' ? 0 : fanT;
  const rz1 = rz0 + DIMS.radThick;
  const coreZ0 = rz0 + 1.5; const coreZ1 = rz1 - 1.5;
  const tank = 22; const coreL = L - 2 * tank;
  const W = 120;
  const tubeMat: MatName = frost ? 'radCoreWhite' : 'radCore';
  const tubes = 13;
  const gap = W / tubes;
  for (let i = 0; i <= tubes; i++) pb.add(rbox(coreL, 1.6, coreZ1 - coreZ0, 0.5, 1), tubeMat, xf({ p: [0, -W / 2 + i * gap, (coreZ0 + coreZ1) / 2] }));
  const pitch = 1.5 / Math.max(0.6, detail);
  const fold = new THREE.BufferGeometry();
  const h = gap - 1.6; const d = coreZ1 - coreZ0 - 0.6;
  const p = [-pitch / 2, -h / 2, -d / 2, 0, h / 2, -d / 2, 0, h / 2, d / 2, -pitch / 2, -h / 2, d / 2, pitch / 2, -h / 2, -d / 2, pitch / 2, -h / 2, d / 2];
  fold.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  fold.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 5, 1, 5, 2]);
  fold.computeVertexNormals();
  const mats: THREE.Matrix4[] = [];
  const folds = Math.floor(coreL / pitch);
  for (let g = 0; g < tubes; g++) for (let i = 0; i < folds; i++) mats.push(xf({ p: [-coreL / 2 + pitch / 2 + i * pitch, -W / 2 + (g + 0.5) * gap, (coreZ0 + coreZ1) / 2] }));
  // A white radiator's fins are coated white; bare silver fins mirrored the dark room and read as a black core.
  const finMat = (mat(frost ? 'finCoatedWhite' : 'finDark') as THREE.MeshPhysicalMaterial).clone();
  finMat.side = THREE.DoubleSide; pb.own(finMat);
  if (!frost) finMat.color.setHex(0x4a4d55);
  const inst = pb.instanced(fold, finMat, mats, { shadow: false, to: root });
  fold.dispose();
  void inst;
  const tankMat: MatName = frost ? 'plasticWhite' : 'plasticMatte';
  for (const sgn of [-1, 1]) {
    const t = roundedPoly([[-tank / 2, rz0], [tank / 2 - 3, rz0], [tank / 2, rz0 + 3], [tank / 2, rz1 - 3], [tank / 2 - 3, rz1], [-tank / 2, rz1]], 1.2);
    const g = extrude(t, DIMS.radWidth, 0.8, 'xy', 4, 2);
    const place = new THREE.Matrix4().makeRotationZ(sgn > 0 ? 0 : PI).multiply(new THREE.Matrix4().makeTranslation(L / 2 - tank / 2, DIMS.radWidth / 2, 0)).multiply(XZ);
    pb.add(g, tankMat, place, { to: root });
  }
  if (frost) {
    // White hides form, so the white radiator shows its build: crimp bands where the tanks meet the core, the tanks' screws,
    // and the threaded fan channels along both long edges of each face.
    for (const sgn of [-1, 1]) {
      pb.add(rbox(1.4, DIMS.radWidth + 0.8, rz1 - rz0 + 0.8, 0.4, 2), 'aluSilver', at(sgn * (coreL / 2 + 0.7), 0, (rz0 + rz1) / 2), { to: root });
      for (const fy of [-38, 38]) for (const fz of [rz0 - 0.05, rz1 + 0.05]) {
        const s = screwGeometry(2.0, 1.0, 'button'); if (fz < rz1) s.rotateX(PI);
        pb.add(s, pb.own(new THREE.MeshPhysicalMaterial({ color: 0xd4d6da, metalness: 1, roughness: 0.32, vertexColors: true })), at(sgn * (L / 2 - tank / 2), fy, fz), { to: root, uv: 'keep' });
      }
    }
    for (const sy of [-1, 1]) for (const fz of [rz0 - 0.2, rz1 + 0.2]) {
      pb.add(rbox(coreL, 7, 0.8, 0.3, 2), 'powderWhite', at(0, sy * (W / 2 - 4.5), fz), { to: root });
      for (let i = 0; i < n * 2; i++) {
        const fx = (Math.floor(i / 2) - (n - 1) / 2) * DIMS.radFanPitch + (i % 2 ? 52.5 : -52.5);
        pb.add(cyl(1.7, 0.3, 'z', 16), 'darkVoid', at(fx, sy * 52.5, fz + (fz > 0 ? 0.3 : -0.3)), { to: root, uv: 'keep' });
      }
    }
  }
  for (const sgn of [-1, 1]) {
    const g = extrude(rrectShape(coreL + 2, rz1 - rz0, 1.2, 0, (rz0 + rz1) / 2), 1.4, 0.4, 'xy', 4, 1);
    pb.add(g, frost ? 'powderWhite' : 'powderBlack', new THREE.Matrix4().makeTranslation(0, sgn > 0 ? W / 2 + 1.4 : -W / 2, 0).multiply(XZ), { to: root });
    for (let i = 0; i < n * 2; i++) {
      const fx = (Math.floor(i / 2) - (n - 1) / 2) * DIMS.radFanPitch + (i % 2 ? 52.5 : -52.5);
      pb.add(cyl(1.7, 0.3, 'y', 12), 'darkVoid', at(fx, sgn * (W / 2 + 1.45), (rz0 + rz1) / 2), { to: root, uv: 'keep' });
    }
  }
  // The print goes on the side plate that faces the glass, upright for the way the radiator is mounted.
  const view = new THREE.Vector3(...(o.localView ?? [0, 0, 1]));
  const sy = view.y >= 0 ? 1 : -1;
  const normal = new THREE.Vector3(0, sy, 0);
  const up = new THREE.Vector3(...(o.localUp ?? [0, 1, 0])); up.y = 0;
  if (up.lengthSq() < 0.01) up.set(-view.x, 0, -view.z);
  if (up.lengthSq() < 0.01) up.set(0, 0, -1);
  up.normalize();
  const along = new THREE.Vector3().crossVectors(up, normal).normalize();
  const printAt = (u: number, v: number) => new THREE.Vector3().addScaledVector(along, u).addScaledVector(up, v).add(new THREE.Vector3(0, sy * (W / 2 + 1.46), (rz0 + rz1) / 2));
  const basis = new THREE.Matrix4().makeBasis(along, up, normal);
  const startU = -coreL / 2 + 40;
  labels.text(`${brandName(k.brand).toUpperCase()} ${k.name.toUpperCase()}`, MODEL_TYPE, 4.4, basis.clone().setPosition(printAt(startU, 4)), { color: frost ? '#5e626b' : '#aeb2bb', to: root, align: 'left' });
  labels.text(`${size} MM · ALUMINUM CORE · 27 MM`, TINY_TYPE, 2.4, basis.clone().setPosition(printAt(startU, -4.5)), { color: frost ? '#7a7e87' : '#7c808a', to: root, align: 'left' });
  pb.add(cyl(5.5, 2.2, 'x', 24), frost ? 'aluSilver' : 'aluSatinDark', at(-L / 2 - 0.6, 30, (rz0 + rz1) / 2), { to: root });
  const fittings: Anchor[] = [];
  const fz = o.order === 'rad-first' ? rz1 : rz1;
  for (const [i, y] of [[0, 15], [1, -15]] as [number, number][]) {
    const f = pb.group(`rad-fitting:${i}`, root, at(L / 2 - tank / 2 + 1.5, y, fz));
    pb.add(cyl(5.4, 5, 'z', 32), frost ? 'aluSilver' : 'aluSatinDark', at(0, 0, 2.4), { to: f });
    pb.add(cyl(6.4, 8, 'z', 32), frost ? 'aluSilver' : 'aluSatinDark', at(0, 0, 9), { to: f });
    for (let r = 0; r < 3; r++) pb.add(torus(6.5, 0.35, 6, 32), 'nickel', at(0, 0, 6.4 + r * 2.4), { to: f });
    fittings.push({ pos: [L / 2 - tank / 2 + 1.5, y, fz + 13], dir: [0, 0, 1] });
  }
  const look = radFanLook(k);
  const zones: Zone[] = []; const rotors: Rotor[] = [];
  const fz0 = o.order === 'rad-first' ? rz1 : 0;
  const flip = o.airInward ? 0 : PI;
  const toCore = new THREE.Vector3(0, 0, o.order === 'rad-first' ? -1 : 1);
  const sg = screwGeometry(2.6, 1.6, 'pan');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: frost ? 0xd9dbe0 : 0x24252a, metalness: 1, roughness: 0.35, vertexColors: true }));
  for (let i = 0; i < n; i++) {
    const cx = (i - (n - 1) / 2) * DIMS.radFanPitch;
    const fm = new THREE.Matrix4().makeTranslation(cx, 0, fz0 + fanT / 2).multiply(new THREE.Matrix4().makeRotationX(flip));
    const g = pb.group(`radfan:${i}`, root);
    const fb = buildFan(pb, labels, look, 120, fm, `${key}:fan${i}`, { detail, tucked: true });
    // The core blocks the ring's light on the face that touches it, so that face casts none.
    const q = new THREE.Quaternion().setFromRotationMatrix(fm);
    for (const z of fb.zones) {
      for (let j = z.emitters.length - 1; j >= 0; j--) if (z.emitters[j]!.normal.clone().applyQuaternion(q).dot(toCore) > 0.5) z.emitters.splice(j, 1);
      zones.push(retarget(z));
    }
    // The ring's light leaks through the thin fins and shows on the far face of the core, strongest under the ring.
    const ring = fb.zones[0];
    if (ring) {
      const backZ = o.order === 'rad-first' ? coreZ0 - 0.25 : coreZ1 + 0.25;
      const lm = new THREE.Matrix4().makeTranslation(cx, 0, backZ).multiply(new THREE.Matrix4().makeRotationX(flip));
      // Peaks under the ring and fades both ways, so no hard circle shows on the core.
      // Through 27 mm of folded fins the ring's light spreads into a broad soft patch, not a ring. A white core takes the hue
      // over its white, since added light cannot tint white.
      for (const [a, b] of [[40, 70], [40, 6]] as [number, number][]) pb.mesh(spillRing(a, b, 64), frost ? pb.own(ring.tint(0.55, 0.5, 'soft')) : ring.spill(0.06), lm, { uv: 'keep', to: root }).userData.spill = true;
    }
    rotors.push(...fb.rotors);
    void g;
    const far = o.order === 'rad-first' ? fz0 + fanT + 0.1 : fz0 - 0.1;
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) pb.add(sg.clone(), sm, xf({ p: [cx + sx * 52.5, sy * 52.5, far], r: o.order === 'rad-first' ? [0, 0, 0] : [PI, 0, 0] }), { to: root, uv: 'keep' });
  }
  sg.dispose();
  return { root, zones, rotors, fittings };
}

/** Rad fan zones belong to the cooler, so they follow the cooler's lighting target. */
function retarget(z: Zone): Zone {
  (z as { target: string }).target = 'cooler';
  return z;
}

export function pumpPart(id: string, opts: GenOpts = {}): PartObject {
  const k = getCooler(id);
  if (!k || k.type !== 'aio') return airPart(id, opts);
  const key = opts.key ?? `cooler:${id}`;
  const pb = new PartBuilder(`pump-${id}`);
  const labels = new Labels(pb, 24);
  const pump = buildPump(pb, labels, k, key);
  labels.finish();
  const done = pb.finish();
  const anchors: Record<string, Anchor> = { fitting0: pump.fittings[0]!, fitting1: pump.fittings[1]!, cable: pump.cableAt };
  return { root: done.root, boxes: pumpBoxes(), anchors, zones: [pump.zone], rotors: [], movers: { screws: pump.screws }, dispose: () => { done.dispose(); pump.zone.dispose(); } };
}

export function radiatorPart(id: string, opts: GenOpts = {}): PartObject {
  const k = getCooler(id);
  if (!k || k.type !== 'aio') return boxesPart(`radiator-${id}`, []);
  const key = opts.key ?? `radiator:${id}`;
  const order = opts.order ?? 'rad-first';
  const pb = new PartBuilder(`radiator-${id}`);
  const labels = new Labels(pb, 18);
  const rad = buildRadiator(pb, labels, k, key, { order, airInward: opts.airInward ?? false, localUp: opts.localUp, localView: opts.localView }, undefined, opts.detail ?? 1);
  labels.finish();
  const done = pb.finish();
  const anchors: Record<string, Anchor> = { fitting0: rad.fittings[0]!, fitting1: rad.fittings[1]! };
  return {
    root: done.root, boxes: radiatorBoxes({ size: k.radSize ?? 360, order, pitch: DIMS.radFanPitch }), anchors, zones: rad.zones, rotors: rad.rotors, movers: {},
    dispose: () => { done.dispose(); for (const z of rad.zones) z.dispose(); },
  };
}

/** Tubes between two fittings: braided sleeve over a smooth path with crimped collars. Flexible, so outside the boxes. */
export function tubePath(points: Vec[], frost: boolean, radius = 6.1): { geo: THREE.BufferGeometry; material: THREE.Material } {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, Math.max(48, Math.round(curve.getLength() / 3)), radius, 18, false);
  const uv = geo.getAttribute('uv');
  const len = curve.getLength();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * radius * 2 * PI);
  return { geo, material: sleeve(frost ? '#f1f2f5' : '#2c2c34', 2.2) };
}

/** The whole liquid cooler for the Inspector: radiator standing behind, pump in front, tubes between them. */
export function coolerPart(id: string, opts: GenOpts = {}): PartObject {
  const k = getCooler(id);
  if (!k || k.type !== 'aio') return airPart(id, opts);
  const key = opts.key ?? `cooler:${id}`;
  const pb = new PartBuilder(`cooler-${id}`);
  const labels = new Labels(pb, 22);
  const size = k.radSize ?? 360;
  const L = DIMS.radLength[size] ?? 397;
  const radM = new THREE.Matrix4().makeTranslation(0, 0, 0).multiply(new THREE.Matrix4().makeRotationX(0));
  const rad = buildRadiator(pb, labels, k, `${key}:rad`, { order: 'fans-first', airInward: true }, radM, opts.detail ?? 1);
  // The pump stands at the same share of the radiator's length for every size, so the close view finds it the same way.
  const px = -L / 2 + L * 0.227;
  const pumpM = new THREE.Matrix4().makeTranslation(px, -40, -120).multiply(new THREE.Matrix4().makeRotationY(PI));
  const pump = buildPump(pb, labels, k, key, pumpM, true);
  pb.root.updateMatrixWorld(true);
  const w = (o: THREE.Object3D, a: Anchor) => new THREE.Vector3(...a.pos).applyMatrix4(o.matrixWorld);
  for (let i = 0; i < 2; i++) {
    const a = w(pump.root, pump.fittings[i]!); const b = w(rad.root, rad.fittings[i]!);
    // One easy loop up over the radiator's top edge and down behind it, with no tight corner anywhere.
    const pts: Vec[] = [[a.x, a.y, a.z], [a.x, a.y + 18, a.z], [a.x + 70, 92 + i * 9, a.z + 40], [b.x - 50 - i * 12, 104 + i * 9, -16], [b.x - 8, 86 + i * 6, b.z + 40], [b.x, b.y + 16, b.z + 26], [b.x, b.y, b.z + 14], [b.x, b.y, b.z]];
    const t = tubePath(pts, isFrost(k));
    const mesh = pb.mesh(t.geo, t.material, undefined, { uv: 'keep' });
    mesh.userData.flexible = true; mesh.castShadow = true;
  }
  labels.finish();
  const done = pb.finish();
  const boxes: Box[] = [
    ...radiatorBoxes({ size, order: 'fans-first', pitch: DIMS.radFanPitch }),
    ...pumpBoxes().map((b) => transformBox({ pos: [px, -40, -120], rot: [0, PI, 0] }, b)),
  ];
  const zones = [pump.zone, ...rad.zones];
  return { root: done.root, boxes, anchors: {}, zones, rotors: rad.rotors, movers: {}, dispose: () => { done.dispose(); for (const z of zones) z.dispose(); } };
}

function airPart(id: string, opts: GenOpts): PartObject {
  return airCoolerPart(id, opts);
}
