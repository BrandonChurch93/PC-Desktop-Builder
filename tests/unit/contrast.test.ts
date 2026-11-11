import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The color tokens, read from the one stylesheet that defines them. */
const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`no hex token --${name}`);
  return m[1]!;
};

const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

/**
 * Every text color in use over every surface it sits on. Panels are translucent over a dark scene; they are judged on the
 * solid panel color, which they never get lighter than.
 */
const TEXT = ['ink', 'ink-dim', 'ink-muted', 'accent', 'ok', 'warn', 'danger'];
const SURFACES = ['bg', 'panel-solid'];

describe('G4: text contrast for every token pair in use', () => {
  for (const t of TEXT) for (const s of SURFACES) {
    it(`--${t} on --${s} is at least 4.5 to 1`, () => { expect(ratio(token(t), token(s))).toBeGreaterThanOrEqual(4.5); });
  }
  it('--accent-ink on --accent, the primary button, is at least 4.5 to 1', () => { expect(ratio(token('accent-ink'), token('accent'))).toBeGreaterThanOrEqual(4.5); });
});
