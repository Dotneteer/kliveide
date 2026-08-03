# ZX Spectrum 48K WASM Backend — Fast Z80 Replacement Plan

## Goal

The previous WASM tuning pass improved code shape but did not produce a
meaningful manual performance win. This plan treats the fast `z80.c`
implementation from the `dotneteer/groups-plan` branch as the new CPU-kernel
model and migrates the current WASM backend toward that implementation in
small, benchmarkable steps.

Reference source:

- `https://github.com/Dotneteer/kliveide/blob/dotneteer/groups-plan/src/emu/z80/z80.c`

## Key Findings From The Fast Source

The fast source is not merely a few micro-optimizations. Its performance comes
from a simpler hot-path architecture:

- One self-contained CPU translation unit owns CPU state and opcode execution.
- Register-pair aliases (`AF`, `BC`, `A`, `F`, `B`, `C`, and so on) keep opcode
  bodies direct and compact.
- CPU control state uses separate byte fields such as `halted`, `iff1`, `iff2`,
  `sigInt`, `afterLdAIR`, and `prefix` instead of bit-packed generic flags.
- Memory, I/O, and timing are injected through compile-time macros such as
  `Z80_READ_MEMORY`, `Z80_WRITE_MEMORY`, and `Z80_TACT_PLUS_N`.
- Opcode dispatch tables are compile-time `static const` arrays, not runtime
  initialized mutable tables.
- Common register-to-register and ALU opcodes are expanded to direct opcode
  bodies, avoiding selector switches on every hot instruction.
- Prefix handling is inside one CPU cycle function with direct state mutation
  and no ABI import/export around standalone instruction execution.

The current implementation already has parity infrastructure and SP48 hardware
integration, but its CPU core still pays for a more generic design:

- `z80_bus_mode` branches remain in every memory and port access.
- Debug/test logging and SP48 production access share the same helper layer.
- CPU boolean/control state is encoded through `state.flags` and `state.signals`.
- Many hot opcode families use `readRegister`/`writeRegister` selectors.
- Opcode tables are prepared at runtime.
- The CPU ABI and SP48 state block shapes are optimized for safety and tests,
  not for CPU-inner-loop simplicity.

## Constraints

- Preserve the existing TypeScript backend fallback.
- Preserve current SP48 WASM ABI compatibility unless a specific step updates
  loader/tests/documentation together.
- Keep C/WASM static allocation only. No `malloc`, `calloc`, `realloc`, `free`,
  or unbounded emulator-owned data structures.
- Keep TypeScript in charge of IDE/controller policy, breakpoints, source-level
  debug behavior, file parsing, and fast-load policy.
- Keep the production backend crossing the JS/WASM boundary once per normal
  frame except existing tape/debug boundaries.
- Keep standalone Z80 and SP48 parity tests as the safety rail for each slice.

## Phase F0 — Baseline And Diff Harness

| Step | Work | Gate |
| --- | --- | --- |
| F0.1 | Vendor the fast `z80.c` into a non-production comparison location, for example `src/emu/z80/wasm/reference/fast_z80.c`, with an origin comment and no build wiring yet. | `git diff --check`; license/origin note reviewed. |
| F0.2 | Add a temporary build target that compiles the fast source as a standalone test artifact with its own memory, matching the existing standalone Z80 test facade where practical. | Artifact builds without linking into the production SP48 backend. |
| F0.3 | Run cloned opcode-page tests against both current and fast standalone artifacts. Record mismatches by opcode/prefix/register field. | Existing `test/z80` remains green for current artifact; comparison report generated for fast artifact. |
| F0.4 | Benchmark the fast standalone CPU against the current standalone CPU using fixed opcode mixes: NOP/JR loops, register ALU, memory load/store, stack/call/ret, CB, ED block ops, IX/IY, and Z80N ops. | `.ai/` note records speed, artifact size, and correctness status. |

Status: Complete as of 2026-08-03.

- F0.1 vendored the source at `src/emu/z80/wasm/reference/fast_z80.c`.
- F0.2 added `fast-z80-reference` build mode, emitted to
  `src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-fast-z80-reference.wasm`.
- F0.3 kept the existing cloned WASM opcode-page suite green for the current
  artifact and added the comparison harness
  `npm run benchmark:z80-wasm-fast-reference`.
- F0.4 saved benchmark/correctness notes in
  `.ai/zx-spectrum48-wasm-fast-z80-f0-benchmark.md`.

Decision gate: continue only if the fast standalone artifact is clearly faster
on representative opcode mixes or identifies concrete architectural wins.

