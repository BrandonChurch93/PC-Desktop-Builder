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
//   the newest verdict on exactly that image is a PASS, and:
//     in the 3D groups (CRITIC_GROUPS) it is a critic PASS, or a builder PASS when a critic has judged that shot
//     before on any image (kit/addenda/01-less-judging.md, rule 1)
//     in every other group, and for contact sheets, a builder or a critic PASS is enough (rule 2)
//   a critic PASS counts only when the critic was given the reference shot where one is required
// Critic verdicts count only when they come from an answer saved under kit/critics/.
// The rules here are the gate. Addendum 01 rule 6 is the only change allowed to them.
import process from 'node:process';
import { CONTACT, EXACT_GROUPS, GROUP_COUNTS, PREFIX_COUNTS, REFERENCES, REQUIRED, backedByAnswer, buildId, distIsStale, fileOf, groupOf, readLedger, readManifest, shaOfFile } from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';

const CRITIC_GROUPS = ['rig', 'bench', 'finish', 'macro', 'part', 'cable', 'light'];

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
const ledger = readLedger().filter((v) => v.who === 'builder' || backedByAnswer(v));
const stale = distIsStale();
const build = stale ? '' : buildId();
const manifest = readManifest();
if (stale && defined.some(inScope)) problems.push('dist/ is missing or older than the source. Run npm run shots for these shots first, so they are taken from the current build');

function judge(name, sha, criticFirst) {
  const mine = ledger.filter((v) => v.shot === name);
  const current = mine.filter((v) => v.sha === sha);
  const last = current[current.length - 1];
  if (!last) return `no verdict on the current image (${sha})`;
  if (last.result !== 'PASS') return `the latest verdict on this image is FAIL (${sha}). Change the image`;
  if (last.who === 'critic') return REFERENCES[name] && last.reference !== REFERENCES[name] ? 'a critic passed it without its reference shot. List it with scripts/critic-list.mjs --all and send it to one new critic' : null;
  if (criticFirst && !mine.some((v) => v.who === 'critic')) return `only your own PASS so far. A 3D shot goes to one critic first (${sha})`;
  return null;
}

let passed = 0;
for (const name of defined.filter(inScope)) {
  const sha = shaOfFile(fileOf(name, SHOTS));
  if (!sha) { problems.push(`${name}: image missing`); continue; }
  if (stale) continue;
  const noted = manifest[name];
  if (!noted || noted.sha !== sha || noted.build !== build) { problems.push(`${name}: not taken from the current build. Run npm run shots -- ${name}`); continue; }
  const why = judge(name, sha, CRITIC_GROUPS.includes(groupOf(name)));
  if (why) problems.push(`${name}: ${why}`); else passed++;
}

// Contact sheets.
let sheets = 0;
if (everything || wanted.some((q) => 'contact'.startsWith(q) || q.startsWith('contact'))) {
  for (const name of CONTACT.filter(inScope)) {
    const sha = shaOfFile(fileOf(name));
    if (!sha) { problems.push(`${name}: contact sheet missing`); continue; }
    const why = judge(name, sha, false);
    if (why) problems.push(`${name}: ${why}`); else sheets++;
  }
}

console.log(`shots defined: ${defined.length} of 358 · passed: ${passed} · contact sheets passed: ${sheets} · problems: ${problems.length}`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
