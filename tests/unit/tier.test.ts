import { describe, expect, it } from 'vitest';
import { feedAuto, median, PHONE_SHORT_SIDE, PROBE_HIGH_MS, PROBE_MEDIUM_MS, probeTier, startAuto, STEP_DOWN_MS, STEP_WINDOW, type AutoState } from '../../src/state/tier';

const desk = { coarse: false, shortSide: 900 };
const run = (s: AutoState, ms: number, n: number, interacting = false) => { for (let i = 0; i < n; i++) s = feedAuto(s, ms, interacting); return s; };

describe('A9: the automatic quality tier', () => {
  it('picks from the probe median', () => {
    expect(probeTier(Array(30).fill(PROBE_HIGH_MS - 1), desk)).toBe('high');
    expect(probeTier(Array(30).fill(PROBE_HIGH_MS), desk)).toBe('high');
    expect(probeTier(Array(30).fill(PROBE_MEDIUM_MS - 1), desk)).toBe('medium');
    expect(probeTier(Array(30).fill(PROBE_MEDIUM_MS + 1), desk)).toBe('low');
    // The median, not the mean: a few hitches do not decide it.
    expect(probeTier([...Array(25).fill(8), 200, 200, 200, 200, 200], desk)).toBe('high');
    expect(probeTier([], desk)).toBe('high');
  });

  it('starts a phone on Low', () => {
    expect(probeTier(Array(30).fill(5), { coarse: true, shortSide: PHONE_SHORT_SIDE - 1 })).toBe('low');
    expect(probeTier(Array(30).fill(5), { coarse: true, shortSide: PHONE_SHORT_SIDE })).toBe('high');
  });

  it('steps down once when the median stays over the limit', () => {
    let s = run(startAuto('high'), STEP_DOWN_MS + 5, STEP_WINDOW - 1);
    expect(s.tier).toBe('high');
    s = feedAuto(s, STEP_DOWN_MS + 5, false);
    expect(s.tier).toBe('medium');
    s = run(s, STEP_DOWN_MS + 50, STEP_WINDOW * 3);
    expect(s.tier).toBe('medium');
  });

  it('does not step down for a median at or under the limit, or for short spikes', () => {
    expect(run(startAuto('high'), STEP_DOWN_MS, STEP_WINDOW * 2).tier).toBe('high');
    let s = startAuto('high');
    for (let i = 0; i < STEP_WINDOW * 2; i++) s = feedAuto(s, i % 3 === 0 ? 80 : 10, false);
    expect(s.tier).toBe('high');
  });

  it('never changes while the user is interacting', () => {
    let s = run(startAuto('high'), STEP_DOWN_MS + 30, STEP_WINDOW * 4, true);
    expect(s.tier).toBe('high');
    // Interaction clears what was gathered, so slow frames before a drag and after it are not joined.
    s = run(startAuto('high'), STEP_DOWN_MS + 30, STEP_WINDOW - 1);
    s = feedAuto(s, STEP_DOWN_MS + 30, true);
    s = run(s, STEP_DOWN_MS + 30, STEP_WINDOW - 1);
    expect(s.tier).toBe('high');
  });

  it('has nowhere to go from Low, and is a pure function', () => {
    expect(run(startAuto('low'), 100, STEP_WINDOW * 2).tier).toBe('low');
    const a = startAuto('high'); const b = feedAuto(a, 30, false);
    expect(a.window).toEqual([]);
    expect(b).not.toBe(a);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
