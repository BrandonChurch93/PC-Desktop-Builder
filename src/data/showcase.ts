import type { Build } from '../engine/types';

/** tagline: the one line a tray card has room for. blurb: the sentence the start overlay shows. */
export type ShowcaseSpec = { id: string; name: string; tagline: string; blurb: string; build: Omit<Build, 'v' | 'name'> };

const RAINBOW = ['#ff1f3d', '#ff9a1f', '#ffe81f', '#2bff6a', '#1fb8ff', '#8a2bff'];

/** Finished builds to flip through, each set up to show the bench at its best: every one runs, glass on, lit. */
export const SHOWCASE: readonly ShowcaseSpec[] = [
  {
    id: 'prism',
    name: 'Prism',
    tagline: 'Rainbow wave · 360 liquid',
    blurb: 'A moving rainbow through every fan, behind two walls of glass.',
    build: {
      case: { id: 'atrium', finish: 'onyx' }, board: 'z7', cpu: 'ember8', cooler: { id: 'tarn360-lux', mount: 'top' },
      ram: ['facet64x4'], gpu: 'crest', storage: { nvme: 2, ssd: 0, hdd: 0 }, psu: 't1200',
      fans: { 'side-1': 'aureole', 'side-2': 'aureole', 'side-3': 'aureole', 'bottom-1': 'aureole', 'bottom-2': 'aureole', 'bottom-3': 'aureole', 'rear-1': 'aureole' },
      cables: 'onyx', glass: true,
      lighting: { effect: 'wave', speed: 55, brightness: 95, direction: 1, stops: RAINBOW, overrides: {} },
    },
  },
  {
    id: 'foundry',
    name: 'Foundry',
    tagline: 'Amber · twin tower air',
    blurb: 'Air cooled steel. A twin tower cooler, spinning drives and amber light.',
    build: {
      case: { id: 'bulwark', finish: 'gunmetal' }, board: 'z7', cpu: 'ember8', cooler: { id: 'twin', mount: null },
      ram: ['facet64'], gpu: 'monolith', storage: { nvme: 1, ssd: 0, hdd: 2 }, psu: 't1000',
      fans: { 'front-1': 'frame', 'front-2': 'frame', 'front-3': 'frame', 'bottom-1': 'frame', 'bottom-2': 'frame', 'top-1': 'frame', 'top-2': 'frame', 'top-3': 'frame', 'rear-1': 'frame' },
      cables: 'citrine', glass: true,
      lighting: { effect: 'static', speed: 60, brightness: 90, direction: 1, stops: ['#ff6a00', '#ffb23f'], overrides: {} },
    },
  },
  {
    id: 'blossom',
    name: 'Blossom',
    tagline: 'Pink and lilac · all white',
    blurb: 'All white, lit in soft pink and lilac.',
    build: {
      case: { id: 'vitrine', finish: 'frost' }, board: 'x9', cpu: 'tidal16', cooler: { id: 'tarn240-frost', mount: 'top' },
      ram: ['crown96'], gpu: 'halide', storage: { nvme: 2, ssd: 0, hdd: 0 }, psu: 't1200',
      fans: { 'front-1': 'petal', 'front-2': 'petal', 'front-3': 'petal', 'top-3': 'petal', 'rear-1': 'petal' },
      cables: 'frost', glass: true,
      lighting: { effect: 'wave', speed: 35, brightness: 90, direction: 1, stops: ['#ff5fa8', '#c77dff', '#ff8fc8'], overrides: {} },
    },
  },
  {
    id: 'glacier',
    name: 'Glacier',
    tagline: 'Ice blue · open frame',
    blurb: 'No walls. Bare aluminum, the longest card, and ice blue light.',
    build: {
      case: { id: 'gantry', finish: 'raw' }, board: 'z7', cpu: 'ember8', cooler: { id: 'tarn360-lux', mount: 'spine' },
      ram: ['facet64'], gpu: 'crest', storage: { nvme: 1, ssd: 0, hdd: 0 }, psu: 't1000',
      fans: {},
      cables: 'tide', glass: true,
      lighting: { effect: 'wave', speed: 40, brightness: 95, direction: 1, stops: ['#2de2ff', '#2b6bff', '#9fe8ff'], overrides: {} },
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    tagline: 'Red · small form factor',
    blurb: 'A small case in black and red, with full size parts.',
    build: {
      case: { id: 'cub', finish: 'onyx' }, board: 'z7i', cpu: 'ember8', cooler: { id: 'tarn240', mount: 'top' },
      ram: ['facet32'], gpu: 'monolith-s', storage: { nvme: 1, ssd: 0, hdd: 0 }, psu: 'sf750',
      fans: { 'rear-1': 'frame' },
      cables: 'ember', glass: true,
      lighting: { effect: 'wave', speed: 40, brightness: 100, direction: 1, stops: ['#ff0a2a', '#ff4a1a'], overrides: {} },
    },
  },
];
