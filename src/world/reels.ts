import type { Category } from '../data/catalog';
import type { Profile } from '../engine/types';
import type { Mode } from '../state/store';

/** A point in a rig item's placed bounds, as fractions of each side, and the camera's offset from it in meters. */
export type Key = { item: string; f?: [number, number, number]; off: [number, number, number] };

export type Cam =
  /** Round the build's hero target, at the hero distance times k: az in degrees from straight at the glass side, el in degrees up. */
  | { orbit: { az: [number, number]; el: [number, number]; k: [number, number]; lift?: number; ease?: string } }
  /** A smooth path through key frames set from the build's own parts. */
  | { path: Key[]; ease?: string }
  /** The Inspector's turntable: angle in degrees, zoom from 0 to 1, el the camera's height angle in radians. */
  | { part: { angle: [number, number]; zoom: [number, number]; el: [number, number]; focus?: [number, number, number]; ease?: string } };

export type Look = { category: Category; id: string; size?: 120 | 140; finish?: string };

/** What a shot or a beat puts on the bench. Unset fields keep what is there. */
export type Setting = {
  build?: string;
  mode?: Mode;
  power?: boolean;
  airflow?: boolean;
  load?: number;
  glass?: boolean;
  lighting?: Partial<Profile>;
  inspect?: Look | null;
};

/** motion: the change plays its own animation (the power sequence, the explode) instead of a cut. */
export type Beat = { at: number; set: Setting; motion?: boolean };
export type Shot = { dur: number; set: Setting; cam: Cam; beats?: Beat[] };
export type Reel = { id: string; name: string; blurb: string; shots: Shot[] };

const RAINBOW = ['#ff1f3d', '#ff9a1f', '#ffe81f', '#2bff6a', '#1fb8ff', '#8a2bff'];

/** Every reel opens on Prism, lit, in Showcase. */
const OPEN: Setting = { build: 'prism', mode: 'showcase', power: true, airflow: false, load: 0, glass: true, inspect: null };
const CUTS = ['blossom', 'foundry', 'crimson', 'glacier', 'prism'];
const cuts = (from: number, every: number, ids = CUTS): Beat[] => ids.map((build, i) => ({ at: from + i * every, set: { build } }));

const part = (look: Look, dur: number, angle: [number, number], zoom: [number, number], el: [number, number], focus?: [number, number, number]): Shot =>
  ({ dur, set: { inspect: look }, cam: { part: { angle, zoom, el, ...(focus ? { focus } : {}) } } });

/** The Inspector shots, each framed so the part sits above the Inspector's panel at the foot of the window. */
const Z7 = (dur = 5) => part({ category: 'board', id: 'z7' }, dur, [-40, -12], [0.05, 0.78], [0.32, 0.26], [0.42, 0.72, 0.5]);
const PUMP = (dur = 4.5) => part({ category: 'cooler', id: 'tarn360-lux' }, dur, [128, 160], [0.05, 0.5], [0.34, 0.3], [0.3, 0.15, 0.1]);
const AUREOLE = (dur = 4) => part({ category: 'fan', id: 'aureole', size: 120 }, dur, [-55, -15], [0.0, 0.26], [0.3, 0.3], [0.5, 0.4, 0.5]);
const QUAD = (dur = 4) => part({ category: 'ram', id: 'facet64x4' }, dur, [-50, -20], [0.05, 0.55], [0.36, 0.32], [0.62, 0.5, 0.95]);
const CREST = (dur = 4.5) => part({ category: 'gpu', id: 'crest' }, dur, [-48, -18], [0.0, 0.4], [0.5, 0.42], [0.6, 0.6, 0.4]);
const HALIDE = (dur = 4.5) => part({ category: 'gpu', id: 'halide' }, dur, [-50, -20], [0.0, 0.4], [0.5, 0.42], [0.6, 0.6, 0.4]);
const PETAL = (dur = 4) => part({ category: 'fan', id: 'petal', size: 120 }, dur, [-50, -12], [0.0, 0.26], [0.3, 0.3], [0.5, 0.4, 0.5]);
const CROWN = (dur = 4) => part({ category: 'ram', id: 'crown96' }, dur, [-50, -20], [0.05, 0.55], [0.36, 0.32], [0.62, 0.5, 0.95]);
const TWIN = (dur = 4.5) => part({ category: 'cooler', id: 'twin' }, dur, [125, 165], [0.0, 0.35], [0.36, 0.3], [0.6, 0.55, 0.5]);

