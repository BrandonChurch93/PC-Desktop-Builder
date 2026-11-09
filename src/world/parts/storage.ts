import * as THREE from 'three';
import { brandName, getStorage, type StorageType } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { storageBoxes } from '../layout/partBoxes';
import { at, cyl, extrude, lathe, PartBuilder, rbox, roundedPoly, rrectShape, screwGeometry, torus, tube, xf } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { fingerMaterial, smallBoardMaterial } from '../kit/pcb';
import { seededFor } from '../kit/rng';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import type { Anchor, GenOpts, PartObject } from './types';

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
    const rowH = 3.0;
    const top = (3.2 + h * 0.38) * s; const cols = w > 50 ? 3 : 2; const rows = Math.ceil(lines.length / cols);
    const cw = (W - 4.4 * s) / cols;
    for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(2.2 * s, top + r * rowH * s); g.lineTo(W - 2.2 * s, top + r * rowH * s); g.stroke(); }
    for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(2.2 * s + c * cw, top); g.lineTo(2.2 * s + c * cw, top + rows * rowH * s); g.stroke(); }
    g.fillStyle = ink; g.font = `500 ${1.2 * s}px "DM Sans Variable"`;
    lines.forEach((t, k) => g.fillText(t, 2.2 * s + (k % cols) * cw + 0.7 * s, top + Math.floor(k / cols) * rowH * s + 0.95 * s));
    const below = top + rows * rowH * s + 2 * s;
    if (H - below > 8 * s) {
      const rr = seededFor(`label-${model}`); const bh = Math.min(7 * s, H - below - 4 * s);
      let x = 2.2 * s;
      while (x < W * 0.6) { const bw = (0.15 + rr() * 0.45) * s; g.fillRect(x, below, bw, bh); x += bw + (0.15 + rr() * 0.35) * s; }
      const cell = bh / 12;
      for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if (i === 0 || j === 0 || rr() > 0.5) g.fillRect(W - 2.2 * s - bh + i * cell, below + j * cell, cell, cell);
      g.font = `500 ${1.1 * s}px "DM Sans Variable"`;
      g.fillText(`${title} · ${model.toUpperCase()} · MADE FOR THE BENCH`, 2.2 * s, below + bh + 1.2 * s);
    }
  }, m, { rough: 0.55 });
}

/** A SATA socket opening on a drive end: dark slot, an L tongue and its contacts, the opening facing -z at zFront. */
function sataSlot(pb: PartBuilder, x: number, y: number, zFront: number, width: number) {
  pb.add(new THREE.BoxGeometry(width - 1.2, 2.4, 3.4), 'darkVoid', xf({ p: [x, y, zFront - 0.05 + 1.7] }), { uv: 'keep' });
  pb.add(rbox(width - 2.6, 0.8, 3.2, 0.2, 1), 'plasticDark', xf({ p: [x, y + 0.4, zFront - 0.1 + 1.6] }));
  const n = Math.max(2, Math.floor((width - 3.4) / 1.27));
  for (let i = 0; i < n; i++) pb.add(new THREE.BoxGeometry(0.5, 0.1, 2.6), 'gold', xf({ p: [x - ((n - 1) * 1.27) / 2 + i * 1.27, y - 0.05, zFront - 0.15 + 1.3] }));
}

