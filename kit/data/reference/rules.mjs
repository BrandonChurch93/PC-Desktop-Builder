// Planning-time reference for the rules in kit/03-RULES.md. It produced kit/data/fixtures.json.
// The app engine is written in TypeScript under src/ and must reproduce the fixtures.
import { catalog as C } from './catalog.mjs';

// Lookups have no prototype, so an id such as 'toString' or '__proto__' is simply unknown.
const table = (entries) => Object.assign(Object.create(null), Object.fromEntries(entries));
const by = (list) => table(list.map((x) => [x.id, x]));
export const IDX = { cases: by(C.cases), boards: by(C.boards), cpus: by(C.cpus), coolers: by(C.coolers), ram: by(C.ram), gpus: by(C.gpus), psus: by(C.psus), fans: by(C.fans), cables: by(C.cables), effects: by(C.lighting.effects), presets: by(C.lighting.presets) };
const STORAGE = table(C.storage.map((s) => [s.type, s]));
const K = C.constants;
const clone = (x) => JSON.parse(JSON.stringify(x));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function lightingFromPreset(id) {
  const p = IDX.presets[id];
  return { effect: p.effect, speed: p.speed, brightness: p.brightness, direction: p.direction, stops: [...p.stops], overrides: {} };
}
export function emptyBuild() {
  return { v: K.shareVersion, name: '', case: null, board: null, cpu: null, cooler: null, ram: [], gpu: null, storage: { nvme: 0, ssd: 0, hdd: 0 }, psu: null, fans: {}, cables: 'onyx', glass: true, lighting: lightingFromPreset('aurora') };
}
export function buildFromPreset(p) {
  const b = emptyBuild();
  Object.assign(b, clone(p.build));
  b.name = p.name;
  b.lighting = lightingFromPreset(p.build.lighting);
  return b;
}

const kase = (b) => (b.case ? IDX.cases[b.case.id] : null);
const board = (b) => (b.board ? IDX.boards[b.board] : null);
const cpu = (b) => (b.cpu ? IDX.cpus[b.cpu] : null);
const cooler = (b) => (b.cooler ? IDX.coolers[b.cooler.id] : null);
const gpu = (b) => (b.gpu ? IDX.gpus[b.gpu] : null);
const psu = (b) => (b.psu ? IDX.psus[b.psu] : null);

export function radMount(b) {
  const c = kase(b), k = cooler(b);
  if (!c || !k || k.type !== 'aio' || !b.cooler.mount) return null;
  return c.radMounts.find((m) => m.id === b.cooler.mount) || null;
}
export function occupiedFanMounts(b) {
  const m = radMount(b), c = kase(b), k = cooler(b);
  if (!m) return [];
  const n = k.radSize / 120;
  return c.fanMounts.filter((f) => f.group === m.group).slice(0, n).map((f) => f.id);
}
export function gpuMaxLength(b) {
  const c = kase(b);
  if (!c) return 0;
  const m = radMount(b);
  return c.gpuMaxLength - (m ? m.gpuPenalty : 0);
}
const ramSticks = (b) => b.ram.reduce((n, id) => n + IDX.ram[id].sticks, 0);

function radMountCheck(b, k, m) {
  const c = kase(b), g = gpu(b);
  if (!m) return 'NO_RAD_MOUNT';
  if (!m.sizes.includes(k.radSize)) return 'NO_RAD_MOUNT';
  if (g && g.length > c.gpuMaxLength - m.gpuPenalty) return 'RAD_GPU_CLEARANCE';
  return null;
}
function pickRadMount(b, k) {
  const c = kase(b), g = gpu(b);
  const ok = c.radMounts.find((m) => radMountCheck(b, k, m) === null);
  if (ok) return { mount: ok.id };
  const sized = c.radMounts.filter((m) => m.sizes.includes(k.radSize));
  if (sized.length === 0) return { code: 'NO_RAD_MOUNT', data: { size: k.radSize } };
  return { code: 'RAD_GPU_CLEARANCE', data: { length: g.length, max: Math.max(...sized.map((m) => c.gpuMaxLength - m.gpuPenalty)) } };
}

