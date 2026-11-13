import gsap from 'gsap';
import * as THREE from 'three';
import { SHOWCASE } from '../data/showcase';
import { buildFromShowcase, revalidate } from '../engine/rules';
import { sheet } from '../engine/sheet';
import type { Build } from '../engine/types';
import type { State, Store } from '../state/store';
import { CACHE_BUDGET, partCache } from './parts/cache';
import type { Key, Look, Reel, Setting, Shot } from './reels';
import type { World } from './World';

/** While a reel runs, every build and part it shows stays generated: about 250 MB a build, so a cut never builds a part. */
const REEL_BUDGET = 2048 * 1024 * 1024;
const DEG = Math.PI / 180;
/** A frame that took longer than this does not move the reel further, so a slow frame is a held frame and not a jump. */
const MAX_STEP = 0.1;

type Saved = Pick<State, 'build' | 'mode' | 'power' | 'airflow' | 'load' | 'inspect' | 'ui' | 'uiHidden'> & { pos: THREE.Vector3; target: THREE.Vector3 };

const lerp = (a: [number, number], u: number) => a[0] + (a[1] - a[0]) * u;
const ease = (name: string | undefined) => gsap.parseEase(name ?? 'sine.inOut') as (u: number) => number;
const lookOf = (l: Look) => ({ category: l.category, id: l.id, angle: 0, zoom: 0, ...(l.size ? { size: l.size } : {}), ...(l.finish ? { finish: l.finish } : {}) });

/** Every build and part a set of reels puts on the bench. */
export function reelNeeds(reels: Reel[]) {
  const builds = new Set<string>(); const looks = new Map<string, Look>();
  const add = (s: Setting) => { if (s.build) builds.add(s.build); if (s.inspect) looks.set(JSON.stringify(s.inspect), s.inspect); };
  for (const r of reels) for (const sh of r.shots) { add(sh.set); for (const b of sh.beats ?? []) add(b.set); }
  return { builds: [...builds], looks: [...looks.values()] };
}

/**
 * Plays a demo reel: shot by shot it puts a build and a view on the bench and moves the camera, on the clock, with hard
 * cuts between shots. It takes the bench over and gives it back as it was.
 */
export class Director {
  private reel: Reel | null = null;
  private starts: number[] = [];
  private t = 0;
  private last = 0;
  private cur = -1;
  private beat = 0;
  private path: { pos: THREE.CatmullRomCurve3; tgt: THREE.CatmullRomCurve3 } | null = null;
  private saved: Saved | null = null;
  private builds = new Map<string, Build>();
  private running = false;
  onEnd: (() => void) | null = null;

  constructor(private world: World, private store: Store) {}

  get active() { return this.saved !== null; }
  get playing() { return this.running; }
  get time() { return this.t; }

  private build(id: string): Build {
    let b = this.builds.get(id);
    if (!b) {
      const sc = SHOWCASE.find((x) => x.id === id);
      if (!sc) throw new Error(`no showcase build ${id}`);
      b = revalidate(buildFromShowcase(sc)).build;
      this.builds.set(id, b);
    }
    return b;
  }

  /** Takes the bench over: what is there is kept to give back, and parts and cable sets stay generated while reels run. */
  begin() {
    if (this.saved) return;
    const s = this.store.getState();
    this.saved = { build: s.build, mode: s.mode, power: s.power, airflow: s.airflow, load: s.load, inspect: s.inspect, ui: s.ui, uiHidden: s.uiHidden, pos: this.world.camera.position.clone(), target: this.world.controls.target.clone() };
    partCache.setBudget(REEL_BUDGET);
    this.world.rig.keepCables(true);
    this.world.setDirected(true);
    this.store.setState({ selected: null, held: null, focus: null, notice: null, ui: { ...s.ui, tab: 'builds', overlay: null, dialog: null, menu: false, side: null, shared: null, swap: null, stop: null } });
  }

  /** Every build and part the reels show, generated and drawn once, so no cut builds anything. Ends on the bench as it was. */
  async prepare(reels: Reel[], report: (done: number, total: number) => void) {
    const { builds, looks } = reelNeeds(reels);
    const total = builds.length + looks.length;
    let done = 0;
    report(done, total);
    for (const id of builds) {
      if (!this.saved) return;
      this.store.setState({ build: this.build(id), inspect: null, instant: true });
      await this.world.renderNow(1);
      report(++done, total);
    }
    for (const l of looks) {
      if (!this.saved) return;
      this.store.setState({ inspect: lookOf(l), instant: true });
      await this.world.renderNow(1);
      report(++done, total);
    }
    if (this.saved) this.store.setState({ build: this.saved.build, inspect: null, instant: true });
  }

  play(reel: Reel) {
    this.begin();
    this.load(reel);
    this.running = true;
    this.last = performance.now();
    this.seek(0);
    gsap.ticker.add(this.tick);
  }

  /** The reel's state and camera at a time in seconds, set at once: for stills. */
  still(reel: Reel, t: number) {
    this.begin();
    if (this.reel !== reel) this.load(reel);
    this.halt();
    this.cur = -1;
    const end = this.starts[this.starts.length - 1]! + reel.shots[reel.shots.length - 1]!.dur;
    this.seek(Math.max(0, Math.min(end, t)), false);
  }

