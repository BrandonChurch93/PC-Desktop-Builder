import * as THREE from 'three';
import { brandName, getRam } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { ramBoxes } from '../layout/partBoxes';
import { extrude, PartBuilder, rbox, roundedPoly, xf } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { fingerMaterial, stripPlane } from '../kit/pcb';
import { seededFor } from '../kit/rng';
import { BRAND_TYPE, MODEL_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { spillStripRange, stripLeds, uvAlong, Zone } from '../light/zones';
import type { GenOpts, PartObject } from './types';

const HALF = DIMS.dimmLength / 2;
const PCB_H = 31.25;
const PCB_T = 1.27;
const NOTCH = 5.6;

/** Maps a shape drawn in (stick y, stick z) and extruded along its z onto the stick's axes: length y, height z, thickness x. */
const TO_STICK = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

/** A plane facing +x (side 1) or -x (side -1) of the stick, text running along it and up along z. */
const onSide = (side: number, x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(side > 0 ? TO_STICK : new THREE.Matrix4().makeRotationZ(Math.PI).multiply(TO_STICK));

/**
 * A faceted relief on the spreader plate, in plate space (x along the stick, y up, z out of the plate face): two planes meet at a
 * crowned ridge along its length, with a chamfer all round, so each plane catches the light differently. A raised flat plate
 * shaded exactly like the plate under it and read as a black slab.
 */
function facetRelief(pts: [number, number][], rim: number, ridge: number, out: 1 | -1): THREE.BufferGeometry {
  const [a, b, c, d] = pts.map(([x, y]) => new THREE.Vector2(x, y)) as [THREE.Vector2, THREE.Vector2, THREE.Vector2, THREE.Vector2];
  const len = a.distanceTo(b); const ht = a.distanceTo(d); const ch = 0.45; const crown = 0.5;
  const S = [0, ch / len, (2 * ch) / len, 1 - (2 * ch) / len, 1 - ch / len, 1];
  const FS = [0, 0.22, 99, 99, 0.22, 0];
  const T = [0, ch / ht, 0.5 - crown / ht, 0.5 + crown / ht, 1 - ch / ht, 1];
  const FT = [0, 0.22, ridge - rim, ridge - rim, 0.22, 0];
  const pos: number[] = []; const uv: number[] = [];
  const P = (s: number, t: number, z: number) => { const p = a.clone().lerp(b, s).lerp(d.clone().lerp(c, s), t); return new THREE.Vector3(p.x, p.y, z * out); };
  const tri = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3) => { for (const v of out > 0 ? [p, q, r] : [p, r, q]) { pos.push(v.x, v.y, v.z); uv.push(v.x, v.y); } };
  const H = (i: number, j: number) => rim + Math.min(FS[i]!, FT[j]!);
  for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < T.length - 1; j++) {
    const p00 = P(S[i]!, T[j]!, H(i, j)); const p10 = P(S[i + 1]!, T[j]!, H(i + 1, j));
    const p11 = P(S[i + 1]!, T[j + 1]!, H(i + 1, j + 1)); const p01 = P(S[i]!, T[j + 1]!, H(i, j + 1));
    tri(p00, p10, p11); tri(p00, p11, p01);
  }
  const base = -0.3;
  const wall = (p: THREE.Vector2, q: THREE.Vector2) => {
    const p0 = new THREE.Vector3(p.x, p.y, base * out); const q0 = new THREE.Vector3(q.x, q.y, base * out);
    const q1 = new THREE.Vector3(q.x, q.y, rim * out); const p1 = new THREE.Vector3(p.x, p.y, rim * out);
    tri(p0, q0, q1); tri(p0, q1, p1);
  };
  wall(a, b); wall(b, c); wall(c, d); wall(d, a);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * The bar's light on a facet, as an additive skin over it: brighter on the plane and chamfers that tilt up toward the bar
 * above, fading with distance below it. A flat spill layer lit both planes alike and hid the facets.
 */
function facetGlow(relief: THREE.BufferGeometry, barZ: number, u0: number, u1: number): THREE.BufferGeometry {
  const g = relief.clone();
  const pos = g.getAttribute('position'); const nrm = g.getAttribute('normal');
  const col: number[] = []; const uv: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const nx = nrm.getX(i); const ny = nrm.getY(i); const nz = nrm.getZ(i);
    pos.setXYZ(i, pos.getX(i) + nx * 0.03, pos.getY(i) + ny * 0.03, pos.getZ(i) + nz * 0.03);
    const k = Math.exp(-Math.max(0, barZ - pos.getY(i)) / 9) * (0.12 + 2.4 * Math.max(0, ny));
    col.push(k, k, k);
    uv.push(Math.min(1, Math.max(0, (pos.getX(i) - u0) / (u1 - u0))), 0.5);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

type Line = 'facet' | 'mono' | 'crown';
const lineOf = (id: string): Line => (id.startsWith('mono') ? 'mono' : id.startsWith('crown') ? 'crown' : 'facet');

export function ramPart(id: string, opts: GenOpts = {}): PartObject {
  const spec = getRam(id);
  const line = lineOf(id);
  const height = spec?.height ?? 44;
  const frost = spec?.finish === 'frost';
  const key = opts.key ?? `ram:${id}`;
  const pb = new PartBuilder(`ram-${id}`);
  const labels = new Labels(pb, 26);

  const outline: [number, number][] = [
    [-HALF, 0], [NOTCH - 0.8, 0], [NOTCH - 0.8, 3.4], [NOTCH + 0.8, 3.4], [NOTCH + 0.8, 0], [HALF, 0],
    [HALF, 13.6], [HALF - 2.4, 14.6], [HALF - 2.4, 17.8], [HALF, 18.8], [HALF, PCB_H],
    [-HALF, PCB_H], [-HALF, 18.8], [-HALF + 2.4, 17.8], [-HALF + 2.4, 14.6], [-HALF, 13.6],
  ];
  const pcb = extrude(roundedPoly(outline, 0.35), PCB_T, 0.15, 'xy', 4);
  pcb.translate(0, 0, -PCB_T / 2);
  pb.add(pcb, frost ? 'pcbWhite' : 'pcbBlack', TO_STICK);
  const fingers = fingerMaterial('ddr5', DIMS.dimmLength, 4.2, 0.85, [[HALF + NOTCH - 0.8, HALF + NOTCH + 0.8]], frost ? 'rgba(220,222,226,1)' : 'rgba(14,16,20,1)');
  for (const side of [1, -1]) {
    const g = stripPlane(DIMS.dimmLength, 4.2);
    pb.mesh(g, fingers, onSide(side, side * (PCB_T / 2 + 0.02), 0, 0), { uv: 'keep' });
  }
  const rng = seededFor(id);
  for (let i = 0; i < 24; i++) {
    const y = -HALF + 5 + (i / 23) * (DIMS.dimmLength - 10);
    for (const side of [1, -1]) pb.add(rbox(0.5, 1.0, 0.5, 0.1, 1), rng() > 0.4 ? 'ceramic' : 'chip', xf({ p: [side * (PCB_T / 2 + 0.25), y, 5.6] }));
  }

  const spreaderBottom = 7.6;
  const barH = line === 'crown' ? 15 : line === 'facet' ? 7.5 : 0;
  const plateTop = line === 'mono' ? height : height - barH + 1.2;
  const plateT = 1.55;
  const gap = PCB_T / 2 + 0.75;
  const plateMat = frost ? 'aluWhite' : line === 'mono' ? 'aluBlack' : 'aluBrushedDark';
  // The latch cutouts in the board ends stay open: the spreader is notched to match.
  const rN: [number, number][] = [[HALF - 0.3, 13.0], [HALF - 3.4, 14.2], [HALF - 3.4, 18.2], [HALF - 0.3, 19.4]];
  const lN: [number, number][] = [[-HALF + 0.3, 19.4], [-HALF + 3.4, 18.2], [-HALF + 3.4, 14.2], [-HALF + 0.3, 13.0]];
  const prof: [number, number][] = line === 'mono'
    ? [[-HALF + 0.3, spreaderBottom], [HALF - 0.3, spreaderBottom], ...rN, [HALF - 0.3, plateTop - 3], [HALF - 3.3, plateTop], [-HALF + 3.3, plateTop], [-HALF + 0.3, plateTop - 3], ...lN]
    : [[-HALF + 0.3, spreaderBottom], [HALF - 0.3, spreaderBottom], ...rN, [HALF - 0.3, plateTop - 5.5], [HALF - 6.5, plateTop], [9.5, plateTop], [5.5, plateTop - 2.6], [-5.5, plateTop - 2.6], [-9.5, plateTop], [-HALF + 6.5, plateTop], [-HALF + 0.3, plateTop - 5.5], ...lN];
  const reliefs: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    const g = extrude(roundedPoly(prof, 0.6), plateT, 0.55, 'xy', 6, 1);
    g.translate(0, 0, side > 0 ? gap : -gap - plateT);
    pb.add(g, plateMat, TO_STICK);
    if (line !== 'mono') {
      const facet = (pts: [number, number][]) => {
        const f = facetRelief(pts, 0.25, 1.3, side > 0 ? 1 : -1);
        f.translate(0, 0, side * (gap + plateT));
        reliefs.push(f.clone());
        pb.add(f, frost ? plateMat : 'aluFacet', TO_STICK, { uv: 'keep' });
      };
      const top = plateTop - 6; const low = spreaderBottom + 6;
      facet([[-HALF + 8, low], [-14, low], [-4, top - 4], [-HALF + 14, top - 4]]);
      // The back carries the kit label on flat plate where the second facet would be.
      if (side > 0) facet([[14, low], [HALF - 8, low], [HALF - 14, top - 4], [4, top - 4]]);
    }
  }

  const face = gap + plateT;
  const brand = brandName(spec?.brand ?? 'calyra');
  const printColor = frost ? '#6a6e78' : '#c3c7cf';
  {
    const side = 1;
    const m = (y: number, z: number) => onSide(side, side * (face + 0.04), y, z);
    // Faceted lines carry their marks on the flat plate between and below the facets; the plain line keeps them high and wide.
    const mono = line === 'mono';
    labels.text(brand, BRAND_TYPE[spec?.brand ?? 'calyra'] ?? SPEC_TYPE, mono ? 3.4 : 3.1, m(mono ? -30 : 0, mono ? height * 0.58 : spreaderBottom + 7.9), { color: printColor });
    labels.text(line === 'facet' ? 'FACET' : line === 'crown' ? 'CROWN' : 'MONO', MODEL_TYPE, mono ? 2.0 : 1.8, m(mono ? -30 : 0, mono ? height * 0.58 - 4.6 : spreaderBottom + 4.2), { color: frost ? '#8c909a' : '#8a8e98' });
    labels.text(`DDR5 · ${spec?.gbPerStick ?? 16} GB`, MODEL_TYPE, mono ? 2.0 : 1.8, m(mono ? 30 : 0, mono ? height * 0.58 - 2.3 : spreaderBottom + 1.7), { color: frost ? '#8c909a' : '#8a8e98' });
  }
  const capacity = `${spec?.gbPerStick ?? 16} GB DDR5`;
  const labelW = 46; const labelH = 13;
  const lz = spreaderBottom + 3 + labelH / 2;
  const labelPlate = new THREE.BoxGeometry(0.16, labelW, labelH);
  pb.add(labelPlate, 'labelPaper', xf({ p: [-(face + 0.08), 28, lz] }));
  labels.draw(labelW, labelH, (g, W, H) => {
    g.fillStyle = 'rgba(222,223,226,1)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(28,30,34,1)';
    const s = W / labelW;
    g.font = `700 ${2.6 * s}px "DM Sans Variable"`; g.textBaseline = 'top';
    g.fillText(`${brand.toUpperCase()} ${line.toUpperCase()}  ${capacity}`, 1.6 * s, 1.2 * s);
    g.font = `500 ${1.45 * s}px "DM Sans Variable"`;
    g.fillText(`CL${line === 'crown' ? 32 : line === 'mono' ? 40 : 36}  1.35 V  ${line === 'mono' ? '5600' : '6000'} MT/s  ${spec?.sticks ?? 2} x ${spec?.gbPerStick ?? 16} GB`, 1.6 * s, 4.6 * s);
    g.fillText(`CY-${id.toUpperCase()}-${spec?.sticks ?? 2}K  LOT 2611`, 1.6 * s, 6.6 * s);
    const r = seededFor(`bar-${id}`);
    let x = 1.6 * s;
    while (x < W - 14 * s) { const w = (0.18 + r() * 0.5) * s; g.fillRect(x, 8.8 * s, w, 3 * s); x += w + (0.18 + r() * 0.4) * s; }
    g.strokeStyle = 'rgba(28,30,34,1)'; g.lineWidth = 0.15 * s; g.strokeRect(W - 11.5 * s, 8.2 * s, 9.8 * s, 3.8 * s);
    g.font = `600 ${1.3 * s}px "DM Sans Variable"`; g.fillText('DDR5 UDIMM', W - 11 * s, 9.4 * s);
  }, onSide(-1, -(face + 0.18), 28, lz));
  labels.text(`${spec?.gbPerStick ?? 16} GB`, TINY_TYPE, 1.2, onSide(1, PCB_T / 2 + 0.03, -HALF + 12, 6.2), { color: '#9aa0a8' });

  const zones: Zone[] = [];
  if (barH > 0) {
    const barW = 2 * (gap + plateT) - 0.6;
    const z0 = plateTop - 1.6; const z1 = height;
    const zone = new Zone(key, 'ram', false, stripLeds(new THREE.Vector3(0, -HALF + 3, z1 - 2), new THREE.Vector3(0, HALF - 3, z1 - 2), 7.4), 0.2 + (key.length % 7) * 0.09);
    const diff = zone.diffuser(line === 'crown' ? 0.5 : 0.48, frost ? 0xd9dbe0 : 0x1d1e23, 0.7);
    // The bar follows the notch in the spreader's top line, so the notch reads with the light on.
    const half = (DIMS.dimmLength - 2) / 2;
    const barProfile: [number, number][] = line === 'facet'
      ? [[-half, z0], [half, z0], [half, z1 - 1.2], [half - 1.2, z1], [9.5, z1], [5.5, z1 - 2.6], [-5.5, z1 - 2.6], [-9.5, z1], [-half + 1.2, z1], [-half, z1 - 1.2]]
      : [[-half, z0], [half, z0], [half, z1 - 1.2], [half - 1.2, z1], [-half + 1.2, z1], [-half, z1 - 1.2]];
    const bar = extrude(roundedPoly(barProfile, 0.8), barW, 0.6, 'xy', 4, 2);
    bar.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    bar.translate(-barW / 2, 0, -(z0 + z1) / 2);
    uvAlong(bar, 'y');
    pb.mesh(bar, diff, xf({ p: [0, 0, (z0 + z1) / 2] }), { uv: 'keep' });
    const spill = zone.spill(frost ? 0.2 : 0.22);
    // The bar's light on the plate, under the facets, which take it through their own skin below.
    // One strip from the rim's top edge down, the whole length: split strips met in a visible seam at the notch.
    const total = DIMS.dimmLength - 3; const outer = (DIMS.dimmLength - 14) / 2;
    for (const sd of [1, -1]) {
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(sd, 0, 0)).setPosition(sd * (gap + plateT + 0.05), 0, z0 + 1.1);
      pb.mesh(spillStripRange(total, -outer, outer, 6, 16), spill, m, { uv: 'keep' }).userData.spill = true;
    }
    // The white kit label on the back takes the bar's light as well, fading down from its top edge.
    if (line !== 'mono') {
      const lt = spreaderBottom + 3 + 13;
      const lm = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)).setPosition(-(gap + plateT + 0.24), 0, lt);
      const ls = pb.mesh(spillStripRange(total, 28 - 23, 28 + 23, 13, 12), zone.spill(frost ? 0.18 : 0.32), lm, { uv: 'keep' });
      // Drawn after the label's print, which is blended and was covering it.
      ls.userData.spill = true; ls.renderOrder = 6;
    }
    const glow = pb.own(new THREE.MeshBasicMaterial({ map: zone.tex, vertexColors: true, color: new THREE.Color(0.4, 0.4, 0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    for (const r of reliefs) pb.mesh(facetGlow(r, z0, -HALF + 3, HALF - 3), glow, TO_STICK, { uv: 'keep' }).userData.spill = true;
    if (line === 'crown') {
      for (let i = 0; i < 9; i++) pb.add(rbox(barW + 0.4, 0.8, 1.2, 0.3, 1), 'aluWhite', xf({ p: [0, -HALF + 10 + i * 14.2, z0 + 0.6] }));
    } else {
      pb.add(rbox(barW + 0.6, DIMS.dimmLength - 0.8, 1.4, 0.5, 2), plateMat, xf({ p: [0, 0, z0 + 0.4] }));
    }
    zone.emit(new THREE.Vector3(0, 0, z1), new THREE.Vector3(0, 0, 1), DIMS.dimmLength, 8, 0.9, new THREE.Vector3(0, 1, 0));
    zone.emit(new THREE.Vector3(face, 0, z1 - 4), new THREE.Vector3(1, 0, 0), DIMS.dimmLength, 8, 0.5, new THREE.Vector3(0, 1, 0));
    zone.emit(new THREE.Vector3(-face, 0, z1 - 4), new THREE.Vector3(-1, 0, 0), DIMS.dimmLength, 8, 0.5, new THREE.Vector3(0, 1, 0));
    zones.push(zone);
  }
  labels.finish();
  const done = pb.finish();
  return { root: done.root, boxes: ramBoxes(id), anchors: {}, zones, rotors: [], movers: {}, dispose: () => { done.dispose(); for (const z of zones) z.dispose(); } };
}
