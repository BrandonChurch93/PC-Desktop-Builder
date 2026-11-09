# 07 · Quality bar

Read this file before any design decision and before judging any screenshot. Re-read it at the start of every phase. It defines what good means here, how you prove it, and how you decide when the kit is silent.

Critics read this file too. Everything a critic needs to judge a shot is in here and in `kit/02-PARTS.md`.

## The standard

Brandon's words for this project were "hyper realistic" parts with "fine details" you can "completely zoom in on". He also said that matching the quality of his earlier watch project would make him happy. That project was a single hero object. This one is 49 parts in 6 cases, and the same quality has to hold on every one of them.

What that means here: the level of a top-tier real-time product configurator. Every part has real geometry, real materials and real light. Someone who builds PCs should be able to zoom in to the closest view the camera allows on any part, in any case, and nod.

It does not mean indistinguishable from a photograph. That takes scanned assets and offline rendering. Do not chase that with tricks. Chase form, material and light.

You will want to pass your own work. Assume your first verdict is too kind. Look for reasons to fail a shot, not reasons to pass it.

## The floor

`kit/reference/night-rig/` is a working prototype of the Night Rig preset in the Vitrine case, written at planning time, with screenshots in its `shots/` folder. It is the floor. Everything you ship must be clearly better than it. Its `README.md` lists its weak points. Those are the first things to beat.

| Reference shot | Shows |
| --- | --- |
| `shots/hero.jpg` | The rig, three quarter view, lit, glass on |
| `shots/side.jpg`, `front.jpg`, `top.jpg`, `rear.jpg` | The same from the other sides |
| `shots/gpu.jpg`, `pump.jpg`, `ram.jpg`, `board.jpg`, `cable.jpg`, `fan.jpg` | Close views of parts |
| `shots/exploded.jpg` | The exploded view |
| `shots/ui-desktop.jpg` | The Night Rig interface over the scene |

Open every one with the Read tool in Phase 0 and again at the start of Phase 2. Run the prototype itself in Phase 0 and shoot it through the harness so you understand what was done.

## Five tests

Every visual has to pass all five.

1. **Squint.** At thumbnail size the silhouette is clear, the subject separates from the background, and you can tell what it is.
2. **Lean in.** At the closest zoom the camera allows, detail holds: edges catch light, fasteners are there, surfaces have texture, text is sharp.
3. **Material.** Without labels you can tell what each surface is made of: steel, aluminum, plastic, rubber, glass, circuit board, braid.
4. **Light.** Light comes from somewhere. LEDs light what is near them. Shadows and occlusion seat parts against each other and the rig on the desk. Highlights run along edges.
5. **Truth.** Nothing floats, nothing passes through anything, and what you see matches the build's data: counts, sizes, names.

## Detail minimums

`kit/02-PARTS.md` lists what every part in each category has ("Every board has:", "Every card has:", and so on). Those lists are the minimums. A part missing any listed feature is not done.

On top of those, every part:

- uses at least three distinct materials (processors and drives may use two)
- has a bevel or radius on every visible edge
- shows a fastener or a joint wherever one piece attaches to another
- carries at least one printed or engraved mark from the catalog (brand, name, or a spec)
- is finished on its back and underside
- has visible thickness on every sheet, plate, panel and board
- keeps its text sharp at the closest allowed zoom

## Fail list

Any one of these fails the shot. Verdicts cite them by id. The ids start with X so they are never confused with the feature ids in `kit/01-PRODUCT.md`.

**Form**
- X01 Flat box. A part or a major piece of one that is a plain box or cylinder with a texture, where the real thing has form.
- X02 Razor edge. A visible edge with no bevel or radius.
- X03 Paper thin. A sheet, panel, glass or board with no thickness.
- X04 Floating. Something that does not touch what it is attached to, or has no visible fastening.
- X05 Intersection. Parts or cables passing through each other or through a panel.
- X06 Faceting. Visible polygon facets on a round form at an allowed zoom.
- X07 Missing back. An unfinished rear or underside visible from an allowed angle.

**Material**
- X08 Uniform. A surface with no visible variation.
- X09 Wrong read. Metal that reads as plastic, glass that reads as grey plastic, braid that reads as rubber hose.
- X10 Toy. Everything in the frame has the same gloss.
- X11 Bad text. Blurry, jagged, stretched or mirrored text.
- X12 Shimmer. Z fighting, moire on mesh, visible texture seams or tiling.

