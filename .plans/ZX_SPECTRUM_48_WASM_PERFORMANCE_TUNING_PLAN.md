# ZX Spectrum 48K WASM Backend — Performance Tuning Plan

## Goal

The 48K WASM backend is now behaviorally ready to try as the default backend.
This plan intentionally moves beyond the earlier TypeScript-like implementation
shape and focuses on performance tuning while preserving:

- static C/WASM memory only; no dynamic allocation;
- one normal JS/WASM execution boundary per frame except rare media/debug
  boundaries;
- instruction-bounded execution for debugger modes;
- existing TypeScript-vs-WASM compatibility and full-suite gates.

## Current hot-path observations

The current implementation is parity-oriented. Several decisions are correct
for rollout safety but are likely expensive for long-running emulation:

- The Z80 memory and I/O helpers always contain test/debug logging checks, even
  during normal SP48 frame execution.
- Normal SP48 execution imports and exports the full packed CPU state around
  each frame segment, and tape LOAD/SAVE boundaries can split a frame into
  multiple segments.
- State import/export uses byte-copy and packed-block helpers designed for ABI
  clarity, not hot-path speed.
- Contention, floating-bus, and tape EAR code repeatedly normalizes frame tacts
  with loops.
- Event trace clear helpers zero entire bounded buffers even when only counts
  need to reset for normal execution.
- Result counters are written eagerly while recording each border/audio/tape
  event.
- The tape EAR table is filled and regenerated at execution boundaries. That is
  robust but can be much more work than a frame with no tape input needs.
- Debug access logs share the same Z80 bus code as production execution, so the
  normal path pays branches for debugger/test observability.
- The operation dispatch uses function-pointer tables. This is maintainable but
  may leave performance on the table versus generated switch/direct-dispatch
  alternatives in WASM.
- Many hot-path C helpers are currently plain `static` functions. Clang will
  inline some under `-O3`, but explicit `static inline` on small, frequently
  called helpers can improve the generated WASM shape and prevents accidental
  out-of-line calls after future refactors.
- The build uses `-O3` only; there is no size/speed comparison, LTO setting,
  or production-vs-test artifact distinction.

## Quality gates for every tuning step

