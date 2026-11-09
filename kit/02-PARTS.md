# 02 · Parts

`kit/data/catalog.json` is the single source for every part, number, name and brand. This file tells you what the parts are and what makes each one look like itself. It never repeats a number that the catalog holds. When you need a number, read the catalog.

The roster is 49 modeled parts plus 6 cable colorways:

| Category | Count | Catalog key |
| --- | --- | --- |
| Cases | 6, each in 2 finishes | `cases` |
| Boards | 6 | `boards` |
| Processors | 2 | `cpus` |
| Coolers | 8 | `coolers` |
| Memory kits | 6 | `ram` |
| Graphics cards | 8 | `gpus` |
| Storage drives | 3 | `storage` |
| Power supplies | 5 | `psus` |
| Fans | 5 styles, each in 120 mm and 140 mm | `fans` |
| Cable colorways | 6 | `cables` |

## Invented brands

Every brand is fictional. There are 14, listed in `brands` in the catalog. Each has a `language` line that describes its design language. Read it before modeling any part of that brand and make the family resemblance obvious: two Veltrin cards should look like siblings, and a Veltrin card should never be mistaken for a Dravik.

Rules for brand marks:

- Wordmarks are set in type you generate on a canvas. Give each brand its own treatment (weight, width, letter spacing, case) and use it consistently on every part of that brand. Record the treatments in one module.
- Korrin also has a K monogram. No other brand has a symbol unless you design one, and if you do, keep it a simple geometric mark and log it.
- Never draw anything that resembles a real hardware company's logo, wordmark, mascot or signature product shape. The archetypes below are genres that many makers build. Model the genre, not a specific product.
- Names of open standards may appear as small technical print: ATX, DDR5, PCIe, M.2, NVMe, SATA, 12V-2x6. Do not print certification marks or program names owned by anyone.

**The catalog's names are final.** Every brand, part and preset name in the catalog was checked at planning time against real hardware makers and products and came back clear. Use them exactly as written. Do not rename one, and do not fail a shot because a catalog name is an ordinary word that some unrelated product somewhere also uses. The real brand rule is about real makers' names, logos and signature product shapes.

## Reading the catalog fields

| Field | Meaning |
| --- | --- |
| `id` | Stable id used in code, links and fixtures. Never change one. |
| `brand` | Brand id. The display name is the brand `name` followed by the part `name`. |
| `draw` | Estimated power draw in watts. On cases it is the draw of the case's own lighting. |
| `lightZones` | How many addressable zones the part has. 0 means the part is unlit. |
| `finish` | Colorway of the part: `graphite` is black and dark metal, `frost` is white and pale metal. Case finishes are listed per case in `finishes`. |
| `size` on a case | `d` depth front to back, `w` width, `h` height including feet. |
| `fanMounts` | Each has an `id`, a `group`, a fan `size` and a `role` (`intake` or `exhaust`). |
| `radMounts` | Each names the fan `group` it occupies, the radiator `sizes` it takes, and the `gpuPenalty` it costs in graphics clearance. |
| `glass` | Which sides are glass. `left` is the side the board faces. |
| `open` | True for the open air frame, which has no enclosure. |

The rest of the fields are explained by the rules that use them in `kit/03-RULES.md`.

## Standard dimensions

These are real, public form factor standards. Use them so parts are in true proportion. Values in mm. Verify any you depend on closely and record what you found.

| Thing | Dimensions |
| --- | --- |
| Boards | In `constants.boardDims` in the catalog |
| Expansion slot pitch | `constants.slotPitch` in the catalog |
| 120 mm fan | 120 × 120 × 25, screw holes on a 105 square |
| 140 mm fan | 140 × 140 × 25, screw holes on a 124.5 square |
| Slim fan (low profile cooler) | 120 × 120 × 15 |
| 240 radiator | about 277 × 120 × 27 to 30 |
| 360 radiator | about 397 × 120 × 27 to 30 |
| ATX power supply | 150 wide × 86 tall, length from the catalog |
| SFX power supply | 125 wide × 63.5 tall, length from the catalog |
| 3.5 inch drive | 101.6 × 147 × 26.1 |
| 2.5 inch drive | 69.85 × 100 × 7 |
| M.2 2280 drive | 22 × 80 |
| Memory module | 133.35 long, 1.3 thick at the board edge, height from the catalog |
| Processor package | about 45 × 45 for the square one, about 40 × 58 for the long one |

