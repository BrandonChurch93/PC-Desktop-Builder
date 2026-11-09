import * as THREE from 'three';
import { brandName, getStorage, type StorageType } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { storageBoxes } from '../layout/partBoxes';
import { cyl, extrude, PartBuilder, rbox, roundedPoly, rrect, rrectShape, screwGeometry, xf } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { fingerMaterial } from '../kit/pcb';
import { seededFor } from '../kit/rng';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import type { GenOpts, PartObject } from './types';

export const TAB_COLOR: Record<StorageType, string> = { nvme: '#8c6cff', ssd: '#2fb8a6', hdd: '#e09a2c' };

/** A label with a grid of small technical text, the style of every Pellam drive. */
function gridLabel(labels: Labels, w: number, h: number, m: THREE.Matrix4, lines: string[], title: string, model: string, tab: string, dark: boolean) {
  labels.draw(w, h, (g, W, H) => {
    const s = W / w;
    g.fillStyle = dark ? 'rgba(24,25,29,1)' : 'rgba(226,227,230,1)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = tab;
    g.beginPath(); g.moveTo(W - 9 * s, 0); g.lineTo(W, 0); g.lineTo(W, 9 * s); g.closePath(); g.fill();
    const ink = dark ? 'rgba(214,216,222,1)' : 'rgba(26,27,31,1)';
    const faint = dark ? 'rgba(120,124,132,1)' : 'rgba(110,112,118,1)';
    g.fillStyle = ink; g.textBaseline = 'top';
    g.font = `500 ${h * 0.13 * s}px "DM Sans Variable"`;
    g.fillText(title, 2.2 * s, 2 * s);
    g.font = `700 ${h * 0.2 * s}px "DM Sans Variable"`;
    g.fillText(model, 2.2 * s, (2.4 + h * 0.15) * s);
    g.strokeStyle = faint; g.lineWidth = Math.max(1, 0.12 * s);
    const top = (3.2 + h * 0.38) * s; const rows = Math.max(2, Math.floor((H - top - 2 * s) / (2.6 * s)));
    const cols = 3; const cw = (W - 4.4 * s) / cols;
    for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(2.2 * s, top + r * 2.6 * s); g.lineTo(W - 2.2 * s, top + r * 2.6 * s); g.stroke(); }
    for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(2.2 * s + c * cw, top); g.lineTo(2.2 * s + c * cw, top + rows * 2.6 * s); g.stroke(); }
    g.fillStyle = ink; g.font = `500 ${1.25 * s}px "DM Sans Variable"`;
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const t = lines[k++ % lines.length]!; g.fillText(t, 2.2 * s + c * cw + 0.7 * s, top + r * 2.6 * s + 0.7 * s); }
  }, m, { rough: 0.55 });
}

function nvme(pb: PartBuilder, labels: Labels) {
  const L = DIMS.m2Length; const W = DIMS.m2Width; const T = 0.8;
  const s = new THREE.Shape();
  s.moveTo(0, -W / 2); s.lineTo(L - 0.6, -W / 2); s.quadraticCurveTo(L, -W / 2, L, -W / 2 + 0.6); s.lineTo(L, -1.75);
  s.absarc(L, 0, 1.75, -Math.PI / 2, -Math.PI * 1.5, true);
  s.lineTo(L, W / 2 - 0.6); s.quadraticCurveTo(L, W / 2, L - 0.6, W / 2); s.lineTo(0, W / 2);
  s.lineTo(0, -W / 2 + 4.3); s.lineTo(3.8, -W / 2 + 4.3); s.lineTo(3.8, -W / 2 + 3.1); s.lineTo(0, -W / 2 + 3.1); s.closePath();
  pb.add(extrude(s, T, 0.12, 'xy', 18), 'pcbBlack');
  const fingers = fingerMaterial('m2', W, 4, 0.5, [[3.1, 4.3]], 'rgba(14,16,20,1)');
  for (const side of [1, -1]) {
    const g = new THREE.PlaneGeometry(W, 3.8); g.translate(0, 1.9, 0);
    pb.mesh(g, fingers, new THREE.Matrix4().makeTranslation(0, 0, side > 0 ? T + 0.01 : -0.01).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2)).multiply(side > 0 ? new THREE.Matrix4() : new THREE.Matrix4().makeRotationY(Math.PI)), { uv: 'keep' });
  }
  pb.add(rbox(12.5, 12.5, 1.2, 0.3, 1), 'chip', xf({ p: [12.5, 0, T + 0.6] }));
  pb.add(rbox(14, 17, 1.25, 0.3, 1), 'chip', xf({ p: [32, 0, T + 0.62] }));
  pb.add(rbox(14, 17, 1.25, 0.3, 1), 'chip', xf({ p: [50, 0, T + 0.62] }));
  pb.add(rbox(6, 5, 0.9, 0.2, 1), 'chip', xf({ p: [66, -5, T + 0.45] }));
  const r = seededFor('nvme');
  for (let i = 0; i < 26; i++) pb.add(rbox(1.0, 0.5, 0.45, 0.1, 1), r() > 0.5 ? 'ceramic' : 'chip', xf({ p: [6 + r() * 66, (r() - 0.5) * 18, T + 0.22] }));
  pb.add(new THREE.BoxGeometry(62, 20.4, 0.12), 'labelPaper', xf({ p: [40, 0, T + 1.36] }), { uv: 'box' });
  const spec = getStorage('nvme');
  gridLabel(labels, 62, 20.4, xf({ p: [40, 0, T + 1.44] }), ['NVMe PCIe 4.0', '2280 M KEY', '3.3 V 2.5 A', 'PN PL-AR2T', 'SN 26118407', 'MADE FOR BENCH'], brandName(spec?.brand ?? 'pellam').toUpperCase(), spec?.name ?? 'Arrow 2 TB', TAB_COLOR.nvme, true);
  labels.text('M.2 2280', TINY_TYPE, 0.8, xf({ p: [76.5, 7.8, T + 0.02] }), { color: '#8f949c' });
  for (let i = 0; i < 5; i++) pb.add(rbox(1.0, 1.5, 0.6, 0.1, 1), 'chip', xf({ p: [5.5 + i * 1.6, 9.2, -0.3] }));
  labels.text('PELLAM · ARROW · REV B', TINY_TYPE, 0.9, xf({ p: [40, 0, -0.02], r: [Math.PI, 0, 0] }), { color: '#8f949c' });
}

