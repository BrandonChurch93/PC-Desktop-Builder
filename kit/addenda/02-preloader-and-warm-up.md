# Addendum 02 · Preloader and warm-up

A follow up task after `BUILD COMPLETE`. Apply it under every rule in `CLAUDE.md`, `kit/07-QUALITY-BAR.md` and addendum 01. When it is done, log it in the Session log, commit, and leave the first line of PROGRESS as `BUILD COMPLETE`.

## What changes

The app stops stalling. Today the first load shows a black screen until the whole world exists, and the first use of most things (a preset switch, a part, the Inspector, a drag, a selection) stalls while shaders compile and parts generate. After this addendum: a premium preloader with truthful progress covers one warm-up that compiles every shader and prepares every part, builds never force recompiles, parts are cached and pre-built on intent, and the quality probe runs before the warm-up instead of after the intro.

Nothing visual changes. Every shot must come back `same` from the harness, except the new preloader shots.

## Why, in Brandon's words

The build looks incredible, and he does not want to strip any of the quality away. It is laggy at first until everything loads in, and switching parts is laggy the first time. He wants a preloader, even a long one, that tells the user this is an ultra detailed representation of a hyper realistic PC builder and looks premium while it works, and he wants everything loaded up front so the user is never stuck with a laggy screen the first time they do something.

## Findings this addendum rests on

Measured on the repo at `BUILD COMPLETE`. Confirm each on the Mac before building on it, and log what you find.

- `renderer.info.programs` is 71 at ready and grows to about 254 over one session. No call to `renderer.compile` or `compileAsync` exists.
- `buildLamps` in `src/world/light/rgb.ts` creates `min(groups, lampCount − 1)` RectAreaLights. Three.js keys programs on the light count, so every change in lamp count recompiles every visible material: empty bench to case +15 programs, case to board +29, Night Rig to Windbreak +43. The Inspector's own `RgbEngine` does the same.
- Variants compile on first use: held ghost (`liftExposure` in `interact/hands.ts`, first GPU drag +25), selection outline (+9), airflow (+1), `Fader` transparent clones, `revealMaterial` cable clones, GTAO 16 versus 32 samples in `Post.setScene`.
- `generate()` in `parts/index.ts` has no cache. Every `Rig.sync`, `Hands.ghostFor` and `Inspector.show` regenerates. A drag generates twice. `Rig.release` disposes, so swapping back regenerates. CPU per part: 30 to 360 ms. Boards and label atlases upload large canvases with mipmaps on every generate (board front 3660 × 2928 plus bump, board back two 2440 × 1952, label atlases up to 4096 wide).
- `World.init` runs as a few long tasks that never yield. First visit: the intro waits for `world.ready` on a black screen. The auto tier probe runs after ready, during the intro, and a step down rebuilds everything.
- `index.html` has no loading markup. The 1.8 MB bundle parses before anything shows.
- Thumbnails use `loading="lazy"`, so each tray tab pops in on first open.

## The exact specification

Work the parts in this order. Each has its own commit.

### 1. Fixed lamp count

`src/world/light/rgb.ts` `buildLamps`: always create exactly `lampCount − 1` RectAreaLights for the tier. Pad with lamps at intensity 0 and minimum size, parked at the lamp parent, `visible` left true so Three.js counts them, skipped in `update()`. Do the same for the Inspector's `RgbEngine`. A lamp at intensity 0 contributes nothing, so pixels do not change. Prove it: `npm run shots -- rig bench finish macro light` prints `same` for every shot.

### 2. Warm-up

New `src/world/warm.ts`, `export async function warmUp(world, tier, report, signal)`. In slices that yield to the browser between them (`scheduler.yield()` where it exists, otherwise a `MessageChannel` tick; not `requestIdleCallback`), and checking `signal` in every slice:

1. Fonts.
2. `textures()`, `spun()`, every `mat(name)` for every `MatName`, `sleeve()` for all six colorways.
3. `renderer.initTexture()` on every shared texture, one per slice.
4. Every one of the 55 part variants, generated at the tier's detail with the options its real placement uses: every case in every finish, every fan at both sizes. One generator per slice. Each goes into a hidden warm scene.
5. `renderer.compileAsync(warmScene, world.camera, world.scene)` for the room lights, then again with the Inspector scene as the target. Before compiling, `renderer.setRenderTarget(world.post.composer.readBuffer)` and restore afterwards, because the app renders into the composer's HalfFloat target and `compile` keys programs on the current target.
6. Warm every variant: `Fader` transparent clones, `liftExposure` clones (export it from `hands.ts`), `revealMaterial` clones from `buildCables` of each preset, socket overlay materials, the airflow dash material, and one frame each with `post.hover` and `post.select` on a warm mesh, with `post.setScene` both near and far.
7. A `ProgramKeeper` in `warm.ts` that holds one clone of every warmed material with every texture slot replaced by a shared 1 × 1 placeholder keeping the original `channel`, so programs survive the warm parts being disposed. Compile the clones too, then dispose the warm parts.

Warm-up must not touch shared state (`setGlassStage`, room level, exposure, texture scale, `RgbEngine` zones). The harness `same` results prove that.

### 3. The preloader