export function check(b, category, id, opts = {}) {
  const c = kase(b), bd = board(b);
  const no = (code, data = {}) => ({ ok: false, code, data });
  switch (category) {
    case 'case': return IDX.cases[id] ? { ok: true } : no('UNKNOWN_PART');
    case 'board': {
      const p = IDX.boards[id]; if (!p) return no('UNKNOWN_PART');
      if (!c) return no('NEED_CASE');
      if (!c.boardSizes.includes(p.size)) return no('BOARD_SIZE', { sizes: c.boardSizes });
      return { ok: true };
    }
    case 'cpu': {
      const p = IDX.cpus[id]; if (!p) return no('UNKNOWN_PART');
      if (!bd) return no('NEED_BOARD');
      if (p.platform !== bd.platform) return no('CPU_PLATFORM', { platform: bd.platform });
      return { ok: true };
    }
    case 'cooler': {
      const p = IDX.coolers[id]; if (!p) return no('UNKNOWN_PART');
      if (!cpu(b)) return no('NEED_CPU');
      if (p.type === 'aio') {
        if (opts.mount) {
          const m = c.radMounts.find((x) => x.id === opts.mount);
          const code = radMountCheck(b, p, m);
          if (!code) return { ok: true, mount: opts.mount };
          return no(code, code === 'NO_RAD_MOUNT' ? { size: p.radSize } : { length: gpu(b).length, max: c.gpuMaxLength - m.gpuPenalty });
        }
        const pick = pickRadMount(b, p);
        return pick.code ? no(pick.code, pick.data) : { ok: true, mount: pick.mount };
      }
      if (p.height > c.coolerMaxHeight) return no('COOLER_HEIGHT', { height: p.height, max: c.coolerMaxHeight });
      if (p.ramClearance !== null && b.ram.some((r) => IDX.ram[r].height > p.ramClearance)) return no('RAM_CLEARANCE', { blocked: 'cooler', clearance: p.ramClearance, height: Math.max(...b.ram.map((r) => IDX.ram[r].height)) });
      return { ok: true, mount: null };
    }
    case 'ram': {
      const p = IDX.ram[id]; if (!p) return no('UNKNOWN_PART');
      if (!bd) return no('NEED_BOARD');
      const k = cooler(b);
      if (k && k.ramClearance !== null && p.height > k.ramClearance) return no('RAM_CLEARANCE', { blocked: 'ram', clearance: k.ramClearance, height: p.height });
      if (ramSticks(b) + p.sticks > bd.ramSlots) return no('RAM_SLOTS', { sticks: p.sticks, free: bd.ramSlots - ramSticks(b) });
      return { ok: true };
    }
    case 'gpu': {
      const p = IDX.gpus[id]; if (!p) return no('UNKNOWN_PART');
      if (!bd) return no('NEED_BOARD');
      if (p.thickness > c.gpuMaxThickness) return no('GPU_THICKNESS', { thickness: p.thickness, max: c.gpuMaxThickness });
      if (p.length > gpuMaxLength(b)) return no('GPU_LENGTH', { length: p.length, max: gpuMaxLength(b) });
      return { ok: true };
    }
    case 'storage': {
      const s = STORAGE[id]; if (!s) return no('UNKNOWN_PART');
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
      const p = IDX.psus[id]; if (!p) return no('UNKNOWN_PART');
      if (!c) return no('NEED_CASE');
      if (p.form !== c.psuForm) return no('PSU_FORM', { form: c.psuForm });
      if (p.length > c.psuMaxLength) return no('PSU_LENGTH', { length: p.length, max: c.psuMaxLength });
      return { ok: true };
    }
    case 'fan': {
      if (!IDX.fans[id]) return no('UNKNOWN_PART');
      if (!c) return no('NEED_CASE');
      if (!c.fanMounts.some((m) => m.id === opts.mount)) return no('FAN_MOUNT_UNKNOWN');
      if (occupiedFanMounts(b).includes(opts.mount)) return no('FAN_MOUNT_TAKEN');
      return { ok: true };
    }
    case 'cables': return IDX.cables[id] ? { ok: true } : no('UNKNOWN_PART');
    default: return no('UNKNOWN_CATEGORY');
  }
}

