import type { Category, LightTarget, StorageType } from '../data/catalog';

export type Profile = { effect: string; speed: number; brightness: number; direction: 1 | -1; stops: string[] };
export type Override = Profile | 'off';
export type Lighting = Profile & { overrides: Partial<Record<LightTarget, Override>> };

export type Build = {
  v: number;
  name: string;
  case: { id: string; finish: string } | null;
  board: string | null;
  cpu: string | null;
  cooler: { id: string; mount: string | null } | null;
  ram: string[];
  gpu: string | null;
  storage: Record<StorageType, number>;
  psu: string | null;
  fans: Record<string, string>;
  cables: string;
  glass: boolean;
  lighting: Lighting;
};

export type RuleCode =
  | 'UNKNOWN_PART' | 'UNKNOWN_CATEGORY'
  | 'NEED_CASE' | 'NEED_BOARD' | 'NEED_CPU'
  | 'BOARD_SIZE' | 'CPU_PLATFORM' | 'COOLER_HEIGHT' | 'NO_RAD_MOUNT' | 'RAD_GPU_CLEARANCE'
  | 'RAM_CLEARANCE' | 'RAM_SLOTS' | 'GPU_LENGTH' | 'GPU_THICKNESS'
  | 'M2_SLOTS' | 'BAYS_25' | 'BAYS_35' | 'SATA_PORTS'
  | 'PSU_FORM' | 'PSU_LENGTH' | 'FAN_MOUNT_UNKNOWN' | 'FAN_MOUNT_TAKEN';

export type CheckData = {
  sizes?: string[];
  platform?: string;
  height?: number;
  max?: number;
  size?: number;
  length?: number;
  blocked?: 'ram' | 'cooler';
  clearance?: number;
  sticks?: number;
  free?: number;
  thickness?: number;
  slots?: number;
  bays?: number;
  ports?: number;
  form?: string;
};

export type CheckOk = { ok: true; mount?: string | null };
export type CheckFail = { ok: false; code: RuleCode; data: CheckData };
export type CheckResult = CheckOk | CheckFail;

export type Removed = { category: Category; id: string; code: RuleCode; count?: number; mount?: string };

export type ActionOpts = { mount?: string; finish?: string; index?: number; type?: StorageType };

export type InstallResult =
  | { ok: true; build: Build; removed: Removed[] }
  | { ok: false; code: RuleCode; data: CheckData; build: Build; removed: Removed[] };

export type WarningCode = 'PSU_OVER' | 'PSU_HEADROOM' | 'COOLER_CAPACITY' | 'NO_FANS' | 'NO_STORAGE';
export type WarningLevel = 'error' | 'warn' | 'info';
export type Warning = { code: WarningCode; level: WarningLevel };
export type MissingPart = 'case' | 'board' | 'cpu' | 'cooler' | 'ram' | 'psu';
export type Pressure = 'none' | 'positive' | 'negative' | 'balanced';

export type Sheet = {
  memoryGb: number; ramSlotsUsed: number; ramSlots: number;
  storageTb: number; m2Used: number; m2Slots: number;
  bays25Used: number; bays25: number; bays35Used: number; bays35: number;
  sataUsed: number; sataPorts: number;
  drawW: number; psuCapacityW: number; loadPercent: number | null; recommendedPsuW: number;
  gpuLength: number; gpuMaxLength: number; coolerCapacityW: number; cpuDrawW: number;
  intakeFans: number; exhaustFans: number; pressure: Pressure;
  missing: MissingPart[]; warnings: Warning[]; canPowerOn: boolean;
};

export type Temps = { cpuC: number | null; gpuC: number | null };
