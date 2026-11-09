import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/data/catalog';
import {
  blockedMessage, cascadeNotice, cardStatus, linkMessage, loadReadout, powerReason, PRESSURE_WORDS, SHORT_REASONS, warningCountLabel, warningMessage,
} from '../../src/engine/messages';
import { presetBuild, remove } from '../../src/engine/rules';
import { sheet } from '../../src/engine/sheet';
import type { CheckData, Removed, RuleCode, Sheet, WarningCode } from '../../src/engine/types';

const BANNED = /[—–!{}]|undefined|NaN|null|\[object/;
function clean(s: string) {
  expect(s.length).toBeGreaterThan(0);
  expect(s).not.toMatch(BANNED);
  expect(s).toBe(s.trim());
  expect(s).not.toMatch(/ {2}/);
}
const sentence = (s: string) => { clean(s); expect(s).toMatch(/[.]$/); };

const variants: [RuleCode, CheckData, { mountNamed?: boolean }, string][] = [
  ['NEED_CASE', {}, {}, 'Pick a case first.'],
  ['NEED_BOARD', {}, {}, 'Install a board first.'],
  ['NEED_CPU', {}, {}, 'Install a processor first.'],
  ['BOARD_SIZE', { sizes: ['itx'] }, {}, 'Too large. This case takes ITX boards.'],
  ['BOARD_SIZE', { sizes: ['matx', 'itx'] }, {}, 'Too large. This case takes micro ATX and ITX boards.'],
  ['BOARD_SIZE', { sizes: ['atx', 'matx', 'itx'] }, {}, 'Too large. This case takes ATX, micro ATX and ITX boards.'],
  ['CPU_PLATFORM', { platform: 'cv' }, {}, 'Wrong socket. This board takes Cindervane CV processors.'],
  ['CPU_PLATFORM', { platform: 'hb' }, {}, 'Wrong socket. This board takes Hadron Bay HB processors.'],
  ['COOLER_HEIGHT', { height: 166, max: 165 }, {}, 'Too tall. This cooler is 166 mm and the case fits 165 mm.'],
  ['NO_RAD_MOUNT', { size: 360 }, { mountNamed: true }, 'This mount does not take a 360 mm radiator.'],
  ['NO_RAD_MOUNT', { size: 360 }, {}, 'This case has no mount for a 360 mm radiator.'],
  ['RAD_GPU_CLEARANCE', { length: 372, max: 370 }, { mountNamed: true }, 'No room. A radiator here leaves 370 mm for the graphics card and it is 372 mm long.'],
  ['RAD_GPU_CLEARANCE', { length: 372, max: 370 }, {}, 'No room. A radiator in this case leaves 370 mm for the graphics card and it is 372 mm long.'],
  ['RAM_CLEARANCE', { blocked: 'ram', clearance: 45, height: 52 }, {}, 'Too tall. The cooler leaves 45 mm over the memory and this kit is 52 mm.'],
  ['RAM_CLEARANCE', { blocked: 'cooler', clearance: 34, height: 44 }, {}, 'No room. This cooler leaves 34 mm over the memory and the installed kit is 44 mm.'],
  ['RAM_SLOTS', { sticks: 4, free: 2 }, {}, 'Not enough slots. This kit needs 4 and 2 are free.'],
  ['RAM_SLOTS', { sticks: 2, free: 0 }, {}, 'No free slots. This kit needs 2.'],
  ['GPU_LENGTH', { length: 322, max: 310 }, {}, 'Too long. This card is 322 mm and the case has 310 mm free.'],
  ['GPU_THICKNESS', { thickness: 71, max: 62 }, {}, 'Too thick. This card is 71 mm and the case fits 62 mm.'],
  ['M2_SLOTS', { slots: 3 }, {}, 'All 3 M.2 slots on this board are in use.'],
  ['M2_SLOTS', { slots: 1 }, {}, 'The only M.2 slot on this board is in use.'],
  ['BAYS_25', { bays: 2 }, {}, 'All 2 2.5 inch mounts in this case are in use.'],
  ['BAYS_25', { bays: 1 }, {}, 'The only 2.5 inch mount in this case is in use.'],
  ['BAYS_25', { bays: 0 }, {}, 'This case has no 2.5 inch mounts.'],
  ['BAYS_35', { bays: 4 }, {}, 'All 4 3.5 inch bays in this case are in use.'],
  ['BAYS_35', { bays: 1 }, {}, 'The only 3.5 inch bay in this case is in use.'],
  ['BAYS_35', { bays: 0 }, {}, 'This case has no 3.5 inch bays.'],
  ['SATA_PORTS', { ports: 4 }, {}, 'All 4 SATA ports on this board are in use.'],
  ['PSU_FORM', { form: 'sfx' }, {}, 'Wrong size. This case takes SFX supplies.'],
  ['PSU_FORM', { form: 'atx' }, {}, 'Wrong size. This case takes ATX supplies.'],
  ['PSU_LENGTH', { length: 180, max: 170 }, {}, 'Too long. This supply is 180 mm and the case fits 170 mm.'],
  ['FAN_MOUNT_TAKEN', {}, {}, 'The radiator uses this mount.'],
];

describe('messages', () => {
  it('every blocked code in every listed variant gives its exact sentence', () => {
    for (const [code, data, ctx, want] of variants) {
      const got = blockedMessage(code, data, ctx);
      sentence(got);
      expect(got).toBe(want);
    }
  });

  it('every short reason in the cascade table exists and is clean', () => {
    const listed: RuleCode[] = ['NEED_CASE', 'NEED_BOARD', 'NEED_CPU', 'BOARD_SIZE', 'CPU_PLATFORM', 'COOLER_HEIGHT', 'NO_RAD_MOUNT', 'RAM_CLEARANCE', 'RAM_SLOTS', 'GPU_LENGTH', 'GPU_THICKNESS', 'M2_SLOTS', 'BAYS_25', 'BAYS_35', 'SATA_PORTS', 'PSU_FORM', 'PSU_LENGTH', 'FAN_MOUNT_TAKEN', 'FAN_MOUNT_UNKNOWN', 'UNKNOWN_PART'];
    for (const code of listed) clean(SHORT_REASONS[code]);
    expect(SHORT_REASONS.M2_SLOTS).toBe('no place left');
    expect(SHORT_REASONS.FAN_MOUNT_TAKEN).toBe('the radiator uses its mount');
  });

  it('warnings fill every number from the sheet', () => {
    const s = sheet(presetBuild('night-rig')!);
    const filled: Sheet = { ...s, drawW: 902, psuCapacityW: 850, loadPercent: 92, recommendedPsuW: 1200, coolerCapacityW: 130, cpuDrawW: 170 };
    const want: Record<WarningCode, string> = {
      PSU_OVER: 'Not enough power. The build draws 902 W and the supply gives 850 W.',
      PSU_HEADROOM: 'Low headroom. The build uses 92 percent of the supply. A supply of 1200 W or more gives it room.',
      COOLER_CAPACITY: 'The cooler is rated for 130 W and this processor draws 170 W. It runs hot under load.',
      NO_FANS: 'No case fans. Add intake and exhaust for airflow.',
      NO_STORAGE: 'No storage. It powers on with nothing to start from.',
    };
    for (const code of Object.keys(want) as WarningCode[]) {
      const got = warningMessage(code, filled);
      sentence(got);
      expect(got).toBe(want[code]);
    }
  });

  it('power reasons list what is missing in order', () => {
    const empty = sheet(remove(presetBuild('night-rig')!, 'case').build);
    expect(powerReason(empty)).toBe('Needs a case, a board, a processor, a cooler, memory and a power supply to power on.');
    const noPsu = sheet(remove(presetBuild('night-rig')!, 'psu').build);
    expect(powerReason(noPsu)).toBe('Needs a power supply to power on.');
    const noRamCpu = sheet(remove(remove(presetBuild('night-rig')!, 'ram').build, 'cpu').build);
    expect(powerReason(noRamCpu)).toBe('Needs a processor, a cooler and memory to power on.');
    expect(powerReason(sheet(presetBuild('night-rig')!))).toBeNull();
    const over = { ...sheet(presetBuild('night-rig')!), drawW: 900, warnings: [{ code: 'PSU_OVER' as const, level: 'error' as const }] };
    expect(powerReason(over)).toBe('Not enough power. The build draws 900 W and the supply gives 850 W.');
    for (const s of [empty, noPsu, noRamCpu]) sentence(powerReason(s) ?? '');
  });

  it('link messages', () => {
    expect(linkMessage('BAD_LINK')).toBe('This link does not hold a build.');
    expect(linkMessage('NEWER_LINK')).toBe('This link comes from a newer version.');
  });

  it('the cascade notice counts things and groups repeats', () => {
    const removed: Removed[] = [
      { category: 'fan', id: 'gale', code: 'FAN_MOUNT_TAKEN', mount: 'front-1' },
      { category: 'fan', id: 'gale', code: 'FAN_MOUNT_TAKEN', mount: 'front-2' },
      { category: 'fan', id: 'gale', code: 'FAN_MOUNT_TAKEN', mount: 'front-3' },
      { category: 'storage', id: 'nvme', code: 'M2_SLOTS', count: 2 },
      { category: 'gpu', id: 'apex3x', code: 'NEED_BOARD' },
    ];
    const n = cascadeNotice(removed);
    expect(n.title).toBe('Removed 6 parts');
    expect(n.lines).toEqual(['3 × Kestrane Gale · the radiator uses its mount', '2 × Pellam Arrow 2 TB · no place left', 'Veltrin Apex 3X · needs a board']);
    expect(cascadeNotice([{ category: 'cooler', id: 'tarn360-lux', code: 'NEED_CPU' }]).title).toBe('Removed 1 part');
    for (const l of n.lines) clean(l);
  });

  it('fixed strings for status, pressure, cards and the load readout', () => {
    expect(warningCountLabel(0)).toBe('No warnings');
    expect(warningCountLabel(1)).toBe('1 warning');
    expect(warningCountLabel(3)).toBe('3 warnings');
    expect(PRESSURE_WORDS).toEqual({ positive: 'Positive pressure', balanced: 'Balanced', negative: 'Negative pressure', none: 'No fans' });
    expect(cardStatus({ status: 'fits' })).toBe('Fits');
    expect(cardStatus({ status: 'installed' })).toBe('Installed · tap to remove');
    expect(cardStatus({ status: 'fits', preview: 'low power headroom' })).toBe('Fits · low power headroom');
    expect(loadReadout(100, 63, 71)).toBe('Load 100 percent · Processor 63 °C · Graphics 71 °C · Simulated');
    expect(loadReadout(40, null, 52)).toBe('Load 40 percent · Graphics 52 °C · Simulated');
  });

  it('every catalog brand and part name is clean of banned characters', () => {
    for (const list of [catalog.cases, catalog.boards, catalog.cpus, catalog.coolers, catalog.ram, catalog.gpus, catalog.storage, catalog.psus, catalog.fans, catalog.cables]) {
      for (const p of list) clean(p.name);
    }
  });
});
