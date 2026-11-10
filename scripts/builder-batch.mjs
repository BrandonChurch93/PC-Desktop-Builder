// Writes a builder verdict file for the shots that critic-list reports as unjudged, with one shared sentence per group
// prefix, for a round where every changed image was opened and passed. Usage:
//   node scripts/builder-batch.mjs <out.txt> <notes.json> <prefix> [prefix ...]
// notes.json maps a shot name prefix to the sentence for shots under it; the longest matching prefix wins.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const [out, notesFile, ...prefixes] = process.argv.slice(2);
if (!out || !notesFile || !prefixes.length) { console.error('usage: node scripts/builder-batch.mjs <out.txt> <notes.json> <prefix> [prefix ...]'); process.exit(1); }
const notes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
const listed = execFileSync('node', ['scripts/critic-list.mjs', ...prefixes], { encoding: 'utf8' });
const names = listed.split('\n').filter((l) => l.startsWith('shots/')).map((l) => l.split(' | ')[0].replace(/^shots\//, '').replace(/\.jpg$/, ''));
const lines = names.map((n) => {
  const key = Object.keys(notes).filter((k) => n.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  if (!key) throw new Error(`no note for ${n}`);
  return `${n} | PASS | - | ${notes[key]}`;
});
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`builder-batch: ${lines.length} lines in ${out}`);
