import * as THREE from 'three';
import { catalog, getPreset, type Category } from '../data/catalog';
import { buildFromPreset, revalidate } from '../engine/rules';
import type { Tier } from '../state/store';
import { liftExposure } from './interact/hands';
import { socketMaterials } from './interact/sockets';
import { MAT_NAMES, mat, sleeve } from './kit/materials';
import { textures } from './kit/textures';
import { loadFonts } from './kit/type';
import { Fader } from './motion/fade';
import { revealMaterial } from './motion/reveal';
import { inspectPart } from './parts';
import { partCache } from './parts/cache';
import type { GenOpts, PartObject } from './parts/types';
import { TIER_SETTINGS } from './post';
import { Rig } from './rig';
import type { World } from './World';

/** Progress in cost weighted units, and one line of what is being prepared. */
export type WarmReport = (done: number, total: number, status: string) => void;

/** One task's turn on the main thread: the browser paints and takes input between slices. */
export function yieldToBrowser(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
}

/** Every part the app can show, as the warm-up generates it: each case in each finish, each fan at both sizes. 55 entries. */
export type WarmPart = { category: Category; id: string; opts: GenOpts; name: string };

const LISTS: [Category, keyof typeof catalog][] = [['case', 'cases'], ['board', 'boards'], ['cpu', 'cpus'], ['cooler', 'coolers'], ['ram', 'ram'], ['gpu', 'gpus'], ['storage', 'storage'], ['psu', 'psus'], ['fan', 'fans']];

export function warmParts(): WarmPart[] {
  const brand = (id: string) => catalog.brands.find((b) => b.id === id)?.name ?? '';
  const out: WarmPart[] = [];
  for (const [category, key] of LISTS) {
    for (const p of catalog[key] as unknown as { id: string; brand: string; name: string; type?: string; finishes?: string[] }[]) {
      const id = category === 'storage' ? p.type! : p.id;
      const name = `${brand(p.brand)} ${p.name}`;
      if (category === 'case') for (const finish of p.finishes ?? []) out.push({ category, id, opts: { finish }, name });
      else out.push({ category, id, opts: {}, name });
    }
  }
  return out;
}

/**
 * Holds one clone of every warmed material on a tiny stand-in of its mesh, with every texture swapped for a 1 × 1 placeholder
 * on the same uv channel. Three.js frees a program when no material uses it; these clones keep each one alive after the warm
 * parts are disposed, at almost no memory.
 */
export class ProgramKeeper {
  readonly scene = new THREE.Scene();
  /** Stand-ins for what draws over the frame, with no lights: compiled for the overlay scene. */
  readonly overlay = new THREE.Scene();
  private seen = new Set<string>();
  private placeholders = new Map<number, THREE.Texture>();

  get size() { return this.scene.children.length; }

  /** Lets every held program go, as a tier change makes them obsolete. */
  dispose() {
    for (const sc of [this.scene, this.overlay]) {
      for (const o of sc.children) {
        const m = o as THREE.Mesh;
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
        m.geometry.dispose();
      }
      sc.clear();
    }
    this.seen.clear();
  }

