import type { KeyboardEvent, ReactNode } from 'react';
import type { Category } from '../data/catalog';
import { cardStatus } from '../engine/messages';
import type { Fit } from '../engine/queries';
import s from './PartCard.module.css';
import { useCardDrag } from './useCardDrag';

type Props = {
  category: Category;
  id: string;
  brand: string;
  name: string;
  numbers: string;
  thumb: string | null;
  fit: Fit;
  /** memory, storage and fans: how many of this one are in the build */
  count?: number;
  /** a status line that replaces the engine's, for cards that always add one more */
  statusOverride?: string;
  swatch?: string[];
  active?: boolean;
  held?: boolean;
  onActivate: (how: 'tap' | 'enter') => void;
  onPlace: () => void;
  onInspect: (() => void) | null;
  /** The user is about to want this part: build it ahead. */
  onIntent?: () => void;
  children?: ReactNode;
};

/** Thumbnail, brand and name, one line of numbers, one status line. The thumbnail is its own button and opens the Inspector. */
export function PartCard(p: Props) {
  const drag = useCardDrag(p.category, p.id, p.category !== 'cables' && p.fit.status !== 'installed');
  const status = p.statusOverride ?? cardStatus(p.fit);
  const tone = p.fit.status === 'blocked' ? s.blocked : p.fit.status === 'installed' || p.active ? s.installed : p.fit.preview ? s.warn : s.fits;
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.shiftKey) p.onPlace(); else p.onActivate('enter');
  };
  return (
    <article onPointerDown={(e) => { p.onIntent?.(); drag.onPointerDown(e); }} onPointerEnter={p.onIntent} onFocusCapture={p.onIntent} onClickCapture={drag.onClickCapture} className={[s.card, p.fit.status === 'installed' || p.active ? s.cardOn : '', p.fit.status === 'blocked' ? s.cardBlocked : '', p.held ? s.cardHeld : ''].join(' ')} data-part={`${p.category}:${p.id}`}>
      {p.swatch ? (
        <div className={s.swatch} aria-hidden="true">
          {p.swatch.map((c, i) => <span key={i} style={{ background: c }} />)}
        </div>
      ) : p.thumb && p.onInspect ? (
        <button type="button" className={s.thumb} onClick={p.onInspect} aria-label={`Inspect ${p.brand} ${p.name}`}>
          <img src={p.thumb} alt="" width={120} height={120} draggable={false} loading="lazy" decoding="async" />
        </button>
      ) : null}
      <button type="button" className={s.main} onClick={(e) => p.onActivate(e.detail === 0 ? 'enter' : 'tap')} onKeyDown={onKey}
        aria-describedby={`status-${p.category}-${p.id}`} aria-pressed={p.active}>
        <span className={s.brand}>{p.brand}</span>
        <span className={s.name}>{p.name}</span>
        <span className={s.numbers}>{p.numbers}</span>
      </button>
      <div className={s.foot}>
        <span id={`status-${p.category}-${p.id}`} className={[s.status, tone].join(' ')}>{status}</span>
        {p.count ? <span className={s.badge} aria-label={`${p.count} in the build`}>{p.count}</span> : null}
      </div>
      {p.children && <div className={s.extra}>{p.children}</div>}
    </article>
  );
}
