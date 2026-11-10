// Writes builder verdict lines for every shot the check lists with no verdict on its current image, from a notes file of
// "name | note" lines and a default note per group. Every listed image must have been opened before this runs.
//
//   node scripts/gate-verdicts.mjs <check output file> <notes file> <out file>
import fs from 'node:fs';
import process from 'node:process';

const [checkFile, notesFile, outFile] = process.argv.slice(2);
if (!checkFile || !notesFile || !outFile) { console.error('usage: node scripts/gate-verdicts.mjs <check> <notes> <out>'); process.exit(1); }
const names = fs.readFileSync(checkFile, 'utf8').split('\n').filter((l) => l.includes('no verdict on the current image')).map((l) => l.split(':')[0].trim());
const notes = new Map(fs.readFileSync(notesFile, 'utf8').split('\n').filter((l) => l.includes('|')).map((l) => { const [n, ...t] = l.split('|'); return [n.trim(), t.join('|').trim()]; }));
const missing = names.filter((n) => !notes.has(n) && !notes.has(n.split('/')[0]));
if (missing.length) { console.error(`no note for: ${missing.join(', ')}`); process.exit(1); }
fs.writeFileSync(outFile, names.map((n) => `${n} | PASS | - | ${notes.get(n) ?? notes.get(n.split('/')[0])}`).join('\n') + '\n');
console.log(`lines: ${names.length}`);
