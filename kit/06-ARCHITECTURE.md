# 06 · Architecture

## Stack

A static single page app. No server code, no environment variables, no keys.

| Package | Version | Role |
| --- | --- | --- |
| `vite` | 8.3.6 | Build and dev server |
| `react`, `react-dom` | 19.3.1 | Interface |
| `typescript` | 7.0.2 | Types, strict |
| `three` | 0.187.0 | 3D, vanilla |
| `gsap` | 3.15.1 | Motion |
| `zustand` | 5.1.0 | State |
| `@fontsource-variable/unbounded`, `@fontsource-variable/dm-sans` | 5.3.0 | Fonts, self hosted |
| `vitest` | 5.1.0 | Unit tests |
| `playwright`, `@playwright/test` | 1.65.0 | Screenshot harness and end to end tests |
| `@vitejs/plugin-react` | 6.2.1 | |
| `@types/react`, `@types/react-dom` | 19.3.0 | |
| `@types/three` | 0.187.0 | |
| `@types/node` | 22.20.5 | Types for the config files and tests |

These exact versions were installed together at planning time on Node 22. Typecheck, build, the unit tests, the harness and the shot check all ran with the files in `kit/starter/`. Keep the versions pinned. If one will not install, use the nearest patch release and log it.

You may add small dependencies when they clearly earn their place. Log each one with the reason. Do not add: a 3D framework on top of Three.js, a CSS framework, a component library, an animation library other than GSAP, analytics, or anything that needs an account or a key.

The font packages register the families `'Unbounded Variable'` and `'DM Sans Variable'`. Import them once in `src/main.tsx`.

## Facts checked at planning time

Recheck any you depend on closely and record what you find in PROGRESS.

- Three.js r187: `WebGLRenderer` is the supported choice for WebGL 2. These exist under `three/addons/`: `EffectComposer`, `RenderPass`, `ShaderPass`, `GTAOPass`, `UnrealBloomPass`, `OutputPass`, `SMAAPass` (no constructor arguments), `RoomEnvironment`, `RoundedBoxGeometry`, `Reflector`, `OrbitControls`, `RectAreaLightUniformsLib`. `PCFSoftShadowMap` and `Clock` are deprecated in favor of `PCFShadowMap` and `Timer`.
- GSAP 3.15.1 is free to use, including the plugins that used to be paid.
- Playwright starts Chromium with software WebGL allowed, so a missing GPU does not raise an error. It quietly renders on the CPU. The harness must detect this. See below.
- Vercel's free plan serves a Vite build as a static site. `vercel.json` in the starter sets the build command to `npm run build` and the output to `dist`.
- Claude Code permission rules: some command shapes prompt even though the tools are allowed. The full list is in `CLAUDE.md` under "commands that would stall the run". Every script in this kit was written to avoid them.
- Playwright's `page.touchscreen` can only tap. A touch drag needs raw touch events. See "End to end tests" below.
- Subagents: this project turns fork mode off in `.claude/settings.json`, so a subagent starts with a fresh context and you can wait for it. The `critic` agent in `.claude/agents/` has only the Read tool.

## Repository layout

```
CLAUDE.md
.claude/                      settings, the critic agent and the /partner command. Never write here.
docs/partner.md
kit/                          this kit. During the build only these change: PROGRESS.md, VERDICTS.jsonl,
                              WEAK-SHOTS.json and the files under critics/
index.html
package.json  tsconfig.json  vite.config.ts  vitest.config.ts  playwright.config.ts  vercel.json
public/
  thumbs/                     rendered part thumbnails, committed
scripts/
  shots.mjs                   the screenshot harness (starter)
  shot-list.mjs               the table of every named shot. You fill it in (starter)
  shot-rules.mjs              the gate's rules: required shot names built from the catalog, counts, references,
                              the verdict line format, the build id. Never change it (starter)
  critic-list.mjs             prints the lines to hand a critic (starter)
  verdict.mjs                 records verdicts in the ledger (starter)
  check-shots.mjs             says whether shots are done (starter)
  free-port.mjs               finds a free port from 5311 to 5319 (starter)
  thumbs.mjs                  renders the thumbnails through the harness (you write it)
  check-copy.mjs              scans for banned characters and strings (you write it)
shots/                        screenshots from the harness. Ignored by git, kept on disk for review
src/
  main.tsx  App.tsx
  config.ts                   app constants that are not part data
  data/catalog.json           verbatim copy of kit/data/catalog.json
  data/catalog.ts             typed access and lookup tables
  engine/                     pure TypeScript: rules, sheet, thermal, codec, lighting math, messages, layout
  state/                      the zustand store, history, persistence
  world/                      World class, renderer, post chain, camera, picking, drag, sockets, choreography
  world/kit/                  materials, textures, geometry helpers
  world/parts/                generators per category, case modules with their layouts
  world/light/                zones, LED textures, lamps
  ui/                         React components with CSS Modules
  styles/tokens.css  styles/global.css
tests/
  unit/                       vitest, includes the fixtures and layout tests
  e2e/                        playwright flows
```

