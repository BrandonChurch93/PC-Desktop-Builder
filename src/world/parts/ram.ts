import * as THREE from 'three';
import { brandName, getRam } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { ramBoxes } from '../layout/partBoxes';
import { extrude, PartBuilder, polyShape, rbox, roundedPoly, xf } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { fingerMaterial, stripPlane } from '../kit/pcb';
import { seededFor } from '../kit/rng';
import { BRAND_TYPE, MODEL_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { stripLeds, uvAlong, Zone } from '../light/zones';
import type { GenOpts, PartObject } from './types';

const HALF = DIMS.dimmLength / 2;
const PCB_H = 31.25;
const PCB_T = 1.27;
const NOTCH = 5.6;

/** Maps a shape drawn in (stick y, stick z) and extruded along its z onto the stick's axes: length y, height z, thickness x. */
const TO_STICK = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

/** A plane facing +x (side 1) or -x (side -1) of the stick, text running along it and up along z. */
const onSide = (side: number, x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(side > 0 ? TO_STICK : new THREE.Matrix4().makeRotationZ(Math.PI).multiply(TO_STICK));

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
  const plateMat = frost ? 'aluWhite' : line === 'mono' ? 'aluBlack' : 'aluSatinDark';
  const prof: [number, number][] = line === 'mono'
    ? [[-HALF + 0.3, spreaderBottom], [HALF - 0.3, spreaderBottom], [HALF - 0.3, plateTop - 3], [HALF - 3.3, plateTop], [-HALF + 3.3, plateTop], [-HALF + 0.3, plateTop - 3]]
    : [[-HALF + 0.3, spreaderBottom], [HALF - 0.3, spreaderBottom], [HALF - 0.3, plateTop - 5.5], [HALF - 6.5, plateTop], [9.5, plateTop], [5.5, plateTop - 2.6], [-5.5, plateTop - 2.6], [-9.5, plateTop], [-HALF + 6.5, plateTop], [-HALF + 0.3, plateTop - 5.5]];
  for (const side of [1, -1]) {
    const g = extrude(roundedPoly(prof, 0.6), plateT, 0.55, 'xy', 6, 1);
    g.translate(0, 0, side > 0 ? gap : -gap - plateT);
    pb.add(g, plateMat, TO_STICK);
    if (line !== 'mono') {
      const facet = (pts: [number, number][]) => {
        const f = extrude(polyShape(pts), 0.9, 0.42, 'xy', 2, 1);
        f.translate(0, 0, side > 0 ? gap + plateT - 0.3 : -gap - plateT - 0.6);
        pb.add(f, plateMat, TO_STICK);
      };
      const top = plateTop - 6; const low = spreaderBottom + 6;
      facet([[-HALF + 8, low], [-14, low], [-4, top - 4], [-HALF + 14, top - 4]]);
      facet([[14, low], [HALF - 8, low], [HALF - 14, top - 4], [4, top - 4]]);
    }
  }

  const face = gap + plateT + (line === 'mono' ? 0 : 0.62);
  const brand = brandName(spec?.brand ?? 'calyra');
  const printColor = frost ? '#6a6e78' : '#c3c7cf';
  for (const side of [1, -1]) {
    const m = (y: number, z: number) => onSide(side, side * (face + 0.04), y, z);
    labels.text(brand, BRAND_TYPE[spec?.brand ?? 'calyra'] ?? SPEC_TYPE, 3.4, m(side * -30, line === 'mono' ? height * 0.58 : height * 0.5), { color: printColor });
    labels.text(line === 'facet' ? 'FACET' : line === 'crown' ? 'CROWN' : 'MONO', MODEL_TYPE, 2.0, m(side * -30, (line === 'mono' ? height * 0.58 : height * 0.5) - 4.6), { color: frost ? '#8c909a' : '#8a8e98' });
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
    const diff = zone.diffuser(line === 'crown' ? 0.75 : 0.85, frost ? 0xd9dbe0 : 0x2a2b31, 0.42);
    const bar = rbox(barW, DIMS.dimmLength - 2, z1 - z0, 1.8, 3);
    uvAlong(bar, 'y');
    pb.mesh(bar, diff, xf({ p: [0, 0, (z0 + z1) / 2] }), { uv: 'keep' });
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
