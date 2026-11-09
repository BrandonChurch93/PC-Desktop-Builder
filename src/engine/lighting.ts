import { K } from '../data/catalog';
import type { LightTarget } from '../data/catalog';
import type { Lighting, Override, Profile, Temps } from './types';

export type RGB = { r: number; g: number; b: number };
export type Led = {
  /** position along its zone, 0 to 1 on strips and 0 up to 1 around rings */
  u: number;
  /** position in the rig along the flow axis */
  pn: number;
  phase: number;
  hash: number;
  /** simulated temperature for this LED's zone, used by thermal */
  tempC: number;
};

const fract = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);
const smooth = (k: number) => k * k * (3 - 2 * k);

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const DARK: RGB = { r: 0, g: 0, b: 0 };
const hexCache = new Map<string, RGB>();
export function hexToLinear(hex: string): RGB {
  const hit = hexCache.get(hex);
  if (hit) return hit;
  const n = Number.parseInt(hex.slice(1), 16);
  const v = Number.isFinite(n) ? n : 0;
  const c = { r: srgbToLinear(((v >> 16) & 255) / 255), g: srgbToLinear(((v >> 8) & 255) / 255), b: srgbToLinear((v & 255) / 255) };
  hexCache.set(hex, c);
  return c;
}

type Hsv = { h: number; s: number; v: number };
const hsvCache = new Map<string, Hsv>();
function toHsv(hex: string): Hsv {
  const hit = hsvCache.get(hex);
  if (hit) return hit;
  const n = Number.parseInt(hex.slice(1), 16);
  const x = Number.isFinite(n) ? n : 0;
  const r = ((x >> 16) & 255) / 255; const g = ((x >> 8) & 255) / 255; const b = (x & 255) / 255;
  const hi = Math.max(r, g, b); const lo = Math.min(r, g, b); const d = hi - lo;
  let h = 0;
  if (d > 0) h = hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const out = { h: h / 6, s: hi > 0 ? d / hi : 0, v: hi };
  hsvCache.set(hex, out);
  return out;
}

const GREY = 0.04;

/**
 * Stops blend in HSV on their sRGB values, hue along the shorter arc, as RGB controllers do.
 * A straight RGB blend between complementary stops (cyan into pink) passes through a pale lavender
 * that reads as a white diffuser. Between saturated stops this keeps every LED saturated.
 */
export function gradient(stops: string[], x: number, out: RGB): RGB {
  const n = stops.length;
  if (n === 0) { out.r = 0; out.g = 0; out.b = 0; return out; }
  const f = fract(x) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const k = smooth(f - i);
  const sa = stops[i]; const sb = stops[(i + 1) % n];
  const one = !sa || !sb || sa === sb || k <= 0 || k >= 1;
  if (one) {
    const d = (k >= 1 ? sb ?? sa : sa ?? sb);
    const c = d ? hexToLinear(d) : DARK;
    out.r = c.r; out.g = c.g; out.b = c.b;
    return out;
  }
  const a = toHsv(sa); const b = toHsv(sb);
  const ha = a.s < GREY ? b.h : a.h;
  const hb = b.s < GREY ? a.h : b.h;
  let dh = hb - ha;
  if (dh > 0.5) dh -= 1;
  else if (dh < -0.5) dh += 1;
  const h = fract(ha + dh * k) * 6;
  const sat = a.s + (b.s - a.s) * k; const v = a.v + (b.v - a.v) * k;
  const c = v * sat; const xx = c * (1 - Math.abs((h % 2) - 1)); const m = v - c;
  const [r, g, bl] = h < 1 ? [c, xx, 0] : h < 2 ? [xx, c, 0] : h < 3 ? [0, c, xx] : h < 4 ? [0, xx, c] : h < 5 ? [xx, 0, c] : [c, 0, xx];
  out.r = srgbToLinear(clamp01(r + m)); out.g = srgbToLinear(clamp01(g + m)); out.b = srgbToLinear(clamp01(bl + m));
  return out;
}

