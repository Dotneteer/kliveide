# ZX Spectrum Next Frame Diff Runner Plan

Created: 2026-08-22

Status: Implemented on 2026-08-22.

## Implementation Result

Implemented the first headless machine runner slice with a static binary trace
ABI for both backends.

- npm command:
  `npm run diff:zxnext-machine -- --model zxnext`
- The package script uses `node scripts/run-zxnext-frame-diff.cjs`, which checks
  whether the WASM C/H sources are newer than the artifact, rebuilds when
  needed, and then loads `scripts/run-zxnext-frame-diff.ts` through Vite SSR.
- TypeScript tracing is opt-in through `MachineFrameRunner`'s post-instruction
  hook and a reusable `ZxNextFrameTraceRecorder` buffer.
- WASM tracing uses a static C buffer exported as one stable typed memory view.
- Devices are not disabled by the runner. Normal machine frame execution runs
  for both implementations; the initial diagnostics only compare CPU/MMU and
  selected mapping/state fields.
- JSON fixtures are supported with startup `registers`, `memoryPatches`, and
  frame-indexed `keyEvents`.
- Resolved the observed `frameCount=0`, instruction `19`, field `af`
  divergence at `IN A,(C)` from NextReg `$06`: TypeScript returned `$98` while
  WASM returned `$00`. WASM NextReg `$06` now composes the same hotkey and
  DivMMC NMI enable bits as TypeScript, including the post-hard-reset emulator
  defaults.
- Current baseline: `npm run diff:zxnext-machine -- --frames 1` finds no
  differences and reports current frame count `1`.
- Resolved the observed `frameCount=1`, instruction `99`, field
  `cpuFlagsPacked` divergence at the `$0168` HALT loop. WASM now feeds the raw
  ULA interrupt pulse into the Z80 `sigINT` line in the same rendered-tact phase
  as TypeScript, without requiring `IFF1` to be set.
- Resolved the observed `frameCount=8`, instruction `16685`, field `readMap`
  divergence at `OUT ($E3),A` with `A=$81`. WASM now keeps exported page-map
  diagnostics on the base MMU/ROM map, matching TypeScript, while mapped memory
  reads/peeks/writes apply the active DivMMC slot-0 overlay dynamically.
- Completed a focused DivMMC parity audit across TypeScript and WASM device
  state, port `$E3`, NextReg `$06/$09/$0A/$83/$B8-$BB`, CPU opcode-fetch hooks,
  RETN handling, NMI entry, and memory-overlay integration. One additional
  integration gap was fixed: WASM now gates DivMMC port `$E3` with NextReg `$83`
  bit 0, matching TypeScript, instead of bit 4. Regression coverage now checks
  port gating, disable/re-enable E3 replay, entry-register round-trips, ROM3
  gating, delayed/instant automap timing, custom `$04C6`, `$0066` NMI entry, and
  `$1FF8` no-op behavior when `$BB` bit 6 is clear.
- Current default-run divergence: `npm run diff:zxnext-machine -- --model
  zxnext` stops at `frameCount=9`, instruction `6618`, field `af`. Both
  backends are at `PC=$0f77 -> $0f79` with matching timing and matching MMU
  maps. TypeScript has `AF=$0041`; WASM has `AF=$00a9`.

Validation run:

```text
npm test -- --project node test/wasm/zxNext/wasm-next-loader.test.ts test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts test/wasm/zxNext/wasm-next-build.test.ts
npm test -- --project node test/wasm/zxNext/wasm-next-nextreg.test.ts
npm run build:check
npm run check:zxnext-wasm-size
npm run diff:zxnext-machine -- --frames 1
npm run diff:zxnext-machine -- --model zxnext
```

The one-frame command exits with status `0` after one matching frame. The
default command compares at most 1000 frames and currently exits with status
`1` at the frame-9 `AF` divergence described above.

## Goal

Build a headless runner that executes the ZX Spectrum Next TypeScript and WASM
implementations frame by frame, records compact per-instruction diagnostics for
each frame, compares the two diagnostic streams, and stops at the first
observable divergence.

The first use case is to locate the instruction that makes the two machines
drift during boot or while waiting for user input. The primary report must show:

- the last instruction record where TypeScript and WASM still matched;
- the next instruction record where they diverged;
- the `PC` before the suspected instruction and the TypeScript/WASM `PC` after
  it;
