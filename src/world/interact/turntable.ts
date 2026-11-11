import type { Inspector } from '../inspector';

/** Degrees per second the turntable turns by itself, and how long after the last touch before it starts again. */
const SPIN = 9;
const RESUME_MS = 3000;
const DEG_PER_PX = 0.45;
const TILT_PER_PX = 0.006;
const TILT = { min: 0.04, max: 1.15 };
const ZOOM_PER_WHEEL = 0.0012;

/**
 * The Inspector's hands: drag to turn the part and tilt the view, wheel or pinch to zoom from the whole part to the closest
 * allowed view, and arrow keys and plus and minus for the same without a pointer. Left alone, the turntable turns slowly.
 */
export class Turntable {
  active = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private lastTouch = -Infinity;

  constructor(private el: HTMLElement, private insp: Inspector, private changed: () => void) {
    el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('keydown', this.key);
  }

  /** The slow turn, unless the clock is frozen or someone touched it a moment ago. */
  step(dt: number, frozen: boolean) {
    if (frozen) { this.insp.spin = 0; return false; }
    if (!this.active || this.pointers.size || performance.now() - this.lastTouch < RESUME_MS) return false;
    this.insp.spin = (this.insp.spin + SPIN * dt) % 360;
    return true;
  }

  private touch() { this.lastTouch = performance.now(); this.changed(); }

  private down = (e: PointerEvent) => {
    if (!this.active) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.el.setPointerCapture?.(e.pointerId);
    if (this.pointers.size === 2) this.pinch = this.spread();
    e.preventDefault();
    e.stopPropagation();
    this.touch();
  };

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!this.active || !p) return;
    if (this.pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const d = this.spread();
      if (this.pinch > 0) this.zoomBy((d - this.pinch) * 0.004);
      this.pinch = d;
    } else {
      this.insp.angle = (this.insp.angle + (e.clientX - p.x) * DEG_PER_PX) % 360;
      this.insp.elevation = Math.min(TILT.max, Math.max(TILT.min, this.insp.elevation + (e.clientY - p.y) * TILT_PER_PX));
      p.x = e.clientX; p.y = e.clientY;
    }
    this.touch();
  };

  private up = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    this.pinch = 0;
    this.touch();
  };

  private wheel = (e: WheelEvent) => {
    if (!this.active) return;
    e.preventDefault();
    this.zoomBy(-e.deltaY * ZOOM_PER_WHEEL);
    this.touch();
  };

  private key = (e: KeyboardEvent) => {
    if (!this.active) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.closest('[role="dialog"], button, [role="slider"]'))) return;
    const step: Record<string, () => void> = {
      ArrowLeft: () => { this.insp.angle -= 15; }, ArrowRight: () => { this.insp.angle += 15; },
      ArrowUp: () => { this.insp.elevation = Math.min(TILT.max, this.insp.elevation + 0.1); }, ArrowDown: () => { this.insp.elevation = Math.max(TILT.min, this.insp.elevation - 0.1); },
      '+': () => this.zoomBy(0.1), '=': () => this.zoomBy(0.1), '-': () => this.zoomBy(-0.1),
    };
    const f = step[e.key];
    if (!f) return;
    e.preventDefault();
    f();
    this.touch();
  };

  private zoomBy(d: number) { this.insp.zoom = Math.min(1, Math.max(0, this.insp.zoom + d)); }

  private spread() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
