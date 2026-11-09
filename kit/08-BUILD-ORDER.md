# 08 · Build order

Eleven phases, 0 to 10. Work them in order. There are no planned stops. The only stop is `BUILD COMPLETE` at the end of Phase 10.

How every phase works:

1. Read the phase's "Read first" files from disk, even if you read them before.
2. Do the steps in order. Update `kit/PROGRESS.md` after each step.
3. Run the gate. Every line of a gate needs evidence written in PROGRESS: a command and its result, a test count, or the `check:shots` command with the line it printed.
4. Commit with a message that starts with `phase N:`.
5. Mark the phase done in the PROGRESS phase table and start the next.

A gate that fails sends you back into the phase. Never skip a gate line, never mark a line passed without the evidence, and never move a gate line to a later phase.

Visual work always goes through the loop and the critic in `kit/07-QUALITY-BAR.md`. When a gate says "shots pass", it gives a command of the form `npm run check:shots -- <names>`. The line passes when that command exits with no problems. Nothing else counts as a pass for a shot. The check only accepts images taken from the current build, so at a gate first run `npm run shots -- <the same names>`, then the check. Images that did not change come back as `same` and keep their pass. Images that changed need a new verdict.

Add each phase's shots to `scripts/shot-list.mjs` as you reach them. Their names are fixed by `scripts/shot-rules.mjs` and listed in the Shots table of `kit/07-QUALITY-BAR.md`. A gate's check names the shots by prefix and requires every required shot under that prefix to be defined and done.

