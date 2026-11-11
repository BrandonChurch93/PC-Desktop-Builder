import { useEffect, useRef, useState, type FormEvent } from 'react';
import { catalog, getEffect, K, LABELS, LIGHT_TARGETS, type LightTarget } from '../data/catalog';
import { USES_DIRECTION } from '../engine/lighting';
import { profileFromPreset } from '../engine/sanitize';
import type { Profile } from '../engine/types';
import { applyProfileTo, deleteProfile, pushRecentColor, saveProfile, scopeProfile, setLighting, setScopeLighting, setTargetMode } from '../state/actions';
import { ColorPicker } from './ColorPicker';
import { GradientEditor } from './GradientEditor';
import { useApp } from './hooks';
import { Icon } from './icons';
import { Button, Chip } from './kit/Button';
import { Segmented, Slider } from './kit/Controls';
import { litTargets } from './lit';
import { setUi } from './uiActions';
import s from './LightingPanel.module.css';

const SPEED = catalog.lighting.speed;
const BRIGHT = catalog.lighting.brightness;

type TargetMode = 'synced' | 'own' | 'off';
const MODE_LABEL: Record<TargetMode, string> = { synced: 'Synced', own: 'Own profile', off: 'Off' };

/** The target the panel edits, when it still has a lit part, and the profile it shows. */
function useScope() {
  const build = useApp((st) => st.build);
  const chosen = useApp((st) => st.ui.lightTarget);
  const lit = litTargets(build);
  const target = chosen && lit.has(chosen) ? chosen : null;
  const o = target ? build.lighting.overrides[target] : undefined;
  const mode: TargetMode = o === undefined ? 'synced' : o === 'off' ? 'off' : 'own';
  return { target, mode, profile: scopeProfile(build.lighting, target), lit };
}

const sameProfile = (a: Profile, b: Profile) => a.effect === b.effect && a.speed === b.speed && a.brightness === b.brightness && a.direction === b.direction && a.stops.join() === b.stops.join();

/** The eight effects. The active one carries the signature gradient, the one place it appears. */
export function EffectList({ target, profile }: { target: LightTarget | null; profile: Profile }) {
  return (
    <div role="radiogroup" aria-label="Effect" className={s.effects}>
      {catalog.lighting.effects.map((e) => (
        <button key={e.id} type="button" role="radio" aria-checked={e.id === profile.effect} className={[s.effect, e.id === profile.effect ? s.effectOn : ''].join(' ')}
          onClick={() => setScopeLighting(target, { effect: e.id })}>{e.name}</button>
      ))}
    </div>
  );
}

function Colors({ target, profile }: { target: LightTarget | null; profile: Profile }) {
  const stop = useApp((st) => st.ui.stop);
  const recent = useApp((st) => st.recentColors);
  const box = useRef<HTMLDivElement | null>(null);
  const open = stop !== null && stop < profile.stops.length ? stop : null;
  // The bar and the picker open together in view: the stop being edited stays visible above its picker.
  useEffect(() => { if (open !== null) box.current?.scrollIntoView({ block: 'start' }); }, [open]);
  return (
    <div ref={box} className={s.colors}>
      <GradientEditor stops={profile.stops} selected={open} onSelect={(i) => setUi({ stop: i })}
        onChange={(stops, commit) => setScopeLighting(target, { stops }, commit)} />
      {open !== null && (
        <div>
          <ColorPicker label={`Color ${open + 1}`} value={profile.stops[open]!} recent={recent}
            onChange={(hex, commit) => {
              const stops = [...profile.stops]; stops[open] = hex;
              setScopeLighting(target, { stops }, commit);
              if (commit) pushRecentColor(hex);
            }} />
        </div>
      )}
    </div>
  );
}

