import gsap from 'gsap';
import * as THREE from 'three';
import { coolerTubes } from '../cables';
import { Rig, type RigChange, type RigItem } from '../rig';
import { Fader } from './fade';
import { revealMaterial, type Reveal } from './reveal';

export type MotionMode = 'instant' | 'motion' | 'fade';

type V = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Arrival order, and the reverse for departures, so a cascade leaves dependents first. */
const ORDER = ['case', 'board', 'cpu', 'cooler', 'radiator', 'ram', 'gpu', 'gpu-support', 'storage', 'psu', 'fan'];
const rank = (i: RigItem) => { const k = ORDER.indexOf(i.placed.kind); return k < 0 ? ORDER.length : k; };

/** Beyond the glass and a little above: where a part comes in from and goes back to. */
const OUT = v3(0, 40, 260);
/** The short stop before seating, along the insertion axis. */
const SHORT = 35;
/** Parts that slide in along their own axis from outside, as a supply through the rear opening or a drive into its bay. */
const ALONG = new Set(['psu']);
const STAGGER = 0.08;
const REMOVE = 0.7;

/** Opening angles of the board's own fittings, in radians. */
const OPEN = { frame: 1.95, lever: 2.05, latch: 0.45, pcie: 0.55 };

const isCooling = (i: RigItem) => i.placed.kind === 'radiator' || (i.placed.kind === 'cooler' && Boolean(i.placed.meta.pump));

function bezier(a: V, c: V, b: V, t: number, out: V) {
  const u = 1 - t;
  return out.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
}

/**
 * Motion for every build action: parts arrive, seat and fasten, leave in reverse, and the cables grow from the supply end. Each
 * change is one timeline, so a scrub can stop it at any point and a new action can finish it at once.
 */
export class Choreo {
  /** When set, new timelines are created paused, for the hook's scrub. */
  scrubbing = false;
  /** The next arrival was dropped on its place: it seats from the preview pose, short of home, with no travel. */
  fromPreview = false;
  /** The next departure was dragged out of the case: it fades where it was let go. */
  dropOut = false;
  last: gsap.core.Timeline | null = null;
  private running = new Set<gsap.core.Timeline>();
  private faders = new Map<RigItem, Fader>();
  private glassFader: Fader | null = null;
  private glassLift = { l: 0 };
  private held = false;
  private build: { glass: boolean } = { glass: true };

  constructor(private rig: Rig, private dirty: () => void) {
    rig.onItems = (c) => this.onItems(c);
    rig.onCables = (old, next) => this.onCables(old, next);
  }

  mode: MotionMode = 'instant';
  private pendingCables: { old: THREE.Group | null; next: THREE.Group } | null = null;

  setBuildFlags(b: { glass: boolean }) { this.build = b; }

  /** Ends every running motion at its final state, before the next change. */
  finishAll() {
    for (const tl of [...this.running]) { tl.progress(1); tl.kill(); this.running.delete(tl); }
  }

  opacity(item: RigItem) { return this.faders.get(item)?.opacity ?? 1; }

  private fader(item: RigItem) {
    let f = this.faders.get(item);
    if (!f) { f = new Fader(item.holder); this.faders.set(item, f); }
    return f;
  }

  private settleFader(item: RigItem) { const f = this.faders.get(item); if (f) { f.set(1); f.dispose(); this.faders.delete(item); } }

  private release(item: RigItem) {
    const f = this.faders.get(item); if (f) { f.dispose(); this.faders.delete(item); }
    this.rig.release(item);
    if (isCooling(item)) this.rebuildTubes();
  }

  private onCables(old: THREE.Group | null, next: THREE.Group) {
    if (this.mode === 'instant' || !old) { if (old) Rig.disposeCables(old); return; }
    this.pendingCables = { old, next };
  }

  // ---- the change ---------------------------------------------------------------------------

