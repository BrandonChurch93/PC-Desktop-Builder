import { getCooler } from '../data/catalog';
import type { Socket } from '../engine/queries';
import { install } from '../engine/rules';
import type { Build } from '../engine/types';
import { CASE_LAYOUTS } from '../world/layout/cases';
import type { V3 } from '../world/layout/math';
import { place, radiatorPose } from '../world/layout/place';
import { forcePlace } from '../world/layout/force';

const center = (boxes: { min: V3; max: V3 }[]): V3 | null => {
  if (!boxes.length) return null;
  const lo: V3 = [Infinity, Infinity, Infinity]; const hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i]!, b.min[i]!); hi[i] = Math.max(hi[i]!, b.max[i]!); }
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
};

/** Where a socket is in case space, in mm: a fan mount's center, a radiator mount's face, or where the part would sit. */
export function socketPoint(b: Build, s: Socket): V3 {
  const L = b.case ? CASE_LAYOUTS[b.case.id] : undefined;
  if (!L) return [0, 220, 0];
  if (s.category === 'fan' && s.opts.mount) return L.fanMounts.find((m) => m.id === s.opts.mount)?.center ?? [0, 220, 0];
  if (s.category === 'cooler' && s.opts.mount) {
    const k = getCooler(s.id);
    const rp = k?.radSize ? radiatorPose(L, s.opts.mount, k.radSize) : null;
    if (rp) return rp.pose.pos;
  }
  const r = install(b, s.category, s.id, s.opts);
  if (r.ok) {
    const p = place(r.build).filter((x) => x.category === s.category && (s.category !== 'storage' || x.id === s.id));
    const c = center(p[p.length - 1]?.boxes ?? []);
    if (c) return c;
  }
  // A blocked place: where the part would sit, placed without the rules.
  const forced = center(forcePlace(b, s.category, s.id, s.opts).flatMap((p) => p.boxes));
  if (forced) return forced;
  const inner = L.interior;
  return [(inner.min[0] + inner.max[0]) / 2, (inner.min[1] + inner.max[1]) / 2, (inner.min[2] + inner.max[2]) / 2];
}