`src/data/catalog.json` must stay byte identical to `kit/data/catalog.json`. A unit test compares them.

## Starter files

`kit/starter/` holds files that were verified at planning time. In Phase 0 copy them to the repository root, keeping their relative paths:

- `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `vercel.json`
- `src/main.tsx`, `tests/unit/starter.test.ts`, `tests/e2e/starter.spec.ts`: a minimal app and one test of each kind, so the toolchain can be proven before any real code exists
- `scripts/shots.mjs`: the working harness, with renderer detection, a one off `--url` mode and the named shot loop
- `scripts/shot-list.mjs`: the empty shot table
- `scripts/shot-rules.mjs`, `scripts/critic-list.mjs`, `scripts/verdict.mjs`, `scripts/check-shots.mjs`, `scripts/free-port.mjs`

`.gitignore` is already at the repository root. The root folders `shots/`, `dist/` and `node_modules/` are ignored. `kit/reference/night-rig/shots/` is not ignored and stays committed.

You own the starter files after copying and you change them as the build needs, with these exceptions. Never change `scripts/shot-rules.mjs`, `scripts/check-shots.mjs`, `scripts/verdict.mjs` or `scripts/critic-list.mjs`, and never change the way `scripts/shots.mjs` decides `same` and writes `shots/manifest.json`. Together those are the gate. You fill in `SHOTS` in `scripts/shot-list.mjs`, and you may extend the harness in every other way.

## Scripts

Every command the build needs is an npm script or a plain `node` call. None needs an environment variable.

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on 127.0.0.1 port 5310, strict |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve `dist/` on 127.0.0.1 port 5311, strict |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit tests once |
| `npm run e2e` | Build, then every end to end test in Chromium against the preview build |
| `npm run e2e:smoke` | Build, then the tests tagged `@smoke` in WebKit and Firefox |
| `npm run e2e:all` | Build, then both of the above |
| `npm run shots -- <names or groups>` | Take named shots. Rebuilds when the source is newer than `dist/`. Starts and stops its own preview server |
| `node scripts/critic-list.mjs <names or groups>` | Print the lines to hand a critic, with each image's hash |
| `node scripts/verdict.mjs ...` | Record verdicts in `kit/VERDICTS.jsonl` |
| `npm run check:shots -- <names or groups>` | Report which shots are done. With no names it checks all 358 required names, every count and the contact sheets. Exits non zero until everything it was asked about is in order |
| `npm run thumbs` | Render every part thumbnail into `public/thumbs/` |
| `npm run check:copy` | Scan for banned characters and strings |

Every server in this project binds `127.0.0.1` by number and every script connects to `127.0.0.1` by number. On macOS the name `localhost` can resolve to `::1`, and a server on one address is invisible to a client on the other. Brandon opens the app by hand at `http://127.0.0.1:5310`.

The harness and the end to end tests start their own server as a child process and stop it when they finish. You do not need a long running server for any gate. If you start a dev server to look at something, start it as a background command, note its background task id, and stop it with the background task controls when you are done.

## State

One zustand store holds:

- `build`: the current Build, always revalidated
- `history` and `future`: for undo and redo
- `mode`: `build`, `showcase` or `exploded`, plus `power`, `airflow` and `load`. Glass is not here. It is `build.glass`.
- `held`: the part being placed, if any, and how (drag or tap or keys)
- `selected`: the installed part that is selected, if any
- `inspect`: the part open in the Inspector, if any
- `ui`: which panel, sheet or dialog is open, the active tray category
- `settings`: quality, reduced motion, and whether the intro was seen
- `saved` and `profiles`: mirrored to browser storage

Every build change goes through one action that calls the engine, stores the result, pushes history, records the cascade for the notice, and schedules the autosave. The world subscribes to the store and animates from the old build to the new one. The interface reads derived values (sheet, fit status, sockets) through memoized selectors that call the engine.

## The test hook

The app exposes `window.__pcb` when the URL has `?hook=1`. The harness and the end to end tests drive the app through it. It must be deterministic.

