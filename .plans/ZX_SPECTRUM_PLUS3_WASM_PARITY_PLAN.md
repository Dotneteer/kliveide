# ZX Spectrum +3E WASM Parity Plan

Created: 2026-08-15

Status:

- Adapter memory/debug parity: implemented and focused tests passing.
- Debug-step CPU state parity: implemented and focused tests passing.
- Floating-bus parity: implemented, focused tests passing, and manually
  confirmed fixed.
- Focused parity regression sweep: complete and passing.
- Full unit test suite: complete and passing.
- Next recommended step: manual game/IDE retest.
- Reusable lessons recorded in `.ai/wasm-v2-machine-migration-guide.md`.

## Goal

Bring the ZX Spectrum +2E/+3E (`spp3e`) WASM implementation into observable
parity with the TypeScript implementation for CPU execution, memory mapping,
debug/disassembly views, screen behavior, port handling, PSG, tape, and disk
state.

The TypeScript implementation is the oracle. The 48K and 128K WASM V2 machines
are the architectural examples for adapter API parity, frame lifecycle, shared
Spectrum devices, and test shape.

## Initial Finding

The +3E WASM adapter currently appears less complete than the 48K/128K adapters
for public memory/debug APIs. In particular, `ZxSpectrum128WasmV2Machine`
overrides methods such as `get64KFlatMemory`, `getMemoryPartition`,
`getCurrentPartitions`, `getPartition`, `getSelectedRomPage`,
`getSelectedRamBank`, `doReadMemory`, `doWriteMemory`, and `doWritePort`.

`ZxSpectrumP3eWasmV2Machine` currently overrides some runtime-facing behavior,
but not the whole memory/debug surface. This can make the IDE memory and
disassembly panels observe inherited TypeScript-side `PagedMemory` state while
the running WASM CPU is using WASM-owned memory.

Start by proving or disproving this adapter-surface mismatch before changing
deeper C/WASM machine logic.

## Important Files

- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `test/wasm/zxSpectrum/wasm-test-helpers.ts`
- `test/wasm/zxSpectrum/wasm-memory-paging.test.ts`
- `test/wasm/zxSpectrum/wasm-oracle-programs.test.ts`
- `test/zxSpectrum/spp3e-wasm-v2-loader.test.ts`
- `.ai/wasm-v2-machine-migration-guide.md`

## Working Rules

- Preserve the TypeScript backend as the oracle.
- Do not restore the old hybrid CPU-only WASM path.
- Do not create backend-specific model-picker entries.
- Keep tests focused around the surface being changed.
- Preserve user changes in the dirty worktree. At creation time, the worktree
  has a local modification in
  `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation.ts`.
- Run focused WASM tests first, then broader build/lint checks according to
  `AGENTS.md`.

## Step 1 - Freeze The Baseline

