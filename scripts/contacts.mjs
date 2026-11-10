// Builds the brand contact sheets from each part's front Inspector shot, for the family judgment in kit/07-QUALITY-BAR.md.
//
//   node scripts/contacts.mjs                 every sheet whose shots exist
//   node scripts/contacts.mjs korrin veltrin  these sheets
//
// Writes shots/contact/<name>.jpg. A brand sheet holds every part of that brand; the processors sheet holds both
// processors side by side. Case brands show each case in both finishes (front and alt shots).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const catalog = JSON.parse(fs.readFileSync('kit/data/catalog.json', 'utf8'));
const GROUPS = [['cases', 'case'], ['boards', 'board'], ['cpus', 'cpu'], ['coolers', 'cooler'], ['ram', 'ram'], ['gpus', 'gpu'], ['storage', 'storage'], ['psus', 'psu'], ['fans', 'fan']];

const sheets = {};
for (const [key, cat] of GROUPS) {
  for (const part of catalog[key]) {
    const name = cat === 'cpu' ? 'processors' : part.brand;
    const files = cat === 'case' ? [`shots/part/case-${part.id}-front.jpg`, `shots/part/case-${part.id}-alt.jpg`] : [`shots/part/${cat}-${part.id}-front.jpg`];
    (sheets[name] ??= []).push(...files);
  }
}

const wanted = process.argv.slice(2);
for (const [name, files] of Object.entries(sheets)) {
  if (wanted.length && !wanted.includes(name)) continue;
  if (name === 'wyrmglass') continue;
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) { console.log(`skip ${name}: missing ${missing.join(', ')}`); continue; }
  const cols = files.length <= 2 ? files.length : files.length <= 4 ? 2 : files.length <= 9 ? 3 : 4;
  execFileSync('node', ['scripts/sheet.mjs', `shots/contact/${name}.jpg`, String(cols), '400', ...files], { stdio: 'inherit' });
}
