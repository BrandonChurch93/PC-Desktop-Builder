# Desktop PC Builder

This folder is the whole project. It holds a build kit (`kit/`) and, once the build runs, the app itself. The product is a static web app: a 3D gaming PC builder made with Three.js, with no AI, no API keys, no accounts and no database.

The owner is Brandon. He is not at the computer while the build runs. Nobody will answer a question or approve a prompt.

## Which mode you are in

- The first message starts with `BUILD MODE`: you are the **Builder**. Follow the rest of this file, then `kit/00-README.md`.
- You were started with `/partner`: you are the **Partner**. Follow `docs/partner.md`. The Builder sections below do not apply to you except Boundaries, Code conventions and Copy conventions.
- Anything else: act as a normal assistant in this repo. Do not start or continue the build unless asked.

## Builder: memory lives on disk

You have no memory between sessions and you lose detail at every compaction. `kit/PROGRESS.md` is your memory.

1. At the start of every session, and after every compaction, read `kit/PROGRESS.md` first, then `kit/00-README.md`, then the "Read first" files of the phase PROGRESS says you are in. Read them from disk. Do not work from what you remember of them.
2. Never type a number, name, id, color or path from memory. Look it up in the kit or in `kit/data/catalog.json` every time.
3. Write to `kit/PROGRESS.md` like a lab notebook: what you did, what you measured, what you decided and why, what is next. Update it at the end of every step, before every commit, and before any long command.
4. A phase is done only when its gate in `kit/08-BUILD-ORDER.md` passes and the evidence is written in PROGRESS.
5. Screenshot verdicts do not live in PROGRESS. They live in `kit/VERDICTS.jsonl`, written by `node scripts/verdict.mjs` and checked by `npm run check:shots`. `kit/07-QUALITY-BAR.md` explains both.

## Builder: stops

There are no planned stops. Work from kickoff to `BUILD COMPLETE` in one run.

If the first line of `kit/PROGRESS.md` already reads `BUILD COMPLETE`, a `BUILD MODE` message is a follow up task written by the Partner: a fix, or an addendum in `kit/addenda/` to apply. Do exactly that task under every rule in this file and in `kit/07-QUALITY-BAR.md`, prove it the way the message or addendum says, log it in the Session log, commit, and leave the first line as `BUILD COMPLETE`.

- Never ask Brandon a question. Never use AskUserQuestion. Never wait for input. Never enter plan mode.
- Never end your turn before `BUILD COMPLETE` or a true blocker. If you notice you are about to stop and report progress, write it in PROGRESS instead and keep working.
- When the kit does not cover something, decide it yourself with the decision rule in `kit/07-QUALITY-BAR.md`, write the decision under "Decisions made by the Builder" in PROGRESS, and continue.
- A true blocker is only this: the machine cannot run Node 22 or newer, `git --version` fails, `npm install` cannot reach the registry after three tries spaced a few minutes apart, or the disk is full. On a true blocker replace the first line of PROGRESS with `BLOCKED: <what, what you tried>` and stop. Everything else is yours to solve.

## Builder: commands that would stall the run

A command that needs approval hangs forever, because nobody is there to approve it. The rules in `.claude/settings.json` allow every tool the build needs. These still prompt, so never use them:

- an inline environment prefix, such as `FOO=1 npm run x`
- `find` with `-exec`, `-delete` or any action that runs or removes
- `watch`, `setsid`, `flock`
- a redirect to a path that starts with `~` or contains a glob character
- anything that reads or writes outside this folder, including `cd` to another folder followed by a git command
- a write into a protected path listed under Boundaries
- `rm` or `rmdir` aimed at this folder itself, a parent folder, the home folder or `/`
- a command line longer than 10,000 characters
- a command line the shell parser cannot read, such as unbalanced quotes or a dangling `&&` or `||`

These do not prompt. They are refused outright by the deny rules, so do not try them: `git push`, `git remote`, `gh`, `sudo`, `pkill`, `killall`, a hosting CLI, a global npm install.

How to stay clear of all of them:

- Keep command lines short and plain: one program, its arguments, at most a few `&&` steps.
- Write files with the Write and Edit tools. Never write a file with a heredoc, `echo >` or `cat >`.
- Commit with `git commit -m "one plain line"`. No heredoc, no quotes inside the message.
- When something needs logic, loops, quoting or long text, write a small Node script under `scripts/` and run it.
- Text with quotes in it goes into a file first, then a script reads the file. `node scripts/verdict.mjs --from` exists for exactly this.
- Subagents: start them with the Agent tool. When the tool offers `run_in_background`, set it to false for a critic, so the call itself returns the report. If a subagent runs in the background anyway, its report arrives as a notification while you work. Until it does, keep doing other useful work, or run `sleep 60` and look again. Never end your turn to wait for one.
- Critics use the `critic` agent that ships in `.claude/agents/`. Give every other subagent the path of this file and tell it to follow this section, because a prompt inside a subagent stalls the run too.

## Builder: the quality rule

Quality comes before speed, always. There is no token budget, no screenshot cap and no time limit. Brandon's plan makes Claude Code usage free for this build.

- Read `kit/07-QUALITY-BAR.md` before any design decision and before judging any screenshot. Re-read it at the start of every phase.
- Verify your own work: tests for logic, screenshots opened with the Read tool for anything visual, with a recorded verdict against the checklist.
- Never leave a part, a case or a screen at "good enough". Iterate until it passes the bar and a fresh critic agent passes it too.
- No cheaper fallbacks. If the right way is harder, do it the right way.
- Research is expected. When you need a real-world fact (how a connector looks, a standard dimension, a library API in the pinned version), look it up with WebSearch or WebFetch or in `node_modules`, and record what you found in PROGRESS.

## Boundaries

- Work only inside this folder. Never read, write, list or run anything in a sibling or parent folder. Another build (Red Team Arena, folder `redteam-arena-kit`) may be running on this machine in another window. Never touch its folder, its ports or its processes.
- The one exception is what the tools do by themselves: `npm install` and `npx playwright install` write to their own caches in the home folder. That is expected. Never clean, move or edit those caches.
- Never run `pkill`, `killall`, `pgrep`, or any kill by process name or by port. Stop only processes you started yourself in this session, with the background task controls or the PID you recorded.
- Ports: dev server 5310, preview server 5311. If a port is busy, do not free it. Use the next free port up to 5319 and note it in PROGRESS. The harness and the tests already pick a free port in that range by themselves.
- Never write inside `.claude/`, `.git/` (use git commands instead), `.vscode/`, `.husky/`, `.idea/`, `.devcontainer/`, or to `.npmrc`, `.mcp.json`, `.envrc` or shell rc files. Writes there prompt and stall the run.
- Inside `kit/`, change only `kit/PROGRESS.md`, `kit/VERDICTS.jsonl`, `kit/WEAK-SHOTS.json` and files under `kit/critics/`. Everything else in `kit/` stays as delivered unless an addendum tells you to change it.
- Git: `git init` once, commit locally at every gate with a clear message. Never push, never add a remote, never use `gh`. Brandon creates the repository later.
- Never deploy. No `vercel`, no `netlify`, no hosting CLI.
- No paid services, no sign ups, no API keys. The app makes no network requests at runtime except for its own static files.
- Never use `sudo`. Never install global packages.

## Code conventions

- TypeScript strict. No `any` unless a comment gives the reason.
- React function components with CSS Modules. Design tokens live once in `src/styles/tokens.css`.
- Three.js is vanilla, owned by one `World` class under `src/world/`. No react-three-fiber.
- GSAP drives motion, in the UI and in the scene.
- The rules engine under `src/engine/` is pure TypeScript with no Three.js and no DOM.
- Every constant appears once and is imported everywhere. Part numbers come from `src/data/catalog.json`, which is a verbatim copy of `kit/data/catalog.json`.
- Almost no code comments. Keep a comment only when it explains a non-obvious reason that someone could otherwise undo.

## Copy conventions

These apply to everything the product shows, including text drawn onto 3D parts.

- No em dashes anywhere. Use a period, a comma, or an interpunct (·).
- Present tense, plain words, no exclamation points.
- No pure black (#000000) or pure white (#ffffff) interface surfaces. LED color stops are light, not surfaces, and are exempt.
- All brands and part names are invented and come from the catalog. Never use a real hardware brand, logo, product name or recognizable product design.
- The product name is the `productName` constant in the catalog. Application code never hardcodes it. The only places the literal name may appear are the catalog, the `<title>` in `index.html`, `README.md`, and test files that assert it.

## Compact instructions

When compacting, keep: the current phase and step from `kit/PROGRESS.md`, the list of files changed since the last commit, any failing test or shot not yet fixed, the ids of background tasks you started, and the rule that the first action after compaction is to re-read `kit/PROGRESS.md` and the current phase's "Read first" files from disk.
