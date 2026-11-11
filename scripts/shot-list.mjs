// Every named shot, in one table. This is the file you fill in.
//
// name -> { width, height, touch, steps: [[hookMethod, ...args]], out }
// The name is "<group>/<shot>" and the image is written to shots/<name>.jpg unless `out` is set.
// Defaults: 1440 x 900. Steps run in order through window.__pcb, then the harness waits for settle().
//
// The names are not yours to choose, except the tail of the interface shots. scripts/shot-rules.mjs builds the
// required names from the catalog and kit/07-QUALITY-BAR.md lists them in its Shots table.
// To see what is still missing, run: npm run check:shots
//
// Names chosen for __pcb.open(name): sheet, share, saved, settings, about, poster (dialogs); menu; intro, start (overlays);
//   lighting, spec (the tablet side sheets); peek, half, full (the phone sheet stops); parts, specs, lighting-tab (the
//   phone sheet tabs); tab-<category> (the tray tab); none (closes all of them).
//
// Extra hook options used here: inspect(category, id, angle, { zoom, size, finish, ui, flip, focus }),
//   flip shows the underside, focus aims a close view at a point given as fractions of the part's bounds.
//   act({ type: 'install', category, id, opts }) installs through the rules engine.
import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('kit/data/catalog.json', 'utf8'));
const FREEZE = ['freeze', 3.2];
const SHOTS = {};

const lit = (preset, view) => [['load', preset], ['mode', 'showcase'], ['set', { ui: false, glass: true, power: true, load: 0 }], ['cam', view], FREEZE];
const bench = (preset, view) => [['load', preset], ['mode', 'build'], ['set', { ui: false, glass: false, power: false }], ['cam', view], FREEZE];

const VIEWS = ['hero', 'side', 'front', 'top', 'rear'];
for (const p of catalog.presets) for (const v of VIEWS) SHOTS[`rig/${p.id}-${v}`] = { steps: lit(p.id, v) };
for (const p of catalog.presets) SHOTS[`bench/${p.id}`] = { steps: bench(p.id, 'hero') };

const HERO_MACROS = ['gpu', 'cooler', 'ram', 'board', 'fan', 'cable', 'psu', 'storage'];
for (const m of HERO_MACROS) SHOTS[`macro/night-rig-${m}`] = { steps: lit('night-rig', m) };

// Every other preset: its card, its cooler, its 24 pin run and a close view of its case.
for (const p of catalog.presets) {
  if (p.id === 'night-rig') continue;
  for (const m of ['gpu', 'cooler', 'cable', 'case-detail']) SHOTS[`macro/${p.id}-${m}`] = { steps: lit(p.id, m) };
}

// Each case in the finish its preset does not use, holding that preset's build, lit, from the hero view.
for (const p of catalog.presets) {
  const c = catalog.cases.find((x) => x.id === p.build.case.id);
  const other = c.finishes.find((f) => f !== p.build.case.finish);
  SHOTS[`finish/${c.id}-${other}`] = { steps: [['load', p.id], ['mode', 'showcase'], ['set', { ui: false, glass: true, power: true, load: 0 }], ['finish', other], ['cam', 'hero'], FREEZE] };
}

// Night Rig's cable macro with each colorway installed, lit.
for (const c of catalog.cables) {
  SHOTS[`cable/${c.id}`] = { steps: [['load', 'night-rig'], ['mode', 'showcase'], ['set', { ui: false, glass: true, power: true, load: 0 }], ['act', { type: 'install', category: 'cables', id: c.id }], ['cam', 'cable'], FREEZE] };
}

// How each category is shot in the Inspector: the turntable angle for the front and back three quarter views,
// whether the back view flips the part over, and where the close detail view aims.
const PART_SHOT = {
  case: { front: -38, back: 142, detail: { angle: -24, zoom: 0.72, focus: [0.95, 0.9, 0.85] } },
  board: { front: -24, back: 156, flipBack: false, detail: { angle: -16, zoom: 0.78, focus: [0.42, 0.72, 0.5] } },
  cpu: { front: -30, back: 150, flipBack: true, detail: { angle: -22, zoom: 0.82, focus: [0.3, 0.6, 0.35] } },
  cooler: { front: 152, back: -28, detail: { angle: 160, zoom: 0.74, focus: [0.25, 0.4, 0.1] } },
  ram: { front: -30, back: 150, detail: { angle: -24, zoom: 0.78, focus: [0.62, 0.6, 0.95] } },
  gpu: { front: -28, back: -32, flipBack: true, detail: { angle: -34, zoom: 0.7, focus: [0.62, 0.92, 0.2] } },
  storage: { front: -30, back: 150, flipBack: true, detail: { angle: -24, zoom: 0.8, focus: [0.4, 0.8, 0.5] } },
  psu: { front: -32, back: 148, detail: { angle: -40, zoom: 0.72, focus: [0.95, 0.5, 0.5] } },
  fan: { front: -28, back: 152, detail: { angle: -20, zoom: 0.78, focus: [0.5, 0.62, 0.5] } },
};

