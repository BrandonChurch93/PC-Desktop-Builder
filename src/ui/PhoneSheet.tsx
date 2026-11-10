import gsap from 'gsap';
import { useCallback, useLayoutEffect, useRef, type PointerEvent as RPointerEvent, type RefObject } from 'react';
import { store, type SheetStop, type SheetTab } from '../state/store';
import { setUi } from './uiActions';
import { useApp, useReducedMotion, useViewport } from './hooks';
import { Icon } from './icons';
import { Segmented } from './kit/Controls';
import { LightingBody, SyncChip } from './LightingPanel';
import { SpecStats, SpecStatus } from './SpecPanel';
import { Button } from './kit/Button';
import { openDialog } from './uiActions';
import { CardRow, CategoryTabs } from './Tray';
import { getWorld } from './worldRef';
import s from './PhoneSheet.module.css';

const STOPS: SheetStop[] = ['peek', 'half', 'full'];

/** Heights of the three stops, in px, for a viewport height. Full is 90 percent of the height. */
export function stopHeights(h: number): Record<SheetStop, number> {
  return { peek: 268, half: Math.round(Math.max(380, h * 0.54)), full: Math.round(h * 0.9) };
}

function SheetBody({ tab, stop }: { tab: SheetTab; stop: SheetStop | 'side' }) {
  if (tab === 'specs') {
    return (
      <div className={s.specs}>
        <div className={s.specHead}><span className={s.eyebrow}>Spec sheet</span><SpecStatus /></div>
        <SpecStats />
        <Button variant="ghost" block onClick={() => openDialog('sheet')}>Open full sheet</Button>
      </div>
    );
  }
  if (tab === 'lighting') {
    return (
      <div className={s.lighting}>
        <div className={s.specHead}><span className={s.eyebrow}>Lighting</span><SyncChip /></div>
        <LightingBody />
      </div>
    );
  }
  return (
    <div className={s.parts}>
      <CategoryTabs idBase="sheet" />
      <CardRow idBase="sheet" wrap={stop === 'full' || stop === 'side'} />
    </div>
  );
}

const TABS: { value: SheetTab; label: string }[] = [{ value: 'parts', label: 'Parts' }, { value: 'specs', label: 'Specs' }, { value: 'lighting', label: 'Lighting' }];

/** The phone's bottom sheet with three stops and momentum, or in landscape a panel on the right 320 px wide. */
export function PhoneSheet({ topRef }: { topRef: RefObject<HTMLDivElement | null> }) {
  const { h, landscape } = useViewport();
  const stop = useApp((st) => st.ui.sheet);
  const tab = useApp((st) => st.ui.sheetTab);
  const mode = useApp((st) => st.mode);
  const reduced = useReducedMotion();
  const el = useRef<HTMLElement | null>(null);
  const drag = useRef<{ y0: number; h0: number; t: number; y: number; v: number } | null>(null);
  const heights = stopHeights(h);
  const shown = mode === 'build';

  const frame = useCallback((sheetH: number) => {
    const w = getWorld();
    const t = topRef.current?.getBoundingClientRect().bottom ?? 0;
    if (!w) { requestAnimationFrame(() => frame(sheetH)); return; }
    if (landscape) { const r = el.current?.getBoundingClientRect(); w.setInsets({ left: 0, right: shown && r ? window.innerWidth - r.left : 0, top: t, bottom: 0 }); return; }
    w.setInsets({ left: 0, right: 0, top: t, bottom: shown ? sheetH : 0 });
  }, [landscape, shown, topRef]);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    if (landscape) { gsap.set(node, { height: 'auto' }); frame(0); return; }
    const target = shown ? heights[stop] : 0;
    if (reduced) { gsap.set(node, { height: target }); frame(target); return; }
    gsap.to(node, { height: target, duration: 0.36, ease: 'power2.out', onUpdate: () => frame(node.getBoundingClientRect().height) });
  }, [stop, h, landscape, shown, reduced, heights.peek, heights.half, heights.full, frame]); // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e: RPointerEvent) => {
    if (landscape || !el.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, h0: el.current.getBoundingClientRect().height, t: performance.now(), y: e.clientY, v: 0 };
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current; const node = el.current;
    if (!d || !node) return;
    const now = performance.now();
    d.v = (e.clientY - d.y) / Math.max(1, now - d.t); d.y = e.clientY; d.t = now;
    const nh = Math.min(heights.full, Math.max(heights.peek - 40, d.h0 - (e.clientY - d.y0)));
    gsap.set(node, { height: nh });
    frame(nh);
  };
  const up = () => {
    const d = drag.current; const node = el.current;
    drag.current = null;
    if (!d || !node) return;
    // Momentum: project the flick 220 ms ahead, then settle on the nearest stop.
    const projected = node.getBoundingClientRect().height - d.v * 220;
    const best = STOPS.reduce((a, b) => (Math.abs(heights[b] - projected) < Math.abs(heights[a] - projected) ? b : a), 'peek' as SheetStop);
    if (best === store.getState().ui.sheet) gsap.to(node, { height: heights[best], duration: 0.36, ease: 'power2.out', onUpdate: () => frame(node.getBoundingClientRect().height) });
    else setUi({ sheet: best });
  };
  const step = (d: 1 | -1) => setUi({ sheet: STOPS[Math.min(2, Math.max(0, STOPS.indexOf(stop) + d))]! });

  if (landscape) {
    return (
      <aside ref={el} className={[s.side, shown ? '' : s.hiddenSide].join(' ')} aria-label="Build panel">
        <Segmented label="Panel" block value={tab} options={TABS} onChange={(t) => setUi({ sheetTab: t })} />
        <div className={s.scroll}><SheetBody tab={tab} stop="side" /></div>
      </aside>
    );
  }

  return (
    <section ref={el} className={s.sheet} aria-label="Build sheet" data-stop={stop} data-bottom-ui>
      <div className={s.handleRow} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <button type="button" className={s.handle} aria-label={stop === 'full' ? 'Lower the sheet' : 'Raise the sheet'}
          onClick={() => step(stop === 'full' ? -1 : 1)}
          onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); step(1); } if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); } }}>
          <span className={s.grip} aria-hidden="true" />
          <Icon name={stop === 'full' ? 'chevronDown' : 'chevronUp'} size={16} />
        </button>
      </div>
      {stop !== 'peek' && <div className={s.tabRow}><Segmented label="Panel" block value={tab} options={TABS} onChange={(t) => setUi({ sheetTab: t })} /></div>}
      <div className={s.scroll}><SheetBody tab={stop === 'peek' ? 'parts' : tab} stop={stop} /></div>
    </section>
  );
}
