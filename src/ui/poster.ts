import { getStorage, K, LABELS, type StorageType } from '../data/catalog';
import { sheet } from '../engine/sheet';
import type { Build } from '../engine/types';
import { partName } from '../state/actions';
import { token } from '../world/tokens';
import type { World } from '../world/World';

export type PosterFormat = 'portrait' | 'landscape';
export const POSTER_SIZE: Record<PosterFormat, { w: number; h: number }> = { portrait: { w: 2400, h: 3000 }, landscape: { w: 3840, h: 2160 } };

/** The poster's size on this device: full, or half when the device cannot draw a frame that large. */
export function posterSize(world: World, format: PosterFormat, tier: string): { w: number; h: number; half: boolean } {
  const s = POSTER_SIZE[format];
  const half = tier === 'low' || Math.max(s.w, s.h) > world.maxFrame();
  return half ? { w: s.w / 2, h: s.h / 2, half } : { ...s, half };
}

/** The compact spec list: one line per part, in the build's order. */
function specLines(b: Build): [string, string][] {
  const kits = new Map<string, number>();
  for (const id of b.ram) kits.set(id, (kits.get(id) ?? 0) + 1);
  const ram = [...kits].map(([id, n]) => `${n > 1 ? `${n} × ` : ''}${partName('ram', id)}`).join(' · ');
  const storage = (['nvme', 'ssd', 'hdd'] as StorageType[]).filter((t) => (b.storage[t] ?? 0) > 0).map((t) => { const n = b.storage[t]!; const st = getStorage(t); return `${n > 1 ? `${n} × ` : ''}${st ? partName('storage', t) : t}`; }).join(' · ');
  const none = 'None';
  return [
    ['Case', b.case ? `${partName('case', b.case.id)} · ${LABELS.finish[b.case.finish as keyof typeof LABELS.finish]}` : none],
    ['Board', b.board ? partName('board', b.board) : none],
    ['Processor', b.cpu ? partName('cpu', b.cpu) : none],
    ['Cooler', b.cooler ? partName('cooler', b.cooler.id) : none],
    ['Memory', ram || none],
    ['Graphics', b.gpu ? partName('gpu', b.gpu) : none],
    ['Storage', storage || none],
    ['Supply', b.psu ? partName('psu', b.psu) : none],
  ];
}

function powerLine(b: Build): string {
  const s = sheet(b);
  if (!s.psuCapacityW) return `Draws ${s.drawW} W`;
  return `${s.drawW} W of ${s.psuCapacityW} W · ${s.loadPercent} percent`;
}

/** A file name from the build's name: lower case words joined by hyphens. */
export function posterFileName(name: string): string {
  const slug = name.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${slug || 'untitled-build'}.png`;
}

/**
 * The poster: the rig rendered large, then on a 2D canvas the build's name in the display face, the spec list, the power line
 * and a small footer with the product name. Portrait puts the text under the rig, landscape beside it.
 */
export async function makePoster(world: World, b: Build, format: PosterFormat, size: { w: number; h: number }): Promise<HTMLCanvasElement> {
  const { w, h } = size;
  const u = w / 100;
  const portrait = format === 'portrait';
  const clear = portrait ? { left: 0, right: 0, top: 0, bottom: Math.round(h * 0.34) } : { left: Math.round(w * 0.36), right: 0, top: 0, bottom: 0 };
  const canvas = await world.renderPoster(w, h, clear);
  const g = canvas.getContext('2d')!;
  await document.fonts.ready;
  const ink = token('ink'); const dim = token('ink-dim'); const muted = token('ink-muted'); const bg = token('bg');
  // A scrim under the text, so it reads over the room. It fades in from the rig's side.
  const grad = portrait ? g.createLinearGradient(0, h - clear.bottom - h * 0.12, 0, h) : g.createLinearGradient(clear.left + w * 0.06, 0, 0, 0);
  grad.addColorStop(0, `${bg}00`); grad.addColorStop(0.45, `${bg}d9`); grad.addColorStop(1, `${bg}f2`);
  g.fillStyle = grad;
  if (portrait) g.fillRect(0, h - clear.bottom - h * 0.12, w, clear.bottom + h * 0.12); else g.fillRect(0, 0, clear.left + w * 0.06, h);

  const display = token('font-display'); const body = token('font-body');
  const left = portrait ? u * 7 : u * 4.5;
  const colW = portrait ? w - u * 14 : clear.left - u * 8;
  let y = portrait ? h - clear.bottom + u * 1 : h * 0.2;
  const name = b.name || 'Untitled build';
  const nameSize = portrait ? u * 5.4 : u * 3.2;
  g.fillStyle = ink; g.textBaseline = 'alphabetic';
  g.font = `600 ${nameSize}px ${display}`;
  let shown = name;
  while (g.measureText(shown).width > colW && shown.length > 4) shown = `${shown.slice(0, -2)}…`;
  g.fillText(shown, left, y + nameSize);
  y += nameSize * 1.7;

  const rows = specLines(b);
  const labelSize = portrait ? u * 1.25 : u * 0.72; const valueSize = portrait ? u * 1.9 : u * 1.08;
  const cols = portrait ? 2 : 1;
  const rowH = (labelSize + valueSize) * 1.55;
  const per = Math.ceil(rows.length / cols);
  const colGap = u * 4;
  const cw = (colW - colGap * (cols - 1)) / cols;
  rows.forEach(([label, value], i) => {
    const c = Math.floor(i / per); const r = i % per;
    const x = left + c * (cw + colGap); const ry = y + r * rowH;
    g.fillStyle = muted; g.font = `500 ${labelSize}px ${body}`;
    g.fillText(label.toUpperCase(), x, ry + labelSize);
    g.fillStyle = ink; g.font = `500 ${valueSize}px ${body}`;
    let v = value;
    while (g.measureText(v).width > cw && v.length > 4) v = `${v.slice(0, -2)}…`;
    g.fillText(v, x, ry + labelSize + valueSize * 1.25);
  });
  y += per * rowH + u * 0.6;
  g.fillStyle = dim; g.font = `600 ${valueSize}px ${body}`;
  g.fillText(powerLine(b), left, y + valueSize);
  g.fillStyle = muted; g.font = `500 ${labelSize}px ${body}`;
  g.fillText(K.productName, left, h - (portrait ? u * 3 : u * 2.6));
  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('the poster could not be encoded')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, 'image/png');
  });
}