Run the current +3E and shared Spectrum WASM tests before editing:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum test/zxSpectrum/spp3e-wasm-v2-loader.test.ts
```

Record any existing failures separately from new parity failures.

## Step 2 - Compare Adapter API Parity

Build a method matrix for these classes:

- `ZxSpectrum48WasmV2Machine`
- `ZxSpectrum128WasmV2Machine`
- `ZxSpectrumP3eWasmV2Machine`

Check the +3E adapter against the working 128K pattern for:

- `get64KFlatMemory`
- `getMemoryPartition`
- `getCurrentPartitions`
- `getPartition`
- `getSelectedRomPage`
- `getSelectedRamBank`
- `getRomFlags`
- `doReadMemory`
- `doWriteMemory`
- `doReadPort`
- `doWritePort`
- `delayAddressBusAccess`
- `delayPortRead`
- `delayPortWrite`
- `setTacts`

Expected outcome: every public API used by the IDE, debugger, memory panel,
disassembly panel, and commands should observe WASM-owned state when the WASM
backend is active.

### Step 2 Audit Result

Completed: 2026-08-15

The +3E adapter has the same full-machine structure as the 48K/128K adapters,
but its public memory/debug adapter surface is incomplete.

| Public adapter method | 48K WASM | 128K WASM | +3E WASM | Finding |
| --- | --- | --- | --- | --- |
| `get64KFlatMemory` | yes | yes | no | +3E inherits TypeScript `PagedMemory` view. |
| `getMemoryPartition` | inherited 48K behavior is sufficient | yes | no | +3E inherits TypeScript partition storage instead of WASM ROM/RAM views. |
| `getCurrentPartitions` | inherited 48K behavior is sufficient | yes | no | +3E public partition labels can stay at reset layout after WASM paging. |
| `getPartition` | inherited 48K behavior is sufficient | yes | no | +3E disassembly can resolve partitions from TypeScript memory state. |
| `getSelectedRomPage` | inherited 48K behavior is sufficient | yes | no | +3E fields are synced in some paths, but the API is not WASM-owned. |
| `getSelectedRamBank` | inherited 48K behavior is sufficient | yes | no | Same issue as selected ROM. |
| `getRomFlags` | inherited 48K behavior is sufficient | inherited 128K behavior is sufficient | no | +3E special paging can make inherited ROM flags stale. |
| `doReadMemory` | yes | yes | no | +3E public reads can read TypeScript memory while WASM CPU reads WASM memory. |
| `doWriteMemory` | yes | yes | no | +3E public writes can update TypeScript memory while WASM CPU state is separate. |
| `doReadPort` | yes | yes | yes | +3E reads from WASM, but does not import bus access state. |
| `doWritePort` | yes | yes | no | +3E public writes use TypeScript port handling instead of WASM. |
| `delayAddressBusAccess` | inherited 48K behavior is sufficient | yes | no | +3E inherited contention delay can use TypeScript state. |
| `delayPortRead` | inherited 48K behavior is sufficient | yes | no | +3E inherited port contention can use TypeScript state. |
| `delayPortWrite` | inherited 48K behavior is sufficient | yes | no | Same as port read delay. |
| `setTacts` | yes | yes | no | +3E public tact changes do not update WASM tact state. |

The required C exports already exist for most of the missing +3E adapter
methods, including memory views, ROM/RAM bank reads, current partition slots,
ROM flags, selected paging state, delay helpers, tact setter, and last
memory/port access diagnostics.

## Step 3 - Add IDE-Facing Memory Regression Tests

Add tests that reproduce the IDE symptom through public machine APIs, not only
through direct C exports.

Use `TestSpp3eWasmMachine` and `TestOracleSpp3eMachine` to:

- write distinct bytes to visible memory;
- switch normal paging with `0x7ffd`;
- switch special paging with `0x1ffd`;
- compare `get64KFlatMemory()[address]`;
- compare `getMemoryPartition(partition)[offset]`;
- compare `getCurrentPartitions()`;
- compare `getPartition(address)`;
- compare `doReadMemory(address)`;
- compare screen memory via `readScreenMemory(offset)`.

This test should fail before the missing +3E adapter overrides are fixed.

### Step 3 Regression Test Result

Completed: 2026-08-15

Added public API regression coverage to
`test/wasm/zxSpectrum/wasm-memory-paging.test.ts`.

The new tests cover all +3E disk-support variants (`0`, `1`, `2`) and check:

- CPU-written normal memory after executing code in WASM;
- special-paged memory after direct WASM `0x1ffd` paging;
- `get64KFlatMemory`;
- `getMemoryPartition`;
- `getCurrentPartitions`;
- `getPartition`;
- `getSelectedRamBank`;
- `getSelectedRomPage`;
- `doReadMemory`.

Focused test command:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-memory-paging.test.ts
```

Result: 20 passed, 6 failed. The failures confirm the adapter-surface mismatch:

