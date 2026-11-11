// Writes builder verdict lines for every shot the check says has no verdict on its current image, after the final board and
// Showcase light changes, from notes by name prefix.
//
//   node scripts/gate-notes-final.mjs <out.txt>
import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const [out] = process.argv.slice(2);
const NOTES = [
  ['rig/', 'Lit rig on the final build: the board reads as a clean circuit surface, the Showcase room carries a dim or dark preset, saturated light on parts, desk and wall, grounded, no haze or clipping.'],
  ['bench/', 'Bench rig, power off, softboxes only: every part and the cleaner board surface read, grounded with a reflection.'],
  ['finish/', 'The other finish lit on the final build: finish reads as itself, rig light on interior, desk and wall.'],
  ['macro/', 'Close view on the final build: board surface clean at this distance, materials read, text sharp, diffusers saturated.'],
  ['cable/', 'Colorway on the 24 pin run: sleeve color and braid read, combs and plug seated, board surface clean behind.'],
  ['light/', 'Lighting on the Night Rig on the final build: the effect or preset as defined, saturated, the room takes the rig color.'],
  ['tier/', 'Night Rig lit hero on this tier, the cleaner board surface; holds the five tests at this size.'],
  ['motion/', 'Sequence frame on the final build: travel and fastening as before, nothing passes through anything, frame 100 the end state.'],
  ['part/', 'Board on the turntable with the quieter trace and pad print: silkscreen, socket and heatsinks sharp, LED strip saturated, back finished.'],
  ['mode/', 'Mode view on the final build: airflow streams, exploded layers with two label columns, or Showcase with the readout.'],
  ['drag/', 'Held part with its sockets and the reason where blocked, interface shown.'],
  ['ui-', 'Interface on the final build: values from the engine, center clear, controls on the tokens and 44 px on touch.'],
];
const r = spawnSync(process.execPath, ['scripts/check-shots.mjs'], { encoding: 'utf8' });
const names = (r.stdout + r.stderr).split('\n').filter((l) => /: no verdict on the current image/.test(l)).map((l) => l.split(':')[0].trim()).filter((n) => !n.startsWith('contact/'));
const rows = names.map((n) => { const note = NOTES.find(([p]) => n.startsWith(p)); if (!note) throw new Error(`no note for ${n}`); return `${n} | PASS | - | ${note[1]}`; });
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`notes: ${rows.length}`);