**Light**
- X13 Glow without light. LEDs that glow but do not light their neighbors.
- X14 Blown out. LED diffusers clipped to white, or haze from bloom flattening the frame.
- X15 Blackout. Parts or the case melting into black so form cannot be read.
- X16 Flare. Pinpoint sparkles or hot pixels.
- X17 Ungrounded. No contact shading. Things look pasted on.
- X18 Hard wall shadow. A hard edged shadow of the case on the wall.

**Camera**
- X19 Covered. The interface overlaps the rig, or the rig is cropped by accident.
- X20 Clipping. The camera cuts through geometry.

**Truth**
- X21 Contradiction. The picture disagrees with the catalog or the build: a fan count, a slot count, a label, a size.
- X22 Real brand. A logo, a name or a signature product shape that belongs to a real company. The catalog's own names are invented and cleared, so a catalog name is never X22.

**Interface**
- X23 Layout. Misalignment, uneven spacing, clipped or overflowing text, overlapping panels.
- X24 Rules. Contrast under 4.5 to 1, pure black or white, an em dash, a fallback font showing.
- X25 Targets. A control under 44 px on touch layouts, or no visible focus ring.
- X26 Placeholder. Any placeholder image, empty thumbnail, sample text or unfinished state.

**Motion** (judged on scrubbed sequences)
- X27 Pop. A part appearing or vanishing with no motion, outside reduced motion.
- X28 Pass through. A part moving through another on its way.
- X29 Wrong end. The last frame of a sequence differs from the installed state.

## Shots

Shots are named, deterministic and repeatable. Each one is defined in `scripts/shot-list.mjs` as `<group>/<name>` and its image is `shots/<group>/<name>.jpg`. Unless a row says otherwise: 1440 × 900, interface hidden, quality High, `freeze(3.2)`.

The names are fixed. `scripts/shot-rules.mjs` builds the exact required names from the catalog, following the Names column below, and the shot check refuses any other name in those groups. In the names, `<preset>`, `<case>`, `<finish>`, `<category>`, `<id>`, `<colorway>` and `<effect>` are catalog ids, and `<category>` is one of `case`, `board`, `cpu`, `cooler`, `ram`, `gpu`, `storage`, `psu`, `fan`. Only the interface groups leave part of the name to you: the text after the fixed start. `npm run check:shots` lists every required name that is still missing.

Two standard states:

- **Lit**: Showcase mode, glass on, power on, load 0.
- **Bench**: Build mode, glass off, power off.

| Group | Shots | Names | Count |
| --- | --- | --- | --- |
| `rig` | Each of the 6 presets, lit, from `hero`, `side`, `front`, `top`, `rear` | `rig/<preset>-<view>` | 30 |
| `bench` | Each preset, bench, `hero` | `bench/<preset>` | 6 |
| `finish` | Each case in its other finish (the one its preset does not use), holding its preset build, lit, `hero` | `finish/<case>-<finish>` | 6 |
| `macro` | Night Rig: `gpu`, `cooler`, `ram`, `board`, `fan`, `cable`, `psu`, `storage`. Each other preset: `gpu`, `cooler`, `cable`, `case-detail` | `macro/<preset>-<subject>` | 28 |
| `part` | Every modeled part in the Inspector at 800 × 800 with its interface hidden, from three angles: `front` three quarter, `back` three quarter, and a close `detail`. Cases are shot in the first finish in their `finishes` list and add one `alt` shot of their second finish at the front angle. Fans are shot at 120 mm | `part/<category>-<id>-<front, back or detail>`, and `part/case-<id>-alt` | 153 |
| `cable` | Night Rig with each of the 6 colorways, `cable` macro | `cable/<colorway>` | 6 |
| `light` | Night Rig lit `hero` with each of the 8 effects on the Aurora colors. Each of the 9 lighting presets. One with the graphics target off and memory on its own profile | `light/effect-<effect>`, `light/preset-<preset>`, `light/override` | 18 |
| `mode` | Exploded view of each preset. Airflow on Night Rig and on Windbreak. Showcase with the load readout at full load, interface shown. The Inspector with its interface shown | `mode/exploded-<preset>`, `mode/airflow-<preset>`, `mode/showcase`, `mode/inspector` | 10 |
| `motion` | These ten sequences scrubbed to 0, 0.25, 0.5, 0.75 and 1: `install-gpu`, `install-ram`, `install-cooler`, `install-nvme`, `install-cpu`, `install-fan`, `install-psu`, `power-on`, `explode`, `intro` | `motion/<sequence>-<000, 025, 050, 075 or 100>` | 50 |
| `drag` | A held card over a valid socket. A held card over a blocked socket with its reason. A held fan with every mount's socket. A held liquid cooler with every radiator mount's socket. Held memory with its slots. Interface shown | `drag/valid`, `drag/blocked`, `drag/fan-mounts`, `drag/radiator-mounts`, `drag/memory-slots` | 5 |
| `tier` | Night Rig lit `hero` on High and on Medium at 1440 × 900, and on Low at 390 × 844 | `tier/high`, `tier/medium`, `tier/low` | 3 |
| `ui-desktop` | Every state listed in `kit/05-DESIGN.md` under "Screens and states", items 1 to 14, interface shown. Items 1 and 10 are two shots each and item 13 is five | `ui-desktop/<two digit item>-<name>`, one per item. The multi shot items are fixed: `01-intro`, `01-start`, `10-power`, `10-showcase`, `13-share`, `13-poster`, `13-saved`, `13-settings`, `13-about` | 20 |
| `ui-tablet` | At 1180 × 820 and 820 × 1180: build mode, a side sheet open, a drag in progress, the full spec sheet, a dialog | `ui-tablet/landscape-<name>` and `ui-tablet/portrait-<name>`, five each | 10 |
| `ui-phone` | At 390 × 844: start overlay, empty bench, build at each of the three sheet stops, specs tab, lighting tab, a drag in progress, the Inspector, the full spec sheet, Showcase. At 844 × 390: build mode and Showcase | `ui-phone/<name>` for the eleven, `ui-phone/landscape-<name>` for the two | 13 |

