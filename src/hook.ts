import gsap from 'gsap';
import type { Category } from './data/catalog';
import { getPreset } from './data/catalog';
import { decode, encode } from './engine/codec';
import { buildFromPreset, emptyBuild, revalidate, setFinish } from './engine/rules';
import * as A from './state/actions';
import type { ActionOpts, Lighting } from './engine/types';
import { sheet } from './engine/sheet';
import { store, type DialogName, type Mode, type Quality } from './state/store';
import type { World } from './world/World';

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
    async act(action: { type: string; patch?: Record<string, unknown>; id?: string; category?: string; opts?: ActionOpts; finish?: string; name?: string }, o: { instant?: boolean } = {}) {
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
        case 'finish': if (action.finish) A.setCaseFinish(action.finish, instant); break;
        case 'lighting': if (action.patch) A.setLighting(action.patch as Partial<Lighting>); break;
        case 'lightingPreset': if (action.id) A.applyLightingPreset(action.id); break;
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
      else if (name === 'none') store.setState({ ui: { ...ui, dialog: null, menu: false, overlay: null, side: null }, inspect: null, held: null });
      else throw new Error(`no surface ${name}`);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await world.settle();
    },
    /** Holds a part as placing by tap, so its sockets show; with an index, the keyboard's active socket is that one. */
    async hold(category: Category, id: string, socket?: number) {
      store.setState({ held: { category, id, how: socket === undefined ? 'tap' : 'keys', socket: socket ?? null } });
      await world.settle();
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
