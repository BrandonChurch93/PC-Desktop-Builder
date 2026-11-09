import * as THREE from 'three';
import { brandName, getPsu } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { psuBoxes } from '../layout/partBoxes';
import { bladeGeometry } from '../kit/blades';
import { at, circleHole, cyl, extrude, lathe, PartBuilder, polyHole, rbox, rrect, rrectHole, rrectShape, screwGeometry, torus, xf } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { BRAND_TYPE, SPEC_TYPE, TINY_TYPE, type TextStyle } from '../kit/type';
import { mat, type MatName } from '../kit/materials';
import type { Anchor, GenOpts, PartObject } from './types';

const PI = Math.PI;

/** Hexagonal holes inside a region, as hole paths for a shape. Cells are measured across flats. */
export function honeycombHoles(region: (x: number, y: number) => boolean, x0: number, x1: number, y0: number, y1: number, cell: number, wall: number): THREE.Path[] {
  const holes: THREE.Path[] = [];
  const r = (cell - wall) / Math.sqrt(3);
  const dx = cell; const dy = cell * Math.sqrt(3) / 2;
  let row = 0;
  for (let y = y0 + r; y <= y1 - r; y += dy, row++) {
    for (let x = x0 + r + (row % 2 ? dx / 2 : 0); x <= x1 - r; x += dx) {
      let ok = true;
      for (let k = 0; k < 6 && ok; k++) { const a = (k / 6) * PI * 2 + PI / 6; ok = region(x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05); }
      if (!ok) continue;
      const p = new THREE.Path();
      for (let k = 0; k <= 6; k++) { const a = -(k / 6) * PI * 2 + PI / 6; const px = x + Math.cos(a) * r; const py = y + Math.sin(a) * r; if (k) p.lineTo(px, py); else p.moveTo(px, py); }
      holes.push(p);
    }
  }
  return holes;
}

type Socket = { name: string; label: string; cols: number; rows: number; pitch: number; y: number; z: number };

