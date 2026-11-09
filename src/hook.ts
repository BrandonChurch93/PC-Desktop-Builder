import type { Category } from './data/catalog';
import { getPreset } from './data/catalog';
import { decode, encode } from './engine/codec';
import { buildFromPreset, emptyBuild, revalidate, setFinish } from './engine/rules';
import { sheet } from './engine/sheet';
import { store, type Mode, type Quality } from './state/store';
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
    async act(action: { type: string; patch?: Record<string, unknown>; id?: string }, _o: { instant?: boolean } = {}) {
      const s = store.getState();
      if (action.type === 'lighting' && action.patch) {
        const next = revalidate({ ...s.build, lighting: { ...s.build.lighting, ...action.patch } as typeof s.build.lighting }).build;
        store.setState({ build: next, instant: true });
      }
      await world.settle();
    },
    async finish(f: string) { store.setState({ build: setFinish(store.getState().build, f), instant: true }); await world.settle(); },
    async cam(view: string) { if (!world.jump(view)) throw new Error(`no view ${view}`); await world.settle(); },
    async inspect(category: Category, id: string, angle = 0, o: { zoom?: number; finish?: string; size?: 120 | 140; ui?: boolean; flip?: boolean; focus?: [number, number, number] } = {}) {
      const insp = { category, id, angle, zoom: o.zoom ?? 0, ...(o.finish ? { finish: o.finish } : {}), ...(o.size ? { size: o.size } : {}), ...(o.flip ? { flip: true } : {}), ...(o.focus ? { focus: o.focus } : {}) };
      store.setState({ inspect: insp, uiHidden: o.ui === false ? true : store.getState().uiHidden, instant: true });
      await world.settle();
    },
    async freeze(seconds: number) { store.setState({ frozen: seconds }); world.markDirty(); await world.settle(); },
    async settle() { await world.settle(); },
    renderer: () => world.rendererString(),
    stats: (seconds: number) => world.stats(seconds),
    timing: () => ({ firstFrameMs: Math.round(world.firstFrame) }),
    build: () => ({ build: store.getState().build, code: encode(store.getState().build) }),
    camera: () => world.cameraInfo(),
    tier: () => ({ setting: store.getState().quality, active: world.tier }),
    sheet: () => sheet(store.getState().build),
    zones: () => world.rgb.snapshot(),
    bounds: async (category: Category, id: string, o: { size?: 120 | 140; finish?: string } = {}) => world.bounds(category, id, o),
  };
  (window as unknown as { __pcb: typeof api; __world: World }).__pcb = api;
  (window as unknown as { __world: World }).__world = world;
  return api;
}