- after WASM CPU execution writes `0x5a` to `0x4000`,
  `get64KFlatMemory()[0x4000]` returns `0x00` through the public +3E API while
  the TypeScript oracle returns `0x5a`;
- after direct WASM special paging maps mode 3, public
  `getCurrentPartitions()` still reports reset layout
  `[-1, -1, 5, 5, 2, 2, 0, 0]` instead of the oracle layout
  `[4, 4, 7, 7, 6, 6, 3, 3]`.

This is the expected pre-fix failure and points directly at Step 4.

## Step 4 - Fix +3E Adapter Surface

Mirror the proven 128K adapter pattern where +3E has the same contract:

- expose the WASM flat 64K memory view through `get64KFlatMemory`;
- expose four ROM banks and eight RAM banks through `getMemoryPartition`;
- derive current 8K partition labels from `spp3eGetCurrentPartition`;
- derive `getPartition(address)` from the current 8K partition array;
- return selected ROM/RAM bank from WASM exports;
- route public memory reads/writes through `spp3eReadMemory` and
  `spp3eWriteMemory`;
- route public port writes through `spp3eWritePort`;
- import bus/paging/tact state back into the TypeScript facade where inherited
  debugger code still depends on facade fields.

Add or adjust C exports only if an adapter method cannot be implemented from
existing `spp3e` exports.

### Step 4 Implementation Result

Completed: 2026-08-15

Implemented the +3E public WASM adapter surface in
`src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`.

The adapter now routes these public APIs to WASM-owned state:

- `get64KFlatMemory`;
- `getMemoryPartition`;
- `getCurrentPartitions`;
- `getSelectedRomPage`;
- `getSelectedRamBank`;
- `getPartition`;
- `getRomFlags`;
- `doReadMemory`;
- `doWriteMemory`;
- `doReadPort` with bus-access import;
- `doWritePort`;
- `delayAddressBusAccess`;
- `delayPortRead`;
- `delayPortWrite`;
- `setTacts`;
- `getCpuState` with bus-access import.

No C/WASM export changes were needed. Existing `spp3e` exports already covered
the required memory views, bank views, paging state, delay helpers, tact setter,
and last bus access diagnostics.

