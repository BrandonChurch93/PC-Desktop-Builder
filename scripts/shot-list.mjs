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
//   phone sheet tabs); tab-<category> (the tray tab); target-<light target> (the lighting panel edits that target);
//   stop-<index> (the gradient stop open in the color picker); none (closes all of them).
//   act types added in Phase 7: targetMode { target, mode }, scopeLighting { target, patch }, recentColors { colors }.
//   scrub('power-on', p) runs the power on sequence on the Night Rig from the dark.
//
// Extra hook options used here: inspect(category, id, angle, { zoom, size, finish, ui, flip, focus }),
//   flip shows the underside, focus aims a close view at a point given as fractions of the part's bounds.
//   act({ type: 'install', category, id, opts }) installs through the rules engine.
import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('kit/data/catalog.json', 'utf8'));
const FREEZE = ['freeze', 3.2];
const fixtures = JSON.parse(fs.readFileSync('kit/data/fixtures.json', 'utf8'));
const fixtureCode = (id) => fixtures.presets.find((p) => p.id === id).encoded;
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

const litNight = [['load', 'night-rig'], ['mode', 'showcase'], ['set', { ui: false, glass: true, power: true, load: 0 }]];
for (const p of catalog.lighting.presets) {
  SHOTS[`light/preset-${p.id}`] = { steps: [...litNight, ['act', { type: 'lightingPreset', id: p.id }], ['cam', 'hero'], FREEZE] };
}
// The graphics target off and memory on its own profile: a steady amber against the synced Aurora wave.
const memoryOwn = ['act', { type: 'scopeLighting', target: 'ram', patch: { effect: 'static', stops: ['#ff9a1f', '#ff3b1f'] } }];
SHOTS['light/override'] = { steps: [...litNight, memoryOwn, ['act', { type: 'targetMode', target: 'gpu', mode: 'off' }], ['cam', 'hero'], FREEZE] };

// Airflow at a working load, so the streams run from cool intake air to warmer exhaust.
for (const id of ['night-rig', 'windbreak']) {
  SHOTS[`mode/airflow-${id}`] = { steps: [['load', id], ['mode', 'showcase'], ['set', { ui: false, glass: true, power: true, load: 0.6, airflow: true }], ['cam', 'hero'], FREEZE] };
}

for (const p of [0, 25, 50, 75, 100]) {
  SHOTS[`motion/power-on-${String(p).padStart(3, '0')}`] = { steps: [['mode', 'showcase'], ['set', { ui: false }], ['scrub', 'power-on', p / 100], ['cam', 'hero'], FREEZE] };
}

// The exploded view of each preset, lit, from the view the mode glides to, with its labels.
for (const p of catalog.presets) {
  SHOTS[`mode/exploded-${p.id}`] = { steps: [['load', p.id], ['mode', 'exploded'], ['set', { ui: false, glass: true, power: true, load: 0 }], ['cam', 'exploded'], FREEZE] };
}
SHOTS['mode/showcase'] = { steps: [['load', 'night-rig'], ['act', { type: 'name', name: 'Night Rig' }], ['mode', 'showcase'], ['set', { ui: true, glass: true, power: true, load: 1 }], ['cam', 'hero'], FREEZE] };
SHOTS['mode/inspector'] = { steps: [['load', 'night-rig'], ['inspect', 'gpu', 'apex3x', -28, { zoom: 0 }], FREEZE] };
for (const p of [0, 25, 50, 75, 100]) {
  const n = String(p).padStart(3, '0');
  SHOTS[`motion/explode-${n}`] = { steps: [['set', { ui: false }], ['scrub', 'explode', p / 100], ['cam', 'exploded'], FREEZE] };
  // The intro shows its own overlay, the name, over the scene; the rest of the interface is behind it.
  SHOTS[`motion/intro-${n}`] = { steps: [['scrub', 'intro', p / 100], FREEZE] };
}

