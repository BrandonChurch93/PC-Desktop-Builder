import * as THREE from 'three';
import { brandName, getBoard, PLATFORMS, type BoardSpec } from '../../data/catalog';
import { atx24Header, boardBoxes, boardLayout, plugSection } from '../layout/boards';
import { DIMS } from '../layout/dims';
import type { BoardLayout } from '../layout/types';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, circleHole, clean, cyl, extrude, lathe, PartBuilder, polyShape, puck, rbox, roundedPoly, rrect, rrectHole, rrectShape, screwGeometry, xf } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { mat, type MatName } from '../kit/materials';
import { seededFor } from '../kit/rng';
import { canvas, wrap } from '../kit/textures';
import { BRAND_TYPE, MODEL_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { fadeEnds, spillStrip, spillStripRange, stripLeds, uvAlong, Zone } from '../light/zones';
import type { Anchor, GenOpts, PartObject } from './types';

const PI = Math.PI;
const T = DIMS.boardT;

type Look = { frost: boolean; mask: string; mask2: string; silk: string; copper: string; sink: MatName; sinkDark: MatName; plastic: MatName; plasticAlt: MatName; armor: MatName; print: string };
const lookOf = (b: BoardSpec): Look => (b.finish === 'frost'
  ? { frost: true, mask: 'rgba(226,228,233,1)', mask2: 'rgba(214,216,222,1)', silk: 'rgba(70,74,84,1)', copper: 'rgba(196,198,204,1)', sink: 'aluSilver', sinkDark: 'aluBrushed', plastic: 'plasticWhite', plasticAlt: 'plasticGrey', armor: 'steelBare', print: '#5a5e67' }
  : { frost: false, mask: 'rgba(20,24,30,1)', mask2: 'rgba(28,33,41,1)', silk: 'rgba(205,210,220,1)', copper: 'rgba(176,150,98,1)', sink: 'aluAnodized', sinkDark: 'aluBlack', plastic: 'plasticDark', plasticAlt: 'plasticGrey', armor: 'aluGunmetal', print: '#c6cad3' });

// ---- the circuit surface ---------------------------------------------------------------------

function surface(b: BoardSpec, L: BoardLayout, look: Look, ppm: number): { map: THREE.Texture; bump: THREE.Texture } {
  const W = Math.round(L.w * ppm); const H = Math.round(L.h * ppm);
  const c = canvas(W, H); const h = canvas(Math.round(W / 2), Math.round(H / 2));
  const g = c.g; const hg = h.g;
  const r = seededFor(`board-${b.id}`);
  const px = (v: number) => v * ppm; const py = (v: number) => -v * ppm;
  g.fillStyle = look.mask; g.fillRect(0, 0, W, H);
  hg.fillStyle = 'rgba(96,96,96,1)'; hg.fillRect(0, 0, W / 2, H / 2);
  const step = 1.27;
  for (let i = 0; i < 520; i++) {
    let x = Math.round((r() * L.w) / step) * step; let y = -Math.round((r() * L.h) / step) * step;
    const pts: [number, number][] = [[x, y]];
    let dir = Math.floor(r() * 4);
    const segs = 2 + Math.floor(r() * 4);
    for (let s = 0; s < segs; s++) {
      const len = (3 + Math.floor(r() * 18)) * step;
      const diag = r() > 0.55;
      const d = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]][dir]! : [[1, 0], [0, 1], [-1, 0], [0, -1]][dir]!;
      x += d[0]! * len; y += d[1]! * len;
      pts.push([x, y]);
      dir = (dir + (r() > 0.5 ? 1 : 3)) % 4;
    }
    const bundle = 1 + Math.floor(r() * 5);
    for (let k = 0; k < bundle; k++) {
      const o = k * 0.62;
      for (const [ctx, style, wdt, s2] of [[g, look.frost ? 'rgba(200,203,210,0.9)' : 'rgba(34,42,54,0.95)', 0.32, ppm], [hg, 'rgba(150,150,150,1)', 0.4, ppm / 2]] as [CanvasRenderingContext2D, string, number, number][]) {
        ctx.strokeStyle = style; ctx.lineWidth = wdt * s2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach(([xx, yy], j) => { const X = (xx + o) * s2; const Y = (-yy + o) * s2; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
        ctx.stroke();
      }
    }
    if (i % 4 === 0) {
      const [ex, ey] = pts[pts.length - 1]!;
      g.fillStyle = look.frost ? 'rgba(176,178,184,1)' : 'rgba(96,88,70,1)'; g.beginPath(); g.arc(px(ex), py(ey), 0.36 * ppm, 0, PI * 2); g.fill();
      g.fillStyle = look.mask; g.beginPath(); g.arc(px(ex), py(ey), 0.15 * ppm, 0, PI * 2); g.fill();
    }
  }
  const body = look.frost ? 'rgba(150,146,138,1)' : 'rgba(46,42,36,1)';
  const cap = look.frost ? 'rgba(158,160,166,1)' : 'rgba(92,92,90,1)';
  for (let i = 0; i < 44; i++) {
    const x0 = 6 + r() * (L.w - 12); const y0 = -6 - r() * (L.h - 12);
    const along = r() > 0.5; const count = 3 + Math.floor(r() * 6);
    const big = r() > 0.6; const w = big ? 1.6 : 1.0; const hh = big ? 0.8 : 0.5; const gap = w + 0.7;
    for (let k = 0; k < count; k++) {
      const x = along ? x0 + k * gap : x0; const y = along ? y0 : y0 - k * gap;
      const [bw, bh] = along ? [hh, w] : [w, hh];
      g.fillStyle = body; g.fillRect(px(x), py(y), bw * ppm, bh * ppm);
      g.fillStyle = cap;
      if (along) { g.fillRect(px(x), py(y), bw * ppm, bh * 0.22 * ppm); g.fillRect(px(x), py(y) + bh * 0.78 * ppm, bw * ppm, bh * 0.22 * ppm); }
      else { g.fillRect(px(x), py(y), bw * 0.22 * ppm, bh * ppm); g.fillRect(px(x) + bw * 0.78 * ppm, py(y), bw * 0.22 * ppm, bh * ppm); }
    }
  }
  g.strokeStyle = look.silk; g.lineWidth = Math.max(1, 0.15 * ppm);
  const outline = (x0: number, y0: number, x1: number, y1: number) => g.strokeRect(px(x0), py(y0), (x1 - x0) * ppm, (y0 - y1) * ppm);
  L.dimms.slice(0, b.ramSlots).forEach((d) => outline(d.x - 4, d.y + 74, d.x + 4, d.y - 74));
  L.pcie.forEach((s) => outline(s.x0 - 1.5, s.y + 5, s.x0 + s.len + 1.5, s.y - 5));
  L.m2.slice(0, b.m2Slots).forEach((m) => { if (m.level === 0) outline(m.x0 - 7, m.y + 14, m.x0 + 93, m.y - 14); });
  outline(L.w - DIMS.edgeHeaderDepth - 1.2, L.atx24.y + 30, L.w - 0.8, L.atx24.y - 30);
  outline(L.eps.x - 11.5, L.eps.y + 6, L.eps.x + 11.5, L.eps.y - 6);
  g.fillStyle = look.silk; g.textBaseline = 'middle';
  const silk = (text: string, x: number, y: number, size = 1.3, rot = 0) => {
    g.save(); g.translate(px(x), py(y)); g.rotate(rot); g.font = `600 ${size * ppm}px "DM Sans Variable"`; g.fillText(text, 0, 0); g.restore();
  };
  L.dimms.slice(0, b.ramSlots).forEach((d) => silk(`DIMM_${d.name}`, d.x - 2, d.y + 78, 1.1, -PI / 2));
  L.pcie.forEach((s, i) => silk(i === 0 ? 'PCIEX16_1' : s.kind === 'x16' ? 'PCIEX16_2' : s.kind === 'x4' ? 'PCIEX4' : 'PCIEX1_1', s.x0 + s.len + 3, s.y, 1.25));
  L.m2.slice(0, b.m2Slots).forEach((m, i) => { if (m.level === 0) silk(`M2_${i + 1}`, m.x0 - 6, m.y - 15.5, 1.15); });
  silk('ATX_PWR1', L.w - DIMS.edgeHeaderDepth - 1.2, L.atx24.y - 32, 1.2);
  silk('CPU_PWR1', L.eps.x - 11, L.eps.y - 7.5, 1.1);
  silk(PLATFORMS.get(b.platform)?.socketLabel.toUpperCase() ?? 'SOCKET', L.socket.x - 30, L.socket.y - (b.platform === 'hb' ? 45 : 40), 1.2);
  for (const hd of L.headers) silk(hd.kind === 'fan' ? 'FAN' : hd.kind === 'rgb' ? 'ARGB_12V' : hd.kind === 'panel' ? 'F_PANEL' : 'USB', hd.x - hd.w / 2, hd.y - hd.h / 2 - 1.6, 1.0);
  silk('BAT1', L.coin.x - 4, L.coin.y + 12, 1.1);
  // Stacked pairs: each block holds two ports, printed as boards print them.
  L.sata.slice(0, b.sataPorts).forEach((p, i) => { if (p.level === 0) silk(i + 1 < b.sataPorts ? `SATA6G_${i + 1}${i + 2}` : `SATA6G_${i + 1}`, p.x - 20, p.y + 1, 1.0); });
  if (L.size !== 'itx') silk('HD AUDIO', 3.5, -196, 1.0, -PI / 2);
  silk(`${brandName(b.brand).toUpperCase()} ${b.name.toUpperCase()}  REV 1.02`, L.w - 70, -L.h + 6, 1.5);
  silk('DDR5  PCIE 5.0', L.w - 70, -L.h + 9, 1.2);
  g.fillStyle = look.frost ? 'rgba(120,124,132,1)' : 'rgba(120,126,138,1)';
  for (let i = 0; i < 46; i++) silk(['R', 'C', 'Q', 'U', 'L', 'D'][Math.floor(r() * 6)]! + String(Math.floor(r() * 900 + 10)), r() * L.w, -r() * L.h, 0.9);
  for (const [x, y] of L.holes) {
    for (const ctx of [g]) {
      ctx.fillStyle = look.frost ? 'rgba(186,188,192,1)' : 'rgba(170,150,104,1)'; ctx.beginPath(); ctx.arc(px(x), py(y), 4.0 * ppm, 0, PI * 2); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(px(x), py(y), 1.9 * ppm, 0, PI * 2); ctx.fill(); ctx.restore();
    }
  }
  const map = wrap(c.canvas, { srgb: true, repeat: false });
  const bump = wrap(h.canvas, { repeat: false });
  return { map, bump };
}

/**
 * The board's underside: solder, vias, small parts and print, with a second map that makes the solder and plated rings
 * metal (blue channel) and smoother (green channel) than the solder mask, so tin reads as tin and not as paint.
 */
function backSurface(b: BoardSpec, L: BoardLayout, look: Look, ppm: number): { map: THREE.Texture; mr: THREE.Texture } {
  const W = Math.round(L.w * ppm); const H = Math.round(L.h * ppm);
  const { canvas: cv, g: paint } = canvas(W, H);
  const { canvas: mv, g: mg } = canvas(W, H);
  mg.fillStyle = 'rgb(0,150,0)'; mg.fillRect(0, 0, W, H);
  const METAL = 'rgb(0,85,255)';
  // Tin is drawn into both maps: its color into the paint, metal and a smoother finish into the second.
  const dot = (x: number, y: number, rad: number) => { for (const c of [paint, mg]) { c.beginPath(); c.arc(x, y, rad, 0, PI * 2); } mg.fillStyle = METAL; mg.fill(); paint.fill(); };
  const tinRect = (x: number, y: number, w: number, h: number) => { mg.fillStyle = METAL; mg.fillRect(x, y, w, h); paint.fillRect(x, y, w, h); };
  const r = seededFor(`board-back-${b.id}`);
  paint.fillStyle = look.mask2; paint.fillRect(0, 0, W, H);
  const tin = look.frost ? 'rgba(196,198,204,1)' : 'rgba(176,178,184,1)';
  paint.fillStyle = tin;
  const pins = (x: number, y: number, cols: number, rows: number, pitch: number) => {
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { dot((x + (i - (cols - 1) / 2) * pitch) * ppm, -(y + (j - (rows - 1) / 2) * pitch) * ppm, 0.9 * ppm); }
  };
  pins(L.atx24.x, L.atx24.y, 2, 12, 4.2);
  pins(L.eps.x, L.eps.y, 4, 2, 4.2);
  for (const d of L.dimms.slice(0, b.ramSlots)) for (let i = 0; i < 48; i++) tinRect((d.x - 0.6) * ppm, -(d.y + 66 - i * 2.8) * ppm, 1.2 * ppm, 0.7 * ppm);
  if (L.chipset) { const c = L.chipset; for (let x = c.x0 + 6; x < c.x1 - 4; x += 2.4) for (let y = c.y0 - 6; y > c.y1 + 4; y -= 2.4) { dot(x * ppm, -y * ppm, 0.32 * ppm); } }
  L.m2.slice(0, b.m2Slots).forEach((m) => { if (m.level === 0) for (let i = 0; i < 34; i++) for (const dx of [-0.8, 0.8]) tinRect((m.x0 + dx - 0.3) * ppm, -(m.y + 10.5 - i * 0.62) * ppm, 0.6 * ppm, 0.3 * ppm); });
  for (let i = 0; i < 6; i++) pins(L.coin.x - 30 + i * 9, L.coin.y + 12, 3, 1, 2.54);
  for (const sl of L.pcie) for (let x = sl.x0 + 1; x < sl.x0 + sl.len - 0.5; x += 1) for (const dy of [-1.2, 1.2]) tinRect((x - 0.3) * ppm, -(sl.y + dy + 0.35) * ppm, 0.6 * ppm, 0.7 * ppm);
  for (const h of L.headers) pins(h.x, h.y, h.pins[0], h.pins[1], 2.54);
  L.sata.slice(0, b.sataPorts).forEach((p) => { if (p.level === 0) pins(p.x - 2, p.y, 4, 2, 1.27); });
  const vr = L.vrmRear; const vt = L.vrmTop;
  for (const [x0, x1, y0, y1] of [[vr.x0, vr.x1, vr.y0, vr.y1], [vt.x0, vt.x1, vt.y0, vt.y1]] as [number, number, number, number][]) {
    for (let x = x0 + 3; x < x1 - 2; x += 3.2) for (let y = y0 - 3; y > y1 + 2; y -= 3.2) { dot(x * ppm, -y * ppm, 0.35 * ppm); }
  }
  // Plated vias scattered along the trace field, each a tin ring around a dark drill.
  for (let i = 0; i < 520; i++) {
    const x = 6 + r() * (L.w - 12); const y = -6 - r() * (L.h - 12);
    dot(x * ppm, -y * ppm, 0.38 * ppm);
    paint.fillStyle = 'rgba(14,16,20,1)'; paint.beginPath(); paint.arc(x * ppm, -y * ppm, 0.16 * ppm, 0, PI * 2); paint.fill(); paint.fillStyle = tin;
  }
  paint.lineCap = 'round'; paint.lineJoin = 'round';
  for (let i = 0; i < 160; i++) {
    let x = Math.round((r() * L.w) / 1.27) * 1.27; let y = -Math.round((r() * L.h) / 1.27) * 1.27;
    paint.strokeStyle = look.frost ? 'rgba(206,208,214,1)' : 'rgba(38,44,54,1)'; paint.lineWidth = 0.32 * ppm;
    paint.beginPath(); paint.moveTo(x * ppm, -y * ppm);
    let dir = Math.floor(r() * 4);
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
      const len = (4 + Math.floor(r() * 16)) * 1.27; const diag = r() > 0.55;
      const d = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]][dir]! : [[1, 0], [0, 1], [-1, 0], [0, -1]][dir]!;
      x += d[0]! * len; y += d[1]! * len; paint.lineTo(x * ppm, -y * ppm);
      dir = (dir + (r() > 0.5 ? 1 : 3)) % 4;
    }
    paint.stroke();
  }
  const body = look.frost ? 'rgba(150,146,138,1)' : 'rgba(46,42,36,1)';
  for (let i = 0; i < 26; i++) {
    const x0 = 8 + r() * (L.w - 16); const y0 = -8 - r() * (L.h - 16); const along = r() > 0.5; const n = 3 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const x = along ? x0 + k * 1.8 : x0; const y = along ? y0 : y0 - k * 1.8;
      const w = (along ? 0.6 : 1.1) * ppm; const hh = (along ? 1.1 : 0.6) * ppm;
      paint.fillStyle = body; paint.fillRect(x * ppm, -y * ppm, w, hh);
      // Tin terminations at both ends of each part.
      paint.fillStyle = tin;
      if (along) { tinRect(x * ppm, -y * ppm, w, 0.22 * ppm); tinRect(x * ppm, -y * ppm + hh - 0.22 * ppm, w, 0.22 * ppm); }
      else { tinRect(x * ppm, -y * ppm, 0.22 * ppm, hh); tinRect(x * ppm + w - 0.22 * ppm, -y * ppm, 0.22 * ppm, hh); }
    }
  }
  for (const [x, y] of L.holes) {
    paint.fillStyle = 'rgba(170,150,104,1)'; dot(x * ppm, -y * ppm, 4 * ppm);
    for (const c of [paint, mg]) { c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(x * ppm, -y * ppm, 1.9 * ppm, 0, PI * 2); c.fill(); c.restore(); }
  }
  const silk = look.frost ? 'rgba(80,84,92,1)' : 'rgba(205,210,220,1)';
  paint.fillStyle = silk; paint.strokeStyle = silk; paint.lineWidth = 0.18 * ppm;
  paint.font = `600 ${1.6 * ppm}px "DM Sans Variable"`;
  paint.fillText(`${brandName(b.brand).toUpperCase()} ${b.name.toUpperCase()} · MADE FOR THE BENCH`, (L.w * 0.4) * ppm, (L.h - 10) * ppm);
  // Designators beside parts, outlines around connector footprints, and a serial sticker, as a real underside carries.
  paint.font = `500 ${1.1 * ppm}px "DM Sans Variable"`;
  for (let i = 0; i < 70; i++) { const x = 10 + r() * (L.w - 30); const y = 10 + r() * (L.h - 20); paint.fillText(`${['C', 'R', 'U', 'Q', 'L'][Math.floor(r() * 5)]}${100 + Math.floor(r() * 800)}`, x * ppm, y * ppm); }
  paint.strokeRect((L.atx24.x - 4) * ppm, -(L.atx24.y + 26.5) * ppm, 8 * ppm, 53 * ppm);
  paint.strokeRect((L.eps.x - 9.5) * ppm, -(L.eps.y + 5) * ppm, 19 * ppm, 10 * ppm);
  for (const d of L.dimms.slice(0, b.ramSlots)) paint.strokeRect((d.x - 2) * ppm, -(d.y + 68) * ppm, 4 * ppm, 136 * ppm);
  const sx = L.w * 0.14; const sy = L.h * 0.62; const sw = 34; const sh = 11;
  paint.fillStyle = 'rgba(214,215,218,1)'; paint.fillRect(sx * ppm, sy * ppm, sw * ppm, sh * ppm);
  paint.fillStyle = 'rgba(28,30,34,1)';
  let bx = sx + 1.5; while (bx < sx + sw - 1.5) { const bw = 0.18 + r() * 0.42; paint.fillRect(bx * ppm, (sy + 1.4) * ppm, bw * ppm, 5.2 * ppm); bx += bw + 0.16 + r() * 0.34; }
  paint.font = `600 ${1.4 * ppm}px "DM Sans Variable"`;
  paint.fillText(`SN ${b.id.toUpperCase()}-2611-04172`, (sx + 1.5) * ppm, (sy + 9.4) * ppm);
  return { map: wrap(cv, { srgb: true, repeat: false }), mr: wrap(mv, { repeat: false }) };
}

