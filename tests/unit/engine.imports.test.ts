import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const PURE_DIRS = ['src/engine', 'src/world/layout'];
const BANNED_MODULES = /^(three|react|react-dom|gsap|zustand)(\/|$)/;
const DOM_GLOBALS = /\b(window|document|navigator|localStorage|sessionStorage|HTMLElement|HTMLCanvasElement|requestAnimationFrame|getComputedStyle)\b/;

describe('pure modules', () => {
  for (const dir of PURE_DIRS) {
    let list: string[] = [];
    try { list = files(dir).filter((f) => /\.tsx?$/.test(f)); } catch { list = []; }
    it(`${dir} imports nothing from three, react or the DOM`, () => {
      if (dir === 'src/engine') expect(list.length).toBeGreaterThan(0);
      for (const f of list) {
        const src = readFileSync(f, 'utf8');
        const imports = [...src.matchAll(/(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g), ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? '');
        for (const m of imports) {
          expect(BANNED_MODULES.test(m), `${f} imports ${m}`).toBe(false);
          if (m.startsWith('.')) expect(/(^|\/)(world|ui|state)(\/|$)/.test(m.replace(/^(\.\.\/)+/, '')) && !m.includes('world/layout'), `${f} imports ${m}`).toBe(false);
        }
        const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
        expect(DOM_GLOBALS.test(code), `${f} uses a DOM global`).toBe(false);
      }
    });
  }
});
