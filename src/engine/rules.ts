import {
  getBoard, getCable, getCase, getCooler, getCpu, getFan, getGpu, getPsu, getRam, getStorage, getPreset,
  K, STORAGE_TYPES,
  type CaseSpec, type Category, type CoolerSpec, type PresetSpec, type RadMountSpec, type StorageType,
} from '../data/catalog';
import { lightingFromPreset, sanitizeLighting } from './sanitize';
import type { ActionOpts, Build, CheckData, CheckResult, InstallResult, Removed, RuleCode } from './types';

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function emptyBuild(): Build {
  return {
    v: K.shareVersion, name: '', case: null, board: null, cpu: null, cooler: null, ram: [], gpu: null,
    storage: { nvme: 0, ssd: 0, hdd: 0 }, psu: null, fans: {}, cables: 'onyx', glass: true, lighting: lightingFromPreset('aurora'),
  };
}

export function buildFromPreset(p: PresetSpec): Build {
  const b = emptyBuild();
  const src = clone(p.build);
  b.case = src.case;
  b.board = src.board;
  b.cpu = src.cpu;
  b.cooler = src.cooler;
  b.ram = src.ram;
  b.gpu = src.gpu;
  b.storage = src.storage;
  b.psu = src.psu;
  b.fans = src.fans;
  b.cables = src.cables;
  b.glass = src.glass;
  b.name = p.name;
  b.lighting = lightingFromPreset(src.lighting);
  return b;
}

export function presetBuild(id: string): Build | null {
  const p = getPreset(id);
  return p ? buildFromPreset(p) : null;
}

export const caseOf = (b: Build) => (b.case ? getCase(b.case.id) : undefined);
export const boardOf = (b: Build) => (b.board ? getBoard(b.board) : undefined);
export const cpuOf = (b: Build) => (b.cpu ? getCpu(b.cpu) : undefined);
export const coolerOf = (b: Build) => (b.cooler ? getCooler(b.cooler.id) : undefined);
export const gpuOf = (b: Build) => (b.gpu ? getGpu(b.gpu) : undefined);
export const psuOf = (b: Build) => (b.psu ? getPsu(b.psu) : undefined);

export function radMount(b: Build): RadMountSpec | null {
  const c = caseOf(b); const k = coolerOf(b);
  if (!c || !k || k.type !== 'aio' || !b.cooler || !b.cooler.mount) return null;
  return c.radMounts.find((m) => m.id === b.cooler?.mount) ?? null;
}

export function occupiedFanMounts(b: Build): string[] {
  const m = radMount(b); const c = caseOf(b); const k = coolerOf(b);
  if (!m || !c || !k || k.radSize === null) return [];
  const n = k.radSize / 120;
  return c.fanMounts.filter((f) => f.group === m.group).slice(0, n).map((f) => f.id);
}

export function gpuClearance(b: Build): number {
  const c = caseOf(b);
  if (!c) return 0;
  const m = radMount(b);
  return c.gpuMaxLength - (m ? m.gpuPenalty : 0);
}

export const ramSticks = (b: Build): number => b.ram.reduce((n, id) => n + (getRam(id)?.sticks ?? 0), 0);

const no = (code: RuleCode, data: CheckData = {}): CheckResult => ({ ok: false, code, data });

function radMountCode(b: Build, c: CaseSpec, k: CoolerSpec, m: RadMountSpec | undefined): RuleCode | null {
  const g = gpuOf(b);
  if (!m) return 'NO_RAD_MOUNT';
  if (k.radSize === null || !m.sizes.includes(k.radSize)) return 'NO_RAD_MOUNT';
  if (g && g.length > c.gpuMaxLength - m.gpuPenalty) return 'RAD_GPU_CLEARANCE';
  return null;
}

function pickRadMount(b: Build, c: CaseSpec, k: CoolerSpec): CheckResult {
  const ok = c.radMounts.find((m) => radMountCode(b, c, k, m) === null);
  if (ok) return { ok: true, mount: ok.id };
  const sized = c.radMounts.filter((m) => k.radSize !== null && m.sizes.includes(k.radSize));
  if (sized.length === 0) return no('NO_RAD_MOUNT', { size: k.radSize ?? 0 });
  return no('RAD_GPU_CLEARANCE', { length: gpuOf(b)?.length ?? 0, max: Math.max(...sized.map((m) => c.gpuMaxLength - m.gpuPenalty)) });
}