// ---- pieces ---------------------------------------------------------------------------------

/** Finned heatsink block with angled armor on top and diagonal cut lines. */
function heatsink(pb: PartBuilder, look: Look, x0: number, x1: number, y0: number, y1: number, h: number, finsAlong: 'x' | 'y', seed: string, compact = false) {
  const w = x1 - x0; const d = y0 - y1;
  const base = Math.min(8, h * 0.25);
  pb.add(rbox(w, d, base, 0.8, 2), look.sink, at((x0 + x1) / 2, (y0 + y1) / 2, T + base / 2));
  const along = finsAlong === 'y' ? d : w;
  const n = Math.max(3, Math.floor(along / 3.3));
  const finT = 1.4;
  const finGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const o = -along / 2 + (along / n) * (i + 0.5);
    const span = finsAlong === 'y' ? w : d;
    const prof = polyShape([[-span / 2, 0], [span / 2, 0], [span / 2, h - base - 9], [span / 2 - 6, h - base - 4], [-span / 2, h - base - 4]]);
    const g = extrude(prof, finT, 0.25, 'xy', 2, 1);
    g.translate(0, 0, -finT / 2);
    const m = finsAlong === 'y'
      ? new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2 + o, T + base).multiply(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)))
      : new THREE.Matrix4().makeTranslation((x0 + x1) / 2 + o, (y0 + y1) / 2, T + base).multiply(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    finGeos.push(clean(g).applyMatrix4(m));
    g.dispose();
  }
  // One mesh that skips the occlusion pass: fins thinner than a pixel came out of it as grey speckle.
  const fins = pb.mesh(mergeGeometries(finGeos), mat(look.frost ? look.sinkDark : 'finAnodized'), undefined, { uv: 'box' });
  fins.userData.noAO = true; fins.castShadow = true;
  for (const fg of finGeos) fg.dispose();
  const top = h - 4;
  const r = seededFor(seed);
  // A compact heatsink keeps one short armor cap at its end, so its fins show across most of its length.
  const cut = compact ? 0.18 : 0.32 + r() * 0.3;
  const a1 = roundedPoly([[x0, y0], [x0 + w * cut + 6, y0], [x0 + w * cut - 6, y1], [x0, y1]], 0.8);
  pb.add(extrude(a1, 3.6, 0.7, 'xy', 3, 2), look.sink, at(0, 0, T + top));
  if (!compact) {
    const a2end = Math.min(x1, x0 + w * (cut + 0.34));
    const a2 = roundedPoly([[x0 + w * cut + 7.2, y0], [a2end, y0], [a2end - 10, y1], [x0 + w * cut - 4.8, y1]], 0.8);
    pb.add(extrude(a2, 4.0, 0.7, 'xy', 3, 2), look.sinkDark, at(0, 0, T + top - 0.4));
  }
  for (let i = 0; i < 3; i++) pb.add(rbox(Math.min(d * 0.5, 14), 0.6, 0.6, 0.2, 1), look.sink, xf({ p: [x0 + w * (compact ? 0.04 + i * 0.045 : cut + 0.12 + i * 0.06), (y0 + y1) / 2, T + top + 3.7], r: [0, 0, -0.9] }));
}

