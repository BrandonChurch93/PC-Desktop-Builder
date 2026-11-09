PHASE 1 IN PROGRESS · step 1

<!-- Builder: this file is your memory. Read it first in every session and after every compaction. Keep it current. Replace the first line as you go: "PHASE N IN PROGRESS · step k", "BLOCKED: ...", and at the very end "BUILD COMPLETE" with nothing else on that line. -->

# Progress

## Where things stand

- Current phase: 1 · Engine
- Current step: 1 · src/data/catalog.ts
- Next action: write catalog types, then the engine modules under src/engine/, then unit tests against kit/data/fixtures.json
- Uncommitted work: none beyond the phase 0 commit

## Phases

| Phase | Name | Status | Gate evidence | Commit |
| --- | --- | --- | --- | --- |
| 0 | Setup | done | see Gate 0 evidence below | phase 0: setup |
| 1 | Engine | in progress | | |
| 2 | World foundation and the hero slice | not started | | |
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

- Pinned versions installed exactly as kit/06-ARCHITECTURE.md lists, read from node_modules/*/package.json.
- Headless Chromium on this Mac reports a hardware ANGLE Metal renderer, so performance numbers measured here are valid.

## Decisions made by the Builder

One line each: the question, what you chose, which step of the decision rule settled it.

- Branch name: renamed the default branch to main after git init. Consistency with common practice (step 5).

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

## Spend

None. This build uses no paid service and no API.

## QA results

One line per item in kit/09-QA-GAUNTLET.md: `id · PASS · evidence`.

## Feature coverage

One line per feature id in kit/01-PRODUCT.md: `F01 · where it is tested or shown`.

## Session log

Newest first. One entry per working session or per compaction: what was done, what is next.

- 2026-11-08 session 1: read the whole kit, Phase 0 done (env, git, starter, install, four checks, harness on the reference, reference notes, empty shot check). Next: Phase 1 engine.

## Handoff

Written in Phase 10: what was built, every weak shot by name and path, what else is weaker than the rest, the measured numbers, what to look at first in review.