export function check(b: Build, category: string, id: string, opts: ActionOpts = {}): CheckResult {
  const c = caseOf(b); const bd = boardOf(b);
  switch (category) {
    case 'case': return getCase(id) ? { ok: true } : no('UNKNOWN_PART');
    case 'board': {
      const p = getBoard(id); if (!p) return no('UNKNOWN_PART');
      if (!c) return no('NEED_CASE');
      if (!c.boardSizes.includes(p.size)) return no('BOARD_SIZE', { sizes: [...c.boardSizes] });
      return { ok: true };
    }
    case 'cpu': {
      const p = getCpu(id); if (!p) return no('UNKNOWN_PART');
      if (!bd) return no('NEED_BOARD');
      if (p.platform !== bd.platform) return no('CPU_PLATFORM', { platform: bd.platform });
      return { ok: true };
    }
    case 'cooler': {
      const p = getCooler(id); if (!p) return no('UNKNOWN_PART');
      if (!cpuOf(b) || !c) return no('NEED_CPU');
      if (p.type === 'aio') {
        if (opts.mount) {
          const m = c.radMounts.find((x) => x.id === opts.mount);
          const code = radMountCode(b, c, p, m);
          if (!code) return { ok: true, mount: opts.mount };
          if (code === 'NO_RAD_MOUNT' || !m) return no('NO_RAD_MOUNT', { size: p.radSize ?? 0 });
          return no(code, { length: gpuOf(b)?.length ?? 0, max: c.gpuMaxLength - m.gpuPenalty });
        }
        return pickRadMount(b, c, p);
      }
      const height = p.height ?? 0;
      if (height > c.coolerMaxHeight) return no('COOLER_HEIGHT', { height, max: c.coolerMaxHeight });
      const clearance = p.ramClearance;
      if (clearance !== null && b.ram.some((r) => (getRam(r)?.height ?? 0) > clearance)) {
        return no('RAM_CLEARANCE', { blocked: 'cooler', clearance, height: Math.max(...b.ram.map((r) => getRam(r)?.height ?? 0)) });
      }
      return { ok: true, mount: null };
    }
    case 'ram': {
      const p = getRam(id); if (!p) return no('UNKNOWN_PART');
      if (!bd) return no('NEED_BOARD');
      const k = coolerOf(b);
      if (k && k.ramClearance !== null && p.height > k.ramClearance) return no('RAM_CLEARANCE', { blocked: 'ram', clearance: k.ramClearance, height: p.height });
      const used = ramSticks(b);
      if (used + p.sticks > bd.ramSlots) return no('RAM_SLOTS', { sticks: p.sticks, free: bd.ramSlots - used });
      return { ok: true };
    }
    case 'gpu': {
      const p = getGpu(id); if (!p) return no('UNKNOWN_PART');
      if (!bd || !c) return no('NEED_BOARD');
      if (p.thickness > c.gpuMaxThickness) return no('GPU_THICKNESS', { thickness: p.thickness, max: c.gpuMaxThickness });
      const max = gpuClearance(b);
      if (p.length > max) return no('GPU_LENGTH', { length: p.length, max });
      return { ok: true };
    }
    case 'storage': {
      const s = getStorage(id); if (!s) return no('UNKNOWN_PART');
      if (id === 'nvme') {
        if (!bd) return no('NEED_BOARD');
        if (b.storage.nvme + 1 > bd.m2Slots) return no('M2_SLOTS', { slots: bd.m2Slots });
        return { ok: true };
      }
      if (!c) return no('NEED_CASE');
      if (id === 'ssd' && b.storage.ssd + 1 > c.bays25) return no('BAYS_25', { bays: c.bays25 });
      if (id === 'hdd' && b.storage.hdd + 1 > c.bays35) return no('BAYS_35', { bays: c.bays35 });
      if (bd && b.storage.ssd + b.storage.hdd + 1 > bd.sataPorts) return no('SATA_PORTS', { ports: bd.sataPorts });
      return { ok: true };
    }
    case 'psu': {
      const p = getPsu(id); if (!p) return no('UNKNOWN_PART');
      if (!c) return no('NEED_CASE');
      if (p.form !== c.psuForm) return no('PSU_FORM', { form: c.psuForm });
      if (p.length > c.psuMaxLength) return no('PSU_LENGTH', { length: p.length, max: c.psuMaxLength });
      return { ok: true };
    }
    case 'fan': {
      if (!getFan(id)) return no('UNKNOWN_PART');
      if (!c) return no('NEED_CASE');
      if (!c.fanMounts.some((m) => m.id === opts.mount)) return no('FAN_MOUNT_UNKNOWN');
      if (opts.mount && occupiedFanMounts(b).includes(opts.mount)) return no('FAN_MOUNT_TAKEN');
      return { ok: true };
    }
    case 'cables': return getCable(id) ? { ok: true } : no('UNKNOWN_PART');
    default: return no('UNKNOWN_CATEGORY');
  }
}

