import * as THREE from 'three';
import type { Category } from '../../data/catalog';
import type { ActionOpts } from '../../engine/types';
import type { Placed } from '../layout/place';
import type { Rig, RigItem } from '../rig';

/** The installed part an item belongs to, as the interface names it: its category and the options that pick it out. */
export function partOf(p: Placed): { category: Category; opts: ActionOpts } {
  switch (p.kind) {
    case 'ram': return { category: 'ram', opts: { index: Number(p.meta.kit ?? 0) } };
    case 'storage': return { category: 'storage', opts: { type: p.id as ActionOpts['type'] } };
    case 'fan': return { category: 'fan', opts: { mount: String(p.meta.mount) } };
    case 'radiator': return { category: 'cooler', opts: {} };
    case 'gpu-support': return { category: 'gpu', opts: {} };
    default: return { category: p.category, opts: {} };
  }
}

/** Every item of the same installed part: a memory kit's sticks, a liquid cooler's pump and radiator, a card and its support. */
export function itemsOfPart(rig: Rig, part: string): RigItem[] {
  return [...rig.items.values()].filter((i) => i.placed.part === part);
}

/**
 * The installed part under a ray. The ray is tested in case space against each part's collision boxes, which are the simple
 * proxies. Parts inside the case win over the case itself, whose glass and panels lie in front of everything.
 */
export function pick(rig: Rig, ray: THREE.Ray): RigItem | null {
  const inv = new THREE.Matrix4().copy(rig.group.matrixWorld).invert();
  const r = ray.clone().applyMatrix4(inv);
  const box = new THREE.Box3(); const hit = new THREE.Vector3();
  let best: { item: RigItem; d: number } | null = null;
  let caseHit: { item: RigItem; d: number } | null = null;
  for (const item of rig.items.values()) {
    if (!item.holder.visible) continue;
    for (const b of item.placed.boxes) {
      box.min.set(...b.min); box.max.set(...b.max);
      if (!r.intersectBox(box, hit)) continue;
      const d = hit.distanceTo(r.origin);
      if (item.placed.kind === 'case') { if (!caseHit || d < caseHit.d) caseHit = { item, d }; }
      else if (!best || d < best.d) best = { item, d };
    }
  }
  return best?.item ?? caseHit?.item ?? null;
}
