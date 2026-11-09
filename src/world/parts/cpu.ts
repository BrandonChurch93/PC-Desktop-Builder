import * as THREE from 'three';
import { brandName, getCpu, PLATFORMS } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import { cpuBoxes } from '../layout/partBoxes';
import { at, extrude, PartBuilder, polyShape, rbox, roundedPoly } from '../kit/geometry';
import { Labels } from '../kit/labels';
import { smallBoardMaterial } from '../kit/pcb';
import { canvas, wrap } from '../kit/textures';
import { BRAND_TYPE, MODEL_TYPE, SPEC_TYPE, TINY_TYPE } from '../kit/type';
import { seededFor } from '../kit/rng';
import type { GenOpts, PartObject } from './types';

const SUB_T = 1.15;

/** Gold pads on the underside: an LGA field on a substrate. */
function padTexture(w: number, h: number, notch: boolean, seed: string): { color: THREE.Texture; metal: THREE.Texture } {
  const ppm = 20;
  const W = Math.round(w * ppm); const H = Math.round(h * ppm);
  const c = canvas(W, H); const m = canvas(W, H);
  c.g.fillStyle = notch ? 'rgba(22,30,38,1)' : 'rgba(16,52,34,1)'; c.g.fillRect(0, 0, W, H);
  m.g.fillStyle = 'rgba(0,0,0,1)'; m.g.fillRect(0, 0, W, H);
  const r = seededFor(seed);
  const pitch = 0.95;
  for (let y = 1.6; y < h - 1.4; y += pitch) {
    for (let x = 1.6 + ((Math.round(y / pitch) % 2) * pitch) / 2; x < w - 1.4; x += pitch) {
      const cx = x - w / 2; const cy = y - h / 2;
      if (Math.abs(cx) < w * 0.17 && Math.abs(cy) < h * 0.15) continue;
      c.g.fillStyle = 'rgba(214,170,92,1)';
      c.g.beginPath(); c.g.arc(x * ppm, y * ppm, 0.32 * ppm, 0, Math.PI * 2); c.g.fill();
      m.g.fillStyle = 'rgba(255,255,255,1)';
      m.g.beginPath(); m.g.arc(x * ppm, y * ppm, 0.32 * ppm, 0, Math.PI * 2); m.g.fill();
    }
  }
  for (let i = 0; i < 46; i++) {
    const cx = w / 2 + (r() - 0.5) * w * 0.3; const cy = h / 2 + (r() - 0.5) * h * 0.26;
    c.g.fillStyle = r() > 0.5 ? 'rgba(150,120,80,1)' : 'rgba(60,62,66,1)';
    c.g.fillRect(cx * ppm, cy * ppm, 0.9 * ppm, 0.45 * ppm);
  }
  c.g.fillStyle = 'rgba(214,170,92,1)';
  c.g.beginPath(); c.g.moveTo(0.8 * ppm, (h - 0.8) * ppm); c.g.lineTo(3.4 * ppm, (h - 0.8) * ppm); c.g.lineTo(0.8 * ppm, (h - 3.4) * ppm); c.g.fill();
  return { color: wrap(c.canvas, { srgb: true, repeat: false }), metal: wrap(m.canvas, { repeat: false }) };
}

