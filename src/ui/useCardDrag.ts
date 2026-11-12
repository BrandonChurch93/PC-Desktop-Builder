import { useRef, type MouseEvent, type PointerEvent as RPointerEvent } from 'react';
import type { Category } from '../data/catalog';
import { DRAG_SLOP, LONG_PRESS } from '../world/interact/hands';
import { handOffRow, isRowScroll, leftRowUpward } from './dragScroll';
import { getWorld } from './worldRef';

/** How far a finger may wander during the press before it counts as a swipe of the card row instead, in CSS pixels. */
const PRESS_SLOP = 8;

/**
 * Picking a part up from its tray card: with a mouse the drag starts after a few pixels of movement, or, when the movement
 * runs sideways in a row that scrolls, once the hand leaves the row upward (dragScroll.ts); with a finger it starts
 * after a short press, so a quick swipe still scrolls the row. A drag swallows the click that would follow it.
 */
export function useCardDrag(category: Category, id: string, enabled: boolean) {
  const st = useRef<{ dragged: boolean } | null>(null);

  const onPointerDown = (e: RPointerEvent) => {
    if (!enabled || e.button !== 0) return;
    const card = e.currentTarget;
    let scrolling = false;
    const s = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, timer: null as ReturnType<typeof setTimeout> | null, dragged: false };
    st.current = s;
    const cleanup = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    };
    const start = (x: number, y: number) => { s.dragged = true; cleanup(); getWorld()?.hands.beginTray(category, id, x, y); };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== s.id) return;
      const d = Math.hypot(ev.clientX - s.x, ev.clientY - s.y);
      if (s.type === 'mouse') {
        // Sideways in a row with more to show scrolls the row, and the card rides along under the hand. Leaving the row
        // upward, toward the case, picks that card's part up, so a diagonal drag to the case still works.
        if (scrolling) { if (leftRowUpward(card, ev.clientY)) { handOffRow(card); start(ev.clientX, ev.clientY); } return; }
        if (d <= DRAG_SLOP) return;
        if (isRowScroll(card, ev.clientX - s.x, ev.clientY - s.y)) scrolling = true; else start(ev.clientX, ev.clientY);
      }
      else if (d > PRESS_SLOP) cleanup();
    };
    const up = () => cleanup();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (s.type !== 'mouse') s.timer = setTimeout(() => { s.timer = null; start(s.x, s.y); }, LONG_PRESS);
  };

  const onClickCapture = (e: MouseEvent) => {
    if (st.current?.dragged) { e.preventDefault(); e.stopPropagation(); }
    st.current = null;
  };

  return { onPointerDown, onClickCapture };
}