export function revalidate(input) {
  const b = clone(input); const removed = [];
  const drop = (category, id, code, count) => removed.push(count ? { category, id, code, count } : { category, id, code });
  if (b.case && !IDX.cases[b.case.id]) { drop('case', b.case.id, 'UNKNOWN_PART'); b.case = null; }
  const c = kase(b);
  if (c && !c.finishes.includes(b.case.finish)) b.case.finish = c.finishes[0];
  if (b.board) {
    const p = IDX.boards[b.board];
    const code = !p ? 'UNKNOWN_PART' : !c ? 'NEED_CASE' : !c.boardSizes.includes(p.size) ? 'BOARD_SIZE' : null;
    if (code) { drop('board', b.board, code); b.board = null; }
  }
  const bd = board(b);
  if (b.cpu) {
    const p = IDX.cpus[b.cpu];
    const code = !p ? 'UNKNOWN_PART' : !bd ? 'NEED_BOARD' : p.platform !== bd.platform ? 'CPU_PLATFORM' : null;
    if (code) { drop('cpu', b.cpu, code); b.cpu = null; }
  }
  if (b.cooler) {
    const p = IDX.coolers[b.cooler.id];
    let code = !p ? 'UNKNOWN_PART' : !b.cpu ? 'NEED_CPU' : null;
    if (!code && p.type === 'aio') {
      const fitsGpu = (m) => { const g = gpu(b); return !g || !bd || g.length <= c.gpuMaxLength - m.gpuPenalty || g.length > c.gpuMaxLength; };
      const cur = c.radMounts.find((m) => m.id === b.cooler.mount);
      if (!cur || !cur.sizes.includes(p.radSize)) {
        const sized = c.radMounts.filter((m) => m.sizes.includes(p.radSize));
        const next = sized.find(fitsGpu) || sized[0];
        if (next) b.cooler.mount = next.id; else code = 'NO_RAD_MOUNT';
      }
    } else if (!code) {
      b.cooler.mount = null;
      if (p.height > c.coolerMaxHeight) code = 'COOLER_HEIGHT';
    }
    if (code) { drop('cooler', b.cooler.id, code); b.cooler = null; }
  }
  {
    const k = cooler(b); const keep = []; let used = 0;
    for (const id of b.ram) {
      const p = IDX.ram[id];
      const code = !p ? 'UNKNOWN_PART' : !bd ? 'NEED_BOARD' : k && k.ramClearance !== null && p.height > k.ramClearance ? 'RAM_CLEARANCE' : used + p.sticks > bd.ramSlots ? 'RAM_SLOTS' : null;
      if (code) drop('ram', id, code); else { keep.push(id); used += p.sticks; }
    }
    b.ram = keep;
  }
  if (b.gpu) {
    const p = IDX.gpus[b.gpu];
    const code = !p ? 'UNKNOWN_PART' : !bd ? 'NEED_BOARD' : p.thickness > c.gpuMaxThickness ? 'GPU_THICKNESS' : p.length > gpuMaxLength(b) ? 'GPU_LENGTH' : null;
    if (code) { drop('gpu', b.gpu, code); b.gpu = null; }
  }
  {
    const s = b.storage;
    for (const t of ['nvme', 'ssd', 'hdd']) s[t] = Number.isInteger(s[t]) && s[t] > 0 ? s[t] : 0;
    const cut = (type, to, code) => { if (s[type] > to) { drop('storage', type, code, s[type] - to); s[type] = to; } };
    if (!bd) cut('nvme', 0, 'NEED_BOARD'); else cut('nvme', bd.m2Slots, 'M2_SLOTS');
    if (!c) { cut('ssd', 0, 'NEED_CASE'); cut('hdd', 0, 'NEED_CASE'); }
    else { cut('ssd', c.bays25, 'BAYS_25'); cut('hdd', c.bays35, 'BAYS_35'); }
    if (bd) {
      let over = s.ssd + s.hdd - bd.sataPorts;
      if (over > 0) { const a = Math.min(over, s.ssd); if (a) cut('ssd', s.ssd - a, 'SATA_PORTS'); over -= a; if (over > 0) cut('hdd', s.hdd - over, 'SATA_PORTS'); }
    }
  }
  if (b.psu) {
    const p = IDX.psus[b.psu];
    const code = !p ? 'UNKNOWN_PART' : !c ? 'NEED_CASE' : p.form !== c.psuForm ? 'PSU_FORM' : p.length > c.psuMaxLength ? 'PSU_LENGTH' : null;
    if (code) { drop('psu', b.psu, code); b.psu = null; }
  }
  {
    const taken = occupiedFanMounts(b); const keep = {};
    const order = c ? c.fanMounts.map((m) => m.id) : [];
    const ids = Object.keys(b.fans).sort((x, y) => (order.indexOf(x) < 0 ? 999 : order.indexOf(x)) - (order.indexOf(y) < 0 ? 999 : order.indexOf(y)) || (x < y ? -1 : 1));
    for (const mount of ids) {
      const id = b.fans[mount];
      const code = !IDX.fans[id] ? 'UNKNOWN_PART' : !c ? 'NEED_CASE' : !order.includes(mount) ? 'FAN_MOUNT_UNKNOWN' : taken.includes(mount) ? 'FAN_MOUNT_TAKEN' : null;
      if (code) removed.push({ category: 'fan', id, code, mount }); else keep[mount] = id;
    }
    b.fans = keep;
  }
  if (!IDX.cables[b.cables]) b.cables = 'onyx';
  b.lighting = sanitizeLighting(b.lighting);
  b.glass = b.glass !== false;
  b.name = String(b.name || '').slice(0, K.maxBuildNameLength);
  b.v = K.shareVersion;
  return { build: b, removed };
}

