import * as THREE from 'three';
import type { CaseLayout } from '../layout/types';
import type { RigItem } from '../rig';
import type { Zone } from './zones';

/** A soft decal of one zone's light on a surface its area lamp only grazes, colored each frame from the zone. */
export type Patch = { mesh: THREE.Mesh; zone: Zone; gain: number };

let alpha: THREE.DataTexture | null = null;
/** Strongest along v = 0 (the light's side), falling off across the patch, soft at both ends of u. */
function patchAlpha(): THREE.DataTexture {
  if (alpha) return alpha;
  const W = 64; const H = 64; const d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W; const v = (y + 0.5) / H;
    const side = THREE.MathUtils.smoothstep(Math.min(u, 1 - u), 0, 0.3);
    const k = Math.round(255 * side * THREE.MathUtils.smoothstep(v, 0, 0.12) * Math.exp(-3.4 * v) * (1 - v));
    const i = (y * W + x) * 4; d[i] = k; d[i + 1] = k; d[i + 2] = k; d[i + 3] = 255;
  }
  alpha = new THREE.DataTexture(d, W, H); alpha.magFilter = THREE.LinearFilter; alpha.minFilter = THREE.LinearFilter; alpha.needsUpdate = true;
  return alpha;
}

/** A plane spanning u from a to b and v from the lit edge c outward to d, with the given normal; corners in case mm. */
function patch(origin: THREE.Vector3, uDir: THREE.Vector3, uLen: number, vDir: THREE.Vector3, vLen: number): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  const p = [origin, origin.clone().addScaledVector(uDir, uLen), origin.clone().addScaledVector(uDir, uLen).addScaledVector(vDir, vLen), origin.clone().addScaledVector(vDir, vLen)];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((q) => [q.x, q.y, q.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: patchAlpha(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 3; mesh.userData.spill = true; mesh.name = 'interior-patch';
  return mesh;
}

/**
 * Light the area lamps reach only at grazing angles: the tray beside each front fan (a fan's lamp faces into the case, along
 * the tray) and the shroud top under the card's glass facing bar (the bar faces the glass, not down). Built in case space, mm.
 */
/**
 * A fan's light on the top of a braided tube running under it: a shell just over the tube, strongest where the tube faces the
 * fan and close under it, fading at the ends of the fan's span. It takes the braid's own tone, so the weave still reads.
 */
function tubeGlow(tube: THREE.Mesh, fan: THREE.Vector3, w: number): THREE.Mesh | null {
  const src = tube.geometry; const p = src.getAttribute('position'); const n = src.getAttribute('normal');
  const pos = new Float32Array(p.count * 3); const col = new Float32Array(p.count * 3);
  let any = false;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i); const zz = p.getZ(i); const ny = n.getY(i);
    pos[i * 3] = x + n.getX(i) * 0.12; pos[i * 3 + 1] = y + ny * 0.12; pos[i * 3 + 2] = zz + n.getZ(i) * 0.12;
    const span = THREE.MathUtils.smoothstep(w / 2 - Math.abs(x - fan.x), 0, 14);
    const below = fan.y - y;
    const k = below > 0 ? span * Math.max(0, ny) * Math.exp(-below / 60) : 0;
    col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k;
    if (k > 0.02) any = true;
  }
  if (!any) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', src.getAttribute('uv'));
  if (src.index) g.setIndex(src.index);
  const map = (tube.material as THREE.MeshPhysicalMaterial).map;
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 3; mesh.userData.spill = true; mesh.name = 'tube-glow';
  return mesh;
}

