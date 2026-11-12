import gsap from 'gsap';
import { useEffect, type RefObject } from 'react';
import { store } from '../state/store';
import { DRAG_SLOP } from '../world/interact/hands';

/** Marks a row that scrolls sideways under a mouse drag. */
const ATTR = 'data-drag-scroll';
/** How far the row keeps travelling after release, as milliseconds of the release speed. */
const GLIDE_MS = 260;
const GLIDE_S = 0.45;
/** Only pointer samples this recent count toward the release speed. */
const SPEED_WINDOW = 90;

export const canScrollX = (el: Element) => el.scrollWidth > el.clientWidth + 1;

/**
 * A mouse drag past the slop is a scroll of its row when it runs more across than up or down and the row has more to show.
 * A card's own drag asks this at the same move event, so the two never both start.
 */
export function isRowScroll(from: Element, dx: number, dy: number): boolean {
  const row = from.closest(`[${ATTR}]`);
  return !!row && canScrollX(row) && Math.abs(dx) > Math.abs(dy);
}

const handOffs = new WeakMap<Element, () => void>();

/** True once a hand that is scrolling a row has left it upward, toward the case: the scroll becomes a pick up. */
export function leftRowUpward(from: Element, y: number): boolean {
  const row = from.closest(`[${ATTR}]`);
  return !!row && y < row.getBoundingClientRect().top;
}

/** The row stops following the hand and comes to rest on a card, as a card's own drag takes over. */
export function handOffRow(from: Element) {
  const row = from.closest(`[${ATTR}]`);
  if (row) handOffs.get(row)?.();
}

/** The scroll position at which the child nearest to left sits where scroll snapping would put it. */
function snapLeft(el: HTMLElement, left: number): number {
  const max = el.scrollWidth - el.clientWidth;
  const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  const base = el.getBoundingClientRect().left - el.scrollLeft;
  let best = left;
  let gap = Infinity;
  for (const c of el.children) {
    const at = c.getBoundingClientRect().left - base - pad;
    if (Math.abs(at - left) < gap) { gap = Math.abs(at - left); best = at; }
  }
  if (max - left < gap) best = max;
  return Math.max(0, Math.min(max, best));
}

/**
 * A row that overflows scrolls with a mouse as touch already scrolls it: hold and drag sideways, let go and it glides to rest
 * on a card's edge, and a vertical wheel turns into a sideways scroll. A drag that scrolled swallows the click that follows it.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute(ATTR, '');
    let scrolled = false;
    let glide: gsap.core.Tween | null = null;
    let stop: (() => void) | null = null;
    const release = () => { delete el.dataset.dragging; };

    const down = (e: PointerEvent) => {
      scrolled = false;
      if (e.pointerType !== 'mouse' || e.button !== 0 || !canScrollX(el)) return;
      glide?.kill(); glide = null; release();
      stop?.();
      const x0 = e.clientX; const y0 = e.clientY; const left0 = el.scrollLeft;
      const samples: { x: number; t: number }[] = [];
      let active = false;
      const end = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
        handOffs.delete(el);
        stop = null;
      };
      const rest = (speed: number) => {
        const to = snapLeft(el, el.scrollLeft - speed * GLIDE_MS);
        if (store.getState().reducedMotion) { el.scrollLeft = to; release(); return; }
        glide = gsap.to(el, { scrollLeft: to, duration: GLIDE_S, ease: 'power3.out', onComplete: () => { glide = null; release(); } });
      };
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        const dx = ev.clientX - x0; const dy = ev.clientY - y0;
        if (!active) {
          if (Math.hypot(dx, dy) <= DRAG_SLOP) return;
          if (Math.abs(dx) <= Math.abs(dy)) { end(); return; }
          active = true; scrolled = true;
          el.dataset.dragging = '';
        }
        ev.preventDefault();
        el.scrollLeft = left0 - dx;
        samples.push({ x: ev.clientX, t: ev.timeStamp });
        while (samples.length > 2 && ev.timeStamp - samples[0]!.t > SPEED_WINDOW) samples.shift();
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        end();
        if (!active) return;
        const a = samples[0]; const b = samples[samples.length - 1];
        rest(a && b && b.t - a.t > 0 && ev.timeStamp - b.t < SPEED_WINDOW ? (b.x - a.x) / (b.t - a.t) : 0);
      };
      const cancel = (ev: PointerEvent) => { if (ev.pointerId !== e.pointerId) return; end(); release(); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      handOffs.set(el, () => { end(); if (active) rest(0); });
      stop = end;
    };

    const click = (e: MouseEvent) => {
      if (!scrolled) return;
      scrolled = false;
      e.preventDefault(); e.stopPropagation();
    };

    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || !canScrollX(el) || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      glide?.kill(); glide = null; release();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
      el.scrollBy({ left: e.deltaY * k, behavior: store.getState().reducedMotion ? 'instant' as ScrollBehavior : 'smooth' });
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('click', click, { capture: true });
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('click', click, { capture: true });
      el.removeEventListener('wheel', wheel);
      stop?.(); glide?.kill(); release();
      el.removeAttribute(ATTR);
    };
  }, [ref]);
}