  private onItems(c: RigChange) {
    const mode = this.mode;
    if (mode === 'instant') {
      for (const i of c.left) this.release(i);
      for (const r of c.rebuilt) this.release(r.old);
      if (this.pendingCables?.old) Rig.disposeCables(this.pendingCables.old);
      this.pendingCables = null;
      return;
    }
    const tl = gsap.timeline({ paused: this.scrubbing, onUpdate: this.dirty });
    const left = [...c.left].sort((a, b) => rank(b) - rank(a));
    const entered = [...c.entered].sort((a, b) => rank(a) - rank(b));
    const cables = this.pendingCables; this.pendingCables = null;
    const preview = this.fromPreview; const dropOut = this.dropOut;
    this.fromPreview = false; this.dropOut = false;

    if (mode === 'fade') {
      left.forEach((i) => { const f = this.fader(i); tl.to({ v: 1 }, { v: 0, duration: 0.15, ease: 'none', onUpdate: function () { f.set(this.targets()[0].v); } }, 0).add(() => this.release(i)); });
      for (const r of c.rebuilt) this.crossfade(tl, r.old, r.next, 0.15, 0);
      entered.forEach((i) => { const f = this.fader(i); f.set(0); tl.to({ v: 0 }, { v: 1, duration: 0.15, ease: 'none', onUpdate: function () { f.set(this.targets()[0].v); } }, 0).add(() => this.settleFader(i)); });
      if (cables?.old) tl.add(() => Rig.disposeCables(cables.old!), 0);
      return this.start(tl);
    }

    const travel = left.length + entered.length + c.moved.length > 0;
    if (travel && this.build.glass) this.lift(tl, 1, 0);
    let t = travel && this.build.glass ? 0.15 : 0;

    // Cables of parts that leave retract toward the supply first; runs that stay swap to their rebuilt copies at once.
    const regrow = c.moved.length > 0;
    if (cables?.old) t = Math.max(t, this.retract(tl, cables.old, cables.next, t, regrow));
    for (const m of c.moved) {
      const h = m.item.holder; const to = h.position.clone(); const toRot = h.rotation.clone();
      h.position.copy(m.from); h.rotation.copy(m.fromRot);
      tl.to(h.position, { x: to.x, y: to.y, z: to.z, duration: 0.8, ease: 'power3.inOut', onUpdate: () => this.flex(m.item) }, t);
      tl.to(h.rotation, { x: toRot.x, y: toRot.y, z: toRot.z, duration: 0.8, ease: 'power3.inOut' }, t);
    }

    left.forEach((i, k) => tl.add(dropOut ? this.dropAway(i) : this.leave(i), t + k * STAGGER));
    const leftEnd = left.length ? t + (left.length - 1) * STAGGER + REMOVE * 1.0 : t;
    for (const r of c.rebuilt) this.crossfade(tl, r.old, r.next, 0.3, t);

    // A swap overlaps: the new part starts arriving while the old one is still on its way out.
    let at = left.length ? Math.max(t, leftEnd - 0.35) : t;
    const many = entered.length > 4;
    const supportAfter = new Map<RigItem, number>();
    entered.forEach((i, k) => {
      const seg = this.enter(i, many, preview);
      const when = i.placed.kind === 'gpu-support' ? (supportAfter.get(entered.find((x) => x.placed.kind === 'gpu')!) ?? at) : at + k * (many ? 0.05 : STAGGER);
      tl.add(seg, when);
      if (i.placed.kind === 'gpu') supportAfter.set(i, when + 0.85);
    });
    const enterEnd = tl.duration();
    if (cables) this.grow(tl, cables.old, cables.next, Math.max(enterEnd - 0.1, t), regrow);
    if (travel && this.build.glass) this.lift(tl, 0, tl.duration() + 0.05);
    return this.start(tl);
  }

  private start(tl: gsap.core.Timeline) {
    this.running.add(tl);
    this.last = tl;
    tl.eventCallback('onComplete', () => { this.running.delete(tl); this.dirty(); });
    if (!this.scrubbing) tl.play(0);
    return tl;
  }

  private fadeTo(tl: gsap.core.Timeline, f: Fader, from: number, to: number, d: number, at: number) {
    const o = { v: from };
    tl.to(o, { v: to, duration: d, ease: 'none', onUpdate: () => f.set(o.v) }, at);
  }

