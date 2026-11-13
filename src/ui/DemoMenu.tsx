import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store } from '../state/store';
import { REELS, reelLength, type Reel } from '../world/reels';
import { getWorld } from './worldRef';
import s from './DemoMenu.module.css';

type Phase = 'closed' | 'menu' | 'playing' | 'ended';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
/** Keys the menu's own buttons need; every other key stops here while the menu or a reel is up. */
const MENU_KEYS = new Set(['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown']);

/**
 * The demo reels, for recording: the asterisk key opens the menu, which prepares every build and part the reels show. A
 * reel picked plays with the interface in view and the pointer hidden; Escape or the asterisk gives the bench back.
 */
export function DemoMenu() {
  const [phase, setPhase] = useState<Phase>('closed');
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const panel = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const close = () => { getWorld()?.director.end(); setPhase('closed'); };
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (e.key === '*' && !typing(e.target)) {
        e.preventDefault(); e.stopPropagation();
        if (p !== 'closed') { close(); return; }
        const overlay = store.getState().ui.overlay;
        const w = getWorld();
        if (!w || overlay === 'preload' || overlay === 'intro') return;
        w.director.begin();
        setProgress({ done: 0, total: 1 });
        setPhase('menu');
        void w.director.prepare(REELS, (done, total) => setProgress({ done, total })).catch((err: unknown) => console.error(err));
        return;
      }
      if (p === 'closed') return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (p !== 'menu' || !MENU_KEYS.has(e.key)) e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useLayoutEffect(() => {
    if (phase !== 'menu' || !panel.current) return;
    gsap.fromTo(panel.current, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }, [phase]);

  const ready = progress.done >= progress.total;
  const play = (r: Reel) => {
    const w = getWorld();
    if (!w || !ready) return;
    (document.activeElement as HTMLElement | null)?.blur();
    w.director.onEnd = () => setPhase('ended');
    w.director.play(r);
    setPhase('playing');
  };

  if (phase === 'closed') return null;
  if (phase !== 'menu') return <div className={s.shield} aria-hidden="true" onClick={() => { if (phaseRef.current === 'ended') { getWorld()?.director.end(); setPhase('closed'); } }} />;
  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-labelledby="demo-title">
      <div ref={panel} className={s.panel}>
        <p className={s.eyebrow}>For recording</p>
        <h2 id="demo-title" className={s.title}>Demo reels</h2>
        <p className={s.status} aria-live="polite">
          {ready ? 'Ready. Pick a reel and it plays at once. Escape gives the bench back.' : `Preparing the builds and parts · ${progress.done} of ${progress.total}`}
        </p>
        <div className={s.bar} aria-hidden="true"><span style={{ transform: `scaleX(${progress.done / progress.total})` }} /></div>
        <ul className={s.list}>
          {REELS.map((r, i) => (
            <li key={r.id}>
              <button type="button" className={s.reel} disabled={!ready} onClick={() => play(r)} data-reel={r.id}>
                <span className={s.index}>{i + 1}</span>
                <span className={s.text}>
                  <span className={s.name}>{r.name}</span>
                  <span className={s.blurb}>{r.blurb}</span>
                </span>
                <span className={s.length}>{Math.round(reelLength(r))} s</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
