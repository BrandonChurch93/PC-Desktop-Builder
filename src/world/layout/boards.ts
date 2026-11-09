import { getBoard, K, type BoardSize, type BoardSpec } from '../../data/catalog';
import { DIMS } from './dims';
import { box, cbox, type Box } from './math';
import type { BoardLayout } from './types';

const T = DIMS.boardT;
const pitch = K.slotPitch;

const ATX_TOP = {
  socket: { x: 112, y: -82 },
  eps: { x: 44, y: -8 },
  atx24: { x: 236.5, y: -105 },
  vrmRear: { x0: 33, x1: 57, y0: -22, y1: -122, h: 38 },
  vrmTop: { x0: 60, x1: 152, y0: -12, y1: -34, h: 34 },
};

const dimm4 = (y: number) => [
  { name: 'A1', x: 166, y }, { name: 'A2', x: 175.5, y }, { name: 'B1', x: 185, y }, { name: 'B2', x: 194.5, y },
];

export const BOARD_LAYOUTS: Record<BoardSize, BoardLayout> = {
  atx: {
    size: 'atx', w: K.boardDims.atx.w, h: K.boardDims.atx.h,
    ...ATX_TOP,
    dimms: dimm4(-84),
    pcie: [
      { y: -160, x0: 22, len: DIMS.pcieX16Length, kind: 'x16r' },
      { y: -160 - 2 * pitch, x0: 22, len: DIMS.pcieX16Length, kind: 'x16' },
      { y: -160 - 4 * pitch, x0: 22, len: 25, kind: 'x1' },
      { y: -160 - 6 * pitch, x0: 22, len: 39, kind: 'x4' },
    ],
    m2: [
      { x0: 40, y: -137, level: 0 },
      { x0: 40, y: -160 - pitch, level: 0 },
      { x0: 40, y: -160 - 3 * pitch, level: 0 },
      { x0: 40, y: -160 - 5 * pitch, level: 0 },
    ],
    sata: [-212, -228, -244].flatMap((y) => [{ x: 237.5, y, level: 0 as const }, { x: 237.5, y, level: 1 as const }]),
    holes: [[10.2, -10.2], [157, -10.2], [234, -10.2], [10.2, -165], [157, -165], [234, -165], [10.2, -292], [157, -292], [234, -292]],
    chipset: { x0: 142, x1: 212, y0: -206, y1: -282, h: 10 },
    coin: { x: 122, y: -290 },
    headers: [
      { x: 150, y: -6, w: 10.5, h: 6, pins: [4, 1], kind: 'fan' },
      { x: 163, y: -6, w: 10.5, h: 6, pins: [4, 1], kind: 'fan' },
      { x: 100, y: -300, w: 10.5, h: 6, pins: [4, 1], kind: 'fan' },
      { x: 140, y: -300, w: 8, h: 6, pins: [3, 1], kind: 'rgb' },
      { x: 193, y: -298, w: 13, h: 6, pins: [5, 2], kind: 'panel' },
      { x: 238, y: -183, w: 9.6, h: 26, pins: [2, 10], kind: 'usb' },
      { x: 166, y: -298, w: 13, h: 6, pins: [5, 2], kind: 'usb' },
    ],
  },
  matx: {
    size: 'matx', w: K.boardDims.matx.w, h: K.boardDims.matx.h,
    ...ATX_TOP,
    dimms: dimm4(-84),
    pcie: [
      { y: -160, x0: 22, len: DIMS.pcieX16Length, kind: 'x16r' },
      { y: -160 - 2 * pitch, x0: 22, len: DIMS.pcieX16Length, kind: 'x16' },
      { y: -160 - 3 * pitch, x0: 22, len: 25, kind: 'x1' },
    ],
    m2: [
      { x0: 40, y: -137, level: 0 },
      { x0: 40, y: -160 - pitch, level: 0 },
    ],
    sata: [-203, -219].flatMap((y) => [{ x: 237.5, y, level: 0 as const }, { x: 237.5, y, level: 1 as const }]),
    holes: [[10.2, -10.2], [157, -10.2], [234, -10.2], [10.2, -165], [157, -165], [234, -165], [10.2, -234], [157, -234], [234, -234]],
    chipset: { x0: 142, x1: 212, y0: -172, y1: -226, h: 10 },
    coin: { x: 130, y: -218 },
    headers: [
      { x: 150, y: -6, w: 10.5, h: 6, pins: [4, 1], kind: 'fan' },
      { x: 163, y: -6, w: 10.5, h: 6, pins: [4, 1], kind: 'fan' },
      { x: 70, y: -239, w: 10.5, h: 6, pins: [4, 1], kind: 'fan' },
      { x: 90, y: -239, w: 8, h: 6, pins: [3, 1], kind: 'rgb' },
      { x: 205, y: -239, w: 13, h: 6, pins: [5, 2], kind: 'panel' },
      { x: 238, y: -183, w: 9.6, h: 26, pins: [2, 10], kind: 'usb' },
      { x: 178, y: -239, w: 13, h: 6, pins: [5, 2], kind: 'usb' },
    ],
  },
  itx: {
    size: 'itx', w: K.boardDims.itx.w, h: K.boardDims.itx.h,
    socket: { x: 82, y: -76 },
    eps: { x: 40, y: -8 },
    atx24: { x: 162.5, y: -62 },
    vrmRear: { x0: 33, x1: 51, y0: -22, y1: -115, h: 36 },
    vrmTop: { x0: 56, x1: 118, y0: -12, y1: -34, h: 32 },
    dimms: [{ name: 'A1', x: 140, y: -76 }, { name: 'B1', x: 149.5, y: -76 }],
    pcie: [{ y: -160, x0: 22, len: DIMS.pcieX16Length, kind: 'x16r' }],
    m2: [{ x0: 38, y: -135, level: 0 }, { x0: 38, y: -135, level: 1 }],
    sata: [{ x: 164, y: -133, level: 0 }, { x: 164, y: -133, level: 1 }],
    holes: [[10.2, -10.2], [160, -10.2], [10.2, -163], [160, -163]],
    chipset: null,
    coin: { x: 128, y: -159 },
    headers: [
      { x: 128, y: -6, w: 10.5, h: 6, pins: [4, 1], kind: 'fan' },
      { x: 150, y: -165, w: 13, h: 6, pins: [5, 2], kind: 'panel' },
      { x: 163, y: -104, w: 9.6, h: 26, pins: [2, 10], kind: 'usb' },
    ],
  },
};

