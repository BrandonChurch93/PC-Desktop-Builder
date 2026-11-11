import { K, displayName, getPreset, getStorage, brandName, LABELS, type Category, type LightTarget, type StorageType } from '../data/catalog';
import { encode } from '../engine/codec';
import { cascadeNotice, joinAnd } from '../engine/messages';
import { buildFromPreset, clearFans, emptyBuild, fillFans, install, remove, revalidate, setFinish } from '../engine/rules';
import { lightingFromPreset, sanitizeLighting } from '../engine/sanitize';
import { sheet } from '../engine/sheet';
import type { ActionOpts, Build, Lighting, Profile, Removed } from '../engine/types';
import { KEYS, newId, saveProfiles, saveSettings, write } from './persist';
import { store, type Notice, type State } from './store';

let noticeId = 0;
let liveBase: Build | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** The current build as a share code, written after every change, debounced. */
function scheduleAutosave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; write(KEYS.current, encode(store.getState().build)); }, 400);
}

export function flushAutosave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  write(KEYS.current, encode(store.getState().build));
}

export function notify(n: Omit<NonNullable<Notice>, 'id'>) {
  store.setState({ notice: { ...n, id: ++noticeId } });
}

export const dismissNotice = () => store.setState({ notice: null });

export const say = (announce: string) => store.setState({ announce });

/** What the live region says after a build change: the part and the number it moved. */
function sentence(category: Category | 'other', next: Build, verb: string, name: string): string {
  const s = sheet(next);
  const head = `${name} ${verb}.`;
  switch (category) {
    case 'gpu': return s.gpuLength ? `${head} Graphics clearance ${s.gpuLength} of ${s.gpuMaxLength} mm.` : head;
    case 'ram': return `${head} Memory ${s.memoryGb} GB in ${s.ramSlotsUsed} of ${s.ramSlots} slots.`;
    case 'storage': return `${head} Storage ${s.storageTb} TB.`;
    case 'psu': case 'cpu': case 'cooler': return s.psuCapacityW ? `${head} Power ${s.drawW} W of ${s.psuCapacityW} W.` : head;
    default: return head;
  }
}

type CommitOpts = { announce?: string; instant?: boolean; history?: boolean };

/**
 * Every build change goes through here: it stores the result, pushes the previous build onto the history, records the
 * cascade for the notice, turns the power off when the build can no longer run, and schedules the autosave.
 */
export function commit(next: Build, removed: Removed[] = [], o: CommitOpts = {}) {
  const s = store.getState();
  if (next === s.build) return;
  const patch: Partial<State> = {
    build: next,
    instant: o.instant ?? false,
    cascade: removed.length ? { removed, at: Date.now() } : s.cascade,
  };
  // A drag shows live changes without history; its one entry, pushed on release, holds the build from before the drag.
  if (o.history === false) liveBase ??= s.build;
  else {
    patch.history = [...s.history, liveBase ?? s.build].slice(-K.maxHistory);
    patch.future = [];
    liveBase = null;
  }
  if (s.power && !sheet(next).canPowerOn) patch.power = false;
  if (s.selected && !stillInstalled(next, s.selected.category, s.selected.opts)) patch.selected = null;
  const n = removed.length ? cascadeNotice(removed) : null;
  if (n) {
    patch.notice = { id: ++noticeId, kind: 'cascade', title: n.title, lines: n.lines, action: 'undo' };
    patch.announce = `${o.announce ? `${o.announce} ` : ''}${n.title}: ${n.lines.join('. ')}.`;
  } else if (o.announce) patch.announce = o.announce;
  store.setState(patch);
  scheduleAutosave();
}

function stillInstalled(b: Build, category: Category, opts: { index?: number; type?: string; mount?: string }): boolean {
  switch (category) {
    case 'case': return !!b.case;
    case 'board': return !!b.board;
    case 'cpu': return !!b.cpu;
    case 'cooler': return !!b.cooler;
    case 'gpu': return !!b.gpu;
    case 'psu': return !!b.psu;
    case 'ram': return opts.index !== undefined && opts.index < b.ram.length;
    case 'storage': return !!opts.type && (b.storage[opts.type as StorageType] ?? 0) > 0;
    case 'fan': return !!opts.mount && !!b.fans[opts.mount];
    default: return false;
  }
}

export const partName = (category: Category, id: string) => {
  if (category === 'storage') { const st = getStorage(id); return st ? `${brandName(st.brand)} ${st.name}` : id; }
  return displayName(category, id);
};

/** Install through the engine. Returns the rule code when the part cannot go in, and nothing changes. */
export function installPart(category: Category, id: string, opts: ActionOpts = {}, instant = false): { ok: true } | { ok: false; code: string } {
  const s = store.getState();
  const r = install(s.build, category, id, opts);
  if (!r.ok) return { ok: false, code: r.code };
  commit(r.build, r.removed, { instant, announce: sentence(category, r.build, 'installed', partName(category, id)) });
  return { ok: true };
}

