import { DIMS } from '../dims';
import { box, Q, type Box, type V3 } from '../math';
import type { CaseLayout, FanMountLayout } from '../types';
import { HOLES_UNION } from './vitrine';

/**
 * Vent: a mesh airflow mid tower, 475 deep, 230 wide, 495 tall. A bowed hexagonal mesh front over three 140 mm fans, a
 * full length supply shroud with a three drive cage under it, glass held by a steel rail at the bottom.
 *
 * Numbers checked against the catalog limits: free card length 423.5 (400 + 2 to 30), 393.5 with a front radiator (its
 * penalty is 30), height over the processor 178 (175 + 1 to 15), supply bay 224 (200 + 2 to 40), glass 42.5 mm past the
 * tallest card that passes.
 */
const OUT = { x0: -237.5, x1: 237.5, y0: 0, y1: 495, z0: -115, z1: 115 };
export const VENT_REAR_IN = -236;
export const VENT_FLOOR = 20;
export const VENT_TOP_IN = 491;
export const VENT_TRAY_FRONT = -82.45;
export const VENT_TRAY_BACK = -83.65;
export const VENT_GLASS_IN = 110;
export const VENT_SHROUD = 118;
/** Inner face of the front fan bracket: the fans' outer faces rest against it. */
export const VENT_FAN_FACE = 212.5;
/** Front end of the supply shroud and its drive cage, clear of a front radiator. */
export const VENT_SHROUD_END = 155;
/** Bottom of the glass: a steel rail under it carries its weight. */
export const VENT_RAIL_TOP = 28;

const front = (n: number, y: number): FanMountLayout => ({ id: `front-${n}`, group: 'front', center: [200, y, 0], rot: [0, -Q, 0], size: 140 });
const top = (n: number, x: number): FanMountLayout => ({ id: `top-${n}`, group: 'top', center: [x, VENT_TOP_IN - 12.5, 40], rot: [-Q, 0, 0], size: 140 });

export const VENT_ANCHOR: V3 = [-230, 427, -76.1];

function standoffs(a: V3): Box[] {
  return HOLES_UNION.map(([x, y]) => box([a[0] + x - 3.6, a[1] + y - 3.6, VENT_TRAY_FRONT], [a[0] + x + 3.6, a[1] + y + 3.6, a[2]], 'standoff'));
}

export const VENT: CaseLayout = {
  id: 'vent',
  outer: { min: [OUT.x0, OUT.y0, OUT.z0], max: [OUT.x1, OUT.y1, OUT.z1] },
  interior: { min: [VENT_REAR_IN, VENT_FLOOR, VENT_TRAY_FRONT], max: [VENT_FAN_FACE, VENT_TOP_IN, VENT_GLASS_IN] },
  boardAnchor: VENT_ANCHOR,
  bracketX: VENT_REAR_IN,
  supply: { rearFace: [VENT_REAR_IN, 21, -30], rot: [0, 0, 0], dir: [1, 0, 0], obstacleX: -12, insert: [1, 0, 0] },
  // The top drive stays 6 mm under the shroud: closer, its label bled through the shroud at grazing angles.
  bays35: [
    { pose: { pos: [72, 84, 46], rot: [0, Q, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [72, 53, 46], rot: [0, Q, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [72, 22, 46], rot: [0, Q, 0] }, insert: [0, 0, 1] },
  ],
  bays25: [
    { pose: { pos: [100, 190, VENT_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [100, 310, VENT_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
  ],
  fanMounts: [front(1, 100), front(2, 242), front(3, 384), top(1, -120), top(2, 22), { id: 'rear-1', group: 'rear', center: [-223.5, 369, 40], rot: [0, -Q, 0], size: 140 }],
  radMounts: [
    { id: 'front', group: 'front', inward: [-1, 0, 0], rot: [0, -Q, Q], faceOffset: 12.5, order: 'fans-first', airInward: true },
    { id: 'top', group: 'top', inward: [0, -1, 0], rot: [Q, 0, 2 * Q], faceOffset: 12.5, order: 'rad-first', airInward: false },
  ],
  glass: [{ side: 'left', inner: VENT_GLASS_IN, outer: 114, rect: { min: [-231, VENT_RAIL_TOP, VENT_GLASS_IN], max: [207, 489, 114] }, caps: 'top' }],
  sideInner: VENT_GLASS_IN,
  supportFloorY: VENT_SHROUD,
  boxes: [
    box([OUT.x0, 18, OUT.z0], [VENT_REAR_IN, OUT.y1, OUT.z1], 'rear'),
    box([225, 18, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'front'),
    box([213, VENT_FLOOR, -80], [214.5, VENT_TOP_IN, 80], 'front-bracket'),
    box([OUT.x0, 493.5, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'top'),
    box([-235, VENT_TOP_IN, -110], [212, 493.5, 110], 'top-bracket'),
    box([OUT.x0, 18, OUT.z0], [OUT.x1, VENT_FLOOR, OUT.z1], 'floor'),
    box([OUT.x0, 18, OUT.z0], [OUT.x1, OUT.y1, -111.5], 'right'),
    box([-231, VENT_RAIL_TOP, VENT_GLASS_IN], [207, 489, 114], 'glass'),
    box([-236, VENT_FLOOR, 106], [225, VENT_RAIL_TOP, OUT.z1], 'rail'),
    box([VENT_REAR_IN, VENT_SHROUD, VENT_TRAY_BACK], [186, VENT_TOP_IN, VENT_TRAY_FRONT], 'tray'),
    box([VENT_REAR_IN, 116.5, -111], [VENT_SHROUD_END, VENT_SHROUD, 108], 'shroud'),
    box([VENT_SHROUD_END - 1.5, VENT_FLOOR, -111], [VENT_SHROUD_END, 116.5, 108], 'shroud'),
    box([VENT_REAR_IN, VENT_FLOOR, 106.5], [VENT_SHROUD_END - 1.5, 116.5, 108], 'shroud'),
    box([-10, VENT_FLOOR, -14], [153, 114, -12], 'cage'),
    box([-12, VENT_FLOOR, -14], [-10, 114, 104], 'cage'),
    box([-10, 50, -12], [153, 52, 104], 'cage'),
    box([-10, 81, -12], [153, 83, 104], 'cage'),
    box([-212, 0, -102], [-152, 18, 102], 'foot'),
    box([152, 0, -102], [212, 18, 102], 'foot'),
    box([188, 495, -62], [222, 497.6, 62], 'io'),
    ...standoffs(VENT_ANCHOR),
  ],
  grommets: [
    { id: 'atx24', center: [54.5, 327, VENT_TRAY_FRONT], normal: [0, 0, 1], size: [22, 96] },
    { id: 'eps', center: [-197.5, 463, VENT_TRAY_FRONT], normal: [0, 0, 1], size: [56, 20] },
    { id: 'gpu', center: [-54, VENT_SHROUD, 80], normal: [0, 1, 0], size: [120, 30] },
    { id: 'front', center: [176, 250, VENT_TRAY_FRONT], normal: [0, 0, 1], size: [14, 150] },
    { id: 'top', center: [32, 463, VENT_TRAY_FRONT], normal: [0, 0, 1], size: [80, 20] },
    { id: 'rear', center: [-212, 297, VENT_TRAY_FRONT], normal: [0, 0, 1], size: [16, 60] },
    { id: 'sata', center: [44.5, 193, VENT_TRAY_FRONT], normal: [0, 0, 1], size: [18, 36] },
  ],
  views: {},
};
