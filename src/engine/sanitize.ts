import { catalog, getEffect, getLightPreset, K, LIGHT_TARGETS } from '../data/catalog';
import type { Lighting, Override, Profile } from './types';

const HEX = /^#[0-9a-f]{6}$/;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function profileFromPreset(id: string): Profile {
  const p = getLightPreset(id) ?? getLightPreset('aurora');
  if (!p) throw new Error('the catalog has no aurora lighting preset');
  return { effect: p.effect, speed: p.speed, brightness: p.brightness, direction: p.direction === -1 ? -1 : 1, stops: [...p.stops] };
}

export function lightingFromPreset(id: string): Lighting {
  return { ...profileFromPreset(id), overrides: {} };
}

const copyProfile = (p: Profile): Profile => ({ effect: p.effect, speed: p.speed, brightness: p.brightness, direction: p.direction, stops: [...p.stops] });

export function sanitizeProfile(input: unknown, fallback: Profile): Profile {
  if (!input || typeof input !== 'object') return copyProfile(fallback);
  const p = input as Record<string, unknown>;
  const L = catalog.lighting;
  const stops = Array.isArray(p.stops)
    ? p.stops.map((s) => String(s).toLowerCase()).filter((s) => HEX.test(s)).slice(0, K.maxGradientStops)
    : [];
  const speed = p.speed; const brightness = p.brightness;
  return {
    effect: typeof p.effect === 'string' && getEffect(p.effect) ? p.effect : fallback.effect,
    speed: typeof speed === 'number' && Number.isFinite(speed) ? clamp(Math.round(speed), L.speed.min, L.speed.max) : fallback.speed,
    brightness: typeof brightness === 'number' && Number.isFinite(brightness) ? clamp(Math.round(brightness), L.brightness.min, L.brightness.max) : fallback.brightness,
    direction: p.direction === -1 ? -1 : 1,
    stops: stops.length >= K.minGradientStops ? stops : [...fallback.stops],
  };
}

export function sanitizeLighting(input: unknown): Lighting {
  const main = sanitizeProfile(input, profileFromPreset('aurora'));
  const out: Lighting = { ...main, overrides: {} };
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>).overrides : undefined;
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const t of LIGHT_TARGETS) {
    if (!Object.prototype.hasOwnProperty.call(src, t)) continue;
    const v = src[t];
    let o: Override | undefined;
    if (v === 'off') o = 'off';
    else if (v && typeof v === 'object') o = sanitizeProfile(v, main);
    if (o !== undefined) out.overrides[t] = o;
  }
  return out;
}