/** Speed, brightness and direction. A slider drag is one history entry, pushed on release. */
export function LightingControls({ target, profile }: { target: LightTarget | null; profile: Profile }) {
  const fx = getEffect(profile.effect);
  const [drag, setDrag] = useState<{ speed?: number; brightness?: number }>({});
  useEffect(() => { setDrag({}); }, [target]);
  const live = (patch: { speed?: number; brightness?: number }) => { setDrag((d) => ({ ...d, ...patch })); setScopeLighting(target, patch, false); };
  const commitDrag = (patch: { speed?: number; brightness?: number }) => { setDrag({}); setScopeLighting(target, patch, true); };
  return (
    <div className={s.controls}>
      {fx?.usesSpeed && (
        <Slider label="Speed" min={SPEED.min} max={SPEED.max} step={1} value={drag.speed ?? profile.speed} format={(v) => String(Math.round(v))}
          onChange={(v) => live({ speed: v })} onCommit={(v) => commitDrag({ speed: v })} />
      )}
      <Slider label="Brightness" min={BRIGHT.min} max={BRIGHT.max} step={1} value={drag.brightness ?? profile.brightness} format={(v) => `${Math.round(v)} percent`}
        onChange={(v) => live({ brightness: v })} onCommit={(v) => commitDrag({ brightness: v })} />
      {fx?.usesSpeed && USES_DIRECTION.has(profile.effect) && (
        <div className={s.column}>
          <span className={s.label}>Direction</span>
          <Segmented label="Direction" block value={profile.direction === 1 ? 'fwd' : 'rev'} onChange={(v) => setScopeLighting(target, { direction: v === 'fwd' ? 1 : -1 })}
            options={[{ value: 'fwd', label: 'Forward' }, { value: 'rev', label: 'Reverse' }]} />
        </div>
      )}
    </div>
  );
}

function SaveProfile({ profile }: { profile: Profile }) {
  const count = useApp((st) => st.profiles.length);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (naming) input.current?.select(); }, [naming]);
  const full = count >= K.maxSavedProfiles;
  const submit = (e: FormEvent) => { e.preventDefault(); if (saveProfile(name, profile)) setNaming(false); };
  if (!naming) {
    return (
      <span data-tip={full ? `${K.maxSavedProfiles} profiles saved. Delete one to save another.` : undefined}>
        <button type="button" className={[s.preset, s.save].join(' ')} disabled={full} onClick={() => { setName(`Profile ${count + 1}`); setNaming(true); }}>
          <Icon name="plus" size={14} />Save profile
        </button>
      </span>
    );
  }
  return (
    <form className={s.nameForm} onSubmit={submit}>
      <label className="sr-only" htmlFor="profile-name">Profile name</label>
      <input id="profile-name" ref={input} className={s.nameInput} value={name} maxLength={K.maxBuildNameLength} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setNaming(false); } }} />
      <Button variant="primary" type="submit" className={s.nameSave}>Save</Button>
      <Button variant="icon" icon="close" label="Cancel" onClick={() => setNaming(false)} />
    </form>
  );
}

/** The nine catalog presets, then saved profiles, then Save profile. Each applies to the profile in scope. */
export function PresetRow({ target, profile }: { target: LightTarget | null; profile: Profile }) {
  const saved = useApp((st) => st.profiles);
  return (
    <div className={s.presets} role="group" aria-label="Lighting presets">
      {catalog.lighting.presets.map((p) => {
        const pp = profileFromPreset(p.id);
        return (
          <button key={p.id} type="button" className={s.preset} aria-pressed={sameProfile(pp, profile)} onClick={() => applyProfileTo(target, pp, p.name)}>
            <span className={s.presetSwatch} style={{ background: `linear-gradient(90deg, ${p.stops.join(', ')})` }} aria-hidden="true" />
            {p.name}
          </button>
        );
      })}
      {saved.map((p) => (
        <span key={p.id} className={s.savedChip}>
          <button type="button" className={[s.preset, s.savedApply].join(' ')} aria-pressed={sameProfile(p, profile)} onClick={() => applyProfileTo(target, p, p.name)}>
            <span className={s.presetSwatch} style={{ background: `linear-gradient(90deg, ${p.stops.join(', ')})` }} aria-hidden="true" />
            {p.name}
          </button>
          <button type="button" className={s.savedDelete} aria-label={`Delete profile ${p.name}`} onClick={() => deleteProfile(p.id)}><Icon name="close" size={14} /></button>
        </span>
      ))}
      <SaveProfile profile={profile} />
    </div>
  );
}