export function psuPart(id: string, opts: GenOpts = {}): PartObject {
  void opts;
  const spec = getPsu(id);
  const sfx = spec?.form === 'sfx';
  const { w: W, h: H } = DIMS.psu[sfx ? 'sfx' : 'atx'];
  const L = spec?.length ?? 160;
  const frost = spec?.finish === 'frost';
  const shell: MatName = frost ? 'powderWhite' : 'powderPanel';
  const grilleMat: MatName = frost ? 'aluSilver' : 'powderBlack';
  const pb = new PartBuilder(`psu-${id}`);
  const labels = new Labels(pb, 18);
  const t = 1.0; const bend = 3;

  const u = new THREE.Shape();
  u.moveTo(-W / 2, H - t); u.lineTo(-W / 2, bend); u.absarc(-W / 2 + bend, bend, bend, PI, PI * 1.5, false);
  u.lineTo(W / 2 - bend, 0); u.absarc(W / 2 - bend, bend, bend, -PI / 2, 0, false); u.lineTo(W / 2, H - t);
  u.lineTo(W / 2 - t, H - t); u.lineTo(W / 2 - t, bend); u.absarc(W / 2 - bend, bend, bend - t, 0, -PI / 2, true);
  u.lineTo(-W / 2 + bend, t); u.absarc(-W / 2 + bend, bend, bend - t, -PI / 2, -PI, true); u.lineTo(-W / 2 + t, H - t); u.closePath();
  pb.add(extrude(u, L - 1.6, 0.3, 'zy', 16), shell, xf({ p: [-L / 2 + 0.8, 0, 0] }));

  const fanR = sfx ? 46 : 64;
  const fx = sfx ? 0 : L * 0.04;
  const top = new THREE.Shape(); rrect(top, -L / 2, -W / 2, L, W, bend);
  top.holes.push(circleHole(fx, 0, fanR + 1));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) top.holes.push(circleHole(sx * (L / 2 - 6), sz * (W / 2 - 6), 1.6));
  pb.add(extrude(top, t + 0.2, 0.45, 'xz', 32), shell, xf({ p: [0, H - t - 0.2, 0] }));
  const grille = new THREE.Shape(); grille.absarc(0, 0, fanR + 0.6, 0, PI * 2, false);
  grille.holes.push(...honeycombHoles((x, y) => Math.hypot(x, y) < fanR - 1.5, -fanR, fanR, -fanR, fanR, 6.2, 1.1));
  const gGeo = extrude(grille, 0.9, 0.2, 'xz', 48, 1);
  pb.add(gGeo, grilleMat, xf({ p: [fx, H - 1.5, 0] }));
  pb.add(lathe([[fanR - 1.2, H - 1.6], [fanR + 0.9, H - 1.6], [fanR + 0.9, H - 0.6], [fanR - 1.2, H - 0.6]], 64), grilleMat, xf({ p: [fx, 0, 0] }).multiply(new THREE.Matrix4().makeRotationX(-PI / 2)));
  pb.add(rbox(L - 4, 0.6, W - 4, 0.2, 1), 'darkVoid', xf({ p: [0, 3, 0] }), { uv: 'keep' });
  pb.add(cyl(fanR + 2.6, 0.6, 'y', 64, fanR + 2.6, true), 'plasticMatte', xf({ p: [fx, H - 8, 0] }));

  const rotor = pb.group('psu-rotor', pb.root, xf({ p: [fx, H - 6.5, 0], r: [-PI / 2, 0, 0] }));
  const blades = pb.group('psu-blades', rotor);
  const bg = bladeGeometry({ r0: 19, r1: fanR - 2.5, c0: 18, c1: 36, pitch0: 0.8, pitch1: 0.42, sweep: 0.5, thick: 1.6, z: 0, nu: 12, nv: 8 });
  const bladeMat = pb.own((mat('plasticGrey') as THREE.MeshPhysicalMaterial).clone()); bladeMat.side = THREE.DoubleSide; bladeMat.color.setHex(0x6b6f77);
  for (let i = 0; i < 9; i++) pb.add(bg.clone(), bladeMat, xf({ r: [0, 0, (i / 9) * PI * 2] }), { to: blades, uv: 'keep' });
  bg.dispose();
  pb.add(lathe([[0, 3.6], [15, 3.6], [18.5, 2.2], [19.2, 0], [19.2, -6], [0, -6]], 48), 'plasticMatte', undefined, { to: rotor });
  labels.text(brandName(spec?.brand ?? 'thessic'), BRAND_TYPE.thessic ?? SPEC_TYPE, 3.2, xf({ p: [0, 0, 3.7] }), { color: '#9a9ea8', to: rotor });
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; pb.add(rbox(fanR - 20, 2.6, 2, 0.8, 1), 'plasticMatte', xf({ p: [fx + Math.cos(a) * (fanR + 18) / 2, H - 16, Math.sin(a) * (fanR + 18) / 2], r: [0, -a, 0] })); }

  const endPlate = (sign: 1 | -1) => {
    const s = new THREE.Shape(); rrect(s, -W / 2 + t, t, W - 2 * t, H - 2 * t - 0.2, 1);
    if (sign < 0) {
      const boss = (x: number, y: number) => [H / 2 + 36, H / 2 - 36].some((by) => Math.hypot(x - 66, y - by) < 8);
      s.holes.push(...honeycombHoles((x, y) => x > -W / 2 + 46 && x < W / 2 - 6 && y > 6 && y < H - 6 && !boss(x, y), -W / 2 + 46, W / 2 - 6, 6, H - 6, 6.2, 1.1));
      s.holes.push(rrectHole(28, 22, 2, -W / 2 + 22, H * 0.58));
      s.holes.push(rrectHole(13.5, 19, 1.5, -W / 2 + 22, H * 0.2 + 1));
    } else {
      s.holes.push(rrectHole(W - 2 * t - 10, H - 2 * t - 10, 3, 0, H / 2));
    }
    const g = extrude(s, 1.2, 0.25, 'xy', 8, 1);
    pb.add(g, shell, new THREE.Matrix4().makeTranslation(sign * (L / 2 - 0.6), 0, 0).multiply(new THREE.Matrix4().makeRotationY(sign > 0 ? PI / 2 : -PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.6)));
  };
  endPlate(-1); endPlate(1);
  const rear = -L / 2;
  {
    const iy = H * 0.58; const iz = -W / 2 + 22;
    const housing = rrectShape(30, 24, 1.6);
    housing.holes.push(polyHole([[-11.5, -7.5], [11.5, -7.5], [11.5, 4.6], [8.6, 7.5], [-8.6, 7.5], [-11.5, 4.6]]));
    pb.add(extrude(housing, 2.4, 0.4, 'zy', 6, 1), 'plasticDark', at(rear - 1.4, iy, iz));
    pb.add(rbox(1.2, 22, 28, 0.3, 1), 'plasticGrey', xf({ p: [rear + 4.4, iy, iz] }));
    // Three solid flat blades as an IEC inlet has them: line and neutral low, earth high in the middle, nickel plated.
    const blade = pb.own(new THREE.MeshPhysicalMaterial({ color: 0xb4b7bc, metalness: 1, roughness: 0.58 }));
    for (const [dy, dz] of [[-2.6, -7], [-2.6, 7], [3.6, 0]] as [number, number][]) pb.add(rbox(5.0, 4.0, 1.6, 0.35, 2), blade, xf({ p: [rear + 1.6, iy + dy, iz + dz] }));
  }
  pb.add(rbox(1.6, 21, 15.5, 0.5, 1), 'plasticDark', xf({ p: [rear - 0.2, H * 0.2 + 1, -W / 2 + 22] }));
  const rocker = pb.group('rocker', pb.root, xf({ p: [rear - 1.4, H * 0.2 + 1, -W / 2 + 22], r: [0, 0, 0.18] }));
  pb.add(rbox(3.4, 15, 9.4, 1.2, 2), 'plasticGloss', undefined, { to: rocker });
  labels.text('I', SPEC_TYPE, 2.2, xf({ p: [-1.75, 4, 0], r: [0, -PI / 2, 0] }), { color: '#c6c9d0', to: rocker });
  labels.text('O', SPEC_TYPE, 2.2, xf({ p: [-1.75, -4, 0], r: [0, -PI / 2, 0] }), { color: '#c6c9d0', to: rocker });
  const led = pb.mesh(cyl(1.1, 0.8, 'x', 16), new THREE.MeshStandardMaterial({ color: 0x1a2a20, emissive: 0x6dffb0, emissiveIntensity: 0 }), xf({ p: [rear - 0.6, H * 0.2 + 13.5, -W / 2 + 22] }));
  pb.own(led.material as THREE.Material);
  const sg = screwGeometry(2.6, 1.2, 'pan');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: frost ? 0xd6d8dc : 0x1e1f23, metalness: 1, roughness: 0.4, vertexColors: true }));
  // Threaded holes on the standard ATX pattern; the case's screws go into them.
  for (const [y, z] of [[H / 2 + 36, 66], [H / 2 + 36, -66], [H / 2 - 36, 66], [H / 2 - 36, -66]] as [number, number][]) {
    pb.add(cyl(1.7, 0.4, 'x', 16), 'darkVoid', xf({ p: [rear - 0.05, y, z] }), { uv: 'keep' });
    pb.add(torus(1.95, 0.25, 6, 20), 'steelZinc', xf({ p: [rear - 0.02, y, z], r: [0, PI / 2, 0] }));
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) pb.add(sg.clone(), sm, xf({ p: [sx * (L / 2 - 6), H - 0.1, sz * (W / 2 - 6)], r: [-PI / 2, 0, 0] }), { uv: 'keep' });
  sg.dispose();
  labels.text('100-240 V ~ 50/60 Hz', TINY_TYPE, 2.0, xf({ p: [rear - 1.1, H * 0.86, -W / 2 + 22], r: [0, -PI / 2, 0] }), { color: frost ? '#4c5058' : '#9aa0a8' });

  const anchors: Record<string, Anchor> = {};
  const front = L / 2;
  pb.add(rbox(1.0, H - 12, W - 12, 0.6, 1), frost ? 'aluWhite' : 'panelPowder', xf({ p: [front - 3, H / 2, 0] }));
  {
    const psg = screwGeometry(2.0, 1.0, 'pan');
    const psm = pb.own(new THREE.MeshPhysicalMaterial({ color: frost ? 0xd6d8dc : 0x2a2b30, metalness: 1, roughness: 0.4, vertexColors: true }));
    for (const [y, z] of [[10, -W / 2 + 10], [10, W / 2 - 10], [H - 10, -W / 2 + 10], [H - 10, W / 2 - 10]] as [number, number][]) pb.add(psg.clone(), psm, xf({ p: [front - 2.4, y, z], r: [0, PI / 2, 0] }), { uv: 'keep' });
    psg.dispose();
  }
  {
    const fins: THREE.Matrix4[] = [];
    for (let z = -W / 2 + 50; z < W / 2 - 8; z += 8) fins.push(xf({ p: [rear + 15, H / 2, z] }));
    pb.instanced(new THREE.BoxGeometry(24, H - 16, 2.4), 'finGrey', fins);
  }
  const sockets: Socket[] = sfx
    ? [
      { name: 'atx24', label: 'MB 24', cols: 12, rows: 2, pitch: 4.2, y: H * 0.66, z: -W / 2 + 37 },
      { name: 'eps', label: 'CPU', cols: 4, rows: 2, pitch: 4.2, y: H * 0.3, z: -W / 2 + 18 },
      { name: 'pcie1', label: 'PCIE 1', cols: 4, rows: 2, pitch: 4.2, y: H * 0.3, z: -W / 2 + 44 },
      { name: 'pcie2', label: 'PCIE 2', cols: 4, rows: 2, pitch: 4.2, y: H * 0.3, z: -W / 2 + 70 },
      { name: 'hpwr', label: '12V-2x6', cols: 6, rows: 2, pitch: 3.0, y: H * 0.66, z: W / 2 - 22 },
      { name: 'sata', label: 'SATA', cols: 3, rows: 2, pitch: 4.2, y: H * 0.3, z: W / 2 - 18 },
    ]
    : [
      { name: 'atx24', label: 'MB 18', cols: 9, rows: 2, pitch: 4.2, y: H * 0.72, z: -W / 2 + 33 },
      { name: 'atx10', label: 'MB 10', cols: 5, rows: 2, pitch: 4.2, y: H * 0.72, z: -W / 2 + 66 },
      { name: 'eps', label: 'CPU 1', cols: 4, rows: 2, pitch: 4.2, y: H * 0.42, z: -W / 2 + 20 },
      { name: 'eps2', label: 'CPU 2', cols: 4, rows: 2, pitch: 4.2, y: H * 0.42, z: -W / 2 + 46 },
      { name: 'pcie1', label: 'PCIE 1', cols: 4, rows: 2, pitch: 4.2, y: H * 0.16, z: -W / 2 + 20 },
      { name: 'pcie2', label: 'PCIE 2', cols: 4, rows: 2, pitch: 4.2, y: H * 0.16, z: -W / 2 + 46 },
      { name: 'pcie3', label: 'PCIE 3', cols: 4, rows: 2, pitch: 4.2, y: H * 0.16, z: -W / 2 + 72 },
      { name: 'hpwr', label: '12V-2x6', cols: 6, rows: 2, pitch: 3.0, y: H * 0.72, z: W / 2 - 26 },
      { name: 'sata1', label: 'SATA 1', cols: 3, rows: 2, pitch: 4.2, y: H * 0.42, z: W / 2 - 40 },
      { name: 'sata2', label: 'SATA 2', cols: 3, rows: 2, pitch: 4.2, y: H * 0.42, z: W / 2 - 18 },
      { name: 'sata3', label: 'SATA 3', cols: 3, rows: 2, pitch: 4.2, y: H * 0.16, z: W / 2 - 18 },
    ];
  for (const s of sockets) {
    const sense = s.name === 'hpwr';
    const sw = s.cols * s.pitch + 2.4; const sh = s.rows * s.pitch + 2.4 + (sense ? 2.8 : 0);
    const gy = s.y - (sense ? 1.4 : 0);
    pb.add(rbox(6, sh, sw, 0.5, 1), 'plasticDark', xf({ p: [front - 4.2, s.y, s.z] }));
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      const cy = gy + (r - (s.rows - 1) / 2) * s.pitch; const cz = s.z + (c - (s.cols - 1) / 2) * s.pitch;
      const keyed = (r + c) % 3 === 0;
      pb.add(keyed ? rbox(1, s.pitch * 0.62, s.pitch * 0.62, s.pitch * 0.18, 2) : new THREE.BoxGeometry(1, s.pitch * 0.62, s.pitch * 0.62), 'darkVoid', xf({ p: [front - 1.6, cy, cz] }), { uv: 'keep' });
      pb.add(new THREE.BoxGeometry(0.3, s.pitch * 0.2, s.pitch * 0.2), 'nickel', xf({ p: [front - 1.0, cy, cz] }));
    }
    if (sense) for (let c = 0; c < 4; c++) pb.add(new THREE.BoxGeometry(1, 1.1, 1.1), 'darkVoid', xf({ p: [front - 1.6, s.y + sh / 2 - 1.5, s.z + (c - 1.5) * s.pitch] }), { uv: 'keep' });
    labels.text(s.label, TINY_TYPE, 1.5, xf({ p: [front - 0.48, s.y + sh / 2 + 1.6, s.z], r: [0, PI / 2, 0] }), { color: frost ? '#4c5058' : '#b5b9c2' });
    anchors[s.name] = { pos: [front - 1, s.y, s.z], dir: [1, 0, 0] };
  }
  const bigLabel = (side: 1 | -1) => {
    const lw = Math.min(L - 22, 128); const lh = H - 22;
    pb.add(new THREE.BoxGeometry(lw, lh, 0.12), 'labelPaper', xf({ p: [-L * 0.04, H / 2, side * (W / 2 + 0.07)] }));
    const cap = String(spec?.capacity ?? 850);
    labels.draw(lw, lh, (g, Wp, Hp) => {
      const s = Wp / lw;
      g.fillStyle = frost ? 'rgba(234,235,238,1)' : 'rgba(22,23,27,1)'; g.fillRect(0, 0, Wp, Hp);
      const ink = frost ? 'rgba(28,30,34,1)' : 'rgba(226,228,233,1)';
      const big: TextStyle = { ...(BRAND_TYPE.thessic ?? SPEC_TYPE), weight: 800 };
      g.fillStyle = ink;
      g.save(); g.font = `800 ${lh * 0.62 * s}px "DM Sans Variable"`; g.textBaseline = 'alphabetic';
      g.translate(4 * s, lh * 0.7 * s); g.scale(0.78, 1); g.fillText(cap, 0, 0); const capW = g.measureText(cap).width * 0.78; g.restore();
      g.font = `800 ${lh * 0.2 * s}px "DM Sans Variable"`; g.fillText('W', 4 * s + capW + 1.6 * s, lh * 0.7 * s);
      g.save(); g.translate(4 * s, lh * 0.86 * s); g.scale(big.scaleX, 1); g.font = `800 ${lh * 0.13 * s}px "DM Sans Variable"`; g.fillText(brandName(spec?.brand ?? 'thessic').toUpperCase(), 0, 0); g.restore();
      const colX = lw * 0.62 * s;
      g.strokeStyle = frost ? 'rgba(120,122,128,1)' : 'rgba(110,114,122,1)'; g.lineWidth = Math.max(1, 0.15 * s);
      g.font = `500 ${2.1 * s}px "DM Sans Variable"`;
      const rows = [['AC INPUT', '100-240 V'], ['FREQ', '50/60 Hz'], ['+12V', `${Math.round((spec?.capacity ?? 850) / 12.2)} A`], ['+5V', '20 A'], ['+3.3V', '20 A'], ['FORM', sfx ? 'SFX' : 'ATX 3.1'], ['MODEL', `TH-${cap}${sfx ? 'S' : ''}`]];
      rows.forEach(([a, b], i) => {
        const y = (5 + i * 4.6) * s;
        g.strokeRect(colX, y - 0.6 * s, lw * 0.34 * s, 4.6 * s);
        g.fillText(a!, colX + 1 * s, y + 2.6 * s); g.fillText(b!, colX + lw * 0.17 * s, y + 2.6 * s);
      });
      g.font = `600 ${2.4 * s}px "DM Sans Variable"`;
      g.fillText(spec?.name ? `${brandName(spec.brand)} ${spec.name}` : '', 4 * s, 6 * s);
    }, xf({ p: [-L * 0.04, H / 2, side * (W / 2 + 0.15)], r: [0, side > 0 ? 0 : PI, 0] }));
  };
  bigLabel(1); bigLabel(-1);
  labels.finish();
  const done = pb.finish();
  return {
    root: done.root, boxes: psuBoxes(id), anchors, zones: [], rotors: [{ obj: rotor, axis: 'z', speed: 1.6, blades }], movers: { rocker, led },
    dispose: done.dispose,
  };
}
