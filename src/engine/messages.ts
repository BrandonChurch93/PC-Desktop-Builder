import { displayName, getStorage, LABELS, PLATFORMS, brandName, type BoardSize, type Category, type PsuForm } from '../data/catalog';
import type { CheckData, Pressure, Removed, RuleCode, Sheet, WarningCode } from './types';

export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const n = (v: number | undefined) => String(v ?? 0);

export type MessageContext = { mountNamed?: boolean };

export function blockedMessage(code: RuleCode, data: CheckData = {}, ctx: MessageContext = {}): string {
  switch (code) {
    case 'NEED_CASE': return 'Pick a case first.';
    case 'NEED_BOARD': return 'Install a board first.';
    case 'NEED_CPU': return 'Install a processor first.';
    case 'BOARD_SIZE': {
      const sizes = (data.sizes ?? []).map((s) => LABELS.boardSize[s as BoardSize] ?? s);
      return `Too large. This case takes ${joinAnd(sizes)} boards.`;
    }
    case 'CPU_PLATFORM': {
      const p = data.platform ? PLATFORMS.get(data.platform) : undefined;
      return `Wrong socket. This board takes ${p ? p.name : data.platform ?? ''} processors.`;
    }
    case 'COOLER_HEIGHT': return `Too tall. This cooler is ${n(data.height)} mm and the case fits ${n(data.max)} mm.`;
    case 'NO_RAD_MOUNT':
      return ctx.mountNamed
        ? `This mount does not take a ${n(data.size)} mm radiator.`
        : `This case has no mount for a ${n(data.size)} mm radiator.`;
    case 'RAD_GPU_CLEARANCE':
      return ctx.mountNamed
        ? `No room. A radiator here leaves ${n(data.max)} mm for the graphics card and it is ${n(data.length)} mm long.`
        : `No room. A radiator in this case leaves ${n(data.max)} mm for the graphics card and it is ${n(data.length)} mm long.`;
    case 'RAM_CLEARANCE':
      return data.blocked === 'cooler'
        ? `No room. This cooler leaves ${n(data.clearance)} mm over the memory and the installed kit is ${n(data.height)} mm.`
        : `Too tall. The cooler leaves ${n(data.clearance)} mm over the memory and this kit is ${n(data.height)} mm.`;
    case 'RAM_SLOTS':
      if (!data.free) return `No free slots. This kit needs ${n(data.sticks)}.`;
      return `Not enough slots. This kit needs ${n(data.sticks)} and ${n(data.free)} ${data.free === 1 ? 'is' : 'are'} free.`;
    case 'GPU_LENGTH': return `Too long. This card is ${n(data.length)} mm and the case has ${n(data.max)} mm free.`;
    case 'GPU_THICKNESS': return `Too thick. This card is ${n(data.thickness)} mm and the case fits ${n(data.max)} mm.`;
    case 'M2_SLOTS':
      return data.slots === 1 ? 'The only M.2 slot on this board is in use.' : `All ${n(data.slots)} M.2 slots on this board are in use.`;
    case 'BAYS_25':
      if (!data.bays) return 'This case has no 2.5 inch mounts.';
      return data.bays === 1 ? 'The only 2.5 inch mount in this case is in use.' : `All ${n(data.bays)} 2.5 inch mounts in this case are in use.`;
    case 'BAYS_35':
      if (!data.bays) return 'This case has no 3.5 inch bays.';
      return data.bays === 1 ? 'The only 3.5 inch bay in this case is in use.' : `All ${n(data.bays)} 3.5 inch bays in this case are in use.`;
    case 'SATA_PORTS': return `All ${n(data.ports)} SATA ports on this board are in use.`;
    case 'PSU_FORM': return `Wrong size. This case takes ${LABELS.psuForm[data.form as PsuForm] ?? data.form ?? ''} supplies.`;
    case 'PSU_LENGTH': return `Too long. This supply is ${n(data.length)} mm and the case fits ${n(data.max)} mm.`;
    case 'FAN_MOUNT_TAKEN': return 'The radiator uses this mount.';
    case 'UNKNOWN_PART': return 'This part is not in this version.';
    case 'UNKNOWN_CATEGORY': return 'This part is not in this version.';
    case 'FAN_MOUNT_UNKNOWN': return 'This case has no such mount.';
  }
}

