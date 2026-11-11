import { describe, expect, it } from 'vitest';
import { gradient, linearToSrgb, type RGB } from '../../src/engine/lighting';
import { gradientCss, hexToHsv, hsvToHex, parseHex } from '../../src/ui/color';
import { rng } from './rng';

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

describe('color picker math', () => {
  it('reads a hex with or without its #, in any case, and refuses anything else', () => {
    expect(parseHex('#12AB34')).toBe('#12ab34');
    expect(parseHex('12ab34')).toBe('#12ab34');
    expect(parseHex(' #12ab34 ')).toBe('#12ab34');
    for (const bad of ['', '#12ab3', '#12ab345', 'red', '#12ab3g']) expect(parseHex(bad)).toBeNull();
  });

  it('a hex survives the trip through hue, saturation and value', () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const hex = `#${hex2(r.int(256))}${hex2(r.int(256))}${hex2(r.int(256))}`;
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it('the bar shows each stop at the middle of its share and the color the LEDs show elsewhere', () => {
    const stops = ['#ff2bd1', '#7b3dff', '#18e0ff'];
    stops.forEach((s, i) => expect(gradientCss(stops, i / stops.length)).toBe(s));
    const out: RGB = { r: 0, g: 0, b: 0 };
    for (const x of [0.1, 0.47, 0.83]) {
      gradient(stops, x, out);
      const want = `#${[out.r, out.g, out.b].map((c) => hex2(Math.round(Math.max(0, Math.min(1, linearToSrgb(c))) * 255))).join('')}`;
      expect(gradientCss(stops, x)).toBe(want);
    }
  });
});
