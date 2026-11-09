import { boardBoxes } from '../layout/partBoxes';
import { boxesPart } from './stub';
import type { GenOpts, PartObject } from './types';

export function boardPart(id: string, _opts: GenOpts = {}): PartObject { return boxesPart(`board-${id}`, boardBoxes(id)); }
