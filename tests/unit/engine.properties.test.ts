import { describe, expect, it } from 'vitest';
import { CATEGORIES, catalog, getCase, LIGHT_TARGETS, partsOf, type Category } from '../../src/data/catalog';
import { decode, encode } from '../../src/engine/codec';
import { clearFans, emptyBuild, fillFans, install, remove, revalidate } from '../../src/engine/rules';
import { sanitizeLighting } from '../../src/engine/sanitize';
import type { Build } from '../../src/engine/types';
import { rng } from './rng';

const NAMES = ['', 'Night Rig', 'Night Rig · v2', 'Dual chamber · white', 'Build 07', 'Ünïcødé ✓ name', 'x'.repeat(40), '日本語のビルド'];

function randomStep(b: Build, r: ReturnType<typeof rng>): Build {
  const roll = r.next();
  if (roll < 0.62) {
    const category = r.pick(CATEGORIES) as Category;
    if (category === 'storage') {
      const res = install(b, 'storage', r.pick(['nvme', 'ssd', 'hdd']));
      return res.build;
    }
    const part = r.pick(partsOf(category));
    const opts: { mount?: string; finish?: string } = {};
    const c = b.case ? getCase(b.case.id) : undefined;
    if (category === 'fan' && c) opts.mount = r.pick(c.fanMounts).id;
    if (category === 'cooler' && c && r.next() < 0.5) opts.mount = r.pick(c.radMounts).id;
    if (category === 'case') opts.finish = r.pick(getCase(part.id)?.finishes ?? ['onyx']);
    return install(b, category, part.id, opts).build;
  }
  if (roll < 0.8) {
    const category = r.pick(['case', 'board', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'fan'] as const);
    if (category === 'ram') return remove(b, 'ram', { index: b.ram.length ? r.int(b.ram.length) : 0 }).build;
    if (category === 'storage') return remove(b, 'storage', { type: r.pick(['nvme', 'ssd', 'hdd'] as const) }).build;
    if (category === 'fan') {
      const mounts = Object.keys(b.fans);
      return mounts.length ? remove(b, 'fan', { mount: r.pick(mounts) }).build : b;
    }
    if (r.next() < 0.3) return remove(b, category).build;
    return b;
  }
  if (roll < 0.85) return r.next() < 0.5 ? fillFans(b, r.pick(catalog.fans).id).build : clearFans(b).build;
  if (roll < 0.95) {
    const next = structuredClone(b);
    const p = r.pick(catalog.lighting.presets);
    next.lighting = { effect: p.effect, speed: r.int(151), brightness: r.int(101), direction: r.next() < 0.5 ? 1 : -1, stops: [...p.stops], overrides: {} };
    for (const t of LIGHT_TARGETS) {
      const x = r.next();
      if (x < 0.15) next.lighting.overrides[t] = 'off';
      else if (x < 0.3) {
        const q = r.pick(catalog.lighting.presets);
        next.lighting.overrides[t] = { effect: q.effect, speed: q.speed, brightness: q.brightness, direction: -1, stops: [...q.stops] };
      }
    }
    next.lighting = sanitizeLighting(next.lighting);
    next.glass = r.next() < 0.8;
    next.cables = r.pick(catalog.cables).id;
    return revalidate(next).build;
  }
  const next = structuredClone(b);
  next.name = r.pick(NAMES);
  return revalidate(next).build;
}

describe('engine properties over seeded random builds', () => {
  const builds: Build[] = [];
  const r = rng(20261108);
  for (let seq = 0; seq < 120; seq++) {
    let b = emptyBuild();
    for (let step = 0; step < 30; step++) {
      b = randomStep(b, r);
      builds.push(b);
    }
  }

  it('generates at least 500 builds', () => {
    expect(builds.length).toBeGreaterThanOrEqual(500);
    const distinct = new Set(builds.map((b) => encode(b)));
    expect(distinct.size).toBeGreaterThanOrEqual(500);
  });

  it('revalidate of a valid build changes nothing', () => {
    for (const b of builds) {
      const v = revalidate(b);
      expect(v.removed).toEqual([]);
      expect(v.build).toEqual(b);
    }
  });

  it('decode(encode(build)) returns the same build', () => {
    for (const b of builds) {
      const d = decode(encode(b));
      expect('build' in d).toBe(true);
      if ('build' in d) {
        expect(d.removed).toEqual([]);
        expect(d.build).toEqual(b);
      }
    }
  });

  it('decode never throws on random strings', () => {
    const q = rng(7);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_+/=!% ';
    for (let i = 0; i < 2000; i++) {
      let s = '';
      const len = q.int(80);
      for (let j = 0; j < len; j++) s += chars[q.int(chars.length)];
      expect(() => decode(s)).not.toThrow();
    }
  });
});
