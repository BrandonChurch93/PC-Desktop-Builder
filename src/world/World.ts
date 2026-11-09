import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { gsap } from 'gsap';
import type { Category } from '../data/catalog';
import { getCase } from '../data/catalog';
import { temps } from '../engine/sheet';
import type { Build } from '../engine/types';
import type { State, Store, Tier } from '../state/store';
import { studioEnvironment } from './env';
import { forEachVertex } from './kit/geometry';
import { setPerfAspect } from './kit/materials';
import { setMaxAnisotropy, textures } from './kit/textures';
import { loadFonts } from './kit/type';
import { CASE_LAYOUTS } from './layout/cases';
import { Inspector } from './inspector';
import { RgbEngine } from './light/rgb';
import { inspectPart } from './parts';
import type { GenOpts } from './parts/types';
import { Post, TIER_SETTINGS } from './post';
import { Rig } from './rig';
import { Room } from './room';

const FOV = 30;
const EXPOSURE = 1.15;
const MM = 0.001;
const SPIN_IDLE = 9;
const SPIN_FULL = 42;
const BLUR_FROM = 20;
const BLUR_TO = 34;

export type View = { pos: THREE.Vector3; target: THREE.Vector3 };
export type Insets = { left: number; right: number; top: number; bottom: number };

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 40);
  readonly controls: OrbitControls;
  readonly rig = new Rig();
  readonly rgb: RgbEngine;
  readonly inspector: Inspector;
  room!: Room;
  post!: Post;
  tier: Tier = 'high';
  private time = 0;
  private spinAngle = 0;
  readonly level = { power: 0, spin: 0, exposure: 1 };
  private dirty = true;
  private raf = 0;
  private last = 0;
  private framesDrawn = 0;
  private frameTimes: number[] = [];
  private firstFrameMs = 0;
  private insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private width = 1;
  private height = 1;
  views: Record<string, View> = {};
  viewName: string | null = 'hero';
  private unsub: () => void = () => {};
  private readyResolve!: () => void;
  readonly ready: Promise<void> = new Promise((r) => { this.readyResolve = r; });
  private showingInspector = false;

  constructor(private canvasEl: HTMLCanvasElement, private store: Store) {
    this.renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EXPOSURE;
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    RectAreaLightUniformsLib.init();
    this.controls = new OrbitControls(this.camera, canvasEl);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 3.2;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.addEventListener('change', () => { this.dirty = true; this.viewName = null; });
    this.rgb = new RgbEngine(this.scene);
    const roomEnv = studioEnvironment(this.renderer, 'room');
    this.scene.environment = roomEnv;
    this.scene.environmentIntensity = 0.5;
    this.inspector = new Inspector(studioEnvironment(this.renderer, 'inspector'));
    this.scene.add(this.rig.group);
  }

  async init(tier: Tier) {
    await loadFonts();
    textures(TIER_SETTINGS[tier].texScale);
    setPerfAspect();
    this.applyTier(tier);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.canvasEl.parentElement ?? this.canvasEl);
    this.rig.onChange = () => this.onRigChange();
    this.syncFromStore(this.store.getState(), null);
    this.unsub = this.store.subscribe((s, prev) => this.syncFromStore(s, prev));
    this.loop(performance.now());
    await this.renderNow(2);
    this.firstFrameMs = performance.now();
    this.readyResolve();
  }

  applyTier(tier: Tier) {
    this.tier = tier;
    const s = TIER_SETTINGS[tier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.pixelRatio));
    if (this.room) { this.room.group.removeFromParent(); }
    this.room = new Room(this.scene, s.mirror);
    this.room.hideInMirror = () => this.rig.glassSpecular();
    this.room.lights.shadow.shadow.mapSize.set(s.shadow, s.shadow);
    this.post?.dispose();
    this.post = new Post(this.renderer, this.scene, this.camera, tier);
    this.post.hideForAO = () => [...this.rig.glassObjects(), ...(this.room.mirror ? [this.room.mirror] : [])];
    this.rgb.lampCount = s.lamps;
    this.rig.detail = s.detail;
    this.resize();
    this.dirty = true;
  }

  get firstFrame() { return this.firstFrameMs; }

  private syncFromStore(s: State, prev: State | null) {
    if (!prev || s.build !== prev.build) this.setBuild(s.build);
    if (!prev || s.mode !== prev.mode) this.room.setLevel(s.mode === 'showcase' ? 0.42 : s.mode === 'build' ? 1.12 : 0.9);
    if (!prev || s.power !== prev.power) this.setPower(s.power, s.instant || s.frozen !== null);
    if (!prev || s.load !== prev.load || s.build !== prev.build) this.rgb.temps = temps(s.build, s.load);
    if (!prev || s.inspect !== prev.inspect) this.setInspect(s);
    if (!prev || s.frozen !== prev.frozen) { if (s.frozen !== null) this.time = s.frozen; }
    this.rgb.lighting = s.build.lighting;
    this.inspector.rgb.lighting = s.build.lighting;
    this.dirty = true;
  }

  private setBuild(b: Build) {
    this.rig.sync(b);
  }

  private onRigChange() {
    const box = this.rig.bounds();
    this.rgb.setZones(this.rig.zones, box);
    this.computeViews(box);
    if (this.viewName && this.views[this.viewName]) this.jump(this.viewName);
    this.room?.updateShadow();
    this.dirty = true;
  }

  private setPower(on: boolean, instant: boolean) {
    gsap.killTweensOf(this.level);
    if (instant) { this.level.power = on ? 1 : 0; this.level.spin = on ? 1 : 0; }
    else {
      gsap.to(this.level, { power: on ? 1 : 0, duration: on ? 1.2 : 2.2, ease: on ? 'power2.out' : 'power2.in', onUpdate: () => { this.dirty = true; } });
      gsap.to(this.level, { spin: on ? 1 : 0, duration: on ? 1.5 : 3, ease: on ? 'power2.out' : 'power2.out' });
    }
    this.dirty = true;
  }

  private setInspect(s: State) {
    const i = s.inspect;
    if (!i) { this.showingInspector = false; this.post.setScene(this.scene, this.camera); this.dirty = true; return; }
    const opts: GenOpts = { detail: TIER_SETTINGS[this.tier].detail };
    if (i.finish) opts.finish = i.finish;
    else if (i.category === 'case') opts.finish = getCase(i.id)?.finishes[0] ?? 'onyx';
    if (i.category === 'fan') opts.size = i.size ?? 120;
    this.inspector.show(i.category, i.id, opts, Boolean((i as { flip?: boolean }).flip));
    this.inspector.angle = i.angle;
    this.inspector.zoom = i.zoom;
    this.inspector.focus = (i as { focus?: [number, number, number] }).focus ?? null;
    this.showingInspector = true;
    this.post.setScene(this.inspector.scene, this.inspector.camera);
    this.dirty = true;
  }

  // ---- camera -------------------------------------------------------------------------------

  private computeViews(box: THREE.Box3) {
    const c = new THREE.Vector3(); const size = new THREE.Vector3();
    if (box.isEmpty()) { box.set(new THREE.Vector3(-0.23, 0, -0.12), new THREE.Vector3(0.23, 0.5, 0.12)); }
    box.getCenter(c); box.getSize(size);
    const r = size.length() / 2;
    const fit = r / Math.sin((FOV * Math.PI) / 360);
    const make = (dir: [number, number, number], k: number, lift = 0): View => {
      const d = new THREE.Vector3(...dir).normalize();
      const target = c.clone(); target.y += lift;
      return { pos: target.clone().addScaledVector(d, fit * k), target };
    };
    this.views = {
      hero: make([0.68, 0.27, 1.3], 1.12, -0.004),
      side: make([0, 0.03, 1], 1.18, 0.005),
      front: make([1.5, 0.17, 0.72], 1.2),
      top: make([0.3, 0.95, 0.95], 1.0, 0.04),
      rear: make([-1.25, 0.24, 0.9], 1.14),
    };
    const L = CASE_LAYOUTS[this.rig.caseId ?? ''];
    if (L) for (const [name, v] of Object.entries(L.views)) this.views[name] = { pos: new THREE.Vector3(...v.pos).multiplyScalar(MM), target: new THREE.Vector3(...v.target).multiplyScalar(MM) };
    this.macroViews();
  }

  private macroViews() {
    const add = (name: string, key: string, dir: [number, number, number], k: number, offset: [number, number, number] = [0, 0, 0]) => {
      const b = this.rig.itemBounds(key);
      if (!b) return;
      const c = new THREE.Vector3(); b.getCenter(c); c.add(new THREE.Vector3(...offset));
      const s = new THREE.Vector3(); b.getSize(s);
      const d = Math.max(0.2, s.length() * k);
      this.views[name] = { pos: c.clone().addScaledVector(new THREE.Vector3(...dir).normalize(), d), target: c };
    };
    add('gpu', 'gpu', [0.32, 0.36, 1], 1.15);
    add('cooler', 'cooler', [0.1, 0.25, 1], 4.2);
    add('ram', 'ram:0:A2', [0.55, 0.45, 1], 1.5, [0, 0, 0]);
    add('board', 'board', [0.15, -0.05, 1], 0.95, [0.02, -0.05, 0]);
    add('psu', 'psu', [0.55, 0.3, 1], 1.6);
    add('fan', 'fan:front-2', [1.2, 0.2, 0.8], 2.2);
    add('storage', 'storage:nvme:0', [0.3, 0.6, 1], 2.4);
    add('cable', 'board', [0.6, 0.25, 1], 0.6, [0.05, 0.02, 0.02]);
    add('case-detail', 'case', [1.1, 0.5, 0.6], 0.35, [0.18, 0.2, 0.05]);
  }

  jump(name: string) {
    const v = this.views[name];
    if (!v) return false;
    this.camera.position.copy(v.pos);
    this.controls.target.copy(v.target);
    this.controls.update();
    this.viewName = name;
    this.dirty = true;
    return true;
  }

  setInsets(i: Insets) { this.insets = i; this.resize(); }

  resize() {
    const parent = this.canvasEl.parentElement;
    const w = Math.max(1, parent ? parent.clientWidth : window.innerWidth);
    const h = Math.max(1, parent ? parent.clientHeight : window.innerHeight);
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h);
    this.camera.aspect = w / h;
    const ox = (this.insets.left - this.insets.right) / 2; const oy = (this.insets.top - this.insets.bottom) / 2;
    if (ox || oy) this.camera.setViewOffset(w, h, -ox, -oy, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  // ---- loop ---------------------------------------------------------------------------------

  private animating(): boolean {
    const s = this.store.getState();
    if (gsap.globalTimeline.getChildren(true, true, false).some((t) => t.isActive())) return true;
    if (s.frozen !== null) return false;
    if (this.showingInspector) return true;
    return this.level.power > 0 || this.level.spin > 0;
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - (this.last || now)) / 1000));
    this.last = now;
    if (document.hidden) return;
    const moving = this.controls.update();
    if (!(this.dirty || moving || this.animating())) return;
    this.dirty = false;
    this.step(dt);
    this.draw();
  };

  private step(dt: number) {
    const s = this.store.getState();
    const frozen = s.frozen;
    if (frozen !== null) this.time = frozen; else this.time += dt;
    const speed = SPIN_IDLE + (SPIN_FULL - SPIN_IDLE) * s.load;
    if (frozen !== null) this.spinAngle = frozen * speed * this.level.spin; else this.spinAngle += dt * speed * this.level.spin;
    const omega = speed * this.level.spin;
    const blur = THREE.MathUtils.smoothstep(omega, BLUR_FROM, BLUR_TO);
    const rotors = this.showingInspector ? this.inspector.part?.rotors ?? [] : this.rig.rotors;
    for (const r of rotors) {
      const a = this.showingInspector ? 0 : this.spinAngle * r.speed;
      r.obj.rotation[r.axis] = a;
      if (r.disc && r.blades) {
        r.disc.visible = blur > 0.01;
        (r.disc.material as THREE.MeshBasicMaterial).opacity = 0.6 * blur;
        r.blades.visible = blur < 0.99;
      }
    }
    this.rgb.power = this.level.power;
    this.rgb.update(this.time);
    if (this.showingInspector) this.inspector.rgb.update(this.time);
    this.renderer.toneMappingExposure = EXPOSURE * (1 + 0.06 * this.level.power) * this.level.exposure;
  }

  private draw() {
    const t0 = performance.now();
    if (this.showingInspector) this.inspector.frame(this.width / this.height);
    this.post.composer.render();
    this.framesDrawn++;
    this.frameTimes.push(performance.now() - t0);
    if (this.frameTimes.length > 600) this.frameTimes.shift();
  }

  /** Renders now, n times, waiting a browser frame between each. */
  async renderNow(n = 2) {
    for (let i = 0; i < n; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      this.controls.update();
      this.step(0);
      this.draw();
    }
    const gl = this.renderer.getContext();
    gl.finish();
  }

  async settle() {
    await document.fonts.ready;
    for (let i = 0; i < 600; i++) {
      const busy = gsap.globalTimeline.getChildren(true, true, false).some((t) => t.isActive());
      if (!busy) break;
      await new Promise((r) => setTimeout(r, 16));
    }
    await this.renderNow(2);
  }

  async stats(seconds: number) {
    const start = this.framesDrawn;
    const from = this.frameTimes.length;
    const t0 = performance.now();
    const deltas: number[] = [];
    let prev = t0;
    const counter = () => { const n = performance.now(); deltas.push(n - prev); prev = n; };
    let lastCount = this.framesDrawn;
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (this.framesDrawn !== lastCount) { counter(); lastCount = this.framesDrawn; } else prev = performance.now();
        if (performance.now() - t0 >= seconds * 1000) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const frames = this.framesDrawn - start;
    const sorted = [...deltas].sort((a, b) => a - b);
    const q = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! : 0);
    void from;
    const info = this.renderer.info.render;
    return { frames, medianMs: q(0.5), p95Ms: q(0.95), drawCalls: info.calls, triangles: info.triangles };
  }

  /** Generates a part alone and measures how far its geometry reaches outside its declared boxes. */
  bounds(category: Category, id: string, opts: { size?: 120 | 140; finish?: string }) {
    const g: GenOpts = { detail: 1 };
    if (opts.size) g.size = opts.size;
    if (opts.finish) g.finish = opts.finish;
    const part = inspectPart(category, id, g);
    let worst = 0;
    forEachVertex(part.root, (v) => {
      let best = Infinity;
      for (const b of part.boxes) {
        const dx = Math.max(b.min[0] - v.x, 0, v.x - b.max[0]);
        const dy = Math.max(b.min[1] - v.y, 0, v.y - b.max[1]);
        const dz = Math.max(b.min[2] - v.z, 0, v.z - b.max[2]);
        best = Math.min(best, Math.hypot(dx, dy, dz));
        if (best === 0) break;
      }
      worst = Math.max(worst, best);
    });
    const boxes = part.boxes.length;
    part.dispose();
    return { boxes, maxOutsideMm: Math.round(worst * 100) / 100 };
  }

  rendererString(): string {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  }

  cameraInfo() {
    if (this.showingInspector) return { distance: this.inspector.distance, target: [0, 0, 0], view: 'inspector' };
    return { distance: this.camera.position.distanceTo(this.controls.target), target: this.controls.target.toArray(), view: this.viewName };
  }

  markDirty() { this.dirty = true; }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsub();
    this.rig.dispose();
    this.rgb.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}
