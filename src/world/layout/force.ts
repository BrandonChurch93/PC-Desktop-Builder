import { getCase, type Category, type StorageType } from '../../data/catalog';
import type { ActionOpts, Build } from '../../engine/types';
import { place, type Placed } from './place';

/**
 * Where a part would sit if it were put in, ignoring the rules: the build with the part set directly, placed, and only the new
 * part's objects kept. A blocked socket is drawn where the part would go, which install() cannot say because it refuses.
 */
export function forcePlace(build: Build, category: Category, id: string, opts: ActionOpts = {}): Placed[] {
  const b: Build = structuredClone(build);
  let want: (p: Placed) => boolean;
  switch (category) {
    case 'case': {
      const k = getCase(id);
      b.case = { id, finish: k?.finishes[0] ?? 'onyx' };
      want = (p) => p.kind === 'case';
      break;
    }
    case 'board': b.board = id; want = (p) => p.kind === 'board'; break;
    case 'cpu': b.cpu = id; want = (p) => p.kind === 'cpu'; break;
    case 'gpu': b.gpu = id; want = (p) => p.part === 'gpu'; break;
    case 'psu': b.psu = id; want = (p) => p.kind === 'psu'; break;
    case 'cooler': b.cooler = { id, mount: opts.mount ?? null }; want = (p) => p.part === 'cooler'; break;
    case 'ram': {
      const k = b.ram.length;
      b.ram = [...b.ram, id];
      want = (p) => p.part === `ram:${k}`;
      break;
    }
    case 'storage': {
      const t = (opts.type ?? id) as StorageType;
      const i = b.storage[t];
      b.storage = { ...b.storage, [t]: i + 1 };
      want = (p) => p.key === `storage:${t}:${i}`;
      break;
    }
    case 'fan': {
      if (!opts.mount) return [];
      b.fans = { ...b.fans, [opts.mount]: id };
      if (b.cooler) b.cooler = null;
      want = (p) => p.key === `fan:${opts.mount}`;
      break;
    }
    default: return [];
  }
  return place(b).filter(want);
}
