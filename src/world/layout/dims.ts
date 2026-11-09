/** Shared physical dimensions in mm. Real standards where one exists. */
export const DIMS = {
  boardT: 1.6,
  standoff: 6.35,
  /** CPU top above the board's front face once seated */
  cpuTop: 6.5,
  /** floor of a DIMM slot above the board face. Memory height and cooler ram clearance are measured from here */
  dimmFloor: 2.0,
  dimmLength: 133.35,
  dimmSlotLength: 146,
  dimmSlotHeight: 9.2,
  dimmThick: 6.6,
  /** distance from the inner face of a card bracket to the start of its edge connector */
  fingerOffset: 28,
  /** the edge connector's bottom sits this far above the board face, inside the slot */
  fingerSeat: 2,
  pcieX16Length: 89,
  pcieSlotHeight: 11,
  pcieSlotWidth: 7.6,
  /** a card's shroud and backplate start above the slot so board parts fit under it */
  cardClear: 13,
  backplateRise: 5,
  m2Width: 22,
  m2Length: 80,
  m2PlateHeight: 8.6,
  fan: { 120: { size: 120, holes: 105, thick: 25 }, 140: { size: 140, holes: 124.5, thick: 25 } },
  slimFanThick: 15,
  radCore: 27,
  radThick: 30,
  radWidth: 124,
  /** fan spacing on a radiator, fixed by its holes */
  radFanPitch: 122,
  radLength: { 240: 277, 360: 397 } as Record<number, number>,
  psu: { atx: { w: 150, h: 86 }, sfx: { w: 125, h: 63.5 } },
  hdd: { w: 101.6, l: 147, h: 26.1 },
  ssd: { w: 69.85, l: 100, h: 7 },
  bracketT: 1.0,
  mm: 0.001,
} as const;
