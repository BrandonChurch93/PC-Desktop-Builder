import { getBoard, getCase, getCooler, getRam, LABELS, K, type Category, type MountGroup, type StorageType } from '../data/catalog';
import { PRESSURE_WORDS, warningMessage } from '../engine/messages';
import { gpuClearance, radMount } from '../engine/rules';
import { sheet as sheetOf, temps } from '../engine/sheet';
import type { ActionOpts, Build, Sheet } from '../engine/types';
import { partName } from '../state/actions';
import { dimmFill } from '../world/layout/boards';

export type SlotRow = { slot: string; part: string; remove: { category: Category; opts: ActionOpts } | null };
export type Row = { label: string; value: string; tone?: 'ok' | 'warn' | 'danger' };
export type SpecModel = { parts: SlotRow[]; capacity: Row[]; power: Row[]; cooling: Row[]; clearances: Row[]; warnings: { text: string; level: 'error' | 'warn' | 'info' }[]; sheet: Sheet };

const used = (a: number, b: number) => `${a} of ${b}`;

function mountName(caseId: string, mount: string): string {
  const c = getCase(caseId);
  const m = c?.fanMounts.find((x) => x.id === mount);
  if (!m) return mount;
  const n = mount.split('-')[1];
  return `${LABELS.mountGroup[m.group as MountGroup]} ${n ?? ''}`.trim();
}