const HEX = /^#[0-9a-f]{6}$/;
function sanitizeProfile(p, fallback) {
  const L = C.lighting, f = fallback;
  if (!p || typeof p !== 'object') return clone(f);
  const stops = Array.isArray(p.stops) ? p.stops.map((s) => String(s).toLowerCase()).filter((s) => HEX.test(s)).slice(0, K.maxGradientStops) : [];
  return {
    effect: IDX.effects[p.effect] ? p.effect : f.effect,
    speed: Number.isFinite(p.speed) ? clamp(Math.round(p.speed), L.speed.min, L.speed.max) : f.speed,
    brightness: Number.isFinite(p.brightness) ? clamp(Math.round(p.brightness), L.brightness.min, L.brightness.max) : f.brightness,
    direction: p.direction === -1 ? -1 : 1,
    stops: stops.length >= K.minGradientStops ? stops : [...f.stops],
  };
}
export function sanitizeLighting(l) {
  const base = lightingFromPreset('aurora'); delete base.overrides;
  const out = sanitizeProfile(l, base);
  out.overrides = {};
  const src = l && typeof l.overrides === 'object' && l.overrides ? l.overrides : {};
  for (const t of K.lightTargets) {
    if (src[t] === 'off') out.overrides[t] = 'off';
    else if (src[t] && typeof src[t] === 'object') out.overrides[t] = sanitizeProfile(src[t], out);
  }
  return out;
}

export function install(input, category, id, opts = {}) {
  let b = clone(input);
  if (category === 'case') {
    const r = check(b, 'case', id); if (!r.ok) return { ...r, build: input, removed: [] };
    const k = IDX.cases[id];
    b.case = { id, finish: k.finishes.includes(opts.finish) ? opts.finish : k.finishes[0] };
  } else if (category === 'board' || category === 'cpu' || category === 'gpu' || category === 'psu' || category === 'cables') {
    const probe = clone(b); if (category !== 'cables') probe[category] = null;
    const r = check(probe, category, id); if (!r.ok) return { ...r, build: input, removed: [] };
    b[category] = id;
  } else if (category === 'cooler') {
    const probe = clone(b); probe.cooler = null;
    const r = check(probe, 'cooler', id, opts); if (!r.ok) return { ...r, build: input, removed: [] };
    b.cooler = { id, mount: r.mount };
  } else if (category === 'ram') {
    const r = check(b, 'ram', id); if (!r.ok) return { ...r, build: input, removed: [] };
    b.ram.push(id);
  } else if (category === 'storage') {
    const r = check(b, 'storage', id); if (!r.ok) return { ...r, build: input, removed: [] };
    b.storage[id] += 1;
  } else if (category === 'fan') {
    const r = check(b, 'fan', id, opts); if (!r.ok) return { ...r, build: input, removed: [] };
    b.fans[opts.mount] = id;
  } else return { ok: false, code: 'UNKNOWN_CATEGORY', build: input, removed: [] };
  const v = revalidate(b);
  return { ok: true, build: v.build, removed: v.removed };
}

