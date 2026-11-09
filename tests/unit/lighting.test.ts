import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/data/catalog';
import { ledColor, ledHash, zoneTemp, type Led } from '../../src/engine/lighting';
import type { Profile } from '../../src/engine/types';
import { rng } from './rng';

const EFFECTS = catalog.lighting.effects.map((e) => e.id);
const base = (effect: string, extra: Partial<Profile> = {}): Profile => ({ effect, speed: 60, brightness: 85, direction: 1, stops: ['#ff2bd1', '#7b3dff', '#18e0ff'], ...extra });

function leds(seed: number, count: number): Led[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({ u: r.next(), pn: r.next() * 1.4, phase: r.next(), hash: ledHash(`zone-${i % 7}`, i), tempC: 25 + r.next() * 70 }));
}

describe('lighting math', () => {
  it('has eight effects', () => expect(EFFECTS).toHaveLength(8));

  it('static does not change with time', () => {
    for (const led of leds(1, 50)) {
      const a = ledColor(base('static'), 0, led, 1);
      for (const t of [0.3, 3.2, 17, 1000]) expect(ledColor(base('static'), t, led, 1)).toEqual(a);
    }
  });

  it('spectrum gives every LED the same color', () => {
    for (const t of [0, 1.7, 3.2, 44]) {
      const all = leds(2, 40).map((led) => ledColor(base('spectrum'), t, led, 1));
      for (const c of all) expect(c).toEqual(all[0]);
    }
  });

  it('color shift gives every LED the same color', () => {
    for (const t of [0, 1.7, 3.2]) {
      const all = leds(3, 40).map((led) => ledColor(base('shift'), t, led, 1));
      for (const c of all) expect(c).toEqual(all[0]);
    }
  });

  it('brightness 0 is black for every effect', () => {
    for (const effect of EFFECTS) for (const led of leds(4, 20)) for (const t of [0, 2.5, 9]) {
      expect(ledColor(base(effect, { brightness: 0 }), t, led, 1)).toEqual({ r: 0, g: 0, b: 0 });
    }
  });

  it('power 0 is black for every effect', () => {
    for (const effect of EFFECTS) for (const led of leds(5, 10)) expect(ledColor(base(effect), 3.2, led, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('reversing direction mirrors wave in time', () => {
    for (const led of leds(6, 40)) for (const t of [0.4, 3.2, 12.5]) {
      const back = ledColor(base('wave', { direction: -1 }), t, led, 1);
      const mirrored = ledColor(base('wave', { direction: 1 }), -t, led, 1);
      expect(back.r).toBeCloseTo(mirrored.r, 12);
      expect(back.g).toBeCloseTo(mirrored.g, 12);
      expect(back.b).toBeCloseTo(mirrored.b, 12);
    }
  });

  it('reversing direction changes a moving wave', () => {
    const led = leds(8, 1)[0]!;
    const a = ledColor(base('wave'), 3.2, led, 1);
    const b = ledColor(base('wave', { direction: -1 }), 3.2, led, 1);
    expect(a).not.toEqual(b);
  });

  it('every effect returns finite colors in range', () => {
    const r = rng(9);
    for (const effect of EFFECTS) for (const led of leds(10, 60)) {
      const p = base(effect, { speed: r.int(151), brightness: r.int(101), direction: r.next() < 0.5 ? 1 : -1, stops: ['#ffffff', '#00ff00', '#ff0000', '#0000ff', '#ffffff', '#123456'].slice(0, 2 + r.int(5)) });
      for (const t of [0, 0.01, 3.2, 99.9, 12345]) {
        const c = ledColor(p, t, led, r.next());
        for (const v of [c.r, c.g, c.b]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('thermal runs from cold blue to red', () => {
    const led = leds(11, 1)[0]!;
    const cold = ledColor(base('thermal', { brightness: 100 }), 0, { ...led, tempC: 30 }, 1);
    const hot = ledColor(base('thermal', { brightness: 100 }), 0, { ...led, tempC: 90 }, 1);
    expect(cold.b).toBeGreaterThan(cold.r);
    expect(hot.r).toBe(1);
    expect(hot.g).toBe(0);
    expect(hot.b).toBe(0);
  });

  it('zone temperatures follow the rule for each target', () => {
    expect(zoneTemp('cooler', { cpuC: 50, gpuC: 70 })).toBe(50);
    expect(zoneTemp('board', { cpuC: 50, gpuC: 70 })).toBe(50);
    expect(zoneTemp('gpu', { cpuC: 50, gpuC: 70 })).toBe(70);
    expect(zoneTemp('ram', { cpuC: 50, gpuC: 70 })).toBe(60);
    expect(zoneTemp('gpu', { cpuC: 50, gpuC: null })).toBe(50);
    expect(zoneTemp('fans', { cpuC: null, gpuC: 66 })).toBe(66);
    expect(zoneTemp('case', { cpuC: null, gpuC: null })).toBe(catalog.constants.thermal.tempMin);
  });

  it('the LED hash is stable and spread over 0 to 1', () => {
    expect(ledHash('gpu-bar', 3)).toBe(ledHash('gpu-bar', 3));
    const values = Array.from({ length: 400 }, (_, i) => ledHash('z', i));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(new Set(values).size).toBe(400);
  });
});
