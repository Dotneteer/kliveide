# The WASM cores' debug path: decisions, traps and measurements

Every Z80 core shares the CPU, its export forwarders and an in-core debug loop
(`src/emu/z80/wasm/README.md` has the working contract: what a fast frame may do, the stop table, how
to add a stop or a core). This note keeps the decisions the code cites by number, the traps found on
the way, and the measured budgets. It was built on 2026-10-09 from a plan closed on 2026-11-04 (git
history: `dev/plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`; some C comments still name it, left alone because
editing a shared core source rebuilds every core).

**The rule:** the core decides **whether** to stop; TypeScript decides **what a stop means**.

## Decisions (D1-D14)

| # | Decision |
|---|---|
| D1 | (Not built, see D2.) A lean and an instrumented CPU variant in one translation unit. |
| D2 | **The lean variant was gated on a measurement, fixed before the numbers:** build it only if stripping every debug hook makes any core's fast frames at least 5% faster than the build after the no-regret gating. No core reached it (0-4.4% before the gating, 2-3% after), so it was **dropped**. |
| D3 | (With D1, not built.) The core would pick the variant per frame from one instrumentation word. |
| D4 | (With D1.) Lean and instrumented would have had to be bit-identical in machine state. |
| D5 | **The shadow step-out stack stays on every path:** a paused plain Run can step out, and the interrupt depth is right. Its cost is within noise. |
| D6 | **Machine-side debug work follows the CPU's rule:** gated at run time, or kept when it may be functional (T5). |
| D7 | **One shared in-core debug loop**, `src/emu/z80/wasm/z80-debug-loop.c` (prefix-pasted): the stop table, `<prefix>ExecuteUntilStop` and a stop-reason record, in every core. Step-into stays on the per-instruction path. |
| D8 | **Shared C for prefix-only code:** `z80-cpu-exports.c` (register forwarders, step-out, interrupt depth, access log, last port), `zxSpectrum/wasm/common/zx-spectrum-frame.c` (the Spectrum frame loop and RZX play), each with a `.cjs` list builder (`dev/scripts/z80-cpu-exports.cjs`, `dev/scripts/z80-condition-exports.cjs`). |
| D9 | **Shared TypeScript for the hosts:** `src/emu/machines/wasmDebugLoop.ts`'s `runWasmDebugLoop` owns the loop and its stop order and calls per-host hooks (`enter`, `beforeInstruction`, `afterInstruction`, `afterStep`, `onFrameEnd`, the optional in-core `executeUntilStop`); `fastPathStop`, `shouldStopAtWasmBreakpoint`, `hasWasmAccessBreakpoint`, `stepOutAddressFromCore` are shared functions. History and profile use `WasmHistorySource`/`WasmProfileSource` everywhere. |
| D10 | **No user-visible change:** breakpoints, stepping, history, reverse debugging, profiling, RZX, state files and `.klr` behave as before; existing tests are the oracle. |
| D11 | **Profiling during a plain Run** runs instrumented; coverage and the profiler are debugging features. |
| D12 | **Memory and port breakpoints run in the core** (Phase 4b): `ExecuteUntilStop(extraStop, mask, accessMask)` returns after an instruction whose access meets the mask; TypeScript then imports the bus record and decides. |
| D13 | **Every per-instruction and per-access debugging decision moves into the core; everything a stop means stays in TypeScript.** `DebugSupport` stays the one source of truth; the core gets a **compiled copy pushed whole on entry** (`buildCoreStopTable`, its own bit layout, so new stop kinds do not compete for `DebugSupport`'s 16 bits). A move is allowed only when the core reproduces the TypeScript decision exactly; what it cannot decide exactly stops the core and is decided in TypeScript. In the core: execution breakpoints with their partition, the execution point and step targets (`extraStop`), error stops, launch-flow suppression (by leaving suppressed breakpoints out of the table), the BASIC statement tracker's addresses and source-step candidates (`CORE_STOP_CANDIDATE`, bit 15), access breakpoints (D12), and conditions that read no host-only fact (`CORE_STOP_CONDITION`, bit 14, slots in `<prefix>CondPlan`: 128 addresses, 256 slots, `wasmDebugLoopLayout.ts`). In TypeScript: logpoint formatting, one-shot consumption, the ROM error guard, source and symbol mapping, step-into, the reverse-debugging journal and timeline, **hit counters** (a false condition counts nothing and never stops, so it is exact in the core; a true pass stops and TypeScript counts it and raises `onHitCounted`, which the timeline logs), and all UI. A host keeps a run in TypeScript with `canRunInCore` false (an RZX session; the Next's NextReg, Copper or sprite watches). |
| D14 | **Performance budgets**, against a plain Run of the same host (`dev/scripts/benchmark-debug-host-loop.cjs`; enforced by `test/wasm/debug-loop-budgets.perf.test.ts`, `npm run test:perf`, with T10's noise): debug session with execution breakpoints none hit **≤ 1.15x**; project start **≤ 1.05x**; with history recording **≤ 1.25x**; Klive BASIC under the source debugger **≤ 1.2x**; a memory or port breakpoint none hit **≤ 1.3x**; a never-true condition at a hot address **≤ 1.3x**. |

## Traps

- **T1 Determinism:** reverse debugging replays with fast frames and checks itself against the
  recorded history; a run mode must never change machine state.
- **T2 Saved state:** the shadow stack lives in `Z80State cpu`, so it is in state files, keyframes and
  `.klr` files.
- **T3 Code size:** the debug hooks make each core 16-34% larger; the profile hooks stay out of line on
  purpose (`Z80_PROFILE_NOINLINE`; inlined they took one core from 235 KB to 390 KB).
- **T4 The contract checker** (`dev/scripts/check-wasm-cpu-contract.cjs`) requires the literal hook-include
  lines and the `Z80_HISTORY_*`/`Z80_PROFILE_*` defines in each core: update it with any include move.
- **T5 Not everything that looks like debug is debug:** the contention counters feed the UI,
  `retnExecuted` drives the Next's NMI logic, the NextReg `lastWrite`/`written` arrays may back
  readback, the Z88 bus record may have other readers. Verify before gating; when unsure, keep it.
- **T6 In-core stops must equal the TypeScript ones**, including the resume rules
  (`lastBreakpoint`, `logArrival`). `test/wasm/debug-loop-equivalence.test.ts` runs continues, step-overs
  and step-outs with conditional, hit-count, memory and port breakpoints on all six cores, in the core
  and instruction by instruction, and they must stop at the same PC, registers, T-states and
  `lastDecisionPc` (it fails on every core if the core ignores the table).
  `test/kbasic/codegen/source-step-in-core.test.ts` does the same for a 22-step source-step script.
- **T7 Mid-frame switching:** a frame left by a stop continues on the next call.
- **T8 The Timex includes `sp48.c` whole:** a 48K change is a Timex change.
- **T9 Debug bookkeeping in the saved state must not depend on how a frame runs.** The ZX81's
  instruction start and capture flag had to become volatile, and a capture rule that looked at the
  armed stop target broke replay. The Z80's `cpu.lastPort*` cannot be made volatile on their own: check
  any gating change against the reverse-debugging determinism test, and check whether a recording is in
  the state image before gating it.
- **T10 Below about 3%, a speed difference is not measurable here:** byte-identical builds measured up
  to 2.9% apart, and inlining decisions move results by several percent. Decide on sizes, repeated runs
  or differences well above 3%.
- **T11 A shared per-instruction loop costs what hand-written loops did not:** the JIT does not inline a
  generic loop's hooks (15-30% slower per instruction; a fresh hook object per frame cost another 20%);
  a `super.x = ...` store is not optimised by V8 (hence `Z80Cpu.setPcMirror`); every extra boundary
  call per instruction counts. The cure is structural: keep the per-instruction path rare.

## What the measurements showed

- **Before:** the debug work on a fast frame was 0-4.4% (so D2 dropped the lean variant). The time went
  on the debug path: a debug session ran at 2.1-2.3x a plain Run on the Spectrums, a project start at
  1.3-3.0x on every machine but the Next.
- **After Phase 4a:** a debug session and a project start run at about 1.0x on the Spectrums and the
  Next; access breakpoints and never-true conditions hold their 1.3x budget; a source step over a loop
  is 3.8-3.9x faster in the core than instruction by instruction.
- **Recorded misses**, accepted:
  - **The Z88** misses the session, project-start, access and condition rows (1.3-1.37x): the stop
    table is rebuilt and copied into the core on every entry, about 10 µs against a Z88 frame of 0.04 ms
    of emulation (0.2% of its 5 ms real-time frame). Rebuilding only after an edit would need a change
    counter at every write of `breakpointFlags`; not worth it.
  - **History recording** misses on the ZX81 (1.3x) and the Z88 (1.55x): the recorder's own per-instruction
    work in C, on cores whose instructions are cheap. A recorder optimisation, not a loop one.

## Open

- **Source steps** still stop at every statement entry inside a stepped-over call, where the step
  decides to run on: a per-statement round trip, not a per-instruction one. Stopping only where the
  step could stop (entries at or above its baseline SP) would need the activation chain in the core.
- **A bare hit-count rule** (no condition) still stops on every pass, because hit counters stay in
  TypeScript (D13).
- **Not covered in the core:** access-breakpoint conditions (they stop on the flagged access) and
  conditions reading `cpufreq()`/`frame()`.
- The history recorder's per-instruction cost on the ZX81 and the Z88.
