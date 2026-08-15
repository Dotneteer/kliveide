# ZX Spectrum WASM Test Migration Plan

Created: 2026-08-15

## Goal

Create WASM-side device and machine tests for the ZX Spectrum 48K, 128K, +2,
and +3 implementations so they can carry the same behavioral confidence as the
existing TypeScript tests.

Keep every original TypeScript test. Add WASM tests as sibling coverage, using
the TypeScript machines as the oracle where behavior already has trusted tests.
For the Z80 CPU instruction suite specifically, preserve the existing
TypeScript test cases literally: do not change even a character of the copied
test case files. Any adaptation must happen in WASM-only infrastructure that
wraps the WASM implementation behind the same test-facing contract.

## Scope Notes

- Existing WASM implementations:
  - 48K: `ZxSpectrum48WasmV2Machine`, `Sp48WasmV2Loader`, `sp48.c`
  - 128K and +2-style 128K behavior: `ZxSpectrum128WasmV2Machine`,
    `Sp128WasmV2Loader`, `sp128.c`
  - +2E/+3E family: `ZxSpectrumP3eWasmV2Machine`, `SpP3eWasmV2Loader`,
    `spp3e.c`
- Existing WASM tests are smoke and adapter tests. They cover setup, build,
  factory selection, simple frame execution, basic memory, keyboard, tape,
  audio, disk sync, and a small amount of paging/floating-bus behavior.
- The TypeScript tests that should drive the WASM migration are mainly:
  - `test/z80/*.test.ts`
  - `test/z80/test-z80.ts`
  - `test/zxSpectrum/ula-contention.test.ts`
  - `test/memory/partition-parsing.test.ts`
  - `test/memory/PagedMemory.test.ts`
  - `test/audio/BeeperDevice.test.ts`
  - `test/audio/BeeperMameCompat.test.ts`
  - `test/audio/PsgChip.step1.test.ts`
  - `test/audio/PsgVolumePeriod.step34.test.ts`
  - `test/audio/PsgEnvStereo.step56.test.ts`
  - `test/audio/PsgRegisterMasking.step78.test.ts`
  - `test/audio/PsgCrossCheck.step912.test.ts`
  - `test/audio/PsgDevice.test.ts`
  - `test/audio/AudioIntegration.test.ts`
  - `test/disk/FloppyControllerDevice.test.ts`
- Tests that target reusable TypeScript-only helpers such as disk parsing,
  `BufferSpan`, `DiskCrc`, `DiskSurface`, or standalone `PagedMemory`
  should remain TypeScript-only unless equivalent C/WASM code owns that same
  behavior.

## Non-Goals

- Do not delete or rename TypeScript tests.
- Do not edit copied Z80 test case content when creating the WASM Z80 suite;
  only wrapper imports, runner wiring, and WASM infrastructure may change.
- Avoid changing existing WASM implementation files if at all possible. Prefer
  new test infrastructure files, test-only wrappers, adapter subclasses, import
  aliasing, and runner configuration.
- If the plan cannot be implemented without changing existing WASM
  implementation files, stop before implementation and report exactly which
  files/exports would need changes and why.
- Do not create backend-specific machine picker models.
- Do not restore the old hybrid WASM CPU-only architecture.
- Do not require UI or renderer tests for this migration unless adapter API
  changes affect renderer contracts.

## Test File Layout

Add WASM-focused test files under a separate folder so the WASM work stays
together:

- `test/wasm/z80/`
  - literal Z80 CPU test case copies from `test/z80/`
  - WASM-only Z80 test infrastructure and import aliases
- `test/wasm/zxSpectrum/`
  - `wasm-test-helpers.ts`
  - `wasm-machine-lifecycle.test.ts`
  - `wasm-memory-paging.test.ts`
  - `wasm-ports-keyboard.test.ts`
  - `wasm-contention.test.ts`
  - `wasm-screen-floating-bus.test.ts`
  - `wasm-beeper-audio.test.ts`
  - `wasm-psg-audio.test.ts`
  - `wasm-tape.test.ts`
  - `wasm-p3e-disk.test.ts`
  - `wasm-debug-step.test.ts`

Keep the existing adapter smoke files:

- `test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`
- `test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts`
- `test/zxSpectrum/sp48-wasm-v2-loader.test.ts`
- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`
- `test/zxSpectrum/spp3e-wasm-v2-loader.test.ts`
- `test/zxSpectrum/*-wasm-build.test.ts`

## Infrastructure First

### Step 1 - Dedicated WASM Test Tree

Status: Completed on 2026-08-15.

Create the dedicated WASM test folders:

- `test/wasm/z80/`
- `test/wasm/zxSpectrum/`

Move all new WASM-focused tests into these folders. Leave the existing
`test/zxSpectrum/*WasmV2*.test.ts` smoke tests in place unless a later cleanup
explicitly moves them as a separate, behavior-preserving action.

Definition of done:

- New WASM test files are created only under `test/wasm/`.
- Existing TypeScript tests remain in their current folders.
- Existing WASM smoke tests still pass from their current locations.

### Step 2 - Literal Z80 WASM Test Corpus

Status: Completed on 2026-08-15.

Create the Z80 WASM test corpus under `test/wasm/z80/` by copying the current
`test/z80/*.test.ts` files literally.

Rules:

- Do not change even a character in the copied Z80 test case files.
- Do not rewrite expectations, descriptions, whitespace, helper calls, or
  imports inside the copied test case files.
- If the copied tests need to resolve `./test-z80`, provide a WASM-compatible
  `test/wasm/z80/test-z80.ts` wrapper with the same exported API as
  `test/z80/test-z80.ts`.
- If import resolution cannot be handled by an adjacent wrapper alone, add
  Vitest/TypeScript aliasing or a generated wrapper layer outside the literal
  copied files.
- Keep the original `test/z80/` files as the TypeScript CPU suite.

Definition of done:

- A byte-for-byte comparison confirms every copied `*.test.ts` file under
  `test/wasm/z80/` matches its source in `test/z80/`.
- The only Z80 WASM-specific differences live in `test/wasm/z80/test-z80.ts`
  or runner/alias infrastructure.

### Step 3 - WASM Z80 Test Harness

Status: Completed on 2026-08-15.

Implement `test/wasm/z80/test-z80.ts` as a wrapper-compatible version of the
mature TypeScript Z80 test infrastructure.

It must preserve the exported names and behavior expected by the literal tests,
including:

- `RunMode`
- `Z80TestMachine`
- `Z80TestCpu`/`Z80NTestCpu` equivalents when exported by the current helper
- memory and port read/write helpers
- code injection helpers
- run modes such as one cycle, one instruction, until halt, and until end
- CPU register assertions and convenience accessors used by existing tests
- event/cycle hooks used by existing tests

WASM infrastructure requirements:

- Wrap the WASM Z80 CPU or full-machine WASM backend behind the same
  `Z80TestMachine`-facing contract.
- Prefer a minimal standalone Z80 WASM test host if available. If not
  available, use the smallest Spectrum WASM machine adapter that can expose the
  same CPU/memory/port contract.
- First attempt to satisfy missing observability/control through wrappers,
  existing exports, adapter subclasses, and test runner configuration.
- Add missing WASM exports only if wrappers cannot preserve the literal tests'
  contract. If this becomes necessary, pause before implementation and list the
  required existing WASM implementation changes for review.
- Keep test-only exports deterministic and clearly named.

Definition of done:

- The simplest copied tests, such as reset/basic NOP/register tests, run
  against the WASM wrapper without edits to the copied test case files.

Completion notes:

- Added `test/wasm/z80/test-z80.ts` as a WASM-backed wrapper for the literal
  copied Z80 tests.
- Added `test/wasm/z80/build-z80-wasm.cjs` to compile the existing standalone
  Z80 WASM core for tests without changing production WASM implementation
  files.
- Added `test/wasm/vitest.z80.config.ts` for opt-in execution of the literal
  copied WASM Z80 corpus while keeping the full copied corpus excluded from the
  default unit suite until tests are migrated in small batches.
- Added `test/wasm/z80-harness-smoke.test.ts` to keep the wrapper covered by
  the default unit suite.
- Verified `test/wasm/z80/standard-ops-00.test.ts` runs unchanged against the
  WASM wrapper.
- Known wrapper gaps from the current WASM CPU export surface: memory-operation
  history is not populated, Step-Out stack observations for CALL/RET
  instructions are not yet synthesized, and copied tests importing the
  TypeScript `Z80Cpu` directly will need runner aliasing or a compatible
  wrapper export before migration.

### Step 4 - Shared Spectrum WASM Test Harness

Status: Completed on 2026-08-15.

Create `test/wasm/zxSpectrum/wasm-test-helpers.ts`.

The helper should provide:

- `buildSpectrumWasmArtifacts()` or per-model lazy build helpers that call:
  - `buildSp48Wasm()`
  - `buildSp128Wasm()`
  - `buildSpP3eWasm()`
- `testRom(bytes: number[], size = 0x4000): Uint8Array`
- factory helpers with deterministic in-memory ROMs:
  - `createTestSp48WasmMachine(rom?)`
  - `createTestSp128WasmMachine(rom0?, rom1?)`
  - `createTestSpp3eWasmMachine(romPages?, options?)`
- matching TypeScript oracle helpers:
  - `createOracleSp48Machine(rom?)`
  - `createOracleSp128Machine(rom0?, rom1?)`
  - `createOracleSpp3eMachine(romPages?, options?)`
- neutral assertion helpers:
  - `expectNormalizedSamples(samples)`
  - `expectSameCpuStateSubset(wasmMachine, tsMachine, fields)`
  - `expectSameMemoryReads(wasmMachine, tsMachine, addresses)`
  - `expectSamePartitions(wasmMachine, tsMachine)`
- model matrix helpers:
  - `for48And128AndP3e(cases)`
  - `for128Family(cases)`
  - `forP3eDiskModels(cases)`

Definition of done:

- Existing WASM adapter tests can be refactored to use the helper without
  changing their assertions.
- `npm test -- --project node test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts`
  passes.

Completion notes:

- Added `test/wasm/zxSpectrum/wasm-test-helpers.ts` with lazy per-model build
  helpers, deterministic ROM creation, WASM machine factories, TypeScript oracle
  factories, shared assertions, and model matrix helpers.
- Added `test/wasm/zxSpectrum/wasm-test-helpers.test.ts` to verify the helper
  creates working 48K, 128K, and +3E WASM machines and matching TypeScript
  oracles.
- Existing adapter tests remain in place; the helper is ready for incremental
  refactoring and new migrated tests.

### Step 5 - WASM Test Control Surface

Status: Completed for the test-only control surface on 2026-08-15.

Add a small test-only control surface instead of reaching into private adapter
state from every test.

Expose these through public adapter methods where they are useful outside tests,
or through clearly named test subclasses in `wasm-test-helpers.ts` when they
are only test controls:

- load fixed ROM pages before setup and reset;
- initialize code bytes at an address;
- execute exactly one WASM instruction;
- set/get CPU registers needed by migrated tests:
  - `AF`, `BC`, `DE`, `HL`, `IX`, `IY`, `IR`, `PC`, `SP`, `IFF1`,
    interrupt mode, halted state;
- set absolute tacts and current-frame tact consistently;
- read total contention delay since last reset;
- reset contention counters;
- override contention table values for a frame tact range;
- read model-specific state:
  - selected ROM page;
  - selected RAM bank;
  - shadow screen flag;
  - +3E special paging mode and config;
  - disk motor/current drive/FDC phase where already exported.

WASM exports likely needed:

- 48K:
  - `sp48DelayAddressBusAccess`
  - `sp48DelayPortRead`
  - `sp48DelayPortWrite`
  - `sp48GetContentionValue`
  - `sp48SetContentionValueForTest`
  - `sp48GetTotalContentionDelaySinceStart`
  - `sp48ResetContentionCountersForTest`
  - setters for missing CPU fields used by contention tests, especially `I`
    through `IR`
- 128K:
  - same contention/test exports as 48K, using `sp128` names
  - `sp128SetSelectedBankForTest` if port writes are not the correct setup for
    a given migrated TypeScript test
- +3E:
  - same contention/test exports as 48K, using `spp3e` names
  - `spp3eExecuteInstruction`
  - CPU register/bus event exports equivalent to 48K/128K
  - `spp3eSetSelectedBankForTest`
  - `spp3eSetSpecialPagingForTest`

Guardrails:

- Keep test-only exports deterministic and simple.
- Do not use test-only exports in production code paths.
- Prefer executing public port writes over test-only state mutation when the
  test is about the public machine contract.
- Treat edits to existing WASM implementation files as a last resort. Before
  making such edits, report the blocker and the smallest proposed change.

Definition of done:

- A single new smoke test can load a two-instruction ROM, execute one WASM
  instruction on 48K, 128K, and +3E, and compare `PC`, `tacts`, and memory
  effects with the TypeScript oracle.
- For +3E, this step removes the current limitation where debug frames fall
  back to the TypeScript runner.

Completion notes:

- Extended `test/wasm/zxSpectrum/wasm-test-helpers.ts` with test-only controls
  for ROM uploads, code initialization, single C-owned instruction execution,
  WASM memory/port reads and writes, CPU pair register getters/setters, absolute
  tact setting, current-frame tact reads, contention counters, contention value
  reads, 128K/+3E contention value overrides, and model-specific paging/FDC
  state reads.
- Added `test/wasm/zxSpectrum/wasm-test-control-surface.test.ts`, which loads a
  two-instruction ROM, executes one WASM instruction on 48K, 128K, and +3E, and
  compares `PC`, `tacts`, and memory effects with the TypeScript oracle.
- No existing WASM implementation files were changed.
- Remaining limitations without changing existing WASM implementation files:
  48K does not expose a WASM contention-table setter; full-machine exports do
  not uniformly expose `IR`, `IFF1`, interrupt-mode, or halted setters; and the
  production +3E adapter still falls back to the TypeScript runner for debug
  frames. The test helper now bypasses that fallback for single-instruction
  tests by calling `spp3eExecuteInstruction` directly.

### Step 6 - Loader Type Coverage For New Exports

Status: Completed on 2026-08-15.

Update the loader export types and required export lists:

- `src/emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader.ts`

Add one loader test per backend that proves the new test/control exports exist
and are callable.

Definition of done:

- `test/zxSpectrum/sp48-wasm-v2-loader.test.ts`
- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`
- `test/zxSpectrum/spp3e-wasm-v2-loader.test.ts`

all pass after the new export checks are added.

Implementation notes:

- Added the missing 48K v2 control/timing/contention/diagnostic exports to
  `Sp48WasmV2Exports` and the 48K loader's required export list.
- Added one callable-export loader smoke test for each v2 backend:
  `sp48-wasm-v2-loader.test.ts`, `sp128-wasm-v2-loader.test.ts`, and
  `spp3e-wasm-v2-loader.test.ts`.
- Updated the 48K fake loader instance used by validation tests so it covers
  the new required exports.
- No C/WASM implementation source files were changed for this step.

## Test Migration Steps

Each step below should be a small PR-sized slice. Keep the original TypeScript
tests in place, add WASM tests, run the focused WASM tests, then run
`npm run build:check`.

### Step 7 - Z80 WASM Suite Bootstrap

Status: First subset completed on 2026-08-15.

Enable the literal copied Z80 suite in small groups without editing copied test
case files:

1. Basic CPU reset and simple standard op tests.
2. Standard opcode pages.
3. Extended opcode pages.
4. IX/IY opcode pages.
5. Bit operation pages.
6. Interrupt, memory operation, and Next-op tests where supported.

When a group fails because the WASM wrapper lacks a helper feature, update the
wrapper or WASM test exports. Do not patch the copied test cases.

Acceptance:

- Every enabled copied Z80 test file remains byte-for-byte identical to its
  `test/z80/` source file.
- The active WASM Z80 subset runs from `test/wasm/z80/`.
- Any unsupported Z80N/Next-specific tests are tracked explicitly in this plan
  or in a local skip list outside the copied files.

Implementation notes:

- The active Step 7 subset is controlled by
  `test/wasm/vitest.z80.config.ts`, outside the copied test files.
- Enabled copied files:
  `test/wasm/z80/z80.test.ts` and
  `test/wasm/z80/standard-ops-00.test.ts`.
- Added `test/wasm/z80/Z80Cpu.ts` so copied tests that import
  `@emu/z80/Z80Cpu` can exercise the WASM-backed register API through a
  Vitest alias instead of editing the copied imports.
- Remaining copied Z80 groups stay present but inactive until the wrapper has
  the necessary helper coverage.

### Step 8 - Full Z80 WASM Instruction Parity

Status: Completed for all currently applicable copied Z80 tests on 2026-08-15.

Complete the copied Z80 test suite under `test/wasm/z80/`.

Acceptance:

- All applicable copied Z80 CPU tests pass against the WASM wrapper.
- Any deliberately non-applicable tests are excluded by runner configuration or
  wrapper-level capability gating outside the copied files, never by editing
  copied test case content.
- A byte-for-byte check is part of verification:

```sh
diff -rq test/z80 test/wasm/z80 --exclude test-z80.ts
```

The expected result is no differences for copied `*.test.ts` files.

Implementation notes:

- `test/wasm/vitest.z80.config.ts` now includes the copied Z80 test corpus and
  excludes only documented unsupported files.
- Active result: 74 copied Z80 WASM test files pass, covering 1,465 tests.
- `test/wasm/z80/memoryOp.test.ts` is the sole excluded copied test file; it is
  tracked in `test/wasm/z80/unsupported-tests.md` because the current
  standalone WASM Z80 export surface exposes only the final memory bus event,
  not the full per-instruction memory read/write history required by that
  test.
- Added wrapper support for copied direct `Z80Cpu` interrupt subclass tests and
  synthesized CALL/RST step-out stack observations in `test-z80.ts`.
- No copied Z80 test case file was edited.

### Step 9 - Lifecycle And Reset Parity

Status: Completed on 2026-08-15.

Add `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`.

Migrate and extend existing WASM smoke coverage into a matrix:

- 48K, 128K, +2/+3E setup initializes WASM runtime and ROM bytes.
- Hard reset keeps ROMs available and resets CPU/frame state.
- Soft reset preserves uploaded media where the TypeScript contract does.
- Normal frame execution increments frames once.
- Frame counters, `tacts`, `tactsInFrame`, and `frameJustCompleted` match the
  TypeScript oracle for a NOP ROM.
- Clock multiplier and audio sample rate writes are synchronized only when
  values change.

Acceptance:

- Existing adapter tests may remain or delegate to the new helper, but no
  coverage is removed.

Implementation notes:

- Added `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`.
- Covered 48K, 128K, and +3E setup through the shared WASM helper matrix; +2
  remains represented by the 128K backend path until a separate +2 WASM helper
  surface exists.
- Added hard-reset checks for ROM availability, cleared RAM, CPU reset state,
  frame count, and `frameJustCompleted`.
- Added soft-reset checks that compare preserved writable RAM with the
  TypeScript oracle and verify attached tape media is still present in the WASM
  runtime.
- Added NOP-ROM normal-frame parity checks against the TypeScript oracle for
  `frames`, `tacts`, `tactsInFrame`, and `frameJustCompleted`.
- Added audio sample-rate synchronization checks for all three WASM adapters and
  clock-multiplier write-count checks for the 48K adapter, which is the current
  adapter exposing that diagnostic count.

### Step 10 - 48K Flat Memory Parity

Status: Completed on 2026-08-15.

Add the 48K subset to `test/wasm/zxSpectrum/wasm-memory-paging.test.ts`.

Migrate relevant behavior from `test/memory/PagedMemory.test.ts` and existing
adapter tests:

- ROM reads return uploaded ROM bytes.
- Writes to `0x0000-0x3fff` do not mutate ROM.
- Writes to `0x4000-0xffff` mutate RAM.
- `get64KFlatMemory()`, `doReadMemory()`, `doWriteMemory()`,
  `getPartition()`, and `readScreenMemory()` agree with TypeScript.
- Boundary addresses: `0x0000`, `0x3fff`, `0x4000`, `0x7fff`, `0x8000`,
  `0xbfff`, `0xc000`, `0xffff`.

Acceptance:

- WASM 48K memory tests pass without changing the TypeScript
  `PagedMemory.test.ts`.

Implementation notes:

- Added `test/wasm/zxSpectrum/wasm-memory-paging.test.ts` with the first 48K
  flat-memory subset.
- Covered ROM reads, ROM write immutability, RAM mutation through
  `doWriteMemory()`, flat-memory reads, `getPartition()` parity, and
  `readScreenMemory()` parity against the TypeScript 48K oracle.
- Covered the requested boundary addresses: `0x0000`, `0x3fff`, `0x4000`,
  `0x7fff`, `0x8000`, `0xbfff`, `0xc000`, and `0xffff`.
- The TypeScript `PagedMemory.test.ts` suite was left unchanged.

### Step 11 - 128K And +2 Paging Parity

Status: Completed on 2026-08-15.

Extend `test/wasm/zxSpectrum/wasm-memory-paging.test.ts`.

Migrate 128K paging behavior:

- Reset partitions are `[-1, -1, 5, 5, 2, 2, 0, 0]`.
- `0x7ffd` selects RAM bank, shadow screen, and ROM page.
- Paging lock bit prevents later page changes.
- ROM 0/1 and RAM banks 0-7 are independently readable through
  `getMemoryPartition()`.
- Code injection/writes to banked memory affect the selected bank only.
- +2 model aliases use the same accepted 128K behavior unless the codebase has
  a separate +2 machine model with different config.

Acceptance:

- Each assertion compares WASM with `ZxSpectrum128Machine` unless a literal
  partition layout is the clearer contract.

Implementation notes:

- Extended `test/wasm/zxSpectrum/wasm-memory-paging.test.ts` with the 128K
  and +2-style paging subset.
- Covered reset partitions, `0x7ffd` RAM bank selection, ROM page selection,
  shadow screen selection, paging lock behavior, independent ROM/RAM
  `getMemoryPartition()` reads, selected-bank writes, and top-slot bank
  isolation.
- The +2 behavior remains represented by the 128K WASM backend path because the
  current helper matrix has no distinct +2 WASM adapter surface.

### Step 12 - +3E Special Paging Parity

Status: Completed on 2026-08-15.

Extend `test/wasm/zxSpectrum/wasm-memory-paging.test.ts` for +2E/+3E.

Migrate +3E-specific paging behavior:

- Reset partitions match TypeScript.
- `0x7ffd` normal paging works.
- `0x1ffd` special paging enables the four documented layouts:
  - mode 0: banks `0, 1, 2, 3`
  - mode 1: banks `4, 5, 6, 7`
  - mode 2: banks `4, 5, 6, 3`
  - mode 3: banks `4, 7, 6, 3`
- ROM high bit from special config selects the same ROM page as TypeScript.
- Paging lock and special paging interactions match TypeScript.

Acceptance:

- Run this step for `nofdd`, `fdd1`, and `fdd2` model configs where disk count
  should not affect memory paging.

Implementation notes:

- Extended `test/wasm/zxSpectrum/wasm-memory-paging.test.ts` with +3E special
  paging checks for disk-support configurations `0`, `1`, and `2`.
- Covered reset partitions, normal `0x7ffd` paging, the four `0x1ffd` special
  paging layouts, ROM high-bit selection from special config, and the current
  WASM behavior that keeps `0x1ffd` writable after the `0x7ffd` paging lock.
- Added a small helper refinement in `test/wasm/zxSpectrum/wasm-test-helpers.ts`
  so +3E paging snapshots synchronize before reading test state.
- The +3E production adapter does not currently override the full
  `doReadMemory()`/`doWriteMemory()`/`doWritePort()`/partition surface for WASM
  the way the 48K and 128K adapters do. These tests therefore use the explicit
  WASM helper controls for +3E paging operations and read current partitions
  from WASM runtime exports, while still comparing normal paging reads with the
  TypeScript oracle where both surfaces expose the same contract.

### Step 13 - Partition Label Parsing

Status: Completed on 2026-08-15.

Add partition-label checks to `test/wasm/zxSpectrum/wasm-memory-paging.test.ts`
or a small `test/wasm/zxSpectrum/wasm-partition-labels.test.ts`.

Migrate the Spectrum subset from `test/memory/partition-parsing.test.ts`:

- 48K labels still return `undefined`.
- 128K labels map `R0`, `R1`, and `B0` through `B7`.
- +2E/+3E labels map `R0` through `R3` and `B0` through `B7`.

Acceptance:

- The TypeScript partition parsing test remains unchanged.
- WASM adapter inheritance or overrides expose the same parsing contract.

Implementation notes:

- Added `test/wasm/zxSpectrum/wasm-partition-labels.test.ts`.
- Covered 48K undefined labels, 128K `R0`/`R1` and `B0` through `B7`, and
  +2E/+3E `R0` through `R3` plus `B0` through `B7`.
- Each WASM assertion is compared with the matching TypeScript oracle machine.
- `test/memory/partition-parsing.test.ts` was left unchanged.

### Step 14 - Keyboard And ULA Port Parity

Status: Completed for the first keyboard/ULA port slice on 2026-08-15.

Add `test/wasm/zxSpectrum/wasm-ports-keyboard.test.ts`.

Migrate keyboard/port behavior from existing WASM tests and TypeScript machine
expectations:

- Key press/release updates the correct keyboard row before direct port reads.
- Keyboard rows are uploaded once when unchanged and again when changed.
- ULA port `0xfe` writes update border color and beeper bits.
- ULA port reads combine keyboard row state, tape EAR state, and floating bus
  defaults in the same way as TypeScript.
- Unsupported ports return the same fallback values as TypeScript:
  - 48K/128K open or floating bus as appropriate;
  - +3E FDC/PSG/paging decoded ports where applicable.

Acceptance:

- Use at least one row-selection read per keyboard row across the matrix.
- Include even and odd port address examples.

Implementation notes:

- Added `test/wasm/zxSpectrum/wasm-ports-keyboard.test.ts`.
- Covered all eight keyboard row-selection ports on 48K, 128K, and +3E with
  press/release comparisons against TypeScript oracle machines.
- Covered unchanged/changed keyboard upload count behavior where diagnostics
  expose it today: 48K and 128K.
- Covered `0xfe` border, EAR, MIC, and beeper-level state for 48K, 128K, and
  +3E.
- Added a WASM tape-EAR-to-`0xfe` read routing check for 128K and +3E. Full
  tape waveform parity remains in the later tape migration step.
- Covered representative odd-port fallback behavior for 128K and +3E.
- During implementation, a direct 48K unsupported odd-port floating-bus probe
  returned `0x00` from the current WASM adapter while the TypeScript oracle
  returned `0xff`. Because detailed floating-bus timing belongs to Step 17 and
  the 48K adapter does not currently expose a full floating-bus test surface,
  this was recorded for Step 17 rather than changing production WASM files in
  this step.

### Step 15 - Contention Table Parity

Status: Completed on 2026-08-15.

Add `test/wasm/zxSpectrum/wasm-contention.test.ts`.

First add table-level tests:

- For representative frame tacts, compare:
  - TypeScript `getContentionValue(tact)`
  - WASM `*GetContentionValue(tact)`
- Cover active display, border, and non-contention regions.
- Cover model differences:
  - 48K contended memory range;
  - 128K top-slot contention only when odd RAM bank is selected;
  - +3E top-slot contention when bank 4-7 is selected.

Acceptance:

- This step does not yet need CPU instruction execution; it only proves the
  generated tables and model-specific address rules.

Implementation notes:

- Added `test/wasm/zxSpectrum/wasm-contention.test.ts`.
- Compared representative generated contention-table values against the
  TypeScript oracle for 48K, 128K, and +3E, including active-display non-zero
  contention and zero-contention tacts.
- Added address-rule probes without executing CPU instructions:
  - 48K delays `0x4000-0x7fff` and not `0x8000`;
  - 128K delays `0x4000` and delays `0xc000` only when an odd top RAM bank is
    selected;
  - +3E delays `0xc000` when RAM bank `4-7` is selected and not when bank `3`
    is selected.
- Used explicit WASM delay exports for 48K and +3E where the production
  adapters do not expose the matching WASM-backed delay method today; 128K uses
  the adapter override.

### Step 16 - CPU-Level Contention Tests

Extend `test/wasm/zxSpectrum/wasm-contention.test.ts`.

Migrate `test/zxSpectrum/ula-contention.test.ts` in small groups:

1. D1 I/O contention address range:
   - 48K contended and non-contended odd ports;
   - 128K `0xc000` odd/even bank cases;
   - 128K `0x4000` always-contended case;
   - +3E bank >= 4 and bank < 4 cases.
2. D2 HALT contention:
   - HALT at `0x4000`;
   - HALT at `0x8000`.
3. D3 M1 refresh contention:
   - NOP with `I=0x40`;
   - NOP with `I=0x00`;
   - code fetch and refresh both contended.
4. D5 contention stats:
   - non-contended odd port records zero;
   - contended odd port records exactly `4 * DELAY`;
   - non-contended even ULA port records exactly one delay;
   - contended even port records exactly two delays.

Acceptance:

- Use the same constants as the TypeScript test: `DELAY = 6`,
  `START_TACT = 100`, and a wide contention override range.
- Compare tacts used and total contention delay with the TypeScript oracle.

### Step 17 - Screen Rendering Timing Parity

Add `test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts`.

Carry-forward note from Step 14:

- Include the 48K unsupported odd-port floating-bus mismatch observed during
  Step 14: current WASM adapter `doReadPort(0xffff)` returned `0x00` for the
  probed setup while the TypeScript oracle returned `0xff`.

Migrate screen timing contracts:

- `screenWidthInPixels`, `screenHeightInPixels`, and
  `tactsInDisplayLine` match the TypeScript machine for each model.
- Pixel buffer and byte buffer lengths match visible dimensions.
- `renderInstantScreen()` reads the same screen bank as TypeScript:
  - 48K fixed bank;
  - 128K bank 5 or 7 depending on shadow-screen bit;
  - +3E normal and special paging screen bank behavior.
- Representative pixel and attribute bytes render to matching colors.

Acceptance:

- Include black/white ink-paper examples and one border color write per model.

### Step 18 - Floating Bus Parity

Extend `test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts`.

Migrate and broaden current floating-bus checks:

- Direct helper comparison for boundary tacts around the first display bytes.
- Active display byte pattern test: seed screen memory with `offset & 0xff` and
  compare TypeScript and WASM reads across representative tacts.
- RAMSOFT floatspy-style CPU test:
  - repeated `ED 78` / `IN A,(C)`;
  - `BC = 0x00ff`;
  - compare sampled values and tacts with the TypeScript oracle.
- Model-specific checks:
  - 48K sample offset;
  - 128K displayed bank 5 vs 7;
  - +3E displayed bank and plus-3 floating-bus rules already modeled in
    TypeScript.

Acceptance:

- Include port `0x00ff`; it caught a real 128K regression before.

### Step 19 - Beeper Audio Parity

Add `test/wasm/zxSpectrum/wasm-beeper-audio.test.ts`.

Migrate the Spectrum subset of:

- `test/audio/BeeperDevice.test.ts`
- `test/audio/BeeperMameCompat.test.ts`
- `test/audio/AudioIntegration.test.ts`

Test groups:

- EAR bit on/off generates normalized samples.
- Frame boundary resets collection without losing the first next-frame sample.
- Sample count tracks audio sample rate and clock multiplier.
- Rapid ULA port toggles produce non-zero transitions.
- 48K, 128K, and +3E share the same beeper contract unless TypeScript says
  otherwise.

Acceptance:

- Compare stable invariants such as sample count, sign/range, and transition
  existence. Avoid brittle exact floating-point waveform equality unless both
  sides use the same integer sample representation.

### Step 20 - PSG Register And Tone Parity

Add `test/wasm/zxSpectrum/wasm-psg-audio.test.ts`.

Migrate small batches from:

- `test/audio/PsgChip.step1.test.ts`
- `test/audio/PsgVolumePeriod.step34.test.ts`
- `test/audio/PsgRegisterMasking.step78.test.ts`
- `test/audio/PsgDevice.test.ts`

Test groups:

- register index masking;
- tone period low/high register writes;
- mixer enable/disable bits;
- volume register masking;
- selected register readback;
- reset state;
- 128K and +3E PSG port decoding:
  - register index port;
  - register value port;
  - read selected register.

Acceptance:

- Run all PSG tests for 128K and +3E.
- Do not run PSG tests for 48K except asserting PSG is absent or ports fall
  back to the 48K contract.

### Step 21 - PSG Envelope, Noise, And Stereo Parity

Extend `test/wasm/zxSpectrum/wasm-psg-audio.test.ts`.

Migrate deeper PSG behavior:

- `test/audio/PsgEnvStereo.step56.test.ts`
- `test/audio/PsgCrossCheck.step912.test.ts`
- `test/audio/PsgMixerNoise.step21.test.ts`
- the PSG portions of `test/audio/AudioIntegration.test.ts`

Test groups:

- noise period and LFSR progression invariants;
- envelope period, shape, hold/alternate/attack behavior;
- stereo mix routing used by current Spectrum PSG implementation;
- beeper and PSG mixed output remains normalized;
- changing PSG registers mid-frame changes later samples without corrupting
  earlier samples.

Acceptance:

- Prefer comparing exported PSG debug/register state plus normalized audio
  invariants. Add exact sample comparisons only after the WASM and TypeScript
  algorithms are intentionally identical.

### Step 22 - Tape Load/Save Parity

Add `test/wasm/zxSpectrum/wasm-tape.test.ts`.

Migrate the existing WASM tape smoke tests into a model matrix and add
TypeScript-oracle checks:

- media upload block count, offsets, lengths, pauses, pilot pulse count, and
  last-byte-used bits;
- `FAST_LOAD`, `TAPE_MODE`, and `REWIND_REQUESTED`;
- EAR bit sampled through ULA port reads;
- saved tape block publication through `SAVED_TO_TAPE`;
- reset behavior with attached media.

Acceptance:

- Use small synthetic `TapeDataBlock` instances first.
- Add one TZX/TAP fixture only after synthetic parity is stable.

### Step 23 - +3E Disk/FDC Command Parity

Add `test/wasm/zxSpectrum/wasm-p3e-disk.test.ts`.

Migrate focused behavior from `test/disk/FloppyControllerDevice.test.ts` after
the WASM FDC has enough test exports:

1. Media and controller basics:
   - drive count;
   - write protect;
   - load/eject;
   - reset preserves attached media;
   - motor on/off through `0x1ffd`.
2. Command/result phase basics:
   - Specify command;
   - Sense Drive;
   - Sense Interrupt;
   - Recalibrate with motor off/on;
   - Read ID with no disk.
3. Real disk reads:
   - load `test/testfiles/blank180K.dsk`;
   - Read Data command returns every byte from the selected normalized sector.
4. Disk writes:
   - Write Data command changes the selected sector;
   - `flushDiskChanges()` publishes `DISK_A_CHANGES` / `DISK_B_CHANGES`;
   - write-protected disks reject writes with the same status as TypeScript.

Acceptance:

- Keep disk parser tests TypeScript-only.
- WASM FDC tests compare command status bytes and sector data with the
  TypeScript `FloppyControllerDevice` oracle.

### Step 24 - Debug Step And CPU State Parity

Add `test/wasm/zxSpectrum/wasm-debug-step.test.ts`.

Migrate debug-level behavior from existing 48K/128K adapter tests and extend it
to +3E:

- StepInto executes exactly one instruction.
- CPU state exports refresh `PC`, `SP`, main registers, flags, interrupt mode,
  halted state, and tacts.
- Memory write bus events are visible after instructions such as
  `LD (nn),A`.
- Port read/write bus events are visible after `IN A,(C)` and `OUT (n),A`.
- `RET` and `RETN` flags are visible where TypeScript exposes them.
- Frame completion during debug stepping publishes pixels/audio/tape/disk
  side effects once.

Acceptance:

- +3E no longer falls back to the TypeScript debug loop for WASM-selected
  machines.

### Step 25 - Cross-Backend Oracle Programs

Add a small program matrix to `test/wasm/zxSpectrum/wasm-debug-step.test.ts` or
a new `test/wasm/zxSpectrum/wasm-oracle-programs.test.ts`.

Use short ROM/program snippets that combine devices:

- memory write then screen render;
- keyboard read into RAM;
- ULA border/beeper port write;
- 128K paging then banked RAM write/read;
- +3E special paging then banked RAM write/read;
- PSG write sequence then frame audio;
- +3E FDC read command sequence.

Acceptance:

- For each program, run the same instruction count on TypeScript and WASM and
  compare:
  - CPU register subset;
  - tacts;
  - selected memory bytes;
  - selected device state;
  - frame count when frame execution is involved.

## Verification Matrix

Focused commands after each step:

```sh
npm test -- --project node test/wasm/zxSpectrum/<new-test-file>.test.ts
npm test -- --project node test/wasm/z80/<copied-z80-file>.test.ts
npm test -- --project node test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts
```

Build and size commands after infrastructure or C/WASM export changes:

```sh
npm run build:sp48-wasm
npm run build:sp128-wasm
npm run build:spp3e-wasm
npm run check:sp48-wasm-size
npm run check:sp128-wasm-size
npm run check:spp3e-wasm-size
npm run build:check
```

Full confidence command before marking the migration done:

```sh
npm test -- --project node test/wasm test/zxSpectrum test/z80 test/audio test/disk test/memory
diff -rq test/z80 test/wasm/z80 --exclude test-z80.ts
npm run build:check
```

Run `npm run lint:renderer` only if renderer React files are touched, which
should not be necessary for this plan.

## Completion Criteria

- The original TypeScript tests still exist and pass.
- Copied Z80 WASM test case files are byte-for-byte identical to the original
  `test/z80/*.test.ts` files.
- Z80 WASM adaptation lives only in the WASM wrapper/runner infrastructure, not
  in modified test cases.
- New WASM tests are kept together under `test/wasm/`.
- WASM-specific tests cover 48K, 128K, +2-family, and +3E behavior in small
  files with shared helpers.
- WASM tests include direct parity checks against TypeScript machines for
  memory, paging, ports, contention, screen/floating bus, beeper, PSG, tape,
  +3E disk, and debug stepping.
- Loader tests enforce every new WASM export needed by the test/control
  surface.
- +3E WASM supports one-instruction debug stepping rather than falling back to
  the TypeScript runner.
- The focused Spectrum WASM tests and `npm run build:check` pass.