Run focused gates first, then full gates at the end of each phase:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
git diff --check
```

For benchmark-related steps, add a fixed benchmark comparison before/after the
change and keep correctness checks before timing.

## Phase T0 — benchmark and measurement foundation

| Step | Work | Quality gate |
| --- | --- | --- |
| T0.1 | Add a repeatable benchmark harness that runs fixed ROM/input scenarios for many frames, not just one correctness-first smoke frame. Include idle ROM, RAM-heavy loop, contended-screen loop, FE border/audio loop, keyboard polling loop, tape LOAD path, and debugger stepping microbenchmarks. | Harness reports correctness plus median/min/max timings for TypeScript and WASM. |
| T0.2 | Add WASM-side counters for executed instructions, memory reads/writes, port reads/writes, contention delays, floating-bus reads, trace events, and tape-boundary yields. Keep counters in static state and expose them through diagnostics or a benchmark-only export. | Tests verify counters for small deterministic programs. |
| T0.3 | Establish baseline numbers and artifact sizes for current `-O3` builds on the local machine. Save the baseline in `.ai/` or benchmark output docs so later changes can be compared. | Benchmark output is reproducible and checked into notes, not hard-coded as assertions. |

Status: Complete as of 2026-08-02. The benchmark harness is
`npm run benchmark:sp48-wasm`; the initial baseline is saved in
`.ai/zx-spectrum48-wasm-performance-baseline.md`.

## Phase T1 — remove normal-path debug/test overhead

| Step | Work | Quality gate |
| --- | --- | --- |
| T1.1 | Split Z80 bus access helpers into production SP48 no-log variants and debug/test variants. Normal `sp48_execute_frame()` should not branch on `z80_bus_mode` for debug logging on every memory/port access. | Normal-frame guard tests still pass; debug memory/I/O breakpoint tests still pass. |
| T1.2 | Add an explicit C execution flag for access logging so `sp48_execute_frame()` disables memory/I/O log writes while `sp48_execute_instructions()` enables them for debugger policy. | Tests prove normal frames leave debug log counts untouched/zero while debug stepping still imports access logs. |
| T1.3 | Keep standalone Z80 test-bus behavior unchanged by preserving the existing test ABI path for cloned opcode tests. | Full `test/z80` suite passes. |

Status: Complete as of 2026-08-02. Normal frame execution now uses a no-log
Spectrum bus mode; instruction-bounded/debug execution uses an explicit
Spectrum debug bus mode; standalone Z80 tests remain on the test bus.

## Phase T2 — state import/export and frame-loop tightening

| Step | Work | Quality gate |
| --- | --- | --- |
| T2.1 | Avoid redundant `sp48_export_state()` calls inside FE port writes during normal frame execution. Export once at the frame/boundary return unless a public helper call needs immediate JS-visible state. | Port helper tests and FE output state tests cover immediate helper behavior; normal frame tests cover final state. |
| T2.2 | Split public helper paths from internal bus paths. Internal memory/port access should mutate C state directly; public `sp48_read_port`/`sp48_write_port` can keep ABI-friendly synchronization behavior. | Direct helper tests and normal-frame parity tests both pass. |
| T2.3 | Replace generic packed-block copy for hot frame entry/exit with direct field load/store or a typed `Z80State` mirror where safe. Keep the ABI block layout unchanged. | ABI layout tests and CPU-state parity tests pass. Benchmark records import/export cost delta. |
| T2.4 | Make tape LOAD/SAVE boundary yields as rare and cheap as possible: only check the two ROM entry PCs when in passive mode and 48K ROM is selected; preserve no-silent-fallback semantics. | Tape-load regression and save-mode tests pass. |

Status: Complete as of 2026-08-02. Public port helpers still export immediate
JS-visible state, while internal FE bus writes mutate C state directly and rely
on frame/boundary export. CPU state import/export now reads/writes the ABI
block directly instead of copying through the standalone Z80 ABI block.

## Phase T3 — timing and ULA table access optimizations

| Step | Work | Quality gate |
| --- | --- | --- |
| T3.1 | Replace repeated `while (tact >= tacts_in_frame)` normalization with a fast single-subtract path for the common case and guarded modulo-style fallback for unusual values. | Contention and floating-bus tests pass. |
| T3.2 | Cache `state.tacts_in_frame` and table-capacity checks in local variables in hot helpers such as `advance_tacts`, `future_frame_tact`, `contention_delay_at_tact`, and floating-bus reads. | Timing parity tests pass and benchmark shows no regression. |
| T3.3 | Evaluate whether contention table can use a compact “zero-run/common-zero” representation or a split table for contended windows only. Keep the simple full table if lookup cost beats compression. | Benchmark compares RAM-heavy and contended-screen scenarios; choose by measurement. |
| T3.4 | Evaluate whether floating-bus lookup can be reduced to generated screen-fetch windows instead of a 69,888-entry table. Keep table if branch complexity loses. | Floating-bus tests and screen smoke tests pass. |

Status: Complete as of 2026-08-02. Frame-tact normalization now uses a fast
single-subtract path with modulo fallback, and timing helpers cache hot state
values locally. T3.3/T3.4 were evaluated with the benchmark harness; the simple
static lookup tables remain the selected representation because the measured
contended-screen and floating-bus scenarios are already among the fastest WASM
paths and branch-heavy generated/window alternatives would add complexity
without a demonstrated win.

## Phase T4 — event-buffer and result-block overhead

| Step | Work | Quality gate |
| --- | --- | --- |
| T4.1 | Stop zeroing entire event buffers on normal frame start; reset counts/status only. Keep explicit clear exports zeroing buffers for tests/debugging if useful. | Event trace tests verify stale records are ignored by count. |
| T4.2 | Update result-block event counters once at frame/boundary exit instead of on every trace append. Keep overflow bits set immediately in C state. | Result-count tests and overflow tests pass. |
| T4.3 | Make border tracing conditional if the adapter does not need every border event for the current view. At minimum, avoid duplicate border trace records when only audio/tape state changed and border did not. | Border/audio/tape differential tests pass; benchmark includes border-heavy program. |
| T4.4 | Consider packing audio and tape-save traces separately instead of sharing a monolithic event buffer. This may improve cache locality and simplify clears/counts. | ABI/layout tests updated; loader views and trace readers pass. |

Status: Complete as of 2026-08-02. Normal frame/debug trace reset now clears
counts/status only; explicit public clear exports still zero their slices for
debug/test use. Result-block event counters are synchronized at public helper
and execution exits instead of on every trace append. Border trace records are
emitted only for real border-color changes; audio/tape traces still capture
EAR/MIC transitions. T4.4 was evaluated and intentionally deferred: the current
event buffer is already statically segmented by trace type, and changing the
ABI to separate buffers would add integration churn without a measured need.

## Phase T5 — tape input generation strategy

| Step | Work | Quality gate |
| --- | --- | --- |
| T5.1 | Add dirty/version tracking on the TypeScript tape side so the WASM EAR table is regenerated only when tape mode, selected block, frame start tact, or tape position changes in a way that requires it. | Tape-load tests cover unchanged-frame reuse and mode changes. |
| T5.2 | Replace full-frame EAR table generation with segment/window generation when a frame resumes after a tape boundary. Fill only the tacts that can be read before the next frame end. | Tape EAR sampling tests and selected-tape LOAD regression pass. |
| T5.3 | Evaluate moving tape pulse generation into C with a static tape-block descriptor/data window copied from TypeScript. This would avoid per-frame EAR table generation but needs careful static capacity and overflow/status design. | Prototype benchmark plus full tape compatibility tests decide whether this is worth landing. |
| T5.4 | Keep fast-load policy in TypeScript unless benchmarking shows boundary yields dominate. If moving more tape logic into C, keep file parsing and unbounded tape structures out of WASM. | Fast-load and real-time load tests pass; no dynamic allocation audit remains clean. |

Status: Complete as of 2026-08-02. The TypeScript/WASM adapter now tracks the
covered EAR-table frame window and regenerates the static WASM tape EAR table
only when the tape mode, selected block metadata, frame start, or readable
window changes. Boundary resumes generate only the remaining frame segment.
T5.3/T5.4 were evaluated and intentionally deferred: tape parsing, unbounded
tape block ownership, and fast-load policy stay in TypeScript, while WASM keeps
only the bounded static per-frame EAR window. Benchmark and handoff notes are
saved in `.ai/zx-spectrum48-wasm-t5-benchmark.md`.

## Phase T6 — CPU dispatch and flag micro-optimizations

| Step | Work | Quality gate |
| --- | --- | --- |
| T6.1 | Add an explicit inline policy for the WASM C code: use `static inline` for small helpers called from instruction, timing, memory, and I/O hot paths; keep exported ABI functions and large/rare helpers non-inline. Avoid compiler-specific always-inline attributes until measurement proves they are needed. | Build emits no new warnings; artifact size and benchmark are recorded before/after. |
| T6.2 | Inline the hottest Z80 core wrappers: `tactPlusN`, `refreshMemory`, `readMemory`, `writeMemory`, `readPort`, `writePort`, `fetchCodeWord`, `push_pc`, `conditionIsTrue`, `execute_operation`, `leave_halt`, and `apply_ld_air_quirk`. These are small and repeatedly called during normal instruction execution. | Z80 full suite and SP48 WASM CPU integration tests pass; benchmark compares idle, RAM-heavy, keyboard, tape-EAR, and debug-step scenarios. |
| T6.3 | Inline Z80 flag/register arithmetic helpers that are small and called by many opcode handlers: `add8`, `sub8`, `inc8`, `dec8`, `add16`, `sz53`, `sz53pv`, rotate/shift byte helpers, and the tiny half-carry helpers. Pair this with parity preinitialization so inline logical/flag helpers do not keep lazy-init branches. | Z80 cloned opcode tests pass; benchmark checks artifact-size change versus speed gain. |
| T6.4 | Inline SP48 core byte-pack/timing helpers: `put_u16`, `get_u16`, `get_u32`, `put_u32`, `normalize_frame_tact`, `advance_tacts`, `future_frame_tact`, `contention_delay_at_current_tact`, `contention_delay_at_tact`, `read_tape_ear_at_current_tact`, and `should_yield_for_tape_mode_boundary`. These are either tiny ABI block helpers or timing helpers used inside memory/port execution. | ABI/layout tests, contention tests, tape tests, and benchmark pass. |
| T6.5 | Inline SP48 bus helpers where they stay readable: `apply_memory_contention`, `read_sp48_floating_bus`, `read_floating_bus_at`, and possibly `sp48_read_port_core`. Treat `apply_port_contention` and `sp48_write_port_core` as measure-first because their bodies are larger and inlining may bloat the artifact. | Benchmark must show no regression in artifact size/speed; port, border/audio, floating-bus, and tape-save tests pass. |
| T6.6 | Review register read/write selector helpers. First mark `readRegister`, `writeRegister`, `activeIndexRegister`, `readIndexedRegister`, and `writeIndexedRegister` inline; then benchmark whether generated direct opcode handlers would be better for common register-only operations. | Opcode tests and seeded replay pass; keep the inline-only version unless direct generation produces a clear win. |
| T6.7 | Benchmark function-pointer dispatch versus a generated `switch` dispatch for standard opcodes after the inline pass. Do not rewrite all pages blindly; measure standard page first. | A/B benchmark over fixed opcode mixes documents winner. |
| T6.8 | Specialize hot standard opcodes (`NOP`, `LD r,r`, `INC/DEC r`, `JR`, `LD (nn),A`, `LD A,(nn)`, FE `IN/OUT`) if benchmark shows dispatch/helper overhead still dominates after inlining. | Differential CPU and machine-level replay tests pass. |

Status: Complete as of 2026-08-02. T6.1-T6.6 landed as an
explicit-inline pass over small Z80 and SP48 hot helpers, plus reset/import-time
preparation of parity and opcode tables so the instruction loop no longer pays
lazy-initialization branches. T6.7/T6.8 were evaluated and deferred: the inline
pass reduced the WASM artifact from 77,434 to 73,378 bytes with stable benchmark
timings, so a generated-switch/direct-opcode rewrite is not justified until
later profiling shows dispatch dominates. Benchmark notes are saved in
`.ai/zx-spectrum48-wasm-t6-benchmark.md`.

## Phase T7 — build and artifact optimization

| Step | Work | Quality gate |
| --- | --- | --- |
| T7.1 | Add production and test WASM artifact modes. Production should omit standalone Z80 test exports and test-bus-only state when not needed by packaged app. | Build manifest tests verify production subset and test artifact behavior. |
| T7.2 | Compare `-O3`, `-Ofast` if acceptable, `-Oz`, and `-flto`/wasm-ld LTO options for speed and artifact size. Keep standards-safe flags unless tests prove behavior remains exact. | Benchmark matrix records speed/size; full tests pass for selected flags. |
| T7.3 | Consider `-fno-builtin`/explicit builtin choices to avoid accidental libc lowering beyond provided `memset`/`memcpy` shims. | Build works under clean toolchain and static-allocation audit remains clean. |
| T7.4 | Add CI artifact-size tracking for `zx-spectrum48.wasm` so performance work does not accidentally bloat the shipped app. | CI/test script reports size and optional threshold. |

## Phase T8 — JS/WASM adapter overhead

| Step | Work | Quality gate |
| --- | --- | --- |
| T8.1 | Track dirty flags for keyboard rows, timing tables, tape EAR table, and machine config so `ZxSpectrum48WasmMachine` copies only changed input blocks before a frame. | Input sync tests cover changed and unchanged rows. |
| T8.2 | Avoid reading trace/event buffers when counts are zero. Avoid constructing JS objects for traces unless audio/tape/screen consumers need them. | Audio, tape, border, and screen tests pass. |
| T8.3 | Cache DataView/Uint8Array slices and offset constants in the adapter where currently recomputed in trace readers. | Trace reader tests pass; microbenchmark records reduced adapter time. |
| T8.4 | Add a diagnostics-only mode to expose WASM counters without paying for it in normal execution. | Diagnostics tests and benchmark counter tests pass. |

## Phase T9 — rollout safety after tuning

| Step | Work | Quality gate |
| --- | --- | --- |
| T9.1 | After each optimization phase, rerun compatibility fixtures against TypeScript and preserve a simple switch back to TypeScript through `DEFAULT_SP48_IMPLEMENTATION`. | Factory selection tests pass. |
| T9.2 | Add a small real-media smoke pack: at least one TAP/TZX load, one border/audio demo, one keyboard polling scenario, and one debugger stepping scenario. | Smoke tests or documented manual checklist pass on macOS. |
| T9.3 | Keep `.ai/` handoff notes updated with benchmark deltas, selected tradeoffs, and rejected optimizations. | Handoff identifies next tuning step and last known gate results. |

## Suggested implementation order

Start with measurement, then remove obvious hot-path overhead:

1. T0.1–T0.3 benchmark foundation.
2. T1.1–T1.3 debug/test logging split.
3. T4.1–T4.2 event-buffer/result-block write reduction.
4. T2.1–T2.3 state and helper split.
5. T5.1–T5.2 tape EAR regeneration reduction.
6. T6.1–T6.6 inline pass, because it is lower-risk than dispatch rewrites and
   improves the current code shape without changing the architecture.
7. T3 and T6.7–T6.8 dispatch/specialization only after benchmark data shows
   timing/dispatch is the next bottleneck.
8. T7 once there is a stable performance baseline and a candidate production
   artifact shape.

## Non-goals for tuning

- Do not introduce heap allocation in C/WASM.
- Do not move file parsing, arbitrary tape-file storage, or IDE/controller
  policy into WASM.
- Do not remove TypeScript backend fallback.
- Do not accept performance wins that break the fixed compatibility suite,
  debug stepping, tape loading, or packaged artifact validation.