Focused verification:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-memory-paging.test.ts
npm run build:check
```

Result:

- `wasm-memory-paging.test.ts`: 26 passed;
- `build:check`: passed.

## Step 5 - Verify Reset And ROM Parity

For all disk-support variants (`0`, `1`, `2`):

- verify reset partitions equal `[-1, -1, 5, 5, 2, 2, 0, 0]`;
- verify all four ROM pages load identically;
- verify ROM flags for normal and special paging;
- verify partition labels and `parsePartitionLabel` behavior;
- verify `getSelectedRomPage()` and `getSelectedRamBank()`.

## Step 6 - Verify Normal Paging Parity

Compare TypeScript and WASM after representative `0x7ffd` writes:

- selected top RAM bank;
- selected ROM page;
- shadow-screen bit;
- screen bank `5` versus `7`;
- paging lock bit;
- writes through the currently selected `0xc000-0xffff` bank.

Check both direct runtime exports and public machine APIs.

## Step 7 - Verify Special Paging Parity

Compare TypeScript and WASM after representative `0x1ffd` writes:

- mode `0`: banks `0,1,2,3`;
- mode `1`: banks `4,5,6,7`;
- mode `2`: banks `4,5,6,3`;
- mode `3`: banks `4,7,6,3`;
- ROM selection interaction with special mode bits;
- disk motor flag;
- behavior after `0x7ffd` paging lock.

Check public APIs after each transition because the IDE relies on those paths.

## Step 8 - Verify CPU Execution Parity

Run identical small programs on the TypeScript oracle and WASM backend, stepping
one instruction at a time. After each instruction compare:

- PC, SP, AF, BC, DE, HL, IX, IY where relevant;
- absolute tacts and current-frame tact;
- selected ROM/RAM bank;
- current partitions;
- affected memory bytes;
- last memory/port event if exposed to debugger code.

Programs should cover:

- plain memory reads/writes;
- `OUT (C),A` to `0x7ffd`;
- `OUT (C),A` to `0x1ffd`;
- `IN A,(C)` from floating-bus ports;
- PSG register select/write/read;
- FDC status/data port reads and writes when disk support is enabled.

## Step 9 - Verify Timing, Contention, And Floating Bus

Reuse the existing timing-table and oracle-test style:

- compare rendering phase, pixel address, attribute address, and pixel index;
- compare `getContentionValue(tact)`;
- compare memory contention in normal and special paging modes;
- compare I/O contention in normal and special paging modes;
- run direct floating-bus helper checks;
- run CPU-level repeated `ED 78` / `IN A,(C)` loops for ports such as `0x00ff`.

If these pass for 48K/128K but fail for +3E, suspect +3E model glue first:
current-frame tact calculation, special paging, displayed screen bank,
contention eligibility, floating-bus offset, or port decode.

## Step 10 - Verify IDE Disassembly Path

Trace the disassembly and memory panels to identify which machine APIs provide
bytes and partition labels. Then add a regression test close to that UI model:

- page different banks into the same address range;
- write distinct bytes to each bank;
- ask the same helper/API path used by disassembly for bytes and labels;
- compare TypeScript and WASM results.

Expected outcome: the same address, partition label, and byte sequence should
be reported regardless of backend.

### Debug Step Parity Result

Completed: 2026-08-15

Manual IDE debugging showed a remaining realm split: the emulator screen could
reflect WASM execution while IDE panels reported CPU/disassembly state from a
different execution path.

Finding:

- `ZxSpectrumP3eWasmV2Machine.executeMachineFrame()` used WASM for normal frame
  execution, but delegated debug/non-normal execution to
  `super.executeMachineFrame()`.
- That fallback could run the inherited TypeScript machine path while the WASM
  backend remained the active runtime, producing mismatched PC, memory, and
  disassembly observations.
- The public debug-step test matrix covered 48K and 128K, but not +3E.

Implemented:

- added +3E to `test/wasm/zxSpectrum/wasm-debug-step.test.ts` public
  `StepInto` coverage;
- added `spp3eGetFrameCompleted` to the C core, loader contract, and
  `scripts/build-spp3e-wasm.cjs` export list;
- changed +3E debug execution to run one WASM instruction via
  `spp3eExecuteInstruction()`;
- synchronized CPU, paging, frame, tape, disk, and bus-access state back to the
  TypeScript adapter facade after each debug step.
- exposed and synchronized the rest of the IDE-visible +3E WASM CPU state:
  alternate BC/DE/HL, IR, WZ, IFF1/IFF2, and interrupt mode;
- added public register setters in the +3E adapter for IDE-style assignments
  such as `machine.pc = value`, so register commands update WASM CPU state
  before debugging resumes.

Focused verification:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-debug-step.test.ts
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-memory-paging.test.ts
npm test -- --project jsdom test/zxSpectrum/spp3e-wasm-v2-loader.test.ts
npm run build:check
```

Result:

- `wasm-debug-step.test.ts`: 13 passed;
- `wasm-memory-paging.test.ts`: 26 passed;
- `spp3e-wasm-v2-loader.test.ts`: 33 passed;
- `build:check`: passed.

## Floating Bus Parity Result

Direct comparison showed that the TypeScript and WASM +3E floating-bus rules
match:

- both use `currentFrameTact - 3` within the frame;
- both return `lastContendedValue | 0x01` for Border/None/DisplayB1/DisplayB2
  phases;
- both return `lastUlaReadValue` for the other rendering phases;
- both expose floating-bus reads only for the +2/+3 eligible port shape
  `4 * n + 1`, while paging is enabled.

