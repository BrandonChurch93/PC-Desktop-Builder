import { useState } from 'react';
import { catalog, getEffect, LABELS, LIGHT_TARGETS, type LightTarget } from '../data/catalog';
import { applyLightingPreset, setLighting } from '../state/actions';
import { useApp } from './hooks';
import { Button, Chip } from './kit/Button';
import { Segmented, Slider } from './kit/Controls';
import { litTargets } from './lit';
import s from './LightingPanel.module.css';

const SPEED = catalog.lighting.speed;
const BRIGHT = catalog.lighting.brightness;

/** The eight effects. The active one carries the signature gradient, the one place it appears. */
export function EffectList() {
  const effect = useApp((st) => st.build.lighting.effect);
  return (
    <div role="radiogroup" aria-label="Effect" className={s.effects}>
      {catalog.lighting.effects.map((e) => (
        <button key={e.id} type="button" role="radio" aria-checked={e.id === effect} className={[s.effect, e.id === effect ? s.effectOn : ''].join(' ')}
          onClick={() => setLighting({ effect: e.id })}>{e.name}</button>
      ))}
    </div>
  );
}

/** Speed, brightness and direction. A slider drag is one history entry, pushed on release. */
export function LightingControls() {
  const l = useApp((st) => st.build.lighting);
  const fx = getEffect(l.effect);
  const [drag, setDrag] = useState<{ speed?: number; brightness?: number }>({});
  const live = (patch: { speed?: number; brightness?: number }) => { setDrag((d) => ({ ...d, ...patch })); setLighting(patch, false); };
  const commitDrag = (patch: { speed?: number; brightness?: number }) => { setDrag({}); setLighting(patch, true); };
  return (
    <div className={s.controls}>
      {fx?.usesSpeed && (
        <Slider label="Speed" min={SPEED.min} max={SPEED.max} step={1} value={drag.speed ?? l.speed} format={(v) => String(Math.round(v))}
          onChange={(v) => live({ speed: v })} onCommit={(v) => commitDrag({ speed: v })} />
      )}
      <Slider label="Brightness" min={BRIGHT.min} max={BRIGHT.max} step={1} value={drag.brightness ?? l.brightness} format={(v) => `${Math.round(v)} percent`}
        onChange={(v) => live({ brightness: v })} onCommit={(v) => commitDrag({ brightness: v })} />
      {fx?.usesSpeed && (
        <div className={s.column}>
          <span className={s.label}>Direction</span>
          <Segmented label="Direction" block value={l.direction === 1 ? 'fwd' : 'rev'} onChange={(v) => setLighting({ direction: v === 'fwd' ? 1 : -1 })}
            options={[{ value: 'fwd', label: 'Forward' }, { value: 'rev', label: 'Reverse' }]} />
        </div>
      )}
    </div>
  );
}

export function PresetRow() {
  return (
    <div className={s.presets} role="group" aria-label="Lighting presets">
      {catalog.lighting.presets.map((p) => (
        <button key={p.id} type="button" className={s.preset} onClick={() => applyLightingPreset(p.id)}>
          <span className={s.presetSwatch} style={{ background: `linear-gradient(90deg, ${p.stops.join(', ')})` }} aria-hidden="true" />
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** Each target: following the main profile, its own, or off. Targets with no lit part in the build are disabled. */
export function TargetList() {
  const build = useApp((st) => st.build);
  const lit = litTargets(build);
  const state = (t: LightTarget) => { const o = build.lighting.overrides[t]; return o === undefined ? 'Synced' : o === 'off' ? 'Off' : 'Own profile'; };
  return (
    <ul className={s.targets} aria-label="Lighting targets">
      {LIGHT_TARGETS.map((t) => (
        <li key={t} className={[s.target, lit.has(t) ? '' : s.targetOff].join(' ')} aria-disabled={!lit.has(t)}>
          <span>{LABELS.lightTarget[t]}</span>
          <span className={s.targetState}>{lit.has(t) ? state(t) : 'Nothing lit'}</span>
        </li>
      ))}
    </ul>
  );
}

/** On while every target follows the main profile. Turning it on clears every override. */
export function SyncChip() {
  const synced = useApp((st) => Object.keys(st.build.lighting.overrides).length === 0);
  return <Chip on={synced} onChange={(on) => { if (on) setLighting({ overrides: {} }); }} disabled={synced}>Synced</Chip>;
}

export function LightingBody() {
  return (
    <div className={s.body}>
      <EffectList />
      <LightingControls />
      <div>
        <div className={s.sub}>Presets</div>
        <PresetRow />
      </div>
      <div>
        <div className={s.sub}>Targets</div>
        <TargetList />
      </div>
    </div>
  );
}

export function LightingPanel({ onClose }: { onClose?: () => void }) {
  return (
    <section className={s.panel} aria-labelledby="lighting-title">
      <header className={s.head}>
        <h2 id="lighting-title" className={s.eyebrow}>Lighting</h2>
        <span className={s.headEnd}><SyncChip />{onClose && <Button variant="icon" icon="close" label="Close lighting" onClick={onClose} />}</span>
      </header>
      <LightingBody />
    </section>
  );
}