function choke(pb: PartBuilder, x: number, y: number, labels?: Labels) {
  pb.add(rbox(7.2, 7.2, 5.2, 0.6, 2), 'ferrite', at(x, y, T + 2.6));
  // One phase array uses one part, so every choke prints R22; each also carries a lot code and the pad printing sits a
  // little unevenly, as it does on real parts.
  if (labels) {
    const r = seededFor(`choke-${Math.round(x * 10)}-${Math.round(y * 10)}`);
    const dx = (r() - 0.5) * 0.5; const dy = (r() - 0.5) * 0.4;
    const lot = `${'ABCDEHK'[Math.floor(r() * 7)]}${1 + Math.floor(r() * 9)}${'0123456789'[Math.floor(r() * 10)]}`;
    labels.text('R22', TINY_TYPE, 1.3, at(x + dx, y + 0.9 + dy, T + 5.22), { color: '#8d9199' });
    labels.text(lot, TINY_TYPE, 0.8, at(x + dx, y - 1.1 + dy, T + 5.22), { color: '#6f737b' });
  }
  pb.add(rbox(7.6, 1.2, 0.6, 0.2, 1), 'nickel', at(x, y - 3.3, T + 0.3));
}

/** A solid capacitor: a can with a rolled top edge and a satin top; a sharp rim caught the key light as a hot point. */
function capacitor(pb: PartBuilder, x: number, y: number, h = 8, r = 2.6, gold = false) {
  pb.add(lathe([[0, 0], [r, 0], [r, h - 0.9], [r - 0.15, h - 0.45], [r - 0.45, h - 0.2], [r - 0.6, h - 0.2], [0, h - 0.2]], 24), gold ? 'gold' : 'capBody', at(x, y, T));
  pb.add(cyl(r - 0.65, 0.12, 'z', 24), 'capTop', at(x, y, T + h - 0.14));
}