function nvme(pb: PartBuilder, labels: Labels) {
  const L = DIMS.m2Length; const W = DIMS.m2Width; const T = 0.8;
  const s = new THREE.Shape();
  s.moveTo(0, -W / 2); s.lineTo(L - 0.6, -W / 2); s.quadraticCurveTo(L, -W / 2, L, -W / 2 + 0.6); s.lineTo(L, -1.75);
  s.absarc(L, 0, 1.75, -Math.PI / 2, -Math.PI * 1.5, true);
  s.lineTo(L, W / 2 - 0.6); s.quadraticCurveTo(L, W / 2, L - 0.6, W / 2); s.lineTo(0, W / 2);
  s.lineTo(0, -W / 2 + 4.3); s.lineTo(3.8, -W / 2 + 4.3); s.lineTo(3.8, -W / 2 + 3.1); s.lineTo(0, -W / 2 + 3.1); s.closePath();
  pb.add(extrude(s, T, 0.12, 'xy', 18), 'pcbEdge');
  // A dense board: an M.2 stick is routed edge to edge around its controller.
  const boardMat = smallBoardMaterial('nvme', L, W, { mask: 'rgba(18,20,24,1)', trace: 'rgba(50,58,72,1)', pad: 'rgba(150,140,112,1)', body: 'rgba(46,42,36,1)' }, [0, -W / 2], 3);
  pb.mesh(new THREE.ShapeGeometry(s, 18), boardMat, at(0, 0, T + 0.025), { uv: 'keep' });
  pb.mesh(new THREE.ShapeGeometry(s, 18), boardMat, xf({ p: [0, 0, -0.025], r: [Math.PI, 0, 0] }), { uv: 'keep' });
  // The M key gap has to land over the notch in the board on both faces: the top face plane runs the other way.
  const fingersTop = fingerMaterial('m2-top', W, 4, 0.5, [[W - 4.3, W - 3.1]], 'rgba(14,16,20,1)');
  const fingersBottom = fingerMaterial('m2-bottom', W, 4, 0.5, [[3.1, 4.3]], 'rgba(14,16,20,1)');
  for (const side of [1, -1]) {
    const fingers = side > 0 ? fingersTop : fingersBottom;
    const g = new THREE.PlaneGeometry(W, 3.8); g.translate(0, 1.9, 0);
    pb.mesh(g, fingers, new THREE.Matrix4().makeTranslation(0, 0, side > 0 ? T + 0.05 : -0.05).multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2)).multiply(side > 0 ? new THREE.Matrix4() : new THREE.Matrix4().makeRotationY(Math.PI)), { uv: 'keep' });
  }
  pb.add(rbox(12.5, 12.5, 1.2, 0.3, 1), 'chip', xf({ p: [12.5, 0, T + 0.6] }));
  pb.add(rbox(14, 17, 1.25, 0.3, 1), 'chip', xf({ p: [32, 0, T + 0.62] }));
  pb.add(rbox(14, 17, 1.25, 0.3, 1), 'chip', xf({ p: [50, 0, T + 0.62] }));
  pb.add(rbox(6, 5, 0.9, 0.2, 1), 'chip', xf({ p: [66, -5, T + 0.45] }));
  const r = seededFor('nvme');
  // Passives where the label does not cover the board: around the controller and toward the screw end.
  for (let i = 0; i < 48; i++) {
    const x = r() > 0.5 ? 5 + r() * 14 : 62 + r() * 12; const y = (r() - 0.5) * 18;
    if (x > 9 && x < 16 && Math.abs(y) < 7) continue;
    if (x > 62.5 && x < 69.5 && y > -8 && y < -2) continue;
    pb.add(rbox(1.0, 0.5, 0.45, 0.1, 1), r() > 0.5 ? 'ceramic' : 'chip', xf({ p: [x, y, T + 0.22], r: [0, 0, r() > 0.5 ? Math.PI / 2 : 0] }));
  }
  // The label is a thin sticker laid over the two flash packages: it stands at their height and rolls down to the board at its edges.
  pb.add(extrude(rrectShape(39.4, 20, 1.6), 1.36, 0.66, 'xy', 8, 3), 'sticker', at(41, 0, T));
  const spec = getStorage('nvme');
  labels.text('PELLAM', TINY_TYPE, 1.2, xf({ p: [12.5, 2.6, T + 1.22] }), { color: '#9a9ea7' });
  labels.text('PL-C2 2611', TINY_TYPE, 0.9, xf({ p: [12.5, 0.4, T + 1.22] }), { color: '#80848d' });
  labels.text('E2 · 4R7', TINY_TYPE, 0.7, xf({ p: [66, -5, T + 0.92] }), { color: '#80848d' });
  gridLabel(labels, 38, 18.6, xf({ p: [41, 0, T + 1.39] }), ['NVMe PCIe 4.0', '2280 M KEY', '3.3 V 2.5 A', 'PN PL-AR2T', 'SN 26118407', 'MADE FOR BENCH'], brandName(spec?.brand ?? 'pellam').toUpperCase(), spec?.name ?? 'Arrow 2 TB', TAB_COLOR.nvme, true);
  labels.text('M.2 2280', TINY_TYPE, 0.8, xf({ p: [76.5, 7.8, T + 0.02] }), { color: '#8f949c' });
  for (let i = 0; i < 5; i++) pb.add(rbox(1.0, 1.5, 0.6, 0.1, 1), 'chip', xf({ p: [5.5 + i * 1.6, 9.2, -0.3] }));
  labels.text('PELLAM · ARROW · REV B', TINY_TYPE, 0.9, xf({ p: [40, 0, -0.02], r: [Math.PI, 0, 0] }), { color: '#8f949c' });
}