  private crossfade(tl: gsap.core.Timeline, old: RigItem, next: RigItem, d: number, at: number) {
    const fo = this.fader(old); const fn = this.fader(next);
    fn.set(0);
    const o = { v: 0 };
    tl.to(o, { v: 1, duration: d, ease: 'power1.inOut', onUpdate: () => { fo.set(1 - o.v); fn.set(o.v); } }, at);
    tl.add(() => { this.release(old); this.settleFader(next); }, at + d);
  }

  // ---- glass ------------------------------------------------------------------------------------

  private glass(): THREE.Object3D | null { return this.rig.items.get('case')?.part.movers.glass ?? null; }

  private applyGlass() {
    const g = this.glass();
    if (!g) return;
    const l = this.glassLift.l;
    g.position.set(0, 30 * l, 40 * l);
    if (!this.build.glass) { g.visible = false; return; }
    if (!this.glassFader || this.glassFader.root !== g) { this.glassFader?.dispose(); this.glassFader = new Fader(g); }
    this.glassFader.set(1 - l);
    if (l <= 0.001) { this.glassFader.dispose(); this.glassFader = null; g.visible = true; }
  }

  private lift(tl: gsap.core.Timeline, to: 0 | 1, at: number) {
    if (to === 0 && this.held) return;
    tl.to(this.glassLift, { l: to, duration: to ? 0.3 : 0.35, ease: to ? 'power2.out' : 'power2.inOut', onUpdate: () => this.applyGlass() }, at);
  }

  /** While a part is held the glass stays lifted away; it returns when the hand lets go and nothing is moving. */
  hold(on: boolean) {
    this.held = on;
    if (!this.build.glass) return;
    gsap.to(this.glassLift, { l: on ? 1 : 0, duration: on ? 0.3 : 0.35, ease: 'power2.inOut', overwrite: true, delay: on ? 0 : 0.2, onUpdate: () => { this.applyGlass(); this.dirty(); } });
  }

  /** The glass at rest, for a frame that must not show a lift in progress. */
  resetGlass() { gsap.killTweensOf(this.glassLift); this.glassLift.l = this.held ? 1 : 0; this.applyGlass(); }

  // ---- arrival and departure ----------------------------------------------------------------

  private path(item: RigItem) {
    const home = item.holder.position.clone();
    const I = v3(...item.placed.insert).normalize();
    const pre = home.clone().addScaledVector(I, -SHORT);
    const along = ALONG.has(item.placed.kind) || (item.placed.kind === 'storage' && item.placed.id !== 'nvme');
    const far = along ? pre.clone().addScaledVector(I, -240) : pre.clone().add(OUT);
    const ctrl = along ? far.clone().lerp(pre, 0.5) : far.clone().lerp(pre, 0.5).add(v3(0, 70, 0));
    return { home, pre, far, ctrl, I };
  }

  /** A part let go outside the case: it drifts down a little and fades out where it is. */
  private dropAway(item: RigItem): gsap.core.Timeline {
    const tl = gsap.timeline(); const h = item.holder; const f = this.fader(item);
    tl.to(h.position, { y: h.position.y - 30, duration: 0.3, ease: 'power2.in' }, 0);
    this.fadeTo(tl, f, 1, 0, 0.3, 0);
    tl.add(() => this.release(item));
    const close = this.close(item); if (close) tl.add(close);
    return tl;
  }

