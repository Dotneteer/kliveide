# Z80 WASM Migration Handoff

Read `../AGENTS.md` and `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md` before
changing Spectrum WASM work. This note records the post-CPU-phase state on
2026-08-02.

## Current state

- The C/WASM Z80 and Z80N CPU core is implemented and covered by the cloned
  WASM opcode-page tests, differential stress tests, `npm run build:check`, and
  the full unit suite.
- The CPU core is still test/integration infrastructure. It is not yet wired
  into the production Spectrum 48K frame runner.
- `ZxSpectrum48WasmMachine` remains the compatibility adapter selected by
  `sp48Implementation: "wasm"`; its `setup()` now loads and validates the WASM
  artifact, but full production frame execution still needs the Spectrum 48K
  WASM integration plan.
- Phase P0 in `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md` is complete:
  production/test export manifests, generated layout constants, async loader,
  setup validation, and artifact packaging/resource declarations are in place.
- Phase P1 is complete: WASM-owned 64K memory, adapter typed views, ROM/RAM
  write rules, 16K model memory protection, reset memory parity, snapshot
  import/export, and dirty-memory range reporting are in place.
- Phase P2 is complete: the shared C Z80 core can run against a Spectrum 48K
  bus, bounded instruction execution is exported, the WASM adapter uses it for
  debug-style/termination-point execution, and tests cover HALT, INT, frame-end,
  execution-point, FE-port, and seeded replay parity.
- Phase P3 is complete: normal no-debug Spectrum 48K WASM execution now calls
  `sp48_execute_frame()`, keyboard rows are copied into the input block, FE
  keyboard reads and FE output latch/border state live in C, and fixed-ROM
  frame smoke parity is covered before timing diagnostics are emitted.
- Phase P4 is complete: C execution applies 48K contention from a static
  per-tact table, odd-port floating-bus reads use a static per-tact screen
  fetch-address table, FE writes populate a bounded border trace in the event
  buffer, and the adapter keeps using the existing TypeScript screen renderer
  against WASM RAM rather than adding a C pixel buffer.
- The C/WASM emulator implementation must remain static-allocation only. The
  Phase P1 audit found no `malloc`, `calloc`, `realloc`, `free`, or
  `aligned_alloc` calls under the Spectrum 48K WASM and Z80 WASM source trees.
- The source-of-truth forward plan is now
  `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md`. It intentionally removed the
  historical opcode-by-opcode checklist because it no longer helps future 48K
  integration work.

## ABI and implementation facts to preserve

- CPU implementation code lives in `src/emu/z80/wasm/z80_cpu.c`.
- ABI wrappers and test-bus storage live in `src/emu/z80/wasm/z80_abi.c`.
- Shared state and field definitions live in `src/emu/z80/wasm/z80_state.h`.
- `z80_abi.c` must remain an ABI wrapper layer; do not move instruction decode
  tables or opcode bodies back into it.
- The exported Z80 state contract uses the packed state block:
  `z80_state_block_ptr`, `z80_state_block_size`, `z80_state_export`, and
  `z80_state_import`.
- Removed transitional exports such as `z80_state_read_*`,
  `z80_state_write_*`, `z80_state_size`, `z80_register_layout_probe`, and
  primitive helper probes should stay removed unless a new manifest-approved
  production/test contract requires them.
- Z80N mode is controlled by the C state flag `z80n_mode`; 28 MHz frame-tact
  scaling uses `cpu_tact_scale`; NEXTREG writes are represented in the test-bus
  TBBlue log.

## Test harness facts

- `test/z80/wasm-test-z80.ts` is the test-only WASM façade used by cloned Z80
  opcode tests.
- The current test bus uses deterministic linear-memory buffers:
  64K test RAM, preloaded I/O input bytes, memory/I/O logs, and TBBlue logs.
- The production 48K backend must replace this test bus with a machine bus and
  compact state/event buffers. Normal running must not cross the JS/WASM
  boundary per instruction, per tact, per memory access, or per port access.
- The Z80 C core now has selectable bus mode. Keep the test bus as the default
  for `test/z80`; the Spectrum 48K bounded-execution path switches to the 48K
  static-memory bus before calling the CPU core.
- `test/z80/z80-wasm-abi.test.ts` asserts the approved WASM export manifest.
- `test/zxSpectrum/sp48-wasm-abi-manifest.test.ts` asserts the Spectrum 48K
  production/test manifest and generated layout constants against the built
  WASM artifact.