function ssd(pb: PartBuilder, labels: Labels): Record<string, Anchor> {
  const { w, l, h } = DIMS.ssd;
  pb.add(rbox(w, h * 0.42, l, 0.8, 2), 'plasticMatte', xf({ p: [0, h * 0.21, 0] }));
  const lid = extrude(rrectShape(w, l, 2.2), h * 0.6, 0.6, 'xz', 12);
  pb.add(lid, 'aluBrushed', xf({ p: [0, h * 0.4, 0] }));
  for (const sx of [1, -1]) for (const z of [-l / 2 + 14, l / 2 - 24]) pb.add(cyl(1.5, 0.5, 'x', 12), 'darkVoid', xf({ p: [sx * (w / 2 + 0.05), h * 0.3, z] }), { uv: 'keep' });
  for (const sx of [1, -1]) for (const z of [-l / 2 + 14, l / 2 - 24]) pb.add(cyl(1.6, 0.4, 'y', 12), 'darkVoid', xf({ p: [sx * (w / 2 - 4.1), -0.12, z] }), { uv: 'keep' });
  const conn = (x: number, width: number) => {
    pb.add(rbox(width, 4.6, 3.6, 0.3, 1), 'plasticDark', xf({ p: [x, 2.8, -l / 2 + 1.8] }));
    sataSlot(pb, x, 2.8, -l / 2, width);
  };
  conn(-w / 2 + 14.5, 9.6); conn(w / 2 - 22, 22);
  pb.add(new THREE.BoxGeometry(w - 10, 0.1, l - 22), 'labelPaper', xf({ p: [0, h + 0.05, 2] }));
  const spec = getStorage('ssd');
  gridLabel(labels, w - 10, l - 22, xf({ p: [0, h + 0.12, 2], r: [-Math.PI / 2, 0, 0] }), ['SATA 6 Gb/s', '2.5 IN 7 MM', '5 V 1.4 A', 'PN PL-FL2T', 'SN 26103371', 'TLC NAND'], brandName(spec?.brand ?? 'pellam').toUpperCase(), spec?.name ?? 'Flint 2 TB', TAB_COLOR.ssd, false);
  labels.text('SATA', TINY_TYPE, 1.1, xf({ p: [-w / 2 + 14.5, 5.6, -l / 2 - 0.1], r: [0, Math.PI, 0] }), { color: '#9aa0a8' });
  labels.text('PELLAM', BRAND_TYPE.pellam ?? SPEC_TYPE, 3, xf({ p: [0, -0.06, 0], r: [Math.PI / 2, 0, 0] }), { color: '#8f949c' });
  return { sataData: { pos: [-w / 2 + 14.5, 2.8, -l / 2 - 0.1], dir: [0, 0, -1] }, sataPower: { pos: [w / 2 - 22, 2.8, -l / 2 - 0.1], dir: [0, 0, -1] } };
}