  private enter(item: RigItem, quick: boolean, preview = false): gsap.core.Timeline {
    const tl = gsap.timeline();
    const h = item.holder; const f = this.fader(item);
    const kind = item.placed.kind;
    const home = h.position.clone(); const rot = h.rotation.clone();

    if (kind === 'case') {
      h.position.y = home.y + 90; f.set(0);
      this.fadeTo(tl, f, 0, 1, 0.3, 0);
      const y = { v: 90 };
      tl.to(y, { v: 0, duration: 0.75, ease: 'back.out(1.1)', onUpdate: () => { h.position.y = home.y + y.v; } }, 0);
      tl.add(() => this.settleFader(item));
      return tl;
    }
    if (kind === 'gpu-support') {
      if (item.placed.meta.arm) {
        h.rotation.y = rot.y - 1.4; f.set(1);
        tl.to(h.rotation, { y: rot.y, duration: 0.4, ease: 'back.out(1.3)' });
      } else {
        h.scale.y = 0.02; f.set(1);
        tl.to(h.scale, { y: 1, duration: 0.4, ease: 'power2.out' });
      }
      tl.add(() => this.settleFader(item));
      return tl;
    }

    const { pre, far, ctrl } = this.path(item);
    const tilt = kind === 'board' ? 0.22 : 0;
    const angle = kind === 'storage' && item.placed.id === 'nvme' ? -0.35 : 0;
    const prep = this.prepare(item, quick);
    if (prep) tl.add(prep, 0);
    if (preview) { h.position.copy(pre); h.rotation.set(rot.x, rot.y + angle, rot.z); f.set(1); this.settleFader(item); }
    else { h.position.copy(far); f.set(0); h.rotation.set(rot.x + tilt, rot.y + angle, rot.z); }
    const k = { t: 0 };
    if (!preview) tl.to(k, { t: 1, duration: quick ? 0.45 : 0.6, ease: 'power3.inOut', onUpdate: () => { bezier(far, ctrl, pre, k.t, h.position); f.set(Math.min(1, k.t / 0.35)); h.rotation.x = rot.x + tilt * (1 - k.t); this.flex(item); } }, prep ? 0.12 : 0);
    if (!preview) tl.add(() => this.settleFader(item));
    const firm = ['board', 'gpu', 'psu', 'storage', 'radiator'].includes(kind);
    tl.to(h.position, { x: home.x, y: home.y, z: home.z, duration: quick ? 0.2 : 0.3, ease: firm ? 'power2.out' : 'back.out(1.6)', onUpdate: () => this.flex(item) });
    if (angle) tl.to(h.rotation, { y: rot.y, duration: 0.2, ease: 'power2.out' });
    if (!quick) { const sec = this.secure(item, 'in'); if (sec) tl.add(sec); }
    return tl;
  }

  private leave(item: RigItem): gsap.core.Timeline {
    const tl = gsap.timeline();
    const h = item.holder; const f = this.fader(item);
    const kind = item.placed.kind;
    if (kind === 'case') {
      const y0 = h.position.y;
      tl.to(h.position, { y: y0 + 90, duration: 0.5, ease: 'power2.in' }, 0);
      this.fadeTo(tl, f, 1, 0, 0.35, 0.15);
      tl.add(() => this.release(item));
      return tl;
    }
    if (kind === 'gpu-support') {
      this.fadeTo(tl, f, 1, 0, 0.2, 0);
      tl.add(() => this.release(item));
      return tl;
    }
    const { pre, far, ctrl } = this.path(item);
    const sec = this.secure(item, 'out');
    if (sec) tl.add(sec);
    tl.to(h.position, { x: pre.x, y: pre.y, z: pre.z, duration: 0.3 * REMOVE, ease: 'power2.in', onUpdate: () => this.flex(item) });
    const k = { t: 0 };
    tl.to(k, { t: 1, duration: 0.6 * REMOVE, ease: 'power3.in', onUpdate: () => { bezier(pre, ctrl, far, k.t, h.position); f.set(Math.min(1, (1 - k.t) / 0.4)); this.flex(item); } });
    tl.add(() => this.release(item));
    const close = this.close(item);
    if (close) tl.add(close);
    return tl;
  }

