import * as THREE from 'three';
import { brandName, getFan } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { fanBoxes } from '../layout/partBoxes';
import { bladeGeometry, blurDiscTexture } from '../kit/blades';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, rbox, rrect, rrectShape, screwGeometry, torus, tube, xf, type Vec } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { mat, type MatName } from '../kit/materials';
import { BRAND_TYPE, SPEC_TYPE } from '../kit/type';
import { Zone } from '../light/zones';
import type { GenOpts, PartObject, Rotor } from './types';

const PI = Math.PI;
const CORNERS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export type FanLook = {
  key: string; brand: string; name: string; blades: number; lit: boolean;
  frame: MatName; blade: MatName | 'smoke' | 'frost'; hub: MatName; pads: boolean;
  light: 'none' | 'ring' | 'ring+hub' | 'hub' | 'edge';
  thick?: number;
};

export function fanLook(id: string): FanLook {
  const f = getFan(id);
  const base = { key: id, brand: f?.brand ?? 'kestrane', name: f?.name ?? 'Gale', blades: f?.blades ?? 9, lit: f?.lit ?? false };
  switch (id) {
    case 'gale-lux': return { ...base, frame: 'plasticMatte', blade: 'smoke', hub: 'plasticMolded', pads: true, light: 'ring' };
    case 'aureole': return { ...base, frame: 'plasticMatte', blade: 'smoke', hub: 'plasticMatte', pads: true, light: 'ring+hub' };
    case 'petal': return { ...base, frame: 'plasticWhite', blade: 'frost', hub: 'plasticWhite', pads: true, light: 'hub' };
    case 'frame': return { ...base, frame: 'plasticMatte', blade: 'bladeBlack', hub: 'plasticMatte', pads: true, light: 'edge' };
    default: return { ...base, frame: 'plasticMatte', blade: 'bladeBlack', hub: 'plasticMatte', pads: true, light: 'none' };
  }
}

type FanBuild = { zones: Zone[]; rotors: Rotor[]; movers: Record<string, THREE.Object3D> };