| Call | Does |
| --- | --- |
| `__pcb.ready` | True once fonts are loaded, the first frame is drawn and the world is idle |
| `await __pcb.load(presetIdOrShareCode)` | Loads a build with no choreography and no intro or start overlay |
| `await __pcb.empty()` | Empty bench |
| `await __pcb.link(code)` | Does what arriving on a shared link with that code does, including the banner and any message |
| `await __pcb.act(action, { instant })` | Runs one build action through the same store action the interface uses, with its choreography and its notice. `action` is `{ type: 'install', category, id, opts }` or `{ type: 'remove', category, opts }` in the shape the fixtures use, or `{ type: 'finish', finish }`, `{ type: 'lighting', patch }`, `{ type: 'lightingPreset', id }`, `{ type: 'fillFans', id }`, `{ type: 'clearFans' }`, `{ type: 'name', name }`, `{ type: 'undo' }`, `{ type: 'redo' }`. With `instant` true it skips the motion |
| `await __pcb.mode(name)` | `build`, `showcase`, `exploded` |
| `await __pcb.set({ power, glass, airflow, load, quality, ui, reducedMotion })` | Sets any of these. `glass` sets `build.glass`. `ui: false` hides the interface. `load` is 0 to 1 |
| `await __pcb.finish(caseFinish)` | Sets the case finish |
| `await __pcb.cam(viewName)` | Jumps to a named view with no tween |
| `await __pcb.select(category, opts)` | Selects an installed part and shows its selection menu. `opts` names the memory `index`, the storage `type` or the fan `mount` |
| `await __pcb.inspect(category, id, angle, { zoom, finish, size, ui })` | Opens the Inspector on a part at a turntable angle in degrees. `zoom` from 0 (whole part) to 1 (the closest allowed), `finish` for a case, `size` for a fan, `ui: false` for the part alone |
| `await __pcb.hold(category, id, socketIndex)` | Shows a held part at a socket preview, valid or blocked, for drag shots. With no index it shows every socket and holds the part clear of them |
| `await __pcb.open(name)` | Opens a named panel, sheet stop, tab or dialog. You choose the names. List them in a comment at the top of `scripts/shot-list.mjs` |
| `await __pcb.scrub(sequence, progress)` | Sets up a named sequence from its start state and jumps it to a progress from 0 to 1. Sequences: `install-gpu`, `install-ram`, `install-cooler`, `install-nvme`, `install-cpu`, `install-fan`, `install-psu`, `power-on`, `explode`, `intro`. The installs run on the Night Rig build with that part taken out |
| `await __pcb.freeze(seconds)` | Stops the clock at a fixed time: lighting, fans and airflow render that instant |
| `await __pcb.settle()` | Resolves when no tween is running, fonts and textures are ready and two frames have been drawn |
| `__pcb.renderer()` | The WebGL renderer string from `WEBGL_debug_renderer_info` |
| `await __pcb.stats(seconds)` | `{ frames, medianMs, p95Ms, drawCalls, triangles }` over that many seconds. `frames` is how many frames the loop drew by itself in that time |
| `__pcb.timing()` | `{ firstFrameMs }`: milliseconds from navigation start to the first frame that shows the scene |
| `__pcb.build()` | `{ build, code }`: the current Build and its share code |
| `__pcb.camera()` | `{ distance, target, view }`: the camera's distance to its target in meters, the target point, and the named view or focused part if any |
| `__pcb.tier()` | `{ setting, active }`: the quality setting (`auto`, `high`, `medium`, `low`) and the tier in use |
| `__pcb.pose(category, opts)` | `{ position, opacity }` of that part's object in the scene right now, in mm, or null when it has no object. Used to see motion happen |
| `__pcb.sheet()` | The current spec sheet from the engine |
| `__pcb.zones()` | Every LED zone in the scene: `{ part, target, colors }`, with `colors` as the RGB values the engine wrote this frame |
| `await __pcb.bounds(category, id, { size, finish })` | Generates that part alone and returns `{ boxes, maxOutsideMm }`: how many collision boxes it declares, and how far in mm any vertex of its geometry lies outside all of them |

You may add calls. Keep these, because the gates use them. The hook only reads and drives. It must not change how the app behaves for a user, and without `?hook=1` it does not exist.

## The screenshot harness

`scripts/shots.mjs` takes the named shots defined in `scripts/shot-list.mjs`. `kit/07-QUALITY-BAR.md` lists the shots that must exist, and `scripts/shot-rules.mjs` builds their exact names from the catalog. A shot is: a name of the form `<group>/<shot>`, a viewport, and a list of hook calls. Its image is `shots/<group>/<shot>.jpg`. The starter harness already does all of the following. Read it before you extend it.

