import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dismissNotice, emptyBench, undo } from '../state/actions';
import { useApp, useReducedMotion } from './hooks';
import { Button } from './kit/Button';
import s from './Notice.module.css';


/** Sits 12 px above whatever covers the bottom: the dock, the phone sheet, or the window edge. */
function useBottom(active: boolean) {
  const [bottom, setBottom] = useState(40);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const el = document.querySelector('[data-bottom-ui]');
      const r = el && (el as HTMLElement).offsetParent !== null ? el.getBoundingClientRect() : null;
      setBottom(r && r.height > 0 ? window.innerHeight - r.top + 12 : 40);
    };
    measure();
    const el = document.querySelector('[data-bottom-ui]');
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [active]);
  return bottom;
}

/** Bottom center. Stays until dismissed when it has an action, five seconds otherwise. */
export function Notice() {
  const n = useApp((st) => st.notice);
  const offset = useBottom(!!n);
  const el = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!n || n.action) return;
    const t = setTimeout(dismissNotice, 5000);
    return () => clearTimeout(t);
  }, [n]);

  useLayoutEffect(() => {
    if (!n || !el.current || reduced) return;
    gsap.fromTo(el.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power2.out' });
  }, [n, reduced]);

  if (!n) return null;
  return (
    <div ref={el} className={s.notice} style={{ bottom: offset }} role={n.action ? 'alertdialog' : 'status'} aria-labelledby={`notice-${n.id}`}>
      <div className={s.text}>
        <div id={`notice-${n.id}`} className={s.title}>{n.title}</div>
        {n.lines.length > 0 && <ul className={[s.lines, n.lines.length > 4 ? s.columns : ''].join(' ')}>{n.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
      </div>
      <div className={s.actions}>
        {n.action === 'undo' && <Button variant="primary" onClick={undo}>Undo</Button>}
        {n.action === 'empty' && <Button variant="primary" onClick={() => { emptyBench(); dismissNotice(); }}>Start from an empty bench</Button>}
        <Button variant="icon" icon="close" label="Dismiss" onClick={dismissNotice} />
      </div>
    </div>
  );
}