const isWhole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

export function revalidate(input: Build): { build: Build; removed: Removed[] } {
  const b = clone(input);
  const removed: Removed[] = [];
  const drop = (category: Category, id: unknown, code: RuleCode, count?: number) => {
    const entry: Removed = { category, id: String(id), code };
    if (count) entry.count = count;
    removed.push(entry);
  };

  if (b.case && !getCase(b.case.id)) { drop('case', b.case.id, 'UNKNOWN_PART'); b.case = null; }
  const c = caseOf(b);
  if (c && b.case && !(c.finishes as readonly string[]).includes(b.case.finish)) b.case.finish = c.finishes[0] ?? b.case.finish;

  if (b.board) {
    const p = getBoard(b.board);
    const code: RuleCode | null = !p ? 'UNKNOWN_PART' : !c ? 'NEED_CASE' : !c.boardSizes.includes(p.size) ? 'BOARD_SIZE' : null;
    if (code) { drop('board', b.board, code); b.board = null; }
  }
  const bd = boardOf(b);

  if (b.cpu) {
    const p = getCpu(b.cpu);
    const code: RuleCode | null = !p ? 'UNKNOWN_PART' : !bd ? 'NEED_BOARD' : p.platform !== bd.platform ? 'CPU_PLATFORM' : null;
    if (code) { drop('cpu', b.cpu, code); b.cpu = null; }
  }

  if (b.cooler) {
    const p = getCooler(b.cooler.id);
    let code: RuleCode | null = !p ? 'UNKNOWN_PART' : !b.cpu || !c ? 'NEED_CPU' : null;
    if (!code && p && c) {
      if (p.type === 'aio') {
        const g = gpuOf(b);
        const fitsGpu = (m: RadMountSpec) => !g || !bd || g.length <= c.gpuMaxLength - m.gpuPenalty || g.length > c.gpuMaxLength;
        const cur = c.radMounts.find((m) => m.id === b.cooler?.mount);
        if (!cur || p.radSize === null || !cur.sizes.includes(p.radSize)) {
          const sized = c.radMounts.filter((m) => p.radSize !== null && m.sizes.includes(p.radSize));
          const next = sized.find(fitsGpu) ?? sized[0];
          if (next) b.cooler.mount = next.id; else code = 'NO_RAD_MOUNT';
        }
      } else {
        b.cooler.mount = null;
        if ((p.height ?? 0) > c.coolerMaxHeight) code = 'COOLER_HEIGHT';
      }
    }
    if (code) { drop('cooler', b.cooler.id, code); b.cooler = null; }
  }

  {
    const k = coolerOf(b);
    const keep: string[] = []; let used = 0;
    for (const id of Array.isArray(b.ram) ? b.ram : []) {
      const p = getRam(id);
      const code: RuleCode | null = !p ? 'UNKNOWN_PART'
        : !bd ? 'NEED_BOARD'
          : k && k.ramClearance !== null && p.height > k.ramClearance ? 'RAM_CLEARANCE'
            : used + p.sticks > bd.ramSlots ? 'RAM_SLOTS' : null;
      if (code || !p) drop('ram', id, code ?? 'UNKNOWN_PART'); else { keep.push(id); used += p.sticks; }
    }
    b.ram = keep;
  }

  if (b.gpu) {
    const p = getGpu(b.gpu);
    const code: RuleCode | null = !p ? 'UNKNOWN_PART'
      : !bd || !c ? 'NEED_BOARD'
        : p.thickness > c.gpuMaxThickness ? 'GPU_THICKNESS'
          : p.length > gpuClearance(b) ? 'GPU_LENGTH' : null;
    if (code) { drop('gpu', b.gpu, code); b.gpu = null; }
  }

  {
    const src = (b.storage && typeof b.storage === 'object' ? b.storage : {}) as Record<string, unknown>;
    const s: Record<StorageType, number> = { nvme: 0, ssd: 0, hdd: 0 };
    for (const t of STORAGE_TYPES) { const v = src[t]; s[t] = isWhole(v) ? v : 0; }
    const cut = (type: StorageType, to: number, code: RuleCode) => {
      if (s[type] > to) { drop('storage', type, code, s[type] - to); s[type] = to; }
    };
    if (!bd) cut('nvme', 0, 'NEED_BOARD'); else cut('nvme', bd.m2Slots, 'M2_SLOTS');
    if (!c) { cut('ssd', 0, 'NEED_CASE'); cut('hdd', 0, 'NEED_CASE'); } else { cut('ssd', c.bays25, 'BAYS_25'); cut('hdd', c.bays35, 'BAYS_35'); }
    if (bd) {
      let over = s.ssd + s.hdd - bd.sataPorts;
      if (over > 0) {
        const a = Math.min(over, s.ssd);
        if (a) cut('ssd', s.ssd - a, 'SATA_PORTS');
        over -= a;
        if (over > 0) cut('hdd', s.hdd - over, 'SATA_PORTS');
      }
    }
    b.storage = s;
  }

  if (b.psu) {
    const p = getPsu(b.psu);
    const code: RuleCode | null = !p ? 'UNKNOWN_PART' : !c ? 'NEED_CASE' : p.form !== c.psuForm ? 'PSU_FORM' : p.length > c.psuMaxLength ? 'PSU_LENGTH' : null;
    if (code) { drop('psu', b.psu, code); b.psu = null; }
  }

  {
    const taken = occupiedFanMounts(b);
    const order = c ? c.fanMounts.map((m) => m.id) : [];
    const rank = (x: string) => { const i = order.indexOf(x); return i < 0 ? 999 : i; };
    const fans = (b.fans && typeof b.fans === 'object' ? b.fans : {}) as Record<string, unknown>;
    const ids = Object.keys(fans).sort((x, y) => rank(x) - rank(y) || (x < y ? -1 : 1));
    const keep: Record<string, string> = {};
    for (const mount of ids) {
      const id = fans[mount];
      const code: RuleCode | null = !getFan(id) ? 'UNKNOWN_PART' : !c ? 'NEED_CASE' : !order.includes(mount) ? 'FAN_MOUNT_UNKNOWN' : taken.includes(mount) ? 'FAN_MOUNT_TAKEN' : null;
      if (code) removed.push({ category: 'fan', id: String(id), code, mount });
      else keep[mount] = id as string;
    }
    b.fans = keep;
  }

  if (!getCable(b.cables)) b.cables = 'onyx';
  b.lighting = sanitizeLighting(b.lighting);
  b.glass = b.glass !== false;
  b.name = String(b.name || '').slice(0, K.maxBuildNameLength);
  b.v = K.shareVersion;
  return { build: b, removed };
}