const AIR_COOLER_SHOT = {
  tower: { front: 152, back: -28, detail: { angle: 140, zoom: 0.7, focus: [0.95, 0.9, 0.42] } },
  twin: { front: 152, back: -28, detail: { angle: 140, zoom: 0.7, focus: [0.98, 0.9, 0.42] } },
  low: { front: 152, back: -28, detail: { angle: 140, zoom: 0.7, focus: [0.5, 0.5, 0.05] } },
  towerLit: { front: 152, back: -28, detail: { angle: 152, zoom: 0.56, focus: [0.55, 0.8, 0.78] } },
};
const PART_GROUPS = [['cases', 'case'], ['boards', 'board'], ['cpus', 'cpu'], ['coolers', 'cooler'], ['ram', 'ram'], ['gpus', 'gpu'], ['storage', 'storage'], ['psus', 'psu'], ['fans', 'fan']];
for (const [key, cat] of PART_GROUPS) {
  for (const part of catalog[key]) {
    const id = cat === 'storage' ? part.type : part.id;
    const name = part.id;
    // Air coolers stand up from the board, so their close view looks at the top cover and the fan clips, not at a pump.
    const s = cat === 'cooler' && part.type !== 'aio' ? AIR_COOLER_SHOT[part.type === 'lowprofile' ? 'low' : part.fans >= 2 ? 'twin' : part.lightZones > 0 ? 'towerLit' : 'tower'] : PART_SHOT[cat];
    const extra = cat === 'fan' ? { size: 120 } : cat === 'case' ? { finish: part.finishes[0] } : {};
    const shot = (angle, o) => ({ width: 800, height: 800, steps: [['inspect', cat, id, angle, { zoom: 0, ui: false, ...extra, ...o }], FREEZE] });
    SHOTS[`part/${cat}-${name}-front`] = shot(s.front, {});
    SHOTS[`part/${cat}-${name}-back`] = shot(s.back, s.flipBack ? { flip: true } : {});
    SHOTS[`part/${cat}-${name}-detail`] = shot(s.detail.angle, { zoom: s.detail.zoom, focus: s.detail.focus });
    if (cat === 'case') SHOTS[`part/case-${name}-alt`] = shot(s.front, { finish: part.finishes[1] });
  }
}

for (const e of catalog.lighting.effects) {
  SHOTS[`light/effect-${e.id}`] = { steps: [['load', 'night-rig'], ['mode', 'showcase'], ['set', { ui: false, glass: true, power: true, load: 0 }], ['act', { type: 'lighting', patch: { effect: e.id } }, { instant: true }], ['cam', 'hero'], FREEZE] };
}

// Install sequences scrubbed to five points, each from a view wide enough for the travel and close enough for the fastening.
const MOTION_VIEW = { 'install-gpu': 'gpu-wide', 'install-ram': 'ram-wide', 'install-cooler': 'gpu-wide', 'install-nvme': 'nvme-wide', 'install-cpu': 'cpu-wide', 'install-fan': 'rear-fan-wide', 'install-psu': 'psu-wide' };
for (const [seq, view] of Object.entries(MOTION_VIEW)) for (const p of [0, 25, 50, 75, 100]) {
  SHOTS[`motion/${seq}-${String(p).padStart(3, '0')}`] = { steps: [['set', { ui: false, power: false }], ['scrub', seq, p / 100], ['cam', view], FREEZE] };
}

// Interface shots: the interface shown, a named build, a frozen clock. A build in progress is the Night Rig before its card,
// supply and fans; the spec sheet with warnings is the Night Rig on a 650 W supply.
const ui = (pre) => [['load', 'night-rig'], ['set', { ui: true }], ['act', { type: 'name', name: 'Night Rig' }], ...pre, ['cam', 'hero'], FREEZE];
const inProgress = [['act', { type: 'remove', category: 'gpu' }], ['act', { type: 'remove', category: 'psu' }], ['act', { type: 'clearFans' }], ['open', 'tab-gpu']];
const warned = [['act', { type: 'install', category: 'psu', id: 't650' }]];
const emptyBench = [['empty'], ['set', { ui: true }], ['cam', 'hero'], FREEZE];
SHOTS['ui-desktop/02-empty-bench'] = { steps: emptyBench };
SHOTS['ui-desktop/03-build'] = { steps: ui(inProgress) };
SHOTS['ui-desktop/06-cascade'] = { steps: ui([['open', 'tab-case'], ['act', { type: 'install', category: 'case', id: 'cub' }]]) };
SHOTS['ui-desktop/08-spec-sheet'] = { steps: ui([...warned, ['open', 'sheet']]) };
for (const [o, width, height] of [['landscape', 1180, 820], ['portrait', 820, 1180]]) {
  SHOTS[`ui-tablet/${o}-build`] = { width, height, touch: true, steps: ui(inProgress) };
  SHOTS[`ui-tablet/${o}-spec-sheet`] = { width, height, touch: true, steps: ui([...warned, ['open', 'sheet']]) };
}
const phone = { width: 390, height: 844, touch: true };
SHOTS['ui-phone/empty-bench'] = { ...phone, steps: emptyBench };
SHOTS['ui-phone/peek'] = { ...phone, steps: ui([['open', 'peek'], ['open', 'tab-gpu']]) };
SHOTS['ui-phone/half'] = { ...phone, steps: ui([['open', 'half'], ['open', 'parts'], ['open', 'tab-ram']]) };
SHOTS['ui-phone/full'] = { ...phone, steps: ui([['open', 'full'], ['open', 'parts'], ['open', 'tab-case']]) };
SHOTS['ui-phone/specs'] = { ...phone, steps: ui([['open', 'half'], ['open', 'specs']]) };

export { SHOTS };