function housing(pb: PartBuilder, look: Look, x: number, y: number, w: number, h: number, depth: number, cols: number, rows: number, pitch: number, along: 'x' | 'y') {
  pb.add(rbox(w, h, depth, 0.6, 2), look.plastic, at(x, y, T + depth / 2));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const ox = along === 'x' ? (i - (cols - 1) / 2) * pitch : (j - (rows - 1) / 2) * pitch;
    const oy = along === 'x' ? (j - (rows - 1) / 2) * pitch : (i - (cols - 1) / 2) * pitch;
    pb.add(new THREE.BoxGeometry(pitch * 0.68, pitch * 0.68, 0.6), 'darkVoid', at(x + ox, y + oy, T + depth + 0.02), { uv: 'keep' });
    pb.add(cyl(0.55, 0.4, 'z', 8), 'gold', at(x + ox, y + oy, T + depth - 2.5));
  }
}

/**
 * The right angle 24 pin header: a shroud whose mouth is the board edge, a grid of pin cells set back inside the mouth, and the
 * latch ramp on top.
 */
function edgeHeader(pb: PartBuilder, look: Look, edge: number, y: number): Anchor {
  const hd = atx24Header(edge);
  const d = hd.x1 - hd.x0; const mouth = 3;
  pb.add(rbox(d - mouth + 0.6, hd.w, hd.h, 0.6, 2), look.plastic, at(hd.x0 + (d - mouth + 0.6) / 2, y, hd.mid));
  const { ph, pw } = plugSection(2, 12, 4.2);
  const ow = pw + 0.9; const oh = ph + 0.9;
  const frame = rrectShape(hd.h, hd.w, 0.6); frame.holes.push(rrectHole(oh, ow, 0.5));
  pb.add(extrude(frame, mouth, 0.3, 'zy'), look.plastic, at(edge - mouth, y, hd.mid));
  const cells = rrectShape(oh, ow, 0.5); const pins: THREE.Matrix4[] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) {
    const oz = (r - 0.5) * 4.2; const oy = (c - 5.5) * 4.2;
    cells.holes.push(rrectHole(3.75, 3.75, 0.5, oz, oy));
    pins.push(at(edge - mouth + 0.9, y + oy, hd.mid - oz));
  }
  pb.add(extrude(cells, 2.2, 0.15, 'zy'), look.plastic, at(edge - mouth, y, hd.mid));
  pb.add(new THREE.BoxGeometry(0.2, ow, oh), 'darkVoid', at(edge - mouth + 0.1, y, hd.mid), { uv: 'keep' });
  pb.instanced(new THREE.BoxGeometry(1.6, 0.64, 0.64), 'gold', pins);
  pb.add(rbox(2.2, 4.4, 0.9, 0.3, 1), look.plastic, at(edge - 1.1, y, T + hd.h + 0.45));
  for (const s of [-1, 1]) pb.add(rbox(d - 3, 1.2, 0.8, 0.3, 1), look.plastic, at(hd.x0 + d / 2 - 1, y + s * (hd.w / 2 - 4), T + hd.h + 0.3));
  return { pos: [edge, y, hd.mid], dir: [1, 0, 0] };
}

function pinHeader(pb: PartBuilder, look: Look, x: number, y: number, cols: number, rows: number, shroud: boolean) {
  const pitch = 2.54;
  const w = cols * pitch + 0.6; const h = rows * pitch + 0.6;
  pb.add(rbox(w, h, 2.4, 0.3, 1), look.plastic, at(x, y, T + 1.2));
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) mats.push(at(x + (i - (cols - 1) / 2) * pitch, y + (j - (rows - 1) / 2) * pitch, T + 2.4 + 2.9));
  pb.instanced(new THREE.BoxGeometry(0.64, 0.64, 5.8), 'gold', mats);
  if (shroud) {
    pb.add(rbox(w + 2.4, 1.0, 9, 0.3, 1), look.plastic, at(x, y + h / 2 + 0.7, T + 4.5));
    pb.add(rbox(w + 2.4, 1.0, 9, 0.3, 1), look.plastic, at(x, y - h / 2 - 0.7, T + 4.5));
  } else {
    pb.add(rbox(w, 0.9, 6.2, 0.2, 1), look.plastic, at(x, y + h / 2 + 0.3, T + 3.1));
  }
}

// ---- the board ------------------------------------------------------------------------------

