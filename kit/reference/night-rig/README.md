# Night Rig reference prototype

A working Three.js sketch of the Night Rig preset in the Vitrine case, with the Night Rig interface over it. It was written at planning time to set the visual floor. Everything the Builder ships must be clearly better than this.

It is a sketch. It is plain JavaScript in five files, everything is positioned by hand, and only one build exists. Do not copy its structure. Take its techniques and its lessons.

## Run it

After `npm install` at the repository root:

```
node kit/reference/night-rig/serve.mjs 5319
```

Then open `http://127.0.0.1:5319/index.html`. The server maps the page's CDN imports of `three` and `gsap` to the repository's `node_modules`, so it runs offline.

URL parameters:

| Parameter | Effect |
| --- | --- |
| `t=3.2` | Freezes time at that many seconds and stops the loop after a few frames. The page sets `window.__ready = true` when it has drawn. Use this for screenshots. |
| `ui=0` | Hides the interface |
| `cam=<name>` | Starts on a named view: `hero`, `side`, `front`, `top`, `rear`, `gpu`, `pump`, `ram`, `board`, `fan`, `cable` |
| `effect=<name>` | `static`, `breathing`, `spectrum`, `wave`, `comet`, `starlight`, `thermal` |
| `glass=0` | Glass panel off |
| `explode=1` | Exploded view |
| `ao=0`, `bloom=0`, `mirror=0` | Turn off a part of the post chain, for debugging |

In the page, the lighting panel, the Glass and Power chips, the mode switch and the first part card are live. The rest of the interface is static markup.

## Files

| File | Holds |
| --- | --- |
| `main.js` | Renderer, post chain, lights, LED lamps, camera views, exploded view, the card's install motion, interface wiring |
| `parts.js` | Geometry for the case, glass, board, memory, card, cooler, fans, cables and room |
| `materials.js` | The material set |
| `textures.js` | Canvas drawn textures: grain, brushing, perforation, braid, circuit traces, labels, LED data textures |
| `rgb.js` | Per LED effect math and zone textures |
| `ui.css`, `index.html` | The Night Rig interface |
| `shots/` | Screenshots taken at planning time on a software renderer, 1440 × 900 |

## What it proves

- Per LED zones written to small data textures and sampled by diffuser meshes read as real diffused lighting.
- Area lights colored by the zones light the parts and the room without flares.
- The post chain order and the occlusion mix pass in `main.js` are stable. The list of traps in `kit/04-WORLD.md` came from debugging this file.
- Individually sleeved wires with combs look convincing up close.
- Instanced fin stacks, extruded and beveled plates with cutouts, lathed pump heads and generated fan blades give real form cheaply.
- Canvas drawn circuit traces with a height map and clearcoat read as a circuit board.
- The Night Rig interface leaves the center clear and frames the rig.

## Weak points to beat

Each of these is visible in the shots. Phase 2 must fix every one except point 11 and say how in PROGRESS. Point 11 is the interface, which is built in Phase 5 and checked at Gate 5.

1. **Glass barely reads as glass.** No visible reflection, no bright edge, no sense of thickness.
2. **The case is plain.** Flat slabs, no front connectors or power button, simple feet, no detail on the shroud, an empty supply bay.
3. **Fan blades are single surfaces** with no thickness, and fast fans would strobe. No motion blur.
4. **The card** has no backplate screws, a plain bracket, a bare fan side, and one zone drives both its bar and its wordmark.
5. **The board's connectors are blocks.** No pins, no headers, no socket detail, little printed text.
6. **Cables** are only three runs, the combs are plain bars, connectors are not modeled, and wires end inside parts.
7. **The radiator's fins are a bump texture.** They should be geometry. Tube fittings are simple cylinders.
8. **No processor, no drives, no supply model.** They are not in the scene.
9. **LED lamps are few and hand placed.** The shroud end is lit as one flat patch.
10. **The room.** The desk reflection shows faint artifacts at the edges, the surfaces have no character, and from the front view a hard edged shadow of the case still falls on the wall.
11. **The interface** has placeholder thumbnails, mostly static controls and only a desktop layout.
12. **Nothing is placed by a layout.** Every position is a number typed into `parts.js`.
13. **Text is sparse.** Real parts carry model names, capacities, ratings and small technical print.

## Notes

- Names and numbers in the prototype follow the catalog for the Night Rig preset. Where they differ, the catalog wins.
- The prototype's Vitrine has about 419 mm of free length for a card and about 175 mm of free height over the processor, which satisfy the layout rules for the catalog's limits.
- The prototype has seven lighting effects. The product has eight: it adds `shift`.
- The shots were rendered on a CPU renderer. On a GPU the image should match.