/**
 * Swap: the installed part out and another of its category in, as one history entry. A fan keeps its mount; memory keeps the
 * kit's place in the order. The motion overlaps the old part leaving and the new one arriving.
 */
export function swapPart(category: Category, opts: ActionOpts, id: string, instant = false): { ok: true } | { ok: false; code: string } {
  const s = store.getState();
  const old = installedIdFor(s.build, category, opts);
  const out = remove(s.build, category, opts);
  const at: ActionOpts = category === 'fan' && opts.mount ? { mount: opts.mount } : {};
  const r = install(out.build, category, id, at);
  if (!r.ok) return { ok: false, code: r.code };
  commit(r.build, [...out.removed.filter((x) => !(x.category === category)), ...r.removed], { instant, announce: `${old ? partName(category, old) : ''} swapped for ${partName(category, id)}.`.trim() });
  return { ok: true };
}

export function removePart(category: Category, opts: ActionOpts = {}, instant = false) {
  const s = store.getState();
  const id = installedIdFor(s.build, category, opts);
  const r = remove(s.build, category, opts);
  commit(r.build, r.removed, { instant, announce: id ? sentence(category, r.build, 'removed', partName(category, id)) : undefined });
}

function installedIdFor(b: Build, category: Category, opts: ActionOpts): string | null {
  switch (category) {
    case 'case': return b.case?.id ?? null;
    case 'board': return b.board;
    case 'cpu': return b.cpu;
    case 'cooler': return b.cooler?.id ?? null;
    case 'gpu': return b.gpu;
    case 'psu': return b.psu;
    case 'ram': return b.ram[opts.index ?? b.ram.length - 1] ?? null;
    case 'storage': return opts.type ?? null;
    case 'fan': return opts.mount ? b.fans[opts.mount] ?? null : null;
    case 'cables': return b.cables;
  }
}

export function setCaseFinish(finish: string, instant = false) {
  const s = store.getState();
  if (!s.build.case || s.build.case.finish === finish) return;
  commit(setFinish(s.build, finish), [], { instant, announce: `Finish ${LABELS.finish[finish as keyof typeof LABELS.finish] ?? finish}.` });
}

export function fillFanMounts(id: string, instant = false) {
  const r = fillFans(store.getState().build, id);
  if (r.ok) commit(r.build, r.removed, { instant, announce: `Empty mounts filled with ${partName('fan', id)}.` });
}

export function clearCaseFans(instant = false) {
  const r = clearFans(store.getState().build);
  commit(r.build, r.removed, { instant, announce: 'Case fans cleared.' });
}

/** Steppers: one more of a drive type through the engine, or one fewer. */
export function stepStorage(type: StorageType, delta: 1 | -1) {
  if (delta > 0) return installPart('storage', type);
  removePart('storage', { type });
  return { ok: true as const };
}

export function setCables(id: string) {
  const s = store.getState();
  if (s.build.cables === id) return;
  const r = install(s.build, 'cables', id);
  if (r.ok) commit(r.build, r.removed, { announce: `${partName('cables', id)} cables.` });
}

export function setName(name: string) {
  const s = store.getState();
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, K.maxBuildNameLength);
  if (clean === s.build.name) return;
  commit({ ...s.build, name: clean }, [], { announce: clean ? `Build named ${clean}.` : 'Build name cleared.' });
}

export function setGlass(glass: boolean) {
  const s = store.getState();
  if (s.build.glass === glass) return;
  commit({ ...s.build, glass }, [], { announce: glass ? 'Glass on.' : 'Glass off.' });
}

export function setLighting(patch: Partial<Lighting>, history = true) {
  const s = store.getState();
  const lighting = sanitizeLighting({ ...s.build.lighting, ...patch });
  const same = JSON.stringify(lighting) === JSON.stringify(s.build.lighting);
  if (same && (!history || !liveBase)) return;
  if (same && liveBase && JSON.stringify(liveBase.lighting) === JSON.stringify(lighting)) { liveBase = null; return; }
  commit(revalidate({ ...s.build, lighting }).build, [], { history, instant: true });
}

export function applyLightingPreset(id: string) {
  const s = store.getState();
  commit({ ...s.build, lighting: lightingFromPreset(id) }, [], { instant: true, announce: 'Lighting preset applied.' });
}

const profileOf = (p: Profile): Profile => ({ effect: p.effect, speed: p.speed, brightness: p.brightness, direction: p.direction, stops: [...p.stops] });

/** The profile the lighting panel edits: the main one, or the target's own. A target that follows the main profile shows it. */
export function scopeProfile(l: Lighting, target: LightTarget | null): Profile | 'off' {
  if (!target) return l;
  const o = l.overrides[target];
  return o ?? l;
}

/**
 * Edits the profile in scope. Editing a target that follows the main profile gives it its own, started from the main one,
 * as RGB software unlinks a device the moment you change it.
 */
