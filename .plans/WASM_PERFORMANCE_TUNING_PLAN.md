# WASM Performance Tuning Plan

## Context

The ZX Spectrum WASM backends are full-machine C cores built as freestanding
`wasm32` modules:

- ZX Spectrum 48K: `src/emu/machines/zxSpectrum48/wasm/v2/sp48/sp48.c`
- ZX Spectrum 128K: `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128.c`
- Shared devices: `src/emu/machines/zxSpectrum/wasm/v2/common/`
- Shared Z80 core: `src/emu/machines/zxSpectrum48/wasm/v2/z80/z80.c`
- Build scripts:
  - `scripts/build-sp48-wasm.cjs`
  - `scripts/build-sp128-wasm.cjs`

The build uses plain `clang --target=wasm32`, not Emscripten. Current
optimization profiles are:

- `speed`: `-O3`
- `size`: `-Oz`
- `lto`: `-O3 -flto`

The default profile is currently `speed`. The build scripts also use:

- `-ffreestanding`
- `-fno-builtin`
- `-nostdlib`
- `-Wl,--no-entry`
- `-Wl,--export-memory`
- fixed `--initial-memory` and `--max-memory`

There is no current post-link Binaryen `wasm-opt` step, no linker strip/gc
experiment, and no dedicated WASM runtime benchmark harness.

## Goals

1. Improve normal-frame throughput for SP48 and SP128 without regressing timing
   accuracy.
2. Keep artifacts within existing size ceilings.
3. Preserve the full-machine WASM architecture and avoid JS/WASM boundary churn.
4. Make performance decisions from repeatable benchmark data, not isolated code
   inspection.
5. Keep all changes incremental and covered by existing parity/oracle tests.

## Non-Goals

- Do not restore old hybrid CPU-only WASM paths.
- Do not introduce Emscripten unless a separate build-system decision is made.
- Do not trade off Z80 timing, floating bus behavior, contention, tape, or audio
  correctness for speed.
- Do not broadly rewrite the C core before measuring localized candidates.

## Phase 1: Baseline Benchmark Harness

Add a small Node-based benchmark script, for example
`scripts/benchmark-spectrum-wasm.cjs`, that:

1. Builds or loads the current SP48 and SP128 WASM artifacts.
2. Instantiates them directly with `WebAssembly.instantiate`.
3. Uploads minimal ROM/program bytes needed for benchmark scenarios.
4. Warms up each scenario.
5. Runs repeated measurements and reports median/min/max.
6. Prints artifact size and build profile.

Initial scenarios:

- Empty or NOP-heavy frame loop.
- CPU-heavy loop with little or no screen memory access.
- Screen-write-heavy loop that writes into display memory.
- Border-change-heavy loop using `OUT (FE),A`.
- Keyboard-port-read-heavy loop.
- Tape passive/load mode overhead comparison.
- SP128 paging-heavy loop.
- SP128 PSG-write and PSG-audio-heavy loop.

Metrics:

- Frames per second.
- Milliseconds per frame.
- Instructions executed per frame.
- Audio samples generated per frame.
- Artifact byte size.

Validation:

- Benchmark script must not change production artifacts unless explicitly asked.
- Results should be easy to paste into PRs or plan updates.

## Phase 2: Build Switch Matrix

Benchmark the current build against a controlled build matrix.

Profiles to test:

- `-O3`
- `-O3 -flto`
- `-Oz`
- `-O3 -ffunction-sections -fdata-sections -Wl,--gc-sections`
- `-O3 -flto -Wl,--strip-all`
- `-O3 -flto -ffunction-sections -fdata-sections -Wl,--gc-sections -Wl,--strip-all`

Optional, only if Binaryen is available or deliberately added:

- `wasm-opt -O3`
- `wasm-opt -O4`
- `wasm-opt -Oz`

Decision rule:

- Prefer the fastest profile that stays within size ceilings and does not make
  stack traces/diagnostics unacceptably worse.
- If `lto` consistently wins, consider making it the default profile.
- If `wasm-opt` wins, decide whether the repo should depend on Binaryen or use
  it only as an optional local benchmark tool.

Build tests to update if switches change:

- `test/zxSpectrum/sp48-wasm-build.test.ts`
- `test/zxSpectrum/sp128-wasm-build.test.ts`

## Phase 3: Gate Always-On Diagnostics

Current hot paths record last memory and port events during normal execution.
Examples:

- SP48 CPU memory read/write event recording in `sp48-memory.c`.
- SP128 CPU memory read/write event recording in `sp128.c`.
- Z80 port event recording in `z80.c`.

Candidate:

- Add a runtime flag or compile-time switch for memory/port event capture.
- Keep it enabled for debug stepping and diagnostics.
- Disable or minimize it during normal `executeFrame` runs.

Benchmark expectation:

- CPU-heavy and memory-heavy loops should improve if stores to diagnostic fields
  are material.

Correctness checks:

- Debugger tests that inspect last memory/port access must still pass.
- Normal frame execution should expose a clear behavior for disabled diagnostics,
  such as returning zero/no event.

## Phase 4: Audio Sampling Hot Path

