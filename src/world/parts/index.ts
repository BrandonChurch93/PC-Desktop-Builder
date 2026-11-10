import * as THREE from 'three';
import { getRam, type Category } from '../../data/catalog';
import { DIMS } from '../layout/dims';
import type { Box } from '../layout/math';
import type { PlacedKind } from '../layout/place';
import { boardPart } from './board';
import { casePart } from './case';
import { coolerPart, pumpPart, radiatorPart } from './cooler';
import { cpuPart } from './cpu';
import { fanPart } from './fan';
import { gpuPart, supportPart } from './gpu';
import { psuPart } from './psu';
import { ramPart } from './ram';
import { storagePart } from './storage';
import type { GenOpts, PartObject } from './types';

/** Builds the object for one placed item. */
export function generate(kind: PlacedKind, id: string, opts: GenOpts = {}): PartObject {
  switch (kind) {
    case 'case': return casePart(id, opts);
    case 'board': return boardPart(id, opts);
    case 'cpu': return cpuPart(id, opts);
    case 'cooler': return pumpPart(id, opts);
    case 'radiator': return radiatorPart(id, opts);
    case 'ram': return ramPart(id, opts);
    case 'gpu': return gpuPart(id, opts);
    case 'gpu-support': return supportPart(id, opts);
    case 'storage': return storagePart(id, opts);
    case 'psu': return psuPart(id, opts);
    case 'fan': return fanPart(id, opts);
  }
}

/** Alpha across a contact line: darkest at its middle, gone at both sides. */
const lineTexs = new Map<number, THREE.DataTexture>();
function contactLine(k = 9): THREE.DataTexture {
  const hit = lineTexs.get(k); if (hit) return hit;
  const n = 32; const d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * 2 - 1; const a = Math.round(255 * Math.exp(-x * x * k)); d.set([a, a, a, 255], i * 4); }
  const tex = new THREE.DataTexture(d, n, 1); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  lineTexs.set(k, tex);
  return tex;
}

/** Gap between the sticks of a kit shown together: a little wider than adjacent slots, so each stick's bar and face read. */
const KIT_PITCH = 14;

/** A memory kit as it comes: all its sticks standing side by side, since the stick count is what tells the Facet kits apart. */
function ramKit(id: string, opts: GenOpts): PartObject {
  const n = getRam(id)?.sticks ?? 2;
  const root = new THREE.Group(); root.name = `ram-kit-${id}`;
  const sticks = Array.from({ length: n }, (_, i) => ramPart(id, { ...opts, key: `ram:${id}:${i}` }));
  const boxes: Box[] = [];
  // Each stick stands on its contact edge: a tight occlusion line under it, darkest where the edge meets the surface.
  // A white kit over a lit disc, or a black one over the dark disc, needs a wider, deeper line to read as seated.
  const white = getRam(id)?.finish === 'frost' || getRam(id)?.lit === false;
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x040306, alphaMap: contactLine(getRam(id)?.lit === false ? 4 : 9), transparent: true, opacity: white ? 0.98 : 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  // On the dark disc a black kit needs its occlusion to spread past its edge, where the eye looks for it.
  const dark = getRam(id)?.lit === false;
  const lineGeo = new THREE.PlaneGeometry(dark ? 30 : white ? 13 : 9, DIMS.dimmLength + (dark ? 8 : 2));
  sticks.forEach((s, i) => {
    const dx = (i - (n - 1) / 2) * KIT_PITCH;
    s.root.position.x = dx;
    root.add(s.root);
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(dx, 0, 0.05); line.userData.spill = true; line.renderOrder = 3;
    root.add(line);
    for (const b of s.boxes) boxes.push({ ...b, min: [b.min[0] + dx, b.min[1], b.min[2]], max: [b.max[0] + dx, b.max[1], b.max[2]] });
  });
  return { root, boxes, anchors: {}, zones: sticks.flatMap((s) => s.zones), rotors: [], movers: {}, dispose: () => { for (const s of sticks) s.dispose(); lineGeo.dispose(); lineMat.dispose(); } };
}

/** The whole part as the Inspector shows it: a liquid cooler with its radiator, a memory kit with all its sticks. */
export function inspectPart(category: Category, id: string, opts: GenOpts = {}): PartObject {
  switch (category) {
    case 'cooler': return coolerPart(id, { ...opts, loose: true });
    case 'fan': return fanPart(id, { ...opts, loose: true });
    case 'ram': return ramKit(id, opts);
    case 'storage': return generate('storage', id, { ...opts, loose: true });
    case 'cables': throw new Error('cables have no inspector part');
    default: return generate(category as PlacedKind, id, opts);
  }
}