/** Builds one fan into a part builder at a transform. Used for case fans and the fans on radiators and coolers. */
/** Spill on the frame face around a ring: the corners outside the ring, u around the ring, v out toward each corner. */
function cornerSpill(r: number, half: number, n: number): THREE.BufferGeometry {
  const pos: number[] = []; const uv: number[] = [];
  const cut = r > half ? Math.acos(half / r) : 0;
  for (let k = 0; k < 4; k++) {
    const base = (k * PI) / 2;
    const a0 = base + cut; const a1 = base + PI / 2 - cut;
    const cx = Math.cos(base + PI / 4) * half * Math.SQRT2; const cy = Math.sin(base + PI / 4) * half * Math.SQRT2;
    for (let i = 0; i < n; i++) {
      const p = a0 + ((a1 - a0) * i) / n; const q = a0 + ((a1 - a0) * (i + 1)) / n;
      pos.push(cx, cy, 0, Math.cos(p) * r, Math.sin(p) * r, 0, Math.cos(q) * r, Math.sin(q) * r, 0);
      uv.push((base + PI / 4) / (2 * PI), 1, p / (2 * PI), 0, q / (2 * PI), 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export function buildFan(pb: PartBuilder, labels: Labels, look: FanLook, size: 120 | 140, m: THREE.Matrix4, zoneKey: string, opts: { mountSide?: -1 | 0 | 1; detail?: number; thick?: number; tucked?: boolean; loose?: boolean } = {}): FanBuild {
  const D = DIMS.fan[size];
  const t = opts.thick ?? look.thick ?? D.thick;
  const half = D.size / 2; const hole = half - 2.6; const hp = D.holes / 2;
  const k = D.size / 120;
  const detail = opts.detail ?? 1;
  const holder = pb.group(`fan:${zoneKey}`, pb.root, m);
  const out: FanBuild = { zones: [], rotors: [], movers: {} };
  const fl = 3.2; const face = t / 2 - 0.5;

  const flange = () => {
    const s = rrect(new THREE.Shape(), -half, -half, D.size, D.size, 6.5 * k);
    s.holes.push(circleHole(0, 0, hole));
    for (const [sx, sy] of CORNERS) s.holes.push(circleHole(sx * hp, sy * hp, 2.25));
    return extrude(s, fl, 0.55, 'xy', Math.round(40 * detail), 2);
  };
  pb.add(flange(), look.frame, at(0, 0, -face), { to: holder });
  pb.add(flange(), look.frame, at(0, 0, face - fl), { to: holder });
  pb.add(lathe([[hole, -face + fl - 0.2], [hole + 1.6, -face + fl - 0.2], [hole + 1.6, face - fl + 0.2], [hole, face - fl + 0.2]], Math.round(72 * detail)), look.frame, undefined, { to: holder });
  pb.add(lathe([[hole - 0.01, -face + 0.4], [hole - 0.01, face - 0.4]], Math.round(72 * detail)), look.frame, undefined, { to: holder });
  for (const [sx, sy] of CORNERS) {
    const corner = new THREE.Shape();
    const cx = sx * (half - 9 * k); const cy = sy * (half - 9 * k);
    rrect(corner, cx - 9 * k, cy - 9 * k, 18 * k, 18 * k, 3);
    corner.holes.push(circleHole(sx * hp, sy * hp, 2.25));
    pb.add(extrude(corner, t - 2 * fl - 0.2, 0, 'xy', 16), look.frame, at(0, 0, -face + fl + 0.1), { to: holder });
    pb.add(cyl(2.3, t - 1.2, 'z', 12, 2.3, true), 'darkVoid', at(sx * hp, sy * hp, 0), { to: holder, uv: 'keep' });
    if (look.pads) {
      const pad = rrectShape(10.5 * k, 10.5 * k, 1.6); pad.holes.push(circleHole(sx * (hp - (half - 6.6 * k)), sy * (hp - (half - 6.6 * k)), 2.4));
      for (const z of [-face - 0.8, face - 0.3]) pb.add(extrude(pad, 1.1, 0.4, 'xy', 16, 1), look.frame === 'plasticWhite' ? 'rubberWhite' : 'rubber', at(sx * (half - 6.6 * k), sy * (half - 6.6 * k), z), { to: holder });
    }
  }

  const back = face - 1.2;
  pb.add(lathe([[0, back - 6.5], [17.8, back - 6.5], [19, back - 5.3], [19, back], [0, back]], 48), look.frame, undefined, { to: holder });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4 + 0.32;
    const len = hole - 17;
    const mid = 18 + len / 2;
    pb.add(rbox(len, 3.2 * k, 3, 1.1, 2), look.frame, xf({ p: [Math.cos(a) * mid, Math.sin(a) * mid, back - 1.6], r: [0, 0, a + 0.12] }), { to: holder });
  }
  labels.text(`${brandName(look.brand)} ${look.name} · 12 V · 0.${size === 140 ? 30 : 25} A`, SPEC_TYPE, 1.15, xf({ p: [0, 0, back + 0.06], r: [0, 0, 0] }), { color: '#8c909a', to: holder });

  const rotorGroup = pb.group(`rotor:${zoneKey}`, holder);
  const blades = pb.group(`blades:${zoneKey}`, rotorGroup);
  const hubR = 19;
  pb.add(lathe([[0, -face + 0.6], [13.2, -face + 0.6], [16.8, -face + 1.8], [hubR, -face + 4.4], [hubR, back - 7], [0, back - 7]], 56), look.hub, undefined, { to: rotorGroup });
  const bladeSpec = { r0: hubR - 0.4, r1: hole - 1.6, c0: 15 * k, c1: (look.blades === 7 ? 50 : 40) * k, pitch0: 0.86, pitch1: 0.42, sweep: look.blades === 7 ? 0.42 : 0.56, thick: 1.7, z: -0.8, nu: Math.round(26 * detail), nv: Math.round(16 * detail) };
  const bg = bladeGeometry(bladeSpec);
  let bladeMat: THREE.MeshPhysicalMaterial;
  if (look.blade === 'smoke') bladeMat = pb.own((mat('bladeSmoke') as THREE.MeshPhysicalMaterial).clone());
  else if (look.blade === 'frost') bladeMat = pb.own((mat('bladeFrost') as THREE.MeshPhysicalMaterial).clone());
  else bladeMat = pb.own((mat(look.blade) as THREE.MeshPhysicalMaterial).clone());
  for (let i = 0; i < look.blades; i++) pb.add(bg.clone(), bladeMat, xf({ r: [0, 0, (i / look.blades) * PI * 2] }), { to: blades, uv: 'keep' });
  bg.dispose();
  const discMat = pb.own(new THREE.MeshBasicMaterial({ map: pb.own(blurDiscTexture(look.blades, look.blade === 'frost' || look.frame === 'plasticWhite')), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const disc = pb.mesh(new THREE.RingGeometry(hubR - 1, hole - 1.2, 72, 1), discMat, at(0, 0, -0.8), { to: rotorGroup });
  disc.visible = false;
  disc.userData.flexible = true;
  const sticker = new THREE.Shape(); sticker.absarc(0, 0, 13, 0, PI * 2, false);
  pb.add(extrude(sticker, 0.25, 0, 'xy', 48), look.frame === 'plasticWhite' ? 'plasticWhiteGloss' : 'sticker', at(0, 0, -face + 0.35), { to: rotorGroup });
  labels.text(brandName(look.brand), BRAND_TYPE[look.brand] ?? SPEC_TYPE, 2.3 * Math.min(1, 9 / brandName(look.brand).length), xf({ p: [0, 1.2, -face + 0.3], r: [0, PI, 0] }), { color: look.frame === 'plasticWhite' ? '#5d616b' : '#b9bdc6', to: rotorGroup });
  labels.text(look.name, SPEC_TYPE, 1.1, xf({ p: [0, -3.4, -face + 0.3], r: [0, PI, 0] }), { color: look.frame === 'plasticWhite' ? '#80848d' : '#7c808a', to: rotorGroup });
  out.rotors.push({ obj: rotorGroup, axis: 'z', speed: 1, blades, disc });

  const cablePts: Vec[] = opts.loose
    ? [[12, 15, back - 2], [hp - 12, hp - 12, back - 2], [hp - 4, hp + 2, back - 4], [half + 3, half - 2, back - 6], [half + 6, half - 22, back - 8], [half + 6.5, half - 46, back - 8]]
    : opts.tucked
    ? [[12, 15, back - 2], [hp - 12, hp - 12, back - 2], [hp - 4, hp + 2, back - 4], [hp - 8, half + 1.6, back - 6], [hp - 34, half + 1.6, back - 6]]
    : [[12, 15, back - 2], [hp - 12, hp - 12, back - 2], [hp - 4, hp + 4, back - 4], [half + 2, half + 6, back - 8], [half + 6, half + 22, back - 10]];
  const lead = pb.mesh(tube(cablePts, 1.4, 24, 6), mat('rubber'), undefined, { to: holder });
  if (opts.tucked) pb.add(rbox(10.6, 5.4, 7.4, 0.6, 2), 'plasticDark', at(hp - 39, half + 1.6, back - 6), { to: holder });
  if (opts.loose) {
    pb.add(rbox(5.4, 10.6, 7.4, 0.6, 2), 'plasticDark', at(half + 6.5, half - 51.5, back - 8), { to: holder });
    pb.add(new THREE.BoxGeometry(3.6, 0.4, 5.8), 'darkVoid', at(half + 6.5, half - 56.9, back - 8), { to: holder, uv: 'keep' });
  }
  lead.userData.flexible = true;

  const ring = (key: string, radius: number, count: number, faces: number[], intensity: number) => {
    const leds = Array.from({ length: count }, (_, i) => { const a = (i / count) * PI * 2; return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0); });
    const z = new Zone(key, 'fans', true, leds, hashPhase(key));
    const dm = z.diffuser(intensity, 0x121316, 0.85);
    for (const fz of faces) {
      pb.mesh(torus(radius, 1.55, 10, Math.round(96 * detail)), dm, at(0, 0, fz), { to: holder, uv: 'keep' });
      // The face against the mount sends its light out of the case, so it ranks last for a lamp.
      const outward = opts.mountSide !== undefined && opts.mountSide !== 0 && Math.sign(fz) === opts.mountSide;
      z.emit(new THREE.Vector3(0, 0, fz), new THREE.Vector3(0, 0, Math.sign(fz) || -1), D.size * 0.8, D.size * 0.8, outward ? 0.3 : 0.8);
    }
    z.owner = holder;
    out.zones.push(z);
    return z;
  };

  if (look.light === 'ring' || look.light === 'ring+hub') {
    const z = ring(`${zoneKey}`, hole + 1.3, 18, [-face - 0.2, face + 0.2], 0.9);
    const inner = cyl(hole + 0.15, t - 2 * fl - 0.6, 'z', Math.round(96 * detail), hole + 0.15, true);
    inner.rotateZ(PI / 2);
    // The duct lining only glows; a lit material here mirrors the fan's own lamp, which sits in the same plane, as a white hot spot.
    const im = pb.own(new THREE.MeshBasicMaterial({ map: z.tex, color: new THREE.Color(0.3, 0.3, 0.3), side: THREE.BackSide }));
    pb.mesh(inner, im, undefined, { to: holder, uv: 'keep' });
    z.listeners.push((c) => bladeMat.emissive.copy(c).multiplyScalar(0.05));
    for (const sd of [1, -1]) pb.mesh(cornerSpill(hole + 2.9, half - 0.4, 10), z.spill(look.frame === 'plasticWhite' ? 0.16 : sd === opts.mountSide ? 0.45 : 0.24), at(0, 0, sd * (t / 2 + 0.06)), { to: holder, uv: 'keep' }).userData.spill = true;
  }
  if (look.light === 'ring+hub') {
    const hz = ring(`${zoneKey}:hub`, hubR + 1.6, 12, [-face + 4.2], 1.3);
    hz.listeners.push(() => undefined);
  }
  if (look.light === 'hub') {
    const hz = ring(`${zoneKey}`, hubR + 1.4, 12, [-face + 4.6], 1.4);
    hz.listeners.push((c) => bladeMat.emissive.copy(c).multiplyScalar(0.95));
  }
  if (look.light === 'edge') {
    const inset = 2.2;
    const pts = rrect(new THREE.Path(), -half + inset, -half + inset, D.size - 2 * inset, D.size - 2 * inset, 5).getPoints(8).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const loop = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.1);
    const leds = loop.getSpacedPoints(64).slice(0, 64);
    const z = new Zone(zoneKey, 'fans', true, leds, hashPhase(zoneKey));
    z.owner = holder;
    const dm = z.diffuser(1.4, 0x26272c, 0.3);
    for (const fz of [-face - 0.1, face + 0.1]) {
      const g = new THREE.TubeGeometry(loop, 160, 1.2, 6, true);
      g.translate(0, 0, fz);
      pb.mesh(g, dm, undefined, { to: holder, uv: 'keep' });
      z.emit(new THREE.Vector3(0, 0, fz), new THREE.Vector3(0, 0, Math.sign(fz)), D.size, D.size, 0.8);
    }
    out.zones.push(z);
  }

  if (opts.mountSide) {
    const sg = screwGeometry(2.7, 1.5, 'pan');
    const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x2a2b30, metalness: 1, roughness: 0.35, vertexColors: true }));
    const screws = pb.group(`screws:${zoneKey}`, holder);
    const side = opts.mountSide;
    for (const [sx, sy] of CORNERS) {
      const s = pb.group('screw', screws, xf({ p: [sx * hp, sy * hp, side * (t / 2 + 1.5)], r: side > 0 ? [0, 0, 0] : [PI, 0, 0] }));
      pb.add(sg.clone(), sm, undefined, { to: s, uv: 'keep' });
    }
    sg.dispose();
    out.movers[`screws:${zoneKey}`] = screws;
  }
  return out;
}

const hashPhase = (key: string) => { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997; return h / 997; };

export function fanPart(id: string, opts: GenOpts = {}): PartObject {
  const look = fanLook(id);
  const size = opts.size ?? 120;
  const pb = new PartBuilder(`fan-${id}-${size}`);
  const labels = new Labels(pb);
  const fb = buildFan(pb, labels, look, size, new THREE.Matrix4(), opts.key ?? `fan:${id}`, { mountSide: opts.mountSide ?? 0, detail: opts.detail, loose: opts.loose });
  labels.finish();
  const done = pb.finish();
  return {
    root: done.root, boxes: fanBoxes(size), anchors: { lead: { pos: [size / 2 + 6, size / 2 + 22, 2], dir: [0, 1, 0] } }, zones: fb.zones, rotors: fb.rotors, movers: fb.movers,
    dispose: () => { done.dispose(); for (const z of fb.zones) z.dispose(); },
  };
}