const singlePlace = new Set(['board', 'cpu', 'gpu', 'psu', 'cables']);

export function install(input: Build, category: string, id: string, opts: ActionOpts = {}): InstallResult {
  const b = clone(input);
  const fail = (r: CheckResult): InstallResult =>
    r.ok ? { ok: false, code: 'UNKNOWN_CATEGORY', data: {}, build: input, removed: [] } : { ok: false, code: r.code, data: r.data, build: input, removed: [] };
  if (category === 'case') {
    const r = check(b, 'case', id); if (!r.ok) return fail(r);
    const k = getCase(id);
    if (!k) return fail({ ok: false, code: 'UNKNOWN_PART', data: {} });
    const finish = k.finishes.find((f) => f === opts.finish) ?? k.finishes[0] ?? 'onyx';
    b.case = { id, finish };
  } else if (singlePlace.has(category)) {
    const probe = clone(b);
    if (category === 'board') probe.board = null;
    else if (category === 'cpu') probe.cpu = null;
    else if (category === 'gpu') probe.gpu = null;
    else if (category === 'psu') probe.psu = null;
    const r = check(probe, category, id); if (!r.ok) return fail(r);
    if (category === 'board') b.board = id;
    else if (category === 'cpu') b.cpu = id;
    else if (category === 'gpu') b.gpu = id;
    else if (category === 'psu') b.psu = id;
    else b.cables = id;
  } else if (category === 'cooler') {
    const probe = clone(b); probe.cooler = null;
    const r = check(probe, 'cooler', id, opts); if (!r.ok) return fail(r);
    b.cooler = { id, mount: r.mount ?? null };
  } else if (category === 'ram') {
    const r = check(b, 'ram', id); if (!r.ok) return fail(r);
    b.ram.push(id);
  } else if (category === 'storage') {
    const r = check(b, 'storage', id); if (!r.ok) return fail(r);
    b.storage[id as StorageType] += 1;
  } else if (category === 'fan') {
    const r = check(b, 'fan', id, opts); if (!r.ok) return fail(r);
    if (opts.mount) b.fans[opts.mount] = id;
  } else {
    return { ok: false, code: 'UNKNOWN_CATEGORY', data: {}, build: input, removed: [] };
  }
  const v = revalidate(b);
  return { ok: true, build: v.build, removed: v.removed };
}