function ssd(pb: PartBuilder, labels: Labels) {
  const { w, l, h } = DIMS.ssd;
  pb.add(rbox(w, h * 0.42, l, 0.8, 2), 'plasticMatte', xf({ p: [0, h * 0.21, 0] }));
  const lid = extrude(rrectShape(w, l, 2.2), h * 0.6, 0.6, 'xz', 12);
  pb.add(lid, 'aluBrushed', xf({ p: [0, h * 0.4, 0] }));
  for (const sx of [1, -1]) for (const z of [-l / 2 + 14, l / 2 - 24]) pb.add(cyl(1.5, 0.5, 'x', 12), 'darkVoid', xf({ p: [sx * (w / 2 + 0.05), h * 0.3, z] }), { uv: 'keep' });
  for (const sx of [1, -1]) for (const z of [-l / 2 + 14, l / 2 - 24]) pb.add(cyl(1.6, 0.4, 'y', 12), 'darkVoid', xf({ p: [sx * (w / 2 - 4.1), -0.12, z] }), { uv: 'keep' });
  const conn = (x: number, width: number) => {
    pb.add(rbox(width, 4.6, 3.6, 0.3, 1), 'plasticDark', xf({ p: [x, 2.8, -l / 2 + 1.8] }));
    pb.add(new THREE.BoxGeometry(width - 1.2, 1.1, 3.2), 'darkVoid', xf({ p: [x, 2.6, -l / 2 + 1.6] }), { uv: 'keep' });
  };
  conn(-w / 2 + 14.5, 9.6); conn(w / 2 - 22, 22);
  pb.add(new THREE.BoxGeometry(w - 10, 0.1, l - 22), 'labelPaper', xf({ p: [0, h + 0.05, 2] }));
  const spec = getStorage('ssd');
  gridLabel(labels, w - 10, l - 22, xf({ p: [0, h + 0.12, 2], r: [-Math.PI / 2, 0, 0] }), ['SATA 6 Gb/s', '2.5 IN 7 MM', '5 V 1.4 A', 'PN PL-FL2T', 'SN 26103371', 'TLC NAND'], brandName(spec?.brand ?? 'pellam').toUpperCase(), spec?.name ?? 'Flint 2 TB', TAB_COLOR.ssd, false);
  labels.text('SATA', TINY_TYPE, 1.1, xf({ p: [-w / 2 + 14.5, 5.6, -l / 2 - 0.1], r: [0, Math.PI, 0] }), { color: '#9aa0a8' });
  labels.text('PELLAM', BRAND_TYPE.pellam ?? SPEC_TYPE, 3, xf({ p: [0, -0.06, 0], r: [Math.PI / 2, 0, 0] }), { color: '#8f949c' });
}

