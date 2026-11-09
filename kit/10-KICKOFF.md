# 10 · Kickoff

For Brandon. The Builder does not need this file.

## Start the build

1. Unzip `desktop-pc-builder-kit.zip` on the Desktop. You get a folder named `desktop-pc-builder-kit`.
2. Open that folder in a new VS Code window. If VS Code asks whether you trust the folder, say yes.
3. Open the Claude Code panel and start a new conversation on Opus, effort high or above. If Claude Code itself asks whether to trust this folder, say yes.
4. Click the mode indicator at the bottom of the prompt box and pick **Edit automatically**. Not Auto, not Plan, not Manual.
5. Paste the kickoff prompt.

Kickoff prompt:

```
BUILD MODE. Read kit/00-README.md and build the whole product from the kit. Work every phase in kit/08-BUILD-ORDER.md in order, verify every gate, log everything in kit/PROGRESS.md, and stop only at BUILD COMPLETE.
```

That is all. The Builder installs everything, keeps the Mac awake, and commits as it goes.

## Why step 4 matters

- The panel does not take its starting mode from this folder. It uses the mode you last picked, and on recent versions a fresh install starts in Auto.
- In Edit automatically, the kit's permission rules allow every tool the build needs, so nothing should ever ask.
- In Auto, Claude Code sets the kit's broad rules aside and judges each command itself. That can bring prompts back, and the build would sit there waiting for you.
- In Plan, it writes a plan and waits for you to approve it.

## One more thing to glance at

- **Node and git.** The build needs Node 22 or newer, and git. To check both, in VS Code's integrated terminal paste `node -v && git --version`. Both should print a version.

## If it stops

Open `kit/PROGRESS.md`. The first line says where it is.

- If the conversation ended or hit a limit, start a new conversation on Opus, set the mode to Edit automatically again, and paste:

```
BUILD MODE. Continue from kit/PROGRESS.md.
```

- If the first line starts with `BLOCKED`, it says what failed. The only blockers the Builder is allowed to stop for are: Node missing or too old, the npm registry unreachable, or a full disk.
- If the panel is waiting on a permission prompt, approve it and note which command it was for the review. That should not happen in Edit automatically.

## What you will notice while it runs

- A Chromium window may open and close on the Mac by itself. That is the screenshot harness using the GPU. Leave it.
- The folder fills with `node_modules`, `src`, `shots` and so on. Inside `kit/` only four things change: `PROGRESS.md`, the verdict ledger `VERDICTS.jsonl`, the saved critic answers under `critics/`, and `WEAK-SHOTS.json` if it ever needs one.
- The Mac stays awake. The Builder runs `caffeinate` with a 48 hour limit and stops it at the end. If a session dies, that one ends by itself.
- It never touches the Red Team Arena folder, its ports or its processes. It uses ports 5310 to 5319 only.

## When it is done

The first line of `kit/PROGRESS.md` reads `BUILD COMPLETE`.

1. To see the app: in VS Code's integrated terminal paste `npm run dev`, then open `http://127.0.0.1:5310`.
2. To review: in the Claude Code panel, start a new conversation on Fable and type `/partner`. The Partner reads the handoff notes, looks at the screenshots with you, takes what you do not like, and writes the fix prompts for Opus. It never edits the app itself.
3. Screenshots of everything are in `shots/`, grouped by kind. There are 358.
4. The Handoff section at the end of `kit/PROGRESS.md` names anything the Builder knows is weaker than the rest. Look there first.

## Deploying later

Nothing is pushed or deployed by the build. When you are happy:

1. Create a GitHub repository and push this folder to it.
2. Import it into Vercel on the free plan. No settings to change and no environment variables.

The Partner can walk you through both. Vercel's free plan is meant for personal, non commercial projects, which a portfolio piece is.

## Cost

Nothing beyond your Claude plan. There is no API, no key, no subscription and no paid service anywhere in this project.

## Decisions made while planning that you should know

- **Brand names changed from the look derby.** Vantor, Sable, Brisa, Northlight and Halden turned out to be real companies or products. The roster now uses 14 invented names that checked clear: Mirevale, Skarn and Paleforge for cases, Korrin for boards, Cindervane and Hadron Bay for processors, Kestrane and Lumenfold for cooling and fans, Calyra for memory, Veltrin and Dravik for graphics, Pellam for storage, Thessic for power, Wyrmglass for cables.
- **Some part names changed too**, because the first ones were too close to real product names: Spire became Pillar, the Prism memory became Facet, Halo memory became Crown, the Halo fan became Aureole, the Prism fan became Frame, Arc 2X became Apex 2X, Zenith became Crest and Ghost became Halide. The names run through the whole kit and its test data, so if you want one changed, ask for it before kickoff.
- **The six cases** are the Mirevale Vitrine (glass mid tower), Mirevale Atrium (dual chamber), Skarn Vent (mesh airflow), Skarn Bulwark (full tower), Paleforge Cub (small form factor) and Paleforge Gantry (open frame). Each comes in two finishes.
- **Six preset builds** ship, one per case. Night Rig is the house build people see first.
- **No prices.** The parts are invented, so prices would be made up. The spec sheet shows power, clearances, slots and airflow instead.
- **Simulated temperatures** drive the Thermal lighting effect and a small load readout that shows while the power is on. They are labeled as simulated.
- **Screenshots are not committed to git.** There are 358 of them and they change every round. They stay on disk in `shots/` for review. Part thumbnails are committed because the app uses them.
- **How a screenshot counts as done.** A fresh critic agent, which has never seen the work, has to pass the exact image on disk, taken from the final build. A script checks that, not the Builder's word. There is one exception, so that the run is certain to end: when critics have failed 8 different versions of a shot, 12 for a full rig view or a desktop screen, and the Builder has rebuilt its approach twice, it may mark that shot weak and move on. A weak shot is not a pass. Each one is named in the handoff, and the last line `npm run check:shots` prints gives the count. Look at those first.
- **You have not reviewed the reference prototype.** You asked to go straight to the kit, so the prototype in `kit/reference/night-rig/` was built to the Night Rig direction you picked and iterated against its own screenshots without your sign off. The Builder has to beat it. Its screenshots are in `kit/reference/night-rig/shots/`. If you want a different floor, say so before kickoff or raise it in the Partner review.
