import type { BoardSize, MountGroup } from '../../data/catalog';
import type { Box, Pose, Rot, V3 } from './math';

export type FanMountLayout = { id: string; group: MountGroup; center: V3; rot: Rot; size: 120 | 140 };

export type RadMountLayout = {
  id: string;
  group: MountGroup;
  /** unit vector pointing into the case from the mount */
  inward: V3;
  /** rotation of the radiator frame: local x along the radiator, local z = inward */
  rot: Rot;
  /** distance from the mounted fans' centers to the mount face, toward the outside */
  faceOffset: number;
  /** fans next to the mount face then the radiator, or the radiator first */
  order: 'fans-first' | 'rad-first';
  /** air moves inward through this mount */
  airInward: boolean;
};

export type BayLayout = { pose: Pose; insert: V3 };

export type Grommet = { id: string; center: V3; normal: V3; size: [number, number] };

export type GlassPanel = { side: 'left' | 'front'; inner: number; outer: number; rect: { min: V3; max: V3 } };

export type CaseLayout = {
  id: string;
  outer: { min: V3; max: V3 };
  interior: { min: V3; max: V3 };
  /** top rear corner of every board, on its back face */
  boardAnchor: V3;
  /** inner face of the expansion slot wall, where card brackets rest */
  bracketX: number;
  /** pose of the card's edge connector anchor when the case uses a riser instead of the board slot */
  riser?: Pose;
  supply: { rearFace: V3; rot: Rot; dir: V3; obstacleX: number; insert: V3 };
  bays25: BayLayout[];
  bays35: BayLayout[];
  fanMounts: FanMountLayout[];
  radMounts: RadMountLayout[];
  glass: GlassPanel[];
  /** inner face of the side panel or glass that the board faces */
  sideInner: number;
  boxes: Box[];
  grommets: Grommet[];
  /** a post under the far end of a long card: the surface it stands on */
  supportFloorY: number;
  /** a window in the supply shroud's top over the drive cage: its center and size on x and z, and the underside of the shroud top */
  shroudWindow?: { x: number; z: number; w: number; d: number; y: number };
  views: Record<string, { pos: V3; target: V3 }>;
};

export type BoardSlot = { name: string; x: number; y: number };

export type BoardLayout = {
  size: BoardSize;
  w: number;
  h: number;
  socket: { x: number; y: number };
  dimms: BoardSlot[];
  pcie: { y: number; x0: number; len: number; kind: 'x16r' | 'x16' | 'x4' | 'x1' }[];
  m2: { x0: number; y: number; level: 0 | 1 }[];
  atx24: { x: number; y: number };
  eps: { x: number; y: number };
  sata: { x: number; y: number; level: 0 | 1 }[];
  holes: [number, number][];
  vrmRear: { x0: number; x1: number; y0: number; y1: number; h: number };
  vrmTop: { x0: number; x1: number; y0: number; y1: number; h: number };
  chipset: { x0: number; x1: number; y0: number; y1: number; h: number } | null;
  coin: { x: number; y: number };
  headers: { x: number; y: number; w: number; h: number; pins: [number, number]; kind: 'fan' | 'rgb' | 'panel' | 'usb' }[];
};