Graphics cards use `length`, `height` and `thickness` from the catalog. Length runs from the bracket toward the front of the case. Height is how far the card stands off the board toward the glass. Thickness is how far it reaches down across the slots.

## Cases

A case is the most complex model in the app and sets the stage for everything else. Each one needs its own layout: where the board sits, where each mount and bay is, how cables leave the supply and reach the board. `kit/04-WORLD.md` gives the layout contract. The first case, Vitrine, exists as the reference prototype. The rows below describe the planned arrangement of each case. Each was checked on paper against the catalog's limits. If a layout test shows one cannot hold, rearrange the interior, log it, and keep the archetype.

Every case has: a structural frame with real panel thickness and rolled or chamfered edges, a board tray with cable cutouts and rubber grommets, standoffs for each supported board size, an expansion slot bracket wall with the right number of slots, a rear cutout for the board's connector block, a power supply bay, every fan mount with screw holes, feet or a base, glass panels with a painted border and visible fixings, a brand plate or printed wordmark, and front panel connectors and a power button somewhere believable.

| Id | Archetype and what must be true of it |
| --- | --- |
| `vitrine` | Glass mid tower. One full height glass side with a black painted border and four corner standoffs. Fine round perforated steel front with the three front fans glowing through it. Perforated top over the radiator mount. A full length supply shroud with a slotted vent field and a small brand plate. Calm, slim, almost no visible screws. This is the reference prototype's case. |
| `atrium` | Dual chamber showcase. Glass on the left and on the front, meeting at a glass to glass corner with no pillar. The body is wide because the supply and the 3.5 inch bays live in a second chamber behind the board tray. Fan mounts on the floor and on the tray wall in front of the board bring air in, the top exhausts. The `side` mounts are recessed: their fans, and a radiator when one is mounted there, sit inside the second chamber flush with the tray wall, so the longest card passes in front of them. That is why the `side` radiator mount costs no graphics clearance. A light strip runs along the base and is the case's own zone. Sits on a low plinth. |
| `vent` | Mesh airflow tower. A gently bowed front of coarse hexagonal perforation with three 140 mm fans behind it. Glass side panel held by a steel rail at the bottom. Stamped ribs across the top, exposed hex head screws, a stencil wordmark. Reads as built for airflow. |
| `bulwark` | Full tower. The tallest and deepest. The front has a solid center spine with mesh intakes on both sides, and a vertical light bar in the spine that is the case's own zone. Large hinged glass side. Fan mounts on top of the shroud floor. Four drive sleds visible at the front of the lower chamber. Room everywhere. |
| `cub` | Small form factor. A compact shell of thick anodized aluminum with rounded outer corners, perforated top and right side, glass on the left. The board stands at the rear. The small supply stands at the front, beside the board. The graphics card runs the full depth of the case along the floor, under both. The radiator or two fans hang under the top. Every part is close to the next, so clearances here are the tightest and must still be collision free. |
| `gantry` | Open air frame. No enclosure. A thick vertical aluminum backplate on two machined feet carries the board. A single sheet of glass stands off the left side on four pillars. The radiator and fans mount on a spine bracket at the front edge, beyond the reach of the longest card. The supply sits exposed on a shelf at the bottom. Everything is visible from every side, so every part's back and underside must be modeled. |

**Finishes.** Each case has two, listed in its `finishes`. `onyx` is black powder coat or black anodizing. `frost` is white with a pale grey interior. `gunmetal` is dark grey metallic with a fine flake. `raw` is bead blasted natural aluminum. A finish changes the case's painted and anodized surfaces only. Glass borders stay dark. The finish must look right, not like a hue shift: white powder coat is slightly glossy and shows soft shadow in every seam.

