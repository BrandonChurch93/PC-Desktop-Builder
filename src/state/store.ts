import { createStore } from 'zustand/vanilla';
import type { Category } from '../data/catalog';
import { emptyBuild } from '../engine/rules';
import type { Build, Removed } from '../engine/types';

export type Mode = 'build' | 'showcase' | 'exploded';
export type Quality = 'auto' | 'high' | 'medium' | 'low';
export type Tier = 'high' | 'medium' | 'low';

export type Inspect = { category: Category; id: string; angle: number; zoom: number; finish?: string; size?: 120 | 140; flip?: boolean; focus?: [number, number, number] } | null;
export type Held = { category: Category; id: string; how: 'drag' | 'tap' | 'keys'; socket: number | null } | null;
export type Selected = { category: Category; key: string; opts: { index?: number; type?: string; mount?: string } } | null;

export type State = {
  build: Build;
  history: Build[];
  future: Build[];
  cascade: { removed: Removed[]; at: number } | null;
  mode: Mode;
  power: boolean;
  airflow: boolean;
  load: number;
  held: Held;
  selected: Selected;
  inspect: Inspect;
  uiHidden: boolean;
  quality: Quality;
  reducedMotion: boolean;
  /** frozen clock in seconds for deterministic frames, or null */
  frozen: number | null;
  /** a change that should play without motion */
  instant: boolean;
};

export const store = createStore<State>(() => ({
  build: emptyBuild(),
  history: [],
  future: [],
  cascade: null,
  mode: 'build',
  power: false,
  airflow: false,
  load: 0,
  held: null,
  selected: null,
  inspect: null,
  uiHidden: false,
  quality: 'auto',
  reducedMotion: false,
  frozen: null,
  instant: false,
}));

export type Store = typeof store;