function hdd(pb: PartBuilder, labels: Labels, mounted: boolean): Record<string, Anchor> {
  const { w, l, h } = DIMS.hdd;
  const bh = h - 4;
  const profile = roundedPoly([[-w / 2, 0], [w / 2, 0], [w / 2, 7.2], [w / 2 - 0.9, 8], [w / 2 - 0.9, 14], [w / 2, 14.8], [w / 2, bh], [-w / 2, bh], [-w / 2, 14.8], [-w / 2 + 0.9, 14], [-w / 2 + 0.9, 8], [-w / 2, 7.2]], 1.0);
  pb.add(extrude(profile, l, 1.2, 'xy', 4, 3), 'aluCast', at(0, 2.2, -l / 2));
  const cover = roundedPoly([[-w / 2 + 2, -l / 2 + 2], [w / 2 - 2, -l / 2 + 2], [w / 2 - 2, l / 2 - 26], [w / 2 - 14, l / 2 - 2], [-w / 2 + 2, l / 2 - 2]], 2.5);
  pb.add(extrude(cover, 1.2, 0.35, 'xz', 8), 'aluLid', xf({ p: [0, h - 2.1, 0] }));
  // A pressed cover: a raised field inside the screw rim, a stepped collar around the spindle, and a rib over the platters.
  const field = roundedPoly([[-w / 2 + 9, -l / 2 + 9], [w / 2 - 9, -l / 2 + 9], [w / 2 - 9, l / 2 - 30], [w / 2 - 19, l / 2 - 9], [-w / 2 + 9, l / 2 - 9]], 3);
  pb.add(extrude(field, 0.35, 0.25, 'xz', 6), 'aluLid', xf({ p: [0, h - 0.9, 0] }));
  const lid = h - 0.55;
  pb.add(lathe([[17, 0], [15.6, 0.14], [14.2, 0.45], [10.8, 0.45], [10.3, 0.78], [0, 0.78]], 72), 'aluStamp', xf({ p: [-8, lid, 24], r: [-Math.PI / 2, 0, 0] }));
  {
    const ok = (x: number, z: number) => z > 12 && x > -w / 2 + 11 && x < w / 2 - 11 && z < l / 2 - 11 && !(x > w / 2 - 22 && z > l / 2 - 32);
    let run: [number, number, number][] = [];
    const flush = () => { if (run.length > 3) pb.add(tube(run, 0.45, run.length * 2, 8), 'aluLid'); run = []; };
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2; const x = -8 + 44 * Math.cos(a); const z = 24 + 44 * Math.sin(a);
      if (ok(x, z)) run.push([x, lid + 0.12, z]); else flush();
    }
    flush();
  }
  const sg = screwGeometry(1.7, 0.8, 'flat');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x8d9097, metalness: 1, roughness: 0.58, vertexColors: true }));
  const pts: [number, number][] = [[-w / 2 + 6, -l / 2 + 6], [w / 2 - 6, -l / 2 + 6], [-w / 2 + 6, l / 2 - 6], [w / 2 - 18, l / 2 - 6], [-w / 2 + 6, 0], [w / 2 - 6, 0]];
  for (const [x, z] of pts) pb.add(sg.clone(), sm, xf({ p: [x, h - 0.9, z], r: [-Math.PI / 2, 0, 0] }), { uv: 'keep' });
  pb.add(sg.clone(), sm, xf({ p: [-8, lid + 0.78, 24], r: [-Math.PI / 2, 0, 0] }), { uv: 'keep' });
  const pcbW = w - 13; const pcbL = l - 33; const pcbZ = -l / 2 + 7 + pcbL / 2;
  const pcb = smallBoardMaterial('hdd', pcbW, pcbL, { mask: 'rgba(15,56,37,1)', trace: 'rgba(28,80,54,1)', pad: 'rgba(168,158,118,1)', body: 'rgba(46,42,36,1)' }, [-pcbW / 2, pcbZ - pcbL / 2]);
  pb.add(rbox(pcbW, 1.2, pcbL, 0.4, 1), pcb, xf({ p: [0, 1.4, pcbZ] }));
  pb.add(cyl(10, 1.6, 'y', 48), 'steelZinc', xf({ p: [-8, 0.8, l / 2 - 13] }));
  pb.add(cyl(3.6, 0.6, 'y', 32), 'darkVoid', xf({ p: [-8, 0.1, l / 2 - 13] }), { uv: 'keep' });
  for (const sx of [1, -1]) for (const sz of [1, -1]) pb.add(sg.clone(), sm, xf({ p: [sx * (pcbW / 2 - 4), 0.8, pcbZ + sz * (pcbL / 2 - 4)], r: [Math.PI / 2, 0, 0] }), { uv: 'keep' });
  sg.dispose();
  // Chips on the board's underside: package, marking, and a row of leads on each side that has them.
  const facingDown = (x: number, y: number, z: number) => xf({ p: [x, y, z], r: [Math.PI / 2, 0, 0] });
  const chipAt = (x: number, z: number, cw: number, cd: number, ch: number, mark: string, leads: 'quad' | 'dual' | 'none') => {
    const cy = 0.8 - ch / 2;
    pb.add(rbox(cw, ch, cd, 0.25, 1), 'chip', xf({ p: [x, cy, z] }));
    labels.text(mark, TINY_TYPE, Math.min(1.4, cw * 0.11), facingDown(x, cy - ch / 2 - 0.02, z), { color: '#8a8e96' });
    const pitch = 0.65;
    const lead = (lx: number, lz: number, along: 'x' | 'z') => pb.add(new THREE.BoxGeometry(along === 'x' ? 0.3 : 1.1, 0.25, along === 'x' ? 1.1 : 0.3), 'solder', xf({ p: [lx, 0.72, lz] }));
    if (leads === 'none') return;
    const nx = Math.floor((cw - 2) / pitch); const nz = Math.floor((cd - 2) / pitch);
    for (const sd of [1, -1]) {
      for (let i = 0; i < nx; i++) lead(x - ((nx - 1) * pitch) / 2 + i * pitch, z + sd * (cd / 2 + 0.5), 'x');
      if (leads === 'quad') for (let i = 0; i < nz; i++) lead(x + sd * (cw / 2 + 0.5), z - ((nz - 1) * pitch) / 2 + i * pitch, 'z');
    }
  };
  chipAt(-20, 18, 14, 14, 1.2, 'PL-HC 7 2611', 'quad');
  chipAt(18, 30, 10, 10, 1.0, 'MD 26 A1', 'quad');
  chipAt(24, -10, 8, 12, 1.0, 'DR 256M', 'dual');
  chipAt(-30, -24, 7, 7, 0.9, 'VR 12', 'none');
  chipAt(34, 44, 9, 5, 0.9, 'FL 4M', 'dual');
  pb.add(rbox(5, 1.1, 2.4, 0.6, 1), 'nickel', xf({ p: [6, 0.3, -38] }));
  for (const sx of [1, -1]) for (const z of [-l / 2 + 28.5, -l / 2 + 28.5 + 41.6, -l / 2 + 28.5 + 101.6]) {
    pb.add(cyl(1.85, 0.5, 'x', 16), 'darkVoid', xf({ p: [sx * (w / 2 + 0.05), 6.35, z] }), { uv: 'keep' });
    pb.add(torus(2.15, 0.3, 6, 24), 'steelZinc', xf({ p: [sx * (w / 2 + 0.02), 6.35, z], r: [0, Math.PI / 2, 0] }));
  }
  if (mounted) {
    const msg = screwGeometry(3.0, 1.6, 'pan');
    const msm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x3a3c42, metalness: 1, roughness: 0.6, vertexColors: true }));
    for (const sx of [1, -1]) for (const z of [-l / 2 + 28.5, -l / 2 + 28.5 + 101.6]) pb.add(msg.clone(), msm, xf({ p: [sx * (w / 2 + 0.1), 6.35, z], r: [0, sx * Math.PI / 2, 0] }), { uv: 'keep' });
    msg.dispose();
  }
  const conn = (x: number, width: number) => {
    pb.add(rbox(width, 5, 4.2, 0.3, 1), 'plasticDark', xf({ p: [x, 4.2, -l / 2 + 2] }));
    sataSlot(pb, x, 4.2, -l / 2 - 0.1, width);
  };
  conn(-w / 2 + 22, 9.6); conn(-w / 2 + 48, 22);
  pb.add(new THREE.BoxGeometry(w - 18, 0.1, 70), 'labelPaper', xf({ p: [2, lid + 0.06, -26] }));
  const spec = getStorage('hdd');
  gridLabel(labels, w - 18, 70, xf({ p: [2, lid + 0.12, -26], r: [-Math.PI / 2, 0, 0] }), ['SATA 6 Gb/s', '7200 RPM', '5 V 0.6 A', '12 V 0.5 A', 'PN PL-VT4T', 'SN 26097712', '256 MB CACHE', '3.5 IN'], brandName(spec?.brand ?? 'pellam').toUpperCase(), spec?.name ?? 'Vault 4 TB', TAB_COLOR.hdd, false);
  pb.add(cyl(0.9, 0.3, 'y', 16), 'darkVoid', xf({ p: [-20, lid + 0.08, 37.5] }), { uv: 'keep' });
  pb.add(torus(1.25, 0.18, 6, 20), 'steelZinc', xf({ p: [-20, lid + 0.02, 37.5], r: [Math.PI / 2, 0, 0] }));
  labels.text('DO NOT COVER BREATHER HOLE', TINY_TYPE, 1.8, xf({ p: [-8, lid + 0.07, 42], r: [-Math.PI / 2, 0, 0] }), { color: '#1f2228' });
  return { sataData: { pos: [-w / 2 + 22, 4.2, -l / 2 - 0.1], dir: [0, 0, -1] }, sataPower: { pos: [-w / 2 + 48, 4.2, -l / 2 - 0.1], dir: [0, 0, -1] }, label: { pos: [2, h, -26], dir: [0, 1, 0] } };
}

export function storagePart(type: string, opts: GenOpts = {}): PartObject {
  const t = (['nvme', 'ssd', 'hdd'].includes(type) ? type : 'nvme') as StorageType;
  const pb = new PartBuilder(`storage-${t}`);
  const labels = new Labels(pb, 46);
  let anchors: Record<string, Anchor> = {};
  if (t === 'nvme') nvme(pb, labels);
  else if (t === 'ssd') anchors = ssd(pb, labels);
  else anchors = hdd(pb, labels, !opts.loose);
  labels.finish();
  const done = pb.finish();
  return { root: done.root, boxes: storageBoxes(t), anchors, zones: [], rotors: [], movers: {}, dispose: done.dispose };
}
