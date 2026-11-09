import { catalog, getCase, getCooler, getGpu, type CaseSpec } from '../../src/data/catalog';
import { emptyBuild, install, revalidate } from '../../src/engine/rules';
import type { Build } from '../../src/engine/types';
import { BOARD_FRONT, BOARD_LAYOUTS } from '../../src/world/layout/boards';
import { CASE_LAYOUTS } from '../../src/world/layout/cases';
import { DIMS } from '../../src/world/layout/dims';
import { overlap, type Box } from '../../src/world/layout/math';
import { gpuPose, isContact, place, type Placed } from '../../src/world/layout/place';

export type Hit = { a: string; b: string; tagA: string; tagB: string; depth: number };

export function intersections(placed: Placed[], tolerance = 0.5): Hit[] {
  const hits: Hit[] = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const A = placed[i]!; const B = placed[j]!;
    if (A.part === B.part) continue;
    for (const ba of A.boxes) for (const bb of B.boxes) {
      if (isContact({ kind: A.kind, tag: ba.tag }, { kind: B.kind, tag: bb.tag })) continue;
      const d = overlap(ba, bb);
      if (d > tolerance) hits.push({ a: A.key, b: B.key, tagA: ba.tag, tagB: bb.tag, depth: Math.round(d * 100) / 100 });
    }
  }
  return hits;
}

/** A board of the largest size the case takes, with its processor. */
export function baseBuild(c: CaseSpec, boardId?: string): Build {
  let b = install(emptyBuild(), 'case', c.id, { finish: c.finishes[0] }).build;
  const board = boardId ? catalog.boards.find((x) => x.id === boardId)! : catalog.boards.find((x) => c.boardSizes.includes(x.size) && x.size === c.boardSizes[0])!;
  b = install(b, 'board', board.id).build;
  const cpu = catalog.cpus.find((x) => x.platform === board.platform)!;
  b = install(b, 'cpu', cpu.id).build;
  return b;
}

export function withAllFans(b: Build, fanId = 'gale'): Build {
  const c = getCase(b.case?.id)!;
  const next = structuredClone(b);
  for (const m of c.fanMounts) next.fans[m.id] = fanId;
  return revalidate(next).build;
}

export function tallestPassing(c: CaseSpec): number {
  return Math.max(0, ...catalog.gpus.filter((g) => g.thickness <= c.gpuMaxThickness && g.length <= c.gpuMaxLength).map((g) => g.height));
}

/** Free length from the bracket to the nearest obstacle across the envelope a card can occupy. */
export function freeGpuLength(b: Build): number {
  const c = getCase(b.case?.id)!;
  const L = CASE_LAYOUTS[c.id]!;
  const pose = gpuPose(L, b.board);
  const H = tallestPassing(c);
  const y0 = pose.pos[1] - (c.gpuMaxThickness - DIMS.backplateRise); const y1 = pose.pos[1] + DIMS.backplateRise;
  const z0 = pose.pos[2] + (DIMS.cardClear - DIMS.fingerSeat); const z1 = pose.pos[2] - DIMS.fingerSeat + H;
  let nearest = Infinity;
  for (const p of place(b)) {
    if (p.kind === 'gpu' || p.kind === 'board' || p.kind === 'gpu-support') continue;
    for (const bx of p.boxes) {
      if (bx.max[1] <= y0 || bx.min[1] >= y1 || bx.max[2] <= z0 || bx.min[2] >= z1) continue;
      if (bx.max[0] <= L.bracketX + 1) continue;
      nearest = Math.min(nearest, bx.min[0]);
    }
  }
  return nearest - L.bracketX;
}

export function freeCpuHeight(b: Build): number {
  const c = getCase(b.case?.id)!;
  const L = CASE_LAYOUTS[c.id]!;
  const cpu = place(b).find((p) => p.kind === 'cpu')!;
  const top = cpu.pose.pos[2] + DIMS.cpuTop - 2;
  let nearest = L.sideInner;
  for (const bx of L.boxes) {
    if (bx.min[2] < top) continue;
    if (bx.max[0] <= cpu.pose.pos[0] - 22 || bx.min[0] >= cpu.pose.pos[0] + 22 || bx.max[1] <= cpu.pose.pos[1] - 22 || bx.min[1] >= cpu.pose.pos[1] + 22) continue;
    nearest = Math.min(nearest, bx.min[2]);
  }
  return nearest - top;
}

export function psuBayLength(caseId: string): number {
  const c = getCase(caseId)!;
  const L = CASE_LAYOUTS[caseId]!;
  const d = DIMS.psu[c.psuForm];
  const s = L.supply;
  const axis = s.dir.findIndex((v) => Math.abs(v) > 0.5);
  const sign = s.dir[axis]! > 0 ? 1 : -1;
  const across = s.rot[0] === 0 && s.rot[1] === 0 && s.rot[2] === 0 ? null : 'rotated';
  let nearest = Infinity;
  for (const bx of L.boxes) {
    const lo = sign > 0 ? bx.min[axis]! : -bx.max[axis]!;
    const start = sign > 0 ? s.rearFace[axis]! : -s.rearFace[axis]!;
    if (lo < start + 0.5) continue;
    const ok = [0, 1, 2].every((i) => {
      if (i === axis) return true;
      const half = across === null ? (i === 1 ? [0, d.h] : [-d.w / 2, d.w / 2]) : (i === 1 ? [0, d.w] : [-d.h / 2, d.h / 2]);
      const lo2 = s.rearFace[i]! + half[0]!; const hi2 = s.rearFace[i]! + half[1]!;
      return !(bx.max[i]! <= lo2 + 0.01 || bx.min[i]! >= hi2 - 0.01);
    });
    if (ok) nearest = Math.min(nearest, lo - start);
  }
  return nearest;
}

export function ramGap(c: CaseSpec, coolerId: string): number | null {
  const k = getCooler(coolerId)!;
  if (k.ramClearance === null) return null;
  const b = { ...baseBuild(c), cooler: { id: coolerId, mount: null } };
  const placed = place(b);
  const board = placed.find((p) => p.kind === 'board')!;
  const cooler = placed.find((p) => p.kind === 'cooler')!;
  const BL = BOARD_LAYOUTS[catalog.boards.find((x) => x.id === b.board)!.size];
  const floor = board.pose.pos[2] + BOARD_FRONT + DIMS.dimmFloor;
  let under = Infinity;
  for (const d of BL.dimms) {
    const x = board.pose.pos[0] + d.x; const y = board.pose.pos[1] + d.y;
    for (const bx of cooler.boxes) {
      if (bx.tag === 'plate' || bx.tag === 'pipes') continue;
      if (bx.max[0] <= x - 3.3 || bx.min[0] >= x + 3.3 || bx.max[1] <= y - 66 || bx.min[1] >= y + 66) continue;
      under = Math.min(under, bx.min[2]);
    }
  }
  return under - floor;
}

export function cardTop(b: Build, gpuId: string): number {
  const c = getCase(b.case?.id)!;
  const L = CASE_LAYOUTS[c.id]!;
  const g = getGpu(gpuId)!;
  return gpuPose(L, b.board).pos[2] - DIMS.fingerSeat + g.height;
}

export const boxOf = (p: Placed, tag: string): Box | undefined => p.boxes.find((b) => b.tag === tag);
