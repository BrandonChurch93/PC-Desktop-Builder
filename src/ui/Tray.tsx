import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, getCable, getCase, getFan, LABELS, type Category, type StorageType } from '../data/catalog';
import { SHOWCASE } from '../data/showcase';
import { encode } from '../engine/codec';
import { buildFromShowcase } from '../engine/rules';
import { check } from '../engine/rules';
import { blockedMessage } from '../engine/messages';
import { fitOf } from '../engine/queries';
import { clearCaseFans, fillFanMounts, setCaseFinish, stepStorage } from '../state/actions';
import { store, type TrayTab } from '../state/store';
import { activateCard, startPlacing } from './activate';
import { BuildCard } from './BuildCard';
import { useDragScroll } from './dragScroll';
import { useApp } from './hooks';
import { Button } from './kit/Button';
import { Segmented, Stepper, Tabs } from './kit/Controls';
import { PartCard } from './PartCard';
import { brandOf, installedCount, keyNumbers, thumbOf, trayParts } from './parts';
import { getWorld } from './worldRef';
import s from './Tray.module.css';

export const TRAY_HINT = 'Drag into the case, or tap a card and then the slot';
export const BUILDS_HINT = 'Tap a build to put it on the bench, lit';
const BUILDS_LABEL = 'Builds';
const SHOWCASE_CODES = new Map(SHOWCASE.map((b) => [b.id, encode(buildFromShowcase(b))]));

export function CategoryTabs({ idBase }: { idBase: string }) {
  const tab = useApp((st) => st.ui.tab);
  const build = useApp((st) => st.build);
  const parts = CATEGORIES.map((c) => {
    const n = installedCount(build, c);
    const badge = c === 'cables' ? null : n > 1 || c === 'ram' || c === 'storage' || c === 'fan' ? (n || null) : n ? 'dot' as const : null;
    return { value: c as TrayTab, label: LABELS.category[c], badge };
  });
  const items = [{ value: 'builds' as TrayTab, label: BUILDS_LABEL, badge: null }, ...parts];
  return <Tabs label="Part categories" idBase={idBase} value={tab} items={items} onChange={(t) => store.setState({ ui: { ...store.getState().ui, tab: t } })} />;
}

/** The card row of the active category. Horizontal on desktop, tablet and the phone's peek stop. */
/** Cards of a newly opened tab built ahead. */
const INTENT_FIRST = 3;

export function CardRow({ idBase, wrap }: { idBase: string; wrap?: boolean }) {
  const tab = useApp((st) => st.ui.tab);
  return tab === 'builds' ? <BuildRow idBase={idBase} wrap={wrap} /> : <PartRow idBase={idBase} wrap={wrap} tab={tab} />;
}