- the first differing field, with enough CPU and memory-mapping context to
  inspect that Z80/Z80N instruction.

The runner must not open an Electron window, paint to a physical display, or
play sound. It should still let each machine execute the same frame lifecycle as
normal emulation, including screen/audio/timing side effects that are part of
machine execution.

## Existing Context

- `ZxNextMachine.executeMachineFrame()` currently uses `MachineFrameRunner` for
  the TypeScript backend.
- `ZxNextWasmV2Machine.executeMachineFrame()` calls the single WASM frame export
  `zxnextExecuteFrame()` in normal mode.
- WASM instruction execution already has a narrow instrumentation point in
  `src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c`:
  `zxnextCpuExecuteInstruction()` captures `pcBefore`, executes the shared Z80N
  core, then returns after all post-instruction device hooks.
- TypeScript frame execution has a matching outer instruction boundary in
  `src/emu/machines/MachineFrameRunner.ts`: `beforeInstructionExecuted()`, one
  complete instruction loop, `consumeEvents()`, and `afterInstructionExecuted()`.
- Existing WASM loader and adapter code already expose many CPU, frame, memory,
  port, and device-state accessors through
  `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts` and
  `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`.

## Non-Goals

- Do not make a renderer-facing UI in the first slice.
- Do not serialize a full trace to JSON while a frame is running.
- Do not allocate per-instruction objects or arrays in either implementation.
- Do not compare physical screen pixels or audio samples in the first slice,
  unless later experiments prove that CPU/MMU state is insufficient.
- Do not change normal emulator behavior when tracing is disabled.

## Runner Shape

Create a Node-side runner, initially as a script, with the reusable comparison
logic kept in testable modules:

- `scripts/run-zxnext-frame-diff.ts`
- `test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts`
- shared trace layout/helpers under `src/emu/machines/zxNext/diagnostics/` or
  `test/wasm/zxNext/` if the first version is intentionally test-only

The runner flow should be:

1. Create one TypeScript Next machine and one WASM Next machine with the same
   model, config, ROM/file provider, reset mode, and optional startup state.
2. Enable diagnostics on both machines before running a frame.
3. Clear both preallocated frame buffers.
4. Execute one full frame on the TypeScript machine.
5. Execute one full frame on the WASM machine.
6. Compare the two binary frame buffers.
7. If they match, advance to the next frame and repeat.
8. If they differ, stop immediately and print a compact divergence report.
9. If either buffer overflows, stop and report trace overflow as the divergence.

Run the two implementations sequentially, not interleaved instruction by
instruction. The comparison granularity is still instruction-level because both
backends record one binary record at the same post-instruction boundary.

## Diagnostics Capacity

Use the 28 MHz frame domain for capacity planning.

- Worst 50 Hz frame duration at 28 MHz: `28,000,000 / 50 = 560,000` 28 MHz
  ticks.
- Approximate minimum complete Z80 instruction duration: `4` ticks at full
  28 MHz speed.
- Estimated maximum instruction records per frame: `560,000 / 4 = 140,000`.
- Initial static capacity: `160,000` records per implementation.

This capacity gives a small guard band for interrupt, prefix, or accounting
differences while still making overflow obvious. If a frame attempts to write
record `160,001`, tracing must set an overflow flag and keep the buffer stable.
The runner should then stop and report overflow rather than allocating a larger
buffer.

## Binary Trace ABI

Use little-endian binary records. Keep the layout versioned, fixed-size, and
word-aligned. Do not emit JavaScript objects while collecting a frame.

### Frame Header

Reserve a fixed header before the records:

| Field | Type | Notes |
| --- | --- | --- |
| magic | `u32` | Identifies ZX Next frame trace data. |
| version | `u16` | Start at `1`. |
| recordSize | `u16` | Start at `128`. |
| capacity | `u32` | Initial value `160000`. |
| count | `u32` | Records actually written. |
| overflow | `u32` | `0` or first overflowing record index. |
| frameIndex | `u32` | Machine frame number at frame start. |
| tactsInFrame28 | `u32` | Frame duration in 28 MHz ticks. |
| startTactsLow | `u32` | Low 32 bits of absolute tact counter. |
| startTactsHigh | `u32` | High 32 bits of absolute tact counter. |
| endTactsLow | `u32` | Filled after frame execution. |
| endTactsHigh | `u32` | Filled after frame execution. |
| reserved | bytes | Pad the header to a fixed size, for example 64 bytes. |