- `test/zxSpectrum/sp48-wasm-loader.test.ts` covers loader success, missing
  artifacts, incompatible ABI/layout, and module-cache reuse.

## Last verified gates

```sh
npx vitest run --config build/vitest.config.ts --project node test/z80/z80-wasm-abi.test.ts test/z80/standard-ops-00.wasm.test.ts test/z80/next-ops.wasm.test.ts test/z80/z80n-wasm-differential.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/*.wasm.test.ts test/z80/*wasm-differential.test.ts
npm run build:check
npm run test
git diff --check
```

The full suite at the end of A0 reported 557 passed files, 19,929 passed tests,
14 skipped files, and 119 skipped tests.

After Phase P0, the focused gates plus full suite passed:

```sh
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/z80/z80-wasm-abi.test.ts
npm run build:sp48-wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P0 reported 560 passed files, 19,940 passed tests, 14
skipped files, and 119 skipped tests.

After Phase P1, the focused gates plus full suite passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/z80/z80-wasm-abi.test.ts
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/*.test.ts test/z80/z80-wasm-abi.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P1 reported 561 passed files, 19,946 passed tests, 14
skipped files, and 119 skipped tests.

After Phase P2, the focused gates plus full suite passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/z80/z80-wasm-abi.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/*.wasm.test.ts test/z80/*wasm-differential.test.ts
npx vitest run --config build/vitest.config.ts --project node test/6510-assembler/*.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P2 reported 562 passed files, 19,952 passed tests, 14
skipped files, and 119 skipped tests. The prior renderer `nex-file-writer.ts`
Node-module warnings and the duplicate `case "sax"` assembler warning were
removed; only the generic chunk-size warning remains during the Vite build.

After Phase P3, the focused gates plus full suite passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/z80/z80-wasm-abi.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/*.wasm.test.ts test/z80/*wasm-differential.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P3 reported 562 passed files, 19,957 passed tests, 14
skipped files, and 119 skipped tests. One full-suite run hit a transient
unrelated audio performance threshold (`54.45ms < 50ms`); the focused audio
test passed immediately afterward and the repeated full suite passed.

After Phase P4, the focused gates plus full suite passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/z80/z80-wasm-abi.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/*.wasm.test.ts test/z80/*wasm-differential.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P4 reported 562 passed files, 19,961 passed tests, 14
skipped files, and 119 skipped tests.

Phase P5 is now implemented:

- The 48K C core stores border and audio traces in fixed slices of the static
  event buffer: 256 border records and 256 EAR/MIC audio transition records.
- Audio trace records are 8 bytes: frame tact `u32`, FE value, EAR latch, MIC
  latch, and one reserved byte.
- Audio overflow is explicit through `sp48_event_status()` and
  `eventStatusAudioOverflowMask`; overflowing FE-transition programs keep the
  trace bounded instead of silently writing past capacity.
- `ZxSpectrum48WasmMachine` exposes `getWasmAudioTrace()`,
  `clearWasmAudioTrace()`, and `getWasmEventStatus()`.
- Normal WASM frame execution replays audio transitions through
  `SpectrumBeeperDevice.renderTransitionTrace(...)`, so existing IDE audio
  consumers continue using `getAudioSamples()`.
- The implementation still uses static WASM memory only; the dynamic-allocation
  audit remains clean.

Focused P5 gates passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/audio/BeeperDevice.test.ts test/audio/AudioDeviceBase.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/*.wasm.test.ts test/z80/*wasm-differential.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P5 reported 562 passed files, 19,965 passed tests, 14
skipped files, and 119 skipped tests.

Phase P6 is now implemented:

- The 48K C core has a static per-frame tape EAR table and samples it for
  port `$FE` reads while the input tape mode is LOAD.
- The static event buffer now has fixed slices for border trace, audio trace,
  and MIC/tape-save trace. Tape-save trace records are 8 bytes: frame tact
  `u32`, FE value, MIC latch, EAR latch, and one reserved byte.
- Tape-save overflow is explicit through `sp48_event_status()` and
  `eventStatusTapeSaveOverflowMask`.
- `ZxSpectrum48WasmMachine` copies TypeScript tape mode/default EAR state into
  WASM, precomputes the EAR table from the existing `TapeDevice`, exposes
  `getWasmTapeSaveTrace()`/`clearWasmTapeSaveTrace()`, and replays MIC
  transitions back through `TapeDevice.processMicBit(...)`.
- Tape mode and fast-load policy remain TypeScript-owned and are evaluated at
  WASM execution boundaries.
- The fixed WASM memory reservation is now 768 KiB to hold the additional
  static tape table. No dynamic allocation was introduced.

Focused P6 gates passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P6 reported 562 passed files, 19,970 passed tests, 14
skipped files, and 119 skipped tests.

Phase P7 is now implemented:

- The Z80 WASM core now records instruction-bound memory and I/O access logs
  while running in SP48 bus mode, not only in standalone Z80 test mode.
- `sp48_debug_memory_log_*` and `sp48_debug_io_log_*` exports expose those
  fixed logs through the SP48 ABI. The record shape remains 4 bytes:
  address `u16`, value `u8`, operation `u8` (`0` read, `1` write).
- `ZxSpectrum48WasmMachine` imports the C access logs into the existing
  `lastMemoryReads`, `lastMemoryWrites`, `lastIoRead*`, and `lastIoWrite*`
  fields after each debug instruction.
- Debug-mode WASM execution now runs one complete C instruction at a time and
  applies the existing TypeScript `DebugSupport` policy for memory/I/O
  breakpoints, execution breakpoints, step-into, step-over, step-out, and
  run-to-address.
- Normal no-debug frames still use `sp48_execute_frame()` and do not delegate to
  TypeScript CPU/tact/memory hooks.
- `getCpuState()` remains the debugger/disassembly state source after WASM
  sync, and `getWasmDiagnostics()` reports backend, ABI version, artifact name,
  last termination status, CPU status, and event status.
- The dynamic-allocation audit remains clean.

Focused P7 gates passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P7 reported 562 passed files, 19,974 passed tests, 14
skipped files, and 119 skipped tests.

Phase P8 is now implemented:

- Added a P8 TypeScript-vs-WASM compatibility fixture that covers a fixed ROM,
  keyboard FE input, contention timing, border trace summaries, audio
  transitions, tape-save MIC summaries, and tape-load EAR sampling.
- Added a correctness-first P8 benchmark fixture. It compares termination, CPU
  state, and memory before emitting structured TypeScript/WASM frame timings.
- Added package rollout assertions for
  `wasm/zxSpectrum48/zx-spectrum48.wasm` and a smoke test that instantiates the
  artifact bytes copied by Electron packaging.
- Added a manifest gate that every production SP48 export is declared by the
  TypeScript loader contract. This caught and fixed the missing
  `sp48_create` declaration.
- Strengthened backend-selection tests: default selection is centralized,
  explicit config selects either backend, unknown values use the centralized
  default, and explicit TypeScript config opts out of a model-level WASM
  experiment.
- Updated `src/emu/machines/zxSpectrum48/wasm/README.md` and the implementation
  selector comments with the current rollout/error policy: centralized default
  backend switch, no silent fallback once WASM is selected, diagnostics via
  `getWasmDiagnostics()`, packaged artifact location, and static-memory-only
  C/WASM constraints.
- The dynamic-allocation audit remains clean.

Focused P8 gates passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
```

Full P8 gates passed:

```sh
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
git diff --check
```

The full suite after P8 reported 562 passed files, 19,979 passed tests, 14
skipped files, and 119 skipped tests. The Electron/Vite build emitted only the
existing generic chunk-size warning.

The 48K backend rollout switch has now been flipped to WASM by default:

- `DEFAULT_SP48_IMPLEMENTATION` in
  `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts` is the
  centralized one-line switch and is set to `"wasm"`.
- Explicit `sp48Implementation: "typescript"` still switches a machine back to
  the TypeScript backend for manual fallback and compatibility comparison.
- Unknown implementation values use the centralized default.

## Next useful work

The initial ZX Spectrum 48K WASM completion plan is implemented, and the 48K
factory now uses WASM by default. Future work should move to rollout decisions,
real-world compatibility reports, and whether any discovered compatibility issue
should temporarily move `DEFAULT_SP48_IMPLEMENTATION` back to `"typescript"`.

Do not continue by adding more Z80 opcode-migration rows. That phase is done.
