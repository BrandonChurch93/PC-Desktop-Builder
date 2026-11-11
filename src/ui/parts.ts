import { catalog, getBoard, getCase, getCooler, getCpu, getFan, getGpu, getPsu, getRam, getStorage, LABELS, PLATFORMS, brandName, partsOf, type Category, type StorageType } from '../data/catalog';
import type { Build } from '../engine/types';

const BASE = import.meta.env.BASE_URL;

/** The rendered thumbnail of a part. Cases show the finish they are in, or their first finish. */
export function thumbOf(category: Category, id: string, b: Build): string {
  if (category === 'case') {
    const k = getCase(id);
    const finish = b.case?.id === id ? b.case.finish : k?.finishes[0] ?? 'onyx';
    return `${BASE}thumbs/case-${id}-${finish}.jpg`;
  }
  if (category === 'storage') return `${BASE}thumbs/storage-${getStorage(id)?.id ?? id}.jpg`;
  return `${BASE}thumbs/${category}-${id}.jpg`;
}

/** One line of the numbers a builder looks at first, all from the catalog. */
export function keyNumbers(category: Category, id: string): string {
  switch (category) {
    case 'case': { const k = getCase(id); return k ? `${LABELS.boardSize[k.boardSizes[0]!]} · card ${k.gpuMaxLength} mm · cooler ${k.coolerMaxHeight} mm` : ''; }
    case 'board': { const b = getBoard(id); return b ? `${LABELS.boardSize[b.size]} · ${PLATFORMS.get(b.platform)?.socketLabel ?? ''} · ${b.ramSlots} DIMM · ${b.m2Slots} M.2` : ''; }
    case 'cpu': { const c = getCpu(id); return c ? `${c.cores} cores · ${c.draw} W · ${PLATFORMS.get(c.platform)?.socketLabel ?? ''}` : ''; }
    case 'cooler': { const k = getCooler(id); if (!k) return ''; return k.type === 'aio' ? `${k.radSize} mm radiator · ${k.capacity} W` : `${k.height} mm tall · ${k.capacity} W`; }
    case 'ram': { const r = getRam(id); return r ? `${r.sticks} × ${r.gbPerStick} GB · ${r.height} mm` : ''; }
    case 'gpu': { const g = getGpu(id); return g ? `${g.length} mm · ${g.thickness} mm thick · ${g.draw} W` : ''; }
    case 'storage': { const s = getStorage(id); return s ? `${LABELS.storageType[s.type]} · ${s.capacityTb} TB` : ''; }
    case 'psu': { const p = getPsu(id); return p ? `${p.capacity} W · ${LABELS.psuForm[p.form]} · ${p.length} mm` : ''; }
    case 'fan': { const f = getFan(id); return f ? `${f.blades} blades · ${f.lit ? 'lit' : 'unlit'} · ${f.draw} W` : ''; }
    case 'cables': return 'Sleeved runs';
  }
}