  /** After a part has gone, the fittings it opened close again: the socket frame and lever, the latches, the M.2 plate. */
  private close(item: RigItem): gsap.core.Timeline | null {
    const mv = this.rig.items.get('board')?.part.movers ?? {};
    const tl = gsap.timeline();
    const kind = item.placed.kind;
    if (kind === 'cpu' && mv['socket-frame'] && mv['socket-lever']) { tl.to(mv['socket-frame'].rotation, { x: 0, duration: 0.3, ease: 'power2.in' }); tl.to(mv['socket-lever'].rotation, { x: 0, duration: 0.2, ease: 'power2.in' }); }
    if (kind === 'ram') for (const end of [0, 1]) { const l = mv[`latch:${String(item.placed.meta.slot)}:${end}`]; if (l) tl.to(l.rotation, { x: 0, duration: 0.15, ease: 'power2.in' }, 0); }
    if (kind === 'gpu' && mv['pcie-latch']) tl.to(mv['pcie-latch'].rotation, { y: 0, duration: 0.15, ease: 'power2.in' });
    if (kind === 'storage' && item.placed.id === 'nvme') { const p = mv[`m2-plate:${String(item.placed.meta.slot)}`]; const z0 = p?.userData.homeZ as number | undefined; if (p && z0 !== undefined) { tl.to(p.position, { z: z0, duration: 0.25, ease: 'power2.in' }); tl.to(p.rotation, { y: 0, duration: 0.25 }, '<'); } }
    return tl.duration() ? tl : null;
  }

  /** The board's fittings open before a part arrives: the socket frame and lever, the memory latches, the slot latch, the M.2 plate. */
  private prepare(item: RigItem, quick: boolean): gsap.core.Timeline | null {
    if (quick) return null;
    const board = this.rig.items.get('board');
    const mv = board?.part.movers ?? {};
    const tl = gsap.timeline();
    const kind = item.placed.kind;
    if (kind === 'cpu' && mv['socket-frame'] && mv['socket-lever']) {
      tl.to(mv['socket-lever'].rotation, { x: OPEN.lever, duration: 0.25, ease: 'power2.out' }, 0);
      tl.to(mv['socket-frame'].rotation, { x: OPEN.frame, duration: 0.35, ease: 'power2.out' }, 0.12);
      return tl;
    }
    if (kind === 'ram') {
      for (const end of [0, 1]) { const l = mv[`latch:${String(item.placed.meta.slot)}:${end}`]; if (l) tl.to(l.rotation, { x: end === 0 ? -OPEN.latch : OPEN.latch, duration: 0.2, ease: 'power2.out' }, 0); }
      return tl.duration() ? tl : null;
    }
    if (kind === 'gpu' && mv['pcie-latch']) { tl.to(mv['pcie-latch'].rotation, { y: OPEN.pcie, duration: 0.2, ease: 'power2.out' }); return tl; }
    if (kind === 'storage' && item.placed.id === 'nvme') {
      const plate = mv[`m2-plate:${String(item.placed.meta.slot)}`];
      if (plate) { const z = plate.position.z; plate.userData.homeZ ??= z; tl.to(plate.position, { z: z + 14, duration: 0.3, ease: 'power2.out' }); tl.to(plate.rotation, { y: -0.12, duration: 0.3, ease: 'power2.out' }, 0); return tl; }
    }
    return null;
  }

