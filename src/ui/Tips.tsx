import { useEffect, useState } from 'react';
import s from './Tips.module.css';

type Tip = { text: string; x: number; y: number; below: boolean } | null;

/**
 * One tooltip for the whole interface: any element with data-tip shows it on hover and on keyboard focus. Icon buttons
 * carry their name here, and the disabled Power control its reason.
 */
export function Tips() {
  const [tip, setTip] = useState<Tip>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const show = (el: Element | null, delay: number) => {
      if (timer) clearTimeout(timer);
      const host = el?.closest('[data-tip]');
      const text = host?.getAttribute('data-tip');
      if (!host || !text) { setTip(null); return; }
      timer = setTimeout(() => {
        const r = host.getBoundingClientRect();
        const below = r.top < 64;
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
      }, delay);
    };
    const over = (e: PointerEvent) => { if (e.pointerType === 'mouse') show(e.target as Element, 350); };
    const focus = (e: FocusEvent) => { const t = e.target as Element; if (t.matches?.(':focus-visible')) show(t, 0); };
    const hide = () => { if (timer) clearTimeout(timer); setTip(null); };
    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 140), window.innerWidth - 140);
  return <div className={[s.tip, tip.below ? s.below : ''].join(' ')} style={{ left, top: tip.y }} role="tooltip">{tip.text}</div>;
}