/** The Inspector's spec list: every number the rules use for this part, from the catalog, as label and value. */
export function specRows(category: Category, id: string): [string, string][] {
  const lit = (z: number) => (z > 0 ? `${z} ${z === 1 ? 'zone' : 'zones'}` : 'None');
  switch (category) {
    case 'case': {
      const k = getCase(id); if (!k) return [];
      return [['Boards', k.boardSizes.map((s) => LABELS.boardSize[s]).join(', ')], ['Size', `${k.size.d} × ${k.size.w} × ${k.size.h} mm`], ['Graphics clearance', `${k.gpuMaxLength} mm`], ['Cooler height', `${k.coolerMaxHeight} mm`],
        ['Supply', `${LABELS.psuForm[k.psuForm]} up to ${k.psuMaxLength} mm`], ['Fan mounts', String(k.fanMounts.length)], ['Radiator mounts', k.radMounts.map((m) => `${LABELS.mountGroup[m.group]} ${m.sizes.join(' or ')}`).join(', ') || 'None'],
        ['Drive bays', `${k.bays25} × 2.5 in · ${k.bays35} × 3.5 in`], ['Lighting', lit(k.lightZones)]];
    }
    case 'board': {
      const b = getBoard(id); if (!b) return [];
      return [['Size', LABELS.boardSize[b.size]], ['Socket', PLATFORMS.get(b.platform)?.socketLabel ?? ''], ['Memory slots', String(b.ramSlots)], ['M.2 slots', String(b.m2Slots)], ['SATA ports', String(b.sataPorts)], ['Draw', `${b.draw} W`], ['Lighting', lit(b.lightZones)]];
    }
    case 'cpu': { const c = getCpu(id); return c ? [['Socket', PLATFORMS.get(c.platform)?.socketLabel ?? ''], ['Cores', String(c.cores)], ['Draw', `${c.draw} W`]] : []; }
    case 'cooler': {
      const k = getCooler(id); if (!k) return [];
      const rows: [string, string][] = k.type === 'aio' ? [['Radiator', `${k.radSize} mm`], ['Fans', String(k.fans)]] : [['Height', `${k.height} mm`], ['Fans', String(k.fans)]];
      if (k.ramClearance !== null) rows.push(['Memory clearance', `${k.ramClearance} mm`]);
      return [...rows, ['Rated for', `${k.capacity} W`], ['Draw', `${k.draw} W`], ['Lighting', lit(k.lightZones)]];
    }
    case 'ram': { const r = getRam(id); return r ? [['Kit', `${r.sticks} × ${r.gbPerStick} GB`], ['Height', `${r.height} mm`], ['Draw', `${r.drawPerStick} W per stick`], ['Lighting', r.lit ? 'Lit' : 'None']] : []; }
    case 'gpu': {
      const g = getGpu(id); if (!g) return [];
      return [['Length', `${g.length} mm`], ['Thickness', `${g.thickness} mm`], ['Fans', String(g.fans)], ['Power', g.plugs], ['Draw', `${g.draw} W`], ['Lighting', lit(g.lightZones)]];
    }
    case 'storage': { const s = getStorage(id); return s ? [['Type', LABELS.storageType[s.type]], ['Capacity', `${s.capacityTb} TB`], ['Draw', `${s.draw} W`]] : []; }
    case 'psu': { const p = getPsu(id); return p ? [['Capacity', `${p.capacity} W`], ['Size', LABELS.psuForm[p.form]], ['Length', `${p.length} mm`]] : []; }
    case 'fan': { const f = getFan(id); return f ? [['Blades', String(f.blades)], ['Lighting', f.lit ? lit(f.lightZones) : 'None'], ['Draw', `${f.draw} W`]] : []; }
    case 'cables': return [];
  }
}

/** The tray's parts for a category, with the id the engine installs by: storage installs by its type. */
export function trayParts(category: Category): { id: string; brand: string; name: string }[] {
  if (category === 'storage') return catalog.storage.map((s) => ({ id: s.type, brand: s.brand, name: s.name }));
  return partsOf(category).map((p) => ({ id: p.id, brand: p.brand, name: p.name }));
}

export const brandOf = (brand: string) => brandName(brand);

export const storageCount = (b: Build, type: StorageType) => b.storage[type] ?? 0;

/** How many of a category are in the build, for the tab badge. */
export function installedCount(b: Build, category: Category): number {
  switch (category) {
    case 'case': return b.case ? 1 : 0;
    case 'board': return b.board ? 1 : 0;
    case 'cpu': return b.cpu ? 1 : 0;
    case 'cooler': return b.cooler ? 1 : 0;
    case 'ram': return b.ram.reduce((n, id) => n + (getRam(id)?.sticks ?? 0), 0);
    case 'gpu': return b.gpu ? 1 : 0;
    case 'storage': return b.storage.nvme + b.storage.ssd + b.storage.hdd;
    case 'psu': return b.psu ? 1 : 0;
    case 'fan': return Object.keys(b.fans).length;
    case 'cables': return 0;
  }
}
