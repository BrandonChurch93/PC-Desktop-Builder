import { useEffect, useState } from 'react';
import { getCase, LABELS, type Category, type MountGroup } from '../data/catalog';
import { partName } from '../state/actions';
import type { V3 } from '../world/layout/math';
import { useApp } from './hooks';
import { getWorld } from './worldRef';
import s from './ExplodedLabels.module.css';

type Group = { key: string; eyebrow: string; name: string; centers: V3[] };
type Placed = { key: string; eyebrow: string; name: string; ax: number; ay: number; lx: number; ly: number; side: 'l' | 'r' };

const LABEL_H = 40;
const GAP = 8;
const REACH = 56;
const EDGE = 16;

/** One label per part, and one per set: a kit's sticks, a mount group's fans, a type of drive. */
function groups(): Group[] {
  const w = getWorld();
  if (!w) return [];
  const caseId = w.rig.caseId ?? undefined;
  const out = new Map<string, Group>();
  for (const { item, center } of w.exploder.labels()) {
    const p = item.placed;
    let key = p.part; let eyebrow = LABELS.category[p.category as Category]; let name = partName(p.category as Category, p.id);
    if (p.kind === 'radiator') { key = 'radiator'; eyebrow = 'Radiator'; }
    if (p.kind === 'gpu-support') continue;
    if (p.kind === 'fan') {
      const g = getCase(caseId)?.fanMounts.find((m) => m.id === p.meta.mount)?.group as MountGroup | undefined;
      key = `fan:${g ?? ''}`; eyebrow = g ? `${LABELS.mountGroup[g]} fans` : 'Fans';
    }
    if (p.kind === 'storage') key = `storage:${p.id}`;
    const e = out.get(key);
    if (e) e.centers.push(center);
    else out.set(key, { key, eyebrow, name, centers: [center] });
  }
  return [...out.values()].map((g) => (g.centers.length > 1 && (g.key.startsWith('fan:') || g.key.startsWith('storage:')) ? { ...g, name: `${g.centers.length} × ${g.name}` } : g));
}

/**
 * Callouts in two columns, one each side of the rig, as a parts diagram has them. The parts split at the middle by screen
 * position, so each side takes the half nearest it. In a column the labels keep their parts' top to bottom order and are
 * pushed apart only as far as they must be, so no two leader lines cross.
 */
function layout(gs: Group[]): Placed[] {
  const w = getWorld();
  if (!w) return [];
  const area = w.clearArea();
  const rect = w.canvas.getBoundingClientRect();
  const pts = gs.map((g) => {
    const c: V3 = [0, 0, 0];
    for (const x of g.centers) for (let i = 0; i < 3; i++) c[i] = c[i]! + x[i]! / g.centers.length;
    const p = w.project(c);
    return { ...p, x: p.x + rect.left, y: p.y + rect.top };
  });
  const live = gs.map((_, i) => i).filter((i) => pts[i]!.front).sort((a, b) => pts[a]!.x - pts[b]!.x);
  const half = Math.ceil(live.length / 2);
  const sides: Record<'l' | 'r', number[]> = { l: live.slice(0, half), r: live.slice(half) };
  const out: Placed[] = [];
  const top = area.top + LABEL_H / 2 + EDGE; const bottom = area.top + area.height - LABEL_H / 2 - EDGE;
  for (const side of ['l', 'r'] as const) {
    const ids = sides[side].sort((a, b) => pts[a]!.y - pts[b]!.y);
    if (!ids.length) continue;
    const xs = ids.map((i) => pts[i]!.x);
    const col = side === 'l' ? Math.max(area.left + EDGE + 200, Math.min(...xs) - REACH) : Math.min(area.left + area.width - EDGE - 200, Math.max(...xs) + REACH);
    const ys = ids.map((i) => Math.max(top, Math.min(bottom, pts[i]!.y)));
    for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k]!, ys[k - 1]! + LABEL_H + GAP);
    const over = ys[ys.length - 1]! - bottom;
    if (over > 0) for (let k = ys.length - 1; k >= 0; k--) ys[k] = Math.min(ys[k]! - (k === ys.length - 1 ? over : 0), k < ys.length - 1 ? ys[k + 1]! - LABEL_H - GAP : Infinity);
    ids.forEach((i, k) => { const g = gs[i]!; out.push({ key: g.key, eyebrow: g.eyebrow, name: g.name, ax: pts[i]!.x, ay: pts[i]!.y, lx: col, ly: ys[k]!, side }); });
  }
  return out;
}

/** The exploded view's labels: a dot on each part, a thin leader line, and its name. They follow the camera. */
export function ExplodedLabels() {
  const show = useApp((st) => st.mode === 'exploded' && !st.inspect && !st.ui.overlay);
  const build = useApp((st) => st.build);
  const [items, setItems] = useState<Placed[]>([]);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!show) { setItems([]); return; }
    let raf = 0; let last = '';
    const tick = () => {
      const w = getWorld();
      if (w) {
        const e = w.exploder.level.e;
        const next = e > 0.6 ? layout(groups()) : [];
        const sig = JSON.stringify(next.map((n) => [n.key, Math.round(n.ax), Math.round(n.ay), Math.round(n.lx), Math.round(n.ly)]));
        if (sig !== last) { last = sig; setItems(next); }
        setShown(Math.max(0, Math.min(1, (e - 0.6) / 0.4)));
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [show, build]);
  if (!show || !items.length) return null;
  return (
    <div className={s.layer} style={{ opacity: shown }} aria-label="Parts" role="list">
      <svg className={s.lines} aria-hidden="true">
        {items.map((i) => <line key={i.key} x1={i.ax} y1={i.ay} x2={i.lx} y2={i.ly} className={s.line} />)}
      </svg>
      {items.map((i) => (
        <div key={i.key} role="listitem">
          <span className={s.dot} style={{ left: i.ax, top: i.ay }} aria-hidden="true" />
          <span className={[s.label, i.side === 'l' ? s.left : s.right].join(' ')} style={{ left: i.lx, top: i.ly }}>
            <span className={s.eyebrow}>{i.eyebrow}</span>
            <span className={s.name}>{i.name}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