export function remove(input, category, opts = {}) {
  const b = clone(input);
  if (['case', 'board', 'cpu', 'cooler', 'gpu', 'psu'].includes(category)) b[category] = null;
  else if (category === 'ram') b.ram.splice(opts.index ?? b.ram.length - 1, 1);
  else if (category === 'storage') b.storage[opts.type] = Math.max(0, b.storage[opts.type] - 1);
  else if (category === 'fan') delete b.fans[opts.mount];
  const v = revalidate(b);
  return { ok: true, build: v.build, removed: v.removed };
}

export function fanCounts(b) {
  const c = kase(b); let intake = 0, exhaust = 0;
  if (!c) return { intake, exhaust };
  for (const m of c.fanMounts) if (b.fans[m.id]) { if (m.role === 'intake') intake++; else exhaust++; }
  const rm = radMount(b);
  if (rm) { const role = c.fanMounts.find((m) => m.group === rm.group).role; if (role === 'intake') intake += cooler(b).fans; else exhaust += cooler(b).fans; }
  return { intake, exhaust };
}

export function sheet(b) {
  const c = kase(b), bd = board(b), cp = cpu(b), k = cooler(b), g = gpu(b), p = psu(b);
  const memoryGb = b.ram.reduce((n, id) => n + IDX.ram[id].sticks * IDX.ram[id].gbPerStick, 0);
  const storageTb = b.storage.nvme * STORAGE.nvme.capacityTb + b.storage.ssd * STORAGE.ssd.capacityTb + b.storage.hdd * STORAGE.hdd.capacityTb;
  let draw = 0;
  if (c) draw += c.draw; if (bd) draw += bd.draw; if (cp) draw += cp.draw; if (k) draw += k.draw; if (g) draw += g.draw;
  draw += b.ram.reduce((n, id) => n + IDX.ram[id].sticks * IDX.ram[id].drawPerStick, 0);
  draw += b.storage.nvme * STORAGE.nvme.draw + b.storage.ssd * STORAGE.ssd.draw + b.storage.hdd * STORAGE.hdd.draw;
  draw += Object.values(b.fans).reduce((n, id) => n + IDX.fans[id].draw, 0);
  const { intake, exhaust } = fanCounts(b);
  const pressure = intake + exhaust === 0 ? 'none' : intake > exhaust ? 'positive' : intake < exhaust ? 'negative' : 'balanced';
  const missing = ['case', 'board', 'cpu', 'cooler', 'ram', 'psu'].filter((s) => (s === 'ram' ? b.ram.length === 0 : !b[s]));
  const warnings = [];
  if (p && draw > p.capacity) warnings.push({ code: 'PSU_OVER', level: 'error' });
  else if (p && draw > p.capacity * K.headroomWarnRatio) warnings.push({ code: 'PSU_HEADROOM', level: 'warn' });
  if (k && cp && k.capacity < cp.draw) warnings.push({ code: 'COOLER_CAPACITY', level: 'warn' });
  if (c && intake + exhaust === 0) warnings.push({ code: 'NO_FANS', level: 'info' });
  if (missing.length === 0 && storageTb === 0) warnings.push({ code: 'NO_STORAGE', level: 'info' });
  return {
    memoryGb, ramSlotsUsed: ramSticks(b), ramSlots: bd ? bd.ramSlots : 0,
    storageTb, m2Used: b.storage.nvme, m2Slots: bd ? bd.m2Slots : 0, bays25Used: b.storage.ssd, bays25: c ? c.bays25 : 0, bays35Used: b.storage.hdd, bays35: c ? c.bays35 : 0,
    sataUsed: b.storage.ssd + b.storage.hdd, sataPorts: bd ? bd.sataPorts : 0,
    drawW: draw, psuCapacityW: p ? p.capacity : 0, loadPercent: p ? Math.round((draw / p.capacity) * 100) : null,
    recommendedPsuW: Math.ceil((draw * K.recommendedPsuFactor) / K.recommendedPsuStep) * K.recommendedPsuStep,
    gpuLength: g ? g.length : 0, gpuMaxLength: gpuMaxLength(b), coolerCapacityW: k ? k.capacity : 0, cpuDrawW: cp ? cp.draw : 0,
    intakeFans: intake, exhaustFans: exhaust, pressure, missing, warnings,
    canPowerOn: missing.length === 0 && draw <= p.capacity,
  };
}

