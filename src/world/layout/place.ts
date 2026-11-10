import { getBoard, getCase, getCooler, getCpu, getGpu, getPsu, getRam, type Category, type StorageType } from '../../data/catalog';
import { occupiedFanMounts, radMount } from '../../engine/rules';
import type { Build } from '../../engine/types';
import { BOARD_FRONT, boardBoxes, boardLayout, dimmFill } from './boards';
import { CASE_LAYOUTS } from './cases';
import { DIMS } from './dims';
import { add, box, compose, R0, scale, transformBox, type Box, type Pose, type V3 } from './math';
import { airCoolerBoxes, cpuBoxes, fanBoxes, gpuBoxes, psuBoxes, pumpBoxes, radiatorBoxes, ramBoxes, storageBoxes } from './partBoxes';
import type { CaseLayout } from './types';

export type PlacedKind = 'case' | 'board' | 'cpu' | 'cooler' | 'radiator' | 'ram' | 'gpu' | 'gpu-support' | 'storage' | 'psu' | 'fan';

export type Placed = {
  key: string;
  kind: PlacedKind;
  category: Category;
  id: string;
  /** which installed part this object belongs to, for collision grouping */
  part: string;
  pose: Pose;
  local: Box[];
  boxes: Box[];
  /** insertion direction in case space, unit, pointing the way the part moves as it seats */
  insert: V3;
  meta: Record<string, string | number | boolean>;
};

export const caseLayout = (id: string): CaseLayout | undefined => CASE_LAYOUTS[id];

const place1 = (p: Omit<Placed, 'boxes'>): Placed => ({ ...p, boxes: p.local.map((b) => transformBox(p.pose, b)) });

export function boardPose(L: CaseLayout): Pose { return { pos: L.boardAnchor, rot: R0 }; }

export function gpuPose(L: CaseLayout, boardId: string | null): Pose {
  if (L.riser) return L.riser;
  const b = boardId ? getBoard(boardId) : undefined;
  const slot = b ? boardLayout(b).pcie[0] : undefined;
  const y = slot ? slot.y : -160;
  const x0 = slot ? slot.x0 : 22;
  return { pos: add(L.boardAnchor, [x0, y, BOARD_FRONT + DIMS.fingerSeat]), rot: R0 };
}

export function radiatorPose(L: CaseLayout, mountId: string, size: number): { pose: Pose; pitch: number; order: 'fans-first' | 'rad-first'; airInward: boolean } | null {
  const m = L.radMounts.find((r) => r.id === mountId);
  if (!m) return null;
  const n = Math.round(size / 120);
  const mounts = L.fanMounts.filter((f) => f.group === m.group).slice(0, n);
  if (mounts.length === 0) return null;
  const c: V3 = [0, 0, 0];
  for (const f of mounts) for (let i = 0; i < 3; i++) c[i] = c[i]! + f.center[i]! / mounts.length;
  const face = add(c, scale(m.inward, -m.faceOffset));
  return { pose: { pos: face, rot: m.rot }, pitch: DIMS.radFanPitch, order: m.order, airInward: m.airInward };
}

