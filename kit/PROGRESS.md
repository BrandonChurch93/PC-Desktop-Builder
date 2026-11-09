PHASE 2 IN PROGRESS · step 1

<!-- Builder: this file is your memory. Read it first in every session and after every compaction. Keep it current. Replace the first line as you go: "PHASE N IN PROGRESS · step k", "BLOCKED: ...", and at the very end "BUILD COMPLETE" with nothing else on that line. -->

# Progress

## Where things stand

- Current phase: 2 · World foundation and the hero slice
- Current step: 2 to 5 · world kit and generators
- Next action: cooler (pump, radiator, combined), board, Vitrine case, cables; then rig shots and the loop
- Uncommitted work: src/world (World, post, room, env, rig, inspector, kit, light, layout, parts), src/state/store.ts, src/hook.ts, App, styles, scripts/shot-list.mjs, scripts/peek.mjs, layout tests

## Phases

| Phase | Name | Status | Gate evidence | Commit |
| --- | --- | --- | --- | --- |
| 0 | Setup | done | see Gate 0 evidence below | phase 0: setup |
| 1 | Engine | done | 134 unit tests pass, typecheck clean, check:copy 0 problems | phase 1: engine |
| 2 | World foundation and the hero slice | in progress | | |
| 3 | The roster | not started | | |
| 4 | Cases and layouts | not started | | |
| 5 | Interface and the build flow | not started | | |
| 6 | Hands | not started | | |
| 7 | Light and life | not started | | |
| 8 | Modes and keeping | not started | | |
| 9 | Tiers, performance, access, hardening | not started | | |
| 10 | Final pass | not started | | |

### Gate 0 evidence

- npm install: added 61 packages. node_modules versions read from each package.json: three 0.187.0, gsap 3.15.1, vite 8.3.6, react 19.3.1, react-dom 19.3.1, typescript 7.0.2, zustand 5.1.0, vitest 5.1.0, playwright 1.65.0, @types/three 0.187.0
- npm run typecheck: clean. npm run build: built, index js 237.86 kB (73.70 kB gzip). npm run test: 1 file, 2 tests passed. npm run e2e: 1 passed (chromium, the app loads @smoke)
- npx playwright install chromium: done (Playwright 1.65.0)
- shots/setup/reference-hero.jpg: written, hash bdcf8184f35f, opened with Read, shows the reference Night Rig in the Vitrine, three quarter, lit
- Renderer line: `renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version) · hardware · headless`
- All 13 reference shots and the harness shot opened; note under Reference notes
- git ls-files kit/reference/night-rig/shots: 13
- npm run check:shots with the empty table: `shots defined: 0 of 358 · passed: 0 · weak: 0 · contact sheets passed: 0 · problems: 367`, exit 1, as expected

### Gate 1 evidence

- npx vitest run: 6 files, 134 tests passed (fixtures: 6 presets x 6 checks + 1, 59 checks, 10 decodes; properties over 3600 seeded random builds from 120 walks of 30 steps, at least 500 distinct asserted; lighting math 11; messages 8; import scan 2; starter 2)
- npm run typecheck: clean
- npm run check:copy: `check:copy · files scanned: 12 · maker names: 93 · AI names: 27 · problems: 0`. A probe file with an em dash, #FFF, #000000, NVIDIA, Corsair, ChatGPT, the word AI and the product name gave 8 problems and exit 1, then was deleted.

## Environment

- Date started: 2026-11-08
- Operating system: macOS 15.7.4 (24G517), Apple M4 Pro, 24 GB
- Node, npm and git: node v24.22.2, npm 11.19.1, git version 2.49.0
- Harness renderer string: ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)
- Hardware renderer (yes or no), and the launch options that gave it: yes, headless, channel chromium with --ignore-gpu-blocklist --enable-gpu --use-angle=metal (the starter defaults)
- Ports in use (dev, preview): 5311 was free for the reference server in Phase 0. The harness and tests pick the first free port from 5311 by themselves.
- Background tasks started this session (what, task id, stopped or running): caffeinate -dims -t 172800, b5a5crt5r, running. Reference prototype server on 5311, bfw83akih, stopped.
- Disk: 44 GB free at start.
- git identity: the repository uses the existing identity (Brandon Church). The first commit did not fail, so no local identity was set.

