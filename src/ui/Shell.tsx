import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { setUi } from './uiActions';
import { useApp, useReducedMotion, useViewport } from './hooks';
import { Button } from './kit/Button';
import { LightingPanel } from './LightingPanel';
import { LoadReadout } from './LoadReadout';
import { PhoneSheet } from './PhoneSheet';
import { SpecPanel } from './SpecPanel';
import { BrandBlock, Menu, ModeSwitch, QuickToggles, ShareButton, UndoRedo } from './TopBar';
import { Dock } from './Tray';
import { getWorld } from './worldRef';
import s from './Shell.module.css';

/** Measures what the interface covers, so the camera's view offset keeps the rig centered in the clear area. */
type Side = React.RefObject<HTMLElement | null> | null;
function useInsets(sides: { left?: Side; right?: Side; top?: Side; bottom?: Side }, deps: unknown[]) {
  useLayoutEffect(() => {
    const refs = { left: sides.left?.current ?? null, right: sides.right?.current ?? null, top: sides.top?.current ?? null, bottom: sides.bottom?.current ?? null };
    const els = Object.values(refs).filter((e): e is HTMLElement => !!e);
    let retry = 0;
    const measure = () => {
      const w = getWorld();
      if (!w) { retry = requestAnimationFrame(measure); return; }
      const W = window.innerWidth; const H = window.innerHeight;
      const r = (e?: HTMLElement | null) => (e && e.offsetParent !== null ? e.getBoundingClientRect() : null);
      const l = r(refs.left); const rt = r(refs.right); const t = r(refs.top); const b = r(refs.bottom);
      w.setInsets({ left: l ? l.right : 0, right: rt ? W - rt.left : 0, top: t ? t.bottom : 0, bottom: b ? H - b.top : 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const e of els) ro.observe(e);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(retry); ro.disconnect(); window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** On a mode change the panels that do not belong fade and move 12 px toward their edge. */
function useModeFade(el: React.RefObject<HTMLElement | null>, shown: boolean, dx: number, dy: number) {
  const reduced = useReducedMotion();
  const first = useRef(true);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    if (first.current) { first.current = false; gsap.set(node, { autoAlpha: shown ? 1 : 0, x: 0, y: 0 }); return; }
    if (reduced) { gsap.to(node, { autoAlpha: shown ? 1 : 0, x: 0, y: 0, duration: 0.12 }); return; }
    gsap.to(node, shown
      ? { autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: 'power2.out' }
      : { autoAlpha: 0, x: dx, y: dy, duration: 0.5, ease: 'power2.in' });
  }, [shown, reduced, el, dx, dy]);
}

function Desktop() {
  const mode = useApp((st) => st.mode);
  const hidden = useApp((st) => st.uiHidden || !!st.ui.overlay || !!st.inspect);
  const left = useRef<HTMLElement | null>(null); const right = useRef<HTMLElement | null>(null);
  const top = useRef<HTMLDivElement | null>(null); const bottom = useRef<HTMLDivElement | null>(null);
  const building = mode === 'build' && !hidden;
  useModeFade(left, building, -12, 0);
  useModeFade(right, building, 12, 0);
  useModeFade(bottom, building, 0, 12);
  useModeFade(top, !hidden, 0, -12);
  const power = useApp((st) => st.power);
  const readout = useRef<HTMLDivElement | null>(null);
  const lowReadout = power && !hidden && mode !== 'build';
  useInsets({ left: building ? left : null, right: building ? right : null, top: hidden ? null : top, bottom: building ? bottom : lowReadout ? readout : null }, [building, hidden, lowReadout]);
  return (
    <>
      <div ref={top} className={s.top}>
        <BrandBlock />
        <div className={s.centerCol}>
          <div className={s.center}>
            <UndoRedo />
            <span className={s.divider} aria-hidden="true" />
            <QuickToggles />
          </div>
          {power && !hidden && mode === 'build' && <LoadReadout where="top" />}
        </div>
        <div className={s.right}>
          <ModeSwitch />
          <ShareButton />
          <Menu />
        </div>
      </div>
      <aside ref={left} className={s.left} aria-label="Lighting"><LightingPanel /></aside>
      <aside ref={right} className={s.side} aria-label="Spec sheet"><SpecPanel /></aside>
      <div ref={bottom} className={s.bottom}><Dock /></div>
      {lowReadout && <LoadReadout ref={readout} where="bottom" />}
    </>
  );
}

function Tablet() {
  const mode = useApp((st) => st.mode);
  const side = useApp((st) => st.ui.side);
  const hidden = useApp((st) => st.uiHidden || !!st.ui.overlay || !!st.inspect);
  const power = useApp((st) => st.power);
  const top = useRef<HTMLDivElement | null>(null); const bottom = useRef<HTMLDivElement | null>(null);
  const sheet = useRef<HTMLElement | null>(null);
  const building = mode === 'build' && !hidden;
  useModeFade(bottom, building, 0, 12);
  useModeFade(top, !hidden, 0, -12);
  const readout = useRef<HTMLDivElement | null>(null);
  const lowReadout = power && !hidden && mode !== 'build';
  useInsets({ top: hidden ? null : top, bottom: building ? bottom : lowReadout ? readout : null, left: building && side === 'lighting' ? sheet : null, right: building && side === 'spec' ? sheet : null }, [building, hidden, side, lowReadout]);
  useEffect(() => {
    if (!side) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUi({ side: null }); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [side]);
  return (
    <>
      <div ref={top} className={[s.top, s.topSplit].join(' ')}>
        <BrandBlock />
        <div className={s.right}>
          <UndoRedo />
          <QuickToggles compact />
          <ModeSwitch />
          <ShareButton icon />
          <Menu />
        </div>
      </div>
      {building && !side && (
        <>
          <Button variant="icon" icon="lighting" label="Lighting" className={[s.edgeBtn, s.edgeLeft].join(' ')} onClick={() => setUi({ side: 'lighting' })} />
          <Button variant="icon" icon="spec" label="Spec sheet" className={[s.edgeBtn, s.edgeRight].join(' ')} onClick={() => setUi({ side: 'spec' })} />
        </>
      )}
      {building && side && (
        <aside ref={sheet} className={[s.sideSheet, side === 'lighting' ? s.sheetLeft : s.sheetRight, power ? s.sheetLow : ''].join(' ')} aria-label={side === 'lighting' ? 'Lighting' : 'Spec sheet'}>
          {side === 'lighting' ? <LightingPanel onClose={() => setUi({ side: null })} /> : <SpecPanel onClose={() => setUi({ side: null })} />}
        </aside>
      )}
      <div ref={bottom} className={s.bottom}><Dock /></div>
      {power && !hidden && mode === 'build' && <LoadReadout where="under" />}
      {lowReadout && <LoadReadout ref={readout} where="bottom" />}
    </>
  );
}

function Phone() {
  const { landscape } = useViewport();
  const hidden = useApp((st) => st.uiHidden || !!st.ui.overlay || !!st.inspect);
  const power = useApp((st) => st.power);
  const mode = useApp((st) => st.mode);
  const top = useRef<HTMLDivElement | null>(null);
  useModeFade(top, !hidden, 0, -12);
  useLayoutEffect(() => { if (hidden) getWorld()?.setInsets({ left: 0, right: 0, top: 0, bottom: 0 }); }, [hidden]);
  return (
    <>
      <div ref={top} className={s.phoneTop}>
        <div className={s.phoneRow}>
          <BrandBlock compact />
          <div className={s.group}><UndoRedo /><Menu /></div>
        </div>
        {!landscape && <ModeSwitch block />}
        <div className={s.phoneRow}>
          {landscape && <ModeSwitch />}
          <QuickToggles compact />
          <ShareButton icon />
        </div>
        {power && !hidden && mode === 'build' && <LoadReadout where="row" />}
      </div>
      {!hidden && <PhoneSheet topRef={top} />}
      {power && !hidden && mode !== 'build' && <LoadReadout where="bottom" />}
    </>
  );
}

export function Shell() {
  const { layout } = useViewport();
  const reduced = useReducedMotion();
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(reduced); }, [reduced]);
  return (
    <div className={s.shell} data-layout={layout}>
      {layout === 'desktop' ? <Desktop /> : layout === 'tablet' ? <Tablet /> : <Phone />}
    </div>
  );
}
