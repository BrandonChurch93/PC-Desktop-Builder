import fs from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalog } from '../../src/data/catalog';

// Generators draw their textures on a canvas. Node has none, so a canvas that accepts every call and draws nothing stands in:
// the test is about geometry, materials and that every part has its own generator, not about pixels.
function fakeContext(canvas: { width: number; height: number }): unknown {
  const pixels = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const known: Record<string, unknown> = {
    canvas,
    measureText: (t: string) => ({ width: t.length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => pixels(w, h),
    createImageData: (w: number, h: number) => pixels(w, h),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createPattern: () => ({}),
    getTransform: () => new DOMMatrixStub(),
  };
  return new Proxy(known, { get: (o, k: string) => (k in o ? o[k] : () => undefined), set: (o, k: string, v) => { o[k] = v; return true; } });
}
class DOMMatrixStub { a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; }

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  const makeCanvas = () => { const c: Record<string, unknown> = { width: 300, height: 150, style: {} }; c.getContext = () => fakeContext(c as { width: number; height: number }); c.toDataURL = () => ''; return c; };
  g.document = { createElement: () => makeCanvas(), fonts: { ready: Promise.resolve(), check: () => true, load: async () => [] } };
  g.OffscreenCanvas = class { width: number; height: number; constructor(w: number, h: number) { this.width = w; this.height = h; } getContext() { return fakeContext(this); } };
  g.DOMMatrix = DOMMatrixStub;
});

const CATEGORIES = [['board', 'boards'], ['cpu', 'cpus'], ['cooler', 'coolers'], ['ram', 'ram'], ['gpu', 'gpus'], ['storage', 'storage'], ['psu', 'psus'], ['fan', 'fans']] as const;

describe('part generators', () => {
  for (const [kind, key] of CATEGORIES) {
    for (const part of catalog[key] as { id: string }[]) {
      it(`${kind} ${part.id} has its own generated model`, async () => {
        const { generate } = await import('../../src/world/parts/index');
        const obj = generate(kind, part.id);
        let meshes = 0; let triangles = 0;
        obj.root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          meshes++;
          const g = o.geometry as THREE.BufferGeometry;
          triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        });
        // A part built from its collision boxes alone would be a handful of plain boxes.
        expect(obj.root.name).not.toMatch(/^radiator-/);
        expect(meshes).toBeGreaterThanOrEqual(5);
        expect(triangles).toBeGreaterThan(2000);
        obj.dispose();
      });
      it(`${kind} ${part.id} has a thumbnail`, () => {
        expect(fs.existsSync(`public/thumbs/${kind}-${part.id}.jpg`)).toBe(true);
      });
    }
  }
});
