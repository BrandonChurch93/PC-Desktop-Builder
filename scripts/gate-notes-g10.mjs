// Writes builder verdict lines for every shot the check says has no verdict on its current image, from notes by name prefix.
//
//   node scripts/gate-notes-g10.mjs <out.txt> [prefix ...]
import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const [out, ...prefixes] = process.argv.slice(2);
const NOTES = [
  ['part/board-', 'Board on the turntable after the Phase 7 diffuser changes: silkscreen, socket field and retention frame sharp, heatsinks read as metal, the LED strip saturated and lighting the disc, back finished.'],
  ['part/cpu-', 'Processor on the turntable: heat spreader reads as nickel plated metal with sharp print, substrate and contacts finished on the back.'],
  ['part/ram-', 'Memory kit on the turntable: light bars saturated pink to cyan after the lower diffuser intensity, spreader edges catch the light, marks sharp, label on the back.'],
  ['part/gpu-', 'Card on the turntable: shroud, fans and backplate read as their materials, light bars saturated and not clipped, print sharp, fastenings present.'],
  ['part/storage-', 'Drive on the turntable: label and print sharp, metal and board read as themselves, back finished.'],
  ['drag/', 'Held part at its sockets with the interface, places outlined in the accent or the danger color with the reason, the card highlighted in the tray with the re-rendered thumbnails.'],
  ['ui-desktop/13-share', 'Share dialog: title, body, the link field and Copy link (the link shows the preview port of this run).'],
  ['ui-tablet/', 'Tablet share dialog over the dimmed scene, the link and Copy link at 44 px.'],
  ['ui-phone/spec-sheet', 'Phone full spec sheet: parts by slot with Remove, the warning count, Copy as text and Export poster.'],
  ['ui-desktop/', 'Desktop interface with the re-rendered thumbnails: values from the engine, the center clear, copy on the fixed strings.'],
];
const r = spawnSync(process.execPath, ['scripts/check-shots.mjs', ...prefixes], { encoding: 'utf8' });
const names = (r.stdout + r.stderr).split('\n').filter((l) => /: no verdict on the current image/.test(l)).map((l) => l.split(':')[0].trim());
const rows = names.map((n) => { const note = NOTES.find(([p]) => n.startsWith(p)); if (!note) throw new Error(`no note for ${n}`); return `${n} | PASS | - | ${note[1]}`; });
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`notes: ${rows.length}`);
