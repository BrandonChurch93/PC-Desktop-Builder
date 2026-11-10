import { it } from 'vitest';
import { presetBuild, revalidate } from '../../src/engine/rules';
import { place } from '../../src/world/layout/place';
import { intersections } from './layout-helpers';

// Temporary: prints overlapping boxes of one preset while a case layout is being designed.
it('diag', () => {
  const b = revalidate(presetBuild('pocket')!).build;
  const placed = place(b);
  for (const h of intersections(placed)) {
    const A = placed.find((p) => p.key === h.a)!; const B = placed.find((p) => p.key === h.b)!;
    console.log(JSON.stringify(h), JSON.stringify(A.boxes.find((x) => x.tag === h.tagA)), JSON.stringify(B.boxes.find((x) => x.tag === h.tagB)));
  }
});
