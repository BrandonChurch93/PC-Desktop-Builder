// Says which shots are done. Exits non zero unless everything it was asked about is in order.
//
//   node scripts/check-shots.mjs                 every shot, every count, and the contact sheets
//   node scripts/check-shots.mjs rig macro       these whole groups
//   node scripts/check-shots.mjs rig/night-rig   every required or defined shot whose name starts with this
//   node scripts/check-shots.mjs contact         the brand contact sheets
//
// A shot is in order when all of these hold:
//   its name is one of the required names (scripts/shot-rules.mjs) and it is defined in scripts/shot-list.mjs
//   its image exists and the harness took it, or confirmed it unchanged, from the build that is in dist/ now
//   the newest critic verdict on exactly that image is PASS, it came from a critic answer saved under kit/critics/,
//   no more than two critics judged that image, and the critic was given the reference shot where one is required
// or when it is listed as weak in kit/WEAK-SHOTS.json and meets the weak rule in kit/07-QUALITY-BAR.md.
// Do not change the rules in this file. They are the gate.
import fs from 'node:fs';
import process from 'node:process';
import { CONTACT, EXACT_GROUPS, GROUP_COUNTS, PREFIX_COUNTS, REFERENCES, REQUIRED, WEAK_FILE, backedByAnswer, buildId, distIsStale, fileOf, groupOf, readLedger, readManifest, shaOfFile, weakRounds } from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';

const wanted = process.argv.slice(2);
const everything = wanted.length === 0;
const inScope = (name) => everything || wanted.some((q) => name.startsWith(q));
const problems = [];

// Names and counts.
const defined = Object.keys(SHOTS);
const required = new Set(REQUIRED);
for (const name of REQUIRED.filter(inScope)) if (!(name in SHOTS)) problems.push(`${name}: required, and not defined in scripts/shot-list.mjs`);
for (const name of defined.filter(inScope)) {
  const group = groupOf(name);
  if (!(group in GROUP_COUNTS)) problems.push(`${name}: ${group} is not a shot group`);
  else if (EXACT_GROUPS.includes(group) && !required.has(name)) problems.push(`${name}: not one of the required names for ${group}`);
  else if (!EXACT_GROUPS.includes(group) && group !== 'ui-phone' && !Object.keys(PREFIX_COUNTS).some((p) => name.startsWith(p))) problems.push(`${name}: the name must start with one of the fixed starts for ${group}`);
}
for (const [prefix, need] of Object.entries(PREFIX_COUNTS)) {
  if (!everything && !wanted.some((q) => prefix.startsWith(q))) continue;
  const have = defined.filter((n) => n.startsWith(prefix)).length;
  if (have !== need) problems.push(`${prefix}: ${have} shots defined, ${need} required`);
}
for (const [group, need] of Object.entries(GROUP_COUNTS)) {
  if (!everything && !wanted.includes(group)) continue;
  const have = defined.filter((n) => groupOf(n) === group).length;
  if (have !== need) problems.push(`group ${group}: ${have} shots defined, ${need} required`);
}
for (const q of wanted) if (![...defined, ...REQUIRED, ...CONTACT].some((n) => n.startsWith(q))) problems.push(`${q}: no shot has this name or starts with it`);

// Verdicts.
const ledger = readLedger().filter(backedByAnswer);
const weak = fs.existsSync(WEAK_FILE) ? JSON.parse(fs.readFileSync(WEAK_FILE, 'utf8')) : [];
const stale = distIsStale();
const build = stale ? '' : buildId();
const manifest = readManifest();
if (stale && defined.some(inScope)) problems.push('dist/ is missing or older than the source. Run npm run shots for these shots first, so they are taken from the current build');

function verdictOn(name, sha) {
  const mine = ledger.filter((v) => v.shot === name);
  const current = mine.filter((v) => v.sha === sha);
  const last = current[current.length - 1];
  const failedImages = new Set(mine.filter((v) => v.result === 'FAIL').map((v) => v.sha)).size;
  return { current, last, failedImages };
}

let passed = 0; let weakCount = 0;
for (const name of defined.filter(inScope)) {
  const sha = shaOfFile(fileOf(name, SHOTS));
  if (!sha) { problems.push(`${name}: image missing`); continue; }
  if (stale) continue;
  const noted = manifest[name];
  if (!noted || noted.sha !== sha || noted.build !== build) { problems.push(`${name}: not taken from the current build. Run npm run shots -- ${name}`); continue; }
  const { current, last, failedImages } = verdictOn(name, sha);
  const ok = last && last.result === 'PASS' && current.length <= 2 && (!REFERENCES[name] || last.reference === REFERENCES[name]);
  if (ok) { passed++; continue; }
  const entry = Array.isArray(weak) ? weak.find((w) => w && w.shot === name) : null;
  if (entry) {
    const need = weakRounds(name);
    const tried = Array.isArray(entry.tried) ? entry.tried.filter((t) => typeof t === 'string' && t.trim()).length : 0;
    if (!last || last.result !== 'FAIL') problems.push(`${name}: listed as weak, but no critic has failed the current image (${sha})`);
    else if (failedImages < need) problems.push(`${name}: listed as weak after critics failed ${failedImages} different images of it, ${need} required`);
    else if (tried < 2 || typeof entry.why !== 'string' || !entry.why.trim()) problems.push(`${name}: a weak entry needs "why" and a "tried" list with at least two rebuilds`);
    else weakCount++;
    continue;
  }
  if (!last) problems.push(`${name}: no critic verdict on the current image (${sha})`);
  else if (last.result === 'FAIL') problems.push(`${name}: the latest critic verdict on this image is FAIL (${sha}). Change the image`);
  else if (current.length > 2) problems.push(`${name}: more than two critics judged this image. Change the image, do not ask again`);
  else problems.push(`${name}: passed without its reference shot. List it with scripts/critic-list.mjs --all and send it to one new critic`);
}

// Contact sheets.
let sheets = 0;
if (everything || wanted.some((q) => 'contact'.startsWith(q) || q.startsWith('contact'))) {
  for (const name of CONTACT.filter(inScope)) {
    const sha = shaOfFile(fileOf(name));
    if (!sha) { problems.push(`${name}: contact sheet missing`); continue; }
    const { current, last } = verdictOn(name, sha);
    if (last && last.result === 'PASS' && current.length <= 2) sheets++;
    else problems.push(`${name}: ${last ? 'the latest critic verdict on this sheet is not a clean PASS' : 'no critic verdict on the current sheet'} (${sha})`);
  }
}

console.log(`shots defined: ${defined.length} of 358 · passed: ${passed} · weak: ${weakCount} · contact sheets passed: ${sheets} · problems: ${problems.length}`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
