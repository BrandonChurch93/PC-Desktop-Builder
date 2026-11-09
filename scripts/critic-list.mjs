// Prints the lines to give a critic: one image per line, with the hash of the image as it is on disk now,
// and the reference shot where one is required. Give a critic at most 12 lines, exactly as printed.
//
//   node scripts/critic-list.mjs <names or prefixes>      shots whose current image no critic has judged yet
//   node scripts/critic-list.mjs <names or prefixes> --all  every selected shot, judged or not
//   node scripts/critic-list.mjs contact                  the brand contact sheets
//
// The critic copies the path, the sha cell and the reference cell back in its answer. scripts/verdict.mjs
// only accepts a critic line whose sha is still the hash of the image on disk.
import fs from 'node:fs';
import process from 'node:process';
import { CONTACT, REFERENCES, backedByAnswer, buildId, distIsStale, fileOf, readLedger, readManifest, shaOfFile } from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';

const args = process.argv.slice(2);
const all = args.includes('--all');
const wanted = args.filter((a) => !a.startsWith('--'));
if (wanted.length === 0) { console.error('usage: node scripts/critic-list.mjs <names or prefixes> [--all]'); process.exit(1); }

const ledger = readLedger().filter(backedByAnswer);
const stale = distIsStale();
const build = stale ? '' : buildId();
const manifest = readManifest();
const names = [...Object.keys(SHOTS), ...CONTACT].filter((n) => wanted.some((q) => n.startsWith(q)));
const lines = []; const notes = [];
for (const name of names) {
  const file = fileOf(name, SHOTS);
  const sha = shaOfFile(file);
  if (!sha) { notes.push(`${name}: no image yet`); continue; }
  const harness = name in SHOTS;
  if (harness && (stale || !manifest[name] || manifest[name].sha !== sha || manifest[name].build !== build)) { notes.push(`${name}: not taken from the current build. Run npm run shots -- ${name} first`); continue; }
  if (!all && ledger.some((v) => v.shot === name && v.sha === sha)) continue;
  lines.push(`${file} | sha: ${sha}${REFERENCES[name] ? ` | reference: ${REFERENCES[name]}` : ''}`);
}
for (let i = 0; i < lines.length; i += 12) {
  console.log(`# critic batch ${i / 12 + 1} of ${Math.ceil(lines.length / 12)}`);
  console.log(lines.slice(i, i + 12).join('\n'));
  console.log('');
}
if (lines.length === 0) console.log('nothing to send: every selected image already has a critic verdict, or is listed below');
if (notes.length) { console.log('# not listed:'); console.log(notes.join('\n')); }
if (!fs.existsSync('kit/critics')) fs.mkdirSync('kit/critics', { recursive: true });
const used = fs.readdirSync('kit/critics').filter((f) => /^\d{3}\.txt$/.test(f)).map((f) => Number(f.slice(0, 3)));
const next = String(Math.max(0, ...used) + 1).padStart(3, '0');
console.log(`# next critic number: ${next}`);
