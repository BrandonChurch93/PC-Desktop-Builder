import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/data/catalog';
import { decode, encode } from '../../src/engine/codec';
import { buildFromPreset, gpuClearance, install, occupiedFanMounts, remove, revalidate } from '../../src/engine/rules';
import { sheet, temps } from '../../src/engine/sheet';
import type { ActionOpts, Build } from '../../src/engine/types';

type Action = { type: 'install' | 'remove'; category: string; id?: string; opts?: ActionOpts };
type Fixtures = {
  presets: { id: string; build: Build; encoded: string; sheet: unknown; temps: Record<'idle' | 'half' | 'full', unknown>; occupiedFanMounts: string[]; gpuMaxLength: number }[];
  checks: { name: string; build: Build; action: Action; expect: { ok: boolean; code: string | null; removed: unknown[]; sheet: unknown; cooler?: unknown } }[];
  decodes: { name: string; encoded: string; expect: { error?: string; build?: Build; removed?: unknown[] } }[];
};

const fixtures = JSON.parse(readFileSync('kit/data/fixtures.json', 'utf8')) as Fixtures;

describe('fixtures: presets', () => {
  it('covers all six presets', () => {
    expect(fixtures.presets.map((p) => p.id)).toEqual(catalog.presets.map((p) => p.id));
  });
  for (const p of fixtures.presets) {
    describe(p.id, () => {
      it('builds from the catalog preset exactly as the fixture', () => {
        const spec = catalog.presets.find((x) => x.id === p.id);
        expect(spec).toBeDefined();
        if (spec) expect(buildFromPreset(spec)).toEqual(p.build);
      });
      it('revalidates unchanged with nothing removed', () => {
        const r = revalidate(p.build);
        expect(r.removed).toEqual([]);
        expect(r.build).toEqual(p.build);
      });
      it('has the fixture sheet', () => expect(sheet(p.build)).toEqual(p.sheet));
      it('has the fixture temperatures', () => {
        expect(temps(p.build, 0)).toEqual(p.temps.idle);
        expect(temps(p.build, 0.5)).toEqual(p.temps.half);
        expect(temps(p.build, 1)).toEqual(p.temps.full);
      });
      it('encodes to the fixture code and decodes back', () => {
        expect(encode(p.build)).toBe(p.encoded);
        const d = decode(p.encoded);
        expect('build' in d).toBe(true);
        if ('build' in d) {
          expect(d.removed).toEqual([]);
          expect(d.build).toEqual(p.build);
          expect(encode(d.build)).toBe(p.encoded);
        }
      });
      it('has the fixture taken fan mounts and graphics clearance', () => {
        expect(occupiedFanMounts(p.build)).toEqual(p.occupiedFanMounts);
        expect(gpuClearance(p.build)).toBe(p.gpuMaxLength);
      });
    });
  }
});

describe('fixtures: checks', () => {
  for (const c of fixtures.checks) {
    it(c.name, () => {
      const a = c.action;
      const r = a.type === 'install' ? install(c.build, a.category, a.id ?? '', a.opts ?? {}) : remove(c.build, a.category, a.opts ?? {});
      expect(r.ok).toBe(c.expect.ok);
      expect(r.ok ? null : 'code' in r ? r.code : null).toBe(c.expect.code);
      expect(r.removed).toEqual(c.expect.removed);
      if (c.expect.ok) {
        expect(sheet(r.build)).toEqual(c.expect.sheet);
        expect(r.build.cooler).toEqual(c.expect.cooler);
      } else {
        expect(r.build).toEqual(c.build);
      }
    });
  }
});

describe('fixtures: decodes', () => {
  for (const d of fixtures.decodes) {
    it(d.name, () => {
      const r = decode(d.encoded);
      if (d.expect.error) {
        expect(r).toEqual({ error: d.expect.error });
      } else {
        expect('build' in r).toBe(true);
        if ('build' in r) {
          expect(r.build).toEqual(d.expect.build);
          expect(r.removed).toEqual(d.expect.removed);
        }
      }
    });
  }
});
