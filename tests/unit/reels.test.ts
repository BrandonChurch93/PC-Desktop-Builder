import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/data/catalog';
import { SHOWCASE } from '../../src/data/showcase';
import { reelNeeds } from '../../src/world/director';
import { REELS, reelLength } from '../../src/world/reels';

const ids = (category: string) => {
  const key = { board: 'boards', cooler: 'coolers', gpu: 'gpus', ram: 'ram', fan: 'fans', psu: 'psus', cpu: 'cpus', case: 'cases' }[category] as keyof typeof catalog;
  return (catalog[key] as unknown as { id: string }[]).map((p) => p.id);
};

describe('demo reels', () => {
  it('has at least four, each 45 to 60 seconds, with ids of their own and plain copy', () => {
    expect(REELS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(REELS.map((r) => r.id)).size).toBe(REELS.length);
    for (const r of REELS) {
      const len = reelLength(r);
      expect(len, r.id).toBeGreaterThanOrEqual(45);
      expect(len, r.id).toBeLessThanOrEqual(60);
      expect(`${r.name} ${r.blurb}`, r.id).not.toMatch(/[—!]/);
    }
  });

  it('opens every reel on Prism, lit, in Showcase, on the bench and not in the Inspector', () => {
    for (const r of REELS) {
      const first = r.shots[0]!;
      expect(first.set.build, r.id).toBe('prism');
      expect(first.set.mode, r.id).toBe('showcase');
      expect(first.set.inspect ?? null, r.id).toBeNull();
      expect('orbit' in first.cam, r.id).toBe(true);
    }
  });

  it('cuts through white and dark builds and shows the Z7 board in every reel', () => {
    const light = new Set(['frost', 'raw']);
    for (const r of REELS) {
      const { builds, looks } = reelNeeds([r]);
      const finishes = builds.map((b) => SHOWCASE.find((s) => s.id === b)!.build.case!.finish);
      expect(finishes.some((f) => light.has(f)), r.id).toBe(true);
      expect(finishes.some((f) => !light.has(f)), r.id).toBe(true);
      expect(looks.some((l) => l.category === 'board' && l.id === 'z7'), r.id).toBe(true);
    }
  });

  it('names only showcase builds and catalog parts, and keeps every beat inside its shot', () => {
    for (const r of REELS) {
      const { builds, looks } = reelNeeds([r]);
      for (const b of builds) expect(SHOWCASE.some((s) => s.id === b), `${r.id} ${b}`).toBe(true);
      for (const l of looks) expect(ids(l.category), `${r.id} ${l.category} ${l.id}`).toContain(l.id);
      for (const s of r.shots) {
        expect(s.dur, r.id).toBeGreaterThan(0);
        for (const b of s.beats ?? []) { expect(b.at, r.id).toBeGreaterThanOrEqual(0); expect(b.at, r.id).toBeLessThan(s.dur); }
        if ('part' in s.cam) expect(s.set.inspect, r.id).toBeTruthy();
        for (const b of s.beats ?? []) if (b.set.lighting?.effect) expect(catalog.lighting.effects.map((e) => e.id), r.id).toContain(b.set.lighting.effect);
      }
    }
  });
});
