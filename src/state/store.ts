import { createStore } from 'zustand/vanilla';
import type { Category } from '../data/catalog';
import { emptyBuild } from '../engine/rules';
import type { Build, Removed } from '../engine/types';
import { DEFAULT_SETTINGS, type SavedBuild, type SavedProfile, type Settings } from './persist';

export type Mode = 'build' | 'showcase' | 'exploded';
export type Quality = 'auto' | 'high' | 'medium' | 'low';
export type Tier = 'high' | 'medium' | 'low';

export type Inspect = { category: Category; id: string; angle: number; zoom: number; finish?: string; size?: 120 | 140; flip?: boolean; focus?: [number, number, number] } | null;
export type Held = { category: Category; id: string; how: 'drag' | 'tap' | 'keys'; socket: number | null } | null;
export type Selected = { category: Category; key: string; opts: { index?: number; type?: string; mount?: string } } | null;

export type DialogName = 'sheet' | 'share' | 'poster' | 'saved' | 'settings' | 'about';
export type SheetStop = 'peek' | 'half' | 'full';
export type SheetTab = 'parts' | 'specs' | 'lighting';
export type Overlay = 'intro' | 'start' | null;

export type Notice = {
  id: number;
  kind: 'cascade' | 'info' | 'link';
  title: string;
  lines: string[];
  /** a notice with an action stays until dismissed */
  action: 'undo' | 'empty' | null;
} | null;

export type Ui = {
  tab: Category;
  /** tablet: the one side sheet that is open */
  side: 'lighting' | 'spec' | null;
  sheet: SheetStop;
  sheetTab: SheetTab;
  dialog: DialogName | null;
  menu: boolean;
  overlay: Overlay;
  /** a shared link landing: the build's name for the banner */
  shared: string | null;
};

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
  ui: Ui;
  notice: Notice;
  /** the polite live region's sentence */
  announce: string;
  settings: Settings;
  saved: SavedBuild[];
  profiles: SavedProfile[];
};

export const DEFAULT_UI: Ui = { tab: 'case', side: null, sheet: 'peek', sheetTab: 'parts', dialog: null, menu: false, overlay: null, shared: null };

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
  ui: DEFAULT_UI,
  notice: null,
  announce: '',
  settings: DEFAULT_SETTINGS,
  saved: [],
  profiles: [],
}));

export type Store = typeof store;
