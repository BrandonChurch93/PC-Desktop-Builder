import type { CaseLayout } from '../types';
import { ATRIUM } from './atrium';
import { BULWARK } from './bulwark';
import { CUB } from './cub';
import { GANTRY } from './gantry';
import { VENT } from './vent';
import { VITRINE } from './vitrine';

export const CASE_LAYOUTS: Record<string, CaseLayout> = {
  vitrine: VITRINE,
  atrium: ATRIUM,
  vent: VENT,
  bulwark: BULWARK,
  cub: CUB,
  gantry: GANTRY,
};
