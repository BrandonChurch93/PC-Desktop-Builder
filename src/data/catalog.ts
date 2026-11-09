import raw from './catalog.json';

export type Category = 'case' | 'board' | 'cpu' | 'cooler' | 'ram' | 'gpu' | 'storage' | 'psu' | 'fan' | 'cables';
export type BoardSize = 'atx' | 'matx' | 'itx';
export type PsuForm = 'atx' | 'sfx';
export type StorageType = 'nvme' | 'ssd' | 'hdd';
export type MountRole = 'intake' | 'exhaust';
export type MountGroup = 'front' | 'top' | 'rear' | 'bottom' | 'side' | 'spine';
export type LightTarget = 'case' | 'board' | 'cooler' | 'ram' | 'gpu' | 'fans';
export type FinishId = 'onyx' | 'frost' | 'gunmetal' | 'raw' | 'graphite';
export type CoolerType = 'tower' | 'lowprofile' | 'aio';

export interface FanMountSpec { id: string; group: MountGroup; size: 120 | 140; role: MountRole }
export interface RadMountSpec { id: string; group: MountGroup; sizes: number[]; gpuPenalty: number }

export interface Brand { id: string; name: string; makes: string; language: string }
export interface Platform { id: string; brand: string; name: string; socketLabel: string }

export interface CaseSpec {
  id: string; brand: string; name: string; archetype: string;
  size: { d: number; w: number; h: number };
  boardSizes: BoardSize[];
  gpuMaxLength: number; gpuMaxThickness: number; coolerMaxHeight: number;
  psuForm: PsuForm; psuMaxLength: number;
  bays35: number; bays25: number;
  fanMounts: FanMountSpec[]; radMounts: RadMountSpec[];
  glass: string[]; open: boolean; lightZones: number; draw: number; finishes: FinishId[];
}
export interface BoardSpec {
  id: string; brand: string; name: string; platform: string; size: BoardSize;
  ramSlots: number; m2Slots: number; sataPorts: number; draw: number; lightZones: number; finish: FinishId;
}
export interface CpuSpec { id: string; brand: string; name: string; platform: string; cores: number; draw: number }
export interface CoolerSpec {
  id: string; brand: string; name: string; type: CoolerType;
  height: number | null; radSize: number | null; fans: number; capacity: number; ramClearance: number | null;
  draw: number; lightZones: number; finish: FinishId;
}
export interface RamSpec {
  id: string; brand: string; name: string; sticks: number; gbPerStick: number; height: number; lit: boolean; drawPerStick: number; finish: FinishId;
}
export interface GpuSpec {
  id: string; brand: string; name: string; length: number; height: number; thickness: number; fans: number;
  draw: number; lightZones: number; plugs: string; finish: FinishId;
}
export interface StorageSpec { id: string; brand: string; name: string; type: StorageType; capacityTb: number; draw: number }
export interface PsuSpec { id: string; brand: string; name: string; form: PsuForm; capacity: number; length: number; finish: FinishId }
export interface FanSpec { id: string; brand: string; name: string; lit: boolean; lightZones: number; draw: number; blades: number; finish: FinishId }
export interface CableSpec { id: string; brand: string; name: string; colors: string[]; comb: string }

export interface EffectSpec { id: string; name: string; usesStops: boolean; usesSpeed: boolean }
export interface LightingPresetSpec { id: string; name: string; effect: string; speed: number; brightness: number; direction: 1 | -1; stops: string[] }
export interface Range { min: number; max: number; default: number }

export interface PresetBuildSpec {
  case: { id: string; finish: string };
  board: string; cpu: string;
  cooler: { id: string; mount: string | null };
  ram: string[]; gpu: string;
  storage: { nvme: number; ssd: number; hdd: number };
  psu: string; fans: Record<string, string>; cables: string; glass: boolean; lighting: string;
}
export interface PresetSpec { id: string; name: string; blurb: string; build: PresetBuildSpec }

export interface ThermalConstants {
  cpuBase: number; cpuSpan: number; cpuRatioCap: number; gpuBase: number; gpuSpan: number; gpuWattsPerFan: number;
  gpuFactorMin: number; gpuFactorMax: number; airflowBase: number; airflowPerFan: number; airflowMin: number; airflowMax: number;
  hueCold: number; tempMin: number; tempMax: number;
}
export interface Constants {
  productName: string; shareVersion: number; headroomWarnRatio: number; recommendedPsuFactor: number; recommendedPsuStep: number;
  maxSavedBuilds: number; maxSavedProfiles: number; maxHistory: number; maxBuildNameLength: number;
  maxGradientStops: number; minGradientStops: number; lightTargets: LightTarget[];
  boardDims: Record<BoardSize, { h: number; w: number }>; slotPitch: number; thermal: ThermalConstants;
}
export interface Labels {
  category: Record<Category, string>;
  boardSize: Record<BoardSize, string>;
  psuForm: Record<PsuForm, string>;
  storageType: Record<StorageType, string>;
  finish: Record<FinishId, string>;
  mountGroup: Record<MountGroup, string>;
  lightTarget: Record<LightTarget, string>;
  missing: Record<'case' | 'board' | 'cpu' | 'cooler' | 'ram' | 'psu', string>;
}

