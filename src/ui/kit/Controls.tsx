import gsap from 'gsap';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useReducedMotion } from '../hooks';
import { Icon } from '../icons';
import s from './Controls.module.css';

type Option<T extends string> = { value: T; label: string };

/** The mode switch: a radio group with arrow key movement. */
export function Segmented<T extends string>({ value, options, onChange, label, block }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string; block?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n]!.value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={[s.segmented, block ? s.block : ''].join(' ')}>
      {options.map((o, i) => (
        <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1}
          className={[s.segment, o.value === value ? s.segmentOn : ''].join(' ')} onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type TabItem<T extends string> = { value: T; label: string; badge?: number | 'dot' | null };

/** Category tabs. The active tab carries an accent underline; a tab shows a count or dot when its category has parts. */
export function Tabs<T extends string>({ value, items, onChange, label, idBase }: { value: T; items: TabItem<T>[]; onChange: (v: T) => void; label: string; idBase: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + items.length) % items.length;
    onChange(items[n]!.value);
    refs.current[n]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={s.tabs}>
      {items.map((t, i) => (
        <button key={t.value} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${idBase}-tab-${t.value}`} aria-controls={`${idBase}-panel`} aria-selected={t.value === value} tabIndex={t.value === value ? 0 : -1}
          className={[s.tab, t.value === value ? s.tabOn : ''].join(' ')} onClick={() => onChange(t.value)} onKeyDown={(e) => onKey(e, i)}>
          <span>{t.label}</span>
          {t.badge === 'dot' ? <span className={s.dot} aria-hidden="true" /> : t.badge ? <span className={s.count}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A number that counts to its new value over 400 ms, in tabular figures. */
export function Count({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const el = useRef<HTMLSpanElement | null>(null);
  const shown = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const from = shown.current;
    if (from === value || reduced) { shown.current = value; node.textContent = value.toFixed(decimals); return; }
    const o = { v: from };
    const t = gsap.to(o, { v: value, duration: 0.4, ease: 'power2.out', data: 'ui', onUpdate: () => { shown.current = o.v; node.textContent = o.v.toFixed(decimals); } });
    return () => { t.kill(); };
  }, [value, decimals, reduced]);
  return <span ref={el} className={s.num}>{value.toFixed(decimals)}</span>;
}

/** Eyebrow, large numeral, one line of detail. With nothing to show, a dash and what it waits for. */
export function Stat({ label, value, unit, decimals, detail, children }: { label: string; value: number | null; unit?: string; decimals?: number; detail: ReactNode; children?: ReactNode }) {
  return (
    <div className={s.stat}>
      <div className={s.eyebrow}>{label}</div>
      <div className={s.numeral}>
        {value === null ? <span className={s.num}>–</span> : <><Count value={value} decimals={decimals} />{unit && <span className={s.unit}>{unit}</span>}</>}
      </div>
      <div className={s.detail}>{detail}</div>
      {children}
    </div>
  );
}

/** Power load. The fill turns warn past the headroom ratio and danger past capacity. */
export function Meter({ value, warnAt, label }: { value: number; warnAt: number; label: string }) {
  const level = value > 1 ? 'danger' : value > warnAt ? 'warn' : 'ok';
  return (
    <div className={s.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className={[s.meterFill, s[level]].join(' ')} style={{ transform: `scaleX(${Math.min(1, Math.max(0, value))})` }} />
    </div>
  );
}

/** A slider that shows its value. onCommit fires once on release, so a drag is one history entry. */
export function Slider({ label, value, min, max, step, format, onChange, onCommit }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void; onCommit?: (v: number) => void }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={s.slider}>
      <div className={s.sliderHead}>
        <label htmlFor={id} className={s.sliderLabel}>{label}</label>
        <span className={s.sliderValue}>{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))} />
    </div>
  );
}

/** A count stepper: minus, the count, plus. */
export function Stepper({ value, label, onStep, canAdd, canRemove, addReason }: { value: number; label: string; onStep: (d: 1 | -1) => void; canAdd: boolean; canRemove: boolean; addReason?: string }) {
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button type="button" className={s.stepBtn} aria-label={`One fewer ${label}`} disabled={!canRemove} onClick={(e) => { e.stopPropagation(); onStep(-1); }}><Icon name="minus" size={18} /></button>
      <span className={s.stepValue} aria-live="off">{value}</span>
      <button type="button" className={s.stepBtn} aria-label={`One more ${label}`} title={canAdd ? undefined : addReason} disabled={!canAdd} onClick={(e) => { e.stopPropagation(); onStep(1); }}><Icon name="plus" size={18} /></button>
    </div>
  );
}
