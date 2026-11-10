import { K } from '../data/catalog';
import { warningCountLabel } from '../engine/messages';
import { openDialog } from './uiActions';
import { useApp, useSheet } from './hooks';
import { Button } from './kit/Button';
import { Meter, Stat } from './kit/Controls';
import s from './SpecPanel.module.css';

/** The headline numbers: memory, storage, power against the supply, and graphics clearance. */
export function SpecStats() {
  const sh = useSheet();
  const build = useApp((st) => st.build);
  const loadRatio = sh.psuCapacityW ? sh.drawW / sh.psuCapacityW : 0;
  const bays = sh.bays25Used + sh.bays35Used; const bayTotal = sh.bays25 + sh.bays35;
  return (
    <div className={s.stats}>
      <Stat label="Memory" value={sh.memoryGb || null} unit="GB" detail={!build.board ? 'Waiting for a board' : sh.memoryGb ? `${sh.ramSlotsUsed} of ${sh.ramSlots} slots` : `Waiting for memory · ${sh.ramSlots} slots`} />
      <Stat label="Storage" value={sh.storageTb || null} unit="TB" detail={sh.storageTb ? `${sh.m2Used} of ${sh.m2Slots} M.2 · ${bays} of ${bayTotal} bays` : 'Waiting for a drive'} />
      <Stat label="Power" value={sh.drawW || null} unit="W" detail={sh.psuCapacityW ? `of ${sh.psuCapacityW} W · ${sh.loadPercent ?? 0} percent` : sh.drawW ? 'Waiting for a supply' : 'Waiting for parts'}>
        <Meter value={loadRatio} warnAt={K.headroomWarnRatio} label="Power load" />
      </Stat>
      <Stat label="Graphics" value={sh.gpuLength || null} unit="mm" detail={sh.gpuLength ? `of ${sh.gpuMaxLength} mm clearance` : build.case ? `Waiting for a card · ${sh.gpuMaxLength} mm free` : 'Waiting for a case'} />
    </div>
  );
}

export function SpecStatus() {
  const sh = useSheet();
  const count = sh.warnings.length;
  const level = sh.warnings.some((w) => w.level === 'error') ? s.danger : count ? s.warn : s.ok;
  return <span className={[s.status, level].join(' ')}>{warningCountLabel(count)}</span>;
}

export function SpecPanel({ onClose }: { onClose?: () => void }) {
  return (
    <section className={s.panel} aria-labelledby="spec-title">
      <header className={s.head}>
        <h2 id="spec-title" className={s.eyebrow}>Spec sheet</h2>
        <span className={s.headEnd}><SpecStatus />{onClose && <Button variant="icon" icon="close" label="Close the spec sheet" onClick={onClose} />}</span>
      </header>
      <SpecStats />
      <Button variant="ghost" block onClick={() => openDialog('sheet')}>Open full sheet</Button>
    </section>
  );
}