/** The Prism close pass: along the memory, across the pump, down to the card with the side fans turning behind it. */
const PRISM_CLOSE: Key[] = [
  { item: 'ram:0:A1', f: [0.5, 0.62, 1], off: [0.2, 0.07, 0.26] },
  { item: 'ram:0:A2', f: [0.5, 0.55, 1], off: [0.09, 0.03, 0.17] },
  { item: 'cooler', f: [0.5, 0.5, 1], off: [0.04, 0.02, 0.16] },
  { item: 'gpu', f: [0.62, 1, 0.75], off: [-0.1, 0.09, 0.22] },
  { item: 'gpu', f: [0.8, 0.9, 0.7], off: [-0.2, 0.05, 0.32] },
];

/** Prism from above: down over the card and the pump, across the card's face to the side fans. */
const PRISM_DOWN: Key[] = [
  { item: 'gpu', f: [0.5, 1, 0.7], off: [0.06, 0.3, 0.2] },
  { item: 'cooler', f: [0.5, 0.5, 1], off: [0.1, 0.1, 0.2] },
  { item: 'gpu', f: [0.55, 0.5, 1], off: [0.06, 0.02, 0.2] },
  { item: 'fan:side-3', f: [0.5, 0.5, 1], off: [-0.1, 0.02, 0.2] },
  { item: 'fan:side-3', f: [0.5, 0.4, 1], off: [-0.2, 0.06, 0.34] },
];

/** Blossom, all white: the memory, the pump, the white card, and the front fans seen from inside. */
const BLOSSOM_CLOSE: Key[] = [
  { item: 'ram:0:A2', f: [0.5, 0.62, 1], off: [0.2, 0.08, 0.26] },
  { item: 'cooler', f: [0.5, 0.5, 1], off: [0.06, 0.03, 0.17] },
  { item: 'gpu', f: [0.62, 1, 0.8], off: [-0.1, 0.09, 0.22] },
  { item: 'fan:front-2', f: [0, 0.5, 0.5], off: [-0.22, 0.04, 0.27] },
];

/** Glacier, open frame: the memory, the pump, the card, and the radiator on the spine. */
const GLACIER_CLOSE: Key[] = [
  { item: 'ram:0:A2', f: [0.5, 0.62, 1], off: [0.2, 0.07, 0.26] },
  { item: 'cooler', f: [0.5, 0.5, 1], off: [0.04, 0.02, 0.17] },
  { item: 'gpu', f: [0.7, 1, 0.8], off: [-0.1, 0.1, 0.24] },
  { item: 'radiator', f: [0, 0.5, 0.5], off: [-0.26, 0.05, 0.3] },
];

const END = (build = 'prism'): Shot => ({ dur: 5, set: { inspect: null, build, mode: 'showcase', airflow: false, load: 0 }, cam: { orbit: { az: [8, 30], el: [9, 11], k: [0.98, 0.84] } } });