function hslFull(h: number, out: RGB): RGB {
  const hue = fract(h) * 6;
  const x = 1 - Math.abs((hue % 2) - 1);
  const [r, g, b] = hue < 1 ? [1, x, 0] : hue < 2 ? [x, 1, 0] : hue < 3 ? [0, 1, x] : hue < 4 ? [0, x, 1] : hue < 5 ? [x, 0, 1] : [1, 0, x];
  // Hue is picked on the display, as RGB software does: full saturation in sRGB, then linear for the frame.
  out.r = srgbToLinear(r); out.g = srgbToLinear(g); out.b = srgbToLinear(b);
  return out;
}

export function thermalHue(tempC: number): number {
  const T = K.thermal;
  const t = Math.min(1, Math.max(0, (tempC - T.tempMin) / (T.tempMax - T.tempMin)));
  return T.hueCold * (1 - t);
}

/** Linear RGB of one LED, 0 to 1 per channel, already scaled by brightness and power. */
export function ledColor(profile: Profile, time: number, led: Led, power: number, out: RGB = { r: 0, g: 0, b: 0 }): RGB {
  const tau = time * (profile.speed / 100);
  const dt = tau * profile.direction;
  let k = 1;
  switch (profile.effect) {
    case 'static': gradient(profile.stops, led.pn * 0.66, out); break;
    case 'breathing': gradient(profile.stops, led.pn * 0.66, out); k = 0.12 + 0.88 * (0.5 + 0.5 * Math.sin(2.4 * tau)); break;
    case 'spectrum': hslFull(0.12 * tau, out); break;
    case 'wave': gradient(profile.stops, led.pn * 0.8 - 0.35 * dt, out); break;
    case 'shift': gradient(profile.stops, 0.1 * tau, out); break;
    case 'comet': {
      const head = fract(0.6 * dt + led.phase);
      const d = fract(head - led.u);
      gradient(profile.stops, led.phase + 0.05 * dt, out);
      k = Math.exp(-7 * d) + 0.04;
      break;
    }
    case 'starlight': {
      gradient(profile.stops, led.hash, out);
      k = 0.08 + Math.max(0, Math.sin(2.2 * tau + 2 * Math.PI * led.hash)) ** 14;
      break;
    }
    case 'thermal': hslFull(thermalHue(led.tempC), out); break;
    default: out.r = 0; out.g = 0; out.b = 0;
  }
  const s = k * (profile.brightness / 100) * power;
  out.r = clamp01(out.r * s);
  out.g = clamp01(out.g * s);
  out.b = clamp01(out.b * s);
  return out;
}

/** The profile a zone of this target follows, or null when its override is off. */
export function profileFor(lighting: Lighting, target: LightTarget): Profile | null {
  const o: Override | undefined = lighting.overrides[target];
  if (o === 'off') return null;
  return o ?? lighting;
}

/** Temperature a zone of this target reads for the Thermal effect. */
export function zoneTemp(target: LightTarget, t: Temps): number {
  const own = target === 'cooler' || target === 'board' ? t.cpuC : target === 'gpu' ? t.gpuC : null;
  const other = target === 'cooler' || target === 'board' ? t.gpuC : target === 'gpu' ? t.cpuC : null;
  if (target === 'cooler' || target === 'board' || target === 'gpu') return own ?? other ?? K.thermal.tempMin;
  if (t.cpuC !== null && t.gpuC !== null) return (t.cpuC + t.gpuC) / 2;
  return t.cpuC ?? t.gpuC ?? K.thermal.tempMin;
}

/** A fixed number from 0 to 1 for one LED, from a stable zone key and the LED index. */
export function ledHash(zoneKey: string, index: number): number {
  let h = 2166136261;
  for (let i = 0; i < zoneKey.length; i++) { h ^= zoneKey.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= index + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** pn for an LED at world x and y in meters, with the rig's bounds along x. */
export const flowPosition = (x: number, y: number, xmin: number, xmax: number) => (x - xmin) / Math.max(1e-6, xmax - xmin) + 0.6 * y;