### Instruction Record V1

Initial record size: `128` bytes.

| Offset | Field | Type | Notes |
| --- | --- | --- | --- |
| 0 | sequence | `u32` | Instruction index within the frame. |
| 4 | frameTact28After | `u32` | 28 MHz current-frame tact after instruction. |
| 8 | machineTactsLow | `u32` | Absolute tacts after instruction. |
| 12 | machineTactsHigh | `u32` | High bits for long runs. |
| 16 | pcBefore | `u16` | PC at instruction start. |
| 18 | pcAfter | `u16` | PC after instruction and post-hooks. |
| 20 | af | `u16` | Main AF. |
| 22 | bc | `u16` | Main BC. |
| 24 | de | `u16` | Main DE. |
| 26 | hl | `u16` | Main HL. |
| 28 | afAlt | `u16` | Alternate AF. |
| 30 | bcAlt | `u16` | Alternate BC. |
| 32 | deAlt | `u16` | Alternate DE. |
| 34 | hlAlt | `u16` | Alternate HL. |
| 36 | ix | `u16` | IX. |
| 38 | iy | `u16` | IY. |
| 40 | ir | `u16` | I and R packed as the machine exposes them. |
| 42 | wz | `u16` | Internal WZ/memptr. |
| 44 | sp | `u16` | Stack pointer. |
| 46 | cpuFlagsPacked | `u16` | IFF1, IFF2, IM, halted, prefix, INT/NMI observed, RET/RETN flags. |
| 48 | executedInstructions | `u32` | Backend instruction counter after write. |
| 52 | totalContentionDelay | `u32` | Current total contention delay counter. |
| 56 | contentionDelaySincePause | `u32` | Current pause-local contention counter. |
| 60 | lastMemoryAddress | `u16` | Last memory access address. |
| 62 | lastPortAddress | `u16` | Last I/O port address. |
| 64 | lastMemoryValue | `u8` | Last memory access value. |
| 65 | lastPortValue | `u8` | Last port access value. |
| 66 | lastMemoryFlags | `u8` | Read/write/valid flags. |
| 67 | lastPortFlags | `u8` | Read/write/valid flags. |
| 68 | cpuEffectiveSpeed | `u8` | Next CPU speed in effect for the instruction. |
| 69 | cpuTactScale | `u8` | 28 MHz scaling used by WASM/TypeScript. |
| 70 | nextRegIndex | `u8` | Last selected NextReg index. |
| 71 | status2 | `u8` | Reserved packed status byte. |
| 72 | mmuRaw | `u8[8]` | Raw MMU register values for slots 0-7. |
| 80 | readMap | `u16[8]` | Compact physical/source id visible for CPU reads. |
| 96 | writeMap | `u16[8]` | Compact physical/source id visible for CPU writes. |
| 112 | pagingRegs | `u8[8]` | `$7FFD`, `$1FFD`, `$DFFD`, `$EFF7`, DivMMC, Layer 2, Alt ROM, Multiface summary. |
| 120 | extensionHash | `u32` | Hash of optional extension data, initially `0`. |
| 124 | recordFlags | `u32` | Version flags, overflow marker, future field-valid bits. |

Size estimate:

- `128 * 140,000 = 17,920,000` bytes per implementation for a worst 50 Hz
  frame at 28 MHz.
- `128 * 160,000 = 20,480,000` bytes per implementation with guard capacity.
- Paired TypeScript and WASM buffers: `40,960,000` bytes, plus two small
  headers.

This is intentionally much smaller than object traces. The runner may allocate
summary objects only after a frame completes and comparison begins.

## Memory Mapping Encoding

The first version should compare both raw and effective mapping state:

- `mmuRaw[8]` stores the eight raw Next MMU registers.
- `readMap[8]` and `writeMap[8]` store compact effective slot descriptors for
  the 64K CPU address space.
- Each map descriptor should be a `u16`:
  - bits `0..8`: physical 8K page or sentinel page id;
  - bits `9..12`: source kind, for example Next ROM, main RAM, DivMMC ROM,
    DivMMC RAM, Multiface, Alt ROM, Layer 2, sentinel, or open bus;
  - bits `13..15`: flags such as read-only, special/system region, or mapped by
    overlay.