  /** The part's own fastening, after it seats ('in'), or undone before it lifts out ('out'). */
  private secure(item: RigItem, dir: 'in' | 'out'): gsap.core.Timeline | null {
    const board = this.rig.items.get('board');
    const mv = board?.part.movers ?? {};
    const tl = gsap.timeline();
    const kind = item.placed.kind;
    const s = dir === 'in' ? 1 : REMOVE;
    switch (kind) {
      case 'board': { const g = item.part.movers['board-screws']; if (g) this.screws(tl, g, dir); break; }
      case 'cpu': {
        const frame = mv['socket-frame']; const lever = mv['socket-lever'];
        if (!frame || !lever) break;
        if (dir === 'in') {
          tl.to(frame.rotation, { x: 0, duration: 0.35, ease: 'power2.in' });
          tl.to(lever.rotation, { x: 0, duration: 0.25, ease: 'back.in(1.4)' });
        } else {
          tl.to(lever.rotation, { x: OPEN.lever, duration: 0.25 * s, ease: 'power2.out' });
          tl.to(frame.rotation, { x: OPEN.frame, duration: 0.35 * s, ease: 'power2.out' });
        }
        break;
      }
      case 'ram': {
        const slot = String(item.placed.meta.slot);
        for (const end of [0, 1]) {
          const l = mv[`latch:${slot}:${end}`];
          if (!l) continue;
          const open = end === 0 ? -OPEN.latch : OPEN.latch;
          if (dir === 'in') tl.to(l.rotation, { x: 0, duration: 0.12, ease: 'power4.in' }, 0);
          else tl.to(l.rotation, { x: open, duration: 0.14, ease: 'power2.out' }, 0);
        }
        break;
      }
      case 'gpu': {
        const latch = mv['pcie-latch'];
        if (latch) {
          if (dir === 'in') tl.to(latch.rotation, { y: 0, duration: 0.1, ease: 'power4.in' });
          else tl.to(latch.rotation, { y: OPEN.pcie, duration: 0.14, ease: 'power2.out' });
        }
        const g = item.part.root.getObjectByName('bracket-screws');
        if (g) this.screws(tl, g, dir);
        break;
      }
      case 'cooler': {
        const g = item.part.root.getObjectByName('cooler-screws') ?? item.part.root.getObjectByName('pump-screws');
        if (g) this.screws(tl, g, dir, 'thumb');
        break;
      }
      case 'fan': {
        const key = Object.keys(item.part.movers).find((k) => k.startsWith('screws:'));
        const g = key ? item.part.movers[key] : undefined;
        if (g) this.screws(tl, g, dir);
        break;
      }
      case 'storage': {
        if (item.placed.id !== 'nvme') break;
        const plate = mv[`m2-plate:${String(item.placed.meta.slot)}`];
        if (!plate) break;
        const z0 = (plate.userData.homeZ as number | undefined) ?? plate.position.z;
        if (dir === 'in') { tl.to(plate.position, { z: z0, duration: 0.3, ease: 'power2.in' }); tl.to(plate.rotation, { y: 0, duration: 0.3, ease: 'power2.in' }, '<'); }
        else { tl.to(plate.position, { z: z0 + 14, duration: 0.22, ease: 'power2.out' }); tl.to(plate.rotation, { y: -0.12, duration: 0.22 }, '<'); }
        break;
      }
    }
    return tl.duration() ? tl : null;
  }

  /** Screws spin down one after another along their own axis, or back out. */
  private screws(tl: gsap.core.Timeline, group: THREE.Object3D, dir: 'in' | 'out', name?: string) {
    const list = group.children.filter((c) => !name || c.name === name);
    list.forEach((sc, i) => {
      const base = (sc.userData.home as V | undefined) ?? sc.position.clone();
      sc.userData.home = base;
      const axis = v3(0, 0, 1).applyQuaternion(sc.quaternion);
      const up = base.clone().addScaledVector(axis, 3.5);
      const turns = Math.PI * 4;
      if (dir === 'in') {
        sc.position.copy(up); sc.rotation.z = -turns;
        tl.to(sc.position, { x: base.x, y: base.y, z: base.z, duration: 0.26, ease: 'power1.inOut' }, i * 0.06);
        tl.to(sc.rotation, { z: 0, duration: 0.26, ease: 'power1.inOut' }, i * 0.06);
      } else {
        tl.to(sc.position, { x: up.x, y: up.y, z: up.z, duration: 0.18, ease: 'power1.inOut' }, i * 0.04);
        tl.to(sc.rotation, { z: -turns, duration: 0.18, ease: 'power1.inOut' }, i * 0.04);
        tl.add(() => { sc.position.copy(base); sc.rotation.z = 0; }, '>');
      }
    });
  }

  /** A liquid cooler's tubes follow the pump and the radiator while either moves. */
  private flex(item: RigItem) { if (isCooling(item)) this.rebuildTubes(); }

  private rebuildTubes() {
    const cables = this.rig.cables;
    if (!cables) return;
    for (const old of cables.children.filter((c) => c.name === 'tube')) { old.removeFromParent(); (old as THREE.Mesh).geometry.dispose(); }
    const items = new Map(this.rig.items);
    for (const i of this.rig.leaving) if (isCooling(i)) items.set(i.placed.kind === 'radiator' ? 'radiator' : 'cooler', i);
    for (const t of coolerTubes(items)) cables.add(t);
  }

  // ---- cables -------------------------------------------------------------------------------

