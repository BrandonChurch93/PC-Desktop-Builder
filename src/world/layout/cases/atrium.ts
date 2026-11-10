import { box, Q, R0, type Box, type V3 } from '../math';
import type { CaseLayout, FanMountLayout } from '../types';
import { HOLES_UNION } from './vitrine';

/**
 * Atrium: a dual chamber showcase. The main chamber sits between the board tray and the left glass; the supply and the 3.5
 * inch drives live in a second chamber behind the tray. Glass on the left and the front meets at a corner with no pillar.
 * Mounts in a group stand 134 apart, so a 240 radiator on the first two clears the third mount's fan. The bottom fans sit in
 * a basin under a perforated floor high enough to clear a bottom radiator's fittings; the side mounts are cut into the tray in front of the board, with
 * their fans (and a radiator) recessed into the second chamber, so the longest card passes in front of them.
 *
 * Numbers checked against the catalog limits: free card length 447.5 (420 + 2 to 30), height over the processor 172 (165 + 1
 * to 15), supply bay 224 (220 + 2 to 40), glass 36.5 mm beyond the tallest card's edge.
 */
const OUT = { x0: -227.5, x1: 227.5, y0: 0, y1: 470, z0: -145, z1: 145 };
export const ATRIUM_REAR_IN = -226;
const PLINTH = 10;
const BASIN = 12;
export const ATRIUM_FLOOR = 88;
const FLOOR_PLATE = 86;
const TOP_IN = 466;
export const ATRIUM_TRAY_FRONT = -45.45;
export const ATRIUM_TRAY_BACK = -46.65;
const GLASS_IN = 141;
const FRONT_IN = 221.5;
const RIGHT_IN = -140.8;
const SIDE_Z = ATRIUM_TRAY_BACK - 12.5;
const MAIN_Z = (ATRIUM_TRAY_FRONT + GLASS_IN) / 2;

const anchor: V3 = [-218, 408, -39.1];

const side = (n: number, y: number): FanMountLayout => ({ id: `side-${n}`, group: 'side', center: [140, y, SIDE_Z], rot: R0, size: 120 });
const bottom = (n: number, x: number): FanMountLayout => ({ id: `bottom-${n}`, group: 'bottom', center: [x, BASIN + 12.5, MAIN_Z], rot: [-Q, 0, 0], size: 120 });
const top = (n: number, x: number): FanMountLayout => ({ id: `top-${n}`, group: 'top', center: [x, TOP_IN - 12.5, MAIN_Z], rot: [-Q, 0, 0], size: 120 });

function standoffs(a: V3): Box[] {
  return HOLES_UNION.map(([x, y]) => box([a[0] + x - 3.6, a[1] + y - 3.6, ATRIUM_TRAY_FRONT], [a[0] + x + 3.6, a[1] + y + 3.6, a[2]], 'standoff'));
}