This keeps the initial record small while preserving enough information to
notice when TypeScript and WASM see different 64K memory pages.

## TypeScript Instrumentation

Add an opt-in trace recorder around the TypeScript instruction boundary:

- Preallocate one `ArrayBuffer` for the frame trace and reuse it every frame.
- Write records with typed views or `DataView` at fixed offsets.
- Capture `pcBefore` before the machine starts executing the instruction.
- Write the full record only after `afterInstructionExecuted()` and event
  consumption, matching the state visible after the instruction has completed.
- Do not allocate records, arrays, strings, or closures per instruction.
- Keep tracing disabled by default and branch out early when disabled.

Implementation options:

- Prefer a small `ZxNextFrameTraceRecorder` object owned by the runner or
  machine only when diagnostics are enabled.
- If production classes should stay untouched in the first slice, create a
  traceable test subclass of `ZxNextMachine` that overrides the relevant
  instruction-boundary hooks.
- If the subclass cannot observe exactly the same post-instruction state as
  `MachineFrameRunner`, add minimal opt-in hooks to `MachineFrameRunner` and
  keep them no-op in normal execution.

Add TypeScript-side helpers for memory mapping diagnostics, preferably on
`MemoryDevice`, so the recorder can write raw MMU values and effective read/write
slot descriptors without recomputing mapping rules in the runner.

## WASM Instrumentation

Add a compile-time or runtime-disabled diagnostics trace module to the Next WASM
backend:

- Add static storage in C, for example:
  `static uint8_t zxnextFrameTrace[ZXNEXT_TRACE_HEADER_SIZE + ZXNEXT_TRACE_CAPACITY * ZXNEXT_TRACE_RECORD_SIZE];`
- Add static counters for enabled flag, record count, overflow index, and frame
  metadata.
- Export typed-view accessors:
  - `zxnextTraceGetStartOffset()`
  - `zxnextTraceGetHeaderSize()`
  - `zxnextTraceGetRecordSize()`
  - `zxnextTraceGetCapacity()`
  - `zxnextTraceGetCount()`
  - `zxnextTraceGetOverflow()`
  - `zxnextTraceClear(frameIndex)`
  - `zxnextTraceSetEnabled(enabled)`
- Record at the end of `zxnextCpuExecuteInstruction()`, using its existing
  `pcBefore` local and the post-instruction CPU/device state.
- Do not call back into JavaScript per instruction.
- Do not allocate from WASM memory while a frame is running.
- Keep normal frame execution unchanged when tracing is disabled.

The loader should validate these exports and create a stable `Uint8Array` view
over the trace memory, like the existing pixel/audio/memory typed views.

## Comparator

Compare raw records in deterministic field order:

1. Validate both headers: magic, version, record size, capacity, overflow.
2. Compare record counts. If counts differ, compare the common prefix first.
3. For each record, compare the configured field set.
4. Stop at the first field difference.
5. Return a `FrameDiffResult` summary object.

The first comparison mode should include all V1 fields. Add a mask/configuration
later only if experiments show intentional differences that need staged
comparison.

The mismatch report should include:

- current frame count at the moment the divergence was found;
- frame index;
- instruction index;
- first differing field name and raw TypeScript/WASM values;
- last matching record, or frame-start state when the first record differs;
- TypeScript and WASM `pcBefore` and `pcAfter` for the mismatching record;
- TypeScript and WASM `frameTact28After`;
- TypeScript and WASM `mmuRaw`, `readMap`, and `writeMap` for the mismatching
  record;
- whether the record count or overflow differed.

PC-focused wording should be explicit:

```text
Last matching instruction:
  index=N-1 pcBefore=$.... pcAfter=$....

First divergence:
  frameCount=F
  index=N instructionPc=$....
  TypeScript pcAfter=$....
  WASM       pcAfter=$....
  firstDifferentField=...
```

If `pcBefore` already differs at index `N`, the likely cause is still the
previous matching instruction or an unrecorded event between records. The report
should say that directly and include the previous record.

## Runner Inputs

Start with all normal machine devices active. The runner must not bypass,
stub, or disable media, SD-card, storage, asynchronous frame-command, video,
audio, interrupt, DMA, CTC, copper, or input devices merely because their full
state is not in the first diagnostics record. The first diagnostics record only
chooses which state is compared; it does not choose which hardware runs.