## Facts verified at build time

One line each: what you checked, where, what you found.

- ATX 24 pin housing (Molex Mini-Fit Jr 39-01-2240): 51.6 x 15.1 mm, 4.2 mm pitch (RS listing via web search). EPS and PCIe 8 pin use the same 4.2 mm pitch. 12V-2x6 uses 3.0 mm pitch power pins plus four sense pins.
- ATX hole and slot coordinates: the spec figure was not reachable in search results. Used the standard 9.6 x 12 in outline, the 158.75 x 44.45 I/O opening, slot pitch from the catalog, slot 1 at 160 mm below the top edge so an ITX board (170 tall) keeps its x16 slot near its bottom edge, and holes on three columns. Logged as a decision.
- three r187 GTAOPass builds its denoise noise from SimplexNoise with Math.random (GTAOPass.js line 693). Replaced with a seeded noise texture so frames are the same on every load.
- three r187 Object3D.lookAt on lights points them at the target; RectAreaLight lights one side only, so a lamp plane that cuts through a part lights only the part in front of it (found while debugging the inspector).

- Pinned versions installed exactly as kit/06-ARCHITECTURE.md lists, read from node_modules/*/package.json.
- Headless Chromium on this Mac reports a hardware ANGLE Metal renderer, so performance numbers measured here are valid.

## Decisions made by the Builder

One line each: the question, what you chose, which step of the decision rule settled it.

- Branch name: renamed the default branch to main after git init. Consistency with common practice (step 5).
- Engine colors: ledColor returns linear RGB, stops converted from sRGB hex with the exact sRGB curve, gradient blended in linear space as the reference does through THREE.Color. Spectrum and thermal use full saturation HSL values taken as linear, as THREE.setHSL does in r187. Channels are clamped to 0..1 at the end, which only trims the starlight and comet peaks (1.08 and 1.04). Truer to the reference (step 5).
- LED hash: an integer hash of a stable zone key and the LED index instead of the reference sin hash, so it never depends on zone creation order. Same build, same pixels (step 3).
- Decode: only the six light targets are copied from a link before sanitation, and fan entries are defined as own properties, so a __proto__ key can never touch a prototype. Output equals the reference on every fixture (step 3).
- Removed ids that are not strings in a bad link are reported as String(id). The reference keeps the raw value. Only bad links reach this (step 3).
- Card status for fans when every mount is under the radiator: blocked with FAN_MOUNT_TAKEN, The radiator uses this mount. The kit only says fans fit when a free mount exists (step 3).
- RAM_SLOTS with exactly one free slot would read 1 is free. It cannot happen with this catalog (kits are 2 or 4 sticks) (step 4).
- Board layout (atx, matx, itx) shares the top rear corner: socket at 112,-82 (itx 82,-76), DIMMs A1..B2 at x 166..194.5 with 9.5 pitch, x16 slot 1 at y -160 from x 22, M.2 slot 1 between socket and slot 1, the rest between slots. ITX stacks its second M.2 above the first under one two tier heatsink. Real ITX boards do this (step 1).
- Memory height and cooler memory clearance are both measured from the DIMM slot floor (2 mm above the board), so a 44 mm kit under a 45 mm clearance has 1 mm and a 52 mm kit would touch (step 3).
- Card space: the anchor is the bottom of the edge connector at its bracket end; the bracket inner face is 28 mm behind it; the card stands to its catalog height above the board face and its thickness hangs below the slot plane with a 5 mm backplate rise (step 3).
- Vitrine top fan mounts are 134 mm apart on a slotted rail so a 240 radiator on mounts 1 and 2 clears a fan on mount 3; radiator fans keep a fixed 122 mm pitch (step 1: real slotted top rails).
- Vitrine rear fan sits at z 40 beside the board I/O, not over it, so it clears the I/O cover (step 5).
- Inspector studio: no spot shadow (tiny geometry gave acne), no wall wash lamp, soft edged softboxes with a dim horizon band and low front softboxes so vertical metal faces seen from above reflect light, as product studios do (step 1).
- Black materials sit at 2 to 3 percent albedo (sRGB about 0x23 to 0x28), the range of real black plastic and anodizing, so black parts read as dark grey with highlights (step 1).
- Printed text on every part is baked into one atlas per part and one mesh per material group, and static geometry is merged per material, to stay inside the draw call budget (step 4).
- check-copy maker names are matched as whole words with the maker capitalization, so ordinary lowercase words never trip it. The self check removes any entry that matches a catalog name. None did (step 3).

## Dependencies added

One line each: package, version, reason.

- None beyond the starter package.json.

## Reference notes

What the floor looks like, its weak points, and how each was beaten.

- The floor: a dark violet studio with a mirror desk and a back wall with a soft pool. The Vitrine stands glass side to camera, front to the right. Inside: a top 360 radiator with three lit fans, a lit pump ring, a lit rear fan, two lit Facet sticks, the Apex 3X with a cyan to pink edge bar and VELTRIN wordmark, an orchid sleeved 24 pin and one GPU power run dropping to the shroud. Three front fans glow pink through fine round perforation. The shroud is a plain dark slab with a MIREVALE plate and slots.
- Weak points I see beyond the README list: the case reads as a matte black slab with near zero edge highlights; the shroud's right end is a flat purple glowing patch (lamp on a flat face); the glass is invisible, no edge or reflection; the GPU fan side and backplate show no screws; the rear fan carries the text KORRIN Z7, which is a wrong label (truth); the board's I/O cover reads ARC; the M.2 heatsink and chipset are flat blocks; the desk reflection from the side view shows artifacts and a hard horizon; the exploded view has no labels; the GPU power cable is one run of 8 wires dropping straight from the card edge into a flat rectangle on the shroud with no connector; the 24 pin enters from the right as loose loops with no connector housing; the tubes are plain sleeves with simple fittings; no drives, no supply, no processor; the top fans read as dark discs with rings.
- The ui-desktop reference: brand top left, Glass panel and Power chips top center, mode switch and Share top right, Lighting panel left with effect list and sliders, Spec panel right with four stats, tray dock bottom with tabs and four cards whose thumbnails are empty squares (placeholder).

## Shot results

Per shot verdicts live in `kit/VERDICTS.jsonl`, not here. At each gate write one line per `check:shots` command you ran: the command, and the line it printed.

- Critics run so far (the highest number in `kit/critics/`): none
- Weak shots, if any (name, and why): none
- Research and rebuild notes for shots that failed four rounds (shot, what you learned, what you rebuilt):

## Measurements

Draw calls, triangles and frame times per tier, bundle sizes, thumbnail sizes, test counts.

- Phase 1: 134 unit tests.

## Spend

None. This build uses no paid service and no API.

## QA results

One line per item in kit/09-QA-GAUNTLET.md: `id · PASS · evidence`.

## Feature coverage

One line per feature id in kit/01-PRODUCT.md: `F01 · where it is tested or shown`.

## Session log

Newest first. One entry per working session or per compaction: what was done, what is next.

- 2026-11-08 session 1, Phase 2 in progress: pure layout (Vitrine, boards, part boxes, place) with 11 layout tests passing; World, post chain with seeded GTAO noise, room, studio envs, inspector, RGB engine with oriented lamps, store, hook subset, peek tool; generators done: fan, CPU, memory, storage, supply, Veltrin card. Next: cooler, board, case, cables.
- 2026-11-08 session 1, Phase 1: catalog types, engine (rules, sanitize, sheet, codec, lighting, messages, queries), tests, check-copy. Gate 1 passed.
- 2026-11-08 session 1: read the whole kit, Phase 0 done (env, git, starter, install, four checks, harness on the reference, reference notes, empty shot check). Next: Phase 1 engine.

## Handoff

Written in Phase 10: what was built, every weak shot by name and path, what else is weaker than the rest, the measured numbers, what to look at first in review.