You may give a subagent a self contained piece of building work (one category's generator, one dialog) only if you give it the paths of `CLAUDE.md` and the kit files it needs, and you then put its work through the same loop and gates yourself. You stay responsible for every gate.

**Every session on macOS** starts by keeping the machine awake: run `caffeinate -dims -t 172800` as a background command and note its background task id in PROGRESS under Environment. A new session cannot see the last session's background tasks, so start a new one each time. The `-t` makes an old one end by itself. Never look for it or stop it with `pgrep`, `pkill` or `killall`.

---

## Phase 0 · Setup

**Read first:** `CLAUDE.md`, every file in `kit/` from `00` to `09`, `kit/reference/night-rig/README.md`.

**Steps**

1. Record in PROGRESS under Environment: the output of `node -v`, `npm -v` and `git --version`, the operating system and version, and the date. Node must be 22 or newer. If it is older, or git does not run, that is a true blocker.
2. On macOS, start `caffeinate` as described above. Skip this on other systems.
3. Run `git init` if this is not yet a repository. If a commit fails for lack of an identity, run `git config user.name "Desktop PC Builder"` and `git config user.email "builder@localhost"` (repository local, never global). Commit the kit as delivered with the message `phase 0: kit as delivered`. Run `git ls-files kit/reference/night-rig/shots` and confirm it lists the 13 reference images.
4. Copy the files in `kit/starter/` to the repository root, keeping relative paths: `cp -R kit/starter/. .` Then run `npm install`, then `npx playwright install chromium`.
5. Run `mkdir -p src/data`, then `cp kit/data/catalog.json src/data/catalog.json`.
6. Run `npm run typecheck`, `npm run build`, `npm run test` and `npm run e2e`. All four must pass on the starter.
7. Prove the harness on this machine. Run `node scripts/free-port.mjs` and note the port it prints. Start the reference prototype's server on that port as a background command: `node kit/reference/night-rig/serve.mjs <port>`. Note its background task id. Run `node scripts/shots.mjs --url "http://127.0.0.1:<port>/index.html?t=3.2&ui=0" --out shots/setup/reference-hero.jpg`. The harness prints the renderer line. Record it in PROGRESS: the string, hardware or software, headed or headless. On a software renderer the page can take a few minutes to draw. That is expected. Stop the server with the background task controls.
8. Open `shots/setup/reference-hero.jpg` and every image in `kit/reference/night-rig/shots/` with the Read tool. Write a short note in PROGRESS under "Reference notes": what the floor looks like and the weak points you will beat.
9. Prove the ledger tools: run `npm run check:shots`. With the empty shot table it must list every required shot as not defined and exit non zero. That is the expected result at this point. Read the comments at the top of the five scripts under `scripts/` that deal with shots.
10. Fill in the rest of the PROGRESS header.

**Gate 0**

- `npm install` finished and `node_modules` holds the pinned versions of `three`, `gsap`, `vite`, `react` and `typescript`
- Typecheck, build, the starter unit tests and the starter end to end test pass
- Chromium for Playwright is installed
- `shots/setup/reference-hero.jpg` exists, was opened, and shows the reference rig
- The renderer line is recorded
- The reference shots were all opened and the note is written
- `git ls-files kit/reference/night-rig/shots` lists 13 files

---

## Phase 1 · Engine

**Read first:** `kit/03-RULES.md`, the field table in `kit/02-PARTS.md`, the State section of `kit/06-ARCHITECTURE.md`, "The RGB engine" in `kit/04-WORLD.md`, `kit/data/catalog.json`, `kit/data/fixtures.json`, `kit/data/reference/rules.mjs`.

**Steps**

1. Write `src/data/catalog.ts`: types for every catalog section and lookup tables by id.
2. Write the engine under `src/engine/`: rules (`check`, `install`, `remove`, `revalidate`), `sheet`, `temps`, the share codec, lighting sanitation, the LED color function for all eight effects, and `messages`.
3. Write unit tests:
   - The catalog copy is identical to the kit's. The starter has this test. Keep it.
   - Every entry in `fixtures.presets`: the build revalidates unchanged, and `sheet`, `temps` at loads 0, 0.5 and 1, the share code, the taken fan mounts and the graphics clearance all equal the fixture.
   - Every entry in `fixtures.checks`: running its action on its build gives the same `ok`, `code` and `removed`, and on success the same resulting `sheet` and `cooler`.
   - Every entry in `fixtures.decodes`: the same error, or the same build and `removed`.
   - Properties, with a seeded random generator over at least 500 builds made by random legal installs and removes: `revalidate` of a valid build changes nothing, and `decode(encode(build))` returns the same build.
   - Lighting math: `static` does not change with time, `spectrum` gives every LED the same color, brightness 0 is black, reversing `direction` mirrors `wave` in time, every effect returns finite colors in range.
   - Messages: every code in the tables of `kit/03-RULES.md`, in every variant the tables list, produces a sentence with every placeholder filled and no banned character.
   - The engine imports nothing from `three`, `react` or the DOM: a test that scans the imports under `src/engine/`.
4. Write `scripts/check-copy.mjs`. It scans every text file under `src/` and `public/`, plus `index.html`. It fails on any of these:
   - an em dash (U+2014) anywhere
   - `#000000`, `#ffffff`, `#000` or `#fff` as a whole color value, in any case, in a `.css` file or a style value. The `lighting` section of `src/data/catalog.json` is exempt because its stops are light, not surfaces
   - a real hardware maker's name as a whole word, from a list you compile and keep in the script: at least 40 makers across cases, boards, processors, graphics, memory, storage, power and cooling. The catalog's own names are cleared. If your list flags a catalog name, the list entry is wrong for this purpose. Remove the entry and log it
   - the name of an AI product or company, from a second list you compile, and the word AI as a whole word anywhere except the About copy
   - the literal product name anywhere except `src/data/catalog.json`, `index.html` and files under `tests/`

**Gate 1**

- All unit tests pass. Log the count.
- Typecheck is clean
- `npm run check:copy` passes

---

## Phase 2 · World foundation and the hero slice

This phase builds one complete vertical slice: the Night Rig preset in the Vitrine case, rendered better than the reference. Everything later reuses what is built here, so this is where the bar gets set.

**Read first:** `kit/04-WORLD.md`, `kit/07-QUALITY-BAR.md`, the Vitrine and Night Rig rows of `kit/02-PARTS.md`, `kit/reference/night-rig/README.md`, the reference source files `main.js`, `parts.js`, `materials.js`, `textures.js` and `rgb.js`, and the hook and harness sections of `kit/06-ARCHITECTURE.md`.

**Steps**

1. The `World` class: renderer, the post chain exactly as structured in `kit/04-WORLD.md`, the room, the lights, the camera with orbit, named views and the view offset, the render on demand loop. Quality High only for now.
2. The world kit: materials, textures, geometry helpers.
3. The RGB engine: zones, LED textures, lamps, all eight effects, the power level.
4. The layout for the Vitrine and for an ATX board, and `place()`.
5. Generators for the ten Night Rig parts: the `vitrine` case in `onyx`, the `z7` board, the `ember8` processor, the `tarn360-lux` cooler, `facet32` memory, the `apex3x` card, the `arrow` and `vault` drives, the `t850` supply and `gale-lux` fans. Then its cables in `orchid`.
6. The Inspector scene, enough to shoot parts.
7. The test hook, and the shots this phase needs in `scripts/shot-list.mjs`. Until the interface exists, the app can load the Night Rig preset directly.
8. Run the loop on: the five `rig/night-rig-*` shots, `bench/night-rig`, the eight `macro/night-rig-*` shots, the `front`, `back` and `detail` shots of the ten parts above, and the eight `light/effect-*` shots. For the five rig views and the `gpu`, `cooler`, `ram`, `board`, `fan` and `cable` macros, `scripts/critic-list.mjs` adds the matching reference shot to the critic's line, and the check only accepts a pass that carries it.

**Gate 2**

- Shots pass: `npm run check:shots -- rig/night-rig bench/night-rig macro/night-rig light/effect`
- Shots pass: `npm run check:shots -- part/case-vitrine-front part/case-vitrine-back part/case-vitrine-detail part/board-z7- part/cpu-ember8- part/cooler-tarn360-lux- part/ram-facet32- part/gpu-apex3x- part/storage-arrow- part/storage-vault- part/psu-t850- part/fan-gale-lux-`
- Unit tests for layout items 3 to 7 of `kit/04-WORLD.md` pass for the Vitrine
- Weak points 1 to 10, 12 and 13 in the reference README are each addressed. Say how, one line each, in PROGRESS. Point 11 is the interface and belongs to Gate 5.
- Taking `rig/night-rig-hero` twice in a row prints `same` the second time
- If the renderer is hardware: `__pcb.stats(5)` on the lit Night Rig hero view at 1440 × 900 is logged

---

## Phase 3 · The roster

**Read first:** `kit/02-PARTS.md`, `kit/07-QUALITY-BAR.md`, the Materials, Geometry toolkit and Part generators sections of `kit/04-WORLD.md`.

**Steps**

Build every remaining generator, one category at a time, in this order. Put each part through the loop and a critic in the Inspector before starting the next category. Commit after each category.

1. Fans: the other four styles, and all five at 140 mm
2. Memory: the other five kits, which adds the Mono and Crown lines and the four stick kit
3. Coolers: the other seven
4. Graphics cards: the other seven
5. Boards: the other five, with layouts for micro ATX and ITX
6. Processor: `tidal16`
7. Storage: `flint`
8. Supplies: the other four
9. Cables: all six colorways and all three plug types

Then write `scripts/thumbs.mjs` and render thumbnails for every part built so far. Write the `bounds` hook call and the end to end test for item B8 of the gauntlet.

**Gate 3**

- Shots pass: `npm run check:shots -- part/board part/cpu part/cooler part/ram part/gpu part/storage part/psu part/fan cable`. That is 43 parts and 129 part shots, plus the 6 cable shots.
- A unit test confirms every catalog part that is not a case has a generator, and a thumbnail file exists for each
- Item B8 passes for every part that is not a case
- Parts of one brand look like a family and parts of different brands do not, judged from contact sheets as described under "Brand families" in `kit/07-QUALITY-BAR.md`. Nine sheets are due here: `npm run check:shots -- contact/korrin contact/kestrane contact/lumenfold contact/calyra contact/veltrin contact/dravik contact/pellam contact/thessic contact/processors`

---

## Phase 4 · Cases and layouts

**Read first:** the Cases and Preset builds sections of `kit/02-PARTS.md`, the Layout, Cables and Lighting sections of `kit/04-WORLD.md`, the Fill order section of `kit/03-RULES.md`, `kit/07-QUALITY-BAR.md`.

**Steps**

For each case in this order: `vitrine` in `frost`, then `atrium`, `vent`, `bulwark`, `cub`, `gantry`.

1. Design the layout so the catalog's limits are true in the model. Write its layout data: board anchor, supply bay, bays, fan mounts, radiator mounts, glass, interior, cable waypoints.
2. Model the case in both finishes.
3. Assemble its preset build. Route its cables. Tune the softboxes and lamps for it.
4. Run the loop and a critic on its `rig`, `bench`, `finish`, `macro` and case `part` shots.
5. Commit.

Then write the layout tests over generated builds, as described in `kit/09-QA-GAUNTLET.md`, and make them pass for all six cases. Render the case thumbnails.

**Gate 4**

- The layout tests pass for all six cases. Log how many builds were generated per case.
- Shots pass: `npm run check:shots -- rig bench finish macro part`. Those are whole groups, so the counts are checked too: 30, 6, 6, 28 and 153.
- Item B8 passes for the six cases
- The three case brand contact sheets pass: `npm run check:shots -- contact/mirevale contact/skarn contact/paleforge`
- Every catalog part now has a generator and every thumbnail exists, including one per case finish

---

## Phase 5 · Interface and the build flow

**Read first:** `kit/05-DESIGN.md`, `kit/01-PRODUCT.md`, the sections "What the interface asks the engine", "Messages", "Browser storage" and "Undo" of `kit/03-RULES.md`, the State, test hook and end to end sections of `kit/06-ARCHITECTURE.md`.

**Steps**

1. Tokens, global styles, fonts.
2. The store: build actions through the engine, history, the cascade record, autosave and restore.
3. Every component in `kit/05-DESIGN.md`.
4. The tray with thumbnails, fit status and the warning preview. The Spec panel and the full spec sheet with Remove buttons. The cascade notice with Undo. Undo and redo.
5. Installing by keyboard and by tap into the first valid place, case finishes, storage steppers, fan fill and clear, cable swatches, the build name. The world shows each change at once, with a crossfade. Choreography comes in Phase 6.
6. The empty bench, the start overlay, Settings and About.
7. The three layouts: desktop, tablet and phone with its bottom sheet. The view offset follows the panels.
8. The live region, focus order, focus rings, dialog focus traps.
9. End to end tests for this phase.

**Gate 5**

- End to end: starting from an empty bench and using only the keyboard, build the Night Rig preset part by part, including its four fans, its two drives, its cable colorway and its name, "Night Rig". Install the cooler before the fans so the fourth fan lands on the rear mount. The resulting share code equals the fixture's `encoded` value and the spec panel shows the fixture's numbers.
- End to end: the same on a phone viewport with touch taps.
- End to end: a case swap that removes parts shows the notice with the right lines, and Undo restores the build.
- End to end: reload restores the build. With storage blocked the app still works.
- End to end: a tap on a card whose part has one possible place installs it at once, and a tap on a fan card with several free mounts shows the sockets first (item C20)
- Weak point 11 in the reference README is addressed. Say how in PROGRESS.
- Shots pass: `npm run check:shots -- ui-desktop/02 ui-desktop/03 ui-desktop/06 ui-desktop/08`, plus the same command with the names of your tablet build mode and spec sheet shots in both orientations, and your phone empty bench, three sheet stops and specs tab shots
- All earlier tests still pass

---

## Phase 6 · Hands

**Read first:** the Camera, "Modes in the scene", "Sockets, picking and dragging" and Choreography sections of `kit/04-WORLD.md`, the Components and Motion sections of `kit/05-DESIGN.md`, the motion checklist in `kit/07-QUALITY-BAR.md`, "End to end tests" in `kit/06-ARCHITECTURE.md`.

**Steps**

1. Picking, hover and selection outlines, the selection menu.
2. Dragging from the tray with a mouse and with touch: the held part, sockets, snapping, the blocked state and its reason label, the drop, the return.
3. Tap a card, then tap a socket. Keyboard placing with arrow keys between sockets.
4. Removing by dragging a part out. Swap from the selection menu.
5. Choreography for install, remove and swap in every category, the cascade, and the glass lifting away while a part is held or moving and returning after.
6. Focus on a part by double tap, and the reset.
7. The `hold`, `select`, `scrub`, `camera` and `pose` hook calls.

**Gate 6**

- End to end with real mouse events: drag a graphics card from the tray to its socket and it installs. Drag a card that is too long over its socket and the reason shows and nothing installs. Drag an installed part out and it is removed.
- End to end with raw touch events on a phone viewport, sent through a CDP session: long press, drag and drop installs a part. A short swipe on the card row scrolls it and installs nothing.
- End to end: every category can be installed by drag, by tap and by keyboard
- End to end: focus and reset of the camera, and the zoom caps (item C21). Remove and swap play their motion in every category, and none with reduced motion (item C23)
- Shots pass: `npm run check:shots -- motion/install drag ui-desktop/04 ui-desktop/05`, plus the names of your tablet and phone drag shots. `motion/install` is the 35 frames of the seven install sequences.

---

## Phase 7 · Light and life

**Read first:** "The RGB engine", "Modes in the scene" and the power sequences in Choreography in `kit/04-WORLD.md`, "The panels" and the Load readout rows in `kit/05-DESIGN.md`, "Lighting sanitation" and "Simulated temperatures" in `kit/03-RULES.md`.

**Steps**

1. The full Lighting panel: effects, gradient editor, color picker, speed, brightness, direction, the nine presets, saved profiles, targets with overrides and off.
2. Power on and power off. The Power control and its reasons. Fans at speed.
3. The load readout with its Load slider, simulated temperatures, the Thermal effect. It shows whenever the power is on, in Build mode too.
4. The airflow view.
5. The `--rig-glow` property.
6. Tune lamps and exposure for each preset's lighting so every preset passes lit.
7. The `zones` hook call.

**Gate 7**

- Shots pass: `npm run check:shots -- light mode/airflow motion/power-on ui-desktop/09 ui-desktop/10-power ui-desktop/11`, plus the name of your phone lighting tab shot. `ui-desktop/10-showcase` waits for Phase 8.
- End to end: changing each lighting control changes the build's share code as expected and survives a reload. An override on one target changes only that target's zones, checked with `__pcb.zones()`.
- End to end: Power is disabled with the right reason on an incomplete build and on a build over its supply, and works on each preset
- Lighting changed under the rig shots, so retake them: `npm run shots -- rig bench finish macro cable`. Then `npm run check:shots -- rig bench finish macro cable` passes again.

---

## Phase 8 · Modes and keeping

**Read first:** "The experience, start to finish" in `kit/01-PRODUCT.md`, "Fixed copy", "The poster" and "Screens and states" in `kit/05-DESIGN.md`, "Share links" and "Browser storage" in `kit/03-RULES.md`, "Modes in the scene" and Camera in `kit/04-WORLD.md`.

**Steps**

1. Showcase with the tour. Exploded with labels.
2. The Inspector, finished: orbit, zoom, specs, install and remove. Re-render all thumbnails from it.
3. The intro and the finished start overlay.
4. Saved builds. The Share dialog. The landing for a shared link, including dropped parts and bad links. The `link` hook call.
5. Poster export in both formats.
6. Write `README.md` at the repository root as described in `kit/06-ARCHITECTURE.md`. Check `vercel.json`.

**Gate 8**

- Shots pass: `npm run check:shots -- mode motion ui-desktop ui-tablet ui-phone`. Whole groups: 10, 50, 20, 10 and 13.
- End to end: copy the link for each preset, open it in a fresh context, and the build's share code equals the fixture's
- End to end: a bad link and a newer version link each show their message and offer the empty bench
- End to end: export a poster in each format and the files have the stated pixel sizes
- End to end: save, rename, load and delete a build, and saving at the limit asks before replacing

---

## Phase 9 · Tiers, performance, access, hardening

**Read first:** "Quality tiers" and "Performance rules" in `kit/04-WORLD.md`, Accessibility in `kit/05-DESIGN.md`, `kit/09-QA-GAUNTLET.md`.

**Steps**

1. The Medium and Low tiers and the automatic choice, written as a pure function with unit tests. The `tier` hook call.
2. Idle rendering, tab hidden pause, disposal, caches. Measure and log draw calls, triangles and frame times.
3. A full keyboard pass and a reduced motion pass.
4. Failure states: no WebGL 2 shows a plain message with a still image of the Night Rig and no errors. A lost context recovers or shows the same message. A storage error never breaks the app.
5. Other engines: run `npx playwright install webkit firefox`, tag the smoke flows with `@smoke`, then run `npm run e2e:smoke`.

**Gate 9**

- Shots pass: `npm run check:shots -- tier`
- Items A9 and C22 pass: the automatic tier's unit tests, and each forced tier taking effect
- Section P of `kit/09-QA-GAUNTLET.md` passes, with the software renderer rule written there
- `npm run e2e:smoke` passes in WebKit and Firefox
- The keyboard only and reduced motion flows pass

---

## Phase 10 · Final pass

**Read first:** `kit/07-QUALITY-BAR.md`, `kit/09-QA-GAUNTLET.md`, all of `kit/PROGRESS.md`.

**Steps**

1. Retake every shot from the final build: `npm run shots`. Images that did not change come back as `same` and keep their verdicts. Rebuild the twelve contact sheets from the final part shots.
2. Run `npm run check:shots`. For every shot or sheet it lists: open it, record your own verdict, fix what fails, retake, and send it to a new critic. Repeat until `npm run check:shots` exits with no problems. The weak shot rule in `kit/07-QUALITY-BAR.md` is the only exception and the check enforces it.
3. Run every item in `kit/09-QA-GAUNTLET.md` and record each result. If a fix changes any source file, the check will say the shots are no longer from the current build: go back to step 1.
4. Write the "Handoff" section of PROGRESS: what was built, every decision you made, every weak shot by name, anything else you know is weaker than the rest, the measured numbers, and what you would ask the Partner and Brandon to look at first.
5. Stop the `caffeinate` you started in this session with the background task controls.
6. The last edit and the last commit. In one edit of `kit/PROGRESS.md`: write the Gate 10 evidence, mark Phase 10 done in the phase table, and replace the first line with `BUILD COMPLETE`. Then run `git add -A` and `git commit -m "BUILD COMPLETE"`.
7. Run `git status --porcelain`. It must print nothing. Do not log this result anywhere, because logging it would change a file. Then stop.

**Gate 10**

- Every item in `kit/09-QA-GAUNTLET.md` is recorded as passed
- `npm run check:shots` exits with no problems, run after the last change to any source file
- After step 6, `git status --porcelain` prints nothing and the last commit is the `BUILD COMPLETE` commit. This line is checked in step 7 and is the one gate line with no written evidence
