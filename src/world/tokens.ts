/**
 * Design tokens read once from the stylesheet, so the scene's interface colors (outlines, sockets) come from the one place
 * they are defined, src/styles/tokens.css.
 */
const cache = new Map<string, string>();

export function token(name: string): string {
  let v = cache.get(name);
  if (v === undefined) {
    v = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    if (!v) throw new Error(`no design token --${name}`);
    cache.set(name, v);
  }
  return v;
}
