import { DIMS } from '../dims';
import { box, Q, type Box, type V3 } from '../math';
import type { CaseLayout, FanMountLayout } from '../types';
import { HOLES_UNION } from './vitrine';

/**
 * Bulwark: Skarn's full tower, 560 deep, 245 wide, 590 tall. A front with a solid center spine carrying a vertical light
 * bar and mesh intakes on both sides, three 140 mm fans behind it; two 140 mm fans standing on the shroud floor; a large
 * hinged glass side; four drive sleds in the front of the lower chamber, open to the glass.
 *
 * Numbers to hold against the catalog limits: free card length 480 + 2 to 30 (front fans at 221.5), with a front radiator
 * 480 - 30 + 2 to 30; height over the processor 190 + 1 to 15; supply bay 240 + 2 to 40; glass 34 mm past the tallest card.
 */
const OUT = { x0: -280, x1: 280, y0: 0, y1: 590, z0: -122.5, z1: 122.5 };
export const BULWARK_REAR_IN = -278.5;
export const BULWARK_FLOOR = 20;
export const BULWARK_TOP_IN = 586;
export const BULWARK_TRAY_FRONT = -93.45;
export const BULWARK_TRAY_BACK = -94.65;
export const BULWARK_GLASS_IN = 117;
export const BULWARK_SHROUD = 160;
export const BULWARK_SHROUD_END = 186;
/** Inner face of the front fan bracket: the front fans' outer faces rest against it. */
export const BULWARK_FAN_FACE = 246.5;
/** Back face of the front bezel. */
export const BULWARK_BEZEL_BACK = 252;
const RIGHT_IN = -118.5;

export const BULWARK_ANCHOR: V3 = [-272.5, 522, -87.1];

const front = (n: number, y: number): FanMountLayout => ({ id: `front-${n}`, group: 'front', center: [234, y, 0], rot: [0, -Q, 0], size: 140 });
const bottom = (n: number, x: number): FanMountLayout => ({ id: `bottom-${n}`, group: 'bottom', center: [x, BULWARK_SHROUD + 12.5, -21], rot: [-Q, 0, 0], size: 140 });
const top = (n: number, x: number): FanMountLayout => ({ id: `top-${n}`, group: 'top', center: [x, BULWARK_TOP_IN - 12.5, 30], rot: [-Q, 0, 0], size: 140 });

function standoffs(a: V3): Box[] {
  return HOLES_UNION.map(([x, y]) => box([a[0] + x - 3.6, a[1] + y - 3.6, BULWARK_TRAY_FRONT], [a[0] + x + 3.6, a[1] + y + 3.6, a[2]], 'standoff'));
}