export function place(build: Build): Placed[] {
  const out: Placed[] = [];
  if (!build.case) return out;
  const spec = getCase(build.case.id);
  const L = spec ? CASE_LAYOUTS[spec.id] : undefined;
  if (!spec || !L) return out;
  const caseLocal: Box[] = L.boxes;
  out.push(place1({ key: 'case', kind: 'case', category: 'case', id: spec.id, part: 'case', pose: { pos: [0, 0, 0], rot: R0 }, local: caseLocal, insert: [0, -1, 0], meta: { finish: build.case.finish } }));

  const board = build.board ? getBoard(build.board) : undefined;
  const bPose = boardPose(L);
  if (board) {
    out.push(place1({ key: 'board', kind: 'board', category: 'board', id: board.id, part: 'board', pose: bPose, local: boardBoxes(board.id), insert: [0, 0, -1], meta: {} }));
  }
  const BL = board ? boardLayout(board) : undefined;

  const cpu = build.cpu ? getCpu(build.cpu) : undefined;
  if (cpu && BL) {
    const pose = compose(bPose, { pos: [BL.socket.x, BL.socket.y, BOARD_FRONT + 2], rot: R0 });
    out.push(place1({ key: 'cpu', kind: 'cpu', category: 'cpu', id: cpu.id, part: 'cpu', pose, local: cpuBoxes(cpu.id), insert: [0, 0, -1], meta: {} }));
  }

  const cooler = build.cooler ? getCooler(build.cooler.id) : undefined;
  if (cooler && BL) {
    const plate = compose(bPose, { pos: [BL.socket.x, BL.socket.y, BOARD_FRONT + DIMS.cpuTop], rot: R0 });
    if (cooler.type === 'aio') {
      out.push(place1({ key: 'cooler', kind: 'cooler', category: 'cooler', id: cooler.id, part: 'cooler', pose: plate, local: pumpBoxes(), insert: [0, 0, -1], meta: { pump: true } }));
      const rm = radMount(build);
      const rp = rm && cooler.radSize ? radiatorPose(L, rm.id, cooler.radSize) : null;
      if (rp && cooler.radSize) {
        const local = radiatorBoxes({ size: cooler.radSize, order: rp.order, pitch: rp.pitch });
        const m = L.radMounts.find((x) => x.id === rm?.id);
        out.push(place1({ key: 'radiator', kind: 'radiator', category: 'cooler', id: cooler.id, part: 'cooler', pose: rp.pose, local, insert: m ? scale(m.inward, -1) : [0, 1, 0], meta: { mount: rm?.id ?? '', order: rp.order, pitch: rp.pitch, airInward: rp.airInward, size: cooler.radSize } }));
      }
    } else {
      out.push(place1({ key: 'cooler', kind: 'cooler', category: 'cooler', id: cooler.id, part: 'cooler', pose: plate, local: airCoolerBoxes(cooler.id), insert: [0, 0, -1], meta: {} }));
    }
  }

  if (board && BL) {
    const kits = build.ram.map((id) => getRam(id)?.sticks ?? 0);
    const fill = dimmFill(board.ramSlots, kits);
    build.ram.forEach((id, k) => {
      for (const slot of fill[k] ?? []) {
        const d = BL.dimms.find((s) => s.name === slot);
        if (!d) continue;
        const pose = compose(bPose, { pos: [d.x, d.y, BOARD_FRONT + DIMS.dimmFloor], rot: R0 });
        out.push(place1({ key: `ram:${k}:${slot}`, kind: 'ram', category: 'ram', id, part: `ram:${k}`, pose, local: ramBoxes(id), insert: [0, 0, -1], meta: { slot, kit: k } }));
      }
    });
  }

  const gpu = build.gpu ? getGpu(build.gpu) : undefined;
  if (gpu && (board || L.riser)) {
    const pose = gpuPose(L, board?.id ?? null);
    out.push(place1({ key: 'gpu', kind: 'gpu', category: 'gpu', id: gpu.id, part: 'gpu', pose, local: gpuBoxes(gpu.id), insert: [0, 0, -1], meta: {} }));
    if (gpu.id === 'crest' && spec.open) {
      // An open frame has no floor under the card: a short arm swings out from the backplate to the far end's underside.
      const x = pose.pos[0] + gpu.length - DIMS.fingerOffset - 34;
      const bottom = pose.pos[1] - (gpu.thickness - DIMS.backplateRise);
      const plate = L.boardAnchor[2] - DIMS.standoff;
      const reach = pose.pos[2] + gpu.height * 0.55 - plate;
      const local = [box([-9, -16, 0], [9, 0, reach], 'support')];
      out.push(place1({ key: 'gpu-support', kind: 'gpu-support', category: 'gpu', id: gpu.id, part: 'gpu', pose: { pos: [x, bottom, plate], rot: R0 }, local, insert: [0, 0, -1], meta: { arm: true } }));
    }
    if (gpu.id === 'crest' && !spec.open) {
      const x = pose.pos[0] + gpu.length - DIMS.fingerOffset - 34;
      const bottom = pose.pos[1] - (gpu.thickness - DIMS.backplateRise);
      const z = pose.pos[2] + gpu.height * 0.55;
      const local = [box([-9, 0, -9], [9, bottom - L.supportFloorY, 9], 'support')];
      out.push(place1({ key: 'gpu-support', kind: 'gpu-support', category: 'gpu', id: gpu.id, part: 'gpu', pose: { pos: [x, L.supportFloorY, z], rot: R0 }, local, insert: [0, 1, 0], meta: {} }));
    }
  }

  if (board && BL) {
    const slots = BL.m2.slice(0, board.m2Slots);
    for (let i = 0; i < build.storage.nvme && i < slots.length; i++) {
      const m = slots[i]!;
      const z = BOARD_FRONT + 2.2 + (m.level === 1 ? 8.2 : 0);
      const pose = compose(bPose, { pos: [m.x0, m.y, z], rot: R0 });
      out.push(place1({ key: `storage:nvme:${i}`, kind: 'storage', category: 'storage', id: 'nvme', part: `nvme:${i}`, pose, local: storageBoxes('nvme'), insert: [0, 0, -1], meta: { slot: i + 1, level: m.level } }));
    }
  }
  for (const [type, bays] of [['ssd', L.bays25], ['hdd', L.bays35]] as [StorageType, CaseLayout['bays25']][]) {
    for (let i = 0; i < build.storage[type] && i < bays.length; i++) {
      const bay = bays[i]!;
      out.push(place1({ key: `storage:${type}:${i}`, kind: 'storage', category: 'storage', id: type, part: `${type}:${i}`, pose: bay.pose, local: storageBoxes(type), insert: bay.insert, meta: { bay: i } }));
    }
  }

  const psu = build.psu ? getPsu(build.psu) : undefined;
  if (psu) {
    const pos = add(L.supply.rearFace, scale(L.supply.dir, psu.length / 2));
    out.push(place1({ key: 'psu', kind: 'psu', category: 'psu', id: psu.id, part: 'psu', pose: { pos, rot: L.supply.rot }, local: psuBoxes(psu.id), insert: L.supply.insert, meta: {} }));
  }

  const taken = new Set(occupiedFanMounts(build));
  for (const m of L.fanMounts) {
    const id = build.fans[m.id];
    if (!id || taken.has(m.id)) continue;
    out.push(place1({ key: `fan:${m.id}`, kind: 'fan', category: 'fan', id, part: `fan:${m.id}`, pose: { pos: m.center, rot: m.rot }, local: fanBoxes(m.size), insert: [0, 0, 0], meta: { mount: m.id, size: m.size } }));
  }
  for (const p of out) if (p.kind === 'fan') p.insert = mountInsert(L, String(p.meta.mount));
  return out;
}