## Boards

All six are Korrin. The Z7 family is `graphite`: matte black board, satin black heatsinks with diagonal cut lines. The X9 family is `frost`: white board, pale silver heatsinks. Within a family the three sizes share one design and scale it down.

Every board has: a detailed circuit board surface with traces, pads and printed labels; the processor socket with its retention frame; voltage regulator heatsinks with real fins beside and above the socket; rows of chokes and capacitors; memory slots with latches, in the count from the catalog; a full length reinforced graphics slot plus shorter slots as the size allows; M.2 slots in the count from the catalog, each under a heatsink plate that lifts for installing a drive; a chipset heatsink with the K monogram; the 24 pin and processor power connectors; SATA ports in the count from the catalog; fan and lighting headers; the rear connector block with a cover; a coin cell; mounting holes with screw heads at the standard positions for its size.

Light zones by board: `z7` has a strip on the connector cover and an accent on the chipset plate. `z7m` has the chipset accent. `z7i` has the connector cover strip. `x9` has both of those plus an underglow strip along the right edge. `x9m` has the cover strip and the chipset accent. `x9i` has the cover strip. This matches each board's `lightZones` count.

## Processors

Two, one per platform. A processor is small, but the Inspector shows it large, so it needs: a nickel heat spreader with a fine etched mark and model line, a green or dark substrate with a visible edge, a corner orientation mark, and a field of gold contact pads on the underside. `ember8` is square. `tidal16` is longer with a notched corner. Installing one is a moment: the retention frame opens, the processor lowers in, the frame closes and latches.

## Coolers

All Kestrane.

| Id | What it is |
| --- | --- |
| `pillar` | Single tower. Six nickel plated heat pipes rising through a dense black fin stack, a stamped top plate with the wordmark, one unlit fan held by wire clips. |
| `pillar-lux` | The same tower with a lit ring fan. One zone. |
| `twin` | Dual tower. Two fin stacks, seven heat pipes, two fans (one in front, one between the towers). Wide enough to overhang the memory slots, which is why its `ramClearance` matters. |
| `slate` | Low profile, top down. A flat fin stack over the socket with four heat pipes curving up into it and a slim fan on top blowing down. Overhangs the memory. |
| `tarn240` | Liquid. Round pump head with a lit ring (one zone), two braided tubes, a 240 radiator with a real fin core and end tanks, two unlit fans. |
| `tarn240-frost` | The white version: white radiator, white sleeved tubes, two lit fans plus the pump ring. Three zones. |
| `tarn360` | Liquid with a 360 radiator and three unlit fans. Pump ring is lit. One zone. |
| `tarn360-lux` | The reference prototype's cooler: 360 radiator, three lit ring fans, lit pump ring. Four zones. |

Tubes are flexible. Their path depends on where the radiator is mounted, so route them per mount with smooth curves that never pass through another part. Air coolers show thermal paste only in the Inspector underside view, as a clean contact plate.

## Memory

All Calyra. A kit installs as two or four identical sticks.

| Line | Look |
| --- | --- |
| Facet (`facet32`, `facet64`, `facet64x4`) | Faceted graphite aluminum spreader with a notched top line and a full length frosted light bar. One zone per stick. |
| Mono (`mono16`, `mono32`) | Low, plain spreader in satin black. No light. The one that fits under low coolers. |
| Crown (`crown96`) | Tall white spreader with a taller diffuser crown. One zone per stick. Too tall for some coolers. |

Every stick has: the circuit board edge with gold contacts, the notch, a printed label with capacity, and latch cutouts. The Facet kits differ from each other only by the label and the stick count.

## Graphics cards

Veltrin cards are aerodynamic and chamfered. Dravik cards are flat slabs with hard right angles. Each card must be recognizable in silhouette alone.