export function cpuPart(id: string, opts: GenOpts = {}): PartObject {
  const spec = getCpu(id);
  const hb = spec?.platform === 'hb';
  const [w, h] = hb ? [40, 58] : [45, 45];
  const pb = new PartBuilder(`cpu-${id}`);
  const labels = new Labels(pb, 64);
  void opts;
  const sub = hb
    ? roundedPoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2 + 4.2, h / 2], [-w / 2, h / 2 - 4.2]], 0.6)
    : roundedPoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 0.7);
  const subLook = hb ? { mask: 'rgba(20,24,30,1)', trace: 'rgba(36,44,56,1)', pad: 'rgba(170,150,104,1)', body: 'rgba(48,44,38,1)' } : { mask: 'rgba(16,60,40,1)', trace: 'rgba(30,86,58,1)', pad: 'rgba(176,154,104,1)', body: 'rgba(48,44,38,1)' };
  pb.add(extrude(sub, SUB_T, 0.2, 'xy', 8), smallBoardMaterial(`cpu-${id}`, w, h, subLook, [-w / 2, -h / 2]));
  const pads = padTexture(w, h, hb, id);
  const under = new THREE.ShapeGeometry(sub, 8);
  under.rotateX(Math.PI);
  const uv = under.getAttribute('uv');
  const pos = under.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, 1 - (-pos.getY(i) + h / 2) / h);
  const padMat = pb.own(new THREE.MeshPhysicalMaterial({ map: pb.own(pads.color), metalnessMap: pb.own(pads.metal), metalness: 1, roughness: 0.32, clearcoat: 0.3 }));
  pb.mesh(under, padMat, at(0, 0, -0.02), { uv: 'keep' });

  const skirt = hb ? [w - 4.5, h - 5] : [w - 4.2, w - 4.2];
  const top = hb ? [w - 9, h - 9] : [w - 10, w - 10];
  const ihsMat = 'nickelLapped';
  const skirtShape = hb
    ? roundedPoly([[-skirt[0]! / 2, -skirt[1]! / 2], [skirt[0]! / 2, -skirt[1]! / 2], [skirt[0]! / 2, skirt[1]! / 2], [-skirt[0]! / 2 + 3, skirt[1]! / 2], [-skirt[0]! / 2, skirt[1]! / 2 - 3]], 1.6)
    : roundedPoly([[-skirt[0]! / 2, -skirt[1]! / 2], [skirt[0]! / 2, -skirt[1]! / 2], [skirt[0]! / 2, skirt[1]! / 2], [-skirt[0]! / 2, skirt[1]! / 2]], 2.2);
  pb.add(extrude(skirtShape, 1.1, 0.5, 'xy', 12, 3), ihsMat, at(0, 0, SUB_T));
  const plate = hb
    ? roundedPoly([[-top[0]! / 2, -top[1]! / 2], [top[0]! / 2, -top[1]! / 2], [top[0]! / 2, top[1]! / 2], [-top[0]! / 2 + 2.4, top[1]! / 2], [-top[0]! / 2, top[1]! / 2 - 2.4]], 1.5)
    : roundedPoly([[-top[0]! / 2, -top[1]! / 2], [top[0]! / 2, -top[1]! / 2], [top[0]! / 2, top[1]! / 2], [-top[0]! / 2, top[1]! / 2]], 2.4);
  const total = DIMS.cpuTop - 2;
  pb.add(extrude(plate, total - SUB_T - 1.1 + 0.02, 0.7, 'xy', 12, 3), ihsMat, at(0, 0, SUB_T + 1.08));
  if (!hb) {
    for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      pb.add(rbox(sx ? 1.2 : 8, sy ? 1.2 : 8, 0.6, 0.2, 1), 'nickel', at(sx * (skirt[0]! / 2 + 0.4), sy * (skirt[1]! / 2 + 0.4), SUB_T + 0.3));
    }
  }
  const rng = seededFor(`smd-${id}`);
  for (let i = 0; i < 28; i++) {
    const side = i % 4; const t = (rng() - 0.5) * (side < 2 ? w : h) * 0.8;
    const edge = side < 2 ? h / 2 - 1.3 : w / 2 - 1.3;
    const x = side < 2 ? t : (side === 2 ? 1 : -1) * edge; const y = side < 2 ? (side === 0 ? 1 : -1) * edge : t;
    if (hb && x < -w / 2 + 6 && y > h / 2 - 6) continue;
    pb.add(rbox(side < 2 ? 1.0 : 0.5, side < 2 ? 0.5 : 1.0, 0.45, 0.1, 1), rng() > 0.5 ? 'ceramic' : 'chip', at(x, y, SUB_T + 0.22));
  }
  const tri = polyShape([[0, 0], [2.4, 0], [0, 2.4]]);
  pb.add(extrude(tri, 0.06, 0, 'xy', 1), 'gold', at(-w / 2 + 0.9, -h / 2 + 0.9, SUB_T));

  const brand = spec ? brandName(spec.brand) : '';
  const etch = '#5f636b';
  const z = total + 0.02;
  const pl = PLATFORMS.get(spec?.platform ?? 'cv');
  labels.draw(5.5, 5.5, (g, W, H) => {
    g.strokeStyle = etch; g.lineWidth = W * 0.06; g.lineCap = 'round';
    if (hb) {
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const x = (i / 40) * W * 0.86 + W * 0.07; const y = H * 0.5 + Math.sin((i / 40) * Math.PI * 3) * H * 0.22; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const x = (i / 40) * W * 0.86 + W * 0.07; const y = H * 0.75 + Math.sin((i / 40) * Math.PI * 3) * H * 0.1; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    } else {
      g.fillStyle = etch;
      for (let i = 0; i < 3; i++) {
        g.beginPath(); const o = i * W * 0.24;
        g.moveTo(W * 0.1 + o, H * 0.88); g.lineTo(W * 0.3 + o, H * 0.88); g.lineTo(W * 0.52 + o, H * 0.12); g.lineTo(W * 0.32 + o, H * 0.12); g.closePath(); g.fill();
      }
    }
  }, at(hb ? -top[0]! / 2 + 7 : -top[0]! / 2 + 6, top[1]! / 2 - 6.5, z), { rough: 0.62 });
  labels.text(brand, { ...(BRAND_TYPE[spec?.brand ?? 'cindervane'] ?? SPEC_TYPE), weight: hb ? 400 : 300 }, 1.7, at(hb ? -top[0]! / 2 + 11 : -top[0]! / 2 + 10.5, top[1]! / 2 - 6.5, z), { color: etch, align: 'left', rough: 0.62 });
  labels.text(spec?.name ?? '', MODEL_TYPE, 2.4, at(-top[0]! / 2 + 3, 0, z), { color: '#6e7179', align: 'left', rough: 0.62 });
  labels.text(`${spec?.cores ?? 8} CORES · ${spec?.draw ?? 0} W · ${pl?.socketLabel ?? ''}`, TINY_TYPE, 0.9, at(-top[0]! / 2 + 3, -3.6, z), { color: etch, align: 'left', rough: 0.62 });
  labels.text(hb ? 'HB-16X · 2B47 · L4L9' : 'CV-8E · 1C22 · K7A2', TINY_TYPE, 0.85, at(-top[0]! / 2 + 3, -6.2, z), { color: etch, align: 'left', rough: 0.62 });
  labels.draw(5.2, 5.2, (g, W) => {
    const r = seededFor(`dm-${id}`); const n = 14; const s = W / n;
    g.fillStyle = etch;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (x === 0 || y === n - 1 || (y === 0 && x % 2 === 0) || (x === n - 1 && y % 2 === 1) || r() > 0.55) g.fillRect(x * s, y * s, s * 0.92, s * 0.92);
  }, at(top[0]! / 2 - 4.8, -top[1]! / 2 + 4.8, z), { rough: 0.62 });
  labels.draw(1.6, 1.6, (g, W, H) => { g.fillStyle = etch; g.beginPath(); g.moveTo(0, H); g.lineTo(W, H); g.lineTo(0, 0); g.closePath(); g.fill(); }, at(-top[0]! / 2 + 1.6, -top[1]! / 2 + 1.6, z), { rough: 0.62 });
  labels.finish();
  const done = pb.finish();
  return { root: done.root, boxes: cpuBoxes(id), anchors: {}, zones: [], rotors: [], movers: {}, dispose: done.dispose };
}

