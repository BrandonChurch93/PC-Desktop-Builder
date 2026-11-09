import { CASE_LAYOUTS } from '../layout/cases';
import { boxesPart } from './stub';
import type { GenOpts, PartObject } from './types';

export function casePart(id: string, _opts: GenOpts = {}): PartObject { return boxesPart(`case-${id}`, (CASE_LAYOUTS[id]?.boxes ?? []).filter((b) => b.tag !== 'glass' && b.tag !== 'right')); }
