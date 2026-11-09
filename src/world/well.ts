import * as THREE from 'three';
import type { CaseLayout } from './layout/types';
import type { RigItem } from './rig';

/** Share of light that reaches a drive under the shroud other than through the top window: the side window and bounce. */
const WELL_FLOOR = 0.18;
const RES = 128;

/**
 * Form factor from an upward facing point to the rectangle [0, a] x [0, b] lying parallel at height h, with one corner above
 * the point. Odd in a and in b, so any rectangle is a signed sum of four of these.
 */
function corner(a: number, b: number, h: number): number {
  const ra = Math.hypot(a, h); const rb = Math.hypot(b, h);
  return (a / ra * Math.atan(b / ra) + b / rb * Math.atan(a / rb)) / (2 * Math.PI);
}

/**
 * A drive under a window in the shroud top sits at the bottom of a well: light reaches its lid only through the window, so the
 * lid darkens toward the rim and under the shroud. Area lights cast no shadows, so this is drawn as a shade on the lid, from
 * the form factor of the window seen from each point of the lid. Built in case space, mm.
 */
export function wellShades(L: CaseLayout, items: Map<string, RigItem>): THREE.Group | null {
  const win = L.shroudWindow;
  if (!win) return null;
  const group = new THREE.Group();
  group.name = 'well-shades';
  for (const item of items.values()) {
    if (item.placed.kind !== 'storage' || !item.placed.boxes.length) continue;
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    for (const b of item.placed.boxes) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, b.min[k]!); max[k] = Math.max(max[k]!, b.max[k]!); }
    const top = max[1]!; const h = win.y - top;
    if (h <= 0) continue;
    const wx0 = win.x - win.w / 2; const wx1 = win.x + win.w / 2; const wz0 = win.z - win.d / 2; const wz1 = win.z + win.d / 2;
    if (max[0]! < wx0 || min[0]! > wx1 || max[2]! < wz0 || min[2]! > wz1) continue;
    const sx = max[0]! - min[0]!; const sz = max[2]! - min[2]!;
    const f = new Float32Array(RES * RES);
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
      // Texture rows run along v, which points toward -z once the plane lies flat.
      const x = min[0]! + ((i + 0.5) / RES) * sx; const z = max[2]! - ((j + 0.5) / RES) * sz;
      const v = corner(wx1 - x, wz1 - z, h) - corner(wx0 - x, wz1 - z, h) - corner(wx1 - x, wz0 - z, h) + corner(wx0 - x, wz0 - z, h);
      f[j * RES + i] = v;
    }
    const data = new Uint8Array(RES * RES * 4);
    for (let k = 0; k < f.length; k++) {
      // The form factor is the share of an open sky the point still sees, about 0.76 under the window's center. Raised to 1.5
      // because the near white label sits high on the tone curve, which flattens the falloff.
      const shade = WELL_FLOOR + (1 - WELL_FLOOR) * Math.min(1, f[k]!) ** 1.5;
      const a = Math.round((1 - shade) * 255);
      data[k * 4] = a; data[k * 4 + 1] = a; data[k * 4 + 2] = a; data[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, RES, RES);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((min[0]! + max[0]!) / 2, top + 0.2, (min[2]! + max[2]!) / 2);
    mesh.renderOrder = 3;
    mesh.name = `well-shade:${item.key}`;
    mesh.userData.spill = true;
    group.add(mesh);
  }
  return group.children.length ? group : null;
}
