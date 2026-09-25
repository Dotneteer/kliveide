# Cambridge Z88 TypeScript Removal Plan

Status: **Done on 2026-09-25** (started on the author's request, which ended the comparison period of
`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`). The outcome is at the end ("Result").

## Goal

Remove the TypeScript Cambridge Z88 emulation. The WASM core
(`src/emu/machines/z88/wasm/`, adapter `Z88WasmV2Machine`) has been the default since
2026-09-19 (Step 14), and the TypeScript machine has stayed selectable under "Cambridge Z88
(TypeScript)" (`<id>-ts`) as the parity oracle. After this plan:

- one Z88 backend, with no switch and no comparison menu;
- a saved `<id>-ts` (or older `<id>-wasm`) model id opens as `<id>`;
- every test that compared the two backends asserts fixed values on WASM instead, and no test loses
  its coverage.

## What Exists Today (the inventory, 2026-09-19)

TypeScript emulation, to delete (`src/emu/machines/z88/`):

- `Z88Machine.ts`, `Z88BlinkDevice.ts`, `Z88ScreenDevice.ts`, `Z88KeyboardDevice.ts`,
  `Z88BeeperDevice.ts`;
- their interfaces: `IZ88DeviceHost.ts`, `IZ88BlinkDevice.ts` (it also holds the `COMFlags`,
  `INTFlags`, `STAFlags`, `TSTAFlags`, `TMKFlags` enums), `IZ88BlinkTestDevice.ts`,
  `IZ88KeyboardDevice.ts`, `IZ88ScreenDevice.ts`, `IZ88BeeperDevice.ts`;
- the cards and banked memory: `memory/Z88BankedMemory.ts`, `memory/Z88MemoryCardBase.ts`,
  `memory/Z88RamMemoryCard.ts`, `memory/Z88RomMemoryCard.ts`, `memory/Z88UvEpromMemoryCard.ts`,
  `memory/Z88IntelFlashMemoryCard.ts`, `memory/Z88AmdFlashMemoryCard.ts`,
  `memory/Z88AmdFlash29F040B.ts`, `memory/Z88AmdFlash29F080B.ts`, `memory/CardType.ts`
  (`createZ88MemoryCard`), `memory/IZ88MemoryCard.ts`, `memory/IZ88MemoryOperation.ts`,
  `memory/Z88PageInfo.ts`, `memory/Z88CardsState.ts`.

Shared, to keep:

- `z88MachineInfo.ts`, `z88CardCatalog.ts`, `IZ88IdeMachine.ts`, `Z88KeyCode.ts`,
  `Z88KeyLayout.ts`, `Z88KeyMappings.ts`, `Z88WasmHost.ts`, `Z88WasmV2Machine.ts`,
  `Z88MachineFactory.ts` (reduced), `wasm/`;
- `memory/CardIds.ts` and `memory/CardSlotState.ts`: plain data the renderer's card UI uses
  (`Z88ToolArea.tsx`, `z88Cards.ts`, the insert/remove card dialogs). Move them next to
  `z88CardCatalog.ts` when `memory/` empties, updating every consumer to the new direct path (no
  re-export files - `AGENTS.md`).

The switch and the comparison menu, to remove:

- `Z88Implementation.ts` (`DEFAULT_Z88_IMPLEMENTATION`, `getZ88Implementation`),
  `MC_Z88_IMPLEMENTATION` in `src/common/machines/constants.ts`, the TypeScript branch of
  `createZ88Machine`;
- the `createModelTwins(... "-ts" ...)` block in `machine-registry.ts`. `createModelTwins`
  (`model-twins.ts`) and `MachineModel.menuGroup` / `createMachineTypesMenu` are generic: keep them
  only if another machine uses them by then, otherwise delete them with their tests.

Tests that use the TypeScript machine:

- `test/z88/`: `Z88TestMachine.ts`, `TypeScriptZ88Surface` in `z88-backends.ts`, the TypeScript
  parts of `z88-host.test.ts`, `z88-neutral-modules.test.ts` (the spec-vs-factory agreement test),
  `Z88MachineFactory.test.ts`;
- `test/harness/z88/`: the `"typescript"` backend of `createHarnessZ88Machine` and
  `z88HarnessBackends`;