Current tact updates call audio sampling frequently:

- SP48 uses `Z80_TACT_PLUS_N` in `sp48.c`.
- SP128 uses `tactPlusN128` in `sp128.c`.
- Shared beeper logic uses double arithmetic in
  `common/zx-spectrum-beeper.c`.

Candidates:

1. Add a fast integer guard before any double conversion:
   - Keep an integer next-sample tact threshold.
   - Only enter double/filter logic when the current tact crosses it.
2. Use fixed-point sample scheduling:
   - Avoid repeated `double` comparisons in the tact increment path.
3. Batch safe tact increments:
   - Keep exact audio transitions on port/tape changes.
   - Avoid per-tact sample checks when the entire increment is before the next
     sample boundary.
4. For SP128, measure PSG advancement cost separately from beeper sampling.

Decision rule:

- Keep the audio waveform equivalent within existing test tolerances.
- Prefer a small guard/fixed-point change before changing filter behavior.

## Phase 5: Current Frame Tact Fast Path

`currentFrameTact()` divides by `clockMultiplier` in the shared ULA and SP128
helpers. Normal speed likely uses multiplier `1`.

Candidate:

- Add a branch for `clockMultiplier == 1`:
  - `tact = elapsedTacts`
  - avoid division in the common case.

Possible follow-up:

- Maintain a cached current-frame tact during tact advancement if profiling shows
  repeated recomputation is still expensive.

Correctness checks:

- Frame overshoot behavior must remain unchanged.
- Floating bus offset tests must continue to pass.
- Clock multiplier changes must only take effect at the same frame lifecycle
  points as today.

## Phase 6: Z80 Flag Lookup Tables

The Z80 core already uses opcode dispatch tables. Do not treat opcode dispatch
as missing.

More promising table candidates:

- `sz53[256]`
- `sz53pv[256]`
- `incFlags[256][2]` or equivalent carry-preserving table.
- `decFlags[256][2]` or equivalent carry-preserving table.
- Optional rotate/shift result+flag tables for CB-heavy programs.

Benchmark order:

1. Add `sz53` and `sz53pv` tables.
2. Measure ALU-heavy and CB-heavy loops.
3. Add inc/dec tables only if the first tables help.
4. Avoid large ADD/ADC/SUB/SBC tables until smaller tables prove worthwhile.

Risks:

- Larger tables may increase artifact size.
- Larger data may reduce locality enough to lose speed.

Validation:

- Run the Z80 CPU test suite and SP48/SP128 machine tests after every table
  change.

## Phase 7: ULA Pixel Expansion Tables

The ULA already precalculates timing, contention, rendering phase, pixel
address, attribute address, and pixel buffer index tables.

Remaining hot work:

- Attribute decoding.
- Flash handling.
- Per-pixel ink/paper selection.
- Repeated pixel buffer bounds checks.

Candidates:

1. Runtime-initialize attr color tables:
   - `attrColor[2][256][2]`, where the first dimension is flash state.
   - Each entry maps attribute and pixel bit to a 32-bit color.
2. Runtime-initialize two-pixel expansion:
   - For each `pixelByte`, `attr`, and flash state, produce four or eight color
     words.
   - Measure carefully, because this can grow memory pressure quickly.
3. Cache `pixelBufferWordCount()` once per frame or after timing changes.
4. Split render paths:
   - Border pixels.
   - Display pixels without fetch.
   - Fetch+display cases.

Decision rule:

- Start with small attr color tables.
- Only use larger pixel expansion tables if benchmarks show a clear win.
- Prefer runtime-initialized static arrays over large source literals.

Correctness checks:

- Flash phase must match existing behavior.
- Border color changes must still render at the right tact.
- Floating bus rendering tables must remain untouched unless tests are expanded.

## Phase 8: Keyboard Port Read Lookup

Current keyboard reads loop through 8 keyboard rows for each FE-port read.

Candidate:

- Maintain `keyboardSelectedLineValue[256]`.
- Recompute it when a key row changes, or update affected combinations
  incrementally.
- Port read becomes:
  - compute selected line mask from high byte.
  - load precomputed row aggregate.

Expected win:

- Keyboard-heavy programs and ROM loops that poll the keyboard repeatedly.

Risks:

- Key matrix semantics are simple but easy to invert incorrectly.

Validation:

- Existing keyboard and port read tests.
- Add direct tests for selected row combinations if missing.

## Phase 9: SP128 Memory Mapping

SP128 currently keeps banked RAM/ROM and a flat 64K mirror. It also maps reads
through branching logic.

Candidates:

1. Use cached slot metadata:
   - Four slot base offsets.
   - Four slot source arrays or direct page descriptors.
2. Fast path CPU reads/writes through slot tables:
   - Avoid repeated branch chains in `readMappedMemory`.
3. Avoid full `rebuildFlatMemory()` for direct bank writes:
   - Update the mirror only if the written bank is currently visible.
4. On paging changes, rebuild only the affected slots in the flat mirror if the
   mirror remains necessary for exported memory views.

Decision rule:

- Preserve the flat memory export behavior expected by the loader and UI.
- Do not remove `sp128MemoryPtr` unless adapters/tests are deliberately changed.

Validation:

- SP128 paging tests.
- Screen bank and shadow screen tests.
- Floating bus tests using displayed screen bank.

## Phase 10: SP128 PSG Optimization

The PSG code already uses volume/envelope tables but advances samples in a loop
to the current tact.

Candidates:

1. Skip PSG advancement when inactive or all channels are silent and no envelope
   state can affect output.
2. Cache mixer register-derived booleans:
   - tone disabled per channel.
   - noise disabled per channel.
   - envelope enabled per channel.
3. Replace repeated helper calls in the per-sample loop with cached fields.
4. Measure integer or fixed-point accumulation for routed output.

Validation:

- PSG register tests.
- Audio output sanity checks.
- Benchmark with both silent and active PSG workloads.

## Phase 11: Tape Path Review

Tape mode is checked around every instruction. Fast load and tape playback also
call into CPU memory helpers.

Candidates:

1. Add a very cheap passive-mode guard in `updateTapeMode`.
2. Avoid repeated `z80GetPc()` calls by using already-known PC if exposed safely.
3. Ensure fast load memory writes do not trigger unnecessary ULA rendering or
   diagnostics unless required.

Decision rule:

- Tape correctness and ROM trap behavior matter more than minor normal-frame
  gains.
- Only tune tape after higher-frequency CPU/audio/ULA costs are measured.

## Phase 12: Test And Regression Strategy

Focused tests after every candidate:

```sh
npm test -- --project jsdom test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
```

Relevant broader checks:

```sh
npm run build:sp48-wasm
npm run build:sp128-wasm
npm run check:sp48-wasm-size
npm run check:sp128-wasm-size
npm run build:check
```

Run focused machine/loader tests when touched behavior warrants it:

```sh
npm test -- --project jsdom test/zxSpectrum/sp48-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/sp128-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
```

For Z80 core changes, run the Z80 CPU tests as well.

## Recommended Implementation Order

1. Add benchmark harness.
2. Run and document build-switch matrix.
3. Add `clockMultiplier == 1` fast path.
4. Gate normal-run diagnostics.
5. Add small Z80 flag tables.
6. Add keyboard selected-line lookup.
7. Optimize audio sample scheduling.
8. Add small ULA attr color table.
9. Rework SP128 memory mapping if benchmark data supports it.
10. Tune SP128 PSG.
11. Review tape path.

## Success Criteria

- Measurable improvement in median `executeFrame` time for both SP48 and SP128.
- No regression in existing timing, rendering, floating bus, tape, PSG, or
  keyboard tests.
- WASM artifacts remain under existing size ceilings.
- Benchmark results are committed or documented with enough detail to compare
  future changes.

## Execution Summary - 2026-08-09

Implemented phases 1 through 11:

- Added `scripts/benchmark-spectrum-wasm.cjs` and `npm run benchmark:spectrum-wasm`.
- Updated the default speed build profile to `-O3 -Wl,--strip-all`.
- Gated normal-frame bus diagnostics while preserving instruction-level debugger events.
- Added the audio next-sample integer guard and `clockMultiplier == 1` tact fast path.
- Added Z80 `sz53` / `sz53pv` flag tables.
- Added ULA attribute color lookup tables.
- Added keyboard selected-line lookup tables and fixed the JS adapter sync path to use
  WASM key setters so cached port reads stay coherent.
- Added SP128 memory slot metadata, direct visible-bank mirror updates, and partial
  ROM/top-RAM mirror rebuilds on paging changes.
- Tuned SP128 PSG sample generation by removing helper calls from the per-sample loop.
- Reduced shared tape polling work by reading the Z80 PC once per `updateTapeMode`.

Final artifact sizes:

- SP48: `226,259` bytes, below the `240,000` byte ceiling.
- SP128: `137,084` bytes, below the `320,000` byte ceiling.

Final benchmark command:

```sh
npm run benchmark:spectrum-wasm -- --frames 120 --warmup 20 --runs 7
```

Selected final median timings:

- SP48 `nop-loop`: `0.45 ms/frame`.
- SP48 `cpu-loop`: `0.39 ms/frame`.
- SP48 `keyboard-read-loop`: `0.37 ms/frame`.
- SP48 `tape-load-port-read`: `0.38 ms/frame`.
- SP128 `nop-loop`: `0.52 ms/frame`.
- SP128 `cpu-loop`: `0.46 ms/frame`.
- SP128 `keyboard-read-loop`: `0.40 ms/frame`.
- SP128 `paging-loop`: `0.42 ms/frame`.
- SP128 `psg-write-loop`: `0.47 ms/frame`.
- SP128 `psg-audio-loop`: `0.52 ms/frame`.

Final validation passed:

```sh
npm run build:sp48-wasm
npm run build:sp128-wasm
npm run check:sp48-wasm-size
npm run check:sp128-wasm-size
npm run build:check
npm test -- --project jsdom test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm test -- --project jsdom test/zxSpectrum/sp48-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm test -- --project jsdom test/z80
git diff --check
```
