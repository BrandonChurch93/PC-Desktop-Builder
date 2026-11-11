# Desktop PC Builder

Build a gaming PC in 3D, part by part. Pick a case, drag parts into it and watch them seat, read the spec sheet, light the build, power it on, and keep it as a link or a poster.

It is a static web app made with Three.js, React and GSAP. It has no AI, no accounts, no API keys and no database. Everything runs in the browser, and every brand and part in it is invented.

## What is in it

- Six cases, forty three parts and six preset builds, every one modeled with real geometry and physically based materials.
- A rules engine that knows what fits and says why when something does not, with a cascade that removes what depends on a removed part, and undo.
- Drag, tap or keyboard install with sockets in the scene, and motion for every install, removal and swap.
- Per LED lighting with eight effects, a gradient editor, per part overrides, nine presets and saved profiles.
- Power on and off sequences, a load control with simulated temperatures, an airflow view, Showcase with a camera tour, and an exploded view with labels.
- Share links that rebuild the exact build anywhere, saved builds in the browser, and poster export in portrait and landscape.
- Desktop, tablet and phone layouts, keyboard and screen reader support, and three quality tiers.

## Run it

You need Node 22 or newer.

```sh
npm install
npm run dev
```

Then open http://127.0.0.1:5310.

For the production build:

```sh
npm run build
npm run preview
```

The preview serves on http://127.0.0.1:5311.

## Test it

```sh
npm run typecheck
npm run test          # unit tests: the rules engine, lighting math, layouts, generators
npm run e2e           # end to end flows in Chromium, with real pointer, touch and keyboard input
npm run e2e:smoke     # the smoke flows in WebKit and Firefox
npm run check:copy    # copy rules: no em dashes, no real brands, no pure black or white
```

Screenshots are named and deterministic. `npm run shots -- <group or name>` takes them through `scripts/shots.mjs`, and `npm run check:shots` checks that every required shot exists, was taken from the current build and has a passing verdict. Add `?hook=1` to the URL to get the test hook, `window.__pcb`, that the harness and the tests drive the app through.

## How it was made

The app was written by an unattended Claude Code session, the Builder, from the kit in `kit/`. The kit holds the product, the parts, the rules, the world, the design, the architecture, the quality bar and the build order. `kit/PROGRESS.md` is the Builder's notebook: every phase, gate, decision and measurement is there. Every screenshot verdict is in `kit/VERDICTS.jsonl`, and every critic's answer in `kit/critics/`.

After the build, a second session, the Partner, reviews the work with Brandon. Start it in Claude Code with `/partner`. It looks at the screenshots, turns reactions into precise fixes or numbered addenda in `kit/addenda/`, and hands them back to the Builder as prompts. It never edits the app itself. `docs/partner.md` describes its job.

## Deploy on Vercel's free plan

1. Push this repository to GitHub.
2. In Vercel, choose Add New, then Project, and import the repository.
3. Vercel reads `vercel.json`: the build command is `npm run build` and the output directory is `dist`. Keep those.
4. Deploy. The app has no client side routes and shared builds live in the URL hash, so no rewrites or environment variables are needed.

## Layout

```
src/engine/   the rules engine, pure TypeScript
src/world/    the Three.js world: parts, layout, cables, lighting, motion, camera
src/ui/       the React interface
src/state/    the store, actions, storage and boot
src/data/     the catalog, a copy of kit/data/catalog.json
scripts/      the screenshot harness, verdicts, checks and helpers
tests/        unit and end to end tests
kit/          the build kit, the notebook and the verdict ledger
```