export function temps(b, load) {
  const T = K.thermal, { intake, exhaust } = fanCounts(b), cp = cpu(b), k = cooler(b), g = gpu(b);
  const air = clamp(T.airflowBase - T.airflowPerFan * (intake + exhaust), T.airflowMin, T.airflowMax);
  return {
    cpuC: cp && k ? Math.round(T.cpuBase + load * T.cpuSpan * Math.min(T.cpuRatioCap, cp.draw / k.capacity) * air) : null,
    gpuC: g ? Math.round(T.gpuBase + load * T.gpuSpan * clamp(g.draw / (g.fans * T.gpuWattsPerFan), T.gpuFactorMin, T.gpuFactorMax) * air) : null,
  };
}

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const profileOut = (p) => [p.effect, p.speed, p.brightness, p.direction, p.stops.map((s) => s.slice(1))];
const profileIn = (a) => ({ effect: a[0], speed: a[1], brightness: a[2], direction: a[3], stops: (a[4] || []).map((s) => '#' + s) });

export function payload(b) {
  const c = kase(b);
  const order = c ? c.fanMounts.map((m) => m.id) : [];
  const fans = Object.keys(b.fans).sort((x, y) => order.indexOf(x) - order.indexOf(y)).map((m) => [m, b.fans[m]]);
  const ov = K.lightTargets.filter((t) => b.lighting.overrides[t] !== undefined).map((t) => [t, b.lighting.overrides[t] === 'off' ? 0 : profileOut(b.lighting.overrides[t])]);
  return [K.shareVersion, b.case ? b.case.id : 0, b.case ? b.case.finish : 0, b.board || 0, b.cpu || 0, b.cooler ? b.cooler.id : 0, b.cooler && b.cooler.mount ? b.cooler.mount : 0, b.ram, b.gpu || 0, [b.storage.nvme, b.storage.ssd, b.storage.hdd], b.psu || 0, fans, b.cables, b.glass ? 1 : 0, [...profileOut(b.lighting), ov], b.name];
}
export function encode(b) { return b64url(JSON.stringify(payload(b))); }
export function decode(str) {
  let a;
  try { a = JSON.parse(unb64url(str)); } catch { return { error: 'BAD_LINK' }; }
  if (!Array.isArray(a) || !Number.isInteger(a[0]) || a[0] < 1) return { error: 'BAD_LINK' };
  if (a[0] > K.shareVersion) return { error: 'NEWER_LINK' };
  try {
    const L = a[14] || [];
    const lighting = { ...profileIn(L), overrides: {} };
    for (const [t, v] of L[5] || []) lighting.overrides[t] = v === 0 ? 'off' : profileIn(v);
    const b = { v: a[0], case: a[1] ? { id: a[1], finish: a[2] } : null, board: a[3] || null, cpu: a[4] || null, cooler: a[5] ? { id: a[5], mount: a[6] || null } : null, ram: Array.isArray(a[7]) ? a[7] : [], gpu: a[8] || null,
      storage: { nvme: (a[9] || [])[0], ssd: (a[9] || [])[1], hdd: (a[9] || [])[2] }, psu: a[10] || null, fans: Object.fromEntries(a[11] || []), cables: a[12], glass: a[13] !== 0, lighting, name: a[15] };
    return revalidate(b);
  } catch { return { error: 'BAD_LINK' }; }
}
