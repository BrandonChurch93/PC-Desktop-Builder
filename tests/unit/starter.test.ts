import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/catalog.json';

describe('starter', () => {
  it('reads the catalog', () => {
    expect(catalog.constants.productName).toBe('Desktop PC Builder');
    expect(catalog.cases.length).toBe(6);
  });

  it('keeps the app catalog identical to the kit catalog', () => {
    expect(readFileSync('src/data/catalog.json', 'utf8')).toBe(readFileSync('kit/data/catalog.json', 'utf8'));
  });
});
