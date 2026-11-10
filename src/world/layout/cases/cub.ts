import { box, Q, R0, type Box, type V3 } from '../math';
import type { CaseLayout, FanMountLayout } from '../types';

/**
 * Cub: Paleforge's small form factor, 335 deep, 195 wide, 315 tall, thick anodized aluminum with rounded corners. The ITX
 * board stands at the rear above the card; the SFX supply stands at the front beside it, beyond the tray's end; the card
 * lies along the floor the full depth of the case on a riser, under both; a 240 radiator or two fans hang under the top.
 *
 * Numbers checked against the catalog limits: free card length 327 (310 + 17); height over the processor 159.4 (150 + 9.4);
 * supply bay 148 (130 + 18); glass 35.5 mm past the tallest card that passes (128 tall).
 */
const OUT = { x0: -167.5, x1: 167.5, y0: 0, y1: 315, z0: -97.5, z1: 97.5 };
export const CUB_REAR_IN = -163.5;
export const CUB_FRONT_IN = 163.5;
export const CUB_FLOOR = 8;
export const CUB_TOP_IN = 311;
export const CUB_TRAY_FRONT = -82.35;
export const CUB_TRAY_BACK = -83.55;
export const CUB_GLASS_IN = 91.5;
export const CUB_RIGHT_IN = -93.5;
/** The tray ends here; the supply stands beyond it at the front. */
export const CUB_TRAY_END = 58;
/** Bottom of the supply, which stands on its bracket over the card. */
export const CUB_PSU_Y = 78;
export const CUB_ANCHOR: V3 = [-157.5, 250, -76];
/** The card's edge connector, on the riser: card space origin. */
export const CUB_RISER: V3 = [CUB_REAR_IN + 28, 69, -70];
/** Mounting holes of an ITX board. */
export const ITX_HOLES: [number, number][] = [[10.2, -10.2], [160, -10.2], [10.2, -163], [160, -163]];

const top = (n: number, x: number): FanMountLayout => ({ id: `top-${n}`, group: 'top', center: [x, CUB_TOP_IN - 12.5, 26], rot: [-Q, 0, 0], size: 120 });

function standoffs(a: V3): Box[] {
  return ITX_HOLES.map(([x, y]) => box([a[0] + x - 3.6, a[1] + y - 3.6, CUB_TRAY_FRONT], [a[0] + x + 3.6, a[1] + y + 3.6, a[2]], 'standoff'));
}

export const CUB: CaseLayout = {
  id: 'cub',
  outer: { min: [OUT.x0, OUT.y0, OUT.z0], max: [OUT.x1, OUT.y1, OUT.z1] },
  interior: { min: [CUB_REAR_IN, CUB_FLOOR, CUB_TRAY_FRONT], max: [CUB_FRONT_IN, CUB_TOP_IN, CUB_GLASS_IN] },
  boardAnchor: CUB_ANCHOR,
  bracketX: CUB_REAR_IN,
  riser: { pos: CUB_RISER, rot: R0 },
  // The supply's rear face (inlet and switch) is at the front panel, its sockets face the board.
  supply: { rearFace: [CUB_FRONT_IN, CUB_PSU_Y, -30], rot: [0, 2 * Q, 0], dir: [-1, 0, 0], obstacleX: 15.5, insert: [-1, 0, 0] },
  bays35: [],
  // 2.5 inch drives lie on the supply.
  bays25: [
    { pose: { pos: [108, CUB_PSU_Y + 63.5 + 1, -30], rot: R0 }, insert: [0, -1, 0] },
    { pose: { pos: [108, CUB_PSU_Y + 63.5 + 9, -30], rot: R0 }, insert: [0, -1, 0] },
  ],
  fanMounts: [top(1, -60), top(2, 74), { id: 'rear-1', group: 'rear', center: [CUB_REAR_IN + 12.5, 190, 30], rot: [0, -Q, 0], size: 120 }],
  radMounts: [
    { id: 'top', group: 'top', inward: [0, -1, 0], rot: [Q, 0, 2 * Q], faceOffset: 12.5, order: 'rad-first', airInward: false },
  ],
  glass: [{ side: 'left', inner: CUB_GLASS_IN, outer: 95.5, rect: { min: [-160, CUB_FLOOR + 2, CUB_GLASS_IN], max: [160, 309, 95.5] } }],
  sideInner: CUB_GLASS_IN,
  supportFloorY: CUB_FLOOR,
  boxes: [
    box([OUT.x0, 0, OUT.z0], [CUB_REAR_IN, OUT.y1, OUT.z1], 'rear'),
    box([CUB_FRONT_IN, 0, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'front'),
    box([OUT.x0, CUB_TOP_IN, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'top'),
    box([OUT.x0, 0, OUT.z0], [OUT.x1, CUB_FLOOR, OUT.z1], 'floor'),
    box([OUT.x0, 0, OUT.z0], [OUT.x1, OUT.y1, CUB_RIGHT_IN], 'right'),
    box([-160, CUB_FLOOR + 2, CUB_GLASS_IN], [160, 309, 95.5], 'glass'),
    box([CUB_REAR_IN, CUB_FLOOR, CUB_TRAY_BACK], [CUB_TRAY_END, CUB_TOP_IN, CUB_TRAY_FRONT], 'tray'),
    // The supply's bracket: a plate across its inner end.
    box([14, CUB_PSU_Y, CUB_RIGHT_IN], [15.5, CUB_PSU_Y + 64, 33], 'psu-bay'),
    ...standoffs(CUB_ANCHOR),
  ],
  grommets: [
    { id: 'atx24', center: [42, 188, CUB_TRAY_FRONT], normal: [0, 0, 1], size: [20, 96] },
    { id: 'eps', center: [-110, 268, CUB_TRAY_FRONT], normal: [0, 0, 1], size: [50, 16] },
    // The card's power runs come up from its glass facing edge, cross over it toward the tray and go through here.
    { id: 'gpu', center: [36, 102, CUB_TRAY_FRONT], normal: [0, 0, 1], size: [26, 30] },
    { id: 'top', center: [-20, 268, CUB_TRAY_FRONT], normal: [0, 0, 1], size: [60, 16] },
    { id: 'rear', center: [-150, 120, CUB_TRAY_FRONT], normal: [0, 0, 1], size: [14, 40] },
  ],
  views: {},
};