function BuildRow({ idBase, wrap }: { idBase: string; wrap?: boolean }) {
  const code = useApp((st) => encode(st.build));
  const row = useRef<HTMLDivElement>(null);
  useDragScroll(row);
  return (
    <div id={`${idBase}-panel`} role="tabpanel" aria-labelledby={`${idBase}-tab-builds`} className={s.panel}>
      <div ref={row} className={[s.row, wrap ? s.wrap : ''].join(' ')} role="list" aria-label="Showcase builds">
        {SHOWCASE.map((b) => (
          <div role="listitem" key={b.id} className={s.item}>
            <BuildCard spec={b} on={SHOWCASE_CODES.get(b.id) === code} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PartRow({ idBase, wrap, tab }: { idBase: string; wrap?: boolean; tab: Category }) {
  const build = useApp((st) => st.build);
  const held = useApp((st) => st.held);
  const [fillStyle, setFillStyle] = useState<string | null>(null);
  const parts = useMemo(() => trayParts(tab).map((p) => ({ ...p, fit: fitOf(build, tab, p.id) })), [tab, build]);
  const fanStyle = fillStyle ?? Object.values(build.fans)[0] ?? parts[0]?.id ?? 'gale';
  const caseSpec = build.case ? getCase(build.case.id) : undefined;
  const row = useRef<HTMLDivElement>(null);
  useDragScroll(row);
  // A tab just opened: its first cards are built ahead, as the most likely next pick.
  useEffect(() => { for (const p of parts.filter((x) => x.fit.status === 'fits').slice(0, INTENT_FIRST)) getWorld()?.prepare(tab, p.id); }, [tab]);

  return (
    <div id={`${idBase}-panel`} role="tabpanel" aria-labelledby={`${idBase}-tab-${tab}`} className={s.panel}>
      {tab === 'fan' && (
        <div className={s.actions}>
          <Button variant="ghost" icon="fill" disabled={!caseSpec} onClick={() => fillFanMounts(fanStyle)}>Fill empty mounts</Button>
          <Button variant="quiet" icon="clear" disabled={Object.keys(build.fans).length === 0} onClick={() => clearCaseFans()}>Clear fans</Button>
          <span className={s.fillNote}>Fill uses {brandOf(getFan(fanStyle)?.brand ?? '')} {getFan(fanStyle)?.name}</span>
        </div>
      )}
      <div ref={row} className={[s.row, wrap ? s.wrap : ''].join(' ')} role="list" aria-label={`${LABELS.category[tab]} parts`}>
        {parts.map((p) => {
          const count = tab === 'ram' ? build.ram.filter((r) => r === p.id).length : tab === 'storage' ? build.storage[p.id as StorageType] : tab === 'fan' ? Object.values(build.fans).filter((f) => f === p.id).length : undefined;
          const cable = tab === 'cables' ? getCable(p.id) : undefined;
          return (
            <div role="listitem" key={p.id} className={s.item}>
              <PartCard category={tab} id={p.id} brand={brandOf(p.brand)} name={p.name} numbers={cable ? cable.colors.length > 1 ? 'Two tone sleeving' : 'Single color sleeving' : keyNumbers(tab, p.id)}
                thumb={tab === 'cables' ? null : thumbOf(tab, p.id, build)} fit={tab === 'cables' ? (build.cables === p.id ? { status: 'installed' } : { status: 'fits' }) : p.fit}
                statusOverride={tab === 'cables' ? (build.cables === p.id ? 'In use' : 'Tap to use') : undefined}
                swatch={cable?.colors} active={tab === 'cables' ? build.cables === p.id : undefined} count={count || undefined}
                held={held?.category === tab && held.id === p.id}
                onActivate={(how) => { if (tab === 'fan') setFillStyle(p.id); activateCard(tab, p.id, how); }}
                onPlace={() => startPlacing(tab, p.id, 'keys')}
                onIntent={() => getWorld()?.prepare(tab, p.id)}
                onInspect={tab === 'cables' ? null : () => store.setState({ inspect: { category: tab, id: p.id, angle: 0, zoom: 0, ...(tab === 'case' && build.case?.id === p.id ? { finish: build.case.finish } : {}) } })}>
                {tab === 'case' && build.case?.id === p.id && caseSpec && (
                  <Segmented label="Case finish" value={build.case.finish} options={caseSpec.finishes.map((f) => ({ value: f, label: LABELS.finish[f] }))} onChange={(f) => setCaseFinish(f)} />
                )}
                {tab === 'storage' && <StorageStepper type={p.id as StorageType} />}
              </PartCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StorageStepper({ type }: { type: StorageType }) {
  const build = useApp((st) => st.build);
  const add = check(build, 'storage', type);
  return (
    <Stepper label={LABELS.storageType[type]} value={build.storage[type]} onStep={(d) => stepStorage(type, d)}
      canAdd={add.ok} canRemove={build.storage[type] > 0} addReason={add.ok ? undefined : blockedMessage(add.code, add.data)} />
  );
}

function TrayHint() {
  const builds = useApp((st) => st.ui.tab === 'builds');
  return <p className={s.hint}>{builds ? BUILDS_HINT : TRAY_HINT}</p>;
}

/** Desktop and tablet: the tray as a dock along the bottom. */
export function Dock() {
  return (
    <section className={s.dock} aria-label="Parts tray" data-bottom-ui>
      <div className={s.head}>
        <CategoryTabs idBase="dock" />
        <TrayHint />
      </div>
      <CardRow idBase="dock" />
    </section>
  );
}
