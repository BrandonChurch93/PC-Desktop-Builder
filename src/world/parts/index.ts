import type { Category } from '../../data/catalog';
import type { PlacedKind } from '../layout/place';
import { boardPart } from './board';
import { casePart } from './case';
import { coolerPart, pumpPart, radiatorPart } from './cooler';
import { cpuPart } from './cpu';
import { fanPart } from './fan';
import { gpuPart, supportPart } from './gpu';
import { psuPart } from './psu';
import { ramPart } from './ram';
import { storagePart } from './storage';
import type { GenOpts, PartObject } from './types';

/** Builds the object for one placed item. */
export function generate(kind: PlacedKind, id: string, opts: GenOpts = {}): PartObject {
  switch (kind) {
    case 'case': return casePart(id, opts);
    case 'board': return boardPart(id, opts);
    case 'cpu': return cpuPart(id, opts);
    case 'cooler': return pumpPart(id, opts);
    case 'radiator': return radiatorPart(id, opts);
    case 'ram': return ramPart(id, opts);
    case 'gpu': return gpuPart(id, opts);
    case 'gpu-support': return supportPart(id, opts);
    case 'storage': return storagePart(id, opts);
    case 'psu': return psuPart(id, opts);
    case 'fan': return fanPart(id, opts);
  }
}

/** The whole part as the Inspector shows it: a liquid cooler with its radiator, a memory kit as one stick. */
export function inspectPart(category: Category, id: string, opts: GenOpts = {}): PartObject {
  switch (category) {
    case 'cooler': return coolerPart(id, { ...opts, loose: true });
    case 'fan': return fanPart(id, { ...opts, loose: true });
    case 'storage': return generate('storage', id, { ...opts, loose: true });
    case 'cables': throw new Error('cables have no inspector part');
    default: return generate(category as PlacedKind, id, opts);
  }
}