F0 decision: continue, but expect architectural rather than dramatic standalone
CPU wins. The comparison-only artifact matched all F0 scenarios and showed
roughly 1.05x-1.12x wins on standard, memory/stack, CB, and ED mixes, while the
small IX/IY and Z80N scenarios were neutral/slightly slower. The reference
artifact is much larger because it keeps direct opcode bodies and the test ABI
adapter together; production migration should move the architecture, not ship
this comparison artifact.

## Phase F1 — State Shape Compatibility

| Step | Work | Gate |
| --- | --- | --- |
| F1.1 | Replace or mirror the current `Z80State` layout with the fast source's direct fields: separate `halted`, `sigInt`, `sigNmi`, `sigRst`, `iff1`, `iff2`, `afterLdAIR`, `retExecuted`, and `retnExecuted`. Keep existing exported ABI offsets unchanged by translating at block import/export boundaries. | `test/z80` ABI/state tests pass. |
| F1.2 | Add register aliases/macros in the production core (`AF`, `BC`, `A`, `F`, etc.) so opcode bodies can be moved with minimal edits. | Build and focused register-state tests pass. |
| F1.3 | Preserve SP48-only counters (`frame_tacts`, `frames`, `tacts_in_frame`, `cpu_tact_scale`) either as small extensions on the fast `Z80State` or as SP48-owned timing state updated by a macro hook. | SP48 frame/timing tests pass. |
| F1.4 | Verify reset/import/export parity after state-shape changes before moving opcodes. | `test/z80`, SP48 memory/reset/snapshot tests pass. |

Status: Complete as of 2026-08-03.

- F1.1 replaced internal packed `state.flags`/`state.signals` use with direct
  byte fields in `Z80State`: `halted`, `iff1`, `iff2`, `sig_int`, `sig_nmi`,
  `sig_rst`, `after_ld_air`, `ret_executed`, and `retn_executed`.
- F1.2 added direct register aliases in the legacy transitional CPU core so
  later opcode-body migration could follow the fast source more directly. That
  transitional core was removed in F5.
- F1.3 kept SP48 timing counters in `Z80State`; the ABI bridge still imports
  and exports the same packed offsets for `frame_tacts`, `frames`,
  `tacts_in_frame`, and `cpu_tact_scale`.
- F1.4 preserved the 64-byte exported CPU state block shape while changing only
  internal storage. ABI/state, standalone Z80, and SP48 focused suites passed.
  Benchmark notes are saved in
  `.ai/zx-spectrum48-wasm-fast-z80-f1-benchmark.md`.

Decision gate: if state reshaping regresses too much, keep the current ABI
struct externally but introduce a fast internal `cpu` mirror used only during
execution.

F1 decision: continue. The change is behaviorally green and prepares the core
for F2/F3. Standalone microbenchmarks are mostly neutral, which is acceptable
because F1 is state-shape preparation rather than dispatch or bus
specialization.

## Phase F2 — Compile-Time Bus And Timing Specialization

| Step | Work | Gate |
| --- | --- | --- |
| F2.1 | Split the CPU core into build-specialized variants instead of runtime `z80_bus_mode` dispatch in hot helpers: production SP48, SP48 debug/logging, and standalone test. | Build emits distinct objects/artifacts; current tests still select the right variant. |
| F2.2 | Wire the SP48 production variant with macro hooks equivalent to `Z80_READ_MEMORY`, `Z80_WRITE_MEMORY`, `Z80_READ_PORT`, `Z80_WRITE_PORT`, and `Z80_TACT_PLUS_N`. | Normal-frame guard tests prove no runtime bus-mode branch is used. |
| F2.3 | Keep debug/test logging in separate variants or explicit debug-only entry points, not in production memory/port helpers. | Debug access-log tests pass; normal frame logs remain zero. |
| F2.4 | Benchmark after this phase before moving opcode bodies. | `npm run benchmark:sp48-wasm` note compares F2 against T9 baseline. |

Status: Complete as of 2026-08-03, with an important performance caveat.

- F2.1/F2.3 added explicit CPU execution entrypoints:
  `z80_cpu_execute_sp48_instruction`,
  `z80_cpu_execute_sp48_debug_instruction`, and
  `z80_cpu_execute_test_instruction`.
- SP48 normal frame execution now routes through the SP48 entrypoint; debug
  execution routes through the debug/logging entrypoint; standalone Z80 tests
  route through the test entrypoint.
