import { describe, expect, it } from 'vitest';
import { catalog, getCase, getCooler } from '../../src/data/catalog';
import { install, presetBuild, revalidate } from '../../src/engine/rules';
import { BOARD_LAYOUTS } from '../../src/world/layout/boards';
import { CASE_LAYOUTS } from '../../src/world/layout/cases';
import { place } from '../../src/world/layout/place';
import { baseBuild, cardTop, freeCpuHeight, freeGpuLength, intersections, psuBayLength, ramGap, tallestPassing, withAllFans } from './layout-helpers';

const laidOut = catalog.cases.filter((c) => CASE_LAYOUTS[c.id]);

describe('layout', () => {
  it('has a layout for the Vitrine at least', () => expect(laidOut.map((c) => c.id)).toContain('vitrine'));

  for (const c of laidOut) {
    describe(c.id, () => {
      const L = CASE_LAYOUTS[c.id]!;

      it('B7 has an anchor for every fan mount, radiator mount and bay', () => {
        expect(L.fanMounts.map((m) => m.id)).toEqual(c.fanMounts.map((m) => m.id));
        for (const m of c.fanMounts) {
          const lm = L.fanMounts.find((x) => x.id === m.id)!;
          expect(lm.group).toBe(m.group);
          expect(lm.size).toBe(m.size);
        }
        expect(L.radMounts.map((m) => m.id).sort()).toEqual(c.radMounts.map((m) => m.id).sort());
        expect(L.bays25.length).toBe(c.bays25);
        expect(L.bays35.length).toBe(c.bays35);
      });

      it('B3 free graphics length with fans on every mount and with a radiator on each mount', () => {
        const fans = withAllFans(baseBuild(c));
        const free = freeGpuLength(fans);
        expect(free).toBeGreaterThanOrEqual(c.gpuMaxLength + 2);
        expect(free).toBeLessThanOrEqual(c.gpuMaxLength + 30);
        for (const rm of c.radMounts) {
          for (const size of rm.sizes) {
            const cooler = catalog.coolers.find((k) => k.radSize === size)!;
            const r = install(fans, 'cooler', cooler.id, { mount: rm.id });
            expect(r.ok, `${cooler.id} on ${rm.id}`).toBe(true);
            const withFans = withAllFans(r.build);
            const f = freeGpuLength(withFans);
            const max = c.gpuMaxLength - rm.gpuPenalty;
            expect(f, `${cooler.id} on ${rm.id}`).toBeGreaterThanOrEqual(max + 2);
            expect(f, `${cooler.id} on ${rm.id}`).toBeLessThanOrEqual(max + 30);
          }
        }
      });

      it('B4 free height over the processor', () => {
        for (const size of c.boardSizes) {
          const board = catalog.boards.find((b) => b.size === size)!;
          const h = freeCpuHeight(baseBuild(c, board.id));
          expect(h, size).toBeGreaterThanOrEqual(c.coolerMaxHeight + 1);
          expect(h, size).toBeLessThanOrEqual(c.coolerMaxHeight + 15);
        }
      });

      it('B5 supply bay length', () => {
        const len = psuBayLength(c.id);
        expect(len).toBeGreaterThanOrEqual(c.psuMaxLength + 2);
        expect(len).toBeLessThanOrEqual(c.psuMaxLength + 40);
      });

      it('B6 coolers with a memory clearance leave it over the slots within 3 mm', () => {
        for (const k of catalog.coolers.filter((x) => x.ramClearance !== null)) {
          const gap = ramGap(c, k.id)!;
          expect(Math.abs(gap - (getCooler(k.id)!.ramClearance ?? 0)), k.id).toBeLessThanOrEqual(3);
        }
      });

      it('B9 the glass stands at least 34 mm beyond the tallest card that passes', () => {
        const tallest = catalog.gpus.filter((g) => g.thickness <= c.gpuMaxThickness && g.length <= c.gpuMaxLength).sort((a, b) => b.height - a.height)[0]!;
        expect(tallest.height).toBe(tallestPassing(c));
        for (const size of c.boardSizes) {
          const board = catalog.boards.find((b) => b.size === size)!;
          const top = cardTop(baseBuild(c, board.id), tallest.id);
          expect(L.sideInner - top, size).toBeGreaterThanOrEqual(34);
        }
      });
    });
  }

  it('B7 every board has anchors for its slot counts', () => {
    for (const b of catalog.boards) {
      const L = BOARD_LAYOUTS[b.size];
      expect(L.dimms.length).toBeGreaterThanOrEqual(b.ramSlots);
      expect(L.m2.length).toBeGreaterThanOrEqual(b.m2Slots);
      expect(L.sata.length).toBeGreaterThanOrEqual(b.sataPorts);
      expect(L.w).toBe(catalog.constants.boardDims[b.size].w);
      expect(L.h).toBe(catalog.constants.boardDims[b.size].h);
    }
  });

  it('B2 the preset builds place with no intersections', () => {
    for (const p of catalog.presets) {
      if (!CASE_LAYOUTS[p.build.case.id]) continue;
      const b = revalidate(presetBuild(p.id)!).build;
      expect(intersections(place(b)), p.id).toEqual([]);
    }
  });

  it('a liquid cooler on every mount with fans on every free mount places cleanly in each case', () => {
    for (const c of laidOut) {
      for (const rm of c.radMounts) for (const size of rm.sizes) {
        const cooler = catalog.coolers.find((k) => k.radSize === size)!;
        const b0 = withAllFans(baseBuild(c));
        const r = install(b0, 'cooler', cooler.id, { mount: rm.id });
        const b = withAllFans(r.build);
        expect(intersections(place(b)), `${c.id} ${cooler.id} ${rm.id}`).toEqual([]);
      }
    }
  });

  it('every case in the catalog is known to the layout table or waiting for Phase 4', () => {
    for (const c of catalog.cases) expect(getCase(c.id)).toBeDefined();
  });
});
