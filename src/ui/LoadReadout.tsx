import { forwardRef, useId } from 'react';
import { temps } from '../engine/sheet';
import { store } from '../state/store';
import { useApp } from './hooks';
import s from './LoadReadout.module.css';

/** The Load slider, then the simulated temperatures at that load. Shown whenever the power is on. */
export const LoadReadout = forwardRef<HTMLDivElement, { where: 'top' | 'under' | 'row' | 'bottom' }>(function LoadReadout({ where }, ref) {
  const id = useId();
  const load = useApp((st) => st.load);
  const build = useApp((st) => st.build);
  const t = temps(build, load);
  const pct = Math.round(load * 100);
  return (
    <div ref={ref} className={[s.readout, s[where]].join(' ')} role="group" aria-label="Load and simulated temperatures">
      <label htmlFor={id} className={s.label}>Load</label>
      <input id={id} type="range" min={0} max={100} step={1} value={pct} className={s.range} style={{ '--pct': `${pct}%` } as React.CSSProperties}
        aria-valuetext={`${pct} percent`} onChange={(e) => store.setState({ load: Number(e.target.value) / 100 })} />
      <span className={s.value}>{pct} percent</span>
      {(t.cpuC !== null || t.gpuC !== null) && <span className={s.sep} aria-hidden="true" />}
      {t.cpuC !== null && <span className={s.temp}>Processor <b>{t.cpuC} °C</b></span>}
      {t.cpuC !== null && t.gpuC !== null && <span className={s.dot} aria-hidden="true">·</span>}
      {t.gpuC !== null && <span className={s.temp}>Graphics <b>{t.gpuC} °C</b></span>}
      <span className={s.dot} aria-hidden="true">·</span>
      <span className={s.sim}>Simulated</span>
    </div>
  );
});