// The Night Rig lit hero on each tier: High and Medium at the default size, Low at a phone's.
for (const t of ['high', 'medium', 'low']) {
  SHOTS[`tier/${t}`] = { ...(t === 'low' ? { width: 390, height: 844, touch: true } : {}), steps: [['set', { quality: t }], ...lit('night-rig', 'hero')] };
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
// Held parts, interface shown. A hold at an index snaps the part to that place; with none it is held clear of every place.
const held = (pre, hold) => [['load', 'night-rig'], ['set', { ui: true }], ['act', { type: 'name', name: 'Night Rig' }], ...pre, ['cam', 'hero'], ['hold', ...hold], FREEZE];
const noFans = [['act', { type: 'clearFans' }], ['open', 'tab-fan']];
SHOTS['drag/valid'] = { steps: held([['act', { type: 'remove', category: 'gpu' }], ['open', 'tab-gpu']], ['gpu', 'apex2x', 0]) };
SHOTS['drag/blocked'] = { steps: [['load', 'pocket'], ['set', { ui: true }], ['act', { type: 'remove', category: 'gpu' }], ['open', 'tab-gpu'], ['cam', 'hero'], ['hold', 'gpu', 'apex3x', 0], FREEZE] };
SHOTS['drag/fan-mounts'] = { steps: held(noFans, ['fan', 'gale']) };
SHOTS['drag/radiator-mounts'] = { steps: held([['act', { type: 'remove', category: 'cooler' }], ['open', 'tab-cooler']], ['cooler', 'tarn240']) };
SHOTS['drag/memory-slots'] = { steps: held([['open', 'tab-ram']], ['ram', 'facet32']) };
SHOTS['ui-desktop/04-drag'] = { steps: held(noFans, ['fan', 'gale', 6]) };
SHOTS['ui-desktop/05-select'] = { steps: [['load', 'night-rig'], ['set', { ui: true }], ['act', { type: 'name', name: 'Night Rig' }], ['open', 'tab-gpu'], ['cam', 'hero'], ['select', 'gpu'], FREEZE] };
SHOTS['ui-desktop/03-build'] = { steps: ui(inProgress) };
SHOTS['ui-desktop/06-cascade'] = { steps: ui([['open', 'tab-case'], ['act', { type: 'install', category: 'case', id: 'cub' }]]) };
SHOTS['ui-desktop/08-spec-sheet'] = { steps: ui([...warned, ['open', 'sheet']]) };
// Memory on its own profile, its first color open in the picker after a few picks this session.
const lightingOpen = [['set', { power: true, load: 0 }], ['act', { type: 'recentColors', colors: ['#18e0ff', '#7dff3b', '#ff3b1f', '#ff9a1f'] }], memoryOwn, ['open', 'target-ram'], ['open', 'stop-0']];
SHOTS['ui-desktop/09-lighting'] = { steps: ui(lightingOpen) };
SHOTS['ui-desktop/10-power'] = { steps: ui([['set', { power: true, load: 0.62 }]]) };
SHOTS['ui-desktop/11-airflow'] = { steps: ui([['set', { power: true, load: 0.62, airflow: true }]]) };
SHOTS['ui-desktop/01-intro'] = { steps: [['scrub', 'intro', 0.62], FREEZE] };
SHOTS['ui-desktop/01-start'] = { steps: [['load', 'night-rig'], ['set', { ui: true }], ['open', 'start'], ['cam', 'hero'], FREEZE] };
SHOTS['ui-desktop/07-inspector'] = { steps: [['load', 'night-rig'], ['set', { ui: true }], ['inspect', 'gpu', 'apex3x', -28, { zoom: 0 }], FREEZE] };
SHOTS['ui-desktop/10-showcase'] = { steps: ui([['mode', 'showcase'], ['set', { power: true, load: 1 }]]) };
SHOTS['ui-desktop/12-exploded'] = { steps: [['load', 'night-rig'], ['set', { ui: true }], ['act', { type: 'name', name: 'Night Rig' }], ['mode', 'exploded'], ['set', { power: true }], ['cam', 'exploded'], FREEZE] };
const saves = [['act', { type: 'name', name: 'Windbreak' }], ['act', { type: 'saveBuild' }], ['load', 'pocket'], ['act', { type: 'name', name: 'Pocket' }], ['act', { type: 'saveBuild' }], ['load', 'night-rig'], ['act', { type: 'name', name: 'Night Rig' }], ['act', { type: 'saveBuild' }]];
SHOTS['ui-desktop/13-share'] = { steps: ui([['open', 'share']]) };
SHOTS['ui-desktop/13-poster'] = { steps: ui([['open', 'poster']]) };
SHOTS['ui-desktop/13-saved'] = { steps: [['load', 'windbreak'], ['set', { ui: true }], ...saves, ['open', 'saved'], ['cam', 'hero'], FREEZE] };
SHOTS['ui-desktop/13-settings'] = { steps: ui([['open', 'settings']]) };
SHOTS['ui-desktop/13-about'] = { steps: ui([['open', 'about']]) };
// A shared link landing: Showcase, the banner and the power on, as a visitor arrives on the Flagship's link.
const shared = [['link', fixtureCode('flagship')], ['set', { ui: true }], ['cam', 'hero'], FREEZE];
SHOTS['ui-desktop/14-shared'] = { steps: shared };
for (const [o, width, height] of [['landscape', 1180, 820], ['portrait', 820, 1180]]) {
  SHOTS[`ui-tablet/${o}-build`] = { width, height, touch: true, steps: ui(inProgress) };
  SHOTS[`ui-tablet/${o}-spec-sheet`] = { width, height, touch: true, steps: ui([...warned, ['open', 'sheet']]) };
  SHOTS[`ui-tablet/${o}-drag`] = { width, height, touch: true, steps: held(noFans, ['fan', 'gale', 6]) };
  SHOTS[`ui-tablet/${o}-lighting-sheet`] = { width, height, touch: true, steps: ui([['set', { power: true, load: 0 }], ['open', 'lighting']]) };
  SHOTS[`ui-tablet/${o}-share-dialog`] = { width, height, touch: true, steps: ui([['open', 'share']]) };
}
const phone = { width: 390, height: 844, touch: true };
SHOTS['ui-phone/empty-bench'] = { ...phone, steps: emptyBench };
SHOTS['ui-phone/peek'] = { ...phone, steps: ui([['open', 'peek'], ['open', 'tab-gpu']]) };
SHOTS['ui-phone/half'] = { ...phone, steps: ui([['open', 'half'], ['open', 'parts'], ['open', 'tab-ram']]) };
SHOTS['ui-phone/full'] = { ...phone, steps: ui([['open', 'full'], ['open', 'parts'], ['open', 'tab-case']]) };
SHOTS['ui-phone/specs'] = { ...phone, steps: ui([['open', 'half'], ['open', 'specs']]) };
SHOTS['ui-phone/start'] = { ...phone, steps: [['load', 'night-rig'], ['set', { ui: true }], ['open', 'start'], ['cam', 'hero'], FREEZE] };
SHOTS['ui-phone/inspector'] = { ...phone, steps: [['load', 'night-rig'], ['set', { ui: true }], ['inspect', 'gpu', 'apex3x', -28, { zoom: 0 }], FREEZE] };
SHOTS['ui-phone/spec-sheet'] = { ...phone, steps: ui([...warned, ['open', 'sheet']]) };
SHOTS['ui-phone/showcase'] = { ...phone, steps: ui([['mode', 'showcase'], ['set', { power: true, load: 1 }]]) };
const phoneWide = { width: 844, height: 390, touch: true };
SHOTS['ui-phone/landscape-build'] = { ...phoneWide, steps: ui(inProgress) };
SHOTS['ui-phone/landscape-showcase'] = { ...phoneWide, steps: ui([['mode', 'showcase'], ['set', { power: true, load: 1 }]]) };
SHOTS['ui-phone/lighting'] = { ...phone, steps: ui([['set', { power: true, load: 0 }], ['open', 'half'], ['open', 'lighting-tab']]) };
SHOTS['ui-phone/drag'] = { ...phone, steps: held([['act', { type: 'remove', category: 'gpu' }], ['open', 'tab-gpu']], ['gpu', 'apex2x', 0]) };

export { SHOTS };