export const SHORT_REASONS: Record<RuleCode, string> = {
  NEED_CASE: 'needs a case',
  NEED_BOARD: 'needs a board',
  NEED_CPU: 'needs a processor',
  BOARD_SIZE: 'too large for this case',
  CPU_PLATFORM: 'wrong socket for this board',
  COOLER_HEIGHT: 'too tall for this case',
  NO_RAD_MOUNT: 'no radiator mount that size',
  RAD_GPU_CLEARANCE: 'no room beside the graphics card',
  RAM_CLEARANCE: 'too tall under this cooler',
  RAM_SLOTS: 'no free slots',
  GPU_LENGTH: 'too long for this case',
  GPU_THICKNESS: 'too thick for this case',
  M2_SLOTS: 'no place left',
  BAYS_25: 'no place left',
  BAYS_35: 'no place left',
  SATA_PORTS: 'no place left',
  PSU_FORM: 'wrong size for this case',
  PSU_LENGTH: 'too long for this case',
  FAN_MOUNT_TAKEN: 'the radiator uses its mount',
  FAN_MOUNT_UNKNOWN: 'no such mount in this case',
  UNKNOWN_PART: 'not in this version',
  UNKNOWN_CATEGORY: 'not in this version',
};

export function removedName(r: Removed): string {
  if (r.category === 'storage') {
    const s = getStorage(r.id);
    return s ? `${brandName(s.brand)} ${s.name}` : r.id;
  }
  return displayName(r.category as Category, r.id);
}

export function cascadeNotice(removed: Removed[]): { title: string; count: number; lines: string[] } {
  const count = removed.reduce((sum, r) => sum + (r.category === 'storage' ? r.count ?? 1 : 1), 0);
  const groups = new Map<string, { name: string; reason: string; times: number }>();
  for (const r of removed) {
    const name = removedName(r);
    const reason = SHORT_REASONS[r.code];
    const key = `${name}\u0000${reason}`;
    const g = groups.get(key);
    const times = r.category === 'storage' ? r.count ?? 1 : 1;
    if (g) g.times += times; else groups.set(key, { name, reason, times });
  }
  const lines = [...groups.values()].map((g) => `${g.times > 1 ? `${g.times} × ` : ''}${g.name} · ${g.reason}`);
  return { title: count === 1 ? 'Removed 1 part' : `Removed ${count} parts`, count, lines };
}

export function warningMessage(code: WarningCode, s: Sheet): string {
  switch (code) {
    case 'PSU_OVER': return `Not enough power. The build draws ${s.drawW} W and the supply gives ${s.psuCapacityW} W.`;
    case 'PSU_HEADROOM': return `Low headroom. The build uses ${s.loadPercent ?? 0} percent of the supply. A supply of ${s.recommendedPsuW} W or more gives it room.`;
    case 'COOLER_CAPACITY': return `The cooler is rated for ${s.coolerCapacityW} W and this processor draws ${s.cpuDrawW} W. It runs hot under load.`;
    case 'NO_FANS': return 'No case fans. Add intake and exhaust for airflow.';
    case 'NO_STORAGE': return 'No storage. It powers on with nothing to start from.';
  }
}

export const WARNING_PREVIEW: Partial<Record<WarningCode, string>> = {
  PSU_HEADROOM: 'low power headroom',
  PSU_OVER: 'over the supply',
  COOLER_CAPACITY: 'cooler runs hot',
};

export function powerReason(s: Sheet): string | null {
  if (s.missing.length > 0) return `Needs ${joinAnd(s.missing.map((m) => LABELS.missing[m]))} to power on.`;
  if (s.warnings.some((w) => w.code === 'PSU_OVER')) return warningMessage('PSU_OVER', s);
  return null;
}

export function linkMessage(error: 'BAD_LINK' | 'NEWER_LINK'): string {
  return error === 'BAD_LINK' ? 'This link does not hold a build.' : 'This link comes from a newer version.';
}

export const DROPPED_PARTS = 'Some parts in this link are not in this version and were left out.';

export function warningCountLabel(count: number): string {
  if (count === 0) return 'No warnings';
  return count === 1 ? '1 warning' : `${count} warnings`;
}

export const PRESSURE_WORDS: Record<Pressure, string> = {
  positive: 'Positive pressure',
  balanced: 'Balanced',
  negative: 'Negative pressure',
  none: 'No fans',
};

export function cardStatus(fit: { status: 'fits' | 'installed' | 'blocked'; message?: string; preview?: string }): string {
  if (fit.status === 'installed') return 'Installed · tap to remove';
  if (fit.status === 'blocked') return fit.message ?? '';
  return fit.preview ? `Fits · ${fit.preview}` : 'Fits';
}

export function loadReadout(loadPercent: number, cpuC: number | null, gpuC: number | null): string {
  const parts = [`Load ${loadPercent} percent`];
  if (cpuC !== null) parts.push(`Processor ${cpuC} °C`);
  if (gpuC !== null) parts.push(`Graphics ${gpuC} °C`);
  parts.push('Simulated');
  return parts.join(' · ');
}