export function remove(input: Build, category: string, opts: ActionOpts = {}): { ok: true; build: Build; removed: Removed[] } {
  const b = clone(input);
  if (category === 'case') b.case = null;
  else if (category === 'board') b.board = null;
  else if (category === 'cpu') b.cpu = null;
  else if (category === 'cooler') b.cooler = null;
  else if (category === 'gpu') b.gpu = null;
  else if (category === 'psu') b.psu = null;
  else if (category === 'ram') b.ram.splice(opts.index ?? b.ram.length - 1, 1);
  else if (category === 'storage' && opts.type) b.storage[opts.type] = Math.max(0, b.storage[opts.type] - 1);
  else if (category === 'fan' && opts.mount) delete b.fans[opts.mount];
  const v = revalidate(b);
  return { ok: true, build: v.build, removed: v.removed };
}

export function fanCounts(b: Build): { intake: number; exhaust: number } {
  const c = caseOf(b);
  let intake = 0; let exhaust = 0;
  if (!c) return { intake, exhaust };
  for (const m of c.fanMounts) if (b.fans[m.id]) { if (m.role === 'intake') intake++; else exhaust++; }
  const rm = radMount(b); const k = coolerOf(b);
  if (rm && k) {
    const role = c.fanMounts.find((m) => m.group === rm.group)?.role;
    if (role === 'intake') intake += k.fans; else exhaust += k.fans;
  }
  return { intake, exhaust };
}

export function fillFans(input: Build, fanId: string): { ok: boolean; build: Build; removed: Removed[] } {
  const c = caseOf(input);
  if (!c || !getFan(fanId)) return { ok: false, build: input, removed: [] };
  const b = clone(input);
  const taken = occupiedFanMounts(b);
  for (const m of c.fanMounts) if (!b.fans[m.id] && !taken.includes(m.id)) b.fans[m.id] = fanId;
  const v = revalidate(b);
  return { ok: true, build: v.build, removed: v.removed };
}

export function clearFans(input: Build): { ok: boolean; build: Build; removed: Removed[] } {
  const b = clone(input);
  b.fans = {};
  const v = revalidate(b);
  return { ok: true, build: v.build, removed: v.removed };
}

export function setFinish(input: Build, finish: string): Build {
  const b = clone(input);
  if (b.case) b.case.finish = finish;
  return revalidate(b).build;
}