- Static markup and CSS in `index.html`, so it shows before the bundle parses. Animate only `transform` and `opacity` with CSS keyframes, which keep moving through long tasks. System font first, app fonts once loaded. `src/ui/Preloader.tsx` takes over when React mounts and shows truthful progress.
- Progress is counted, never faked, in cost weighted units: fonts, shared textures and environments, materials, the 55 generators, the compile batches, the 55 thumbnails, the probe frames. Show a percentage and a one line status of what is being prepared ("Preparing the Veltrin Apex 3X", "Compiling materials"). Names come from the catalog.
- Fixed copy, in the voice rules of `kit/01-PRODUCT.md`. No em dashes, no exclamation points, no pure black or white, the product name from the catalog constant, never the word AI.
  - Title: the product name.
  - Line one: "Every part in this builder is modeled from real geometry, real materials and real light, down to the screws."
  - Line two: "The first visit prepares all of it once, so nothing stalls while you build."
  - Status line as above.
  - Enter control label: "Enter the bench". It appears as soon as the house build and its shaders are ready, and warming continues in the background after it is pressed.
  - After the warm-up finishes with the control untouched, the preloader leaves on its own.
- Design: the Night Rig tokens, the display face for the title, the signature gradient on the progress line only. It is a screen state and goes through the loop and a critic once under addendum 01. Quiet, no spinner, no stock bar.
- Input on the interface layer is blocked until the preloader leaves. Under reduced motion the animation is a crossfade.
- On a first visit the intro starts after the preloader. On a returning visit the preloader still runs, because the warm-up is per session; show the restored build's name in the status.
- A hard cap of 90 seconds of warming, after which the preloader leaves and the rest warms lazily in the background.
- Errors inside warm slices go to `console.error` and never hide the Enter control. Context loss goes to the existing `NoWebGL lost` path.

### 4. The probe inside the preloader

Split `World.init` into `initCore()` (renderer, room, post, the house build and its programs) and the warm-up. After `initCore`, render the house hero for the probe frames under the preloader, pick the tier, then warm at that tier. Remove the post ready `applyQuality('auto')`. If `feedAuto` later steps down, show a short scrim "Tuning detail for this device" and run `warmUp` again for the new tier.

### 5. Part cache

New `src/world/parts/cache.ts`: an LRU keyed by the `Rig.sync` signature plus tier, with a byte budget from geometry buffers and texture sizes, about 256 MB on desktop and about 96 MB on a coarse pointer. `Rig.release` and `clearAll` put parts into it instead of disposing. `Rig.sync`, `Hands.ghostFor` and `Inspector.show` take from it. On drop, the ghost's part goes straight to the rig after its materials are restored. Re-own zones and anchors on reuse. Invalidate on a tier change.

### 6. Generate on intent

`Tray.tsx`, `PartCard.tsx`, `Hands`: on `pointerenter`, `focus` or `pointerdown` of a card, and for the first few cards when a tab opens, queue that part's generation into the cache with the options its target place will use, then `renderer.initTexture` each of its textures one per slice. The install frame then carries no generation and no upload.

### 7. Thumbnails

Preload all 55 in the preloader with `new Image()` and `decode()`, and keep references. They are the app's own static files, so F38 holds.

### 8. The hook and tests

- Under `?hook=1` skip the warm-up unless `?warm=1` is present, so the 358 shots keep their semantics and `__pcb.ready` means what it meant.
- `__pcb.timing()` gains `preloadMs`. Log both numbers.
- New end to end test, the acceptance gate: open with `?hook=1&warm=1`, wait for the warm-up to finish, record `renderer.info.programs`, then cycle every preset, every part through the Inspector, one drag ghost, one selection and the airflow view through the hook, and assert the program count did not grow. Also assert the preloader shows its Enter control before the warm-up ends, and that the page is interactive after Enter.
- New shots: `ui-desktop/15-preloader` at 30 percent, `ui-phone/preloader`. Add them to `scripts/shot-list.mjs` and to `PREFIX_COUNTS` and `GROUP_COUNTS` in `scripts/shot-rules.mjs` (ui-desktop 21, ui-phone 14, total 360). This addendum allows those two edits to the rules file and no others.

## Which kit statements it overrides

- `kit/04-WORLD.md` "Performance rules": the cache it asks for is now specified here.
- `kit/06-ARCHITECTURE.md`: `World.init` shape, the hook's `timing()`, the frozen `scripts/shot-rules.mjs` for the two count changes.
- `kit/09-QA-GAUNTLET.md` P7: `firstFrameMs` is now measured to the preloader's first paint, and `preloadMs` is logged beside it.
- `kit/01-PRODUCT.md` step 1 of the experience: the preloader comes before the intro.

## Which shots and tests must be retaken and pass

- Every existing shot retaken: `npm run shots`. All must print `same`. Any `shot:` line means something visual changed and must be explained or fixed.
- The two new preloader shots pass under addendum 01.
- The new program count test passes on the Mac with the hardware renderer, and the numbers go in PROGRESS: programs at ready, programs after the cycle, `preloadMs`, and the per step `performance.now()` around each `compileAsync` and each large `initTexture`.
- `npm run typecheck`, `npm run test`, `npm run e2e`, `npm run check:copy` and `npm run check:shots` pass.

## Done when

All of the above is true, logged in the Session log with the measured numbers, and committed with the message `addendum 02: preloader and warm-up`.
