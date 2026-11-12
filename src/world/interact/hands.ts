import gsap from 'gsap';
import * as THREE from 'three';
import type { Category } from '../../data/catalog';
import { socketsFor, type Socket } from '../../engine/queries';
import { installPart, removePart, say } from '../../state/actions';
import type { Store } from '../../state/store';
import { CASE_LAYOUTS } from '../layout/cases';
import type { Placed } from '../layout/place';
import { generate } from '../parts';
import { partCache, track } from '../parts/cache';
import type { PartObject } from '../parts/types';
import type { RigItem } from '../rig';
import type { World } from '../World';
import { itemsOfPart, partOf, pick } from './pick';
import { Sockets } from './sockets';

const MM = 0.001;
/** A mouse drag from the tray starts after this much movement, in CSS pixels. */
export const DRAG_SLOP = 6;
/** A touch drag from the tray starts after a press this long, in ms, so the card row still scrolls. */
export const LONG_PRESS = 250;
/** Holding still this long on an installed part lifts it out, so a drag elsewhere still orbits. */
const LIFT_PRESS = 350;
/** How far beyond its screen bounds a socket still catches the held part, in CSS pixels. */
const REACH = 28;
/** The held part follows the pointer on a plane this far in front of the glass, mm. */
const HOLD_PLANE = 80;
/** The preview pose stands short of home along the insertion axis, as the seat motion starts there. */
const PREVIEW_SHORT = 35;

type Ghost = { root: THREE.Group; parts: PartObject[]; keys: (string | null)[]; anchor: THREE.Vector3; center: THREE.Vector3; insert: THREE.Vector3; lifted: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] };

type Drag =
  | { kind: 'tray'; category: Category; id: string; sockets: Socket[]; near: number | null; x: number; y: number; ghost: Ghost | null; ghostSig: string }
  | { kind: 'part'; items: RigItem[]; homes: THREE.Vector3[]; start: THREE.Vector3; x: number; y: number; category: Category; opts: Record<string, unknown> };

/**
 * The hands in the scene: hovering and selecting installed parts, focusing on one, holding a part from the tray over its
 * places, dropping it in, and lifting an installed part out to remove it.
 */
export class Hands {
  readonly sockets: Sockets;
  private drag: Drag | null = null;
  private ghosts = new Map<string, Ghost>();
  private hover: RigItem | null = null;
  private down: { x: number; y: number; t: number; hit: RigItem | null; id: number; timer: ReturnType<typeof setTimeout> | null; grabbed: boolean } | null = null;
  private lastClick: { t: number; key: string } | null = null;
  private time = 0;

  constructor(private w: World, private store: Store) {
    this.sockets = new Sockets(w.post.overlayScene, w.rig.group);
    const el = w.canvas;
    el.addEventListener('pointerdown', this.onDown, { capture: true });
    el.addEventListener('pointermove', this.onHover);
    el.addEventListener('pointerleave', () => this.setHover(null));
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    // Once a drag has started, the page must not scroll under the finger.
    window.addEventListener('touchmove', (e) => { if (this.drag) e.preventDefault(); }, { passive: false });
    store.subscribe((s, prev) => {
      if (s.selected !== prev.selected || s.build !== prev.build) this.outlineSelection();
      if (s.held !== prev.held && !this.drag) this.showHeld();
      if (s.mode !== prev.mode || s.inspect !== prev.inspect) this.setHover(null);
    });
  }

  get dragging() { return this.drag !== null; }

  // ---- pointer ----------------------------------------------------------------------------------

