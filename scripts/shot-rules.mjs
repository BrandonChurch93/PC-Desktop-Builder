// The rules of the shot gate, shared by shots.mjs, verdict.mjs, critic-list.mjs and check-shots.mjs.
// Do not change this file. kit/07-QUALITY-BAR.md explains every rule in words.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const catalog = JSON.parse(fs.readFileSync('kit/data/catalog.json', 'utf8'));

// ---- which shots must exist ------------------------------------------------------------------

export const GROUP_COUNTS = {
  rig: 30, bench: 6, finish: 6, macro: 28, part: 153, cable: 6, light: 18, mode: 10, motion: 50, drag: 5, tier: 3,
  'ui-desktop': 20, 'ui-tablet': 10, 'ui-phone': 13,
};

const HERO = 'night-rig';
const VIEWS = ['hero', 'side', 'front', 'top', 'rear'];
const HERO_MACROS = ['gpu', 'cooler', 'ram', 'board', 'fan', 'cable', 'psu', 'storage'];
const OTHER_MACROS = ['gpu', 'cooler', 'cable', 'case-detail'];
const PART_GROUPS = [['cases', 'case'], ['boards', 'board'], ['cpus', 'cpu'], ['coolers', 'cooler'], ['ram', 'ram'], ['gpus', 'gpu'], ['storage', 'storage'], ['psus', 'psu'], ['fans', 'fan']];
const ANGLES = ['front', 'back', 'detail'];
export const SEQUENCES = ['install-gpu', 'install-ram', 'install-cooler', 'install-nvme', 'install-cpu', 'install-fan', 'install-psu', 'power-on', 'explode', 'intro'];
const STEPS = ['000', '025', '050', '075', '100'];

function requiredNames() {
  const names = [];
  const presets = catalog.presets.map((p) => p.id);
  for (const p of presets) for (const v of VIEWS) names.push(`rig/${p}-${v}`);
  for (const p of presets) names.push(`bench/${p}`);
  for (const p of catalog.presets) {
    const kase = catalog.cases.find((c) => c.id === p.build.case.id);
    names.push(`finish/${kase.id}-${kase.finishes.find((f) => f !== p.build.case.finish)}`);
  }
  for (const p of presets) for (const m of p === HERO ? HERO_MACROS : OTHER_MACROS) names.push(`macro/${p}-${m}`);
  for (const [key, word] of PART_GROUPS) for (const part of catalog[key]) for (const a of ANGLES) names.push(`part/${word}-${part.id}-${a}`);
  for (const kase of catalog.cases) names.push(`part/case-${kase.id}-alt`);
  for (const c of catalog.cables) names.push(`cable/${c.id}`);
  for (const e of catalog.lighting.effects) names.push(`light/effect-${e.id}`);
  for (const p of catalog.lighting.presets) names.push(`light/preset-${p.id}`);
  names.push('light/override');
  for (const p of presets) names.push(`mode/exploded-${p}`);
  names.push('mode/airflow-night-rig', 'mode/airflow-windbreak', 'mode/showcase', 'mode/inspector');
  for (const s of SEQUENCES) for (const step of STEPS) names.push(`motion/${s}-${step}`);
  names.push('drag/valid', 'drag/blocked', 'drag/fan-mounts', 'drag/radiator-mounts', 'drag/memory-slots');
  names.push('tier/high', 'tier/medium', 'tier/low');
  names.push('ui-desktop/01-intro', 'ui-desktop/01-start', 'ui-desktop/10-power', 'ui-desktop/10-showcase');
  names.push('ui-desktop/13-share', 'ui-desktop/13-poster', 'ui-desktop/13-saved', 'ui-desktop/13-settings', 'ui-desktop/13-about');
  return names;
}

// Every one of these exact names must be defined in SHOTS.
export const REQUIRED = requiredNames();

// Groups whose every name is fixed. A shot in one of these groups with any other name is an error.
export const EXACT_GROUPS = ['rig', 'bench', 'finish', 'macro', 'part', 'cable', 'light', 'mode', 'motion', 'drag', 'tier'];

// Interface shots have a fixed start and a name you choose after it. Each start needs this many shots.
export const PREFIX_COUNTS = {
  'ui-desktop/01-': 2, 'ui-desktop/02-': 1, 'ui-desktop/03-': 1, 'ui-desktop/04-': 1, 'ui-desktop/05-': 1, 'ui-desktop/06-': 1, 'ui-desktop/07-': 1,
  'ui-desktop/08-': 1, 'ui-desktop/09-': 1, 'ui-desktop/10-': 2, 'ui-desktop/11-': 1, 'ui-desktop/12-': 1, 'ui-desktop/13-': 5, 'ui-desktop/14-': 1,
  'ui-tablet/landscape-': 5, 'ui-tablet/portrait-': 5,
  'ui-phone/landscape-': 2,
};