/** Every section of the full spec sheet, from the engine's sheet and the build. */
export function specModel(b: Build): SpecModel {
  const s = sheetOf(b);
  const parts: SlotRow[] = [];
  const caseSpec = b.case ? getCase(b.case.id) : undefined;
  if (b.case) parts.push({ slot: 'Case', part: `${partName('case', b.case.id)} · ${LABELS.finish[b.case.finish as keyof typeof LABELS.finish] ?? b.case.finish}`, remove: { category: 'case', opts: {} } });
  if (b.board) parts.push({ slot: 'Board', part: partName('board', b.board), remove: { category: 'board', opts: {} } });
  if (b.cpu) parts.push({ slot: 'Processor', part: partName('cpu', b.cpu), remove: { category: 'cpu', opts: {} } });
  if (b.cooler) {
    const rm = radMount(b);
    parts.push({ slot: rm ? `Cooler · ${LABELS.mountGroup[rm.group]} radiator` : 'Cooler', part: partName('cooler', b.cooler.id), remove: { category: 'cooler', opts: {} } });
  }
  const board = b.board ? getBoard(b.board) : undefined;
  if (b.ram.length) {
    const fill = board ? dimmFill(board.ramSlots, b.ram.map((id) => getRam(id)?.sticks ?? 0)) : [];
    b.ram.forEach((id, i) => parts.push({ slot: `Memory · ${(fill[i] ?? []).join(', ')}`, part: partName('ram', id), remove: { category: 'ram', opts: { index: i } } }));
  }
  if (b.gpu) parts.push({ slot: 'Graphics · PCIe x16', part: partName('gpu', b.gpu), remove: { category: 'gpu', opts: {} } });
  const slotName: Record<StorageType, string> = { nvme: 'M.2 slot', ssd: '2.5 inch mount', hdd: '3.5 inch bay' };
  for (const t of ['nvme', 'ssd', 'hdd'] as StorageType[]) {
    for (let i = 0; i < b.storage[t]; i++) parts.push({ slot: `${slotName[t]} ${i + 1}`, part: partName('storage', t), remove: { category: 'storage', opts: { type: t } } });
  }
  if (b.psu) parts.push({ slot: 'Power', part: partName('psu', b.psu), remove: { category: 'psu', opts: {} } });
  if (caseSpec) for (const m of caseSpec.fanMounts) {
    const id = b.fans[m.id];
    if (id) parts.push({ slot: `Fan · ${mountName(caseSpec.id, m.id)} · ${m.role}`, part: partName('fan', id), remove: { category: 'fan', opts: { mount: m.id } } });
  }
  parts.push({ slot: 'Cables', part: partName('cables', b.cables), remove: null });

  const capacity: Row[] = [
    { label: 'Memory slots', value: used(s.ramSlotsUsed, s.ramSlots) },
    { label: 'M.2 slots', value: used(s.m2Used, s.m2Slots) },
    { label: '2.5 inch mounts', value: used(s.bays25Used, s.bays25) },
    { label: '3.5 inch bays', value: used(s.bays35Used, s.bays35) },
    { label: 'SATA ports', value: used(s.sataUsed, s.sataPorts) },
  ];

  const over = s.warnings.some((w) => w.code === 'PSU_OVER'); const low = s.warnings.some((w) => w.code === 'PSU_HEADROOM');
  const power: Row[] = [
    { label: 'Draw', value: `${s.drawW} W` },
    { label: 'Supply', value: s.psuCapacityW ? `${s.psuCapacityW} W` : 'None' },
    { label: 'Load', value: s.loadPercent === null ? 'No supply' : `${s.loadPercent} percent`, ...(over ? { tone: 'danger' as const } : low ? { tone: 'warn' as const } : {}) },
    { label: 'Recommended supply', value: `${s.recommendedPsuW} W or more` },
  ];

  const t = temps(b, 1);
  const hot = s.warnings.some((w) => w.code === 'COOLER_CAPACITY');
  const cooling: Row[] = [
    { label: 'Cooler rating', value: b.cooler ? `${s.coolerCapacityW} W for a ${s.cpuDrawW} W processor` : 'No cooler', ...(hot ? { tone: 'warn' as const } : {}) },
    { label: 'Intake and exhaust', value: `${s.intakeFans} in · ${s.exhaustFans} out` },
    { label: 'Airflow', value: PRESSURE_WORDS[s.pressure] },
    { label: 'At full load', value: [t.cpuC !== null ? `Processor ${t.cpuC} °C` : null, t.gpuC !== null ? `Graphics ${t.gpuC} °C` : null].filter(Boolean).join(' · ') || 'Nothing to load', },
  ];

  const clearances: Row[] = [];
  if (caseSpec) {
    const free = gpuClearance(b);
    clearances.push({ label: 'Graphics card', value: s.gpuLength ? `${s.gpuLength} of ${free} mm free` : `${free} mm free` });
    const k = b.cooler ? getCooler(b.cooler.id) : undefined;
    clearances.push({ label: 'Cooler height', value: k && k.type !== 'aio' ? `${k.height} of ${caseSpec.coolerMaxHeight} mm` : `${caseSpec.coolerMaxHeight} mm limit` });
    if (k && k.ramClearance !== null) {
      const tallest = Math.max(0, ...b.ram.map((id) => getRam(id)?.height ?? 0));
      clearances.push({ label: 'Memory under the cooler', value: tallest ? `${tallest} of ${k.ramClearance} mm` : `${k.ramClearance} mm clearance` });
    }
  }

  const warnings = s.warnings.map((w) => ({ text: warningMessage(w.code, s), level: w.level }));
  return { parts, capacity, power, cooling, clearances, warnings, sheet: s };
}

/** The sheet as plain text, for Copy as text. */
export function specText(b: Build): string {
  const m = specModel(b);
  const name = b.name || 'Untitled build';
  const sec = (title: string, rows: string[]) => (rows.length ? [`${title}`, ...rows.map((r) => `  ${r}`), ''] : []);
  return [
    name, '',
    ...sec('Parts', m.parts.map((p) => `${p.slot}: ${p.part}`)),
    ...sec('Capacity', m.capacity.map((r) => `${r.label}: ${r.value}`)),
    ...sec('Power', m.power.map((r) => `${r.label}: ${r.value}`)),
    ...sec('Cooling', m.cooling.map((r) => `${r.label}: ${r.value}`)),
    ...sec('Clearances', m.clearances.map((r) => `${r.label}: ${r.value}`)),
    ...sec('Warnings', m.warnings.length ? m.warnings.map((w) => w.text) : ['No warnings']),
    K.productName,
  ].join('\n');
}