function hdd(pb: PartBuilder, labels: Labels) {
  const { w, l, h } = DIMS.hdd;
  const body = new THREE.Shape(); rrect(body, -w / 2, -l / 2, w, l, 3);
  pb.add(extrude(body, h - 4, 0.8, 'xz', 12), 'steelZinc', xf({ p: [0, 2.2, 0], r: [0, 0, 0] }).multiply(new THREE.Matrix4().makeRotationY(0)));
  const cover = roundedPoly([[-w / 2 + 2, -l / 2 + 2], [w / 2 - 2, -l / 2 + 2], [w / 2 - 2, l / 2 - 26], [w / 2 - 14, l / 2 - 2], [-w / 2 + 2, l / 2 - 2]], 2.5);
  pb.add(extrude(cover, 1.2, 0.35, 'xz', 8), 'aluBrushed', xf({ p: [0, h - 2.1, 0] }));
  pb.add(cyl(14, 0.4, 'y', 40), 'aluBrushed', xf({ p: [-8, h - 0.7, 18] }));
  const sg = screwGeometry(1.7, 0.8, 'flat');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x8d9097, metalness: 1, roughness: 0.32, vertexColors: true }));
  const pts: [number, number][] = [[-w / 2 + 6, -l / 2 + 6], [w / 2 - 6, -l / 2 + 6], [-w / 2 + 6, l / 2 - 6], [w / 2 - 18, l / 2 - 6], [-w / 2 + 6, 0], [w / 2 - 6, 0], [-8, 18]];
  for (const [x, z] of pts) pb.add(sg.clone(), sm, xf({ p: [x, h - 0.9, z], r: [-Math.PI / 2, 0, 0] }), { uv: 'keep' });
  sg.dispose();
  pb.add(rbox(w - 8, 1.2, l - 30, 0.4, 1), 'pcbGreen', xf({ p: [0, 1.4, 6] }));
  pb.add(rbox(14, 1.2, 14, 0.3, 1), 'chip', xf({ p: [-20, 0.5, 18] }));
  pb.add(rbox(10, 1.0, 10, 0.3, 1), 'chip', xf({ p: [18, 0.6, 30] }));
  pb.add(rbox(8, 1.0, 12, 0.3, 1), 'chip', xf({ p: [24, 0.6, -10] }));
  for (const sx of [1, -1]) for (const z of [-l / 2 + 28.5, -l / 2 + 28.5 + 41.6, -l / 2 + 28.5 + 101.6]) pb.add(cyl(1.6, 0.5, 'x', 12), 'darkVoid', xf({ p: [sx * (w / 2 + 0.05), 6.35, z] }), { uv: 'keep' });
  const conn = (x: number, width: number) => {
    pb.add(rbox(width, 5, 4.2, 0.3, 1), 'plasticDark', xf({ p: [x, 4.2, -l / 2 + 2] }));
    pb.add(new THREE.BoxGeometry(width - 1.2, 1.2, 3.6), 'darkVoid', xf({ p: [x, 4, -l / 2 + 1.7] }), { uv: 'keep' });
  };
  conn(-w / 2 + 22, 9.6); conn(-w / 2 + 48, 22);
  pb.add(new THREE.BoxGeometry(w - 18, 0.1, 70), 'labelPaper', xf({ p: [2, h - 1.42, -26] }));
  const spec = getStorage('hdd');
  gridLabel(labels, w - 18, 70, xf({ p: [2, h - 1.36, -26], r: [-Math.PI / 2, 0, 0] }), ['SATA 6 Gb/s', '7200 RPM', '5 V 0.6 A', '12 V 0.5 A', 'PN PL-VT4T', 'SN 26097712', '256 MB CACHE', '3.5 IN'], brandName(spec?.brand ?? 'pellam').toUpperCase(), spec?.name ?? 'Vault 4 TB', TAB_COLOR.hdd, false);
  labels.text('DO NOT COVER BREATHER HOLE', TINY_TYPE, 1, xf({ p: [-8, h - 0.48, 34], r: [-Math.PI / 2, 0, 0] }), { color: '#4f535b' });
}

export function storagePart(type: string, opts: GenOpts = {}): PartObject {
  void opts;
  const t = (['nvme', 'ssd', 'hdd'].includes(type) ? type : 'nvme') as StorageType;
  const pb = new PartBuilder(`storage-${t}`);
  const labels = new Labels(pb, 26);
  if (t === 'nvme') nvme(pb, labels);
  else if (t === 'ssd') ssd(pb, labels);
  else hdd(pb, labels);
  labels.finish();
  const done = pb.finish();
  return { root: done.root, boxes: storageBoxes(t), anchors: {}, zones: [], rotors: [], movers: {}, dispose: done.dispose };
}