  private ray(x: number, y: number): THREE.Ray {
    const r = this.w.canvas.getBoundingClientRect();
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.w.camera);
    return rc.ray;
  }

  private canTouch(): boolean {
    const s = this.store.getState();
    return s.mode === 'build' && !s.inspect && !s.ui.overlay && !s.uiHidden;
  }

  private onHover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons || this.drag || !this.canTouch()) return;
    const hit = pick(this.w.rig, this.ray(e.clientX, e.clientY));
    this.setHover(hit && hit.placed.kind !== 'case' ? hit : null);
    const sel = this.store.getState().selected;
    this.w.canvas.style.cursor = hit && sel && hit.placed.part === this.partKey(sel) ? 'grab' : hit && hit.placed.kind !== 'case' ? 'pointer' : '';
  };

  private setHover(item: RigItem | null) {
    if (item === this.hover) return;
    this.hover = item;
    const sel = this.store.getState().selected;
    const objs = item && (!sel || item.placed.part !== this.partKey(sel)) ? itemsOfPart(this.w.rig, item.placed.part).map((i) => i.holder) : [];
    this.w.post.hover.selectedObjects = objs;
    this.w.post.hover.enabled = objs.length > 0;
    this.w.markDirty();
  }

  private partKey(sel: { category: Category; opts: { index?: number; type?: string; mount?: string } }): string {
    const item = this.w.itemFor(sel.category, sel.opts);
    return item?.placed.part ?? '';
  }

  private outlineSelection() {
    const sel = this.store.getState().selected;
    const key = sel ? this.partKey(sel) : '';
    const objs = key ? itemsOfPart(this.w.rig, key).map((i) => i.holder) : [];
    this.w.post.select.selectedObjects = objs;
    this.w.post.select.enabled = objs.length > 0;
    if (this.hover && this.hover.placed.part === key) this.setHover(null);
    this.w.markDirty();
  }

  private onDown = (e: PointerEvent) => {
    if (!e.isPrimary || !this.canTouch()) return;
    const s = this.store.getState();
    // Placing by tap: a tap on a place puts the held part there.
    if (s.held && s.held.how !== 'drag') {
      const i = this.socketAt(e.clientX, e.clientY);
      if (i !== null) { e.stopImmediatePropagation(); e.preventDefault(); this.place(i); return; }
    }
    const hit = pick(this.w.rig, this.ray(e.clientX, e.clientY));
    const part = hit && hit.placed.kind !== 'case' ? hit : null;
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), hit, id: e.pointerId, timer: null, grabbed: false };
    if (!part) return;
    const sel = s.selected;
    if (sel && part.placed.part === this.partKey(sel)) {
      // The selected part moves at once: this drag is a hand on it, not an orbit.
      e.stopImmediatePropagation(); e.preventDefault();
      this.down.grabbed = true;
      return;
    }
    this.down.timer = setTimeout(() => { if (this.down && !this.drag) { this.w.controls.enabled = false; this.down.grabbed = true; this.beginPart(part, this.down.x, this.down.y); } }, LIFT_PRESS);
  };

  private onMove = (e: PointerEvent) => {
    const d = this.down;
    if (d && e.pointerId === d.id && !this.drag) {
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved > DRAG_SLOP && d.timer) { clearTimeout(d.timer); d.timer = null; }
      if (d.grabbed && moved > DRAG_SLOP && d.hit) this.beginPart(d.hit, d.x, d.y);
    }
    if (this.drag) { this.moveDrag(e.clientX, e.clientY); }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down; this.down = null;
    if (d?.timer) clearTimeout(d.timer);
    if (this.drag) { this.endDrag(); return; }
    this.w.controls.enabled = true;
    if (!d || e.pointerId !== d.id) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > DRAG_SLOP || performance.now() - d.t > 500 || !this.canTouch()) return;
    this.click(d.hit);
  };

  private onCancel = () => { if (this.down?.timer) clearTimeout(this.down.timer); this.down = null; if (this.drag) this.cancelDrag(); this.w.controls.enabled = true; };

  private click(hit: RigItem | null) {
    const s = this.store.getState();
    if (s.held) return;
    const now = performance.now();
    if (hit && this.lastClick && this.lastClick.key === hit.placed.part && now - this.lastClick.t < 380) {
      this.lastClick = null;
      this.w.focusOn(hit.placed.part);
      return;
    }
    this.lastClick = hit ? { t: now, key: hit.placed.part } : null;
    if (!hit) { if (s.selected) this.store.setState({ selected: null }); return; }
    const { category, opts } = partOf(hit.placed);
    this.store.setState({ selected: { category, key: hit.placed.part, opts } });
  }

  // ---- holding a part from the tray ---------------------------------------------------------

  /** Called by a tray card once its drag has started: the part follows the pointer over its places. */
  beginTray(category: Category, id: string, x: number, y: number) {
    const b = this.store.getState().build;
    const sockets = socketsFor(b, category, id);
    this.store.setState({ held: { category, id, how: 'drag', socket: null }, selected: null });
    this.drag = { kind: 'tray', category, id, sockets, near: null, x, y, ghost: null, ghostSig: '' };
    this.w.controls.enabled = false;
    this.w.choreo.hold(true);
    this.sockets.show(b, sockets);
    this.w.post.setOverlay(true);
    say(`Holding ${id}. ${sockets.filter((k) => k.ok).length} of ${sockets.length} places are free.`);
    this.moveDrag(x, y);
  }

  /** The hook's hold: the part held at a place's preview, valid or blocked, or held clear of them all. */
  holdAt(category: Category, id: string, socket?: number) {
    this.cancelDrag(true);
    const area = this.w.clearArea();
    this.beginTray(category, id, area.left + area.width * 0.14, area.top + area.height * 0.42);
    const d = this.drag;
    if (!d || d.kind !== 'tray' || socket === undefined) return;
    const v = this.sockets.views[socket];
    if (!v) return;
    const c = this.screenCenter(v.box);
    this.moveDrag(c.x, c.y, socket);
  }

  private showHeld() {
    const s = this.store.getState();
    if (s.held && s.held.how !== 'drag') {
      this.sockets.show(s.build, socketsFor(s.build, s.held.category, s.held.id));
      this.w.post.setOverlay(true);
      this.w.choreo.hold(true);
    } else if (!s.held && this.sockets.active) {
      this.sockets.clear();
      this.w.post.setOverlay(false);
      this.w.choreo.hold(false);
    }
    this.w.markDirty();
  }

  private plane(): number {
    const L = CASE_LAYOUTS[this.store.getState().build.case?.id ?? ''];
    return (L?.glass[0]?.outer ?? L?.outer.max[2] ?? 120) + HOLD_PLANE;
  }

  /** The pointer on the holding plane, in case space mm. */
  private onPlane(x: number, y: number, z = this.plane()): THREE.Vector3 {
    const ray = this.ray(x, y).applyMatrix4(new THREE.Matrix4().copy(this.w.rig.group.matrixWorld).invert());
    const p = new THREE.Vector3();
    return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), p) ?? p.set(0, 220, z);
  }

  private screenRect(box: THREE.Box3) {
    let l = Infinity; let r = -Infinity; let t = Infinity; let b = -Infinity;
    for (let i = 0; i < 8; i++) {
      const p = this.w.project([i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z]);
      l = Math.min(l, p.x); r = Math.max(r, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y);
    }
    const c = this.w.canvas.getBoundingClientRect();
    return { l: l + c.left, r: r + c.left, t: t + c.top, b: b + c.top };
  }

  private screenCenter(box: THREE.Box3) { const q = this.screenRect(box); return { x: (q.l + q.r) / 2, y: (q.t + q.b) / 2 }; }

  /** The place under the pointer, if any: the nearest whose screen bounds, grown by the reach, hold the pointer. */
  private socketAt(x: number, y: number): number | null {
    let best: { i: number; d: number } | null = null;
    this.sockets.views.forEach((v, i) => {
      const q = this.screenRect(v.box);
      if (x < q.l - REACH || x > q.r + REACH || y < q.t - REACH || y > q.b + REACH) return;
      const d = Math.hypot(x - (q.l + q.r) / 2, y - (q.t + q.b) / 2);
      if (!best || d < best.d) best = { i, d };
    });
    return (best as { i: number; d: number } | null)?.i ?? null;
  }

  private moveDrag(x: number, y: number, force?: number) {
    const d = this.drag;
    if (!d) return;
    d.x = x; d.y = y;
    if (d.kind === 'part') {
      const p = this.onPlane(x, y, d.start.z);
      const dv = p.clone().sub(d.start);
      d.items.forEach((it, i) => it.holder.position.copy(d.homes[i]!).add(dv));
      this.w.markDirty();
      return;
    }
    const near = force ?? this.socketAt(x, y);
    d.near = near;
    const view = near !== null ? this.sockets.views[near] : undefined;
    const placed = view?.placed.length ? view.placed : this.sockets.views.find((v) => v.socket.ok)?.placed ?? this.sockets.views[0]?.placed ?? [];
    const g = this.ghostFor(d.category, d.id, placed);
    if (g !== d.ghost) { if (d.ghost) d.ghost.root.visible = false; d.ghost = g; g.root.visible = true; }
    if (view) g.root.position.copy(g.anchor).addScaledVector(g.insert, -PREVIEW_SHORT);
    else g.root.position.copy(this.onPlane(x, y)).sub(g.center);
    const blocked = view && !view.socket.ok;
    const at = blocked ? (force !== undefined ? this.screenCenter(view.box) : { x, y }) : null;
    this.store.setState({ reason: blocked && at ? { text: view.socket.message ?? '', x: at.x, y: at.y } : null, held: { category: d.category, id: d.id, how: 'drag', socket: near } });
    this.w.markDirty();
  }

  private endDrag() {
    const d = this.drag;
    if (!d) return;
    this.w.controls.enabled = true;
    if (d.kind === 'part') { this.endPart(d); return; }
    const view = d.near !== null ? this.sockets.views[d.near] : undefined;
    if (view?.socket.ok) {
      this.clearHeld();
      this.w.choreo.fromPreview = true;
      installPart(d.category, d.id, view.socket.opts);
      return;
    }
    // Anywhere else the part goes back to the tray; over a blocked place it shakes first.
    const g = d.ghost;
    this.drag = null;
    this.store.setState({ reason: null });
    if (view) say(view.socket.message ?? '');
    if (!g) { this.clearHeld(); return; }
    const tl = gsap.timeline({ onUpdate: () => this.w.markDirty(), onComplete: () => this.clearHeld() });
    if (view) { const x0 = g.root.position.x; tl.to(g.root.position, { keyframes: [{ x: x0 + 7 }, { x: x0 - 7 }, { x: x0 + 5 }, { x: x0 - 4 }, { x: x0 }], duration: 0.28, ease: 'none' }); }
    tl.to(g.root.position, { y: g.root.position.y - 160, z: g.root.position.z + 120, duration: 0.35, ease: 'power2.in' });
  }

  private place(i: number) {
    const v = this.sockets.views[i];
    const s = this.store.getState();
    if (!v || !s.held) return;
    if (!v.socket.ok) { say(v.socket.message ?? ''); this.store.setState({ held: { ...s.held, socket: i } }); return; }
    this.store.setState({ held: null });
    installPart(s.held.category, s.held.id, v.socket.opts);
  }

  private clearHeld() {
    for (const g of this.ghosts.values()) this.disposeGhost(g);
    this.ghosts.clear();
    this.drag = null;
    this.sockets.clear();
    this.w.post.setOverlay(false);
    this.store.setState({ held: null, reason: null });
    this.w.choreo.hold(false);
    this.w.markDirty();
  }

  cancelDrag(quiet = false) {
    const d = this.drag;
    if (d?.kind === 'part') d.items.forEach((it, i) => it.holder.position.copy(d.homes[i]!));
    this.clearHeld();
    if (!quiet) say('Placing cancelled.');
  }

  // ---- the held model ---------------------------------------------------------------------------

  private ghostFor(category: Category, id: string, placed: Placed[]): Ghost {
    const sig = `${category}|${id}|${placed.map((p) => `${p.kind}:${p.id}:${JSON.stringify(this.w.rig.optsFor(p))}`).join(',')}`;
    let g = this.ghosts.get(sig);
    if (g) return g;
    const root = new THREE.Group(); root.name = 'held';
    const parts: PartObject[] = [];
    const keys: (string | null)[] = [];
    const anchor = placed[0] ? new THREE.Vector3(...placed[0].pose.pos) : new THREE.Vector3();
    const box = new THREE.Box3();
    if (placed.length) {
      for (const p of placed) {
        // The rig's own key: on a drop this very part goes into the rig, with nothing generated again.
        const key = `${p.kind}|${p.id}|${JSON.stringify(this.w.rig.optsFor(p))}`;
        const part = partCache.take(key) ?? track(generate(p.kind, p.id, this.w.rig.optsFor(p)));
        keys.push(key);
        const h = new THREE.Group();
        h.position.set(...p.pose.pos).sub(anchor); h.rotation.set(...p.pose.rot);
        h.add(part.root); root.add(h); parts.push(part);
        for (const b of p.boxes) { box.expandByPoint(new THREE.Vector3(...b.min).sub(anchor)); box.expandByPoint(new THREE.Vector3(...b.max).sub(anchor)); }
      }
    } else {
      const part = generate(category === 'cables' ? 'case' : category, id, {});
      root.add(part.root); parts.push(part); keys.push(null);
      box.setFromObject(part.root);
    }
    const lifted = liftExposure(root);
    this.w.rig.group.add(root);
    const insert = placed[0] ? new THREE.Vector3(...placed[0].insert).normalize() : new THREE.Vector3(0, 0, -1);
    g = { root, parts, keys, anchor, center: box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3()), insert, lifted };
    this.ghosts.set(sig, g);
    return g;
  }

  private disposeGhost(g: Ghost) {
    for (const l of g.lifted) { const m = l.mesh.material; l.mesh.material = l.original; (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); }
    g.root.removeFromParent();
    g.parts.forEach((p, i) => { const k = g.keys[i]; if (k) partCache.put(k, p); else p.dispose(); });
  }

  // ---- lifting an installed part out --------------------------------------------------------

  private beginPart(item: RigItem, x: number, y: number) {
    const items = itemsOfPart(this.w.rig, item.placed.part);
    const { category, opts } = partOf(item.placed);
    this.drag = { kind: 'part', items, homes: items.map((i) => i.holder.position.clone()), start: this.onPlane(x, y, item.holder.position.z), x, y, category, opts };
    this.w.controls.enabled = false;
    this.w.choreo.hold(true);
    this.store.setState({ selected: { category, key: item.placed.part, opts } });
    this.w.canvas.style.cursor = 'grabbing';
  }

  private endPart(d: Extract<Drag, { kind: 'part' }>) {
    this.drag = null;
    this.w.canvas.style.cursor = '';
    const L = CASE_LAYOUTS[this.store.getState().build.case?.id ?? ''];
    const q = L ? this.screenRect(new THREE.Box3(new THREE.Vector3(...L.outer.min), new THREE.Vector3(...L.outer.max))) : null;
    const outside = q ? d.x < q.l || d.x > q.r || d.y < q.t || d.y > q.b : true;
    if (outside) {
      this.w.choreo.hold(false);
      this.w.choreo.dropOut = true;
      this.store.setState({ selected: null });
      removePart(d.category, d.opts as never);
      return;
    }
    const tl = gsap.timeline({ onUpdate: () => this.w.markDirty(), onComplete: () => this.w.choreo.hold(false) });
    d.items.forEach((it, i) => tl.to(it.holder.position, { x: d.homes[i]!.x, y: d.homes[i]!.y, z: d.homes[i]!.z, duration: 0.35, ease: 'power2.out' }, 0));
  }

  // ---- each frame -----------------------------------------------------------------------------

  /** With the world's clock, so a frozen frame draws the same dashes every time. */
  update(time: number) {
    if (!this.sockets.active) return false;
    this.time = time;
    this.sockets.sync();
    const held = this.store.getState().held;
    this.sockets.update(this.time, held?.socket ?? null);
    return true;
  }

  /** The screen point above a part's bounds, for the selection menu. */
  anchorOf(part: string): { x: number; y: number } | null {
    const items = itemsOfPart(this.w.rig, part);
    if (!items.length) return null;
    const box = new THREE.Box3();
    for (const i of items) for (const b of i.placed.boxes) { box.expandByPoint(new THREE.Vector3(...b.min)); box.expandByPoint(new THREE.Vector3(...b.max)); }
    const q = this.screenRect(box);
    return { x: (q.l + q.r) / 2, y: q.t };
  }

  /** After the post chain is rebuilt for a new tier, the outlines are set again. */
  refresh() { this.outlineSelection(); this.setHover(null); }

  dispose() { this.clearHeld(); }
}

/** The held model reads a little brighter than the parts around it. */
/** Clones of a held part's materials with the exposure lifted, so it reads as picked up. The warm-up compiles them ahead. */
export function liftExposure(root: THREE.Object3D) {
  const out: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const original = o.material as THREE.Material | THREE.Material[];
    const list = Array.isArray(original) ? original : [original];
    const clones = list.map((m) => {
      const c = m.clone();
      const inner = m.onBeforeCompile; const key = m.customProgramCacheKey.bind(m);
      c.onBeforeCompile = (sh, r) => { inner.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight *= 1.22;\n#include <opaque_fragment>'); };
      c.customProgramCacheKey = () => `${key()}|held`;
      return c;
    });
    o.material = Array.isArray(original) ? clones : clones[0]!;
    out.push({ mesh: o, original });
  });
  return out;
}

export const mm = MM;
