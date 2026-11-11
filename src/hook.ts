import gsap from 'gsap';
import type { Category, LightTarget } from './data/catalog';
import { getPreset } from './data/catalog';
import { decode, encode } from './engine/codec';
import { buildFromPreset, emptyBuild, remove, revalidate, setFinish } from './engine/rules';
import * as A from './state/actions';
import type { ActionOpts, Build, Lighting, Profile } from './engine/types';
import { sheet } from './engine/sheet';
import { store, type DialogName, type Mode, type Quality } from './state/store';
import { socketsFor } from './engine/queries';
import { forcePlace } from './world/layout/force';
import type { World } from './world/World';

/** The install sequences: each runs on the Night Rig with that part taken out. */
const INSTALLS: Record<string, { category: Category; id: string; opts: ActionOpts; without: (b: Build) => Build }> = {
  'install-gpu': { category: 'gpu', id: 'apex3x', opts: {}, without: (b) => remove(b, 'gpu').build },
  'install-ram': { category: 'ram', id: 'facet32', opts: {}, without: (b) => remove(b, 'ram', { index: 0 }).build },
  'install-cooler': { category: 'cooler', id: 'tarn360-lux', opts: { mount: 'top' }, without: (b) => remove(b, 'cooler').build },
  'install-nvme': { category: 'storage', id: 'nvme', opts: {}, without: (b) => remove(b, 'storage', { type: 'nvme' }).build },
  'install-cpu': { category: 'cpu', id: 'ember8', opts: {}, without: (b) => remove(b, 'cpu').build },
  'install-fan': { category: 'fan', id: 'gale-lux', opts: { mount: 'rear-1' }, without: (b) => remove(b, 'fan', { mount: 'rear-1' }).build },
  'install-psu': { category: 'psu', id: 't850', opts: {}, without: (b) => remove(b, 'psu').build },
};

const selectionKey = (category: Category, o: { index?: number; type?: string; mount?: string }) =>
  category === 'ram' ? `ram:${o.index ?? 0}` : category === 'storage' ? `storage:${o.type ?? 'nvme'}` : category === 'fan' ? `fan:${o.mount ?? ''}` : category;

type SetArgs = { power?: boolean; glass?: boolean; airflow?: boolean; load?: number; quality?: Quality; ui?: boolean; reducedMotion?: boolean };

