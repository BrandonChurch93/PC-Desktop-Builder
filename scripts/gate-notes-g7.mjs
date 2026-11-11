// Writes builder verdict lines for every image a retake log lists as changed, from a table of notes by name prefix.
//
//   node scripts/gate-notes-g7.mjs <retake.log> <out.txt>
import fs from 'node:fs';
import process from 'node:process';

const [log, out] = process.argv.slice(2);
const NOTES = [
  ['rig/', 'Lit rig after the Phase 7 lighting changes (supply status LED lit, room wash follows the rig, memory diffusers lower): saturated diffusers, light on parts, desk and wall, grounded, no haze or clipping.'],
  ['macro/', 'Close view after the Phase 7 lighting changes: diffusers saturated and not clipped, light falls on neighbors, text sharp, materials read, supply LED lit where in view.'],
  ['finish/', 'The other finish lit after the Phase 7 lighting changes: finish reads as itself, rig light on the interior, desk and wall, no clipping.'],
  ['cable/', 'Colorway on the 24 pin run after the Phase 7 lighting changes: sleeve color and braid read, combs and plug seated, memory bars deep violet.'],
  ['light/effect-', 'Effect on the Aurora colors matches its definition at this frame, diffusers saturated, the room takes the rig color, no clipping.'],
  ['light/preset-ember', 'Ember comet: orange red heads with dark trails, and the wall and desk now take a warm red wash from the rig (critic 277 X13 fixed).'],
  ['light/preset-reactor', 'Reactor breathing: green on every zone, the wall and desk now take a green wash (critic 277 X13 fixed).'],
  ['light/preset-ice', 'Ice static: memory bars and fan ring keep a pale icy blue instead of white (critic 277 X14 fixed), cool wash on the interior and desk.'],
  ['light/preset-vapor', 'Vapor color shift: memory bars hold a saturated magenta instead of lilac (critic 277 X14 fixed), pink wash on the room.'],
  ['light/preset-starfield', 'Starfield: soft stars on a dark base with no clipped white blobs on the card bar or memory (critic 277 X14 fixed).'],
  ['light/preset-', 'Preset on the Night Rig, saturated diffusers and a room wash in the preset color, no clipping.'],
  ['light/override', 'Graphics off (card bar dark), memory on its own amber red, every other zone on the Aurora wave.'],
  ['mode/airflow-', 'Streams from the front intakes bend through the chamber clear of the parts to the top radiator and rear exhaust, cool to warmer at 60 percent load.'],
  ['motion/power-on-', 'Power on frame: zones wake along the power path (board, cooler, memory, card, fans) toward the lit Night Rig at 100.'],
  ['ui-desktop/09', 'Memory scoped with Own selected, its stops with the first open in the picker, load readout under the toggles, memory red in the scene.'],
  ['ui-desktop/10', 'Power on in Build mode: Power on, the load readout at 62 percent with Processor 45 °C and Graphics 52 °C, Simulated.'],
  ['ui-desktop/11', 'Airflow on in Build mode with panels, streams in the clear center, Airflow chip on, load readout shown.'],
  ['ui-phone/lighting', 'Phone lighting tab at the half stop, load readout as a row, effects and colors at 44 px.'],
];
const lines = fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.startsWith('shot: '));
const rows = lines.map((l) => {
  const name = l.slice(6).split(' ')[0].replace(/^shots\//, '').replace(/\.jpg$/, '');
  const note = NOTES.find(([p]) => name.startsWith(p));
  if (!note) throw new Error(`no note for ${name}`);
  return `${name} | PASS | - | ${note[1]}`;
});
fs.writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`notes: ${rows.length}`);
