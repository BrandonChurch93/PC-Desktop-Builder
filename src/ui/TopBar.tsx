import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { K } from '../data/catalog';
import { powerReason } from '../engine/messages';
import { redo, setGlass, setName, setPower, undo } from '../state/actions';
import { store, type DialogName, type Mode } from '../state/store';
import { openDialog, setUi } from './uiActions';
import { useApp, useSheet } from './hooks';
import { Button, Chip } from './kit/Button';
import { Segmented } from './kit/Controls';
import s from './TopBar.module.css';

export const MODE_LABEL: Record<Mode, string> = { build: 'Build', showcase: 'Showcase', exploded: 'Exploded' };
export const setMode = (mode: Mode) => store.setState({ mode, selected: null, held: null });

/** The product name, and under it the build name, editable in place, with the mode as an eyebrow. */
export function BrandBlock({ compact }: { compact?: boolean }) {
  const name = useApp((st) => st.build.name);
  const mode = useApp((st) => st.mode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (!editing) setDraft(name); }, [name, editing]);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);
  const done = (keep: boolean) => { if (keep) setName(draft); setEditing(false); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
  };
  return (
    <div className={[s.brand, compact ? s.brandCompact : ''].join(' ')}>
      <div className={s.product}>{K.productName}</div>
      {!compact && <div className={s.eyebrow}>{MODE_LABEL[mode]} mode</div>}
      {editing ? (
        <input ref={input} className={s.nameInput} value={draft} maxLength={K.maxBuildNameLength} aria-label="Build name"
          onChange={(e) => setDraft(e.target.value)} onBlur={() => done(true)} onKeyDown={onKey} />
      ) : (
        <button type="button" className={s.name} onClick={() => setEditing(true)} aria-label={`Build name: ${name || 'Untitled build'}. Edit`}>
          <span className={name ? '' : s.untitled}>{name || 'Untitled build'}</span>
        </button>
      )}
    </div>
  );
}

export function UndoRedo() {
  const canUndo = useApp((st) => st.history.length > 0);
  const canRedo = useApp((st) => st.future.length > 0);
  return (
    <div className={s.group}>
      <Button variant="icon" icon="undo" label="Undo" disabled={!canUndo} onClick={undo} />
      <Button variant="icon" icon="redo" label="Redo" disabled={!canRedo} onClick={redo} />
    </div>
  );
}

/** Glass, Power and Airflow. Power is disabled with its reason as the tooltip. */
export function QuickToggles({ compact }: { compact?: boolean }) {
  const glass = useApp((st) => st.build.glass);
  const power = useApp((st) => st.power);
  const airflow = useApp((st) => st.airflow);
  const sh = useSheet();
  const reason = powerReason(sh);
  const hasCase = useApp((st) => !!st.build.case);
  return (
    <div className={s.group}>
      <Chip on={glass} onChange={setGlass} icon="glass" compact={compact} disabled={!hasCase} data-tip={compact ? 'Glass' : undefined}>Glass</Chip>
      <span data-tip={reason ?? (compact ? 'Power' : undefined)} className={s.tipHost}>
        <Chip on={power} onChange={setPower} icon="power" compact={compact} disabled={!!reason && !power} aria-describedby={reason ? 'power-reason' : undefined} className={power ? s.powerOn : ''}>Power</Chip>
        {reason && <span id="power-reason" className="sr-only">{reason}</span>}
      </span>
      <Chip on={airflow} onChange={(v) => store.setState({ airflow: v })} icon="airflow" compact={compact} disabled={!hasCase} data-tip={compact ? 'Airflow' : undefined}>Airflow</Chip>
    </div>
  );
}

export function ModeSwitch({ block }: { block?: boolean }) {
  const mode = useApp((st) => st.mode);
  return <Segmented label="Mode" value={mode} block={block} options={(['build', 'showcase', 'exploded'] as Mode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} onChange={setMode} />;
}

const MENU: { d: DialogName; label: string }[] = [
  { d: 'saved', label: 'Saved builds' },
  { d: 'poster', label: 'Export poster' },
  { d: 'settings', label: 'Settings' },
  { d: 'about', label: 'About' },
];

/** Saved builds, Export poster, Settings and About. */
export function Menu() {
  const open = useApp((st) => st.ui.menu);
  const ref = useRef<HTMLDivElement | null>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setUi({ menu: false }); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (d) { e.preventDefault(); items.current[(i + d + MENU.length) % MENU.length]?.focus(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setUi({ menu: false }); }
  };
  return (
    <div ref={ref} className={s.menuWrap}>
      <Button variant="icon" icon="menu" label="Menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setUi({ menu: !open })} />
      {open && (
        <div role="menu" className={s.menu} aria-label="Menu">
          {MENU.map((m, i) => (
            <button key={m.d} ref={(el) => { items.current[i] = el; }} role="menuitem" type="button" className={s.menuItem} onClick={() => openDialog(m.d)} onKeyDown={(e) => onKey(e, i)}>{m.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShareButton({ icon }: { icon?: boolean }) {
  const hasCase = useApp((st) => !!st.build.case);
  return icon
    ? <Button variant="icon" icon="share" label="Share" onClick={() => openDialog('share')} disabled={!hasCase} />
    : <Button variant="ghost" icon="share" onClick={() => openDialog('share')} disabled={!hasCase}>Share</Button>;
}