| Id | What it is |
| --- | --- |
| `apex3x` | The reference prototype's card. Long chamfered shroud, three fans, brushed backplate with slanted vents and a cutout, a slim light bar and a lit wordmark on the edge facing the glass. Two zones. |
| `apex2x` | The shorter two fan sibling of the Apex 3X. One zone, the edge bar. |
| `mini` | Compact, two small fans, no lighting, plain backplate. The small case's easy fit. |
| `crest` | The Veltrin flagship. The thickest and longest card in the roster. Three large fans, edge bar, lit wordmark and a lit ring inlay on the backplate. Three zones. Ships with a support for its far end, which is there whenever the card is installed: a small post standing on the shroud or the floor in the five enclosed cases, and a short arm from the backplate in the Gantry. |
| `monolith` | Dravik slab. Flat faces, a deep fin stack left exposed through a long side window, a block wordmark, three thin light seams. Three zones. |
| `monolith-s` | The two fan slab with one seam. One zone. |
| `halide` | The white Dravik. Three fans, flat white slab faces with crisp edges, a pale silver fin stack showing through the side window, two thin light seams. Two zones. |
| `strata` | Single fan, short, unlit, industrial. The lowest draw card. |

Every card has: a circuit board visible at the edges, a fin stack with real fins, heat pipes where the design exposes them, fans with correctly shaped blades and a hub sticker, a backplate, the slot bracket with video ports, the gold edge connector, and power sockets matching `plugs` in the catalog. Fans face down in a tower, so the backplate and the edge facing the glass are the hero surfaces, but the fan side must be finished too because the Inspector and the open frame show it.

## Storage

All Pellam, one of each type. `arrow` is an M.2 stick: a bare board with chips and a label. Installed, it sits under the board's heatsink plate, which lifts for it and closes over it. `flint` is a 2.5 inch drive: a brushed lid with a grid label and a colored corner tab. `vault` is a 3.5 inch drive: a cast body, a top cover with a label, and a circuit board underneath. Drives go where the case puts its bays. Where a bay is hidden, the install motion still shows the drive going in.

## Power supplies

All Thessic. A steel box with a honeycomb grille over a visible fan, a side label with a large capacity number, a panel of modular sockets on the inner end, and a rocker switch and inlet on the rear face. The four ATX models differ by label, length and, for `t1200`, the white finish. `sf750` is the small one for the Cub. In most cases the supply is under a shroud and seen through its vents and from the rear. In the Gantry it is fully exposed.

## Fans

Five styles. Every fan mount in every case takes any style, at the mount's size, so each style must be generated at both 120 and 140.

| Id | Look |
| --- | --- |
| `gale` | Kestrane. Black frame, nine swept blades, rubber corner pads. Unlit. |
| `gale-lux` | Kestrane. The reference prototype's fan: smoked translucent blades inside a lit ring. One zone. |
| `aureole` | Kestrane. A lit ring set into the frame and a second lit ring around the hub. Two zones. |
| `petal` | Lumenfold. White frame, seven broad frosted blades that glow evenly from the hub. One zone. |
| `frame` | Lumenfold in graphite. Light runs along the edges of the square frame instead of a ring. One zone. |

Every fan has: a frame with two flanges and a round duct, four corner holes with pads, a rotor with curved, twisted blades, a hub with a sticker, four struts and a motor base on the back, and a short cable.

## Cables

Six Wyrmglass colorways in `cables`. Each has one or two sleeve `colors` and a `comb` color. The colorway applies to the three sleeved power runs: the 24 pin board cable, the processor power cable, and the graphics power cables. Two color sets alternate wires in a pattern you choose and keep consistent. Drive and fan leads stay thin and black.

Cables are individually sleeved wires held by combs. They appear when both ends exist: a supply and the part it feeds. `kit/04-WORLD.md` covers routing.

## Preset builds

Six builds in `presets`, one per case. They are the gallery on the start overlay, the fixtures for the engine, and the subjects of most screenshots. `night-rig` is the hero and matches the reference prototype. Each preset's `blurb` is its card copy. Do not change a preset's parts. They are balanced so that each one is valid, powers on with no warnings above info level, and exercises a different part of the roster.