- `test/wasm/z88/`: `wasm-z88-parity.test.ts`, `wasm-z88-ide-parity.test.ts`, the cross-backend
  parts of `wasm-z88-debug-step.test.ts`, `wasm-z88-separation.test.ts`,
  `wasm-z88-benchmark.perf.test.ts`;
- `test/audio/AudioIntegration.test.ts` (it drives `Z88BeeperDevice`);
- tooling: `scripts/benchmark-z88-wasm.cjs` (TypeScript vs WASM) and `scripts/z88-app-pass.cjs`
  (`<id>-ts` vs `<id>`).

## Steps

### Step 0 - Tag and freeze

- Tag the last commit with the TypeScript Z88 (for example `z88-typescript-last`) and record it
  here. It is the oracle to go back to if a WASM behaviour is ever in doubt.
- Run the whole Validation list below and record the counts; they are the baseline this plan must
  not lose.

### Step 1 - Turn the comparisons into fixed assertions

Before anything is deleted, so the oracle still produces the values:

- Parity (`wasm-z88-parity.test.ts`): for each comparison (the ten OZ boots and typing sessions,
  the five LCD sizes, the beeper rates, the card scenarios, the mixed-program lockstep) record the
  TypeScript side's result at each checkpoint - registers, tacts, frames, Blink state, and hashes
  of the 4 MB, the picture and the samples - into a golden file under `test/wasm/z88/goldens/`, and
  assert the WASM side against it. Keep the exact expectations the tests already state (card
  contents, `PRINT 6*7`-style behaviour); the hashes cover everything else.
- IDE parity (`wasm-z88-ide-parity.test.ts`): the same, for the processor's answers.
- Debugger (`wasm-z88-debug-step.test.ts`): the per-backend suites stay; the "both backends stop at
  the same places" suites become fixed stop lists.
- Core suites (`test/z88/memory-*`, `rtc`) and session suites (`z88-*`): their assertions are
  already absolute; they simply stop running on the TypeScript backend.
- Beeper (`test/audio/AudioIntegration.test.ts`): rewrite its Z88 part against the WASM machine,
  keeping the same sample expectations.