export interface Catalog {
  version: number; units: string; constants: Constants; labels: Labels; brands: Brand[]; platforms: Platform[];
  cases: CaseSpec[]; boards: BoardSpec[]; cpus: CpuSpec[]; coolers: CoolerSpec[]; ram: RamSpec[]; gpus: GpuSpec[];
  storage: StorageSpec[]; psus: PsuSpec[]; fans: FanSpec[]; cables: CableSpec[];
  lighting: { effects: EffectSpec[]; speed: Range; brightness: Range; presets: LightingPresetSpec[] };
  presets: PresetSpec[];
}

export const catalog = raw as unknown as Catalog;
export const K = catalog.constants;
export const LABELS = catalog.labels;

const byId = <T extends { id: string }>(list: T[]): ReadonlyMap<string, T> => new Map(list.map((x) => [x.id, x]));

export const CASES = byId(catalog.cases);
export const BOARDS = byId(catalog.boards);
export const CPUS = byId(catalog.cpus);
export const COOLERS = byId(catalog.coolers);
export const RAMS = byId(catalog.ram);
export const GPUS = byId(catalog.gpus);
export const PSUS = byId(catalog.psus);
export const FANS = byId(catalog.fans);
export const CABLES = byId(catalog.cables);
export const BRANDS = byId(catalog.brands);
export const PLATFORMS = byId(catalog.platforms);
export const EFFECTS = byId(catalog.lighting.effects);
export const LIGHT_PRESETS = byId(catalog.lighting.presets);
export const PRESETS = byId(catalog.presets);
export const STORAGE_BY_TYPE: ReadonlyMap<string, StorageSpec> = new Map(catalog.storage.map((s) => [s.type, s]));
export const STORAGE_BY_ID = byId(catalog.storage);

export const CATEGORIES: readonly Category[] = ['case', 'board', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'fan', 'cables'];
export const STORAGE_TYPES: readonly StorageType[] = ['nvme', 'ssd', 'hdd'];
export const LIGHT_TARGETS: readonly LightTarget[] = K.lightTargets;

const key = (s: unknown): string | null => (typeof s === 'string' ? s : null);
export const getCase = (id: unknown) => { const k = key(id); return k === null ? undefined : CASES.get(k); };
export const getBoard = (id: unknown) => { const k = key(id); return k === null ? undefined : BOARDS.get(k); };
export const getCpu = (id: unknown) => { const k = key(id); return k === null ? undefined : CPUS.get(k); };
export const getCooler = (id: unknown) => { const k = key(id); return k === null ? undefined : COOLERS.get(k); };
export const getRam = (id: unknown) => { const k = key(id); return k === null ? undefined : RAMS.get(k); };
export const getGpu = (id: unknown) => { const k = key(id); return k === null ? undefined : GPUS.get(k); };
export const getPsu = (id: unknown) => { const k = key(id); return k === null ? undefined : PSUS.get(k); };
export const getFan = (id: unknown) => { const k = key(id); return k === null ? undefined : FANS.get(k); };
export const getCable = (id: unknown) => { const k = key(id); return k === null ? undefined : CABLES.get(k); };
export const getStorage = (type: unknown) => { const k = key(type); return k === null ? undefined : STORAGE_BY_TYPE.get(k); };
export const getEffect = (id: unknown) => { const k = key(id); return k === null ? undefined : EFFECTS.get(k); };
export const getLightPreset = (id: unknown) => { const k = key(id); return k === null ? undefined : LIGHT_PRESETS.get(k); };
export const getPreset = (id: unknown) => { const k = key(id); return k === null ? undefined : PRESETS.get(k); };
export const brandName = (brandId: string): string => BRANDS.get(brandId)?.name ?? '';

export function partSpec(category: Category, id: string): { id: string; brand: string; name: string } | undefined {
  switch (category) {
    case 'case': return getCase(id);
    case 'board': return getBoard(id);
    case 'cpu': return getCpu(id);
    case 'cooler': return getCooler(id);
    case 'ram': return getRam(id);
    case 'gpu': return getGpu(id);
    case 'storage': return getStorage(id) ?? STORAGE_BY_ID.get(id);
    case 'psu': return getPsu(id);
    case 'fan': return getFan(id);
    case 'cables': return getCable(id);
  }
}

export function displayName(category: Category, id: string): string {
  const p = partSpec(category, id);
  if (!p) return id;
  return `${brandName(p.brand)} ${p.name}`;
}

export function partsOf(category: Category): readonly { id: string; brand: string; name: string }[] {
  switch (category) {
    case 'case': return catalog.cases;
    case 'board': return catalog.boards;
    case 'cpu': return catalog.cpus;
    case 'cooler': return catalog.coolers;
    case 'ram': return catalog.ram;
    case 'gpu': return catalog.gpus;
    case 'storage': return catalog.storage;
    case 'psu': return catalog.psus;
    case 'fan': return catalog.fans;
    case 'cables': return catalog.cables;
  }
}
