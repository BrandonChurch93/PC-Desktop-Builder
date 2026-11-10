import { useMemo, useState } from 'react';
import { removePart, say } from '../state/actions';
import { closeDialog } from './uiActions';
import { useApp } from './hooks';
import { Button } from './kit/Button';
import { Dialog } from './kit/Dialog';
import { SpecStatus } from './SpecPanel';
import { specModel, specText, type Row } from './specModel';
import s from './SheetDialog.module.css';

function Rows({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <section className={s.section} aria-labelledby={`sheet-${title}`}>
      <h3 id={`sheet-${title}`} className={s.h}>{title}</h3>
      <dl className={s.rows}>
        {rows.map((r) => (
          <div key={r.label} className={s.row}>
            <dt>{r.label}</dt>
            <dd className={r.tone ? s[r.tone] : undefined}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The complete non visual path: every part by slot with its Remove button, every capacity, power, cooling, clearance and warning. */
export function SheetDialog() {
  const build = useApp((st) => st.build);
  const m = useMemo(() => specModel(build), [build]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(specText(build)); setCopied(true); say('Spec sheet copied as text.'); setTimeout(() => setCopied(false), 2400); }
    catch { say('Copying is not available here.'); }
  };
  return (
    <Dialog title={build.name || 'Untitled build'} onClose={closeDialog} wide
      actions={<><SpecStatus /><span className={s.spacer} /><Button variant="ghost" icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Copied' : 'Copy as text'}</Button></>}>
      <p className={s.eyebrow}>Full spec sheet</p>
      <div className={s.grid}>
        <section className={[s.section, s.parts].join(' ')} aria-labelledby="sheet-parts">
          <h3 id="sheet-parts" className={s.h}>Parts by slot</h3>
          {m.parts.length <= 1 ? <p className={s.empty}>Nothing installed yet.</p> : (
            <ul className={s.partList}>
              {m.parts.map((p, i) => (
                <li key={`${p.slot}-${i}`} className={s.part}>
                  <span className={s.slot}>{p.slot}</span>
                  <span className={s.partName}>{p.part}</span>
                  {p.remove && <Button variant="quiet" aria-label={`Remove ${p.part}`} onClick={() => removePart(p.remove!.category, p.remove!.opts)}>Remove</Button>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={s.side}>
          <Rows title="Capacity" rows={m.capacity} />
          <Rows title="Power" rows={m.power} />
          <Rows title="Cooling" rows={m.cooling} />
          <Rows title="Clearances" rows={m.clearances} />
          <section className={s.section} aria-labelledby="sheet-warnings">
            <h3 id="sheet-warnings" className={s.h}>Warnings</h3>
            {m.warnings.length === 0 ? <p className={[s.empty, s.ok].join(' ')}>No warnings</p> : (
              <ul className={s.warnings}>
                {m.warnings.map((w) => <li key={w.text} className={w.level === 'error' ? s.danger : w.level === 'warn' ? s.warn : s.info}>{w.text}</li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Dialog>
  );
}