// These shots only pass when the critic was given the planning-time reference shot beside them.
const REF = 'kit/reference/night-rig/shots';
export const REFERENCES = {
  'rig/night-rig-hero': `${REF}/hero.jpg`, 'rig/night-rig-side': `${REF}/side.jpg`, 'rig/night-rig-front': `${REF}/front.jpg`,
  'rig/night-rig-top': `${REF}/top.jpg`, 'rig/night-rig-rear': `${REF}/rear.jpg`,
  'macro/night-rig-gpu': `${REF}/gpu.jpg`, 'macro/night-rig-cooler': `${REF}/pump.jpg`, 'macro/night-rig-ram': `${REF}/ram.jpg`,
  'macro/night-rig-board': `${REF}/board.jpg`, 'macro/night-rig-fan': `${REF}/fan.jpg`, 'macro/night-rig-cable': `${REF}/cable.jpg`,
};

// Contact sheets for the brand family check. They are images you assemble, not harness shots.
export const CONTACT = ['korrin', 'kestrane', 'lumenfold', 'calyra', 'veltrin', 'dravik', 'pellam', 'thessic', 'processors', 'mirevale', 'skarn', 'paleforge'].map((b) => `contact/${b}`);

// ---- when a shot may be left weak ------------------------------------------------------------

export const WEAK_FILE = 'kit/WEAK-SHOTS.json';
export const weakRounds = (name) => (['rig', 'ui-desktop'].includes(groupOf(name)) ? 12 : 8);

// ---- names, files and hashes -----------------------------------------------------------------

export const groupOf = (name) => name.split('/')[0];
export const nameOf = (text) => text.trim().replace(/^`|`$/g, '').replace(/^\.\//, '').replace(/^shots\//, '').replace(/\.jpg$/, '');
export const fileOf = (name, shots = {}) => (shots[name] && shots[name].out) || `shots/${name}.jpg`;
export const sha12 = (buffer) => crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
export const shaOfFile = (file) => (fs.existsSync(file) ? sha12(fs.readFileSync(file)) : null);

// ---- the verdict line ------------------------------------------------------------------------

// <shot name or image path> | sha: <hash> | reference: <path> | PASS or FAIL | <fail ids or -> | <one sentence>
// The sha and reference cells are optional in your own verdict files. A critic's line must carry the sha it was given.
export function parseLine(raw) {
  const cells = raw.replace(/^[\s>*-]+/, '').split('|').map((c) => c.trim());
  if (cells.length < 4 || !cells[0]) return null;
  const out = { name: nameOf(cells[0]), sha: '', reference: '' };
  let i = 1;
  for (; i < cells.length; i++) {
    const sha = /^sha:\s*([0-9a-f]{12})$/i.exec(cells[i]);
    const ref = /^reference:\s*(\S+)$/i.exec(cells[i]);
    if (sha) out.sha = sha[1].toLowerCase(); else if (ref) out.reference = ref[1]; else break;
  }
  const result = (cells[i] || '').toUpperCase();
  if (!['PASS', 'FAIL'].includes(result) || cells.length < i + 3) return null;
  const ids = cells[i + 1];
  return { ...out, result, ids: ids === '-' || ids === '' ? [] : ids.split(/[\s,]+/).filter(Boolean), note: cells.slice(i + 2).join(' | ') };
}

export const LEDGER = 'kit/VERDICTS.jsonl';
export function readLedger() {
  if (!fs.existsSync(LEDGER)) return [];
  return fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// A critic verdict in the ledger counts only when the critic's saved answer still holds that very line.
const answers = new Map();
export function backedByAnswer(v) {
  if (v.who !== 'critic' || !v.source || !/^kit\/critics\/\d{3}\.txt$/.test(v.source) || !fs.existsSync(v.source)) return false;
  if (!answers.has(v.source)) answers.set(v.source, fs.readFileSync(v.source, 'utf8').split('\n').map(parseLine).filter(Boolean));
  return answers.get(v.source).some((l) => l.name === v.shot && l.sha === v.sha && l.result === v.result);
}

// ---- which build is in dist/ -----------------------------------------------------------------

export const SOURCES = ['src', 'public', 'index.html', 'package.json', 'vite.config.ts'];
export const MANIFEST = 'shots/manifest.json';

function newest(target) {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let latest = 0;
  for (const name of fs.readdirSync(target)) latest = Math.max(latest, newest(path.join(target, name)));
  return latest;
}

function files(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...files(full)); else out.push(full);
  }
  return out;
}

// True when dist/ is missing or any source file is newer than it.
export function distIsStale() {
  const built = fs.existsSync('dist/index.html') ? fs.statSync('dist/index.html').mtimeMs : 0;
  return !built || SOURCES.some((s) => newest(s) > built);
}

// A hash of everything in dist/. The same source gives the same id, whenever it is built.
export function buildId() {
  if (!fs.existsSync('dist/index.html')) return 'none';
  const hash = crypto.createHash('sha1');
  for (const file of files('dist')) { hash.update(file); hash.update(fs.readFileSync(file)); }
  return hash.digest('hex').slice(0, 12);
}

export function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
}

export function writeManifest(manifest) {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
}

// ---- self check ------------------------------------------------------------------------------

for (const group of EXACT_GROUPS) {
  const have = REQUIRED.filter((n) => groupOf(n) === group).length;
  if (have !== GROUP_COUNTS[group]) throw new Error(`shot-rules: group ${group} builds ${have} names from the catalog but ${GROUP_COUNTS[group]} are required. The catalog and the shot rules no longer agree.`);
}