function mountInsert(L: CaseLayout, id: string): V3 {
  const m = L.fanMounts.find((f) => f.id === id);
  if (!m) return [0, -1, 0];
  const r = L.radMounts.find((x) => x.group === m.group);
  if (r) return scale(r.inward, -1);
  return m.group === 'rear' ? [-1, 0, 0] : m.group === 'front' || m.group === 'spine' ? [1, 0, 0] : m.group === 'top' ? [0, 1, 0] : m.group === 'bottom' ? [0, -1, 0] : [0, 0, -1];
}

/** Pairs of boxes that are meant to touch or nest: a card in its slot, a stick in its slot, a drive under its plate. */
export function isContact(a: { kind: PlacedKind; tag: string }, b: { kind: PlacedKind; tag: string }): boolean {
  const pair = (k1: PlacedKind, t1: (t: string) => boolean, k2: PlacedKind, t2: (t: string) => boolean) =>
    (a.kind === k1 && t1(a.tag) && b.kind === k2 && t2(b.tag)) || (b.kind === k1 && t1(b.tag) && a.kind === k2 && t2(a.tag));
  const is = (x: string) => (t: string) => t === x;
  const starts = (x: string) => (t: string) => t.startsWith(x);
  const any = () => true;
  return (
    pair('ram', is('edge'), 'board', starts('dimm')) ||
    pair('gpu', is('edge'), 'board', is('pcie1')) ||
    pair('cpu', any, 'board', is('socket')) ||
    pair('cooler', is('plate'), 'cpu', any) ||
    pair('cooler', is('plate'), 'board', is('socket')) ||
    pair('storage', is('nvme'), 'board', starts('m2')) ||
    pair('gpu', is('tab'), 'case', any) ||
    pair('gpu', is('bracket'), 'case', is('rear'))
  );
}