Start with a deterministic configuration surface:

- model/config selection;
- maximum frame count;
- optional stop-on-PC;
- optional start PC/register overrides;
- optional memory patch bytes;
- optional key input script by frame index.

If a device depends on host-owned or asynchronous data, such as SD-card backing
files or frame-command responses, feed both machines from the same deterministic
fixture/provider and process the same command sequence on both sides. Do not add
that device's private state to the trace until an experiment needs it.

## Implementation Steps

### Step 1: Trace Layout Constants

Status: Complete.

- Add shared TypeScript constants for header size, record size, capacity, field
  offsets, field names, and formatting helpers.
- Add a unit test that verifies the layout totals exactly 128 bytes and that all
  fields are inside the record.

Validation:

```text
npm test -- --project node test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts
```

### Step 2: TypeScript Frame Trace Recorder

Status: Complete.

- Add the opt-in recorder with one reusable frame buffer.
- Capture CPU state, counters, last memory/port access, raw MMU values, and
  effective 64K read/write slot descriptors.
- Add tests that run a tiny deterministic instruction sequence and assert the
  binary records without allocating per-instruction objects.

Validation:

```text
npm test -- --project node test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts
```

### Step 3: WASM Static Trace Buffer

Status: Complete.

- Add the C static trace storage and exports.
- Wire record writing into `zxnextCpuExecuteInstruction()`.
- Extend `ZxNextWasmV2Loader.ts` to validate exports and expose the trace view.
- Add build and loader tests for the trace exports.

Validation:

```text
npm run build:zxnext-wasm
npm test -- --project node test/wasm/zxNext/wasm-next-loader.test.ts test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts
```

### Step 4: Binary Comparator

Status: Complete.

- Implement header validation, common-prefix comparison, first-difference
  detection, and PC-focused report formatting.
- Add tests for equal traces, CPU field mismatch, MMU field mismatch, count
  mismatch, and overflow mismatch.

Validation:

```text
npm test -- --project node test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts
```

### Step 5: Headless Runner Script

Status: Complete.

- Create `scripts/run-zxnext-frame-diff.ts`.
- Add `diff:zxnext-machine` to `package.json`:
  `"diff:zxnext-machine": "node scripts/run-zxnext-frame-diff.cjs"`.
- Instantiate TypeScript and WASM machines with identical setup.
- Run frame-by-frame until match exhaustion, mismatch, overflow, max frame
  count, or optional stop condition.
- Print only summaries by default. Add a verbose mode that dumps one decoded
  record around the divergence.
- Always include the current frame count in the mismatch/overflow/max-frame
  summary.

Planned npm command:

```text
npm run diff:zxnext-machine -- --model zxnext
npm run diff:zxnext-machine -- --frames 500 --stop-pc 0x1234 --verbose
```

Validation:

```text
npm run build:zxnext-wasm
npm run diff:zxnext-machine -- --frames 3
```

### Step 6: Repro-Oriented Fixtures

Status: Complete for the initial deterministic fixture surface.

- Add optional fixture loading for memory patches, register overrides, and
  frame-indexed key events.
- Keep fixture data deterministic and local to tests/scripts.
- Add a regression fixture for the known "TypeScript settles at a PC waiting
  for input, WASM does not" scenario once the exact repro is captured.

Validation:

```text
npm test -- --project node test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts
npm run diff:zxnext-machine -- --fixture <fixture-name>
```

## Acceptance Criteria

- The runner can compare at least one complete boot frame without UI rendering
  or audio playback.
- Both backends use preallocated, fixed-size binary trace buffers for a frame.
- No per-instruction JavaScript objects are created while collecting a frame.
- The WASM trace buffer is static and exported as a typed memory view.
- The first mismatch report names the frame, instruction index, first differing
  field, current frame count, last matching PC, and next TypeScript/WASM PC
  values.
- Trace overflow is reported deterministically and does not allocate a larger
  buffer.
- Normal machine devices keep running during comparison even when their private
  state is not part of the initial diagnostics record.
- Tracing is opt-in and disabled during normal emulator use.

## Open Questions

- Whether the TypeScript recorder can be cleanly implemented as a subclass, or
  whether `MachineFrameRunner` should expose tiny opt-in hooks.
