import type { Tier } from './store';

/** Median frame time limits for the probe's first pick, in ms: at or under the first, High; under the second, Medium. */
export const PROBE_HIGH_MS = 12;
export const PROBE_MEDIUM_MS = 20;
/** The automatic tier steps down once when the median of this many frames stays over this. */
export const STEP_DOWN_MS = 24;
export const STEP_WINDOW = 90;
/** Phones and small touch screens start on Low: it is the phone experience. */
export const PHONE_SHORT_SIDE = 500;

const ORDER: Tier[] = ['high', 'medium', 'low'];

export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The first pick, from a short probe of frame times after the first build is shown. */
export function probeTier(samples: readonly number[], device: { coarse: boolean; shortSide: number }): Tier {
  if (device.coarse && device.shortSide < PHONE_SHORT_SIDE) return 'low';
  const m = median(samples);
  if (!samples.length || m <= PROBE_HIGH_MS) return 'high';
  return m <= PROBE_MEDIUM_MS ? 'medium' : 'low';
}

export type AutoState = { tier: Tier; window: number[]; stepped: boolean };

export const startAuto = (tier: Tier): AutoState => ({ tier, window: [], stepped: false });

/**
 * One frame time after the probe. Frames while the user is interacting do not count and clear the window, so the tier never
 * changes under a drag or an orbit. When a full window's median is over the limit, the tier steps down one level, once.
 */
export function feedAuto(s: AutoState, frameMs: number, interacting: boolean): AutoState {
  if (s.stepped || s.tier === 'low') return s;
  if (interacting) return s.window.length ? { ...s, window: [] } : s;
  const window = [...s.window, frameMs].slice(-STEP_WINDOW);
  if (window.length === STEP_WINDOW && median(window) > STEP_DOWN_MS) {
    return { tier: ORDER[ORDER.indexOf(s.tier) + 1] ?? 'low', window: [], stepped: true };
  }
  return { ...s, window };
}
