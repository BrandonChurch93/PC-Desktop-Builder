import type { CaseLayout } from '../types';
import { ATRIUM } from './atrium';
import { VITRINE } from './vitrine';

export const CASE_LAYOUTS: Record<string, CaseLayout> = {
  vitrine: VITRINE,
  atrium: ATRIUM,
};
