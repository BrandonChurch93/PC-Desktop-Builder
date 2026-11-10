import { DIMS } from '../dims';
import { box, Q, R0, type Box, type V3 } from '../math';
import type { CaseLayout, FanMountLayout } from '../types';
import { HOLES_UNION } from './vitrine';

/**
 * Gantry: Paleforge's open frame, 520 deep, 240 wide, 540 tall. No enclosure: a thick vertical backplate on two machined
 * feet carries the board; one sheet of glass stands off the left side on four pillars; a spine at the front edge carries
 * three 120 mm fans, with a radiator nested in the spine's channel outside them, so a radiator costs no card length; the
 * supply lies on a shelf at the bottom and the cables come back to it behind the plate.
 *
 * Numbers checked against the catalog limits: free card length 460 (450 + 10), the same with a radiator; height over the
 * processor 186.9 (185 + 1.9); supply bay 190 (170 + 20); glass 51.4 mm past the tallest card that passes (142 tall).
 * Width 240, 15 over the catalog's 225, for the cable space behind the plate.
 */
const OUT = { x0: -260, x1: 260, y0: 0, y1: 540, z0: -127.5, z1: 112.5 };
export const GANTRY_REAR_IN = -258.5;
/** Top of the feet: the backplate and the shelf stand on them. */
export const GANTRY_FEET = 20;
export const GANTRY_SHELF = 26;
export const GANTRY_TRAY_FRONT = -97.35;
export const GANTRY_TRAY_BACK = -103.35;
export const GANTRY_GLASS_IN = 104;
export const GANTRY_GLASS_OUT = 108;
/** Fan centers on the spine, and the channel the radiator nests in outside them. */
export const GANTRY_FAN_X = 214;
export const GANTRY_SPINE_IN = 226.5;
export const GANTRY_SPINE_FACE = 256.5;
export const GANTRY_SPINE_OUT = 259.5;
export const GANTRY_SPINE_Y: [number, number] = [GANTRY_FEET, 535];
/** Half the spine channel's inner width: a radiator's sides clear its rails. */
export const GANTRY_SPINE_HALF = 62.5;
export const GANTRY_SPINE_RAIL = 8.5;
/** The supply's rear face, toward the rear of the frame, and the stop lip at the end of its bay. */
export const GANTRY_PSU_REAR = -205;
export const GANTRY_PSU_Z = -20;
export const GANTRY_PSU_STOP = -15;
export const GANTRY_SHELF_X: [number, number] = [-230, GANTRY_SPINE_IN];
export const GANTRY_FOOT_X = [-215, 215];
/** Glass pillars under the glass caps: the rear two stand on the plate, the front two on the spine's rail. */
export const GANTRY_PILLARS: [number, number][] = [[-244, 526], [244, 526], [-244, 34], [244, 34]];
export const GANTRY_PILLAR_R = 7;
export const GANTRY_ANCHOR: V3 = [-252.5, 495, -91];

const spine = (n: number, y: number): FanMountLayout => ({ id: `spine-${n}`, group: 'spine', center: [GANTRY_FAN_X, y, 0], rot: [0, -Q, 0], size: 120 });

function standoffs(a: V3): Box[] {
  return HOLES_UNION.map(([x, y]) => box([a[0] + x - 3.6, a[1] + y - 3.6, GANTRY_TRAY_FRONT], [a[0] + x + 3.6, a[1] + y + 3.6, a[2]], 'standoff'));
}

const H = GANTRY_SPINE_HALF; const R = GANTRY_SPINE_RAIL; const [sy0, sy1] = GANTRY_SPINE_Y;