That is 358 shots. `scripts/shot-rules.mjs` holds the same counts and names and the shot check enforces them. Do not change that file.

The harness and the shot check take name prefixes. `npm run shots -- rig/night-rig` takes the five Night Rig shots. `npm run check:shots -- rig/night-rig` requires all five to be defined and done, not just the ones you have. `npm run check:shots -- part/gpu` checks every graphics card shot. A bare group name also checks the group's count. Never type `*` in a shot name on a command line.

### How to read each group

Some shots show a state on purpose that would be a fault anywhere else. This table says what each group is for, so that a verdict does not fail a shot for doing its job. Everything not listed here applies in full.

| Group or shot | What it shows on purpose |
| --- | --- |
| `bench` | Power off. LEDs are dark and unlit diffusers are fine. X13 and X14 do not apply. The room is lit by the softboxes only and X15 still applies. |
| `light/preset-blackout` | The Blackout preset has brightness 0. Dark diffusers are correct. X15 still applies. |
| `mode/exploded-*`, `motion/explode-*` | Parts separated in space with labels. A part apart from its neighbors is not X04. Cables and tubes are hidden in this view. |
| `mode/airflow-*` | Dashes of air in the chamber are the feature, not floating objects. |
| `motion/install-*` | Frames 000 to 075 show a part before and during its travel, so a part in the air is not X04. The glass is lifted away while the part moves. Judge the path, the securing action and X27 to X29. Frame 100 is the installed state and is judged in full. |
| `motion/power-on-*`, `motion/intro-*` | Light and fans coming up over time. Early frames are dark by design. X15 applies to frame 100 only. |
| `drag` | A held part shown as a lifted preview, and sockets drawn as outlines. Neither is X04. The glass is lifted away. |
| `part` | One part alone on the Inspector turntable. It is not attached to anything, so X04 applies only within the part itself. |
| `ui-*` shots where a dialog, a sheet, the start overlay or the Inspector is open | The surface covers the rig by design. X19 does not apply to that surface. It still applies to everything else in the frame. |
| `tier/low` | The phone tier at phone size: no desk mirror, lighter occlusion, lower texture resolution. Judge it as a phone frame. It must still pass the five tests at this size. |
| `ui-phone`, `ui-tablet` | Small frames. Judge the rig for squint, light and truth, and the interface in full. |

## The loop

This is how every visual is made. There is no cap on rounds.

1. Build or change the thing.
2. Take its shots: `npm run shots -- <names or prefixes>`. Each line the harness prints starts with `shot:` for a new image or `same:` for an image that did not change.
3. Open each new image with the Read tool. Judging from the code or from memory of an earlier shot does not count.
4. Record your own verdict for each one against the five tests, the detail minimums, the fail list and the checklist that fits:
   `node scripts/verdict.mjs part/gpu-apex3x-detail builder FAIL "X02 X13" "bracket edge is sharp and the light bar does not light the backplate"`
   or `node scripts/verdict.mjs part/gpu-apex3x-detail builder PASS - "five tests ok"`.
   For many at once, write one line per shot into a file with the Write tool, in the form `<shot> | PASS or FAIL | <fail ids or -> | <one sentence>`, and run `node scripts/verdict.mjs --from <file> --who builder`.
