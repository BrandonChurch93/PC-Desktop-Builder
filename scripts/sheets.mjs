// Builds several review sheets from a list file, one line each: <name> <columns> <tile px> <shot> [shot ...].
// Each sheet is written to shots/peek/<name>.jpg.
//
//   node scripts/sheets.mjs <list.txt>
import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
for (const l of lines) {
  const [name, cols, tile, ...shots] = l.split(/\s+/);
  const r = spawnSync(process.execPath, ['scripts/sheet.mjs', `shots/peek/${name}.jpg`, cols, tile, ...shots.map((s) => `shots/${s}.jpg`)], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