export const REELS: Reel[] = [
  {
    id: 'cut',
    name: 'Spin and cut',
    blurb: 'Prism turns while the bench cuts through every build, a close pass inside, then four parts.',
    shots: [
      { dur: 19, set: OPEN, cam: { orbit: { az: [-30, 50], el: [8, 13], k: [0.84, 0.78], ease: 'none' } }, beats: cuts(7, 2.4) },
      { dur: 12, set: { build: 'prism' }, cam: { path: PRISM_CLOSE } },
      Z7(), PUMP(), AUREOLE(), QUAD(),
      END(),
    ],
  },
  {
    id: 'power',
    name: 'Power on',
    blurb: 'Prism wakes in the dark, the builds cut by, the lights run through their effects, then Blossom up close.',
    shots: [
      { dur: 8, set: { ...OPEN, power: false }, cam: { orbit: { az: [14, 30], el: [4, 9], k: [1.2, 0.86] } }, beats: [{ at: 0.8, set: { power: true }, motion: true }] },
      { dur: 10, set: { build: 'prism' }, cam: { orbit: { az: [-25, 40], el: [9, 12], k: [0.82, 0.78], ease: 'none' } }, beats: cuts(2, 2, ['blossom', 'crimson', 'foundry', 'glacier']) },
      {
        dur: 12.5, set: { build: 'prism', mode: 'build' }, cam: { orbit: { az: [12, 34], el: [10, 12], k: [0.8, 0.72] } },
        beats: [
          { at: 1.5, set: { lighting: { effect: 'comet', speed: 80 } } },
          { at: 3.7, set: { lighting: { effect: 'spectrum', speed: 60 } } },
          { at: 5.9, set: { lighting: { effect: 'starlight', speed: 70 } } },
          { at: 8.1, set: { lighting: { effect: 'shift', speed: 70 } } },
          { at: 10.3, set: { lighting: { effect: 'wave', speed: 55, stops: RAINBOW } } },
        ],
      },
      { dur: 10, set: { build: 'blossom', mode: 'showcase' }, cam: { path: BLOSSOM_CLOSE } },
      HALIDE(), PETAL(), Z7(4.5),
      END('blossom'),
    ],
  },
  {
    id: 'apart',
    name: 'Apart',
    blurb: 'Prism comes apart in the air and back together, quick cuts round the bench, a pass from above, then three parts.',
    shots: [
      { dur: 6, set: OPEN, cam: { orbit: { az: [-22, 14], el: [8, 10], k: [0.84, 0.8], ease: 'none' } } },
      {
        dur: 10, set: { build: 'prism' }, cam: { orbit: { az: [14, 42], el: [10, 16], k: [0.92, 1.2], lift: 0.02 } },
        beats: [{ at: 0.4, set: { mode: 'exploded' }, motion: true }, { at: 7, set: { mode: 'showcase' }, motion: true }],
      },
      { dur: 9, set: { build: 'prism', mode: 'showcase' }, cam: { orbit: { az: [6, 36], el: [10, 12], k: [0.78, 0.74], ease: 'none' } }, beats: cuts(1.4, 1.5) },
      { dur: 11, set: { build: 'prism' }, cam: { path: PRISM_DOWN } },
      CREST(), TWIN(), Z7(4.5),
      END(),
    ],
  },
  {
    id: 'studio',
    name: 'In the studio',
    blurb: 'Prism, then the builds picked from the tray in Build mode, Foundry under full load with its airflow, Glacier up close.',
    shots: [
      { dur: 7, set: OPEN, cam: { orbit: { az: [-24, 16], el: [8, 10], k: [0.84, 0.8], ease: 'none' } } },
      { dur: 12, set: { build: 'prism', mode: 'build' }, cam: { orbit: { az: [10, 34], el: [10, 12], k: [0.78, 0.72], ease: 'none' } }, beats: cuts(1.6, 2) },
      {
        dur: 10, set: { build: 'foundry', mode: 'showcase', airflow: true, load: 0 }, cam: { orbit: { az: [40, 10], el: [12, 10], k: [0.84, 0.74] } },
        beats: [0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1].map((load, i) => ({ at: 1 + i * 0.9, set: { load } })),
      },
      { dur: 10, set: { build: 'glacier', airflow: false, load: 0 }, cam: { path: GLACIER_CLOSE } },
      Z7(4.5), PUMP(4), CROWN(4),
      END(),
    ],
  },
];

export const reelLength = (r: Reel) => r.shots.reduce((a, s) => a + s.dur, 0);