5. Fix every fail. Go to 2.
6. When every shot of the thing passes your own verdict, send them to a critic.
7. The thing is done when `npm run check:shots -- <its names>` exits with no problems.

The shot check accepts a shot only when all of this lines up: the shot has one of the required names, the image on disk was taken, or confirmed as `same`, from the build that is in `dist/` now, a critic passed exactly that image, and the critic's answer is saved under `kit/critics/`. If you changed any source file after taking a shot, the check tells you to run the shots again first. Unchanged images come back as `same` and keep their pass.

If the same shot fails four rounds, stop adjusting numbers. Look up how the real object is built and looks, write down what you learned in PROGRESS, and rebuild the approach.

PROGRESS holds no per shot verdicts. At each gate, write one line per group there: the `check:shots` command you ran and the line it printed.

## The critic

You are lenient about your own work. A critic is a fresh subagent that has not seen the work being made and is told to find reasons to fail it.

**Running one**

1. List what needs a critic: `node scripts/critic-list.mjs <names or prefixes>`. It prints one line per image whose current version no critic has judged, in batches of at most 12, and ends with the next critic number. Each line holds the image path, the image's hash as `sha:`, and for the Night Rig views and macros the reference shot as `reference:`.
2. Start one critic per batch with the Agent tool, using the agent type `critic`. Set `run_in_background` to false when the tool offers it. That agent ships in `.claude/agents/critic.md`, starts with an empty context, and can only read files. Its prompt is one batch of lines, exactly as printed, and nothing else. Do not explain what you did or what you think of it.
3. Wait for its report, as `CLAUDE.md` describes. Do not retake any of those shots while a critic is looking at them.
4. Save the report exactly as it came back, with the Write tool, as `kit/critics/<number>.txt`, using the three digit number the list gave you. One file per critic. When the list printed several batches, the first critic takes that number and each further critic takes the next one up.
5. Import it: `node scripts/verdict.mjs --from kit/critics/<number>.txt --who critic --critic <number>`. The script prints how many verdicts it recorded. That must equal the number of lines you sent. It skips a line when the critic did not copy the hash, or when the image changed since. List those images again and send them to a new critic.
6. Run `npm run check:shots -- <names>` and read what is left.

If the Agent tool says there is no agent type `critic`, start a general purpose subagent instead and give it the text of `.claude/agents/critic.md` below its header, followed by the batch. Log that you had to.

The line a critic sends back, which `--from` reads:

`<image path> | sha: <hash> | reference: <path, when one was given> | PASS or FAIL | <fail ids separated by spaces, or -> | <one sentence>`

**Rules**

- Every FAIL is fixed in the product. Then the shot is retaken, which gives it a new hash, and a new critic judges it. Each Agent call is a new critic. Never continue a conversation with an earlier one and never argue with one.
- A verdict belongs to one image. The ledger ties it to the image's hash. When the image changes, its old verdicts stop counting, pass or fail.
- You may not overrule a critic. If a critic is wrong about a fact, for example it misread a catalog number or failed a catalog name as a real brand, check the fact, note it in PROGRESS, and send the same image to one new critic with `node scripts/critic-list.mjs <name> --all`. That is the only case where an unchanged image goes to a second critic. The shot check counts at most two critics per image and takes the later one. A third verdict on the same image makes it fail until the image changes.
- Do not shop for a pass in any other way. Do not crop, relight or reframe a shot to hide a fault. A shot's definition changes only when the definition itself was wrong, and you log why.
- When a later change touches something that already passed (a material used by many parts, the lighting, the post chain), retake every shot it affects. Unchanged images come back as `same` and keep their pass. Changed ones need a new verdict.
- The eleven Night Rig shots that have a reference only pass when the critic's line carries that reference. `critic-list.mjs` adds it for you.

**Brand families.** A critic also judges family resemblance from contact sheets. Assemble each sheet from Inspector shots with a small script and save it as `shots/contact/<name>.jpg`. There are twelve:

- Eight brands with several parts, due at Gate 3: `korrin`, `kestrane`, `lumenfold`, `calyra`, `veltrin`, `dravik`, `pellam`, `thessic`.
- `processors`, due at Gate 3: the two processors side by side, since each of their brands makes only one part. They must not be mistaken for each other.
- Three case brands, due at Gate 4: `mirevale`, `skarn`, `paleforge`.

List them with `node scripts/critic-list.mjs contact`, and put this line above the batch in the critic's prompt: "These are contact sheets. Judge only whether the parts on a sheet look like one family, and whether a sheet could be mistaken for another brand or for a real maker." Save and import the answer like any other. `npm run check:shots -- contact/<name>` checks one sheet and `npm run check:shots -- contact` checks all twelve. When a part on a sheet changes, rebuild the sheet and send it again.

