import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { K } from '../data/catalog';
import { gradientBar, gradientCss } from './color';
import { Icon } from './icons';
import s from './GradientEditor.module.css';

type Props = {
  stops: string[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  /** live while a handle is dragged; commit once at the end */
  onChange: (stops: string[], commit: boolean) => void;
};

const DRAG_SLOP = 4;

const move = (list: string[], from: number, to: number) => {
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
};

/**
 * The stops are an ordered ring: the engine blends each into the next and back to the first. The bar shows that ring with
 * each stop at the middle of its share. A handle dragged along the bar moves its stop to the place it is dropped.
 */
export function GradientEditor({ stops, selected, onSelect, onChange }: Props) {
  const bar = useRef<HTMLDivElement | null>(null);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const n = stops.length;
  const canAdd = n < K.maxGradientStops;
  const canRemove = n > K.minGradientStops && selected !== null;

  const slotAt = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n)));
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (e.button > 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    let at = i; let list = stops; let dragging = false;
    const mv = (ev: globalThis.PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - x0) < DRAG_SLOP) return;
      dragging = true;
      const to = slotAt(ev.clientX);
      if (to === at) return;
      list = move(list, at, to); at = to;
      onChange(list, false); onSelect(at);
    };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      if (dragging && list !== stops) onChange(list, true);
      onSelect(dragging ? at : selected === i ? null : i);
      handles.current[at]?.focus();
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };

  const add = () => {
    if (!canAdd) return;
    const i = selected ?? n - 1;
    // The new stop takes the color the ring already shows halfway to the next stop, so adding it changes nothing until it is edited.
    const c = gradientCss(stops, (i + 0.5) / n);
    const next = [...stops.slice(0, i + 1), c, ...stops.slice(i + 1)];
    onChange(next, true); onSelect(i + 1);
    requestAnimationFrame(() => handles.current[i + 1]?.focus());
  };
  const removeSel = () => {
    if (!canRemove || selected === null) return;
    const next = stops.filter((_, k) => k !== selected);
    onChange(next, true);
    const to = Math.min(selected, next.length - 1);
    onSelect(to);
    requestAnimationFrame(() => handles.current[to]?.focus());
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (n > K.minGradientStops) { onSelect(i); const next = stops.filter((_, k) => k !== i); onChange(next, true); const to = Math.min(i, next.length - 1); onSelect(to); requestAnimationFrame(() => handles.current[to]?.focus()); } return; }
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const to = i + d;
    if (to < 0 || to >= n) return;
    if (e.altKey || e.shiftKey) { onChange(move(stops, i, to), true); }
    onSelect(to);
    handles.current[to]?.focus();
  };

  return (
    <div className={s.editor}>
      <div className={s.head}>
        <span className={s.label} id="colors-label">Colors</span>
        <span className={s.actions}>
          <button type="button" className={s.act} onClick={removeSel} disabled={!canRemove} aria-label="Remove the selected color"
            title={n <= K.minGradientStops ? `At least ${K.minGradientStops} colors` : undefined}><Icon name="minus" size={16} /></button>
          <button type="button" className={s.act} onClick={add} disabled={!canAdd} aria-label="Add a color"
            title={canAdd ? undefined : `At most ${K.maxGradientStops} colors`}><Icon name="plus" size={16} /></button>
        </span>
      </div>
      <div ref={bar} className={s.bar} style={{ backgroundImage: gradientBar(stops) }}>
        <div role="listbox" aria-labelledby="colors-label" aria-orientation="horizontal" className={s.handles}>
          {stops.map((c, i) => (
            <button key={`${i}-${c}`} ref={(el) => { handles.current[i] = el; }} type="button" role="option" aria-selected={selected === i}
              aria-label={`Color ${i + 1} of ${n}, ${c}`} tabIndex={(selected ?? 0) === i ? 0 : -1}
              className={[s.handle, selected === i ? s.handleOn : ''].join(' ')} style={{ left: `${((i + 0.5) / n) * 100}%`, background: c }}
              onPointerDown={(e) => onDown(e, i)} onClick={(e) => { if (e.detail === 0) onSelect(selected === i ? null : i); }} onKeyDown={(e) => onKey(e, i)} />
          ))}
        </div>
      </div>
    </div>
  );
}