- The legacy `z80_bus_mode` selector is no longer used by SP48 frame/debug
  execution. It remains only for the compatibility wrapper and standalone test
  reset path.
- F2.2 is only partially achieved at this point: the entrypoints are explicit,
  but the opcode body still shares one helper family selected by an internal
  access mode. A true branch-free compile-time SP48 production core requires
  templating/duplicating the opcode implementation or adopting the fast source
  more directly in F3/F4.
- F2.4 benchmark notes are saved in
  `.ai/zx-spectrum48-wasm-fast-z80-f2-benchmark.md`.

Decision gate: F2 should be a high-confidence win because it removes branches
from every memory/port access. If it is not, inspect generated WASM before
continuing.

F2 decision: continue only if F3 removes the remaining shared-helper branch or
uses the fast opcode core directly. F2 improved routing clarity and reduced the
test artifact size, but the SP48 frame benchmark regressed versus the F1/T9
range, so entrypoint splitting alone is not a performance win.

## Phase F3 — Adopt Fast Opcode Core

| Step | Work | Gate |
| --- | --- | --- |
| F3.1 | Replace runtime opcode-table initialization with compile-time `static const` operation tables based on the fast source. | Z80 opcode tests pass; artifact size recorded. |
| F3.2 | Move standard opcode bodies from the fast source in rows, starting with 0x00-0x3F where control flow and memory timing are easiest to validate. | Focused cloned tests for moved rows pass. |
| F3.3 | Move 0x40-0xBF register/ALU rows using direct per-op implementations from the fast source, eliminating selector-switch hot paths for `LD r,r`, `ADD/ADC/SUB/SBC/AND/XOR/OR/CP r`. | Register and ALU opcode pages pass; benchmark should show the first major CPU-loop delta. |
| F3.4 | Move call/jump/stack/IO rows 0xC0-0xFF. | Control-flow, stack, and port tests pass. |
| F3.5 | Move CB and ED pages, including block instructions and documented/undocumented behavior already covered by cloned tests. | Full standard/CB/ED cloned tests pass. |
| F3.6 | Move DD/FD and DD-CB/FD-CB indexed pages. | IX/IY/indexed-bit tests and seeded replay pass. |
| F3.7 | Move Z80N ED extensions from the fast source or explicitly preserve current Z80N behavior if the fast source differs. | Z80N tests pass. |

Status: Complete as of 2026-08-03 for the standalone Z80 opcode core.

- F3.1-F3.7 were implemented by adopting the vendored fast `z80.c` as a
  standalone fast Z80 test artifact instead of hand-copying opcode pages into
  the old generated/helper-heavy core row by row.
- Added `fast-z80-test`, a normal-name standalone Z80 ABI artifact backed by
  `src/emu/z80/wasm/reference/fast_z80.c` and
  `src/emu/z80/wasm/reference/fast_z80_test_adapter.c`.
- The cloned WASM opcode-page tests in `test/z80/wasm-test-z80.ts` now build
  and run against `fast-z80-test`.
- Added `npm run validate:z80-wasm-fast-core`, which temporarily builds the
  fast core to the normal standalone test output path, runs all `test/z80`
  tests, and restores the regular test artifact.
- Full `test/z80` passes against the fast core: 238 files / 6552 tests.
- The adapter preserves project-specific standalone test semantics around
  prefix-fragment memory logs, accumulated I/O/TBBlue logs, Z80N frame-tact
  scaling, and the existing `WZ` expectation for `LD (BC),A`.
- F3 benchmark notes are saved in
  `.ai/zx-spectrum48-wasm-fast-z80-f3-benchmark.md`.

Decision gate: after each row/page, run the standalone CPU benchmark. Stop and
inspect the generated WASM if a migrated page is slower than the current one.

F3 decision: continue to F4. The fast opcode core is correctness-clean through
the cloned standalone suite and generally faster in standalone micro-scenarios.
It is not yet linked into the production SP48 frame/debug execution path; F4 is
the integration step that must decide whether the larger fast core can improve
real SP48 frame performance.

## Phase F4 — SP48 Integration With The Fast Core

