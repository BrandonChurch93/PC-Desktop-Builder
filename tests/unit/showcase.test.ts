import { describe, expect, it } from 'vitest';
import { catalog, getCable, LIGHT_TARGETS } from '../../src/data/catalog';
import { SHOWCASE } from '../../src/data/showcase';
import { decode, encode } from '../../src/engine/codec';
import { buildFromShowcase, occupiedFanMounts, revalidate } from '../../src/engine/rules';
import { sanitizeLighting } from '../../src/engine/sanitize';
import { sheet } from '../../src/engine/sheet';

describe('showcase builds', () => {
  it('has five, with ids and names of their own', () => {
    expect(SHOWCASE.length).toBe(5);
    const ids = SHOWCASE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SHOWCASE) {
      expect(catalog.presets.some((p) => p.id === s.id || p.name === s.name), s.id).toBe(false);
      expect(s.blurb, s.id).not.toMatch(/[—!]/);
    }
  });

  for (const s of SHOWCASE) {
    describe(s.name, () => {
      const b = buildFromShowcase(s);
      it('installs whole: the rules take every part and move nothing', () => {
        const r = revalidate(b);
        expect(r.removed).toEqual([]);
        expect(r.build).toEqual(b);
      });
      it('runs, with the glass on, and with no warning past information', () => {
        const sh = sheet(b);
        expect(sh.missing).toEqual([]);
        expect(sh.canPowerOn).toBe(true);
        expect(sh.warnings.filter((w) => w.level !== 'info')).toEqual([]);
        expect(b.glass).toBe(true);
        expect(getCable(b.cables)).toBeDefined();
      });
      it('leaves no fan on a mount its radiator takes', () => {
        for (const m of occupiedFanMounts(b)) expect(b.fans[m], m).toBeUndefined();
      });
      it('keeps its lighting as written, and lights every target it has', () => {
        expect(sanitizeLighting(s.build.lighting)).toEqual(s.build.lighting);
        for (const t of LIGHT_TARGETS) expect(b.lighting.overrides[t], t).not.toBe('off');
        expect(b.lighting.brightness).toBeGreaterThan(0);
      });
      it('round trips through a share link', () => {
        const d = decode(encode(b));
        expect('error' in d).toBe(false);
        if (!('error' in d)) expect(d.build).toEqual(b);
      });
    });
  }
});
