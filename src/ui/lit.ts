import { getBoard, getCase, getCooler, getFan, getGpu, getRam, type LightTarget } from '../data/catalog';
import type { Build } from '../engine/types';

/** The lighting targets that have at least one lit part in the build. */
export function litTargets(b: Build): Set<LightTarget> {
  const out = new Set<LightTarget>();
  if ((getCase(b.case?.id)?.lightZones ?? 0) > 0) out.add('case');
  if ((getBoard(b.board)?.lightZones ?? 0) > 0) out.add('board');
  if ((getCooler(b.cooler?.id)?.lightZones ?? 0) > 0) out.add('cooler');
  if (b.ram.some((id) => getRam(id)?.lit)) out.add('ram');
  if ((getGpu(b.gpu)?.lightZones ?? 0) > 0) out.add('gpu');
  if (Object.values(b.fans).some((id) => getFan(id)?.lit)) out.add('fans');
  return out;
}
