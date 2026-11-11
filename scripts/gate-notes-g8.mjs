// Writes builder verdict lines for every shot the check says has no verdict on its current image, from notes by name prefix.
//
//   node scripts/gate-notes-g8.mjs <out.txt> <prefix> [prefix ...]
import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const [out, ...prefixes] = process.argv.slice(2);
const NOTES = [
  ['mode/exploded-', 'Parts apart along their own axes in layers toward the open side, radiator and fans out through their mounts, glass out ahead, cables away; two label columns with leaders that do not cross, names from the catalog.'],
  ['mode/showcase', 'Showcase with the interface receded: the lit rig centered, load readout at the bottom at 100 percent with Processor 53 °C and Graphics 63 °C, Simulated.'],
  ['mode/inspector', 'The Apex 3X alone on the turntable, lit like a product shot, its spec list from the catalog and Remove, the turntable glow from its own bars.'],
  ['motion/explode-', 'Explode sequence frame: parts move out on their own axes with a stagger, nothing passes through anything, 100 matches the exploded state.'],
  ['motion/intro-', 'Intro frame: from a dark room the name fades in, the room and exposure rise and the rig wakes along its power path while the camera pushes in; 100 is the lit hero.'],
  ['ui-desktop/01-intro', 'The intro over the scene: name and subtitle under the lit rig mid push, nothing else on screen.'],
  ['ui-desktop/01-start', 'Start overlay: the two buttons, Or pick a build, the six preset cards with real renders, blurbs and case lines.'],
  ['ui-desktop/07', 'The Inspector with its interface: name, six spec rows, Remove and close, the hint line, the part centered above.'],
  ['ui-desktop/10-showcase', 'Showcase at full load: toggles and mode at the top, the readout at the bottom, the rig clear in the middle.'],
  ['ui-desktop/12', 'Exploded mode with the interface: labels in two columns clear of the top bar and the readout.'],
  ['ui-desktop/13-share', 'Share dialog: title, body copy, the link field and Copy link, scene dimmed behind.'],
  ['ui-desktop/13-poster', 'Export poster dialog: Portrait and Landscape, the pixel size line, Export poster.'],
  ['ui-desktop/13-saved', 'Saved builds: Save this build and three entries with Load, Rename and Delete.'],
  ['ui-desktop/13-settings', 'Settings: quality Auto to Low, Reduce motion, Reset saved data.'],
  ['ui-desktop/13-about', 'About with the fixed copy and the product name.'],
  ['ui-desktop/14', 'Shared link landing: Showcase, the banner Shared build · Flagship with Make it yours, power on, readout at the bottom.'],
  ['ui-desktop/', 'Interface over the scene after the thumbnail re-render and Phase 8 changes: real thumbnails, values from the engine, center clear.'],
  ['ui-tablet/', 'Tablet layout: top bar, edge buttons or the side sheet below the readout, dock, the rig in the clear area, controls 44 px.'],
  ['ui-phone/', 'Phone layout: compact top bar, the sheet or dialog at its stop, the rig readable, controls 44 px, copy on the fixed strings.'],
];
const r = spawnSync(process.execPath, ['scripts/check-shots.mjs', ...prefixes], { encoding: 'utf8' });
const names = (r.stdout + r.stderr).split('\n').filter((l) => /: no verdict on the current image/.test(l)).map((l) => l.split(':')[0].trim());
const rows = names.map((n) => { const note = NOTES.find(([p]) => n.startsWith(p)); if (!note) throw new Error(`no note for ${n}`); return `${n} | PASS | - | ${note[1]}`; });
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`notes: ${rows.length}`);
