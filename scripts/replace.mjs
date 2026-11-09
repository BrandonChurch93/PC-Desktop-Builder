// Applies exact text replacements listed in a JSON file: [{ "file": "...", "from": "...", "to": "..." }].
// Each "from" must occur exactly once in its file, or nothing is written.
//
//   node scripts/replace.mjs <edits.json>
import fs from 'node:fs';
import process from 'node:process';

const edits = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const files = new Map();
for (const e of edits) {
  const text = files.get(e.file) ?? fs.readFileSync(e.file, 'utf8');
  const n = text.split(e.from).length - 1;
  if (n !== 1) { console.error(`replace: ${e.file}: found ${n} times: ${e.from.slice(0, 80)}`); process.exit(1); }
  files.set(e.file, text.replace(e.from, () => e.to));
}
for (const [f, t] of files) fs.writeFileSync(f, t);
console.log(`replace: ${edits.length} edits in ${files.size} files`);