  private placeholder(channel: number): THREE.Texture {
    let t = this.placeholders.get(channel);
    if (!t) { t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); t.channel = channel; t.needsUpdate = true; this.placeholders.set(channel, t); }
    return t;
  }

  keep(root: THREE.Object3D, into: THREE.Scene = this.scene) {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points)) return;
      const list = (Array.isArray(o.material) ? o.material : [o.material]) as THREE.Material[];
      const attrs = Object.entries(o.geometry.attributes).map(([k, a]) => `${k}${(a as THREE.BufferAttribute).itemSize}`).sort().join(',');
      for (const m of list) {
        const sig = `${m.uuid}|${attrs}|${o.type}|${o.receiveShadow}|${o instanceof THREE.InstancedMesh && !!o.instanceColor}`;
        if (this.seen.has(sig)) continue;
        this.seen.add(sig);
        const c = m.clone();
        c.onBeforeCompile = m.onBeforeCompile;
        c.customProgramCacheKey = m.customProgramCacheKey;
        // Physical materials reset their defines when copied; the program key includes them.
        if (m.defines) c.defines = { ...m.defines };
        const slots = c as unknown as Record<string, unknown>;
        for (const k of Object.keys(slots)) {
          const v = slots[k] as THREE.Texture | undefined;
          if (!v || !(v as THREE.Texture).isTexture || k === 'envMap' || (v as THREE.CubeTexture).isCubeTexture || (v as { isRenderTargetTexture?: boolean }).isRenderTargetTexture) continue;
          slots[k] = this.placeholder(v.channel);
        }
        const g = new THREE.BufferGeometry();
        for (const [k, a] of Object.entries(o.geometry.attributes)) {
          const s = (a as THREE.BufferAttribute).itemSize;
          g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(3 * s), s));
        }
        let stand: THREE.Object3D;
        if (o instanceof THREE.InstancedMesh) {
          const im = new THREE.InstancedMesh(g, c, 1);
          if (o.instanceColor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
          stand = im;
        } else if (o instanceof THREE.LineSegments) stand = new THREE.LineSegments(g, c);
        else if (o instanceof THREE.Points) stand = new THREE.Points(g, c);
        else stand = new THREE.Mesh(g, c);
        stand.receiveShadow = o.receiveShadow; stand.castShadow = o.castShadow;
        stand.frustumCulled = false;
        into.add(stand);
      }
    });
  }
}

/** Compiles a scene's programs for a target's lights, into the composer's HalfFloat target as the frame uses. */
async function compileFor(world: World, scene: THREE.Object3D, camera: THREE.Camera, target: THREE.Scene) {
  const r = world.renderer;
  const prev = r.getRenderTarget();
  r.setRenderTarget(world.post.composer.readBuffer);
  const done = r.compileAsync(scene, camera, target);
  r.setRenderTarget(prev);
  await done;
}

export type WarmTimings = { label: string; ms: number }[];

/** Cost weights: a generator or a compile batch costs far more than a texture upload. */
const W = { font: 2, tex: 0.2, mat: 0.05, part: 3, preset: 4, compile: 3, variant: 2 };

/** The warm-up's whole cost in its units, known before it starts, so progress is counted from the first frame. */
export function warmBudget(): number {
  return W.font + MAT_NAMES.length * W.mat + warmParts().length * (W.part + W.compile) + catalog.presets.length * (W.preset + W.compile + W.variant) + 4 * W.variant + 40 * W.tex;
}

/**
 * Prepares everything the app can show at this tier, once, in slices: fonts, textures, every shared material, every part and
 * finish, every shader program for the room and the Inspector, and the variants motion and hands use. Touches no shared state.
 */