| Step | Work | Gate |
| --- | --- | --- |
| F4.1 | Route `sp48_execute_frame()` through the fast production CPU variant while keeping the existing SP48 memory, contention, floating bus, FE port, audio, and tape helpers. | SP48 CPU integration and normal-frame tests pass. |
| F4.2 | Route `sp48_execute_instructions()` through the debug/logging CPU variant and preserve breakpoint/access-log semantics. | Debug stepping, step-over, step-out, run-to-address, memory/I/O log tests pass. |
| F4.3 | Verify interrupt, HALT, prefix-pending, `retExecuted`, `retnExecuted`, and `afterLdAIR` behavior across the SP48 adapter. | Existing SP48 differential replay and debugger fixtures pass. |
| F4.4 | Re-run screen, border/audio, keyboard, floating-bus, contention, and tape smoke tests. | Full SP48 focused suite passes. |
| F4.5 | Benchmark manual scenarios and compare against the T9 baseline: idle ROM, RAM-heavy, contended-screen, FE border/audio, keyboard polling, tape LOAD EAR, floating bus, and debug stepping. | `.ai/zx-spectrum48-wasm-fast-z80-f4-benchmark.md` records results. |

Status: Complete as of 2026-08-03.

- F4.1 routes `sp48_execute_frame()` through a new SP48-specific adapter around
  the vendored fast Z80 core.
- F4.2 routes `sp48_execute_instructions()` through the same fast core with
  debug memory/I/O logging enabled only for debug stepping.
- F4.3 preserves SP48 state import/export, interrupt signal propagation, HALT
  timing, prefix-pending execution, and `retExecuted`/`retnExecuted` mirroring
  across the adapter.
- F4.4 keeps the existing SP48 hardware helpers in place by splitting bus
  timing from bus value access: contention, floating bus, FE port, border/audio,
  dirty range, and tape behavior still live in `sp48_core.c`.
- F4.5 benchmark notes are saved in
  `.ai/zx-spectrum48-wasm-fast-z80-f4-benchmark.md`.
- Production WASM now compiles the fast SP48 adapter instead of the legacy
  opcode executor. The standalone Z80 test artifact remains backed by the fast
  core added in F3.
- Artifact size increased to 226,153 bytes; the explicit guard is now 240,000
  bytes.

Decision gate: if F4 does not improve normal frame timing, the remaining cost is
probably outside CPU dispatch and should be measured in SP48 hardware helpers or
the JS adapter.

F4 decision: continue to F5. Real SP48 frame benchmarks now show substantial
WASM median improvements across the normal scenarios compared with the earlier
F2/F3 SP48 path, while focused SP48 behavior tests and the standalone fast Z80
suite remain green.

## Phase F5 — Remove Legacy CPU Core Paths

| Step | Work | Gate |
| --- | --- | --- |
| F5.1 | Delete the old current opcode-core code once the fast core owns standalone, debug, and SP48 production execution. | Import/build scans pass. |
| F5.2 | Simplify headers and ABI comments so there is one canonical CPU execution path plus clearly named debug/test variants. | `rg` confirms no stale wrapper-only paths. |
| F5.3 | Update `.plans/ZX_SPECTRUM_48_WASM_PERFORMANCE_TUNING_PLAN.md` or handoff notes to mark the old tuning plan superseded by the fast-core replacement plan. | Documentation reviewed. |
| F5.4 | Run final gates. | Full gate list below passes. |

Status: Complete as of 2026-08-03.

- F5.1 removed the deleted legacy opcode executor files:
  `src/emu/z80/wasm/z80_cpu.c`, `src/emu/z80/wasm/z80_cpu.h`, and
  `src/emu/z80/wasm/z80_abi.c`.
- F5.2 made the normal `test` WASM artifact use the fast standalone Z80 ABI
  adapter, so production SP48 and standalone cloned Z80 tests now both execute
  the vendored fast core.
- F5.2 also removed the obsolete runtime `z80_bus_mode` constants/storage from
  live C code.
- F5.3 marked the older performance-tuning plan as superseded by this fast-core
  replacement and updated the migration handoff notes.
- F5.4 gates were run after cleanup; see final F5 response for exact commands
  and any intentionally skipped long gates.

## Final Gate List

Run these before considering the migration complete:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/z80
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-rollout-smoke.test.ts test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/ula-contention.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run check:sp48-wasm-size
npm run benchmark:sp48-wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
git diff --check
```

## Manual Performance Checkpoints

After each phase, manually compare:

- 48K ROM idle speed with sound enabled and disabled.
- A RAM-heavy BASIC or machine-code loop.
- A border/audio-heavy demo.
- Keyboard polling responsiveness.
- Tape real-time load path with fast-load disabled.
- Debug stepping and run-to-breakpoint latency.

The important checkpoint is F4. If F4 does not move real emulator performance,
the next plan should stop changing Z80 dispatch and focus on SP48 hardware
helpers, event consumption, screen/audio rendering, or controller scheduling.
