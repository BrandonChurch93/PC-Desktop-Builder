import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LABELS, type LightTarget } from '../data/catalog';
import { litTargets } from './lit';
import { removePart } from '../state/actions';
import { store } from '../state/store';
import { useApp, useReducedMotion, useViewport } from './hooks';
import { Button } from './kit/Button';
import { setUi } from './uiActions';
import { getWorld } from './worldRef';
import s from './Hands.module.css';

/** Follows the pointer during a drag over a blocked place: one sentence, the rule's reason. */
export function ReasonLabel() {
  const r = useApp((st) => st.reason);
  if (!r?.text) return null;
  const left = Math.min(r.x + 18, window.innerWidth - 300);
  return <div className={s.reason} style={{ left, top: r.y + 18 }} role="status">{r.text}</div>;
}

const TARGET: Partial<Record<string, LightTarget>> = { case: 'case', board: 'board', cooler: 'cooler', ram: 'ram', gpu: 'gpu', fan: 'fans' };

/** A small popover anchored above the selected part: Inspect, Remove, Swap, Lighting. */
export function SelectionMenu() {
  const sel = useApp((st) => st.selected);
  const build = useApp((st) => st.build);
  const mode = useApp((st) => st.mode);
  const held = useApp((st) => st.held);
  const { layout } = useViewport();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const el = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!sel) { setAt(null); return; }
    let raf = 0;
    const tick = () => {
      const p = getWorld()?.hands.anchorOf(sel.key) ?? null;
      setAt((prev) => (p && prev && Math.abs(prev.x - p.x) < 0.5 && Math.abs(prev.y - p.y) < 0.5 ? prev : p));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [sel, build]);

  useLayoutEffect(() => {
    if (!sel || !el.current || reduced) return;
    gsap.fromTo(el.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' });
  }, [sel, reduced]);

  if (!sel || !at || mode !== 'build' || held) return null;
  const target = TARGET[sel.category];
  const item = getWorld()?.itemFor(sel.category, sel.opts);
  const id = item?.placed.id ?? '';
  const lightable = target ? litTargets(build).has(target) : false;
  const close = () => store.setState({ selected: null });
  const x = Math.min(Math.max(at.x, 150), window.innerWidth - 150);
  const y = Math.max(at.y - 12, layout === 'phone' ? 200 : 90);
  return (
    // Positioned by the outer box and animated on the inner one: a tween on the outer box would overwrite its translate.
    <div className={s.menuAt} style={{ left: x, top: y }}>
    <div ref={el} className={s.menu} role="menu" aria-label={`${LABELS.category[sel.category]} actions`}>
      <button role="menuitem" type="button" className={s.item} onClick={() => { if (id) store.setState({ inspect: { category: sel.category, id: sel.category === 'storage' ? String(sel.opts.type) : id, angle: 0, zoom: 0 } }); close(); }}>Inspect</button>
      <button role="menuitem" type="button" className={s.item} onClick={() => { removePart(sel.category, sel.opts as never); close(); }}>Remove</button>
      <button role="menuitem" type="button" className={s.item} onClick={() => { setUi({ swap: { category: sel.category, opts: sel.opts }, tab: sel.category }); close(); }}>Swap</button>
      <button role="menuitem" type="button" className={s.item} disabled={!lightable} onClick={() => { setUi({ lightTarget: target ?? null, side: layout === 'tablet' ? 'lighting' : store.getState().ui.side, sheet: layout === 'phone' ? 'half' : store.getState().ui.sheet, sheetTab: layout === 'phone' ? 'lighting' : store.getState().ui.sheetTab }); close(); }}>Lighting</button>
    </div>
    </div>
  );
}

/** Shown while the camera is focused on a part: back to where it was. */
export function ResetView() {
  const focus = useApp((st) => st.focus);
  if (!focus) return null;
  return (
    <div className={s.reset}>
      <Button variant="ghost" icon="arrowLeft" onClick={() => getWorld()?.resetView()}>Reset view</Button>
    </div>
  );
}

/** While swapping, a line says what the next card does. */
export function SwapHint() {
  const swap = useApp((st) => st.ui.swap);
  if (!swap) return null;
  return (
    <div className={s.swap} role="status">
      <span>Pick the {LABELS.category[swap.category].toLowerCase()} to swap in</span>
      <button type="button" className={s.swapCancel} onClick={() => setUi({ swap: null })}>Cancel</button>
    </div>
  );
}
