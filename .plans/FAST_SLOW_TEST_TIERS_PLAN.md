# Fast and slow test tiers

## Problem

`test.yml` ran every tier (`npm run test:all`) in one job: ~29 minutes on GitHub (2026-10-18,
run 39124233957: setup 3 min, tests 29 min). `release:prepare` ran the same gate locally. Target:
**≤ 10 minutes on GitHub**, **≤ 3 minutes locally** for the fast part, and the slow part run only
deliberately — when a plan is about to complete and before a release is prepared, never by the
release process itself.

## Measurements (local, 14 cores, full run, 2026-10-18)

Full run: 4:42 wall, 1281 files, ~2400 file-seconds (`node` 123, `jsdom` 161, `e2e-cores` 1570,
`e2e-kbasic` 542). Per-file times under full contention; they rank files, not predict solo runs.
The heaviest files are exhaustive sweeps: the zxbc compatibility suites, the optimiser report over
the corpus, every-ROM loaders, reverse-debugging/recording matrices across machines, determinism
and export-contract checks that build the cores twice. Moving 19 of them out, and splitting the
Klive BASIC corpus by optimise level (0 and 3 fast, in two files; 1 and 2 slow), leaves the fast set
at ~1200 file-seconds.

## Decisions (answered by the project author)

- D1. Slow tests also have a **manual GitHub workflow** (`slow-tests.yml`, `workflow_dispatch`
  only). Push, PR and release never run them.
- D2. `test.yml` **splits into parallel jobs**: type-check, unit, Klive BASIC e2e, and the cores'
  e2e in shards. Wall time is the longest job.
- D3. `release:prepare` runs the **fast** tiers and **warns (does not fail)** when the slow tier has
  not passed locally on the current inputs.

## Design

- `build/e2e-tests.ts` gains `E2E_SLOW_TESTS`: exact file paths, a subset of the two e2e lists.
  `e2e-cores`/`e2e-kbasic` exclude them; a new vitest project `e2e-slow` includes them.
- `scripts/run-tests.cjs` modes:
  - `npm test` — unit + changed fast e2e tiers (unchanged behaviour; slow never).
  - `npm run test:e2e` — the fast e2e tiers, forced.
  - `npm run test:fast` — unit + fast e2e, forced. CI's and the release's gate.
  - `npm run test:slow` — the slow tier, forced.
  - `npm run test:all` — everything, slow included. The plan-completion / pre-release gate (the
    many plans that say "`test:all` at completion" keep their meaning).
  - `npm run test:slow-status` — exit 0 when `e2e-slow` passed on the current inputs, 1 otherwise.
  - Each tier stamps its fingerprint on a pass, as before; `e2e-slow`'s inputs are the Klive BASIC
    tier's (cores + compiler + assembler).
- Budget rule, kept by `npm run test:timings`: a fast-tier file that takes more than 20 s in a full
  run moves to `E2E_SLOW_TESTS` (or gets cheaper).

## Steps

1. [x] Measure.
2. [x] Slow list, `e2e-slow` project, runner modes, npm scripts, timings script, a unit test that
   every slow entry exists and belongs to a fast e2e list (`test/e2e-tiers.test.ts`). The corpus
   runner moved to `test/kbasic/corpus/corpus-run.ts`, run by `corpus.test.ts` (level 0),
   `corpus-o3.test.ts` (level 3) and `corpus-levels.test.ts` (1 and 2, slow).
3. [x] `test.yml` parallel jobs (type-check; unit in 2 shards; kbasic; cores in 3 shards); `slow-tests.yml`
   (manual, 3 shards).
4. [x] `release.cjs` uses `test:fast` + the slow-status warning.
5. [x] AGENTS.md, `.ai/release-guide.md`, `.plans/RELEASE_AUTOMATION_PLAN.md` note.
6. [ ] Verify. Local, 2026-10-18: `npm run test:fast` **2:24** wall (was 4:42 for everything),
   1264 files pass; `npm run test:slow` 2:15, 20 files pass; `test:slow-status` turns fresh after
   it. GitHub, first run (39128490501, one unit job): **8:22** wall; unit 8:18, kbasic 3:18, cores
   shards 2:18-4:14, type-check 1:28. The unit job was the longest, so it was split in two.

## Results

| Run | Before | After |
| --- | --- | --- |
| Local, fast set (`test:fast`) | 4:42 (everything) | 2:24 |
| Local, slow tier (`test:slow`) | - | 2:15 |
| GitHub `test.yml` | ~32 min, one job | 8:22 (one unit job; then split in two) |