  /** Gives the bench back as it was before the first reel. */
  end() {
    this.halt();
    this.reel = null;
    this.cur = -1;
    const v = this.saved;
    if (!v) return;
    this.saved = null;
    this.store.setState({ build: v.build, mode: v.mode, power: v.power, airflow: v.airflow, load: v.load, inspect: v.inspect, ui: v.ui, uiHidden: v.uiHidden, instant: true });
    this.world.setDirected(false);
    this.world.place(v.pos, v.target);
    this.world.rig.keepCables(false);
    partCache.setBudget(CACHE_BUDGET);
  }

  private halt() { this.running = false; gsap.ticker.remove(this.tick); }

  private load(reel: Reel) {
    this.reel = reel;
    this.starts = [];
    let at = 0;
    for (const s of reel.shots) { this.starts.push(at); at += s.dur; }
    this.cur = -1;
    this.t = 0;
  }

  private tick = () => {
    const r = this.reel;
    if (!this.running || !r) return;
    const now = performance.now();
    this.t += Math.min(MAX_STEP, (now - this.last) / 1000);
    this.last = now;
    const total = this.starts[this.starts.length - 1]! + r.shots[r.shots.length - 1]!.dur;
    if (this.t >= total) { this.seek(total); this.halt(); this.onEnd?.(); return; }
    this.seek(this.t);
  };

  /** live: beats play their own motion; otherwise every change up to t is a cut, as a still needs. */
  private seek(t: number, live = true) {
    const r = this.reel!;
    this.t = t;
    let i = this.starts.findIndex((s, k) => t < s + r.shots[k]!.dur);
    if (i < 0) i = r.shots.length - 1;
    const shot = r.shots[i]!;
    const local = Math.min(shot.dur, t - this.starts[i]!);
    if (i !== this.cur) {
      // A still taken in the middle of a reel carries everything set before it.
      if (!live) for (let k = 0; k < i; k++) { this.apply(r.shots[k]!.set, false); for (const b of r.shots[k]!.beats ?? []) this.apply(b.set, false); }
      this.cur = i;
      this.beat = 0;
      this.path = null;
      this.apply(shot.set, false);
    }
    const beats = shot.beats ?? [];
    while (this.beat < beats.length && beats[this.beat]!.at <= local) { const b = beats[this.beat++]!; this.apply(b.set, live && !!b.motion); }
    this.frame(shot, local / shot.dur);
  }

  private apply(set: Setting, motion: boolean) {
    const s = this.store.getState();
    const patch: Partial<State> = { instant: !motion, selected: null, held: null };
    let build = s.build;
    if (set.build) build = this.build(set.build);
    if (set.lighting) build = { ...build, lighting: { ...build.lighting, ...set.lighting } };
    if (set.glass !== undefined && set.glass !== build.glass) build = { ...build, glass: set.glass };
    if (build !== s.build) patch.build = build;
    if (set.mode && set.mode !== s.mode) patch.mode = set.mode;
    if (set.power !== undefined) patch.power = set.power && sheet(build).canPowerOn;
    if (set.airflow !== undefined) patch.airflow = set.airflow;
    if (set.load !== undefined) patch.load = set.load;
    if (set.inspect !== undefined) patch.inspect = set.inspect ? lookOf(set.inspect) : null;
    this.store.setState(patch);
  }

  private frame(shot: Shot, u: number) {
    const c = shot.cam;
    if ('orbit' in c) {
      const o = c.orbit;
      const hero = this.world.views.hero;
      if (!hero) return;
      const e = ease(o.ease)(u);
      const target = hero.target.clone();
      target.y += o.lift ?? 0;
      const d = hero.pos.distanceTo(hero.target) * lerp(o.k, e);
      const az = lerp(o.az, e) * DEG; const el = lerp(o.el, e) * DEG;
      this.world.place(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(target), target);
    } else if ('path' in c) {
      this.path ??= this.makePath(c.path);
      if (!this.path) return;
      const e = ease(c.ease)(u);
      this.world.place(this.path.pos.getPoint(e), this.path.tgt.getPoint(e));
    } else {
      const p = c.part;
      const e = ease(p.ease)(u);
      const insp = this.world.inspector;
      insp.angle = lerp(p.angle, e);
      insp.zoom = lerp(p.zoom, e);
      insp.elevation = lerp(p.el, e);
      insp.focus = p.focus ?? null;
      insp.spin = 0;
      this.world.markDirty();
    }
  }

  private makePath(keys: Key[]) {
    const pos: THREE.Vector3[] = []; const tgt: THREE.Vector3[] = [];
    for (const k of keys) {
      const b = this.world.rig.itemBounds(k.item);
      if (!b) continue;
      const f = k.f ?? [0.5, 0.5, 0.5];
      const t = new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * f[0], b.min.y + (b.max.y - b.min.y) * f[1], b.min.z + (b.max.z - b.min.z) * f[2]);
      tgt.push(t);
      pos.push(t.clone().add(new THREE.Vector3(...k.off)));
    }
    if (pos.length < 2) return null;
    return { pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'), tgt: new THREE.CatmullRomCurve3(tgt, false, 'centripetal') };
  }
}