- Whether the first comparison should include all counters immediately or start
  with CPU/MMU fields only. The default plan is to compare all V1 fields so
  hidden timing drift is visible early.
- Which deterministic SD/media command fixtures are needed for the repro. The
  devices should run from the start; their private state can stay out of the
  diagnostics until needed.

## Implementation Log

### 2026-08-22

Status: the experimental runner now reaches 1000 ZX Spectrum Next frames with
no TypeScript/WASM trace differences in the default deterministic environment.

- The runner still executes normal devices. SD frame commands are no longer a
  hard stop: matching TypeScript/WASM SD read/write commands are fulfilled by a
  deterministic in-memory sector store, then comparison continues in the same
  machine frame.
- The WASM side is driven through the per-instruction frame loop while tracing,
  so it stops on asynchronous frame commands at the same boundary as the
  TypeScript `MachineFrameRunner`.
- The textual diff output now includes last port diagnostics in the first
  divergence block, recent NextReg port history, and recent general port
  history.
- Resolved frame 9 instruction 6618: the failing read was NextReg `$19`
  (sprite clip window), not `$18`; `$18` values matched immediately before the
  divergence. The WASM clip register cluster now matches TypeScript for
  `$18/$19/$1A/$1B/$1C`.
- Resolved frame 11 instruction 503: NextReg `$07` readback now returns
  programmed speed plus effective speed bits, and expansion-bus changes update
  the effective speed.
- Resolved a diagnostics-only mismatch for a zero-valued opcode fetch at
  address `$0000` by adding explicit WASM memory/port access-present flags
  instead of inferring access presence from nonzero address/value.
- Resolved SD card 1 CMD9 parity: WASM now returns the TypeScript-compatible
  zeroed CSD response for card 1.
- Resolved an app-only storage integration issue: normal WASM no-debug frame
  execution now stops immediately when the SD device queues a host read/write
  command, matching the TypeScript frame runner. The WASM frame-command bridge
  also mirrors TypeScript lazy `getSdCardInfo()` initialization and SD
  read/write error responses.
- Resolved a framebuffer color packing mismatch in the WASM standard ULA
  instant renderer. The TypeScript renderer stores pixel words as
  `0xAABBGGRR` so the byte view is `R,G,B,A`; the WASM ULA color table now uses
  the same packed order for asymmetric red/blue/cyan/yellow entries.
- Resolved WASM ULA clip/scroll integration for the standard ULA instant
  renderer. NextRegs `$1A`, `$26`, and `$27` are now owned by the ULA module,
  have TypeScript-compatible direct readback, and the renderer applies the ULA
  clip window after pixel-level X/Y scroll.

Validation:

```text
npm run diff:zxnext-machine -- --model zxnext
# No differences found after 1000 frame(s). Current frame count: 1000.

npm test -- --project node test/wasm/zxNext/wasm-next-loader.test.ts test/wasm/zxNext/wasm-next-frame-diff-runner.test.ts test/wasm/zxNext/wasm-next-frame-runner.test.ts test/wasm/zxNext/wasm-next-build.test.ts test/wasm/zxNext/wasm-next-nextreg.test.ts test/wasm/zxNext/wasm-next-interrupts.test.ts test/wasm/zxNext/wasm-next-divmmc.test.ts test/wasm/zxNext/wasm-next-ports.test.ts test/wasm/zxNext/wasm-next-nmi.test.ts test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-sd-spi.test.ts test/wasm/zxNext/wasm-next-storage-commands.test.ts
# 12 files, 59 tests passed

npm run build:check
npm run check:zxnext-wasm-size
```

Additional color-packing validation:

```text
npm run build:zxnext-wasm
npm test -- --project node test/wasm/zxNext/wasm-next-screen-ula.test.ts
npm test -- --project node test/wasm/zxNext/wasm-next-visual-smoke.test.ts test/wasm/zxNext/wasm-next-frame-runner.test.ts
```

Additional ULA clipping/scroll validation:

```text
npm run build:zxnext-wasm
npm test -- --project node test/wasm/zxNext/wasm-next-screen-ula.test.ts
npm test -- --project node test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-visual-smoke.test.ts test/wasm/zxNext/wasm-next-frame-runner.test.ts
npm run build:check
npm run check:zxnext-wasm-size
npm run diff:zxnext-machine -- --model zxnext
# No differences found after 1000 frame(s). Current frame count: 1000.
```
