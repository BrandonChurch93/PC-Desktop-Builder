import * as THREE from 'three';
import type { Box } from '../layout/math';
import { PartBuilder } from '../kit/geometry';
import type { PartObject } from './types';

/** Draws a part's collision boxes. Only used while a generator is being written. */
export function boxesPart(name: string, boxes: Box[]): PartObject {
  const pb = new PartBuilder(name);
  for (const b of boxes) {
    const s = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] as const;
    const g = new THREE.BoxGeometry(Math.max(0.1, s[0]), Math.max(0.1, s[1]), Math.max(0.1, s[2]));
    g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    pb.add(g, 'plasticGrey');
  }
  const done = pb.finish();
  return { root: done.root, boxes, anchors: {}, zones: [], rotors: [], movers: {}, dispose: done.dispose };
}