export const ATRIUM: CaseLayout = {
  id: 'atrium',
  outer: { min: [OUT.x0, OUT.y0, OUT.z0], max: [OUT.x1, OUT.y1, OUT.z1] },
  interior: { min: [ATRIUM_REAR_IN, ATRIUM_FLOOR, ATRIUM_TRAY_FRONT], max: [FRONT_IN, TOP_IN, GLASS_IN] },
  boardAnchor: anchor,
  bracketX: ATRIUM_REAR_IN,
  // The supply lies on its side in the second chamber, its fan toward the tray, rear face at the rear wall.
  supply: { rearFace: [ATRIUM_REAR_IN, 88, -140], rot: [Q, 0, 0], dir: [1, 0, 0], obstacleX: -2, insert: [1, 0, 0] },
  // Drives stand on their long edge behind the tray, in front of the supply.
  bays35: [
    { pose: { pos: [56, 87.5, -140], rot: [Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [160, 87.5, -140], rot: [Q, 0, 0] }, insert: [0, 0, 1] },
  ],
  bays25: [
    { pose: { pos: [-170, 330, ATRIUM_TRAY_BACK], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [-95, 330, ATRIUM_TRAY_BACK], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [-20, 330, ATRIUM_TRAY_BACK], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
  ],
  fanMounts: [side(1, 90), side(2, 224), side(3, 358), bottom(1, -112), bottom(2, 22), bottom(3, 156), top(1, -147), top(2, -13), top(3, 121), { id: 'rear-1', group: 'rear', center: [-213.5, 350, 75], rot: [0, -Q, 0], size: 120 }],
  radMounts: [
    { id: 'top', group: 'top', inward: [0, -1, 0], rot: [Q, 0, 2 * Q], faceOffset: 12.5, order: 'rad-first', airInward: false },
    // Behind the tray: the radiator stands outermost in the second chamber and its fans sit flush with the tray.
    { id: 'side', group: 'side', inward: [0, 0, 1], rot: [0, 0, Q], faceOffset: 42.5, order: 'rad-first', airInward: true },
    // In the basin: fans on the basin floor, the radiator over them, under the perforated floor.
    { id: 'bottom', group: 'bottom', inward: [0, 1, 0], rot: [-Q, 0, 0], faceOffset: 12.5, order: 'fans-first', airInward: true },
  ],
  glass: [
    { side: 'left', inner: GLASS_IN, outer: 145, rect: { min: [-225.5, BASIN, GLASS_IN], max: [225.5, 468, 145] } },
    { side: 'front', inner: FRONT_IN, outer: 225.5, rect: { min: [FRONT_IN, BASIN, ATRIUM_TRAY_BACK], max: [225.5, 468, GLASS_IN] } },
  ],
  sideInner: GLASS_IN,
  supportFloorY: ATRIUM_FLOOR,
  boxes: [
    box([OUT.x0, PLINTH, OUT.z0], [ATRIUM_REAR_IN, OUT.y1, OUT.z1], 'rear'),
    box([OUT.x0, PLINTH, OUT.z0], [OUT.x1, OUT.y1, RIGHT_IN], 'right'),
    box([OUT.x0, TOP_IN, OUT.z0], [OUT.x1, OUT.y1, OUT.z1], 'top'),
    box([OUT.x0, OUT.y0, OUT.z0], [OUT.x1, BASIN, OUT.z1], 'floor'),
    box([ATRIUM_REAR_IN, FLOOR_PLATE, ATRIUM_TRAY_FRONT], [FRONT_IN, ATRIUM_FLOOR, GLASS_IN], 'floor-plate'),
    box([-225.5, BASIN, GLASS_IN], [225.5, 468, 145], 'glass'),
    box([FRONT_IN, BASIN, ATRIUM_TRAY_BACK], [225.5, 468, GLASS_IN], 'glass'),
    box([FRONT_IN, PLINTH, RIGHT_IN], [OUT.x1, OUT.y1, ATRIUM_TRAY_BACK], 'front'),
    box([ATRIUM_REAR_IN, BASIN, ATRIUM_TRAY_BACK], [FRONT_IN, TOP_IN, ATRIUM_TRAY_FRONT], 'tray'),
    box([-2, BASIN, RIGHT_IN], [0, 180, ATRIUM_TRAY_BACK], 'psu-bay'),
    ...standoffs(anchor),
  ],
  grommets: [
    { id: 'atx24', center: [66, 308, ATRIUM_TRAY_FRONT], normal: [0, 0, 1], size: [22, 96] },
    { id: 'eps', center: [-186, 440, ATRIUM_TRAY_FRONT], normal: [0, 0, 1], size: [56, 20] },
    // Beside the board's lower right edge, clear of the first side fan opening: the graphics runs dive here.
    { id: 'gpu', center: [66, 128, ATRIUM_TRAY_FRONT], normal: [0, 0, 1], size: [22, 40] },
    { id: 'top', center: [40, 440, ATRIUM_TRAY_FRONT], normal: [0, 0, 1], size: [80, 20] },
    { id: 'rear', center: [-205, 290, ATRIUM_TRAY_FRONT], normal: [0, 0, 1], size: [16, 60] },
    { id: 'sata', center: [56, 174, ATRIUM_TRAY_FRONT], normal: [0, 0, 1], size: [18, 36] },
    { id: 'bottom', center: [196, 50, ATRIUM_TRAY_FRONT], normal: [0, 0, 1], size: [16, 40] },
  ],
  views: {},
};
