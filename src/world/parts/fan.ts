import * as THREE from 'three';
import { brandName, getFan } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { fanBoxes } from '../layout/partBoxes';
import { bladeGeometry, blurDiscTexture } from '../kit/blades';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, rbox, rrect, rrectShape, screwGeometry, torus, tube, xf, type Vec } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { mat, type MatName } from '../kit/materials';
import { textures } from '../kit/textures';
import { BRAND_TYPE, SPEC_TYPE } from '../kit/type';
import { Zone } from '../light/zones';
import type { GenOpts, PartObject, Rotor } from './types';

const PI = Math.PI;
const CORNERS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export type FanLook = {
  key: string; brand: string; name: string; blades: number; lit: boolean;
  frame: MatName; blade: MatName | 'smoke' | 'frost' | 'frostDark'; hub: MatName; pads: boolean;
  light: 'none' | 'ring' | 'ring+hub' | 'hub' | 'edge';
  thick?: number;
  /** Lumenfold's soft forms: large frame radii, round pads, a domed hub rim */
  soft: boolean;
};

export function fanLook(id: string): FanLook {
  const f = getFan(id);
  const base = { key: id, brand: f?.brand ?? 'kestrane', name: f?.name ?? 'Gale', blades: f?.blades ?? 9, lit: f?.lit ?? false, soft: f?.brand === 'lumenfold' };
  switch (id) {
    case 'gale-lux': return { ...base, frame: 'plasticMatte', blade: 'smoke', hub: 'plasticMolded', pads: true, light: 'ring' };
    case 'aureole': return { ...base, frame: 'plasticMatte', blade: 'smoke', hub: 'plasticMolded', pads: true, light: 'ring+hub' };
    case 'petal': return { ...base, frame: 'plasticWhite', blade: 'frost', hub: 'plasticWhite', pads: true, light: 'hub' };
    case 'frame': return { ...base, frame: 'plasticMatte', blade: 'frostDark', hub: 'plasticMolded', pads: true, light: 'edge' };
    default: return { ...base, frame: 'plasticMatte', blade: 'bladeBlack', hub: 'plasticMolded', pads: true, light: 'none' };
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
  const R = (look.soft ? 14 : 6.5) * k;

  const flange = () => {
    const s = rrect(new THREE.Shape(), -half, -half, D.size, D.size, R);
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
    if (look.soft) {
      // One quarter, its outer corner on the flange's radius, turned into place.
      const a = half - 18 * k;
      corner.moveTo(a, a); corner.lineTo(half, a); corner.lineTo(half, half - R); corner.absarc(half - R, half - R, R, 0, PI / 2, false); corner.lineTo(a, half); corner.closePath();
      corner.holes.push(circleHole(hp, hp, 2.25));
      const turn = sx > 0 ? (sy > 0 ? 0 : -PI / 2) : (sy > 0 ? PI / 2 : PI);
      pb.add(extrude(corner, t - 2 * fl - 0.2, 0, 'xy', 16), look.frame, at(0, 0, -face + fl + 0.1).multiply(new THREE.Matrix4().makeRotationZ(turn)), { to: holder });
    } else {
      const cx = sx * (half - 9 * k); const cy = sy * (half - 9 * k);
      rrect(corner, cx - 9 * k, cy - 9 * k, 18 * k, 18 * k, 3);
      corner.holes.push(circleHole(sx * hp, sy * hp, 2.25));
      pb.add(extrude(corner, t - 2 * fl - 0.2, 0, 'xy', 16), look.frame, at(0, 0, -face + fl + 0.1), { to: holder });
    }
    pb.add(cyl(2.3, t - 1.2, 'z', 12, 2.3, true), 'darkVoid', at(sx * hp, sy * hp, 0), { to: holder, uv: 'keep' });
    if (look.pads && look.soft) {
      const pad = new THREE.Shape(); pad.absarc(0, 0, 5 * k, 0, PI * 2, false); pad.holes.push(circleHole(0, 0, 2.4));
      for (const z of [-face - 1.2, face - 0.3]) pb.add(extrude(pad, 1.5, 0.6, 'xy', 32, 2), look.frame === 'plasticWhite' ? 'rubberWhite' : 'rubberPad', at(sx * hp, sy * hp, z), { to: holder });
    } else if (look.pads) {
      // Raised soft pads in a grey rubber: flush pads in the frame's black read as part of the frame.
      const pad = rrectShape(10.5 * k, 10.5 * k, 2.4); pad.holes.push(circleHole(sx * (hp - (half - 6.6 * k)), sy * (hp - (half - 6.6 * k)), 2.4));
      for (const z of [-face - 1.2, face - 0.3]) pb.add(extrude(pad, 1.5, 0.6, 'xy', 16, 2), look.frame === 'plasticWhite' ? 'rubberWhite' : 'rubberPad', at(sx * (half - 6.6 * k), sy * (half - 6.6 * k), z), { to: holder });
    }
  }

  const back = face - 1.2;
  const motorBase = lathe([[0, back - 6.5], [17.8, back - 6.5], [19, back - 5.3], [19, back], [0, back]], 72);
  pb.add(motorBase, look.frame, undefined, { to: holder });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4 + 0.32;
    const len = hole - 17;
    const mid = 18 + len / 2;
    // Lumenfold struts are round in section, Kestrane's flat bars.
    pb.add(rbox(len, 3.2 * k, 3, look.soft ? 1.45 : 1.1, look.soft ? 4 : 2), look.frame, xf({ p: [Math.cos(a) * mid, Math.sin(a) * mid, back - 1.6], r: [0, 0, a + 0.12] }), { to: holder });
  }
  labels.text(`${brandName(look.brand)} ${look.name} · 12 V · 0.${size === 140 ? 30 : 25} A`, SPEC_TYPE, 1.15, xf({ p: [0, 0, back + 0.06], r: [0, 0, 0] }), { color: '#8c909a', to: holder });

  const rotorGroup = pb.group(`rotor:${zoneKey}`, holder);
  const blades = pb.group(`blades:${zoneKey}`, rotorGroup);
  // Frosted blades let light through, so they do not occlude: as opaque depth they darkened the white hub wall behind them
  // with the occlusion pass's noise.
  if (look.blade === 'frost') blades.userData.noAO = true;
  const hubR = 19;
  const hubProfile: [number, number][] = look.soft
    ? [[0, -face + 0.6], [11.6, -face + 0.6], [14.6, -face + 1.1], [16.9, -face + 2.3], [18.4, -face + 4.0], [hubR, -face + 5.8], [hubR, back - 7], [0, back - 7]]
    : [[0, -face + 0.6], [13.2, -face + 0.6], [16.8, -face + 1.8], [hubR, -face + 4.4], [hubR, back - 7], [0, back - 7]];
  // White Lumenfold hubs are molded too: a fine grain held to scale up close.
  // No bump: seen edge on, a bumped hub wall aliased into black hatching.
  // A soft graphite hub's broad domed rim showed the molded stipple as dents in its highlight, so it keeps only the grain.
  const hubMat = look.hub === 'plasticWhite' ? pb.own(Object.assign((mat('plasticWhite') as THREE.MeshPhysicalMaterial).clone(), { roughnessMap: textures().grainFine }))
    : look.soft ? pb.own(Object.assign((mat(look.hub) as THREE.MeshPhysicalMaterial).clone(), { bumpMap: null, roughnessMap: textures().grainFine })) : null;
  pb.add(lathe(hubProfile, 72), hubMat ?? look.hub, undefined, { to: rotorGroup });
  // The roots start well inside the hub, so no root end stands proud of the hub's rounded nose.
  // Lumenfold blades are broad paddles with little sweep; Kestrane's are narrow and swept.
  // The root chord keeps the root inside the hub's straight wall: the soft hub's rounded nose starts 5.8 mm in from its face,
  // and a wider root poked out through it.
  const bladeSpec = { r0: hubR - 2, r1: hole - 1.6, c0: look.soft ? 13 : 15 * k, c1: (look.blades === 7 ? 50 : look.soft ? 44 : 40) * k, pitch0: 0.86, pitch1: look.soft ? 0.36 : 0.42, sweep: look.soft ? 0.4 : 0.56, thick: 1.7, z: -0.8, nu: Math.round((look.soft ? 36 : 26) * detail), nv: Math.round((look.soft ? 22 : 16) * detail) };
  const bg = bladeGeometry(bladeSpec);
  let bladeMat: THREE.MeshPhysicalMaterial;
  const glow = { tex: { value: null as THREE.Texture | null }, spin: { value: 0 } };
  const hubLit = look.light === 'hub' || look.light === 'ring+hub';
  if (look.blade === 'smoke') {
    bladeMat = pb.own((mat('bladeSmoke') as THREE.MeshPhysicalMaterial).clone());
    // A shade lighter and less see-through than the stock smoke, so blades turned away from the softboxes still read.
    bladeMat.roughness = 0.5; bladeMat.color.setHex(0x1d1f25); bladeMat.opacity = 0.84;
  } else if (look.blade === 'frost') {
    bladeMat = pb.own((mat('bladeFrost') as THREE.MeshPhysicalMaterial).clone());
    bladeMat.specularIntensity = look.light === 'hub' ? 0.22 : 0.4;
    // Frosted white blades glow; drawn opaque, since sorting a translucent rotor against itself broke the roots into slivers.
    bladeMat.transparent = false; bladeMat.opacity = 1;
    // A fine frosted grain in the surface, so the blade face holds up close; roughness drifts slowly (a fine roughness grain
    // streaked where the box projection stretched it).
    bladeMat.roughnessMap = textures().mottle; bladeMat.bumpMap = textures().stipple; bladeMat.bumpScale = 1.6e-5;
    bladeMat.defines = { ...(bladeMat.defines ?? {}), WORLD_BUMP: '' };
  } else if (look.blade === 'frostDark') {
    // Frosted graphite: translucent and matte, so the edge light reaching the tips glows through them.
    bladeMat = pb.own((mat('bladeFrost') as THREE.MeshPhysicalMaterial).clone());
    // Satin molded faces with no bump: a stippled bump under the broad sheen read as hammered sheet up close.
    bladeMat.color.setHex(0x3d3f47); bladeMat.opacity = 0.84; bladeMat.roughness = 0.56; bladeMat.specularIntensity = 0.45;
    bladeMat.roughnessMap = textures().grainFine;
    // Only the outer third of each blade, nearest the frame strip, takes its glow.
    const r0 = (hole - 22).toFixed(1); const r1 = (hole - 3).toFixed(1);
    bladeMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFanP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFanP = position.xy;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFanP;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(${r0}, ${r1}, length(vFanP));`);
    };
    bladeMat.customProgramCacheKey = () => `fan-tip-${r0}-${r1}`;
  } else {
    bladeMat = pb.own((mat(look.blade) as THREE.MeshPhysicalMaterial).clone());
    bladeMat.roughness = 0.52; bladeMat.color.offsetHSL(0, 0, 0.02);
  }
  if (hubLit) {
    // Blades lit by the LEDs in the still hub: each point takes the color of the LEDs at its angle (the rotor's turn added
    // back), brightest at the root. Frosted blades carry the glow out to the tip; smoked ones only near the root.
    const r0 = (hubR + 2).toFixed(1); const r1 = (look.blade === 'frost' ? hole - 2 : hubR + 22).toFixed(1); const far = look.blade === 'frost' ? '0.45' : '0.0';
    bladeMat.onBeforeCompile = (sh) => {
      sh.uniforms.fanLedTex = glow.tex; sh.uniforms.fanSpin = glow.spin;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFanP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFanP = position.xy;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFanP;\nuniform sampler2D fanLedTex;\nuniform float fanSpin;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\nfloat fanU = fract((atan(vFanP.y, vFanP.x) + fanSpin) / 6.2831853);\ntotalEmissiveRadiance *= texture2D(fanLedTex, vec2(fanU, 0.5)).rgb * mix(1.0, ${far}, smoothstep(${r0}, ${r1}, length(vFanP)));`);
    };
    bladeMat.customProgramCacheKey = () => `fan-glow-${r0}-${r1}-${far}`;
  }
  // Molded blades have a satin face that drifts slowly in roughness, mapped in millimeters (blade geometry carries no uv of
  // its own). A fine grain read as grimy brushed metal on a dark blade.
  if (look.blade !== 'frost' && look.blade !== 'frostDark') bladeMat.roughnessMap = textures().mottle;
  // Drawn opaque like the white frosted blades: a translucent rotor sorted against itself into stepped overlaps.
  if (look.blade === 'frostDark') { bladeMat.transparent = false; bladeMat.opacity = 1; }
  const bladeUv = 'box';
  for (let i = 0; i < look.blades; i++) pb.add(bg.clone(), bladeMat, xf({ r: [0, 0, (i / look.blades) * PI * 2] }), { to: blades, uv: bladeUv });
  bg.dispose();
  const discMat = pb.own(new THREE.MeshBasicMaterial({ map: pb.own(blurDiscTexture(look.blades, look.blade === 'frost' || look.frame === 'plasticWhite')), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const disc = pb.mesh(new THREE.RingGeometry(hubR - 1, hole - 1.2, 72, 1), discMat, at(0, 0, -0.8), { to: rotorGroup });
  disc.visible = false;
  disc.userData.flexible = true;
  const sticker = new THREE.Shape(); sticker.absarc(0, 0, look.soft ? 11.2 : 13, 0, PI * 2, false);
  // A satin white sticker: a gloss one mirrored a softbox edge straight across its middle.
  // Matte paper stock: a glossy one mirrored the softbox's straight edge across the disc as a seam.
  const whiteSticker = look.frame === 'plasticWhite' ? pb.own(new THREE.MeshPhysicalMaterial({ color: 0xe6e7ea, roughness: 0.72, specularIntensity: 0.4, roughnessMap: textures().grainFine, bumpMap: textures().stipple, bumpScale: 5e-6 })) : null;
  if (whiteSticker) whiteSticker.defines = { WORLD_BUMP: '' };
  pb.add(extrude(sticker, 0.25, 0, 'xy', 48), whiteSticker ?? 'sticker', at(0, 0, -face + 0.35), { to: rotorGroup });
  labels.text(brandName(look.brand), BRAND_TYPE[look.brand] ?? SPEC_TYPE, 2.3 * Math.min(1, 9 / brandName(look.brand).length), xf({ p: [0, 1.2, -face + 0.3], r: [0, PI, 0] }), { color: look.frame === 'plasticWhite' ? '#5d616b' : '#b9bdc6', to: rotorGroup });
  labels.text(look.name, SPEC_TYPE, 1.1, xf({ p: [0, -3.4, -face + 0.3], r: [0, PI, 0] }), { color: look.frame === 'plasticWhite' ? '#80848d' : '#7c808a', to: rotorGroup });
  out.rotors.push({ obj: rotorGroup, axis: 'z', speed: 1, blades, disc });

  // The lead runs beside the first strut from the motor base to the duct, rises into a groove in the back flange and leaves
  // over the frame's edge, as fan leads are routed. Strung across the open throat it read as a fifth strut.
  const sa = PI / 4 + 0.32; const sd = sa + 0.12;
  const sLen = hole - 17; const sMid = 18 + sLen / 2; const off = 1.6 * k + 1.5;
  const along = (s: number, z: number): Vec => [Math.cos(sa) * sMid + Math.cos(sd) * s - Math.sin(sd) * off, Math.sin(sa) * sMid + Math.sin(sd) * s + Math.cos(sd) * off, z];
  const sEdge = (half - 1.2 - Math.sin(sa) * sMid - Math.cos(sd) * off) / Math.sin(sd);
  const edge = along(sEdge, face - 0.3);
  const xe = edge[0];
  const ce = half - R + (R + 2.2) * Math.SQRT1_2;
  const lead0: Vec[] = [along(-sLen / 2 + 1.5, back - 2), along(sLen / 2 - 7, back - 2), along(sLen / 2 - 1, face - 1), along(sLen / 2 + 3, face - 0.3), edge, [xe + 0.6, half + 1.9, face - 2.6]];
  const cablePts: Vec[] = opts.loose
    ? [...lead0, [xe + 10, half + 2.6, face - 5], [ce, ce, face - 6.5], [half + 3, half - 14, back - 8], [half + 3.2, half - 30, back - 8], [half + 3.4, half - 46, back - 8]]
    : opts.tucked
    ? [...lead0, [xe - 2, half + 1.7, face - 4.5], [hp - 33, half + 1.7, back - 6]]
    : [...lead0, [xe + 8, half + 2.6, face - 5], [half + 2, half + 8, back - 8], [half + 6, half + 22, back - 10]];
  const lead = pb.mesh(tube(cablePts, 1.4, 48, 8), mat('rubber'), undefined, { to: holder });
  if (opts.tucked) pb.add(rbox(10.6, 5.4, 7.4, 0.6, 2), 'plasticDark', at(hp - 39, half + 1.7, back - 6), { to: holder });
  if (opts.loose) {
    pb.add(rbox(5.4, 10.6, 7.4, 0.6, 2), 'plasticDark', at(half + 3.4, half - 51.5, back - 8), { to: holder });
    pb.add(new THREE.BoxGeometry(3.6, 0.4, 5.8), 'darkVoid', at(half + 3.4, half - 56.9, back - 8), { to: holder, uv: 'keep' });
  }
  lead.userData.flexible = true;

  const ring = (key: string, radius: number, count: number, faces: number[], intensity: number, tubeR = 1.55) => {
    const leds = Array.from({ length: count }, (_, i) => { const a = (i / count) * PI * 2; return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0); });
    const z = new Zone(key, 'fans', true, leds, hashPhase(key));
    const dm = z.diffuser(intensity, 0x121316, 0.85);
    for (const fz of faces) {
      const dmesh = pb.mesh(torus(radius, tubeR, 10, Math.round(96 * detail)), dm, at(0, 0, fz), { to: holder, uv: 'keep' });
      // A hub ring sits 1.4 mm off the hub wall; the occlusion pass filled that crevice with noise.
      if (radius < half * 0.6) dmesh.userData.noAO = true;
      // The face against the mount sends its light out of the case, so it ranks last for a lamp.
      const outward = opts.mountSide !== undefined && opts.mountSide !== 0 && Math.sign(fz) === opts.mountSide;
      // A case fan's inner face lights the case around it: the tray, the shroud and the card's front end.
      const mounted = opts.mountSide !== undefined && opts.mountSide !== 0;
      // A hub ring's lamp is the ring's own size and stands just outside the fan's face: a frame sized lamp in the ring's
      // plane sat behind the hub's face, and the area light's horizon cut drew a hard line across the sticker.
      const hubRing = radius < half * 0.6;
      const s = hubRing ? 2 * radius + 6 : D.size * 0.8;
      const ez = hubRing ? (Math.sign(fz) || -1) * (face + 1.5) : fz;
      z.emit(new THREE.Vector3(0, 0, ez), new THREE.Vector3(0, 0, Math.sign(fz) || -1), s, s, outward ? 0.3 : mounted ? 1.4 : 0.8);
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
    if (!hubLit) z.listeners.push((c) => bladeMat.emissive.copy(c).multiplyScalar(0.05));
    for (const sd of [1, -1]) pb.mesh(cornerSpill(hole + 2.9, half - 0.4, 10), z.spill(look.frame === 'plasticWhite' ? 0.16 : sd === opts.mountSide ? 0.45 : 0.24), at(0, 0, sd * (t / 2 + 0.06)), { to: holder, uv: 'keep' }).userData.spill = true;
  }
  // The hub ring's light on the hub nose just inside it.
  const noseAt: [number, number][] = look.soft
    ? [[hubR, -face + 5.8], [18.4, -face + 4.0], [16.9, -face + 2.3], [14.6, -face + 1.1], [11.6, -face + 0.6], [8, -face + 0.6]]
    : [[hubR, -face + 4.4], [16.8, -face + 1.8], [13.2, -face + 0.6], [8, -face + 0.6]];
  const nose = noseAt.map(([r, z]): [number, number] => [r + 0.06, z - 0.06]);
  if (look.light === 'ring+hub') {
    // The ring is set into the hub's rounded nose, between the sticker and the rim. Around the hub's wall the blade roots
    // crossed behind it and read through it as if it were clear plastic. At 1.3 its cyan went pale.
    const hr = 15.4; const hz0 = -face + 1.15;
    const hz = ring(`${zoneKey}:hub`, hr, 12, [hz0], 0.8, 1.25);
    glow.tex.value = hz.tex;
    bladeMat.emissive.setScalar(0.3);
    hz.listeners.push(() => { glow.spin.value = rotorGroup.rotation.z; });
    const lift = ([r, z]: [number, number]): [number, number] => [r + 0.06, z - 0.06];
    const outward: [number, number][] = [[hr + 1.3, -face + 1.45], [16.8, -face + 1.8], [hubR, -face + 4.4], [hubR, -face + 9]];
    const inward: [number, number][] = [[hr - 1.3, -face + 1.0], [13.2, -face + 0.6], [8, -face + 0.6]];
    pb.mesh(hubSpill(outward.map(lift), 72), hz.spill(0.42), undefined, { to: holder, uv: 'keep' }).userData.spill = true;
    pb.mesh(hubSpill(inward.map(lift), 72), hz.spill(0.32), undefined, { to: holder, uv: 'keep' }).userData.spill = true;
  }
  if (look.light === 'hub') {
    const hz = ring(`${zoneKey}`, hubR + 1.4, 12, [-face + 4.6], 1.4);
    glow.tex.value = hz.tex;
    // Kept under the tone curve's shoulder, where a cyan glow over a frosted white body washed to near white.
    bladeMat.emissive.setScalar(0.8);
    // Lit, the glow carries the color, so the frosted body steps down from white as the LEDs come up.
    const white = new THREE.Color(0xe2e4ea); const lit = new THREE.Color(0x2c2e34);
    pb.mesh(hubSpill(nose, 72), hz.spill(0.22), undefined, { to: holder, uv: 'keep' }).userData.spill = true;
    // The glowing blades light the white duct around them and the struts and motor base behind them.
    const duct = cyl(hole - 0.05, t - 2 * fl - 0.8, 'z', Math.round(96 * detail), hole - 0.05, true); duct.rotateZ(PI / 2);
    uvAroundZ(duct);
    // The frosted white frame glows in the blades' colors where they pass it.
    const ductLight = pb.own(hz.tint(1.0, 0.72, false)); ductLight.side = THREE.BackSide;
    pb.mesh(duct, ductLight, undefined, { to: holder, uv: 'keep' }).userData.spill = true;
    // And the back flange around the duct mouth.
    pb.mesh(cornerSpill(hole + 2.9, half - 0.4, 10), pb.own(hz.tint(1.0, 0.35)), at(0, 0, t / 2 + 0.06), { to: holder, uv: 'keep' }).userData.spill = true;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4 + 0.32; const len = hole - 17; const sMid = 18 + len / 2;
      const q = new THREE.PlaneGeometry(len, 3.2 * k); q.rotateX(PI);
      const quv = q.getAttribute('uv'); const qp = q.getAttribute('position');
      for (let n = 0; n < qp.count; n++) quv.setXY(n, ((a + 0.12) / (PI * 2) + 1) % 1, (qp.getX(n) + len / 2) / len);
      pb.mesh(q, pb.own(hz.tint(1.0, 0.6, false)), xf({ p: [Math.cos(a) * sMid, Math.sin(a) * sMid, back - 3.12], r: [0, 0, a + 0.12] }), { to: holder, uv: 'keep' }).userData.spill = true;
      // Light through the frosted blades reaches the struts' back faces too, softer.
      pb.mesh(q.clone(), pb.own(hz.tint(1.0, 0.55, false)), xf({ p: [Math.cos(a) * sMid, Math.sin(a) * sMid, back - 0.08], r: [0, 0, a + 0.12] }), { to: holder, uv: 'keep' }).userData.spill = true;
    }
    hz.listeners.push((c) => {
      glow.spin.value = rotorGroup.rotation.z;
      bladeMat.color.copy(white).lerp(lit, Math.min(1, 1.6 * Math.max(c.r, c.g, c.b)));
    });
  }
  if (look.light === 'edge') {
    // Set into the flange face on the frame's own radius, clear of the duct, along a smooth closed path.
    const inset = 1.6;
    const pts = rrect(new THREE.Path(), -half + inset, -half + inset, D.size - 2 * inset, D.size - 2 * inset, R - inset).getSpacedPoints(240).slice(0, 240).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const loop = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const leds = loop.getSpacedPoints(64).slice(0, 64);
    const z = new Zone(zoneKey, 'fans', true, leds, hashPhase(zoneKey));
    z.owner = holder;
    const dm = z.diffuser(0.7, 0x26272c, 0.3);
    // The strip's light on the flange face inside it (faded out over the duct) and on the frame's outer rim beside it.
    const faceSpill = pb.own(z.spill(0.5).clone()); faceSpill.vertexColors = true;
    const rimLoop = rrect(new THREE.Path(), -half - 0.05, -half - 0.05, D.size + 0.1, D.size + 0.1, R + 0.05).getSpacedPoints(240).slice(0, 240);
    for (const fz of [-face + 0.3, face - 0.3]) {
      const g = new THREE.TubeGeometry(loop, 320, 1.0, 8, true);
      g.translate(0, 0, fz);
      pb.mesh(g, dm, undefined, { to: holder, uv: 'keep' });
      z.emit(new THREE.Vector3(0, 0, fz), new THREE.Vector3(0, 0, Math.sign(fz)), D.size, D.size, 0.8);
      const sgn = Math.sign(fz);
      pb.mesh(edgeFaceSpill(loop, 240, 1.1, 8, sgn * (face + 0.05), hole), faceSpill, undefined, { to: holder, uv: 'keep' }).userData.spill = true;
      pb.mesh(edgeRimSpill(rimLoop, sgn * face, sgn * (face - fl)), z.spill(0.32), undefined, { to: holder, uv: 'keep' }).userData.spill = true;
    }
    // The strip's light glows through the frosted tips and fades toward the hub.
    z.listeners.push((c) => bladeMat.emissive.copy(c).multiplyScalar(0.22));
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

/** A thin shell over a lathe profile, given from the lit rim inward as [r, z]: u around (the ring's LED angle), v inward. */
function hubSpill(profile: [number, number][], segments: number): THREE.BufferGeometry {
  const lens = [0];
  for (let j = 1; j < profile.length; j++) lens.push(lens[j - 1]! + Math.hypot(profile[j]![0] - profile[j - 1]![0], profile[j]![1] - profile[j - 1]![1]));
  const total = lens[lens.length - 1]!;
  const pos: number[] = []; const uv: number[] = []; const idx: number[] = [];
  profile.forEach(([r, z], j) => {
    for (let i = 0; i <= segments; i++) { const a = (i / segments) * PI * 2; pos.push(Math.cos(a) * r, Math.sin(a) * r, z); uv.push(i / segments, lens[j]! / total); }
  });
  for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i; const b = a + segments + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** A band on a flange face inward from a closed strip, u along the strip, v inward; vertex color fades it out over the duct. */
function edgeFaceSpill(loop: THREE.Curve<THREE.Vector3>, n: number, from: number, depth: number, z: number, duct: number): THREE.BufferGeometry {
  const pos: number[] = []; const uv: number[] = []; const col: number[] = []; const idx: number[] = [];
  const rows = 6;
  for (let i = 0; i <= n; i++) {
    const p = loop.getPointAt((i % n) / n); const t = loop.getTangentAt((i % n) / n);
    const inward = new THREE.Vector3(-t.y, t.x, 0).normalize();
    if (inward.dot(p) > 0) inward.negate();
    for (let j = 0; j <= rows; j++) {
      const d = from + (depth * j) / rows;
      const x = p.x + inward.x * d; const y = p.y + inward.y * d;
      const k = THREE.MathUtils.smoothstep(Math.hypot(x, y), duct + 0.3, duct + 1.8);
      pos.push(x, y, z); uv.push(i / n, j / rows); col.push(k, k, k);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) {
    const a = i * (rows + 1) + j; const b = a + rows + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** A band on the frame's outer rim beside the strip, from the lit face (v 0) back across the flange's thickness. */
function edgeRimSpill(rim: THREE.Vector2[], z0: number, z1: number): THREE.BufferGeometry {
  const n = rim.length;
  const pos: number[] = []; const uv: number[] = []; const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = rim[i % n]!;
    pos.push(p.x, p.y, z0, p.x, p.y, z1); uv.push(i / n, 0, i / n, 1);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** u around the z axis, for a duct lining that takes a ring's colors by angle. */
function uvAroundZ(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position'); const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.atan2(p.getY(i), p.getX(i)) / (PI * 2) + 1) % 1, 0.5);
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
