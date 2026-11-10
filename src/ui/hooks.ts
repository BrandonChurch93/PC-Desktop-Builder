import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { sheet } from '../engine/sheet';
import { store, type State } from '../state/store';

export const useApp = <T,>(sel: (s: State) => T): T => useStore(store, sel);
export const useAppShallow = <T,>(sel: (s: State) => T): T => useStore(store, useShallow(sel));

/** The spec sheet of the current build, recomputed only when the build changes. */
export function useSheet() {
  const build = useApp((s) => s.build);
  return useMemo(() => sheet(build), [build]);
}

export type Layout = 'desktop' | 'tablet' | 'phone';

/** Phone when the shorter side is under 500 px, desktop from 1200 px wide, tablet otherwise. */
export function layoutFor(w: number, h: number): Layout {
  if (Math.min(w, h) < 500) return 'phone';
  if (w >= 1200) return 'desktop';
  return 'tablet';
}

export function useViewport() {
  const read = () => ({ w: typeof window === 'undefined' ? 1440 : window.innerWidth, h: typeof window === 'undefined' ? 900 : window.innerHeight });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  const layout = layoutFor(v.w, v.h);
  return { ...v, layout, landscape: v.w > v.h };
}

/** Reduced motion from the setting or the system. */
export const useReducedMotion = () => useApp((s) => s.reducedMotion);
