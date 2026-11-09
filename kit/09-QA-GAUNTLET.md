# 09 · QA gauntlet

Every item must pass before `BUILD COMPLETE`. Record each one in PROGRESS under "QA results" with its id, PASS, and the evidence: the command and its result, the test name, or the `check:shots` command and the line it printed.

Items are checked by automated tests wherever that is possible. An item marked **shots** is proven by `npm run check:shots` for the shots named. There is no item that passes on your say alone.

## A · Engine

| Id | Item | Evidence |
| --- | --- | --- |
| A1 | `src/data/catalog.json` is byte identical to `kit/data/catalog.json` | Unit test |
| A2 | Every `fixtures.presets` entry reproduces: unchanged on revalidate, same sheet, temperatures, share code, taken fan mounts, graphics clearance | Unit tests |
| A3 | Every `fixtures.checks` entry reproduces: `ok`, `code`, `removed`, and on success the resulting sheet and cooler | Unit tests |
| A4 | Every `fixtures.decodes` entry reproduces | Unit tests |
| A5 | Revalidate is stable and the codec round trips over at least 500 seeded random valid builds | Unit test |
| A6 | Lighting math properties hold for all eight effects | Unit tests |
| A7 | Every rule code produces its message, in every variant listed in `kit/03-RULES.md`, with all placeholders filled | Unit test |
| A8 | The engine imports nothing from `three`, `react` or the DOM | Unit test that scans imports under `src/engine/` |
| A9 | The automatic quality tier is a pure function of frame time samples: it picks a tier from its probe, steps down once when the median stays over 24 ms, and never changes while the user is interacting | Unit tests |

## B · Layout

The layout tests run on the pure `place()` function. For each case they generate builds from the engine, not by hand: every supported board size, with the matching processor, crossed with every cooler that passes `check` (liquid coolers on every mount that passes), crossed with no card, the longest card that passes and the thickest card that passes, with the tallest memory that passes in as many sticks as fit, every M.2 slot full, as many drives as the engine allows, the longest supply that passes, and a fan on every free mount. The board's SATA ports cap the drives, so generate two variants: 3.5 inch drives first up to the limits and then 2.5 inch, and the other way round. A drive bay that no generated build can fill is still tested: place a drive in every bay anchor directly and check it against the case and the other parts.

Collision boxes cover rigid parts. Tubes, cables and fan leads are flexible and are not in the boxes. Shots judge those.

| Id | Item | Evidence |
| --- | --- | --- |
| B1 | In every generated build, no two collision boxes of different parts intersect by more than 0.5 mm, except declared contact pairs | Unit test, with the number of builds per case logged |
| B2 | The six preset builds place with no intersections | Unit test |
| B3 | In every case, with a fan on every mount, the free graphics length is within `gpuMaxLength + 2` to `gpuMaxLength + 30`. With a radiator on a mount that has a `gpuPenalty`, it is within `gpuMaxLength − gpuPenalty + 2` to `gpuMaxLength − gpuPenalty + 30`. With a radiator on a mount whose penalty is 0, the first range still holds | Unit test |
| B4 | Free height over the processor is within `coolerMaxHeight + 1` to `+ 15` in every case | Unit test |
| B5 | The supply bay length is within `psuMaxLength + 2` to `+ 40` in every case | Unit test |
| B6 | Each cooler with a `ramClearance` leaves that height over the memory slots, within 3 mm | Unit test |
| B7 | Every case has an anchor for every fan mount, radiator mount and bay in its catalog entry, and every board has anchors for its slot counts | Unit test |
| B8 | Every part's rigid geometry stays inside its declared collision boxes, within 1 mm | End to end test that calls `__pcb.bounds` for every part, every case finish and both fan sizes |
| B9 | In every case the inside of the glass or side panel is at least 34 mm beyond the outer edge of the tallest graphics card that passes `check` there | Unit test |

## C · Flows

End to end tests with real input events against the preview build, in Chromium unless the item says otherwise.

