# Addendum 01 · Fewer judging rounds

Applies from the moment it is read, for the rest of the build. It overrides the kit where it says so and changes nothing else.

## What changes

The number of times a shot is judged, and who judges it. Nothing about what gets built changes. Every part, case, screen, feature and flow in the kit is still built to the same standard. The critic looks at each 3D shot once instead of until it passes.

## Why, in Brandon's words

The work so far looks better than anything he has seen done in code, and the repeated critic rounds on shots that already looked right are where the time is going. He trusts the Builder's own judgment on the interface and motion, and he would rather have the finished product sooner than have every shot pass a fresh critic three times.

## The exact specification

1. **One critic round for 3D shots.** A shot in the groups `rig`, `bench`, `finish`, `macro`, `part`, `cable` and `light` goes to a critic once, the first time your own verdict passes it. If the critic fails it, fix what it named, retake, open the new image, and record your own verdict. Your PASS on that new image is the gate. Do not send it to a critic again. Contact sheets follow the same rule.

2. **No critic for the rest.** Shots in `mode`, `motion`, `drag`, `tier`, `ui-desktop`, `ui-tablet` and `ui-phone` are judged by you alone, against the checklists in `kit/07-QUALITY-BAR.md`. Your PASS is the gate. Judge them as honestly as before. Open every image.

3. **No re-judging after shared changes.** When a change to a material, the lighting, the post chain or anything else shared touches shots that already passed, leave those shots alone. Do not retake them until Phase 10. Gate 7's line about retaking the `rig`, `bench`, `finish`, `macro` and `cable` shots becomes: retake them, and record your own verdict on each image that changed.

4. **Phase 10 is one retake, judged by you.** Retake every shot once. For every image that changed, open it and record your own verdict. Fix real faults and retake those. No critic sweep. The only critic calls in Phase 10 are for the six `rig/<preset>-hero` shots, once each, under rule 1.

5. **The weak list is no longer needed.** With rules 1 and 2 every shot can be passed by your own verdict after at most one critic round, so `kit/WEAK-SHOTS.json` stays unused. If a shot still cannot pass your own honest verdict after four rounds, do the research and rebuild step once, then record your verdict and move on, noting it in the Handoff.

6. **The scripts.** `kit/06-ARCHITECTURE.md` forbids changing the gate scripts. This addendum allows exactly these changes, and no others. In `scripts/check-shots.mjs`:
   - A shot in the groups of rule 2, and any contact sheet, is in order when the newest verdict on its current image is a PASS from either `builder` or `critic`.
   - A shot in the groups of rule 1 is in order when the newest verdict on its current image is a critic PASS, or when it is a builder PASS and the ledger holds at least one critic verdict for that shot on any image.
   - The reference requirement (the `REFERENCES` table) applies only to critic verdicts. A builder PASS needs no reference.
   - The two-critics limit and the weak-shot rule no longer apply. Remove or bypass them.
   - Everything else stays: required names, group counts, the manifest check against the current build and definition, the hash on every verdict, critic verdicts only through saved answers under `kit/critics/`.
   Keep the comment at the top of the file true after the change. Run the check on a group that already passed to prove it still passes, and on a shot with no verdict to prove it still fails.

7. **Tests that go.** Items A5, B1, B8, D5 and G5 of `kit/09-QA-GAUNTLET.md` are dropped. B2 to B7 and B9 stay. Section P becomes logging only: measure and record every number, nothing passes or fails on it. H1 runs `npm ci`, typecheck, test, build, `npm run e2e` once, `check:copy` and `check:shots`; skip `e2e:all` and `e2e:smoke` unless Phase 9 step 5 was already done, in which case log that result and do not run it again. Every other gauntlet item stays.

8. **Gates.** Every "Shots pass" line in `kit/08-BUILD-ORDER.md` stays as written. The check decides, under the rules above. Gate 2's reference line is already met. Gate 3 and Gate 4's contact sheet lines are met under rule 1.

## Which kit statements it overrides

- `kit/07-QUALITY-BAR.md`: "The loop" steps 6 and 7, "The critic" rules on fixing every FAIL and retaking, the two-critic limit, "Weak shots" in full, and the sentence about retaking every shot a shared change affects.
- `kit/08-BUILD-ORDER.md`: Gate 7's retake line, Phase 10 steps 1 and 2, and the sentence in the introduction that says nothing else counts as a pass for a shot.
- `kit/09-QA-GAUNTLET.md`: D2, D4, A5, B1, B8, D5, G5, section P and H1 as stated above.
- `kit/06-ARCHITECTURE.md`: the sentence that forbids changing `scripts/check-shots.mjs`, for the changes in rule 6 only.
- `CLAUDE.md`: the quality rule's sentence "Iterate until it passes the bar and a fresh critic agent passes it too" becomes "Iterate until it passes the bar in your own honest verdict, with one critic round for 3D shots."

## What must still be true

- The detail minimums, the fail list, the five tests and the checklists in `kit/07-QUALITY-BAR.md` are unchanged. A shot that fails any of them is not passed, whoever judges it.
- Every shot is still opened with the Read tool before it is judged. A verdict without looking does not count.
- Every feature F01 to F38 is still built and covered in the Feature coverage table.

## Done when

- The script change in rule 6 is made, proven both ways, committed, and logged under Decisions made by the Builder with this addendum's name.
- The rest of the build proceeds under these rules to `BUILD COMPLETE`.