export const BULWARK: CaseLayout = {
  id: 'bulwark',
  outer: { min: [OUT.x0, OUT.y0, OUT.z0], max: [OUT.x1, OUT.y1, OUT.z1] },
  interior: { min: [BULWARK_REAR_IN, BULWARK_FLOOR, BULWARK_TRAY_FRONT], max: [BULWARK_FAN_FACE, BULWARK_TOP_IN, BULWARK_GLASS_IN] },
  boardAnchor: BULWARK_ANCHOR,
  bracketX: BULWARK_REAR_IN,
  supply: { rearFace: [BULWARK_REAR_IN, 21, -30], rot: [0, 0, 0], dir: [1, 0, 0], obstacleX: -20, insert: [1, 0, 0] },
  // Four sleds stacked in the front of the lower chamber, open to the glass; the lowest fills first.
  bays35: [
    { pose: { pos: [105, 22, 6], rot: [0, Q, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [105, 54, 6], rot: [0, Q, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [105, 86, 6], rot: [0, Q, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [105, 118, 6], rot: [0, Q, 0] }, insert: [0, 0, 1] },
  ],
  bays25: [
    { pose: { pos: [80, 250, BULWARK_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [160, 250, BULWARK_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [80, 380, BULWARK_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [160, 380, BULWARK_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
  ],
  fanMounts: [front(1, 120), front(2, 274), front(3, 428), bottom(1, -170), bottom(2, -25), top(1, -160), top(2, -6), top(3, 148), { id: 'rear-1', group: 'rear', center: [-266, 450, 30], rot: [0, -Q, 0], size: 140 }],
  radMounts: [
    { id: 'front', group: 'front', inward: [-1, 0, 0], rot: [0, -Q, Q], faceOffset: 12.5, order: 'fans-first', airInward: true },
    { id: 'top', group: 'top', inward: [0, -1, 0], rot: [Q, 0, 2 * Q], faceOffset: 12.5, order: 'rad-first', airInward: false },
  ],
  glass: [{ side: 'left', inner: BULWARK_GLASS_IN, outer: 121, rect: { min: [-274, BULWARK_FLOOR, BULWARK_GLASS_IN], max: [243, 584, 121] } }],
  sideInner: BULWARK_GLASS_IN,
  supportFloorY: BULWARK_SHROUD,
  boxes: [
    box([OUT.x0, 18, OUT.z0], [BULWARK_REAR_IN, OUT.y1, OUT.z1], 'rear'),
    box([BULWARK_BEZEL_BACK, 18, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'front'),
    box([247, BULWARK_FLOOR, -85], [248.5, BULWARK_TOP_IN, 85], 'front-bracket'),
    box([OUT.x0, 588.5, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'top'),
    box([-277, BULWARK_TOP_IN, -117], [247, 588.5, 117], 'top-bracket'),
    box([OUT.x0, 18, OUT.z0], [OUT.x1, BULWARK_FLOOR, OUT.z1], 'floor'),
    box([OUT.x0, 18, OUT.z0], [OUT.x1, OUT.y1, RIGHT_IN], 'right'),
    box([-274, BULWARK_FLOOR, BULWARK_GLASS_IN], [243, 584, 121], 'glass'),
    box([BULWARK_REAR_IN, BULWARK_SHROUD, BULWARK_TRAY_BACK], [215, BULWARK_TOP_IN, BULWARK_TRAY_FRONT], 'tray'),
    box([BULWARK_REAR_IN, BULWARK_SHROUD - 1.5, RIGHT_IN], [BULWARK_SHROUD_END, BULWARK_SHROUD, 115], 'shroud'),
    box([BULWARK_REAR_IN, BULWARK_FLOOR, 113.5], [-22, BULWARK_SHROUD - 1.5, 115], 'shroud'),
    box([-22, BULWARK_FLOOR, RIGHT_IN], [-20, BULWARK_SHROUD - 1.5, 115], 'psu-bay'),
    box([28, BULWARK_FLOOR, -52], [30, 150, 64], 'cage'),
    box([180, BULWARK_FLOOR, -52], [182, 150, 64], 'cage'),
    box([-262, 0, -110], [-192, 18, 110], 'foot'),
    box([192, 0, -110], [262, 18, 110], 'foot'),
    box([214, 590, -62], [248, 592.6, 62], 'io'),
    ...standoffs(BULWARK_ANCHOR),
  ],
  grommets: [
    { id: 'atx24', center: [12, 422, BULWARK_TRAY_FRONT], normal: [0, 0, 1], size: [22, 96] },
    { id: 'eps', center: [-240, 558, BULWARK_TRAY_FRONT], normal: [0, 0, 1], size: [56, 20] },
    // Under the card's power sockets, in front of the bottom fans (set back toward the tray): the runs drop straight in.
    { id: 'gpu', center: [-33, BULWARK_SHROUD, 86], normal: [0, 1, 0], size: [120, 30] },
    { id: 'front', center: [200, 340, BULWARK_TRAY_FRONT], normal: [0, 0, 1], size: [14, 150] },
    { id: 'top', center: [-10, 558, BULWARK_TRAY_FRONT], normal: [0, 0, 1], size: [80, 20] },
    { id: 'rear', center: [-254, 392, BULWARK_TRAY_FRONT], normal: [0, 0, 1], size: [16, 60] },
    { id: 'sata', center: [2, 288, BULWARK_TRAY_FRONT], normal: [0, 0, 1], size: [18, 36] },
    { id: 'bottom', center: [-100, 190, BULWARK_TRAY_FRONT], normal: [0, 0, 1], size: [60, 16] },
  ],
  views: {},
};