export function interiorPatches(L: CaseLayout, items: Map<string, RigItem>, tubes: THREE.Mesh[] = []): { group: THREE.Group; patches: Patch[] } {
  const group = new THREE.Group(); group.name = 'interior-patches';
  const patches: Patch[] = [];
  const trayZ = L.interior.min[2] + 0.25;
  for (const item of items.values()) {
    if (item.placed.kind !== 'fan' || !item.part.zones.length) continue;
    const mount = L.fanMounts.find((f) => f.id === String(item.placed.meta.mount));
    if (!mount || mount.group !== 'front') continue;
    const half = mount.size / 2; const back = mount.center[0] - 13;
    const mesh = patch(new THREE.Vector3(back, mount.center[1] - half + 4, trayZ), new THREE.Vector3(0, 1, 0), mount.size - 8, new THREE.Vector3(-1, 0, 0), 45);
    group.add(mesh);
    // Short and moderate: a long bright patch read as a haze cloud in the chamber in the side view.
    patches.push({ mesh, zone: item.part.zones[0]!, gain: 0.7 });
  }
  // Fans under a top radiator face down, so their lamp only grazes the tray and the board's top edge just below them, where
  // the tubes run: each fan's light lands on the tray and on the board face under it.
  const boardFace = L.boardAnchor[2] + 1.6 + 0.25;
  const board = { x0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const bx of items.get('board')?.placed.boxes ?? []) { board.x0 = Math.min(board.x0, bx.min[0]); board.x1 = Math.max(board.x1, bx.max[0]); board.y1 = Math.max(board.y1, bx.max[1]); }
  for (const item of items.values()) {
    if (item.placed.kind !== 'radiator' || !item.part.zones.length || !item.holder.parent) continue;
    const inv = item.holder.parent.matrixWorld.clone().invert();
    for (const z of item.part.zones) {
      if (!z.owner) continue;
      const m = inv.clone().multiply(z.owner.matrixWorld);
      const lit = z.emitters.map((e) => ({ c: e.center.clone().applyMatrix4(m), n: e.normal.clone().transformDirection(m), w: e.w })).find((e) => e.n.y < -0.9);
      if (!lit) continue;
      for (const t of tubes) {
        const mesh = tubeGlow(t, lit.c, lit.w);
        if (!mesh) continue;
        group.add(mesh);
        patches.push({ mesh, zone: z, gain: 2.6 });
      }
      const a = lit.c.x - lit.w / 2 + 4; const b = lit.c.x + lit.w / 2 - 4;
      const tray = patch(new THREE.Vector3(a, lit.c.y, trayZ), new THREE.Vector3(1, 0, 0), b - a, new THREE.Vector3(0, -1, 0), 110);
      group.add(tray);
      patches.push({ mesh: tray, zone: z, gain: 1.35 });
      // On the board only where it lies under the fan, from its top edge down.
      const ba = Math.max(a, board.x0); const bb = Math.min(b, board.x1);
      if (bb - ba > 20) {
        const top = Math.min(lit.c.y, board.y1);
        const mesh = patch(new THREE.Vector3(ba, top, boardFace), new THREE.Vector3(1, 0, 0), bb - ba, new THREE.Vector3(0, -1, 0), 110 - (lit.c.y - top));
        group.add(mesh);
        patches.push({ mesh, zone: z, gain: 1.05 });
      }
    }
  }
  // A memory bar faces the glass, so its lamp misses the board beside the slots; its light lands there softly.
  for (const item of items.values()) {
    if (item.placed.kind !== 'ram' || !item.part.zones.length || !item.placed.boxes.length) continue;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity; let z0 = Infinity;
    for (const b of item.placed.boxes) { x0 = Math.min(x0, b.min[0]); x1 = Math.max(x1, b.max[0]); y0 = Math.min(y0, b.min[1]); y1 = Math.max(y1, b.max[1]); z0 = Math.min(z0, b.min[2]); }
    for (const s of [-1, 1]) {
      const mesh = patch(new THREE.Vector3(s > 0 ? x1 : x0, y0 + 4, z0 - 1.6), new THREE.Vector3(0, 1, 0), y1 - y0 - 8, new THREE.Vector3(s, 0, 0), 44);
      group.add(mesh);
      patches.push({ mesh, zone: item.part.zones[0]!, gain: 0.95 });
    }
  }
  const gpu = items.get('gpu');
  const bar = gpu?.part.zones.find((z) => z.key.endsWith(':bar'));
  if (gpu && bar && gpu.placed.boxes.length) {
    let x0 = Infinity; let x1 = -Infinity; let z1 = -Infinity;
    for (const b of gpu.placed.boxes) { x0 = Math.min(x0, b.min[0]); x1 = Math.max(x1, b.max[0]); z1 = Math.max(z1, b.max[2]); }
    const y = L.supportFloorY + 0.25;
    const edge = Math.min(z1 + 10, L.sideInner - 1); const depth = 55;
    // Only over solid shroud top: a patch over the drive window or a cable cutout lit what lies below the opening.
    const holes: [number, number][] = [];
    const w = L.shroudWindow;
    if (w && w.z + w.d / 2 > edge - depth && w.z - w.d / 2 < edge) holes.push([w.x - w.w / 2 - 6, w.x + w.w / 2 + 6]);
    for (const gr of L.grommets) if (gr.normal[1] === 1 && gr.center[2] + gr.size[1] / 2 > edge - depth && gr.center[2] - gr.size[1] / 2 < edge) holes.push([gr.center[0] - gr.size[0] / 2 - 8, gr.center[0] + gr.size[0] / 2 + 8]);
    let spans: [number, number][] = [[x0 + 20, x1 - 10]];
    for (const [h0, h1] of holes) spans = spans.flatMap(([a, b]) => [[a, Math.min(b, h0)], [Math.max(a, h1), b]] as [number, number][]).filter(([a, b]) => b - a > 30);
    for (const [a, b] of spans) {
      const mesh = patch(new THREE.Vector3(a, y, edge), new THREE.Vector3(1, 0, 0), b - a, new THREE.Vector3(0, 0, -1), depth);
      group.add(mesh);
      patches.push({ mesh, zone: bar, gain: 0.9 });
    }
  }
  return { group, patches };
}