- It rebuilds the app when any source file is newer than `dist/`, starts the preview server on the first free port from 5311, opens the page with `?hook=1`, waits for `__pcb.ready`, runs the shot's calls, waits for `__pcb.settle()`, and saves a JPEG at quality 90.
- **Renderer detection.** It launches Chromium with `channel: 'chromium'` and `--ignore-gpu-blocklist`, and on macOS also `--enable-gpu` and `--use-angle=metal`. It reads the renderer string on a blank page. If the string matches `/swiftshader|llvmpipe|software/i` it relaunches with a visible window and checks again. It prints the final string and whether it is hardware. Record that line in PROGRESS under Environment. Screenshots taken on a software renderer are still valid for judging looks. They are only slower. Performance numbers are valid only on a hardware renderer.
- A window that opens on screen during a headed run is expected. The harness closes it when the run ends.
- **Same or new.** For each shot the harness prints `shot: <path> · <hash>` when it wrote a new image, or `same: <path> · <hash>` when the new capture matches the image already on disk, in which case it leaves the file alone. A match allows only encoder and driver noise. So retaking a shot that did not change keeps its verdicts, and a real change gives a new hash. If you changed something and the harness says `same`, the change is not visible in that shot. `--force` writes the image regardless.
- **The manifest.** For every named shot the harness notes in `shots/manifest.json` which build the image came from. The id of a build is a hash of everything in `dist/`. The shot check accepts an image only when it was taken, or confirmed as `same`, from the build that is in `dist/` right now. So a pass can never rest on a picture of older code. Keep the build reproducible: bake in no timestamp and no random value at build time, or every rebuild looks like a new build and every shot has to be taken again.
- Shots are deterministic: every shot calls `freeze` before capturing, and the world follows the "Same build, same pixels" rule in `kit/04-WORLD.md`.
- It exits non zero if any shot failed or if the page logged an error.

**The ledger.** `scripts/verdict.mjs` appends verdicts to `kit/VERDICTS.jsonl`, each stamped with the first 12 characters of the image's sha1. A critic's verdicts are only accepted from the critic's answer saved under `kit/critics/`, and only for lines that carry the hash the critic was handed by `scripts/critic-list.mjs`, while that is still the hash of the image on disk. `scripts/check-shots.mjs` reads the required names, the shot table, the images, the manifest, the ledger and the saved critic answers, and says which shots are done. `kit/07-QUALITY-BAR.md` gives the rules. Commit the ledger and the files under `kit/critics/` with your work.

`scripts/thumbs.mjs` uses the same machinery. `scripts/shots.mjs` exports its browser, server and capture functions for this. For every part it opens the Inspector at the thumbnail angle, captures a square, and writes `public/thumbs/<category>-<id>.jpg`. Cases get one thumbnail per finish, named `case-<id>-<finish>.jpg`. Fans are rendered at 120 mm.

## End to end tests

Playwright tests in `tests/e2e/` run against the preview build. `playwright.config.ts` from the starter picks a free port and starts and stops the preview server itself. The tests use real pointer, touch and keyboard input for the flows in `kit/09-QA-GAUNTLET.md`, and the hook only to set up and to read the result.

- **Touch.** Touch flows run in Chromium in a context with `hasTouch: true` and a phone viewport. `page.touchscreen.tap()` covers taps. A long press, a drag and a swipe need raw touch events: open a session with `context.newCDPSession(page)` and send `Input.dispatchTouchEvent` with `type` set to `touchStart`, `touchMove` and `touchEnd` and a `touchPoints` list (empty on `touchEnd`). Wait real time between them for the long press. Handle input in the app with Pointer Events so mouse and touch share one path.
- **Other engines.** Every test runs in Chromium. Tests whose title contains `@smoke` also run in WebKit and Firefox through `npm run e2e:smoke`. Tag the flows of item C18 in the gauntlet with `@smoke`. They use taps and keys only, never the CDP session.
- **Errors.** Every test fails on a page error or a console error.
- **Headless and the GPU.** The whole 3D scene runs in these tests. If the harness reported that only a visible window gives a hardware renderer on this machine, set `headless: false` for the Chromium project in `playwright.config.ts` as well, so the flows do not crawl on a software renderer. The same goes for WebKit or Firefox if their headless mode has no WebGL 2 here. The smoke tests may force the Low tier through the hook. These are harness choices. Log them.

## Deployment, later

Brandon deploys after review. You do not deploy. Leave the repository ready:

- `vercel.json` sets the build command to `npm run build` and the output directory to `dist`.
- The app uses no client side routes. Shared builds live in the URL hash, so no rewrites are needed.
- All asset paths are relative to the site root and the build has no absolute origin baked in.
- `README.md` at the root, written by you at the end: what the project is, how to run it, how to test it, how the kit and the Partner work, and the deploy steps for Vercel's free plan.
