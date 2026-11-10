import gsap from 'gsap';
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from '../hooks';
import { Button } from './Button';
import s from './Dialog.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Centered, focus trapped, closes on Escape and on the backdrop, and returns focus to what opened it. */
export function Dialog({ title, onClose, children, wide, actions, labelHidden }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; actions?: ReactNode; labelHidden?: boolean }) {
  const id = useId();
  const box = useRef<HTMLDivElement | null>(null);
  const back = useRef<HTMLDivElement | null>(null);
  const opener = useRef<Element | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    opener.current = document.activeElement;
    const el = box.current;
    if (el) {
      const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? el).focus();
      if (!reduced) {
        gsap.fromTo(el, { opacity: 0, y: 12, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: 'power2.out' });
        if (back.current) gsap.fromTo(back.current, { opacity: 0 }, { opacity: 1, duration: 0.36, ease: 'power2.out' });
      }
    }
    return () => { const o = opener.current; if (o instanceof HTMLElement && document.contains(o)) o.focus(); };
  }, [reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0]!; const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div ref={back} className={s.backdrop} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className={[s.dialog, wide ? s.wide : ''].join(' ')} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className={s.head}>
          <h2 id={id} className={labelHidden ? 'sr-only' : s.title}>{title}</h2>
          <Button variant="icon" icon="close" label="Close" onClick={onClose} />
        </header>
        <div className={s.body}>{children}</div>
        {actions && <footer className={s.actions}>{actions}</footer>}
      </div>
    </div>
  );
}
