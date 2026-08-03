# ZX Spectrum 48K WASM performance tuning — T5 note

Generated: 2026-08-02T17:35:31Z

## Implemented

- Added adapter-side coverage tracking for the static WASM tape EAR table.
- The adapter no longer fills the full EAR table with the default value when
  tape input is not in LOAD mode.
- In LOAD mode, the adapter regenerates the table only when the selected tape
  frame/window changes.
- When execution resumes part-way through a frame, the adapter generates only
  the remaining tact window that WASM can read before the next frame end.
- Added diagnostics-only tape EAR sync stats:
  `getWasmTapeEarSyncStats()` and `resetWasmTapeEarSyncStats()`.

## Focused behavior checks

- Unchanged tape frame/window:
  - generations: 1
  - reused: 1
  - filled tacts: 64 of 64
- Boundary-resume window starting at tact 16 of a 64-tact test frame:
  - generations: 1
  - filled tacts: 48 of 64
  - later read at tact 24 reused the covered window

## Benchmark result

`npm run benchmark:sp48-wasm` remained stable after T5.

- Artifact size: 77,434 bytes
- `tape-load-ear-loop`: WASM median 21.110 ms / 200 frames
- `keyboard-polling-loop`: WASM median 20.488 ms / 200 frames
- `debug-step-nop-loop`: WASM median 0.673 ms / 10,000 steps

The benchmark harness drives the C core directly with a pre-filled EAR table, so
it validates that the core path did not regress but does not directly measure
the TypeScript adapter's table-generation reduction. The new focused tests cover
that adapter work with deterministic generation/reuse counters.

## T5.3/T5.4 decision

Moving tape pulse generation into C is deferred. The current adapter keeps tape
file parsing, arbitrary tape block ownership, and fast-load policy in
TypeScript, while WASM receives only a bounded static per-frame EAR window. This
preserves the no-dynamic-allocation constraint and avoids introducing a second
tape model unless future profiling shows tape boundary/table generation
dominates real media playback.
