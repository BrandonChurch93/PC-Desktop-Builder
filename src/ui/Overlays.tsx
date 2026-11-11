import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { catalog, getCase, K, LABELS } from '../data/catalog';
import { emptyBench, installPart, loadPreset, removePart, updateSettings } from '../state/actions';
import { fitOf } from '../engine/queries';
import { store } from '../state/store';
import { setUi } from './uiActions';
import { useApp, useReducedMotion } from './hooks';
import { Button } from './kit/Button';
import { partName } from '../state/actions';
import { specRows } from './parts';
import s from './Overlays.module.css';

const BASE = import.meta.env.BASE_URL;

const leaveOverlay = () => { setUi({ overlay: null }); updateSettings({ introSeen: true }); };

/** After the intro: start with the house build, start empty, or pick one of the six preset builds. */
export function StartOverlay() {
  const overlay = useApp((st) => st.ui.overlay);
  const el = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (overlay !== 'start' || !el.current) return;
    el.current.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    if (!reduced) gsap.fromTo(el.current.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06 });
  }, [overlay, reduced]);
  if (overlay !== 'start') return null;
  return (
    <div className={s.start} role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div ref={el} className={s.startInner}>
        <h1 id="start-title" className={s.title}>{K.productName}</h1>
        <p className={s.subtitle}>Build it part by part.</p>
        <div className={s.buttons}>
          <Button variant="primary" data-autofocus onClick={leaveOverlay}>Start with this build</Button>
          <Button variant="ghost" onClick={() => { emptyBench(); leaveOverlay(); }}>Start from an empty bench</Button>
        </div>
        <h2 className={s.section}>Or pick a build</h2>
        <ul className={s.presets}>
          {catalog.presets.map((p) => {
            const c = getCase(p.build.case.id);
            return (
              <li key={p.id}>
                <button type="button" className={s.preset} onClick={() => { loadPreset(p.id); leaveOverlay(); }}>
                  <img src={`${BASE}thumbs/case-${p.build.case.id}-${p.build.case.finish}.jpg`} alt="" width={72} height={72} />
                  <span className={s.presetText}>
                    <span className={s.presetName}>{p.name}</span>
                    <span className={s.presetBlurb}>{p.blurb}</span>
                    <span className={s.presetMeta}>{c ? `${partName('case', c.id)} · ${LABELS.finish[p.build.case.finish as keyof typeof LABELS.finish]}` : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** The intro's still: the name and the subtitle over the house build. Any input skips it. The full sequence comes with the camera work. */
export function Intro() {
  const overlay = useApp((st) => st.ui.overlay);
  const reduced = useReducedMotion();
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (overlay !== 'intro') return;
    const skip = () => setUi({ overlay: 'start' });
    const t = setTimeout(skip, reduced ? 1800 : 6000);
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    if (el.current && !reduced) gsap.fromTo(el.current.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out', stagger: 0.4, delay: 0.4 });
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', skip); window.removeEventListener('keydown', skip); };
  }, [overlay, reduced]);
  if (overlay !== 'intro') return null;
  return (
    <div ref={el} className={s.intro} aria-live="polite">
      <h1 className={s.title}>{K.productName}</h1>
      <p className={s.subtitle}>Build it part by part.</p>
    </div>
  );
}

/** The empty bench invites the first step. */
export function EmptyHint() {
  const empty = useApp((st) => !st.build.case && st.mode === 'build' && !st.ui.overlay);
  if (!empty) return null;
  return <p className={s.empty}>Pick a case to begin</p>;
}

/** The Inspector's interface: the part's name, numbers, install or remove, and close. Orbit and zoom live in the scene. */
export function InspectorBar() {
  const insp = useApp((st) => st.inspect);
  const build = useApp((st) => st.build);
  const hidden = useApp((st) => st.uiHidden);
  useEffect(() => {
    if (!insp) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); store.setState({ inspect: null }); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [insp]);
  if (!insp || hidden) return null;
  const fit = fitOf(build, insp.category, insp.id);
  const rows = specRows(insp.category, insp.id);
  return (
    <div className={s.inspector} role="region" aria-label="Inspector">
      <div className={s.inspHead}>
        <div className={s.inspText}>
          <div className={s.inspEyebrow}>{LABELS.category[insp.category]}</div>
          <div className={s.inspName}>{partName(insp.category, insp.id)}</div>
          {fit.status === 'blocked' && <div className={s.inspBlocked}>{fit.message}</div>}
        </div>
        <div className={s.inspActions}>
          {fit.status === 'installed'
            ? <Button variant="ghost" onClick={() => removePart(insp.category)}>Remove</Button>
            : <Button variant="primary" disabled={fit.status === 'blocked'} onClick={() => { const r = installPart(insp.category, insp.id); if (r.ok) store.setState({ inspect: null }); }}>Install</Button>}
          <Button variant="icon" icon="close" label="Close the Inspector" onClick={() => store.setState({ inspect: null })} />
        </div>
      </div>
      {rows.length > 0 && (
        <dl className={s.inspSpecs}>
          {rows.map(([k, v]) => <div key={k} className={s.inspRow}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
      <p className={s.inspHint}>Drag to turn · scroll or pinch to zoom</p>
    </div>
  );
}

/** A shared link landing: Showcase with the build's name and a way to start editing it. */
export function SharedBanner() {
  const shared = useApp((st) => st.ui.shared);
  const hidden = useApp((st) => st.uiHidden);
  if (shared === null || hidden) return null;
  return (
    <div className={s.shared} role="region" aria-label="Shared build">
      <span className={s.sharedText}>Shared build · {shared}</span>
      <Button variant="primary" onClick={() => { setUi({ shared: null }); store.setState({ mode: 'build' }); }}>Make it yours</Button>
    </div>
  );
}

/** The polite live region: one sentence for each build action. */
export function LiveRegion() {
  const text = useApp((st) => st.announce);
  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{text}</div>;
}