/** Each target: following the main profile, its own, or off. Choosing one makes the panel edit it. */
export function TargetList({ target, lit }: { target: LightTarget | null; lit: Set<LightTarget> }) {
  const overrides = useApp((st) => st.build.lighting.overrides);
  const state = (t: LightTarget) => { const o = overrides[t]; return o === undefined ? 'Synced' : o === 'off' ? 'Off' : 'Own profile'; };
  return (
    <ul className={s.targets} aria-label="Lighting targets">
      {LIGHT_TARGETS.map((t) => (
        <li key={t}>
          <button type="button" className={[s.target, t === target ? s.targetOn : ''].join(' ')} disabled={!lit.has(t)} aria-pressed={t === target}
            onClick={() => setUi({ lightTarget: t === target ? null : t, stop: null })}>
            <span>{LABELS.lightTarget[t]}</span>
            <span className={[s.targetState, overrides[t] === 'off' ? s.stateOff : overrides[t] ? s.stateOwn : ''].join(' ')}>{lit.has(t) ? state(t) : 'Nothing lit'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Which profile the panel edits. A chosen target can follow the main profile, have its own, or be off. */
function ScopeBar({ target, mode }: { target: LightTarget; mode: TargetMode }) {
  const name = LABELS.lightTarget[target];
  return (
    <div className={s.scope}>
      <div className={s.scopeHead}>
        <span className={s.scopeName}>{name}</span>
        <button type="button" className={s.scopeBack} onClick={() => setUi({ lightTarget: null, stop: null })}>
          <Icon name="arrowLeft" size={16} />Every part
        </button>
      </div>
      <Segmented label={`${name} lighting`} block value={mode} onChange={(m) => setTargetMode(target, m)}
        options={(['synced', 'own', 'off'] as TargetMode[]).map((m) => ({ value: m, label: m === 'own' ? 'Own' : MODE_LABEL[m] }))} />
      {mode !== 'own' && <p className={s.scopeNote}>{mode === 'synced' ? 'Follows the main profile. A change below gives it its own.' : `${name} lights are off.`}</p>}
    </div>
  );
}

/** On while every target follows the main profile. Turning it on clears every override. */
export function SyncChip() {
  const synced = useApp((st) => Object.keys(st.build.lighting.overrides).length === 0);
  return <Chip on={synced} onChange={(on) => { if (on) { setLighting({ overrides: {} }); setUi({ lightTarget: null, stop: null }); } }} disabled={synced}>Synced</Chip>;
}

export function LightingScope() {
  const { target, mode } = useScope();
  return target ? <ScopeBar target={target} mode={mode} /> : null;
}

export function LightingBody({ withScope = true }: { withScope?: boolean }) {
  const { target, mode, profile, lit } = useScope();
  const fx = profile === 'off' ? null : getEffect(profile.effect);
  return (
    <div className={s.body}>
      {withScope && target && <ScopeBar target={target} mode={mode} />}
      {profile !== 'off' && (
        <>
          <EffectList target={target} profile={profile} />
          {fx?.usesStops && <Colors target={target} profile={profile} />}
          <LightingControls target={target} profile={profile} />
          <div>
            <div className={s.sub}>Presets</div>
            <PresetRow target={target} profile={profile} />
          </div>
        </>
      )}
      <div>
        <div className={s.sub}>Targets</div>
        <TargetList target={target} lit={lit} />
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
      <LightingScope />
      <div className={s.scroll}>
        <LightingBody withScope={false} />
      </div>
    </section>
  );
}