/** The test hook. Only installed with ?hook=1. It reads and drives, and never changes how the app behaves for a user. */
export function installHook(world: World) {
  const api = {
    ready: false,
    async load(presetOrCode: string) {
      const p = getPreset(presetOrCode);
      let build;
      if (p) build = revalidate(buildFromPreset(p)).build;
      else {
        const d = decode(presetOrCode);
        if ('error' in d) throw new Error(d.error);
        build = d.build;
      }
      store.setState({ build, instant: true, inspect: null });
      await world.settle();
    },
    async empty() { store.setState({ build: emptyBuild(), instant: true, power: false }); await world.settle(); },
    async mode(name: Mode) { store.setState({ mode: name, instant: true, ...(name === 'showcase' && sheet(store.getState().build).canPowerOn ? { power: true } : {}) }); await world.settle(); },
    async set(a: SetArgs) {
      const s = store.getState();
      const next: Partial<typeof s> = { instant: true };
      if (a.power !== undefined) next.power = a.power && sheet(s.build).canPowerOn;
      if (a.glass !== undefined) next.build = { ...s.build, glass: a.glass };
      if (a.airflow !== undefined) next.airflow = a.airflow;
      if (a.load !== undefined) next.load = Math.max(0, Math.min(1, a.load));
      if (a.quality !== undefined) next.quality = a.quality;
      if (a.ui !== undefined) next.uiHidden = !a.ui;
      if (a.reducedMotion !== undefined) next.reducedMotion = a.reducedMotion;
      store.setState(next);
      await world.settle();
    },
    async act(action: { type: string; patch?: Record<string, unknown>; id?: string; category?: string; opts?: ActionOpts; finish?: string; name?: string; target?: LightTarget | null; mode?: 'synced' | 'own' | 'off'; colors?: string[] }, o: { instant?: boolean } = {}) {
      const instant = o.instant !== false;
      const c = action.category as Category | undefined;
      switch (action.type) {
        case 'install': {
          if (!c || !action.id) throw new Error('install needs a category and an id');
          const r = A.installPart(c, action.id, action.opts ?? {}, instant);
          if (!r.ok) throw new Error(`install ${c} ${action.id}: ${r.code}`);
          break;
        }
        case 'remove': if (c) A.removePart(c, action.opts ?? {}, instant); break;
        case 'swap': { if (!c || !action.id) throw new Error('swap needs a category and an id'); const r = A.swapPart(c, action.opts ?? {}, action.id, instant); if (!r.ok) throw new Error(`swap ${c} ${action.id}: ${r.code}`); break; }
        case 'finish': if (action.finish) A.setCaseFinish(action.finish, instant); break;
        case 'lighting': if (action.patch) A.setLighting(action.patch as Partial<Lighting>); break;
        case 'lightingPreset': if (action.id) A.applyLightingPreset(action.id); break;
        case 'targetMode': if (action.target && action.mode) A.setTargetMode(action.target, action.mode); break;
        case 'scopeLighting': if (action.patch) A.setScopeLighting(action.target ?? null, action.patch as Partial<Profile>); break;
        /** Colors picked in the color picker this session, oldest first, as the Recent row shows them. */
        case 'recentColors': for (const c of action.colors ?? []) A.pushRecentColor(c); break;
        case 'fillFans': if (action.id) A.fillFanMounts(action.id, instant); break;
        case 'clearFans': A.clearCaseFans(instant); break;
        case 'name': A.setName(action.name ?? ''); break;
        case 'undo': A.undo(); break;
        case 'redo': A.redo(); break;
        default: throw new Error(`unknown action ${action.type}`);
      }
      await world.settle();
    },
    /** Opens a named surface. Names: sheet, share, saved, settings, about (dialogs); menu; intro and start (overlays); lighting and spec (the tablet's side sheets); peek, half and full (the phone sheet's stops); parts, specs and lighting-tab (the phone sheet's tabs); tab-<category> (the tray tab); none (closes everything). */
    async open(name: string) {
      const ui = store.getState().ui;
      const dialogs = ['sheet', 'share', 'saved', 'settings', 'about', 'poster'];
      if (dialogs.includes(name)) store.setState({ ui: { ...ui, dialog: name as DialogName, menu: false } });
      else if (name === 'menu') store.setState({ ui: { ...ui, menu: true } });
      else if (name === 'intro' || name === 'start') store.setState({ ui: { ...ui, overlay: name } });
      else if (name === 'lighting' || name === 'spec') store.setState({ ui: { ...ui, side: name } });
      else if (name === 'peek' || name === 'half' || name === 'full') store.setState({ ui: { ...ui, sheet: name } });
      else if (name === 'parts' || name === 'specs') store.setState({ ui: { ...ui, sheetTab: name } });
      else if (name === 'lighting-tab') store.setState({ ui: { ...ui, sheetTab: 'lighting' } });
      else if (name.startsWith('tab-')) store.setState({ ui: { ...ui, tab: name.slice(4) as Category } });
      else if (name.startsWith('target-')) store.setState({ ui: { ...ui, lightTarget: name.slice(7) as LightTarget, stop: null } });
      else if (name.startsWith('stop-')) store.setState({ ui: { ...ui, stop: Number(name.slice(5)) } });
      else if (name === 'none') store.setState({ ui: { ...ui, dialog: null, menu: false, overlay: null, side: null }, inspect: null, held: null });
      else throw new Error(`no surface ${name}`);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await world.settle();
    },
    /** Holds a part as placing by tap, so its sockets show; with an index, the keyboard's active socket is that one. */
    /** Shows a held part at a socket preview, valid or blocked, for drag shots. With no index it shows every socket and holds the part clear of them. */
    async hold(category: Category, id: string, socket?: number) {
      world.hands.holdAt(category, id, socket);
      await world.settle();
      world.choreo.resetGlass();
      await world.renderNow(2);
    },
    /** Selects an installed part and shows its selection menu. opts names the memory index, the storage type or the fan mount. */
    async select(category: Category, opts: { index?: number; type?: string; mount?: string } = {}) {
      store.setState({ selected: { category, key: selectionKey(category, opts), opts }, instant: true });
      await world.settle();
    },
    /**
     * Sets up a named sequence from its start state and jumps it to a progress from 0 to 1. The installs run on the Night Rig
     * with that part taken out.
     */
    async scrub(sequence: string, progress: number) {
      if (sequence === 'power-on') {
        const base = revalidate(buildFromPreset(getPreset('night-rig')!)).build;
        store.setState({ build: base, power: true, instant: true, inspect: null, held: null, selected: null });
        await world.settle();
        world.scrubPower(progress);
        await world.renderNow(2);
        return;
      }
      const inst = INSTALLS[sequence];
      if (!inst) throw new Error(`no sequence ${sequence}`);
      const base = revalidate(buildFromPreset(getPreset('night-rig')!)).build;
      store.setState({ build: inst.without(base), instant: true, inspect: null, held: null, selected: null });
      await world.settle();
      world.choreo.scrubbing = true;
      const r = A.installPart(inst.category, inst.id, inst.opts, false);
      world.choreo.scrubbing = false;
      if (!r.ok) throw new Error(`scrub ${sequence}: ${r.code}`);
      world.choreo.last?.progress(Math.max(0, Math.min(1, progress)));
      world.markDirty();
      await world.renderNow(2);
    },
    /** Every place a part could go, with its screen center in client pixels, so a test can drag there with real input. */
    places(category: Category, id: string) {
      const b = store.getState().build;
      return socketsFor(b, category, id).map((s) => {
        let placed = forcePlace(b, s.category, s.id, s.opts);
        if (s.category === 'cooler' && placed.some((p) => p.kind === 'radiator')) placed = placed.filter((p) => p.kind === 'radiator');
        const c = world.screenOfBoxes(placed.flatMap((p) => p.boxes));
        return { key: s.key, ok: s.ok, message: s.message ?? null, x: c?.x ?? null, y: c?.y ?? null };
      });
    },
    /** The screen center of an installed part, in client pixels, or null. */
    screen(category: Category, opts: { index?: number; type?: string; mount?: string } = {}) {
      const item = world.itemFor(category, opts);
      return item ? world.screenOfBoxes(item.placed.boxes) : null;
    },
    /** Where a part's object is right now, in mm in case space, and its opacity; null when it has no object. */
    pose(category: Category, opts: { index?: number; type?: string; mount?: string } = {}) {
      const item = world.itemFor(category, opts);
      if (!item) return null;
      const p = item.holder.position;
      return { position: [p.x, p.y, p.z].map((v) => Math.round(v * 100) / 100), opacity: Math.round(world.choreo.opacity(item) * 1000) / 1000 };
    },
    async finish(f: string) { store.setState({ build: setFinish(store.getState().build, f), instant: true }); await world.settle(); },
    async cam(view: string) { if (!world.jump(view)) throw new Error(`no view ${view}`); await world.settle(); },
    async inspect(category: Category, id: string, angle = 0, o: { zoom?: number; finish?: string; size?: 120 | 140; ui?: boolean; flip?: boolean; focus?: [number, number, number] } = {}) {
      const insp = { category, id, angle, zoom: o.zoom ?? 0, ...(o.finish ? { finish: o.finish } : {}), ...(o.size ? { size: o.size } : {}), ...(o.flip ? { flip: true } : {}), ...(o.focus ? { focus: o.focus } : {}) };
      store.setState({ inspect: insp, uiHidden: o.ui === false ? true : store.getState().uiHidden, instant: true });
      await world.settle();
    },
    async freeze(seconds: number) {
      store.setState({ frozen: seconds });
      // A frozen frame shows the interface at rest: its transitions and count ups end now, not mid way.
      document.documentElement.dataset.frozen = 'true';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const t of gsap.globalTimeline.getChildren(true, true, false)) if (t.data === 'ui' || (t as gsap.core.Tween).targets?.().some((x: unknown) => x instanceof Element)) t.progress(1);
      world.markDirty();
      await world.settle();
    },
    async settle() { await world.settle(); },
    renderer: () => world.rendererString(),
    stats: (seconds: number) => world.stats(seconds),
    timing: () => ({ firstFrameMs: Math.round(world.firstFrame) }),
    build: () => ({ build: store.getState().build, code: encode(store.getState().build) }),
    camera: () => world.cameraInfo(),
    /** The selected part, or null. */
    selected: () => store.getState().selected,
    tier: () => ({ setting: store.getState().quality, active: world.tier }),
    sheet: () => sheet(store.getState().build),
    zones: () => world.rgb.snapshot(),
    probe: (x: number, y: number) => world.probe(x, y),
    bounds: async (category: Category, id: string, o: { size?: 120 | 140; finish?: string } = {}) => world.bounds(category, id, o),
  };
  (window as unknown as { __pcb: typeof api; __world: World }).__pcb = api;
  (window as unknown as { __world: World }).__world = world;
  return api;
}
