# ZX Spectrum 48K WASM performance tuning — T6 note

Generated: 2026-08-02T17:45:27Z

## Implemented

- Added an explicit `static inline` policy for small hot-path C helpers.
- Inlined Z80 timing, memory, port, fetch, condition, arithmetic, flag,
  register-selector, indexed-register, and operation-wrapper helpers.
- Inlined SP48 ABI packing, frame-tact normalization, tact advancement,
  contention lookup, floating-bus read, tape-EAR read, tape-boundary check,
  state flag/signal, and port-read helpers.
- Preinitialized Z80 parity and opcode dispatch tables outside the instruction
  hot loop:
  - `z80_reset()` prepares them.
  - `sp48_import_state()` also prepares them for adapter setup/import paths that
    do not call reset before first execution.
- Removed lazy parity-table initialization calls from logical/flag/block-I/O
  helpers.

## Benchmark result

`npm run benchmark:sp48-wasm`

- Artifact size: 73,378 bytes
- Previous T5 artifact size: 77,434 bytes
- Size delta: -4,056 bytes

Selected WASM medians:

- `idle-rom-loop`: 20.625 ms / 200 frames
- `ram-heavy-loop`: 21.239 ms / 200 frames
- `contended-screen-loop`: 19.621 ms / 200 frames
- `fe-border-audio-loop`: 26.091 ms / 200 frames
- `keyboard-polling-loop`: 20.267 ms / 200 frames
- `tape-load-ear-loop`: 20.564 ms / 200 frames
- `floating-bus-loop`: 19.512 ms / 200 frames
- `debug-step-nop-loop`: 0.627 ms / 10,000 steps

## T6.7/T6.8 decision

Generated-switch dispatch and direct opcode specialization were evaluated
against the inline-pass result and deferred. The inline pass already reduced
artifact size and kept the frame scenarios stable, while a switch/direct-opcode
rewrite would be broader, harder to review, and likely to increase generated
WASM size. Keep T6.7/T6.8 as future work only if later profiling shows
function-pointer dispatch dominates after build/LTO and adapter-overhead phases.

