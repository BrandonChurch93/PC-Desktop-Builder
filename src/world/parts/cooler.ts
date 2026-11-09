import { airCoolerBoxes, pumpBoxes, radiatorBoxes } from '../layout/partBoxes';
import { getCooler } from '../../data/catalog';
import { boxesPart } from './stub';
import type { GenOpts, PartObject } from './types';

export function pumpPart(id: string, _opts: GenOpts = {}): PartObject {
  const k = getCooler(id);
  return boxesPart(`cooler-${id}`, k && k.type === 'aio' ? pumpBoxes() : airCoolerBoxes(id));
}
export function radiatorPart(id: string, opts: GenOpts = {}): PartObject {
  const k = getCooler(id);
  return boxesPart(`radiator-${id}`, radiatorBoxes({ size: k?.radSize ?? 360, order: opts.order ?? 'rad-first', pitch: opts.pitch ?? 122 }));
}
export function coolerPart(id: string, opts: GenOpts = {}): PartObject { return pumpPart(id, opts); }
