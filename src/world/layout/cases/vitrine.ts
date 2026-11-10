import { box, Q, R0, type Box, type V3 } from '../math';
import type { CaseLayout, FanMountLayout } from '../types';

const OUT = { x0: -230, x1: 230, y0: 0, y1: 498, z0: -117.5, z1: 117.5 };
const REAR_IN = -228.5;
const FLOOR = 20;
const TOP_IN = 494;
const TRAY_FRONT = -75.45;
const TRAY_BACK = -76.65;
const GLASS_IN = 112.5;
const SHROUD = 118;

const front = (n: number, y: number): FanMountLayout => ({ id: `front-${n}`, group: 'front', center: [210.5, y, 0], rot: [0, -Q, 0], size: 120 });
const top = (n: number, x: number): FanMountLayout => ({ id: `top-${n}`, group: 'top', center: [x, 481.5, 46], rot: [-Q, 0, 0], size: 120 });

export const HOLES_UNION: [number, number][] = [
  [10.2, -10.2], [157, -10.2], [234, -10.2], [10.2, -165], [157, -165], [234, -165], [10.2, -292], [157, -292], [234, -292], [10.2, -234], [157, -234], [234, -234],
];

function standoffs(anchor: V3): Box[] {
  return HOLES_UNION.map(([x, y]) => box([anchor[0] + x - 3.6, anchor[1] + y - 3.6, TRAY_FRONT], [anchor[0] + x + 3.6, anchor[1] + y + 3.6, anchor[2]], 'standoff'));
}

const anchor: V3 = [-222.5, 430, -69.1];

export const VITRINE: CaseLayout = {
  id: 'vitrine',
  outer: { min: [OUT.x0, OUT.y0, OUT.z0], max: [OUT.x1, OUT.y1, OUT.z1] },
  interior: { min: [REAR_IN, FLOOR, TRAY_FRONT], max: [223, TOP_IN, GLASS_IN] },
  boardAnchor: anchor,
  bracketX: REAR_IN,
  supply: { rearFace: [REAR_IN, 21, -30], rot: R0, dir: [1, 0, 0], obstacleX: -2, insert: [1, 0, 0] },
  // The upper bay fills first so a single drive sits in the middle of the shroud window.
  bays35: [
    { pose: { pos: [82, 60, 46], rot: [0, Q, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [82, 22, 46], rot: [0, Q, 0] }, insert: [0, 0, 1] },
  ],
  bays25: [
    { pose: { pos: [110, 190, TRAY_BACK], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [110, 310, TRAY_BACK], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
  ],
  fanMounts: [front(1, 100), front(2, 222), front(3, 344), top(1, -136), top(2, -2), top(3, 132), { id: 'rear-1', group: 'rear', center: [-216, 372, 40], rot: [0, -Q, 0], size: 120 }],
  radMounts: [
    { id: 'top', group: 'top', inward: [0, -1, 0], rot: [Q, 0, 2 * Q], faceOffset: 12.5, order: 'rad-first', airInward: false },
    { id: 'front', group: 'front', inward: [-1, 0, 0], rot: [0, -Q, Q], faceOffset: 12.5, order: 'fans-first', airInward: true },
  ],
  glass: [{ side: 'left', inner: GLASS_IN, outer: 116.5, rect: { min: [-226, FLOOR, GLASS_IN], max: [226, 496, 116.5] } }],
  sideInner: GLASS_IN,
  supportFloorY: SHROUD,
  shroudWindow: { x: 71, z: 54, w: 98, d: 96, y: 116.5 },
  boxes: [
    box([OUT.x0, 18, OUT.z0], [REAR_IN, OUT.y1, OUT.z1], 'rear'),
    box([227, 18, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'front'),
    box([223, FLOOR, -70], [224.5, TOP_IN, 70], 'front-bracket'),
    box([OUT.x0, 496.5, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'top'),
    box([-228, TOP_IN, -112], [222, 496.5, 112], 'top-bracket'),
    box([OUT.x0, 18, OUT.z0], [OUT.x1, FLOOR, OUT.z1], 'floor'),
    box([OUT.x0, 18, OUT.z0], [OUT.x1, OUT.y1, -116], 'right'),
    box([-226, FLOOR, GLASS_IN], [226, 496, 116.5], 'glass'),
    box([REAR_IN, SHROUD, TRAY_BACK], [196, TOP_IN, TRAY_FRONT], 'tray'),
    box([REAR_IN, 116.5, -116], [165, SHROUD, 111.5], 'shroud'),
    box([163.5, FLOOR, -116], [165, 116.5, 111.5], 'shroud'),
    box([REAR_IN, FLOOR, 110], [163.5, 116.5, 111.5], 'shroud'),
    box([0, FLOOR, -8], [162, 104, -6], 'cage'),
    box([-2, FLOOR, -8], [0, 104, 104], 'cage'),
    box([0, 58, -6], [162, 60, 104], 'cage'),
    box([-205, 0, -105], [-145, 18, 105], 'foot'),
    box([145, 0, -105], [205, 18, 105], 'foot'),
    box([196, 496.5, -62], [226, 499.6, 62], 'io'),
    ...standoffs(anchor),
  ],
  grommets: [
    { id: 'atx24', center: [62, 330, TRAY_FRONT], normal: [0, 0, 1], size: [22, 96] },
    { id: 'eps', center: [-190, 466, TRAY_FRONT], normal: [0, 0, 1], size: [56, 20] },
    { id: 'gpu', center: [-46, SHROUD, 82], normal: [0, 1, 0], size: [120, 30] },
    { id: 'front', center: [184, 250, TRAY_FRONT], normal: [0, 0, 1], size: [14, 150] },
    { id: 'top', center: [40, 466, TRAY_FRONT], normal: [0, 0, 1], size: [80, 20] },
    { id: 'rear', center: [-205, 300, TRAY_FRONT], normal: [0, 0, 1], size: [16, 60] },
    { id: 'sata', center: [52, 196, TRAY_FRONT], normal: [0, 0, 1], size: [18, 36] },
  ],
  views: {},
};
