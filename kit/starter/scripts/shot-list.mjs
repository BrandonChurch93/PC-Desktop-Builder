// Every named shot, in one table. This is the file you fill in.
//
// name -> { width, height, touch, steps: [[hookMethod, ...args]], out }
// The name is "<group>/<shot>" and the image is written to shots/<name>.jpg unless `out` is set.
// Defaults: 1440 x 900. Steps run in order through window.__pcb, then the harness waits for settle().
//
// The names are not yours to choose, except the tail of the interface shots. scripts/shot-rules.mjs builds the
// required names from the catalog and kit/07-QUALITY-BAR.md lists them in its Shots table.
// To see what is still missing, run: npm run check:shots
//
// Example:
//   'rig/night-rig-hero': { steps: [['load', 'night-rig'], ['mode', 'showcase'], ['set', { ui: false, glass: true, power: true, load: 0 }], ['cam', 'hero'], ['freeze', 3.2]] },
//
// List the names you chose for __pcb.open(name) here:
//
export const SHOTS = {};