export async function warmUp(world: World, tier: Tier, report: WarmReport, signal: AbortSignal, keeper = new ProgramKeeper(), timings: WarmTimings = []): Promise<ProgramKeeper> {
  const detail = TIER_SETTINGS[tier].detail;
  const parts = warmParts();
  const presets = catalog.presets.map((p) => p.id);
  // Cost weights: a generator or a compile batch costs far more than a texture upload.
  const all = new Set<THREE.Texture>();
  let done = 0;
  let total = warmBudget();
  report(0, total, 'Loading the type');
  const step = async (units: number, status: string) => {
    done += units;
    report(Math.min(done, total), total, status);
    await yieldToBrowser();
    if (signal.aborted) throw new DOMException('warm-up stopped', 'AbortError');
  };
  const timed = async (label: string, fn: () => Promise<void>) => { const t0 = performance.now(); await fn(); timings.push({ label, ms: Math.round(performance.now() - t0) }); };
  const r = world.renderer;
  const collect = (root: THREE.Object3D) => root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const x of Array.isArray(m) ? m : [m]) for (const v of Object.values(x)) if (v && (v as THREE.Texture).isTexture && !(v as THREE.CubeTexture).isCubeTexture) all.add(v as THREE.Texture);
  });
  const upload = async (root: THREE.Object3D, status: string) => {
    const before = new Set(all); collect(root);
    for (const t of all) if (!before.has(t)) { const t0 = performance.now(); r.initTexture(t); const ms = performance.now() - t0; if (ms > 8) timings.push({ label: `initTexture ${(t.image as { width?: number } | null)?.width ?? '?'} × ${(t.image as { height?: number } | null)?.height ?? '?'}`, ms: Math.round(ms) }); await yieldToBrowser(); }
    void status;
  };

  // 1. Fonts.
  await loadFonts();
  await step(W.font, 'Loading the type');

  // 2. Shared textures and every shared material, the six sleeve colorways.
  textures();
  for (const [i, name] of MAT_NAMES.entries()) {
    const m = mat(name);
    for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) all.add(v as THREE.Texture);
    if (i % 12 === 11) await step(12 * W.mat, 'Preparing materials');
  }
  for (const c of catalog.cables) for (const col of c.colors) sleeve(col);
  // Shared textures belong to no one part: the part cache leaves them out of its byte count.
  partCache.shared = new Set(all);
  await step((MAT_NAMES.length % 12) * W.mat, 'Preparing materials');

  // 3. Shared textures to the GPU, one per slice.
  let n = 0;
  for (const t of all) { r.initTexture(t); if (++n <= 40) await step(W.tex, 'Uploading textures'); else await yieldToBrowser(); }
  if (n < 40) await step((40 - n) * W.tex, 'Uploading textures');

  const warmScene = new THREE.Scene();
  const place = new THREE.Group(); place.scale.setScalar(0.001); place.position.set(0, -50, 0);
  warmScene.add(place);
  const lift = new THREE.Group(); place.add(lift);

  // 4 to 7. Every part, one generator per slice; each batch compiled for the room and the Inspector, kept, then disposed.
  for (const p of parts) {
    const made: PartObject[] = [];
    const sizes: (GenOpts['size'])[] = p.category === 'fan' ? [120, 140] : [undefined];
    for (const size of sizes) {
      const opts: GenOpts = { ...p.opts, detail, ...(size ? { size } : {}) };
      try { made.push(inspectPart(p.category, p.id, opts)); } catch (e) { console.error(e); }
    }
    for (const m of made) place.add(m.root);
    await step(W.part, `Preparing the ${p.name}`);
    for (const m of made) await upload(m.root, p.name);
    await timed(`compile ${p.category} ${p.id}`, async () => {
      await compileFor(world, warmScene, world.camera, world.scene);
      await compileFor(world, warmScene, world.inspector.camera, world.inspector.scene);
    });
    for (const m of made) keeper.keep(m.root);
    for (const m of made) { m.root.removeFromParent(); m.dispose(); }
    await step(W.compile, `Compiling the ${p.name}`);
  }

  // The presets as the room places them: placed variants, radiators and fans in their mounts, cables in every colorway.
  for (const id of presets) {
    const spec = getPreset(id);
    if (!spec) continue;
    const rig = new Rig();
    rig.detail = detail;
    rig.useCache = false;
    try { rig.sync(revalidate(buildFromPreset(spec)).build); } catch (e) { console.error(e); }
    lift.add(rig.group);
    await step(W.preset, `Preparing ${spec.name}`);
    await upload(rig.group, spec.name);
    await timed(`compile preset ${id}`, () => compileFor(world, warmScene, world.camera, world.scene));
    keeper.keep(rig.group);
    await step(W.compile, `Compiling ${spec.name}`);
    // The variants motion and hands make: a fading part, a held part, a growing cable.
    const faders = [...rig.items.values()].map((i) => { const f = new Fader(i.holder); f.set(0.5); return f; });
    await timed(`compile faded ${id}`, () => compileFor(world, warmScene, world.camera, world.scene));
    keeper.keep(rig.group);
    for (const f of faders) f.dispose();
    const lifted = liftExposure(rig.group);
    await timed(`compile held ${id}`, () => compileFor(world, warmScene, world.camera, world.scene));
    keeper.keep(rig.group);
    for (const l of lifted) { const m = l.mesh.material; l.mesh.material = l.original; (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); }
    const reveals: { mesh: THREE.Mesh; original: THREE.Material }[] = [];
    rig.cables?.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || typeof o.userData.length !== 'number') return;
      const original = o.material as THREE.Material;
      o.material = revealMaterial(original, o.userData.length as number, Boolean(o.userData.fromEnd)).material;
      reveals.push({ mesh: o, original });
    });
    if (reveals.length) {
      await compileFor(world, warmScene, world.camera, world.scene);
      keeper.keep(rig.group);
      for (const x of reveals) { (x.mesh.material as THREE.Material).dispose(); x.mesh.material = x.original; }
    }
    rig.clearAll();
    rig.group.removeFromParent();
    await step(W.variant, `Preparing ${spec.name}`);
  }

  // The keeper's stand-ins compile to the same programs, so they hold them for the session.
  await timed('compile keeper', async () => {
    await compileFor(world, keeper.scene, world.camera, world.scene);
    await compileFor(world, keeper.scene, world.inspector.camera, world.inspector.scene);
  });
  await step(W.variant, 'Compiling materials');

  // Real frames under the preloader, for what only a render compiles: the outline passes on a plain and an instanced
  // mesh, the socket outlines over the frame with the copy pass, the air streams, occlusion near and far, and the
  // Inspector's own frame. The world draws its own frame again as soon as these end.
  const box = new THREE.BoxGeometry(1, 1, 1);
  const probe = new THREE.Group(); probe.scale.setScalar(0.001);
  const plain = new THREE.Mesh(box, mat('plasticMatte'));
  const inst = new THREE.InstancedMesh(box, mat('plasticMatte'), 1);
  const air = new THREE.Mesh(box, world.airflow.material);
  probe.add(plain, inst, air);
  const sock = socketMaterials(0x808080, { value: 0 });
  const sockets = new THREE.Group();
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), sock.line); edges.computeLineDistances();
  sockets.add(edges, new THREE.Mesh(box, sock.fill));
  sockets.scale.setScalar(0.001);
  const post = world.post;
  // The stand-ins ride along: the occlusion pass draws every one with its normal shader, in each variant.
  world.scene.add(probe, keeper.scene);
  world.overlayScene.add(sockets);
  const was = { hover: post.hover.enabled, select: post.select.enabled, exempt: post.aoExempt };
  // The occlusion pass draws LEDs apart with its own material: the stand-ins pass for them, in every variant.
  post.aoExempt = () => [...keeper.scene.children];
  try {
    post.hover.selectedObjects = [plain, inst];
    post.select.selectedObjects = [plain, inst];
    post.hover.enabled = true; post.select.enabled = true;
    post.setOverlay(true);
    for (const close of [true, false]) {
      post.setScene(world.scene, world.camera, close);
      post.composer.render();
      await yieldToBrowser();
    }
    post.hover.selectedObjects = []; post.select.selectedObjects = [];
    post.hover.enabled = false; post.select.enabled = false;
    post.setOverlay(false);
    world.inspector.frame(world.renderer.domElement.width / Math.max(1, world.renderer.domElement.height));
    world.inspector.scene.add(keeper.scene);
    const restoreGlow = world.inspector.showAllForWarm();
    post.setScene(world.inspector.scene, world.inspector.camera, true);
    post.composer.render();
    restoreGlow();
    keeper.scene.removeFromParent();
  } finally {
    post.hover.selectedObjects = []; post.select.selectedObjects = [];
    post.hover.enabled = was.hover; post.select.enabled = was.select;
    post.aoExempt = was.exempt;
    post.setOverlay(false);
    post.setScene(world.scene, world.camera, false);
    probe.removeFromParent();
    keeper.scene.removeFromParent();
    sockets.removeFromParent();
    world.markDirty();
  }
  keeper.keep(sockets, keeper.overlay);
  await compileFor(world, keeper.overlay, world.camera, world.overlayScene);
  sock.line.dispose(); sock.fill.dispose(); edges.geometry.dispose(); box.dispose();
  await step(W.variant, 'Compiling materials');
  total = done;
  report(done, total, 'Ready');
  return keeper;
}