- A golden that the WASM side cannot match is a finding: settle it against the hardware
  documentation (the migration plan's rule), never by editing the golden to fit.

### Step 2 - Remove the switch and the TypeScript models

- Delete the `"-ts"` twins from the registry and add `<id>-ts` to `modelIdAliases` (keep the
  `<id>-wasm` entries). Test: every `-ts` and `-wasm` id resolves; a saved project with a `-ts` id
  and `z88Implementation: "typescript"` opens on the original model (the leftover key is ignored).
- Delete `Z88Implementation.ts` and `MC_Z88_IMPLEMENTATION`; `createZ88Machine` always creates
  `Z88WasmV2Machine`. Search for `z88Implementation` in saved-project fixtures and docs.
- Tests: `Z88MachineFactory.test.ts` shrinks to "the factory creates the WASM machine" and the
  alias tests; `machine-types-menu.test.ts` returns to "the real menu is flat" (or keeps the generic
  group tests with a synthetic registry, if the menu support stays).

### Step 3 - Delete the TypeScript emulation

- Delete the files listed under "TypeScript emulation". Move `CardIds.ts` / `CardSlotState.ts` as
  described, and update their consumers.
- Delete `Z88TestMachine.ts`, `TypeScriptZ88Surface` and the harness's `"typescript"` backend;
  `z88Backends` / `z88HarnessBackends` / `Z88_WASM_FEATURES` go too - every suite runs on the one
  machine.
- `wasm-z88-separation.test.ts` has nothing left to separate from: replace it with a check that no
  file imports a deleted path (or delete it once the build proves that).
- `scripts/benchmark-z88-wasm.cjs`: keep the WASM figures (and the scenarios) as a regression
  benchmark; drop the TypeScript column and the perf test's speed-up gate, or replace it with an
  absolute ms/frame budget.
- `scripts/z88-app-pass.cjs`: drop the comparison; keep it as a single-backend app smoke test, if it
  has been made reliable (Step 13 of the migration plan says it is not yet).
- After moving and deleting files: scan alias and relative imports, run
  `npx electron-vite build --config build/electron.vite.config.ts` (`AGENTS.md`).

### Step 4 - Documentation

- `src/emu/machines/z88/wasm/README.md`: "Behaviour pinned from the TypeScript oracle" becomes the
  behaviour the core implements, and why (sources: the Blink documentation, OZvm).
- `test/z88/README.md` and `test/harness/z88/README.md`: one backend.
- `.ai/wasm-migration-intent-and-lessons.md`, `.ai/wasm-v2-machine-migration-guide.md`: record the
  removal (what the goldens replaced, anything the removal found).
- Archive `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md` and this plan as done.

## Validation

```sh
npm run build:z88-wasm
npm run check:z88-wasm-size
npm run check:wasm-cpu-contract
npx vitest run --config build/vitest.config.ts --project=node
npx vitest run --config build/vitest.config.ts --project=jsdom
npx vitest run --config test/wasm/vitest.z80.config.ts
npm run build:check
npm run lint:renderer
npx electron-vite build --config build/electron.vite.config.ts
git diff --check
```

Compare the case counts with Step 0's: the Z88 suites lose only their TypeScript runs, never a
WASM case.

## Result (2026-09-25)

**Step 0.** Tag `z88-typescript-last` = `79cf5300c` (the last commit with the TypeScript Z88).
Baseline, all green: node project 17,931 passed / 118 skipped (18,049); jsdom 1,181; z80 corpus 1,473.
The migration plan had already been deleted from `.plans/` (in #1371), so only this plan is marked
done here.

**Step 1.** Goldens recorded from the TypeScript machine alone, then asserted on WASM while both
existed; the core matched all of them first time, and corrupting a golden made its test fail.
`test/wasm/z88/goldens/`: `wasm-z88-parity.json` (758 checkpoints: 10 OZ boots x 9, 10 typing
sessions x 46 digests, 30000-instruction lockstep in 30 digests, frames and runTo, 5 beeper rates
and a rate change, 5 LCD sizes, 30 card scenarios x 3), `wasm-z88-ide-parity.json`,
`wasm-z88-debug-step.json` (the stop lists), `wasm-z88-machine.json` (setup per model),
`z88-card-factory.json` (the card factory's answer for every id and size). Identity, partition,
LCD-size and card-file comparisons became literal expectations. `AudioIntegration.test.ts`,
`z88-host.test.ts` and `partition-descriptions.test.ts` run on the WASM machine.

**Step 2.** No other machine used `createModelTwins` or `menuGroup`: both are deleted with their
tests, and the machine menu is flat again. `<id>-ts` joined `<id>-wasm` in `modelIdAliases`.

**Step 3.** `CardIds.ts` and `CardSlotState.ts` moved to `src/emu/machines/z88/`. The Blink flag enums
the core suites use moved to `test/z88/z88-blink-flags.ts` (no source needs them).
`wasm-z88-separation.test.ts` became `test/z88/z88-typescript-removed.test.ts` (the deleted modules
stay deleted and unimported, alias and relative, type imports included). The benchmark keeps the
WASM figures; the perf test's speed-up gate became an absolute budget (0.5 ms per frame, 10 ms per
200 debugger steps). `z88-app-pass.cjs` stays as a single-model smoke test (one model per run is
reliable; all ten in one run still are not) without the comparison.

Found by the removal: the harness rebuilt the WASM artifact on first use in every test file (each
file has a fresh module scope). While the TypeScript cases ran first in each file the builds were
spread out; without them about 45 builds of 1.5 s queued on the build lock at the start of a run and
timed out the first test of the files at the back. `z88WasmArtifactBytes()` now builds only when the
artifact is missing or older than its C sources or the build script.

**Validation.** All green. node project 16,925 passed / 118 skipped (17,043); jsdom 1,181; z80
corpus 1,473; `build:check` (baseline lowered by the two deleted files' entries), `lint:renderer`,
the electron-vite build, `build:z88-wasm`, `check:z88-wasm-size`, `check:wasm-cpu-contract`,
`git diff --check`. Every suite that ran per backend kept exactly its WASM cases (for example
`memory-write` 522 -> 261, `z88-lcd` 38 -> 19, the harness self-tests 20 -> 10, the debugger
40 -> 25): 989 TypeScript runs in all. The other 20 cases that went (3 new ones came) tested what
was removed: the backend switch and twins
(`Z88MachineFactory` 20 -> 10), the menu groups (6 -> 4), the separation test (6, replaced by 3),
the per-backend code-injection case and the TypeScript machine's use of the shared modules (covered
on WASM by `wasm-z88-machine.test.ts`).