export const boardLayout = (b: BoardSpec) => BOARD_LAYOUTS[b.size];

/** The cross section of a power plug's housing for its wire grid. */
export const plugSection = (rows: number, cols: number, pitch: number) => ({ ph: rows * pitch + 2.4, pw: cols * pitch + 2.4 });

/**
 * The 24 pin header is a right angle header flush with the board's front edge, as on many premium boards: the plug goes in
 * along +x and lies flat, so it can be seen from the glass. A vertical header hid its plug under the cable's bend.
 */
export function atx24Header(boardW: number) {
  const { ph, pw } = plugSection(2, 12, 4.2);
  const h = ph + 2 * DIMS.plugWall;
  return { x0: boardW - DIMS.edgeHeaderDepth, x1: boardW, w: pw + 2 * DIMS.plugWall, h, mid: T + h / 2 };
}

/** Height of an M.2 region box above the board face. A stacked heatsink holds two drives. */
const m2Height = (stacked: boolean) => (stacked ? 16.5 : DIMS.m2PlateHeight);
const socketSize = (platform: string): [number, number] => (platform === 'hb' ? [60, 84] : [60, 74]);

/** Collision boxes of a board, in its own space: x from the rear edge, y down from the top, z from the back face. */
export function boardBoxes(id: string): Box[] {
  const spec = getBoard(id);
  if (!spec) return [];
  const L = boardLayout(spec);
  const out: Box[] = [];
  out.push(box([0, -L.h, 0], [L.w, 0, T], 'pcb'));
  out.push(box([L.socket.x - 32, L.socket.y + 32, -3.2], [L.socket.x + 32, L.socket.y - 32, 0], 'backplate'));
  out.push(box([-3, -4, T], [31, -152, 42], 'io'));
  const vr = L.vrmRear; out.push(box([vr.x0, vr.y0, T], [vr.x1, vr.y1, T + vr.h], 'vrm'));
  const vt = L.vrmTop; out.push(box([vt.x0, vt.y0, T], [vt.x1, vt.y1, T + vt.h], 'vrm'));
  out.push(cbox([L.eps.x, L.eps.y, T + 6.5], [21.2, 10.2, 13], 'eps'));
  const hd = atx24Header(L.w);
  out.push(box([hd.x0, L.atx24.y - hd.w / 2, T], [hd.x1, L.atx24.y + hd.w / 2, T + hd.h + 0.9], 'atx24'));
  const [sw, sh] = socketSize(spec.platform);
  out.push(cbox([L.socket.x, L.socket.y, T + 2.5], [sw, sh, 5], 'socket'));
  for (const d of L.dimms.slice(0, spec.ramSlots)) out.push(cbox([d.x, d.y, T + DIMS.dimmSlotHeight / 2], [6.6, DIMS.dimmSlotLength, DIMS.dimmSlotHeight], `dimm:${d.name}`));
  L.pcie.forEach((s, i) => out.push(box([s.x0, s.y - DIMS.pcieSlotWidth / 2, T], [s.x0 + s.len, s.y + DIMS.pcieSlotWidth / 2, T + DIMS.pcieSlotHeight], i === 0 ? 'pcie1' : 'pcie')));
  const m2 = L.m2.slice(0, spec.m2Slots);
  const stacked = m2.some((m) => m.level === 1);
  m2.forEach((m, i) => { if (m.level === 0) out.push(box([m.x0 - 6, m.y - 13, T], [m.x0 + 92, m.y + 13, T + m2Height(stacked)], `m2:${i + 1}`)); });
  if (L.chipset) { const c = L.chipset; out.push(box([c.x0, c.y0, T], [c.x1, c.y1, T + c.h], 'chipset')); }
  const ports = L.sata.slice(0, spec.sataPorts);
  if (ports.length) {
    const ys = ports.map((p) => p.y);
    out.push(box([ports[0]!.x - 6.5, Math.max(...ys) + 7, T], [L.w, Math.min(...ys) - 7, T + 13], 'sata'));
  }
  out.push(cbox([L.coin.x, L.coin.y, T + 2.6], [21, 21, 5.2], 'coin'));
  for (const h of L.headers) out.push(cbox([h.x, h.y, T + 4.5], [h.w, h.h, 9], 'header'));
  for (const [x, y] of L.holes) out.push(cbox([x, y, T + 1.2], [7.4, 7.4, 2.4], 'screw'));
  return out;
}

/** The z of a board's front face, in board space. */
export const BOARD_FRONT = T;

/** Slot names in the order memory kits fill them. */
export function dimmFill(slots: number, kits: number[]): string[][] {
  const order = slots >= 4 ? ['A1', 'A2', 'B1', 'B2'] : ['A1', 'B1'];
  const used = new Set<string>();
  const out: string[][] = [];
  for (const sticks of kits) {
    let pick: string[];
    if (slots < 4) pick = order.filter((s) => !used.has(s)).slice(0, sticks);
    else if (sticks >= 4) pick = order.filter((s) => !used.has(s)).slice(0, sticks);
    else if (!used.has('A2') && !used.has('B2')) pick = ['A2', 'B2'];
    else pick = ['A1', 'B1'].filter((s) => !used.has(s));
    for (const s of pick) used.add(s);
    out.push(pick);
  }
  return out;
}
