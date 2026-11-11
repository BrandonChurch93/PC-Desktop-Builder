import gsap from 'gsap';
import * as THREE from 'three';
import type { View } from './World';

/** After this long without input the tour takes the camera back. */
export const TOUR_IDLE_MS = 8000;
/** Before the first move, so entering Showcase settles on the frame it was given. */
const FIRST_MS = 2500;
/** Seconds for each move: a wide arc, a push toward the card, a rise past the cooler, a pass along the fans. */
const MOVES = [8, 7, 7, 7];

type Key = { pos: THREE.Vector3; target: THREE.Vector3 };

/**
 * The Showcase tour: a slow loop of camera moves through key frames built from the rig's own views, on one closed smooth path
 * for the position and one for the target, so the moves flow into each other. Any input takes the camera; after eight
 * seconds of none the tour glides back in from wherever the camera is.
 */
export class Tour {
  private tl: gsap.core.Timeline | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;

  constructor(private camera: THREE.PerspectiveCamera, private controls: { target: THREE.Vector3; update: () => boolean }, private views: () => Record<string, View>, private dirty: () => void) {}

  get running() { return !!this.tl; }

  /** Showcase on or off. Off stops the tour and its timer. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) { this.stop(); this.clearTimer(); return; }
    this.schedule(FIRST_MS);
  }

  /** Any input, or a programmatic camera move: the camera is the user's until they leave it alone. */
  input() {
    this.stop();
    if (this.enabled) this.schedule(TOUR_IDLE_MS);
  }

  private schedule(ms: number) {
    this.clearTimer();
    this.timer = setTimeout(() => { this.timer = null; if (this.enabled) this.start(); }, ms);
  }

  private clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  stop() { this.tl?.kill(); this.tl = null; }

  private keys(): Key[] | null {
    const v = this.views();
    const hero = v.hero;
    if (!hero) return null;
    const out: Key[] = [];
    // The wide arc: round the rig at the hero's height and distance, from left of the hero to well round the front.
    const off = hero.pos.clone().sub(hero.target);
    const r = Math.hypot(off.x, off.z) * 1.08; const az = Math.atan2(off.x, off.z); const y = off.y * 1.05;
    for (const a of [-0.55, 0.1, 0.75]) out.push({ pos: hero.target.clone().add(new THREE.Vector3(Math.sin(az + a) * r, y, Math.cos(az + a) * r)), target: hero.target.clone() });
    const add = (name: string, lift = 0) => { const k = v[name]; if (k) out.push({ pos: k.pos.clone().add(new THREE.Vector3(0, lift, 0)), target: k.target.clone() }); };
    add('gpu-wide');
    add('cooler-wide', -0.06);
    add('cooler-wide', 0.1);
    add('fan-wide', 0.05);
    add('fan-wide', -0.08);
    return out.length >= 4 ? out : null;
  }

  private start() {
    const keys = this.keys();
    if (!keys) return;
    // The loop begins where the camera is, so taking the camera back never jumps.
    const here: Key = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    const pos = new THREE.CatmullRomCurve3([here.pos, ...keys.map((k) => k.pos)], true, 'centripetal');
    const tgt = new THREE.CatmullRomCurve3([here.target, ...keys.map((k) => k.target)], true, 'centripetal');
    const total = MOVES.reduce((a, b) => a + b, 0);
    const p = { u: 0 };
    const tl = gsap.timeline({ repeat: -1, data: 'tour' });
    tl.to(p, {
      u: 1, duration: total, ease: 'none',
      onUpdate: () => {
        // Each stretch eases in and out of its key frames, so the moves breathe instead of gliding at one speed.
        const n = keys.length + 1; const f = p.u * n; const i = Math.floor(f); const k = f - i;
        const u = (i + k * k * (3 - 2 * k)) / n;
        pos.getPoint(u % 1, this.camera.position);
        tgt.getPoint(u % 1, this.controls.target);
        this.controls.update();
        this.dirty();
      },
    });
    this.tl = tl;
  }
}