export function setScopeLighting(target: LightTarget | null, patch: Partial<Profile>, history = true) {
  if (!target) { setLighting(patch, history); return; }
  const l = store.getState().build.lighting;
  const o = l.overrides[target];
  const base = o && o !== 'off' ? o : l;
  setLighting({ overrides: { ...l.overrides, [target]: { ...profileOf(base), ...patch } } }, history);
}

export function setTargetMode(target: LightTarget, mode: 'synced' | 'own' | 'off') {
  const l = store.getState().build.lighting;
  const cur = l.overrides[target];
  const overrides = { ...l.overrides };
  if (mode === 'synced') delete overrides[target];
  else if (mode === 'off') overrides[target] = 'off';
  else overrides[target] = cur && cur !== 'off' ? cur : profileOf(l);
  if (mode === (cur === undefined ? 'synced' : cur === 'off' ? 'off' : 'own')) return;
  setLighting({ overrides });
  say(`${LABELS.lightTarget[target]} ${mode === 'synced' ? 'follows the main profile' : mode === 'off' ? 'is off' : 'has its own profile'}.`);
}

/** A catalog preset or a saved profile, applied to the profile in scope. */
export function applyProfileTo(target: LightTarget | null, p: Profile, name: string) {
  if (!target) {
    const s = store.getState();
    commit({ ...s.build, lighting: sanitizeLighting({ ...profileOf(p), overrides: s.build.lighting.overrides }) }, [], { instant: true, announce: `${name} applied.` });
    return;
  }
  setScopeLighting(target, profileOf(p));
  say(`${name} applied to ${LABELS.lightTarget[target]}.`);
}

const RECENT_COLORS = 8;
export function pushRecentColor(hex: string) {
  const list = store.getState().recentColors;
  store.setState({ recentColors: [hex, ...list.filter((c) => c !== hex)].slice(0, RECENT_COLORS) });
}

export function saveProfile(name: string, p: Profile): boolean {
  const s = store.getState();
  if (s.profiles.length >= K.maxSavedProfiles) return false;
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, K.maxBuildNameLength) || `Profile ${s.profiles.length + 1}`;
  const profiles = [...s.profiles, { ...profileOf(p), id: newId(), name: clean }];
  store.setState({ profiles, announce: `Profile ${clean} saved.` });
  saveProfiles(profiles);
  return true;
}

export function deleteProfile(id: string) {
  const s = store.getState();
  const gone = s.profiles.find((p) => p.id === id);
  const profiles = s.profiles.filter((p) => p.id !== id);
  store.setState({ profiles, announce: gone ? `Profile ${gone.name} deleted.` : s.announce });
  saveProfiles(profiles);
}

/** Loading a preset, a saved build or a link is one history entry like any other action. */
export function loadBuild(next: Build, announce?: string) {
  commit(revalidate(next).build, [], { announce });
}

export function loadPreset(id: string) {
  const p = getPreset(id);
  if (p) loadBuild(buildFromPreset(p), `${p.name} loaded.`);
}

export function emptyBench() {
  const s = store.getState();
  commit(emptyBuild(), [], { announce: 'Empty bench. Pick a case to begin.' });
  store.setState({ power: false, selected: null, held: null, mode: s.mode === 'exploded' ? 'build' : s.mode, ui: { ...store.getState().ui, tab: 'case' } });
}

export function undo() {
  const s = store.getState();
  const prev = s.history[s.history.length - 1];
  if (!prev) return;
  liveBase = null;
  store.setState({ build: prev, history: s.history.slice(0, -1), future: [s.build, ...s.future].slice(0, K.maxHistory), instant: false, notice: s.notice?.action === 'undo' ? null : s.notice, announce: 'Undone.', selected: null, power: s.power && sheet(prev).canPowerOn });
  scheduleAutosave();
}

export function redo() {
  const s = store.getState();
  const next = s.future[0];
  if (!next) return;
  liveBase = null;
  store.setState({ build: next, future: s.future.slice(1), history: [...s.history, s.build].slice(-K.maxHistory), instant: false, announce: 'Redone.', selected: null, power: s.power && sheet(next).canPowerOn });
  scheduleAutosave();
}

export function setPower(on: boolean) {
  const s = store.getState();
  const sh = sheet(s.build);
  if (on && !sh.canPowerOn) return;
  store.setState({ power: on, instant: false, announce: on ? 'Power on.' : 'Power off.' });
}

export function updateSettings(patch: Partial<State['settings']>) {
  const settings = { ...store.getState().settings, ...patch };
  store.setState({ settings, quality: settings.quality, reducedMotion: settings.reducedMotion === 'on' || systemReducedMotion() });
  saveSettings(settings);
}

export function systemReducedMotion(): boolean {
  try { return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export const missingList = (b: Build) => joinAnd(sheet(b).missing.map((m) => LABELS.missing[m]));
