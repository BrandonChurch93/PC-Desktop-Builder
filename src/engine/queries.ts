import { getCase, getCooler, type Category, type StorageType } from '../data/catalog';
import { blockedMessage, WARNING_PREVIEW } from './messages';
import { caseOf, check, clone, install, occupiedFanMounts } from './rules';
import { sheet } from './sheet';
import type { ActionOpts, Build, CheckData, RuleCode } from './types';

export type FitStatus = 'fits' | 'installed' | 'blocked';
export type Fit = { status: FitStatus; code?: RuleCode; data?: CheckData; message?: string; preview?: string };

const SINGLE = new Set<Category>(['case', 'board', 'cpu', 'cooler', 'gpu', 'psu', 'cables']);
export const isSinglePlace = (c: Category) => SINGLE.has(c);

function emptied(b: Build, category: Category): Build {
  const p = clone(b);
  if (category === 'board') p.board = null;
  else if (category === 'cpu') p.cpu = null;
  else if (category === 'cooler') p.cooler = null;
  else if (category === 'gpu') p.gpu = null;
  else if (category === 'psu') p.psu = null;
  return p;
}

export function installedId(b: Build, category: Category): string | null {
  switch (category) {
    case 'case': return b.case ? b.case.id : null;
    case 'board': return b.board;
    case 'cpu': return b.cpu;
    case 'cooler': return b.cooler ? b.cooler.id : null;
    case 'gpu': return b.gpu;
    case 'psu': return b.psu;
    case 'cables': return b.cables;
    default: return null;
  }
}

export function freeFanMounts(b: Build): string[] {
  const c = caseOf(b);
  if (!c) return [];
  const taken = occupiedFanMounts(b);
  return c.fanMounts.filter((m) => !b.fans[m.id] && !taken.includes(m.id)).map((m) => m.id);
}

export function usableFanMounts(b: Build): string[] {
  const c = caseOf(b);
  if (!c) return [];
  const taken = occupiedFanMounts(b);
  return c.fanMounts.filter((m) => !taken.includes(m.id)).map((m) => m.id);
}

/** Where Enter or a single tap installs this part, or null when the user has to pick. */
export function firstPlace(b: Build, category: Category, id: string): ActionOpts | null {
  if (category === 'fan') {
    const m = freeFanMounts(b)[0];
    return m ? { mount: m } : null;
  }
  if (category === 'cooler') {
    const k = getCooler(id);
    if (k && k.type === 'aio') {
      const r = check(emptied(b, 'cooler'), 'cooler', id);
      return r.ok && r.mount ? { mount: r.mount } : {};
    }
  }
  return {};
}

/** How many distinct places this part could go. One means a tap installs at once. */
export function placeCount(b: Build, category: Category, id: string): number {
  if (category === 'fan') return caseOf(b) ? usableFanMounts(b).length : 0;
  if (category === 'cooler') {
    const k = getCooler(id);
    const c = caseOf(b);
    if (k && k.type === 'aio' && c) return c.radMounts.filter((m) => k.radSize !== null && m.sizes.includes(k.radSize)).length;
  }
  return 1;
}

function previewFor(b: Build, category: Category, id: string, opts: ActionOpts): string | undefined {
  const r = install(b, category, id, opts);
  if (!r.ok) return undefined;
  const before = new Set(sheet(b).warnings.filter((w) => w.level !== 'info').map((w) => w.code));
  const added = sheet(r.build).warnings.find((w) => w.level !== 'info' && !before.has(w.code));
  return added ? WARNING_PREVIEW[added.code] : undefined;
}

export function fitOf(b: Build, category: Category, id: string): Fit {
  if (SINGLE.has(category) && installedId(b, category) === id) return { status: 'installed' };
  if (category === 'cables') return { status: 'fits' };
  if (category === 'fan') {
    if (!caseOf(b)) return { status: 'blocked', code: 'NEED_CASE', data: {}, message: blockedMessage('NEED_CASE') };
    if (usableFanMounts(b).length === 0) return { status: 'blocked', code: 'FAN_MOUNT_TAKEN', data: {}, message: blockedMessage('FAN_MOUNT_TAKEN') };
    const mount = freeFanMounts(b)[0];
    const preview = mount ? previewFor(b, category, id, { mount }) : undefined;
    return preview ? { status: 'fits', preview } : { status: 'fits' };
  }
  const probe = SINGLE.has(category) ? emptied(b, category) : b;
  const r = check(probe, category, id);
  if (!r.ok) return { status: 'blocked', code: r.code, data: r.data, message: blockedMessage(r.code, r.data) };
  const preview = previewFor(b, category, id, {});
  return preview ? { status: 'fits', preview } : { status: 'fits' };
}

export type Socket = {
  key: string;
  category: Category;
  id: string;
  opts: ActionOpts;
  ok: boolean;
  code?: RuleCode;
  data?: CheckData;
  message?: string;
  replaces: boolean;
};

/** Every place a held part could go, each valid or blocked with its reason. */
export function socketsFor(b: Build, category: Category, id: string): Socket[] {
  const out: Socket[] = [];
  const add = (key: string, opts: ActionOpts, r: ReturnType<typeof check>, replaces: boolean, mountNamed = false) => {
    if (r.ok) out.push({ key, category, id, opts, ok: true, replaces });
    else out.push({ key, category, id, opts, ok: false, code: r.code, data: r.data, message: blockedMessage(r.code, r.data, { mountNamed }), replaces });
  };
  const c = caseOf(b);
  if (category === 'fan') {
    if (!c) { add('fan:none', {}, check(b, 'fan', id, {}), false); return out; }
    for (const m of c.fanMounts) add(`fan:${m.id}`, { mount: m.id }, check(b, 'fan', id, { mount: m.id }), Boolean(b.fans[m.id]), true);
    return out;
  }
  if (category === 'cooler') {
    const k = getCooler(id);
    if (k && k.type === 'aio' && c && b.cpu) {
      const probe = emptied(b, 'cooler');
      for (const m of c.radMounts) add(`cooler:${m.id}`, { mount: m.id }, check(probe, 'cooler', id, { mount: m.id }), Boolean(b.cooler), true);
      return out;
    }
  }
  if (category === 'storage') {
    add(`storage:${id}`, { type: id as StorageType }, check(b, 'storage', id), false);
    return out;
  }
  if (category === 'ram') {
    add('ram:next', {}, check(b, 'ram', id), false);
    return out;
  }
  if (category === 'case') {
    add('case', {}, check(b, 'case', id), Boolean(b.case));
    return out;
  }
  const probe = SINGLE.has(category) ? emptied(b, category) : b;
  add(category, {}, check(probe, category, id), Boolean(installedId(b, category)));
  return out;
}

export const caseHasFinish = (caseId: string, finish: string) => Boolean(getCase(caseId)?.finishes.some((f) => f === finish));
