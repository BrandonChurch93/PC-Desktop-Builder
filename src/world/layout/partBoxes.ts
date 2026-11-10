import { getCooler, getCpu, getGpu, getPsu, getRam, K, type StorageType } from '../../data/catalog';
import { boardBoxes } from './boards';
import { DIMS } from './dims';
import { box, cbox, type Box } from './math';

export const slotsOf = (thickness: number) => Math.max(2, Math.ceil(thickness / K.slotPitch));

/** Card space: origin at the bracket end of the edge connector, at its bottom edge. +x toward the front, +z toward the glass, -y is thickness. */
export function gpuBoxes(id: string): Box[] {
  const g = getGpu(id);
  if (!g) return [];
  const L = g.length; const H = g.height - DIMS.fingerSeat; const T = g.thickness;
  const back = -DIMS.fingerOffset;
  const end = L + back;
  const bp = DIMS.backplateRise;
  const pcbTop = Math.min(H, 112);
  const clear = DIMS.cardClear - DIMS.fingerSeat;
  const slots = slotsOf(T);
  return [
    box([back, bp - slots * K.slotPitch, -9], [back + DIMS.bracketT, bp, 112.2], 'bracket'),
    box([back - 11, bp - slots * K.slotPitch, 108], [back, bp, 115], 'tab'),
    box([back + 1, -13, 8], [back + 16, 4, 86], 'ports'),
    box([back + 1, -0.8, 3], [0, 0.8, pcbTop], 'pcb'),
    box([0, -0.8, 9], [DIMS.pcieX16Length, 0.8, pcbTop], 'pcb'),
    box([DIMS.pcieX16Length, -0.8, 3], [end, 0.8, pcbTop], 'pcb'),
    box([0, -0.9, 0], [DIMS.pcieX16Length, 0.9, 9], 'edge'),
    box([back + 1, -(T - bp), clear], [end, -0.8, H], 'body'),
    box([back + 1, 0.8, clear], [end, bp, H], 'backplate'),
  ];
}

export function cpuBoxes(id: string): Box[] {
  const c = getCpu(id);
  if (!c) return [];
  const [w, h] = c.platform === 'hb' ? [40, 58] : [45, 45];
  return [cbox([0, 0, (DIMS.cpuTop - 2) / 2], [w, h, DIMS.cpuTop - 2], 'package')];
}

/** Liquid cooler pump, origin at the center of its contact plate. Fittings point to local +x. */
export function pumpBoxes(): Box[] {
  return [
    box([-38, -38, 0], [38, 38, 6], 'plate'),
    box([-35, -35, 6], [35, 35, 52], 'pump'),
    box([-18, 34, 28], [18, 50, 48], 'fitting'),
  ];
}

export type RadOpts = { size: number; order: 'fans-first' | 'rad-first'; pitch: number };

/** Radiator assembly, origin at the center of its mount face. Local x along the radiator, +z inward. Fittings at the +x end. */
export function radiatorBoxes(o: RadOpts): Box[] {
  const L = DIMS.radLength[o.size] ?? 397;
  const n = Math.round(o.size / 120);
  const half = ((n - 1) / 2) * o.pitch + 60;
  const w = DIMS.radWidth / 2;
  const fan = DIMS.fan[120].thick;
  if (o.order === 'rad-first') {
    return [
      box([-L / 2, -w, 0], [L / 2, w, DIMS.radThick], 'radiator'),
      box([-half, -60, DIMS.radThick], [half, 60, DIMS.radThick + fan], 'fans'),
      box([L / 2 - 16, -26, DIMS.radThick], [L / 2 - 1.5, 26, DIMS.radThick + 18], 'fitting'),
    ];
  }
  return [
    box([-half, -60, 0], [half, 60, fan], 'fans'),
    box([-L / 2, -w, fan], [L / 2, w, fan + DIMS.radThick], 'radiator'),
    box([L / 2 - 20, -26, fan + DIMS.radThick], [L / 2 - 4, 26, fan + DIMS.radThick + 18], 'fitting'),
  ];
}

export const radiatorDepth = () => DIMS.radThick + DIMS.fan[120].thick;

export function fanBoxes(size: 120 | 140): Box[] {
  const s = DIMS.fan[size].size / 2; const t = DIMS.fan[size].thick / 2;
  return [box([-s, -s, -t], [s, s, t], 'fan')];
}

/** Memory stick, origin at the center of its bottom edge on the slot floor. Length along y, height along +z. */
export function ramBoxes(id: string): Box[] {
  const r = getRam(id);
  if (!r) return [];
  const half = DIMS.dimmLength / 2;
  const seat = DIMS.dimmSlotHeight - DIMS.dimmFloor + 0.2;
  return [
    box([-0.8, -half, 0], [0.8, half, seat], 'edge'),
    box([-DIMS.dimmThick / 2, -half, seat], [DIMS.dimmThick / 2, half, r.height], 'body'),
  ];
}

export function psuBoxes(id: string): Box[] {
  const p = getPsu(id);
  if (!p) return [];
  const d = DIMS.psu[p.form];
  return [box([-p.length / 2, 0, -d.w / 2], [p.length / 2, d.h, d.w / 2], 'psu')];
}

export function storageBoxes(type: StorageType): Box[] {
  if (type === 'nvme') return [box([-1, -11, 0], [DIMS.m2Length + 1, 11, 3.4], 'nvme')];
  if (type === 'ssd') return [box([-DIMS.ssd.w / 2, 0, -DIMS.ssd.l / 2], [DIMS.ssd.w / 2, DIMS.ssd.h, DIMS.ssd.l / 2], 'ssd')];
  return [box([-DIMS.hdd.w / 2, 0, -DIMS.hdd.l / 2], [DIMS.hdd.w / 2, DIMS.hdd.h, DIMS.hdd.l / 2], 'hdd')];
}

/** Height above the contact plate of a cooler's underside over the memory, from its ram clearance. */
export const overhangZ = (ramClearance: number) => ramClearance + DIMS.dimmFloor - DIMS.cpuTop;

/** Air coolers, origin at the center of the contact plate, +z away from the board, air leaves toward -x. */
export function airCoolerBoxes(id: string): Box[] {
  const k = getCooler(id);
  if (!k || k.type === 'aio') return [];
  const h = k.height ?? 60;
  // The base, and the X bracket with its sprung thumbscrews out to the socket's corner holes.
  const plate = [box([-20, -20, 0], [20, 20, 6], 'plate'), box([-47.5, -47.5, 6], [47.5, 47.5, 12.6], 'bracket')];
  if (k.type === 'lowprofile') {
    const under = overhangZ(k.ramClearance ?? 34);
    // Pipes leave the base flat toward its sides and rise near the stack's edges; the fan's screw heads sit on its pads.
    return [...plate, box([-50, -54, 0], [28, 54, under], 'pipes'), box([-38, -62, under], [86, 62, h - 15], 'stack'), box([-36, -60, h - 15], [84, 60, h + 2], 'fan')];
  }
  if (k.fans >= 2) {
    const under = overhangZ(k.ramClearance ?? 45);
    // The front fan's wire clips reach round its frame's corners.
    return [...plate, box([-30, -30, 6], [30, 30, under], 'pipes'), box([-50, -62.5, under], [65, 62.5, h], 'stack'), box([65, -64, under + 3], [95, 64, h - 2], 'fan')];
  }
  return [...plate, box([-24, -30, 6], [24, 30, 40], 'pipes'), box([-37.5, -62.5, 40], [12.5, 62.5, h], 'stack'), box([12.5, -64, h - 122], [42, 64, h - 2], 'fan')];
}

export { boardBoxes };