| Id | Item |
| --- | --- |
| C1 | Keyboard only: from an empty bench, build the Night Rig preset part by part, with its fans, drives, cable colorway and the name "Night Rig". The share code equals the fixture's `encoded` value. |
| C2 | Mouse: drag every category of part from the tray to a socket and it installs |
| C3 | Touch, phone viewport, raw touch events through a CDP session: long press and drag installs a part. A swipe on the card row scrolls and installs nothing. Tap a card then tap a socket installs. |
| C4 | A blocked drag shows the rule's message and changes nothing. Tested for `GPU_LENGTH`, `COOLER_HEIGHT`, `RAM_CLEARANCE`, `PSU_FORM` and `BOARD_SIZE`. |
| C5 | A case swap that removes parts shows the notice with the right title and lines. Undo restores the exact build. Redo applies it again. |
| C6 | Remove by the selection menu, by dragging out, by Delete, and by the spec sheet's Remove button |
| C7 | Reload restores the current build. With browser storage blocked the app runs and nothing throws. |
| C8 | For each preset: copy the link, open it in a fresh context, and the build's share code equals the fixture's |
| C9 | A bad link and a newer version link each show their message and the empty bench offer. A link with unknown parts loads the rest and says parts were left out. |
| C10 | Save, rename, load and delete a build. Saving at the limit asks before replacing the oldest. |
| C11 | Every lighting control changes the build and survives a reload. An override on one target changes only that target's zones. Off turns only that target dark. Checked with `__pcb.zones()`. |
| C12 | Power is disabled with the right reason on an incomplete build and on a build over its supply. It turns on and off on every preset. |
| C13 | Showcase, Exploded, Airflow, Glass and the Inspector each open and close from the interface and by their shortcuts |
| C14 | Poster export writes a PNG of the stated size in both formats |
| C15 | Fans: install per mount, fill empty mounts, clear, and a radiator taking mounts removes the fans there with a notice |
| C16 | Storage steppers stop at each limit with the right message as the board and case change |
| C17 | Reduced motion: no travel in transitions, the intro is a still, the tour does not run |
| C18 | In WebKit and in Firefox: the app loads, shows a preset, installs a part by tap, and logs no errors. These are the `@smoke` tests, run with `npm run e2e:smoke` |
| C19 | With WebGL 2 unavailable the app shows its plain message and a still image, with no errors |
| C20 | A tap on a card whose part has one possible place installs it at once. A tap on a fan card with several free mounts shows the sockets and installs nothing until one is tapped. Enter on a fan card four times fills four different mounts |
| C21 | Double click on a part glides the camera to it, and Escape and the reset control each return. Zooming in stops at the caps in `kit/04-WORLD.md`. Checked with `__pcb.camera()` |
| C22 | Forcing High, Medium and Low in Settings each takes effect and survives a reload. Checked with `__pcb.tier()` |
| C23 | Remove and swap play a motion in every category: between the action and the settled state, `__pcb.pose` reports positions that are neither the start nor the end. With reduced motion the same test sees no travel. The final build equals the engine's result each time |

## D · Looks

| Id | Item | Evidence |
| --- | --- | --- |
| D1 | Every required shot is defined under its exact name: 358 shots, with the count of each group right | `npm run check:shots` reports no name or count problem |
| D2 | Every shot's image comes from the final build and has a critic PASS, or the shot is on the weak list under its rule | `npm run check:shots` exits with no problems. Log the line it prints, including the weak count |
| D3 | Every part has a thumbnail rendered from the Inspector, and every tray card shows one | Unit test for files, **shots** for the tray: `ui-desktop/03` |
| D4 | The five Night Rig views and its six named macros were each passed by a critic that was given the matching reference shot | `npm run check:shots -- rig/night-rig macro/night-rig` exits with no problems. The check refuses a pass without the reference |
| D5 | The world is deterministic | Taking the 30 `rig` shots again prints `same` for every one |