export function boardPart(id: string, opts: GenOpts = {}): PartObject {
  const b = getBoard(id);
  if (!b) throw new Error(`unknown board ${id}`);
  const L = boardLayout(b);
  const look = lookOf(b);
  const key = opts.key ?? `board:${id}`;
  const detail = opts.detail ?? 1;
  const pb = new PartBuilder(`board-${id}`);
  const labels = new Labels(pb, 22);
  const anchors: Record<string, Anchor> = {};
  const movers: Record<string, THREE.Object3D> = {};
  const zones: Zone[] = [];

  const outline = new THREE.Shape(); rrect(outline, 0, -L.h, L.w, L.h, 1.2);
  for (const [x, y] of L.holes) outline.holes.push(circleHole(x, y, 1.9));
  // The body shows only at its edges, where a board shows its matte fiberglass core: a clearcoated edge broke into dashes.
  pb.add(extrude(outline, T, 0.35, 'xy', 12, 2), 'pcbCore');
  const ppm = Math.max(4, Math.round(9 * detail));
  const surf = surface(b, L, look, ppm);
  const topMat = pb.own(new THREE.MeshPhysicalMaterial({ map: pb.own(surf.map), bumpMap: pb.own(surf.bump), bumpScale: 0.6, roughness: look.frost ? 0.42 : 0.38, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.22, alphaTest: 0.5 }));
  const top = new THREE.PlaneGeometry(L.w, L.h); top.translate(L.w / 2, -L.h / 2, T + 0.02);
  pb.mesh(top, topMat, undefined, { uv: 'keep' });
  const backTex = backSurface(b, L, look, Math.max(4, Math.round(8 * detail)));
  const backMat = pb.own(new THREE.MeshPhysicalMaterial({ map: pb.own(backTex.map), roughnessMap: pb.own(backTex.mr), metalnessMap: backTex.mr, roughness: 1, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.3, alphaTest: 0.5 }));
  const back = new THREE.PlaneGeometry(L.w, L.h); back.rotateY(PI); back.translate(L.w / 2, -L.h / 2, -0.02);
  const buv = back.getAttribute('uv'); for (let i = 0; i < buv.count; i++) buv.setX(i, 1 - buv.getX(i));
  pb.mesh(back, backMat, undefined, { uv: 'keep' });
  pb.add(rbox(64, 64, 3.2, 0.8, 2), 'steelZinc', at(L.socket.x, L.socket.y, -1.6));
  {
    const bpg = screwGeometry(2.4, 1.2, 'button');
    const bpm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x9a9da3, metalness: 1, roughness: 0.38, vertexColors: true }));
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][]) pb.add(bpg.clone(), bpm, xf({ p: [L.socket.x + sx * 26, L.socket.y + sy * 26, -3.2], r: [PI, 0, 0] }), { uv: 'keep' });
    bpg.dispose();
  }
  {
    const bsg = screwGeometry(2.6, 1.3, 'pan');
    const bsm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x8e9197, metalness: 1, roughness: 0.36, vertexColors: true }));
    const vrB = L.vrmRear; const vtB = L.vrmTop;
    const pts: [number, number][] = [[(vrB.x0 + vrB.x1) / 2, vrB.y0 - 8], [(vrB.x0 + vrB.x1) / 2, vrB.y1 + 8], [vtB.x0 + 8, (vtB.y0 + vtB.y1) / 2], [vtB.x1 - 8, (vtB.y0 + vtB.y1) / 2]];
    if (L.chipset) pts.push([L.chipset.x0 + 6, L.chipset.y0 - 6], [L.chipset.x1 - 6, L.chipset.y1 + 6]);
    for (const [px, py] of pts) pb.add(bsg.clone(), bsm, xf({ p: [px, py, 0], r: [PI, 0, 0] }), { uv: 'keep' });
    bsg.dispose();
  }

  // socket, load plate and lever
  const hb = b.platform === 'hb';
  const [sw, sh] = hb ? [52, 66] : [52, 58];
  const sx = L.socket.x; const sy = L.socket.y;
  const cav = hb ? [42, 60] : [47, 47];
  const body = rrectShape(sw, sh, 0.8); body.holes.push(rrectHole(cav[0]! + 0.6, cav[1]! + 0.6, 0.8));
  pb.add(extrude(body, 3.0, 0.4, 'xy', 6, 1), look.plastic, at(sx, sy, T));
  pb.add(new THREE.BoxGeometry(cav[0]! + 0.6, cav[1]! + 0.6, 1.26), look.plastic, at(sx, sy, T + 0.63));
  pb.add(new THREE.BoxGeometry(cav[0]!, cav[1]!, 0.08), 'plasticDark', at(sx, sy, T + 1.3), { uv: 'box' });
  const pinMats: THREE.Matrix4[] = [];
  for (let i = 0; i < cav[0]! / 1.6; i++) for (let j = 0; j < cav[1]! / 1.6; j++) {
    const x = sx - cav[0]! / 2 + 0.8 + i * 1.6; const y = sy - cav[1]! / 2 + 0.8 + j * 1.6;
    if (Math.abs(x - sx) < cav[0]! * 0.18 && Math.abs(y - sy) < cav[1]! * 0.16) continue;
    pinMats.push(xf({ p: [x, y, T + 1.6], r: [0.55, 0, 0] }));
  }
  if (detail >= 1) pb.instanced(new THREE.BoxGeometry(0.42, 0.95, 0.16), pb.own(new THREE.MeshPhysicalMaterial({ color: 0xe3bc68, metalness: 1, roughness: 0.42 })), pinMats, { shadow: false });
  const hingeY = sy - sh / 2 + 1;
  const plate = pb.group('socket-frame', pb.root, at(sx, hingeY, T + 3.3));
  const fw = sw - 2; const fh = sh - 4;
  const frameShape = new THREE.Shape(); rrect(frameShape, -fw / 2, 0, fw, fh, 2.5);
  const win = hb ? [33, 51] : [38, 38];
  const wp = new THREE.Path(); rrect(wp, -win[0]! / 2, (fh - win[1]!) / 2, win[0]!, win[1]!, 2); frameShape.holes.push(wp);
  pb.add(extrude(frameShape, 0.9, 0.25, 'xy', 8, 1), 'steelZinc', undefined, { to: plate });
  pb.add(rbox(fw, 1.2, 2.0, 0.4, 1), 'steelBare', at(0, 0.6, -0.4), { to: plate });
  pb.add(rbox(10, 4, 1.2, 0.4, 1), 'steelBare', at(0, fh + 1.6, 0.5), { to: plate });
  movers['socket-frame'] = plate;
  const lever = pb.group('socket-lever', pb.root, at(sx + sw / 2 + 2.2, hingeY + 2, T + 2.4));
  pb.add(cyl(0.9, fh - 2, 'y', 12), 'steelBare', at(0, (fh - 2) / 2, 0), { to: lever });
  pb.add(cyl(0.9, 8, 'x', 12), 'steelBare', at(-4, fh - 2, 0), { to: lever });
  pb.add(rbox(3, 7, 2.4, 0.8, 2), 'plasticMatte', at(-0.2, 1, 0), { to: lever });
  movers['socket-lever'] = lever;
  {
    const fsg = screwGeometry(1.8, 0.9, 'button');
    const fsm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x7e8187, metalness: 1, roughness: 0.48, vertexColors: true }));
    for (const [ox, oy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as [number, number][]) pb.add(fsg.clone(), fsm, at(sx + ox * (sw / 2 - 3), sy + oy * (sh / 2 - 3), T + 3.0), { uv: 'keep' });
    fsg.dispose();
  }

  // power delivery
  const vr = L.vrmRear; const vt = L.vrmTop;
  for (let y = vr.y0 - 6; y > vr.y1 + 4; y -= 8.6) { choke(pb, vr.x1 + 5, y, labels); capacitor(pb, vr.x1 + 12.5, y, 7.5, 2.4); }
  for (let x = vt.x0 + 4; x < vt.x1 - 4; x += 8.6) { choke(pb, x, vt.y1 - 5, labels); }
  // Solid capacitors under the top regulator row and beside the memory slots, and an audio section by the rear edge.
  for (let x = vt.x0 + 16; x < vt.x1 - 6; x += 8.6) capacitor(pb, x, vt.y1 - 11.5, 7.5, 2.4);
  const lastDimm = L.dimms[L.dimms.length - 1];
  if (lastDimm) for (const [dx, dy] of [[13, -22], [13, -30.5], [20.5, -22]] as [number, number][]) capacitor(pb, lastDimm.x + dx, dy, 7, 2.2);
  if (L.size !== 'itx') {
    for (const y of [-180, -188.5, -250, -258.5, -275]) capacitor(pb, 11, y, 9, 2.6, true);
    pb.add(rbox(7, 7, 1.1, 0.3, 1), 'chip', at(11, -218, T + 0.55));
    labels.text('KR-A7', TINY_TYPE, 1.0, at(11, -218, T + 1.12), { color: '#8a8e96' });
  }
  heatsink(pb, look, vr.x0, vr.x1, vr.y0, vr.y1, vr.h, 'y', `${id}-vr`);
  heatsink(pb, look, vt.x0, vt.x1, vt.y0, vt.y1, vt.h, 'x', `${id}-vt`, true);

  // rear connector block and its armor cover
  const ioTop = 41;
  type Port = { y: number; kind: 'usb2' | 'usbc' | 'lan' | 'audio' | 'ant' | 'dp' };
  const allPorts: Port[] = [
    { y: -12, kind: 'ant' }, { y: -26, kind: 'dp' }, { y: -42, kind: 'usb2' }, { y: -58, kind: 'usb2' }, { y: -74, kind: 'usbc' }, { y: -90, kind: 'lan' }, { y: -106, kind: 'usb2' }, { y: -122, kind: 'usb2' }, { y: -140, kind: 'audio' },
  ];
  const portRows = allPorts.filter((p) => p.y > -150);
  const F = -3.4;
  const shield = rrectShape(ioTop - 2, 148, 1.2, -(T + (ioTop - 2) / 2), -78);
  const hole = (zw: number, yh: number, r: number, cz: number, cy: number) => shield.holes.push(rrectHole(zw, yh, r, -cz, cy));
  const tag = (text: string, y: number, z = T + 20) => labels.text(text, TINY_TYPE, 1.5, xf({ p: [-3.05, y, z], r: [0, -PI / 2, 0] }), { color: look.frost ? '#5d616b' : '#a3a8b1' });
  for (const p of portRows) {
    if (p.kind === 'usb2') {
      for (const dz of [-7, 7]) {
        hole(15.2, 7, 0.6, T + 20 + dz, p.y);
        pb.add(rbox(18, 6.4, 14.6, 0.4, 1), 'nickel', at(F + 9, p.y, T + 20 + dz));
        pb.add(new THREE.BoxGeometry(1, 5.2, 12.6), 'darkVoid', at(F + 0.45, p.y, T + 20 + dz), { uv: 'keep' });
        pb.add(new THREE.BoxGeometry(1, 1.8, 11), look.frost ? 'plasticWhite' : 'plasticGrey', at(F + 0.4, p.y - 0.9, T + 20 + dz));
      }
      tag('USB 5G', p.y + 5.1);
    } else if (p.kind === 'usbc') {
      for (const dz of [-8, 8]) {
        hole(9.8, 4, 1.8, T + 20 + dz, p.y);
        pb.add(rbox(8, 3.4, 9.2, 1.6, 2), 'nickel', at(F + 4, p.y, T + 20 + dz));
        pb.add(rbox(1, 2.2, 7.6, 1, 1), 'darkVoid', at(F + 0.45, p.y, T + 20 + dz), { uv: 'keep' });
        pb.add(new THREE.BoxGeometry(1, 0.7, 6.2), look.frost ? 'plasticWhite' : 'plasticDark', at(F + 0.4, p.y, T + 20 + dz));
      }
      tag('USB-C 20G', p.y + 3.6);
    } else if (p.kind === 'lan') {
      hole(16.8, 14.4, 0.6, T + 20, p.y);
      pb.add(rbox(20, 13.8, 16.2, 0.6, 1), 'nickel', at(F + 10, p.y, T + 20));
      pb.add(new THREE.BoxGeometry(1, 11.2, 12), 'darkVoid', at(F + 0.45, p.y, T + 20), { uv: 'keep' });
      for (const dz of [-4.6, 4.6]) pb.add(new THREE.BoxGeometry(0.6, 1.8, 2.6), dz < 0 ? 'plasticNylon' : 'plasticGrey', at(F - 0.1, p.y + 5.6, T + 20 + dz));
      tag('LAN 2.5G', p.y + 9.6);
    } else if (p.kind === 'audio') {
      for (let k = 0; k < 3; k++) {
        const z = T + 9 + k * 9;
        shield.holes.push(circleHole(-z, p.y, 3.4));
        pb.add(cyl(3.2, 14, 'x', 20), look.plastic, at(F + 7, p.y, z));
        pb.add(cyl(1.8, 1, 'x', 16), 'darkVoid', at(F - 0.1, p.y, z), { uv: 'keep' });
        pb.add(lathe([[2.1, 0], [2.9, 0], [2.9, 0.4], [2.1, 0.4]], 20), 'nickel', xf({ p: [F - 0.05, p.y, z], r: [0, -PI / 2, 0] }));
      }
      tag('LINE    OUT    MIC', p.y - 6.4, T + 18);
    } else if (p.kind === 'ant') {
      for (const dz of [-8, 8]) {
        shield.holes.push(circleHole(-(T + 22 + dz), p.y, 3.4));
        pb.add(cyl(3.2, 10, 'x', 16), 'gold', at(-4, p.y, T + 22 + dz));
        pb.add(cyl(2.2, 4, 'x', 16), 'gold', at(-10, p.y, T + 22 + dz));
        pb.add(lathe([[0, 0], [3.3, 0], [3.3, 2.2], [0, 2.2]], 6), 'nickel', xf({ p: [-5.4, p.y, T + 22 + dz], r: [0, -PI / 2, 0] }));
      }
      tag('WIFI', p.y + 5.6, T + 22);
    } else {
      hole(16.6, 6.6, 0.6, T + 20, p.y);
      pb.add(rbox(16, 6, 18, 0.5, 1), 'nickel', at(F + 8, p.y, T + 20));
      pb.add(new THREE.BoxGeometry(1, 4.4, 15.6), 'darkVoid', at(F + 0.45, p.y, T + 20), { uv: 'keep' });
      tag('DP', p.y + 5.0);
    }
  }
  pb.add(extrude(shield, 0.8, 0.2, 'zy', 12, 1), look.sinkDark, at(-3.0, 0, 0));
  const coverPts: [number, number][] = [[-1, -4], [30, -4], [30, -26], [26, -34], [26, -118], [30, -126], [30, -150], [-1, -150]];
  pb.add(extrude(roundedPoly(coverPts, 1.5), 6, 1.2, 'xy', 4, 2), look.sink, at(0, 0, T + ioTop - 6));
  pb.add(extrude(roundedPoly([[14, -6], [29, -6], [29, -60], [14, -74]], 1), 1.4, 0.5, 'xy', 2, 1), look.sinkDark, at(0, 0, T + ioTop - 0.4));
  pb.add(rbox(30, 146, ioTop - 8, 1, 2), look.sinkDark, at(14.8, -77, T + (ioTop - 8) / 2 + 0.2));
  const bn = brandName(b.brand);
  const coverZ = T + ioTop + 0.05;
  labels.text(bn, BRAND_TYPE[b.brand] ?? SPEC_TYPE, 4.4, xf({ p: [21, -92, coverZ], r: [0, 0, PI / 2] }), { color: look.print });
  labels.text(b.name.toUpperCase(), MODEL_TYPE, 3.4, xf({ p: [21, -128, coverZ], r: [0, 0, PI / 2] }), { color: look.frost ? '#7d818a' : '#9a9ea7' });

  // memory slots with latches
  const slotMat: MatName = look.frost ? 'plasticWhite' : 'plasticDark';
  for (const d of L.dimms.slice(0, b.ramSlots)) {
    const len = DIMS.dimmSlotLength - 14;
    pb.add(rbox(6.4, len, DIMS.dimmSlotHeight - 0.2, 0.5, 2), slotMat, at(d.x, d.y, T + (DIMS.dimmSlotHeight - 0.2) / 2));
    pb.add(new THREE.BoxGeometry(1.6, len - 4, 0.6), 'darkVoid', at(d.x, d.y, T + DIMS.dimmSlotHeight - 0.15), { uv: 'keep' });
    pb.add(rbox(6.8, len - 10, 1.2, 0.3, 1), look.armor, at(d.x, d.y, T + 0.6));
    for (const end of [1, -1]) {
      const l = pb.group(`latch:${d.name}:${end > 0 ? 0 : 1}`, pb.root, at(d.x, d.y + end * (len / 2), T + 1));
      pb.add(rbox(6.2, 6.4, 8.6, 0.8, 2), slotMat, at(0, end * 3.4, 4.3), { to: l });
      pb.add(rbox(4, 2.2, 2.2, 0.6, 1), slotMat, at(0, end * 6.4, 7.6), { to: l });
      movers[`latch:${d.name}:${end > 0 ? 0 : 1}`] = l;
    }
  }

  // expansion slots
  L.pcie.forEach((s, i) => {
    pb.add(rbox(s.len, DIMS.pcieSlotWidth - 0.4, DIMS.pcieSlotHeight - 0.4, 0.5, 2), slotMat, at(s.x0 + s.len / 2, s.y, T + (DIMS.pcieSlotHeight - 0.4) / 2));
    pb.add(new THREE.BoxGeometry(s.len - 3, 1.6, 0.6), 'darkVoid', at(s.x0 + s.len / 2, s.y, T + DIMS.pcieSlotHeight - 0.35), { uv: 'keep' });
    if (s.kind === 'x16r') {
      for (const sgn of [1, -1]) pb.add(rbox(s.len + 2, 0.6, DIMS.pcieSlotHeight - 1.4, 0.2, 1), look.armor, at(s.x0 + s.len / 2, s.y + sgn * (DIMS.pcieSlotWidth / 2 + 0.1), T + (DIMS.pcieSlotHeight - 1.4) / 2 + 0.6));
      pb.add(rbox(s.len + 2.6, DIMS.pcieSlotWidth + 1.2, 0.5, 0.2, 1), look.armor, at(s.x0 + s.len / 2, s.y, T + DIMS.pcieSlotHeight - 0.5));
      labels.text('PCIE 5.0', TINY_TYPE, 1.3, at(s.x0 + 14, s.y, T + DIMS.pcieSlotHeight + 0.04), { color: look.frost ? '#6a6e78' : '#2a2c31' });
    }
    if (s.kind === 'x16r' || s.kind === 'x16') {
      const latch = pb.group(i === 0 ? 'pcie-latch' : `pcie-latch:${i}`, pb.root, at(s.x0 + s.len + 2.6, s.y, T + 1));
      pb.add(rbox(5, DIMS.pcieSlotWidth, 10, 0.8, 2), slotMat, at(0, 0, 5), { to: latch });
      movers[i === 0 ? 'pcie-latch' : `pcie-latch:${i}`] = latch;
    }
  });

  // M.2 slots: connector, standoff and the heatsink plate that lifts
  const m2s = L.m2.slice(0, b.m2Slots);
  const stacked = m2s.some((m) => m.level === 1);
  m2s.forEach((m, i) => {
    if (m.level === 0) {
      pb.add(rbox(6, 23, 4.2, 0.4, 1), 'plasticMatte', at(m.x0 - 1, m.y, T + 2.1));
      pb.add(cyl(2.4, 2.2, 'z', 16), 'nickel', at(m.x0 + 80, m.y, T + 1.1));
    }
    const ph = stacked ? (m.level === 0 ? 7.2 : 6) : DIMS.m2PlateHeight - 1.4;
    const pz = stacked ? (m.level === 0 ? T + 9.4 : T + 15.4) - ph : T + 1.4;
    const plate = pb.group(`m2-plate:${i + 1}`, pb.root, at(m.x0 - 4, m.y, pz));
    const pw = 94; const pd = 25;
    const shape = roundedPoly([[0, -pd / 2], [pw - 8, -pd / 2], [pw, -pd / 2 + 8], [pw, pd / 2], [8, pd / 2], [0, pd / 2 - 8]], 1.4);
    pb.add(extrude(shape, ph, 0.9, 'xy', 3, 2), look.sink, undefined, { to: plate });
    for (let k = 0; k < 7; k++) pb.add(rbox(1.1, pd - 4, 0.8, 0.3, 1), look.sinkDark, xf({ p: [18 + k * 9, 0, ph + 0.2], r: [0, 0, 0.5] }), { to: plate });
    pb.add(rbox(pw - 10, pd - 4, 1.2, 0.3, 1), 'thermalPad', at(pw / 2, 0, -0.5), { to: plate });
    labels.text(`M.2_${i + 1}`, MODEL_TYPE, 2.0, at(8, -pd / 2 + 4.5, ph + 0.06), { color: look.print, to: plate, align: 'left' });
    for (const ex of [4, pw - 4]) {
      const sg = screwGeometry(2.0, 1.0, 'button');
      pb.add(sg, (mat('nickel') as THREE.MeshPhysicalMaterial).clone(), at(ex, ex < 10 ? pd / 2 - 4 : -pd / 2 + 4, ph), { to: plate, uv: 'keep' });
    }
    movers[`m2-plate:${i + 1}`] = plate;
  });

  // chipset heatsink with the K monogram
  const cs = L.chipset;
  const chipZ = cs ? T + cs.h : 0;
  if (cs) {
    const pts: [number, number][] = [[cs.x0, cs.y0], [cs.x1 - 10, cs.y0], [cs.x1, cs.y0 - 10], [cs.x1, cs.y1], [cs.x0 + 12, cs.y1], [cs.x0, cs.y1 + 12]];
    pb.add(extrude(roundedPoly(pts, 1.4), cs.h - 2, 1.0, 'xy', 3, 2), look.sink, at(0, 0, T));
    const mx = (cs.x0 + cs.x1) / 2; const my = (cs.y0 + cs.y1) / 2;
    pb.add(extrude(roundedPoly([[mx - 16, my - 16], [mx + 16, my - 16], [mx + 16, my + 16], [mx - 16, my + 16]], 2), 1.6, 0.5, 'xy', 3, 1), look.sinkDark, at(0, 0, chipZ - 2));
    labels.draw(16, 16, (g, W, H) => {
      // Laser etched into black anodizing: a light grey, not paint white, so a glimpse through the front mesh is no sparkle.
      g.fillStyle = look.frost ? 'rgba(90,94,104,1)' : 'rgba(116,120,128,1)';
      g.beginPath(); g.moveTo(W * 0.14, H * 0.1); g.lineTo(W * 0.36, H * 0.1); g.lineTo(W * 0.36, H * 0.42); g.lineTo(W * 0.66, H * 0.1); g.lineTo(W * 0.92, H * 0.1); g.lineTo(W * 0.56, H * 0.5); g.lineTo(W * 0.92, H * 0.9); g.lineTo(W * 0.66, H * 0.9); g.lineTo(W * 0.36, H * 0.58); g.lineTo(W * 0.36, H * 0.9); g.lineTo(W * 0.14, H * 0.9); g.closePath(); g.fill();
    }, at(mx, my, chipZ - 0.35), {});
    labels.text(bn, BRAND_TYPE[b.brand] ?? SPEC_TYPE, 2.6, at(mx, cs.y1 + 6, chipZ + 0.02 - 2), { color: look.print });
  }

  // connectors, ports, headers, battery
  anchors.atx24 = edgeHeader(pb, look, L.w, L.atx24.y);
  housing(pb, look, L.eps.x, L.eps.y, 21.2, 10.2, 13, 4, 2, 4.2, 'x');
  anchors.eps = { pos: [L.eps.x, L.eps.y, T + 13], dir: [0, 0, 1] };
  L.sata.slice(0, b.sataPorts).forEach((p, i) => {
    const z = T + 3.4 + p.level * 6.4;
    pb.add(rbox(10, 8.6, 6, 0.4, 1), look.plastic, at(p.x, p.y, z));
    pb.add(new THREE.BoxGeometry(0.6, 6.4, 1.6), 'darkVoid', at(p.x + 5.05, p.y, z), { uv: 'keep' });
    anchors[`sata${i + 1}`] = { pos: [p.x + 5.2, p.y, z], dir: [1, 0, 0] };
  });
  for (const hd of L.headers) {
    if (hd.kind === 'usb') pinHeader(pb, look, hd.x, hd.y, hd.pins[0], hd.pins[1], true);
    else pinHeader(pb, look, hd.x, hd.y, hd.pins[0], hd.pins[1], false);
  }
  const fans = L.headers.filter((h) => h.kind === 'fan');
  fans.forEach((h, i) => { anchors[`fan${i + 1}`] = { pos: [h.x, h.y, T + 8.2], dir: [0, 0, 1] }; });
  pb.add(lathe([[0, 0], [10.4, 0], [10.4, 3.2], [9.6, 3.2], [9.6, 1.0], [0, 1.0]], 40), look.plastic, at(L.coin.x, L.coin.y, T));
  pb.add(puck(10, 3.2, 0.5, 40), 'nickel', at(L.coin.x, L.coin.y, T + 1.0));
  labels.text('CR2032 3V', TINY_TYPE, 1.4, at(L.coin.x, L.coin.y, T + 4.25), { color: '#55585f' });

  // small parts: chips with markings and scattered passives
  const chips: [number, number, number, number, string][] = L.size === 'itx'
    ? [[110, -150, 9, 9, 'KR-A12'], [58, -150, 6, 6, '25Q256']]
    : [[100, -268, 12, 12, 'KR-SIO'], [70, -230, 7, 7, '25Q256'], [205, -296, 10, 10, 'KA-ALC'], [120, -196, 9, 9, 'KL-2.5G']];
  for (const [x, y, w, h, t] of chips) {
    if (y < -L.h + 6) continue;
    pb.add(rbox(w, h, 1.2, 0.3, 1), 'chip', at(x, y, T + 0.6));
    labels.text(t, TINY_TYPE, Math.min(w, h) * 0.16, at(x, y, T + 1.25), { color: '#8a8e96' });
  }
  const r = seededFor(`smd-${id}`);
  const passives: THREE.Matrix4[] = []; const passivesC: THREE.Matrix4[] = [];
  const blocked = (x: number, y: number) => x < 34 || (x > 60 && x < 160 && y > -126 && y < -40) || L.dimms.some((d) => Math.abs(x - d.x) < 6 && Math.abs(y - d.y) < 75) || L.pcie.some((s) => x > s.x0 - 2 && x < s.x0 + s.len + 6 && Math.abs(y - s.y) < 6) || m2s.some((m) => x > m.x0 - 8 && x < m.x0 + 94 && Math.abs(y - m.y) < 15) || (cs ? x > cs.x0 - 2 && x < cs.x1 + 2 && y < cs.y0 + 2 && y > cs.y1 - 2 : false);
  for (let i = 0; i < Math.round(420 * detail); i++) {
    const x = 4 + r() * (L.w - 8); const y = -4 - r() * (L.h - 8);
    if (blocked(x, y)) continue;
    (r() > 0.4 ? passives : passivesC).push(xf({ p: [x, y, T + 0.25], r: [0, 0, r() > 0.5 ? PI / 2 : 0] }));
  }
  pb.instanced(new THREE.BoxGeometry(1.0, 0.5, 0.5), 'chip', passives, { shadow: false });
  pb.instanced(new THREE.BoxGeometry(1.0, 0.5, 0.5), 'ceramic', passivesC, { shadow: false });

  // mounting screws, spun down on install
  const screws = pb.group('board-screws', pb.root);
  const sg = screwGeometry(3.5, 1.6, 'pan');
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color: 0x9a9da3, metalness: 1, roughness: 0.32, vertexColors: true }));
  for (const [x, y] of L.holes) {
    const s = pb.group('screw', screws, at(x, y, T));
    pb.add(sg.clone(), sm, undefined, { to: s, uv: 'keep' });
  }
  sg.dispose();
  movers['board-screws'] = screws;

  // light zones
  const coverStrip = ['z7', 'z7i', 'x9', 'x9m', 'x9i'].includes(id);
  const chipAccent = ['z7', 'z7m', 'x9', 'x9m'].includes(id) && !!cs;
  if (coverStrip) {
    // The strip stands in the notch of the cover's edge with its top just proud of the cover, so it reads as a line of light.
    const z = new Zone(`${key}:cover`, 'board', false, stripLeds(new THREE.Vector3(28, -36, T + ioTop), new THREE.Vector3(28, -116, T + ioTop), 6.5), 0.1);
    const g = rbox(3.2, 80, 5, 1.0, 3); uvAlong(g, 'y'); g.scale(1, -1, 1);
    pb.mesh(g, z.diffuser(0.5, look.frost ? 0xd8dadf : 0x1c1d21), at(28, -76, T + ioTop - 2.2), { uv: 'keep' });
    const toMinusX = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
    pb.mesh(spillStrip(80, 7, 12), z.spill(look.frost ? 0.4 : 0.7), toMinusX.clone().setPosition(26.2, -76, T + ioTop + 0.06), { uv: 'keep' }).userData.spill = true;
    // Its light on the solid armor of the heatsink beside it. The lamp lights the fins below; a spill layer over the fins
    // painted the gaps between them and read as a lit slab.
    const toPlusX = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1));
    pb.mesh(spillStrip(80, 16, 12), z.spill(look.frost ? 0.5 : 1.0), toPlusX.setPosition(L.vrmRear.x0, -76, T + L.vrmRear.h - 0.32), { uv: 'keep' }).userData.spill = true;
    // And along the top edge of each fin, fading away from the strip, so the gaps between fins stay dark.
    {
      const vrS = L.vrmRear; const d = vrS.y0 - vrS.y1; const n = Math.max(3, Math.floor(d / 3.3));
      const pos: number[] = []; const uv: number[] = [];
      for (let i = 0; i < n; i++) {
        const y = (vrS.y0 + vrS.y1) / 2 - d / 2 + (d / n) * (i + 0.5);
        const u = Math.min(1, Math.max(0, (-36 - y) / 80));
        const zt = T + vrS.h - 4 + 0.03; const xa = vrS.x0 + (vrS.x1 - vrS.x0) * 0.25; const xb = vrS.x1;
        const q: [number, number, number, number][] = [[xa, y - 0.7, u, 0], [xa, y + 0.7, u, 0], [xb, y + 0.7, u, 1], [xb, y - 0.7, u, 1]];
        for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k]![0], q[k]![1], zt); uv.push(q[k]![2], q[k]![3]); }
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.computeVertexNormals();
      pb.mesh(fg, z.spill(look.frost ? 0.7 : 1.4), undefined, { uv: 'keep' }).userData.spill = true;
    }
    z.emit(new THREE.Vector3(28, -76, T + ioTop), new THREE.Vector3(0.55, 0, 0.84), 80, 10, 0.8, new THREE.Vector3(0, 1, 0));
    zones.push(z);
  }
  if (chipAccent && cs) {
    const p0 = new THREE.Vector3(cs.x1 - 3, cs.y0 - 12, chipZ); const p1 = new THREE.Vector3(cs.x1 - 3, cs.y1 + 6, chipZ);
    const z = new Zone(`${key}:chipset`, 'board', false, stripLeds(p0, p1, 6.5), 0.6);
    const g = rbox(2.2, p0.y - p1.y, 1.6, 0.7, 2); uvAlong(g, 'y'); g.scale(1, -1, 1);
    pb.mesh(g, z.diffuser(0.5, look.frost ? 0xd8dadf : 0x1c1d21), at(p0.x, (p0.y + p1.y) / 2, chipZ - 0.6), { uv: 'keep' });
    const toMinusX = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
    pb.mesh(spillStrip(p0.y - p1.y, 22, 8), z.spill(look.frost ? 0.42 : 0.8), toMinusX.clone().setPosition(p0.x - 1.2, (p0.y + p1.y) / 2, chipZ + 0.06), { uv: 'keep' }).userData.spill = true;
    // And on the board beside the chipset, toward the SATA ports.
    const onBoard = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1));
    // Spills beside the accent fade out past its ends; a strip lit to its ends read as a pasted rectangle.
    const faded = pb.own(z.spill(look.frost ? 0.5 : 1.0).clone()); faded.vertexColors = true;
    pb.mesh(fadeEnds(spillStrip(p0.y - p1.y, 44, 32), 14), faded, onBoard.setPosition(cs.x1 + 0.3, (p0.y + p1.y) / 2, T + 0.1), { uv: 'keep' }).userData.spill = true;
    // On the faces of the SATA ports that look back at the accent.
    const sata = L.sata.slice(0, b.sataPorts);
    if (sata.length) {
      const sy0 = Math.max(...sata.map((s) => s.y)) + 4.3; const sy1 = Math.min(...sata.map((s) => s.y)) - 4.3; const sx = Math.min(...sata.map((s) => s.x)) - 5.08;
      const toMinusXUp = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));
      const mid = (p0.y + p1.y) / 2;
      // One sided: from behind the board it glowed past the board's edge.
      const front = pb.own(faded.clone()); front.side = THREE.FrontSide;
      pb.mesh(fadeEnds(spillStripRange(p0.y - p1.y, mid - sy0, mid - sy1, 13, 24), 6), front, toMinusXUp.setPosition(sx, mid, T + 13), { uv: 'keep' }).userData.spill = true;
    }
    z.emit(new THREE.Vector3(p0.x, (p0.y + p1.y) / 2, chipZ + 1), new THREE.Vector3(0, 0, 1), p0.y - p1.y, 10, 0.7, new THREE.Vector3(0, 1, 0));
    z.emit(new THREE.Vector3(p0.x + 1.2, (p0.y + p1.y) / 2, chipZ - 2), new THREE.Vector3(1, 0, 0.25), p0.y - p1.y, 6, 0.6, new THREE.Vector3(0, 1, 0));
    zones.push(z);
  }
  if (id === 'x9') {
    const z = new Zone(`${key}:underglow`, 'board', false, stripLeds(new THREE.Vector3(L.w - 2, -10, -1), new THREE.Vector3(L.w - 2, -L.h + 10, -1), 7), 0.8);
    const g = rbox(2.4, L.h - 20, 1.4, 0.6, 2); uvAlong(g, 'y'); g.scale(1, -1, 1);
    pb.mesh(g, z.diffuser(1.0, 0xd8dadf), at(L.w - 2.2, -L.h / 2, -0.8), { uv: 'keep' });
    z.emit(new THREE.Vector3(L.w, -L.h / 2, -2), new THREE.Vector3(0.3, 0, -1), L.h - 20, 12, 0.8, new THREE.Vector3(0, 1, 0));
    zones.push(z);
  }
  labels.finish();
  const done = pb.finish();
  return { root: done.root, boxes: boardBoxes(id), anchors, zones, rotors: [], movers, dispose: () => { done.dispose(); for (const z of zones) z.dispose(); } };
}