export const GANTRY: CaseLayout = {
  id: 'gantry',
  outer: { min: [OUT.x0, OUT.y0, OUT.z0], max: [OUT.x1, OUT.y1, OUT.z1] },
  interior: { min: [GANTRY_REAR_IN, GANTRY_SHELF, GANTRY_TRAY_FRONT], max: [GANTRY_SPINE_IN, OUT.y1, GANTRY_GLASS_IN] },
  boardAnchor: GANTRY_ANCHOR,
  bracketX: GANTRY_REAR_IN,
  supply: { rearFace: [GANTRY_PSU_REAR, GANTRY_SHELF, GANTRY_PSU_Z], rot: R0, dir: [1, 0, 0], obstacleX: GANTRY_PSU_STOP, insert: [0, -1, 0] },
  // The drive lies on the shelf in front of the supply; the two 2.5 inch drives hang on the plate's back, behind the board.
  bays35: [{ pose: { pos: [70, GANTRY_SHELF, GANTRY_PSU_Z], rot: [0, Q, 0] }, insert: [0, -1, 0] }],
  bays25: [
    { pose: { pos: [-150, 300, GANTRY_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
    { pose: { pos: [-150, 190, GANTRY_TRAY_BACK - DIMS.bay25Standoff], rot: [-Q, 0, 0] }, insert: [0, 0, 1] },
  ],
  // Numbered from the top: a 240 takes the upper two, so its fittings at the top end clear the fan left below it.
  fanMounts: [spine(1, 404), spine(2, 282), spine(3, 160)],
  radMounts: [
    // Nested in the channel outside the fans: the radiator's face is 42.5 out from the fan centers, so its fans sit where the
    // spine's own fans do.
    { id: 'spine', group: 'spine', inward: [-1, 0, 0], rot: [0, -Q, Q], faceOffset: GANTRY_SPINE_FACE - GANTRY_FAN_X, order: 'rad-first', airInward: true },
  ],
  glass: [{ side: 'left', inner: GANTRY_GLASS_IN, outer: GANTRY_GLASS_OUT, rect: { min: [-256, 22, GANTRY_GLASS_IN], max: [256, 538, GANTRY_GLASS_OUT] } }],
  sideInner: GANTRY_GLASS_IN,
  supportFloorY: GANTRY_SHELF,
  boxes: [
    box([OUT.x0, 190, GANTRY_TRAY_FRONT], [GANTRY_REAR_IN, 368, 40], 'rear'),
    box([GANTRY_REAR_IN, GANTRY_FEET, GANTRY_TRAY_BACK], [GANTRY_SPINE_OUT, OUT.y1, GANTRY_TRAY_FRONT], 'tray'),
    ...GANTRY_FOOT_X.map((x) => box([x - 15, 0, OUT.z0], [x + 15, GANTRY_FEET, 100], 'foot')),
    box([GANTRY_SHELF_X[0], GANTRY_FEET, GANTRY_TRAY_FRONT], [GANTRY_SHELF_X[1], GANTRY_SHELF, 80], 'shelf'),
    box([GANTRY_PSU_STOP, GANTRY_SHELF, GANTRY_PSU_Z - 75], [GANTRY_PSU_STOP + 3, GANTRY_SHELF + 8, GANTRY_PSU_Z + 75], 'psu-bay'),
    box([GANTRY_SPINE_FACE, sy0, -H - R], [GANTRY_SPINE_OUT, sy1, H + R], 'spine'),
    box([GANTRY_SPINE_IN, sy0, -H - R], [GANTRY_SPINE_OUT, sy1, -H], 'spine'),
    box([GANTRY_SPINE_IN, sy0, H], [GANTRY_SPINE_OUT, sy1, H + R], 'spine'),
    box([GANTRY_SPINE_IN, sy0, GANTRY_TRAY_FRONT], [GANTRY_SPINE_OUT, sy1, -H - R], 'spine'),
    ...GANTRY_PILLARS.map(([x, y]) => box([x - GANTRY_PILLAR_R, y - GANTRY_PILLAR_R, x > 0 ? H + R : GANTRY_TRAY_FRONT], [x + GANTRY_PILLAR_R, y + GANTRY_PILLAR_R, GANTRY_GLASS_IN], 'pillar')),
    box([-256, 22, GANTRY_GLASS_IN], [256, 538, GANTRY_GLASS_OUT], 'glass'),
    ...standoffs(GANTRY_ANCHOR),
  ],
  grommets: [
    { id: 'atx24', center: [64, 395, GANTRY_TRAY_FRONT], normal: [0, 0, 1], size: [22, 96] },
    { id: 'eps', center: [-190, 518, GANTRY_TRAY_FRONT], normal: [0, 0, 1], size: [56, 18] },
    // The card's power runs leave its glass facing edge, drop in front of it and go back under it into the plate.
    { id: 'gpu', center: [70, 215, GANTRY_TRAY_FRONT], normal: [0, 0, 1], size: [60, 30] },
    { id: 'spine', center: [192, 282, GANTRY_TRAY_FRONT], normal: [0, 0, 1], size: [16, 120] },
    { id: 'sata', center: [22, 262, GANTRY_TRAY_FRONT], normal: [0, 0, 1], size: [18, 36] },
    // Low beside the supply's sockets: every run comes back through here from behind the plate.
    { id: 'psu', center: [32, 130, GANTRY_TRAY_FRONT], normal: [0, 0, 1], size: [128, 50] },
  ],
  views: {},
};