The mismatch risk found here was not in the C floating-bus rule itself. It was
in the WASM adapter facade: WASM updated `spp3eLastContendedValue` and
`spp3eLastUlaReadValue`, but `ZxSpectrumP3eWasmV2Machine` did not import those
two values back into the TypeScript-visible machine fields. That could make IDE
or debug surfaces that read the inherited TypeScript floating-bus device observe
stale backing values, even though the WASM CPU and raw WASM port read were using
the updated values.

Implemented:

- `readScreenMemory` now imports the WASM bus-access mirrors after reading
  `spp3eReadScreenMemoryOffset`;
- `importWasmV2BusAccess` now synchronizes `lastContendedValue` and
  `lastUlaReadValue` from the WASM runtime;
- +3E floating-bus tests now assert parity for both raw WASM behavior and the
  TypeScript-facing adapter/facade state.

Follow-up check:

The TypeScript ULA producer updates `lastUlaReadValue` whenever
`CommonScreenDevice` fetches a screen byte through `machine.readScreenMemory`.
During normal CPU execution, the TypeScript machine advances rendering through
`onTactIncremented`, so the remembered ULA byte is current when an eligible
floating-bus port is sampled.

The WASM +3E implementation used the same fetch-phase table and the same screen
bank selection, but `spp3eReadFloatingBus` sampled `spp3eLastUlaReadValue`
without first advancing the ULA renderer to the current tact. This could leave
the byte from an earlier ULA fetch on the WASM-side bus. The fix is to call
`spp3eUlaRenderUntilCurrentTact()` before sampling the +3E floating bus.

Additional test coverage now deliberately seeds a stale ULA byte, advances the
TypeScript oracle ULA to the sampled tact, and verifies that WASM refreshes the
remembered byte before returning the floating-bus value.

Focused verification:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts
npm run build:check
```

Result:

- `wasm-screen-floating-bus.test.ts`: 20 passed;
- `build:check`: passed.

Manual status:

- Confirmed by manual IDE/emulator testing: the floating-bus value issue is
  fixed.

## Step 11 - Run Existing Focused Parity Tests

Completed: 2026-08-15

Ran:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-memory-paging.test.ts
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-oracle-programs.test.ts
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-contention.test.ts
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-p3e-disk.test.ts
npm test -- --project jsdom test/zxSpectrum/spp3e-wasm-v2-loader.test.ts
```

Executed as one Vitest invocation with the same file list.

Result:

- focused parity sweep: 6 test files passed;
- focused parity sweep: 110 tests passed.

Then ran broader checks:

```sh
npm run build:check
npm test
```

Result:

- full unit test suite: 508 test files passed, 14 skipped;
- full unit test suite: 18,844 tests passed, 119 skipped;
- `build:check`: passed.

Renderer lint was not run because no renderer React code was touched.

## Step 12 - If Games Still Diverge

Only after the public adapter surface and existing parity tests pass, collect a
first-divergence trace from a failing game:

- identical ROMs, media, config, and reset state;
- same input/tape/disk conditions;
- compare after each instruction or bounded instruction chunk;
- stop at the first mismatch.

Classify the first mismatch as one of:

- CPU core;
- memory map;
- port decode;
- contention/timing;
- floating bus;
- tape;
- PSG;
- FDC/disk;
- adapter facade/debug state.

Because 48K and 128K already use the same WASM CPU core successfully, treat the
CPU core as the last suspect unless the first-divergence trace proves otherwise.

## Acceptance Criteria

- IDE memory view and disassembly show the same bytes and partitions for
  TypeScript and WASM +3E.
- Public +3E machine APIs observe WASM-owned state when WASM is active.
- Normal and special paging match TypeScript across all documented modes.
- CPU-step oracle programs match after each instruction for the covered cases.
- Existing +3E WASM parity tests pass.
- Failing games have either started working or have a saved first-divergence
  trace identifying the next non-parity area.