  private runsOf(g: THREE.Group) {
    const out = new Map<string, THREE.Mesh[]>();
    g.traverse((o) => { if (o instanceof THREE.Mesh && typeof o.userData.run === 'string') { const l = out.get(o.userData.run) ?? []; l.push(o); out.set(o.userData.run, l); } });
    return out;
  }

  private colorsOf(meshes: THREE.Mesh[]) { return meshes.filter((m) => m.name.startsWith('run:')).map((m) => (m.material as THREE.MeshStandardMaterial).color?.getHexString?.() ?? '').sort().join(','); }

  /** Runs that leave retract into the supply end; runs present before and after hand over to the rebuilt copy. */
  private retract(tl: gsap.core.Timeline, old: THREE.Group, next: THREE.Group, at: number, regrow = false): number {
    const before = this.runsOf(old); const after = this.runsOf(next);
    const leaving = [...before.keys()].filter((k) => regrow || !after.has(k));
    for (const o of old.children) if (o.name === 'tube' || (!o.userData.run && o.name !== 'tube')) o.visible = false;
    if (!regrow) for (const [name, meshes] of before) if (after.has(name) && this.colorsOf(meshes) === this.colorsOf(after.get(name)!)) for (const m of meshes) m.visible = false;
    let end = at;
    for (const name of leaving) {
      for (const m of before.get(name)!) {
        if (m.name.startsWith('run:')) {
          const r = revealMaterial(m.material as THREE.Material, m.userData.length as number, Boolean(m.userData.fromEnd));
          m.material = r.material; r.set(1);
          const o = { v: 1 };
          tl.to(o, { v: 0, duration: 0.3, ease: 'power1.in', onUpdate: () => r.set(o.v) }, at);
        } else m.visible = false;
      }
      end = at + 0.3;
    }
    return end;
  }

  /** New runs grow from the supply end with their combs and plugs fading in as the run reaches them; a new colorway sweeps. */
  private grow(tl: gsap.core.Timeline, old: THREE.Group | null, next: THREE.Group, at: number, regrow = false) {
    const before = old && !regrow ? this.runsOf(old) : new Map<string, THREE.Mesh[]>();
    const after = this.runsOf(next);
    const reveals: { r: Reveal; m: THREE.Mesh; base: THREE.Material }[] = [];
    const fades: Fader[] = [];
    const sweeps: { r: Reveal; m: THREE.Mesh; base: THREE.Material }[] = [];
    for (const [name, meshes] of after) {
      const had = before.get(name);
      const recolor = had && this.colorsOf(had) !== this.colorsOf(meshes);
      if (had && !recolor) continue;
      for (const m of meshes) {
        if (m.name.startsWith('run:')) {
          const base = m.material as THREE.Material;
          const r = revealMaterial(base, m.userData.length as number, Boolean(m.userData.fromEnd));
          m.material = r.material; r.set(0); reveals.push({ r, m, base });
        } else if (!recolor) { const f = new Fader(m); f.set(0); fades.push(f); }
      }
      if (recolor && had) for (const m of had) {
        if (!m.name.startsWith('run:')) { m.visible = false; continue; }
        const base = m.material as THREE.Material;
        const r = revealMaterial(base, m.userData.length as number, Boolean(m.userData.fromEnd), true);
        m.material = r.material; r.set(0); sweeps.push({ r, m, base });
      }
    }
    if (!reveals.length && !fades.length) { if (old) tl.add(() => Rig.disposeCables(old), at); return; }
    const o = { v: 0 };
    tl.to(o, { v: 1, duration: sweeps.length ? 0.9 : 0.7, ease: 'power1.inOut', onUpdate: () => {
      for (const x of reveals) x.r.set(o.v);
      for (const x of sweeps) x.r.set(o.v);
      const fv = Math.max(0, (o.v - 0.7) / 0.3);
      for (const f of fades) f.set(fv);
    } }, at);
    tl.add(() => {
      for (const x of reveals) { x.r.material.dispose(); x.m.material = x.base; }
      for (const f of fades) { f.set(1); f.dispose(); }
      if (old) Rig.disposeCables(old);
    });
  }

  dispose() { this.finishAll(); for (const f of this.faders.values()) f.dispose(); this.faders.clear(); this.glassFader?.dispose(); }
}
