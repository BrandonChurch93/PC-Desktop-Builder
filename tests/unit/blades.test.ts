import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bladeGeometry } from '../../src/world/kit/blades';

// A triangle wound against its vertex normals is drawn as a back face: a double sided material flips its normal and shades
// it dark, which drew a dashed black line along every blade outline.
function backwards(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position'); const n = g.getAttribute('normal'); const idx = g.getIndex()!;
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3(); const t = new THREE.Vector3();
  let bad = 0;
  for (let i = 0; i < idx.count; i += 3) {
    const ia = idx.getX(i); const ib = idx.getX(i + 1); const ic = idx.getX(i + 2);
    a.fromBufferAttribute(p, ia); b.fromBufferAttribute(p, ib); c.fromBufferAttribute(p, ic);
    const face = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (face.lengthSq() < 1e-14) continue;
    const avg = new THREE.Vector3().add(t.fromBufferAttribute(n, ia)).add(t.fromBufferAttribute(n, ib)).add(t.fromBufferAttribute(n, ic));
    if (face.dot(avg) < 0) bad++;
  }
  return bad;
}

describe('fan blades', () => {
  it('wind every triangle the way its normals face', () => {
    const swept = bladeGeometry({ r0: 18, r1: 56, c0: 15, c1: 40, pitch0: 0.86, pitch1: 0.42, sweep: 0.56, thick: 1.7, z: -0.8, nu: 26, nv: 16 });
    const paddle = bladeGeometry({ r0: 18, r1: 56, c0: 13, c1: 44, pitch0: 0.86, pitch1: 0.36, sweep: 0.4, thick: 1.7, z: -0.8, nu: 36, nv: 22 });
    expect(backwards(swept)).toBe(0);
    expect(backwards(paddle)).toBe(0);
  });
});
