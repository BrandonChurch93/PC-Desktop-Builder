import { getFan, getRam, getStorage, K } from '../data/catalog';
import { boardOf, caseOf, coolerOf, cpuOf, fanCounts, gpuClearance, gpuOf, psuOf, ramSticks } from './rules';
import type { Build, MissingPart, Pressure, Sheet, Temps, Warning } from './types';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const MISSING_ORDER: MissingPart[] = ['case', 'board', 'cpu', 'cooler', 'ram', 'psu'];

export function estimatedDraw(b: Build): number {
  const c = caseOf(b); const bd = boardOf(b); const cp = cpuOf(b); const k = coolerOf(b); const g = gpuOf(b);
  let draw = 0;
  if (c) draw += c.draw;
  if (bd) draw += bd.draw;
  if (cp) draw += cp.draw;
  if (k) draw += k.draw;
  if (g) draw += g.draw;
  draw += b.ram.reduce((n, id) => { const r = getRam(id); return n + (r ? r.sticks * r.drawPerStick : 0); }, 0);
  const nv = getStorage('nvme'); const ss = getStorage('ssd'); const hd = getStorage('hdd');
  draw += b.storage.nvme * (nv?.draw ?? 0) + b.storage.ssd * (ss?.draw ?? 0) + b.storage.hdd * (hd?.draw ?? 0);
  draw += Object.values(b.fans).reduce((n, id) => n + (getFan(id)?.draw ?? 0), 0);
  return draw;
}

export function sheet(b: Build): Sheet {
  const c = caseOf(b); const bd = boardOf(b); const cp = cpuOf(b); const k = coolerOf(b); const g = gpuOf(b); const p = psuOf(b);
  const memoryGb = b.ram.reduce((n, id) => { const r = getRam(id); return n + (r ? r.sticks * r.gbPerStick : 0); }, 0);
  const nv = getStorage('nvme'); const ss = getStorage('ssd'); const hd = getStorage('hdd');
  const storageTb = b.storage.nvme * (nv?.capacityTb ?? 0) + b.storage.ssd * (ss?.capacityTb ?? 0) + b.storage.hdd * (hd?.capacityTb ?? 0);
  const draw = estimatedDraw(b);
  const { intake, exhaust } = fanCounts(b);
  const pressure: Pressure = intake + exhaust === 0 ? 'none' : intake > exhaust ? 'positive' : intake < exhaust ? 'negative' : 'balanced';
  const missing = MISSING_ORDER.filter((s) => (s === 'ram' ? b.ram.length === 0 : s === 'case' ? !b.case : s === 'cooler' ? !b.cooler : !b[s]));
  const warnings: Warning[] = [];
  if (p && draw > p.capacity) warnings.push({ code: 'PSU_OVER', level: 'error' });
  else if (p && draw > p.capacity * K.headroomWarnRatio) warnings.push({ code: 'PSU_HEADROOM', level: 'warn' });
  if (k && cp && k.capacity < cp.draw) warnings.push({ code: 'COOLER_CAPACITY', level: 'warn' });
  if (c && intake + exhaust === 0) warnings.push({ code: 'NO_FANS', level: 'info' });
  if (missing.length === 0 && storageTb === 0) warnings.push({ code: 'NO_STORAGE', level: 'info' });
  return {
    memoryGb, ramSlotsUsed: ramSticks(b), ramSlots: bd ? bd.ramSlots : 0,
    storageTb, m2Used: b.storage.nvme, m2Slots: bd ? bd.m2Slots : 0,
    bays25Used: b.storage.ssd, bays25: c ? c.bays25 : 0, bays35Used: b.storage.hdd, bays35: c ? c.bays35 : 0,
    sataUsed: b.storage.ssd + b.storage.hdd, sataPorts: bd ? bd.sataPorts : 0,
    drawW: draw, psuCapacityW: p ? p.capacity : 0, loadPercent: p ? Math.round((draw / p.capacity) * 100) : null,
    recommendedPsuW: Math.ceil((draw * K.recommendedPsuFactor) / K.recommendedPsuStep) * K.recommendedPsuStep,
    gpuLength: g ? g.length : 0, gpuMaxLength: gpuClearance(b), coolerCapacityW: k ? k.capacity : 0, cpuDrawW: cp ? cp.draw : 0,
    intakeFans: intake, exhaustFans: exhaust, pressure, missing, warnings,
    canPowerOn: missing.length === 0 && !!p && draw <= p.capacity,
  };
}

export function temps(b: Build, load: number): Temps {
  const T = K.thermal; const { intake, exhaust } = fanCounts(b);
  const cp = cpuOf(b); const k = coolerOf(b); const g = gpuOf(b);
  const air = clamp(T.airflowBase - T.airflowPerFan * (intake + exhaust), T.airflowMin, T.airflowMax);
  return {
    cpuC: cp && k ? Math.round(T.cpuBase + load * T.cpuSpan * Math.min(T.cpuRatioCap, cp.draw / k.capacity) * air) : null,
    gpuC: g ? Math.round(T.gpuBase + load * T.gpuSpan * clamp(g.draw / (g.fans * T.gpuWattsPerFan), T.gpuFactorMin, T.gpuFactorMax) * air) : null,
  };
}