## E · Rules of the house

| Id | Item | Evidence |
| --- | --- | --- |
| E1 | No em dash anywhere in `src/`, `public/` text files or `index.html` | `npm run check:copy` |
| E2 | No pure black or pure white in any stylesheet or token | `npm run check:copy` |
| E3 | No real hardware maker's name in source or catalog, and no real maker's logo or product shape on a part | `npm run check:copy` against its maker list, and `npm run check:shots -- contact` for the twelve contact sheets |
| E4 | No runtime request leaves the app's own origin | End to end test that records every request during a full flow |
| E5 | No console errors during the flows in section C, and no warnings from the app's own code. Any warning a library still prints is listed in PROGRESS with the reason it cannot be removed | End to end tests fail on any error and collect warnings |
| E6 | The product name appears under `src/` and `public/` only as the catalog constant | `npm run check:copy` |
| E7 | The app has no AI feature, calls no model and names no AI product or company. The About line is the only place the word AI appears | `npm run check:copy` |
| E8 | Nothing was pushed, deployed or published, and the repository has no remote | `git config --get-regexp remote` prints nothing, and `git status` is clean |

## P · Performance

Measure on the lit Night Rig hero view through the hook.

Items P1, P2, P3 and P7 depend on the graphics hardware. They apply when the harness has a hardware renderer. If it has only a software renderer, record each of those four as "not measured, software renderer", with the number you saw, and say so in the Handoff section. Do not record a software number as a pass or a fail. Items P4, P5 and P6 do not depend on the renderer and always apply.

| Id | Item |
| --- | --- |
| P1 | High at 1440 × 900: median frame time at most 20 ms and 95th percentile at most 33 ms, from `__pcb.stats(5)` |
| P2 | Medium at 1440 × 900: median at most 16.7 ms |
| P3 | Low at 390 × 844: median at most 10 ms, as a stand in for a phone |
| P4 | With the power off and no input, `__pcb.stats(2)` reports 0 frames |
| P5 | Draw calls and triangles for the Night Rig on High and Low are logged next to the targets in `kit/04-WORLD.md`. A number over its target is explained in one line |
| P6 | The built JavaScript is under 1.5 MB gzipped in total, and `public/thumbs/` is under 4 MB |
| P7 | `__pcb.timing().firstFrameMs` is under 4000 on the local preview, on a second load |

## G · Access

| Id | Item | Evidence |
| --- | --- | --- |
| G1 | Every interactive element is reachable and operable by keyboard with a visible focus ring | End to end tab walk |
| G2 | Dialogs trap focus, close on Escape and return focus | End to end |
| G3 | Build actions are announced in the live region with the right sentence | End to end |
| G4 | Text contrast is at least 4.5 to 1 for every token pair in use | Unit test over the token table |
| G5 | Touch targets are at least 44 px on the tablet and phone layouts | End to end measurement of every button's box |
| G6 | The canvas has a descriptive label and the full spec sheet lists every installed part with a Remove button | End to end |

## H · Repository

| Id | Item | Evidence |
| --- | --- | --- |
| H1 | From a fresh install in place, everything passes: `rm -rf dist`, `npm ci`, then `npm run typecheck`, `npm run test`, `npm run build`, `npm run e2e:all`, `npm run check:copy` and `npm run check:shots` | Run them last, in that order, and log each |
| H2 | `README.md` exists and covers running, testing, the kit, the Partner and deploying | Read it |
| H3 | Every phase has its commit | `git log --oneline`. The clean working tree is checked after the final commit, in Phase 10 step 7 |
| H4 | `kit/PROGRESS.md` is complete: phase table, environment, decisions, group results, QA results, Handoff | Read it |
| H5 | The feature list F01 to F38 in `kit/01-PRODUCT.md` is fully built. List each id with the gauntlet items and the shots that cover it. Every id has at least one. If you find a feature with none, write the test first | A table in PROGRESS under "Feature coverage" |
