import { gradient, linearToSrgb, type RGB } from '../engine/lighting';

export type Hsv = { h: number; s: number; v: number };

const HEX = /^#?([0-9a-f]{6})$/i;

export function parseHex(text: string): string | null {
  const m = HEX.exec(text.trim());
  return m ? `#${m[1]!.toLowerCase()}` : null;
}

export function hexToHsv(hex: string): Hsv {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const hi = Math.max(r, g, b); const lo = Math.min(r, g, b); const d = hi - lo;
  let h = 0;
  if (d > 0) h = hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s: hi > 0 ? d / hi : 0, v: hi };
}

export function hsvToRgb255({ h, s, v }: Hsv): [number, number, number] {
  const hh = (((h % 1) + 1) % 1) * 6;
  const c = v * s; const x = c * (1 - Math.abs((hh % 2) - 1)); const m = v - c;
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const hex2 = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
export const rgbToHex = ([r, g, b]: [number, number, number]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export const hsvToHex = (c: Hsv) => rgbToHex(hsvToRgb255(c));

const tmp: RGB = { r: 0, g: 0, b: 0 };
/** The color the engine gives a point of the gradient, as a CSS color, so the bar shows exactly what the LEDs show. */
export function gradientCss(stops: string[], x: number): string {
  gradient(stops, x, tmp);
  const to = (c: number) => Math.round(Math.max(0, Math.min(1, linearToSrgb(c))) * 255);
  return rgbToHex([to(tmp.r), to(tmp.g), to(tmp.b)]);
}

/** The repeating gradient laid out so that stop i sits at the middle of its share of the bar. */
export function gradientBar(stops: string[], samples = 48): string {
  const n = Math.max(1, stops.length);
  const parts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    parts.push(`${gradientCss(stops, t - 0.5 / n)} ${(t * 100).toFixed(2)}%`);
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}