## Weak shots

The loop has no cap, but the run has to end. This is the only way a shot may be left without a pass.

A shot may be listed in `kit/WEAK-SHOTS.json` when all of these are true:

- Critics have failed at least 8 different images of it. For a shot in the `rig` group or the `ui-desktop` group the number is 12.
- The image on disk now is one of those: a critic has judged the current image and failed it.
- You did the research and rebuild step at least twice for it and logged both.

The file is a JSON array of `{ "shot": "<name>", "why": "<the critics' recurring complaint in one sentence>", "tried": ["<the first rebuild>", "<the second rebuild>"] }`. The shot check counts the failed images itself and rejects an entry that does not qualify. A weak shot is not a pass. The check prints how many there are. Name every one in the Handoff section of PROGRESS with its path and what the critics kept saying, so Brandon looks at those first. If a weak shot later passes, take it off the list.

Reaching for this early is a failure of the build. Eight honest rounds on one shot is a great deal of work, and that is the point: it is cheaper to make the thing right.

## Checklists

Use the list that fits the shot. Each line is a question whose answer must be yes.

**A part in the Inspector**
- Does the silhouette alone tell you what it is and which brand family it belongs to?
- Is every feature that `kit/02-PARTS.md` lists for its category present?
- Does it differ from its siblings in the way its row in `kit/02-PARTS.md` says?
- Are the numbers true: fan count, slot count, proportions from its catalog dimensions?
- Do metal, plastic, glass and board each read as themselves?
- At the close angle, are edges beveled, fasteners present and text sharp?
- Is the back as finished as the front?
- If it is lit, is the diffuser colored and not white, and does it light the surfaces beside it?

**A case**
- Is the archetype unmistakable?
- Do panels have thickness at every opening?
- Are the tray, grommets, standoffs, slot wall, supply bay, every fan mount and the feet all there?
- Does the glass read as glass: a border, an edge, a reflection?
- Does the finish look like the real finish and not a tint?

**An assembled rig**
- Does it pass the squint test against the room from this angle?
- Are all installed parts where the layout says, seated, with nothing intersecting?
- Do the cables leave and arrive straight, bend smoothly and touch nothing they should not?
- Does the rig's own light fall on the parts, the case interior, the desk and the wall?
- Is the frame free of haze, flares and blackout?
- Is the rig grounded on the desk with contact shading and a reflection?

**Lighting**
- Does each effect match its definition in `kit/04-WORLD.md`?
- Does a synced effect travel across parts as one?
- Do overrides and off apply to exactly their target?
- Are colors saturated at the diffuser, never clipped?

**An interface screen**
- Is the center of the scene clear?
- Does every value shown come from the engine and match the build?
- Are spacing, alignment and type on the tokens and the type table?
- Are all thumbnails real renders?
- Does the copy follow the voice rules and the fixed strings?
- On touch layouts, is every control at least 44 px and reachable with a thumb?

**A motion sequence**
- Does frame 000 show the start state and frame 100 the installed state exactly?
- Do the middle frames show travel along a path that passes through nothing?
- Does the securing action (latch, screw, clip) show in a middle frame?

## Taste

- **Restraint.** One accent in the interface. Bloom hugs the LEDs. No lens dirt, no chromatic aberration, no film grain, no heavy vignette.
- **Family.** Parts of one brand look related. Parts of different brands do not.
- **Real proportion.** Use the catalog dimensions and the standard sizes. Nothing is scaled to look impressive.
- **Believable surfaces.** Slight variation in roughness everywhere. No dust, scratches or fingerprints.
- **White is white.** Frost parts and cases must look white under this lighting, not grey. Tune the softboxes for the pale presets and check them as carefully as the dark ones.
- **Color.** RGB is saturated and deep. If a diffuser looks pastel or white, lower its intensity until its color returns.
- **Quiet interface.** The scene has the drama. The interface is precise and still.

## The decision rule

When the kit does not say, decide in this order and log the decision in one line under "Decisions made by the Builder".

1. What does the real thing look like, or how do people who build PCs really do it? Look it up.
2. Which option looks more real at the closest zoom?
3. Which option is truer to the build's data?
4. Which option takes more care? Prefer it.
5. Which option is consistent with what is already built?

Never decide by picking what is faster. Never resolve a difficulty by removing a feature, lowering a count, loosening a limit or weakening a gate.

## Done

The product is done when every item in `kit/09-QA-GAUNTLET.md` passes, `npm run check:shots` with no arguments exits with no problems, and you can honestly write: any part, in any case, at any allowed zoom, holds up.
