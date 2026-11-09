# 00 · Start here

You are the Builder. This kit is everything you know about the project. It was written for a model with no memory of the planning conversation, so nothing important lives anywhere else.

## What you are building

Desktop PC Builder: a web app where a person builds a gaming PC in 3D. They pick a case, drag parts into it, watch them seat, light the build with RGB, power it on, and share it. It is a portfolio piece for Brandon, a design engineer. It exists to show design engineering, cinematic web animation, interaction craft and systems thinking. It contains no AI.

The bar is the quality of a top-tier real-time product configurator. Every part is modeled with real geometry and physically based materials. `kit/07-QUALITY-BAR.md` defines the bar and how you prove you met it.

## Reading order

Read these in order at kickoff. After that, re-read what each phase lists under "Read first".

| File | What it holds |
| --- | --- |
| `kit/PROGRESS.md` | Your memory. Read it first in every session. |
| `kit/VERDICTS.jsonl` | The verdict ledger. It does not exist yet. `node scripts/verdict.mjs` creates and appends to it. You never edit it by hand. |
| `kit/01-PRODUCT.md` | Name, audience, principles, the full experience, scope and what is out of scope. |
| `kit/02-PARTS.md` | The parts roster: brands, design languages, what makes each part distinct. |
| `kit/03-RULES.md` | The rules engine: what fits, what gets removed, the spec sheet, thermals, share links, storage. |
| `kit/04-WORLD.md` | The 3D world: scene, lighting, materials, part generators, layout, RGB engine, cables, cameras, choreography. |
| `kit/05-DESIGN.md` | The interface: Night Rig design tokens, layouts per screen size, components, motion, copy. |
| `kit/06-ARCHITECTURE.md` | Stack, pinned versions, file layout, state, scripts, test hook, screenshot harness, deployment. |
| `kit/07-QUALITY-BAR.md` | The standard, the references, the shot list, the checklists, the critic, the decision rule. |
| `kit/08-BUILD-ORDER.md` | The phases, each with Read first, steps and a gate. |
| `kit/09-QA-GAUNTLET.md` | The numbered acceptance items you must pass before `BUILD COMPLETE`. |
| `kit/10-KICKOFF.md` | Written for Brandon. You do not need it to build. |
| `kit/data/catalog.json` | Every part, number, brand, preset and lighting preset. The single source for part data. |
| `kit/data/fixtures.json` | Known inputs and outputs for the rules engine. Your engine must reproduce them exactly. |
| `kit/data/reference/` | The planning-time JavaScript that produced the fixtures. Read it when a rule is unclear. |
| `kit/reference/night-rig/` | A working Three.js prototype of the hero build with the Night Rig interface, and its screenshots. This is the visual floor. You must beat it. |
| `kit/starter/` | Verified starter files: package.json, tsconfig, the Vite, Vitest and Playwright configs, and the scripts for shots, verdicts and the shot check. Copy them to the repo root in Phase 0. Read the comments at the top of each script. |
| `.claude/agents/critic.md` | The critic subagent. It ships with the kit. You start it with the Agent tool. You never edit it. |
| `kit/addenda/` | Empty until the Partner adds numbered addenda after v1. If files exist there, read them after this file. They override the kit. |

## When two files disagree

Use this precedence, by topic. Log the conflict in PROGRESS under "Decisions made by the Builder" and continue.

| Topic | Winner |
| --- | --- |
| Part numbers, ids, names, brands, presets, lighting presets | `kit/data/catalog.json` |
| Expected engine outputs | `kit/data/fixtures.json` |
| Engine behavior | `kit/03-RULES.md`, then `kit/data/reference/rules.mjs` |
| How anything looks in 3D | `kit/07-QUALITY-BAR.md`, then `kit/04-WORLD.md`, then the reference prototype |
| How the interface looks and reads | `kit/05-DESIGN.md`, then the reference shot `ui-desktop.jpg` |
| What is in scope | `kit/01-PRODUCT.md` |
| Stack, versions, file layout, commands | `kit/06-ARCHITECTURE.md` |
| Order of work and gates | `kit/08-BUILD-ORDER.md` |
| What counts as done for a shot, and what a shot is named | `scripts/shot-rules.mjs` and `scripts/check-shots.mjs` as delivered, then `kit/07-QUALITY-BAR.md` |
| Anything in `kit/addenda/` | The addendum wins over everything above |

The reference prototype is a floor for visual quality only. Its code is a sketch written in plain JavaScript. Do not copy its structure. Where the prototype and the kit differ on names, numbers or behavior, the kit wins.

## Working protocol

1. Read `kit/PROGRESS.md`. If it shows work in progress, continue from there. If its first line is `STATUS: NOT STARTED`, start Phase 0.
2. For the current phase in `kit/08-BUILD-ORDER.md`: read every "Read first" file from disk, do the steps in order, then run the gate.
3. After each step: update PROGRESS. At each gate: write the evidence in PROGRESS, commit, then move on.
4. Anything visual goes through the loop in `kit/07-QUALITY-BAR.md`: take the shot, open it with the Read tool, record a verdict against the checklist, fix, repeat, then get a fresh critic agent to pass it. Verdicts are recorded with `node scripts/verdict.mjs` and a group is done only when `npm run check:shots -- <group>` says so.
5. When the kit is silent, decide with the decision rule in `kit/07-QUALITY-BAR.md` and log it.
6. When every item in `kit/09-QA-GAUNTLET.md` passes, replace the first line of PROGRESS with `BUILD COMPLETE`, commit, and stop.

## Vocabulary

| Word | Meaning |
| --- | --- |
| Build | The user's PC configuration: which parts are installed and how it is lit. Also the saved or shared form of it. |
| Rig | The assembled PC as a 3D object. |
| Part | One catalog entry: a case, board, processor, cooler, memory kit, graphics card, drive, power supply, fan or cable set. |
| Category | One of: `case`, `board`, `cpu`, `cooler`, `ram`, `gpu`, `storage`, `psu`, `fan`, `cables`. |
| Slot, mount, bay | Where a part goes: memory slots and M.2 slots on a board, fan and radiator mounts and drive bays in a case. |
| Socket | The glowing target shown in 3D for a place a held part can go. |
| Install, remove, swap | The three build actions. Swap is installing into a place that is already filled. |
| Cascade | Parts removed automatically because the part they depend on left or changed. |
| Tray | The parts browser in the interface. |
| Inspector | The view of a single part on a turntable, before or after installing it. |
| Spec sheet | The live summary of the build: parts, totals, slots used, power, warnings. |
| Zone | One addressable strip or ring of LEDs on a part. |
| Lighting profile | An effect plus its speed, brightness, direction and color stops. |
| Preset build | One of the six ready-made builds in the catalog. |
| Shot | A named, repeatable screenshot. `kit/07-QUALITY-BAR.md` lists the groups, `scripts/shot-rules.mjs` fixes the names, and you define each one in `scripts/shot-list.mjs`. |
| Critic | A fresh subagent that judges shots against the quality bar without having seen the work being made. |
| Ledger | `kit/VERDICTS.jsonl`: one line per verdict, tied to the hash of the image that was judged. |
| Lit, Bench | The two standard shot states. Lit: Showcase mode, glass on, power on. Bench: Build mode, glass off, power off. |
| Gate | The checks that end a phase. |
| Night Rig | Two things: the name of the interface direction, and the name of the hero preset build. Context makes it clear. |
