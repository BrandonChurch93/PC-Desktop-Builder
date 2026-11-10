import { K } from '../data/catalog';
import type { Profile } from '../engine/types';

/** Browser storage. Every read and write is guarded: the app works fully with storage unavailable. */
export const KEYS = { current: 'dpcb.v1.current', saved: 'dpcb.v1.saved', profiles: 'dpcb.v1.profiles', settings: 'dpcb.v1.settings' } as const;

export type SavedBuild = { id: string; name: string; code: string; savedAt: number };
export type SavedProfile = Profile & { id: string; name: string };
export type Settings = { quality: 'auto' | 'high' | 'medium' | 'low'; reducedMotion: 'system' | 'on'; introSeen: boolean };

export const DEFAULT_SETTINGS: Settings = { quality: 'auto', reducedMotion: 'system', introSeen: false };

function store(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function read(key: string): string | null {
  try { return store()?.getItem(key) ?? null; } catch { return null; }
}

export function write(key: string, value: string): boolean {
  try { const s = store(); if (!s) return false; s.setItem(key, value); return true; } catch { return false; }
}

export function erase(key: string) {
  try { store()?.removeItem(key); } catch { /* storage unavailable */ }
}

function json<T>(key: string, fallback: T, ok: (v: unknown) => v is T): T {
  const raw = read(key);
  if (raw === null) return fallback;
  try { const v: unknown = JSON.parse(raw); return ok(v) ? v : fallback; } catch { return fallback; }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadSettings(): Settings {
  const v = json<Record<string, unknown>>(KEYS.settings, {}, isObj);
  const quality = ['auto', 'high', 'medium', 'low'].includes(String(v.quality)) ? (v.quality as Settings['quality']) : DEFAULT_SETTINGS.quality;
  const reducedMotion = v.reducedMotion === 'on' ? 'on' : 'system';
  return { quality, reducedMotion, introSeen: v.introSeen === true };
}

export const saveSettings = (s: Settings) => write(KEYS.settings, JSON.stringify(s));

export function loadSaved(): SavedBuild[] {
  const list = json<unknown[]>(KEYS.saved, [], Array.isArray);
  return list.filter((x): x is SavedBuild => isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.code === 'string' && typeof x.savedAt === 'number').slice(0, K.maxSavedBuilds);
}

export const saveSaved = (list: SavedBuild[]) => write(KEYS.saved, JSON.stringify(list.slice(0, K.maxSavedBuilds)));

export function loadProfiles(): SavedProfile[] {
  const list = json<unknown[]>(KEYS.profiles, [], Array.isArray);
  return list.filter((x): x is SavedProfile => isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.effect === 'string' && Array.isArray(x.stops)).slice(0, K.maxSavedProfiles);
}

export const saveProfiles = (list: SavedProfile[]) => write(KEYS.profiles, JSON.stringify(list.slice(0, K.maxSavedProfiles)));

export function resetAll() { for (const k of Object.values(KEYS)) erase(k); }

/** A short random id for saved entries. Not used in anything that must be deterministic. */
export const newId = () => Math.random().toString(36).slice(2, 10);
