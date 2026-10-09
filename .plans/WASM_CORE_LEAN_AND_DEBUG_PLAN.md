# WASM Core Plan: A Lean Path and a Debug Path in One Core

Status: **accepted** (2026-10-09); **Phases 0 and 1 done** (2026-10-09, §10); **Phase 5 dropped** by D2's
rule (§10.4). D1–D12 are decisions. The
author accepted the suggested answers in §9, which D2, D5, D11 and D12 record.

**Phase 0's verdict, in short:** the debug work on the fast path is real but small (0–4% of a fast
frame, the step-out stack within noise). Phase 1's re-measurement made it final: no core reaches D2's
5%, so Phase 5 is dropped. The cost the author felt is on the *debug* path: a debug session runs at
2.1–2.3x the cost of a plain Run on the Spectrums, and a project start at 1.9–3.0x on every machine
but the Next. Phase 4 is therefore the priority.

**Scope widened (2026-10-09, the author):** every debugging decision that can run in WASM moves there,
without changing the architecture (D13). The core decides **whether** to stop; TypeScript decides
**what a stop means**. Phase 4 is split into 4a–4d accordingly, each with a performance budget (D14).

Goal, in the author's words: one core per machine that runs **fast without debugging** (no
operation that exists only for debugging support) and **with debugging** (all the overhead), with
debugging-related code shared between cores instead of repeated in each.

Scope: the Z80 WASM cores — 48K/16K (and Timex, which includes `sp48.c` whole), 128K
(Pentagon, Scorpion), +2A/+3/+2E/+3E, Next, Z88 and ZX80/81 — plus their TypeScript hosts
(`*WasmV2Machine.ts`), loaders and build scripts.

Not in scope: the C64 and the other interpreted (TypeScript) machines, and any behaviour change of
history, profiling, reverse debugging or breakpoints that the user can see. This is a refactor and
a performance plan; every existing test must keep passing unchanged.

---

## 1. Findings

The review covered the shared CPU (`src/emu/z80/wasm/`), every core's C sources, the build scripts
and the TypeScript hosts. Each core is **one translation unit**: `sp48.c`, `sp128.c`, … include
`z80-history.h`, `z80-profile.h`, `z80.c`, `z80-condition.c`, `z80-history.c` and `z80-profile.c`.
There is **one build mode** (`production`) and **no compile-time debug switch** anywhere: every
debug feature is either always on or gated by a runtime flag.

### 1.1 Debug work on the fast path (`<prefix>ExecuteFrame`, nothing debug-related active)

"AO" is always on; "RF" is a runtime-flag check that costs a load and a branch even when off.

| Where | What | Kind | Cost when idle |
|---|---|---|---|
| `z80.c` `callCore`/`rstCore`/`pushPcForInterrupt`/`retCore` (l.852–943) | Shadow step-out stack push/pop, `interruptDepth` | AO | ~6–8 ops per CALL/RST/INT/RET |
| `z80.c` l.3332, 895, 1845 | `retExecuted`/`retnExecuted` stores | AO | 2 stores per cycle (`retnExecuted` is functional on the Next) |
| `z80.c` hooks | `Z80_HISTORY_BEGIN/COMMIT/EVENT` | RF | 2 load+branch per instruction |
| `z80.c` hooks | `Z80_PROFILE_FETCH/READ/WRITE/END/MARK/CALL/RET/INT` | RF | 1 load+branch per code byte, per data access, per instruction end, per CALL/RET |
| `z80.c` `readMemory`/`writeMemory`/`readPort`/`writePort` | `Z80_CAPTURE_BUS_EVENTS()` check (access log, last port) | RF; **AO on ZX80/81** (no define, the default is `1`) | 1 load+branch per data/port access; on the ZX80/81 a full log write too |
| Every core's frame loop | `z80HistoryStopNow()` | RF | load+compare per instruction |
| sp48/sp128/spp3e `ExecuteInstruction` | `rzxMode` play/record checks, capture-flag check before `z80ClearBusEvents` | RF | 3 load+branch per instruction |
| sp48/sp128/spp3e `Z80_REFRESH` | `rzxFetchCount++` | AO | 1 increment per M1 |
| sp48/sp128/spp3e | `<p>CpuInstructionsExecuted++`, `<p>CpuFrameSliceInstructions++` | AO | 2 RMW per instruction; **no IDE reader**: only the loaders list them and `benchmark-spectrum-wasm.cjs` reads them |
| Next `zxnextCpuExecuteInstruction` (`zxnext-cpu.c` 339–367) | `zxnextCpuClearInstructionAccesses` | AO | 7 stores per instruction |
| Next `zxnext-ports.c` 31–34, 130–134 | `lastPort*` mirror (duplicates z80.c's) | AO | 3–4 stores per port access |
| Next `zxnext-cpu.c` 83 | `zxnextProfileTicks28 += …` | AO | 1 add per T-state step |
| Next `zxnext-cpu.c` 468 | `if (z80GetRetExecuted()) z80SetRetExecuted(0)` | AO, redundant | load+branch per instruction |
| Next `zxnext-cpu.c` 472 | `zxnextTraceRecordInstruction` call | RF inside the callee | a call per instruction |
| Next `zxnext-nextreg.c` 488 | `zxnextNextRegCheckWatch` | AO (no armed flag) | table check per NextReg write |
| Next `zxnext-copper.c` 299–307, `zxnext-dma.c` 402 | Write-origin labels for the watches | AO | 2 stores per Copper MOVE / DMA I/O byte |
| Z88 `z88-memory.c` 84–89, 271–288; `z88-blink.c` 371–384 | Own bus record: per-M1 reset, every read (opcode fetches included), write and port | AO | ~4 ops per memory access |
| ZX80/81 `zx8081.c` 231–232 | `z80ClearBusEvents()`, `zx8081OpStartAddress` | AO | 4 stores per instruction |
| ZX80/81 `zx8081-memory.c` | `zx8081HistoryForcedNop` | AO | 1 store per M1 |

**The idle cost of all this has never been measured.** `EXECUTION_HISTORY_VIEWER_PLAN.md` §9.2
says so: "The 'off' cost against a build *without* the hook was not measured: a test cannot build
the core twice." Phase 0 measured it (§10): 0–4.4% of a fast frame, the stack within noise.

### 1.2 The debug path is slow in a different way

Outside `NoDebug` + `Normal`, the Spectrum family (48K, Timex, 128K, Scorpion, +3E) and the Next
run a **per-instruction TypeScript loop**: one `<p>ExecuteInstruction` call, plus `GetCpuPc`,
`GetFrameCompleted` and a JS `shouldStopAtDebugPoint`, for every Z80 instruction. That covers:

- **every frame of a debug session**, even with no breakpoint near (`startDebug` runs
  `StopAtBreakpoint`);
- **every project start**: the `ReachExecPoint` boot runs `UntilExecutionPoint` + `NoDebug`, which
  also takes the debug loop;
- Reverse Continue's breakpoint collection (`MachineController.ts` 1465).

Only the Z88 and ZX80/81 have an in-core loop (`<p>ExecuteUntilStop(extraStop, mask)` over a 64K
breakpoint-flag array). Even they fall back to the per-instruction loop for the NoDebug boot,
because `run()` clears `debugSupport`, so `breakpointFlags` is missing.

For the author's goal this matters as much as §1.1: "running with debugging" is today far slower
than it has to be on six of the eight machine families.

### 1.3 Duplicated debugging code

| Item | Where | Size | Variation |
|---|---|---|---|
| CPU register get/set forwarders, step-out address, interrupt depth, access-log and last-port getters | all 6 C cores | ~420 C lines; ~250 names in 6 build scripts | prefix only (+ a few machine extras) |
| Breakpoint flags + `ExecuteUntilStop` + `ExecuteFrame` loop | z88, zx8081 | ~35 lines each | prefix and PC read only |
| Spectrum `ExecuteFrame`, RZX play step, play picture, `RzxSetFrameTact`, RZX port tap | sp48, sp128, spp3e | ~85 lines each | near-identical; spp3e adds audio/FDC calls |
| Condition-evaluator glue | 6 cores | 3–80 lines | sp128/spp3e partition peek near-identical; rest machine-specific |
| History context / profile mapping glue | 6 cores | 6 macro lines + a function each | macro shape identical; contexts all repeat `(void)kind;` + zero fill; sp128/spp3e mapping near-identical |
| Condition exports (12 names) and condition/access-log volatile symbols | 6 build scripts + `build-condition-wasm.cjs` | ~20 lines each | identical (the Z88 omits `z80AccessLog*`, harmless today) |
| `executeWasmV2DebugLoop` | Sp48 942–1033, Sp128 1146–1238, P3e 1327–1418 (~95% identical); Next, Z88, ZX81 share the skeleton | ~90 lines each | prefix, RZX, per-machine extras |
| `shouldStopAtWasmV2Breakpoint`, `hasWasmV2AccessBreakpoint`, `markStepOutAddress`, `getInterruptDepth`, `fastPathStop` | 5–6 hosts each | 20–25 lines each | byte-identical apart from prefix (Z88's access values, Next's register reads differ) |
| `importWasmV2BusAccess`, `finishWasmV2DebugLoop`, `syncCpuFromWasmV2` | all hosts | 15–40 lines each | shared core plus per-machine extras |
| History/profile source wiring | 5 hosts (~80 lines each); the Next hand-rolls its own | — | identical |
| Reverse-debugging surface (`reverseCoreId`, `isAtFrameBoundary`, host state) | all hosts | — | shape identical |

Shared precedent to follow: `zx-spectrum-rzx.c` pastes `RZX_CORE_PREFIX` onto its export names and
`scripts/rzx-core-exports.cjs` builds the matching list (`rzxExports(prefix)`). Export names must keep
their per-core prefix: the loaders, `reverse/exportContract.ts` and the build allow-lists look them
up by name.

Side findings, not debugging-overhead related but found on the way:

- `zxnext-debug.c`/`.h` is a 15-line stub; `zxnextDebugExecuteStep` is never called.
- The Next host's `executeWasmV2DebugStep` / `executeWasmV2Instruction` are used only by tests.
- `MachineFrameRunner.ts` 290–301 still says the WASM machines use `retExecuted` for step-out; they
  pass `retExecuted: false` now.
- `src/main/unit-tests/UnitTestRunner.ts` 194–242 turns profiling on for coverage without asking the
  advanced-debugging feature switch (the CLOSING_THE_GAPS G4/G5 gate).

---

## 2. Approach

Three independent levers, applied in order of payoff per risk:

1. **No-regret gating.** Make the always-on items of §1.1 runtime-gated like the rest, and fold the
   per-instruction mode checks into one word. Small, local, testable now.
2. **An in-core debug loop for every core, and every per-instruction debugging decision in it.** One
   shared `ExecuteUntilStop` over a stop table the host compiles from `DebugSupport`, so a debug
   session and a project boot run whole stretches inside the core and cross into TypeScript only when
   something might stop. Conditions, hit counts, access breakpoints, the BASIC statement tracker and
   source-step candidates follow in turn (D13). This is the biggest speed-up for "running with
   debugging", and Phase 0 showed it is where the time goes.
3. **Two instantiations of the CPU in one core.** The instruction set is compiled twice in the same
   translation unit: a **lean** variant in which every debug hook is a compile-time no-op, and an
   **instrumented** variant that is today's code. The core picks one **per frame** from a single
   "anything instrumented active?" word. This is the only way to reach *zero* debug operations on the
   fast path, because the hooks sit inside every memory access of every opcode.

Lever 3 costs binary size (the op tables and their callees exist twice) and is the riskiest, so it is
gated on Phase 0's measurement (D2).

Rejected alternatives:

- **Two `.wasm` files per machine** (lean and debug builds). The author wants one core per machine,
  and switching would mean moving the whole machine state between two module instances at every
  pause/resume.
- **Swapping op tables at run time.** It removes the per-frame checks but not the per-access ones
  inside `readMemory`/`writeMemory`, which are inlined into every op.
- **Leaving it as runtime flags.** That is the status quo; Phase 0 tells whether that is good enough.

---

## 3. Decisions

- **D1. One core, two CPU variants, one translation unit.** `z80.c` is split into state and the
  shared parts (registers, flag tables, exported accessors), compiled once, and an execution body
  (`z80-exec.inc`: memory/port funnels, every op, the op tables, `ExecuteCpuCycle`), included twice
  under `#define Z80_INSTRUMENTED 0` / `1` with a name-pasting macro (`Z80_V(name)` →
  `name##Lean` / `name##Dbg`). In the lean pass every `Z80_HISTORY_*`, `Z80_PROFILE_*` and
  `Z80_CAPTURE_BUS_EVENTS` hook expands to nothing, and the shadow stack follows D5.
- **D2. Phase 0 is a go/no-go gate for D1, and the rule is fixed before the numbers exist.** Phase 5
  is built when the stripped build (no debug work at all) is **at least 5% faster than the build after
  Phase 1** on **any** core's fast frames. It is measured against Phase 1, not today's code, because
  Phase 1 already takes the cheap always-on items, and Phase 5 must pay for its own cost (a second
  instruction set, larger binaries, the lockstep tests). One core passing is enough: the Next at
  28 MHz is the likeliest and the one with the least headroom. Below the bar on every core, Phase 5 is
  not built; Phases 1–4 still are, because they pay off on their own. Phase 0 records the gain against
  today's code as well, so the Phase 1 re-measurement has a reference.
- **D3. The core selects the variant per frame, not the host.** `<p>ExecuteFrame` reads one
  `z80InstrumentationMask` word (history enabled, profile enabled, a stop target armed, bus capture,
  RZX record/play, Next trace or a watch armed) and runs the lean loop when it is zero. The export
  surface does not change. `<p>ExecuteInstruction` and `<p>ExecuteUntilStop` always run
  instrumented; they are debugger paths.
- **D4. Lean and instrumented must be bit-identical in machine state.** Any difference is a bug. A
  lockstep test per core enforces it (Phase 5). Debug bookkeeping that is not machine state moves
  out of the saved state (it is already listed as volatile, or becomes so).
- **D5. The shadow step-out stack stays in both variants** unless Phase 0 says otherwise. Klive lets
  the user pause a plain Run and step out (`MachineController.stepOut`); without the stack, step-out
  has no target until the first CALL runs under the debugger, and the interrupt depth reads 0. Phase 0
  measures the stack **on its own** (a build with only the stack removed). Below about **1%** on every
  core it stays. If it is larger, it moves out of `Z80State cpu` (T2) and the lean variant drops it,
  with step-out after a plain Run falling back to "the next RET at a higher SP".
- **D6. Machine-side hooks follow the same rule as the CPU's.** Debug work in a core's own code (the
  Z88 bus record, the Next's access clearing, trace, watch origins, the ZX80/81 forced-NOP flag) is
  written as `if (Z80_INSTRUMENTED) …` inside functions that are instantiated per variant, or gated by
  the mask (Phase 1) when it sits outside the instruction path.
- **D7. One in-core debug loop, shared.** `src/emu/z80/wasm/z80-debug-loop.c` (prefix-pasted, like
  the RZX file) provides the stop table, `<p>ExecuteUntilStop` and a stop-reason record (what stopped
  the loop: address, access, condition, watch, frame end) for every core. The Z88/ZX80-81 versions are
  replaced by it. What the table holds and which decisions run in it is D13. Step-into stays on the
  per-instruction path.
- **D8. Shared C for prefix-only code.** `z80-cpu-exports.c` (register forwarders, step-out,
  interrupt depth, access log, last port, behind `Z80_EXPORTS_*` switches), plus
  `zxSpectrum/wasm/common/zx-spectrum-frame.c` for the Spectrum frame loop and RZX play glue. Each
  has a matching `.cjs` list builder (`cpuExports(prefix, opts)`, `Z80_CONDITION_EXPORTS`,
  `Z80_CONDITION_VOLATILE_SYMBOLS`, `Z80_ACCESS_LOG_VOLATILE_SYMBOLS`).
- **D9. Shared TypeScript for the hosts.** A `WasmZ80DebugLoop` helper (composition, not a deep base
  class) owns the loop skeleton and stop order and calls per-machine hooks (`beforeEntry`,
  `afterInstruction`, `onFinish`, RZX, Next watches). `shouldStop`, the access-breakpoint test,
  step-out, interrupt depth and `fastPathStop` become shared functions taking the export object.
  History/profile wiring uses `WasmHistorySource`/`WasmProfileSource` everywhere, the Next included.
- **D11. Profiling during a plain Run uses the instrumented variant.** Coverage and the profiler are
  explicitly debugging features, and under D3 they cost what they cost today, not more.
- **D12. Memory and port breakpoints move into the core as a follow-up (Phase 4b),** after Phase 4's
  shared loop and stop-equivalence tests exist: read/write bits in the same 64K flag array, a port
  table, the core stops on a flagged access, and TypeScript evaluates the condition as it does for
  execution breakpoints. Until then any access breakpoint keeps a session on the per-instruction path.
- **D13. Every per-instruction and per-access debugging decision moves into the core; everything a
  stop means stays in TypeScript.** The architecture does not change: `DebugSupport` stays the one
  source of truth for breakpoints and step state, and the core receives a **compiled copy pushed whole
  on entry** to a debug run - the pattern the Z88 breakpoint flags and the Next's NextReg, Copper and
  sprite watch tables already use. The core's table has its own bit layout (it is built, not copied
  from `breakpointFlags`), so new stop kinds do not compete for `DebugSupport`'s 16 bits. A move is
  allowed only when the core reproduces the TypeScript decision exactly; T6's equivalence tests are the
  gate, and anything the core cannot decide exactly stops the core and is decided in TypeScript, as
  now. What moves, and where:

  | Decision now made in TypeScript per instruction | Moves to | Phase |
  |---|---|---|
  | Execution breakpoints, with or without a partition (`shouldStopAt`, `EXEC_BP`/`PART_BP`/`DIS_EXEC_BP`) | stop table; the core checks the partition itself (the condition evaluator's partition peek knows it) | 4a |
  | The run's execution point (`UntilExecutionPoint`), step-over's return address, step-out's address | `extraStop` (and a second slot when both apply) | 4a |
  | Error stops (`errorStopAddress`, `romErrorAddress`) | stop table bit; the ROM error guard (a callback) runs in TypeScript at the stop | 4a |
  | Launch-flow suppression (`suppressUserBreakpoints`: only the flow's own stops fire) | how the table is built on entry: suppressed user breakpoints are left out | 4a |
  | The BASIC statement tracker (`CurrentStatementTracker.observe`, every instruction) | stop-table "marker" bit on statement entries and return sites; the core records the last marked PC and its partition **without stopping**; TypeScript resolves the statement at the next stop | 4a |
  | Memory read/write and port read/write breakpoints (`hasMemoryRead`, ..., the bus mirror) | stop-table bits per address, a port table; the core stops on a flagged access and reports it | 4b (D12) |
  | Conditions (already compiled to bytecode and run by `z80-condition.c`) and hit-count rules (`decideFiltered`) | evaluated in the core loop at a flagged address: a false condition or an unmet hit rule continues without leaving the core; hit counters live in the core's slot table and are read back at stops | 4c |
  | Source stepping (`shouldStopAtSourceStep`, every instruction of a step) | the core stops only at statement candidates (marker bits) and at the step's SP/interrupt-depth exits; the activation logic stays in TypeScript and runs only there | 4d |

  What stays in TypeScript, because it runs only at a stop or is presentation: logpoint formatting and
  output (a logpoint is a stop-and-continue, now decided at its hit only), one-shot consumption, the
  ROM error guard, the source and symbol mapping, step-into (one instruction by definition), the reverse
  debugging journal and timeline (their contract is the export boundary, `REVERSE_DEBUGGING_PLAN`),
  and all UI. The history recorder, the profiler and the Next's watches are already in the core.
- **D14. Phase 4's performance budgets.** Measured with `benchmark-debug-host-loop.cjs` against a plain
  Run of the same host, on every core:

  | Scenario | Phase 0 | Budget | Phase |
  |---|---|---|---|
  | Debug session, execution breakpoints only, none hit | 1.1–2.3x | **≤ 1.15x** | 4a |
  | Project start (execution point not yet reached) | 1.3–3.0x | **≤ 1.05x** | 4a |
  | Debug session with history recording on (advanced debugging) | not measured | **≤ 1.25x** | 4a |
  | Klive BASIC program under the source debugger, running freely | per instruction (tracker) | **≤ 1.2x** | 4a |
  | Debug session with a memory or port breakpoint, none hit | per instruction | **≤ 1.3x** | 4b |
  | Debug session with a conditional breakpoint whose condition stays false at a hot address | one TypeScript round trip per hit | **≤ 1.3x** | 4c |

  The budgets extrapolate from the Z88 and ZX81, whose in-core loop already measures 1.1–1.2x (§10).
  A phase is not done until its rows hold; a miss is recorded in §10 with the reason.
- **D10. No user-visible change.** Breakpoints, stepping, history, reverse debugging, profiling,
  RZX, state files and `.klr` recordings behave exactly as before. Existing tests are the oracle;
  only additions are allowed.

---

## 4. Traps

- **T1. Determinism.** Reverse debugging replays with fast frames (`reverseFrameExport`) and checks
  itself against the recorded history. Replay runs with history recording on, so under D3 it runs
  the instrumented variant. Recording and replay therefore use the same variant, but a live run does
  not, which is why D4's lockstep test is mandatory before D1 ships.
- **T2. Saved state.** The shadow stack lives in `Z80State cpu`, so it is saved in state files,
  keyframes and `.klr` files. If D5 ever drops it from the lean variant, it must move out of `cpu`
  first, and a keyframe restore must still bring it back for step-out after a reverse step.
- **T3. Code size.** Instantiating the op tables twice roughly doubles the CPU's share of each
  binary. `check-*-wasm-size.cjs` budgets need raising, and the size goes in §10. The profile hooks
  are out of line on purpose (`Z80_PROFILE_NOINLINE`, measured 235 KB → 390 KB when inlined); keep
  them so.
- **T4. The contract checker.** `scripts/check-wasm-cpu-contract.cjs` (lines 9–28, 306–345) requires
  the literal hook-include lines and `Z80_HISTORY_*`/`Z80_PROFILE_*` defines in each core. Update it
  in the same change as any include move.
- **T5. Not everything that looks like debug is debug.** The contention counters are read by the UI.
  `retnExecuted` drives the Next's NMI logic. The NextReg `lastWrite`/`written` arrays may back
  readback of write-only registers. The Z88 bus record may be read by more than the debugger. Verify
  each item before gating it; when unsure, leave it in both variants.
- **T6. In-core stops must equal the TypeScript ones.** The Z88/ZX80-81 in-core path skips
  `statementTracker.observe` and the error stops between core stops. D7 fixes the error stops and
  D13's marker bit the tracker. The resume rules of `shouldStopAtDebugPoint` (`lastBreakpoint`,
  `logArrival`: do not stop again on the breakpoint just resumed from) must hold in the core too. A
  differential test (same program, same breakpoints, in-core vs per-instruction) must stop at the same
  PC, tact and hit counts, conditional breakpoints included.
- **T7. Mid-frame switching.** A frame left mid-way by a stop continues on the next call. The
  variant choice is made per call, so a frame may run partly instrumented and partly lean. That is
  fine under D4, and is the reason D4 is a hard rule.
- **T9. Debug bookkeeping that lives in the saved state must not depend on how a frame is run.** The
  reverse-debugging determinism test compares images of a replay (fast frames, a stop target armed) with
  the straight run (fast frames or the debug loop). The ZX81's instruction start and capture flag had to
  become volatile, and a capture rule that looked at the armed stop target broke replay. The Z80's own
  `cpu.lastPort*` live inside `cpu` and cannot be made volatile on their own: they matched in every seed
  so far, but a gating change that alters what they record between run modes must be checked with that
  test. Before gating any recording, check whether it is in the state image.
- **T10. Below about 3%, a speed difference is not measurable here.** Two byte-identical builds measured
  up to 2.9% apart, and the same change measured +1.5% to +8.5% on the ZX81's idle prompt across runs;
  inlining decisions move results by several percent (the ZX81 strip-all build ran slower than the build
  it strips, because the compiler stopped inlining the instruction into the frame loop). Decide on sizes,
  repeated runs, or differences well above 3%.
- **T8. The Timex includes `sp48.c` whole.** Any change to the 48K's structure is a Timex change,
  and so is its test.

---

## 5. Phases

| # | Phase | Work | Done when |
|---|---|---|---|
| 0 ✅ | **Measure** (done 2026-10-09, §10) | `scripts/benchmark-debug-overhead.cjs` compiles each core three ways from the same sources: **baseline** (today), **strip-stack** (`-DZ80_BENCH_STRIP_STEP_OUT`: only the shadow stack removed, for D5) and **strip-all** (`-DZ80_BENCH_STRIP_DEBUG`: every hook, the stack, the capture paths and the machine-side items of §1.1 removed). The guards are benchmark-only; a production build is byte-identical with them in the source. strip-all is not a functional debugger, only a speed ceiling, but it must emulate identically: each run checks registers and RAM against baseline. Fast frames per core (ROM workloads where the core boots from raw exports, synthetic RAM programs elsewhere), interleaved rounds, minimum of each. Also, on baseline: the per-instruction loop's boundary cost (`ExecuteInstruction` + `GetCpuPc` + `GetFrameCompleted` per instruction, as the hosts do) against `ExecuteFrame` and, where it exists, `ExecuteUntilStop`. | §10 holds the numbers; D2 and D5 are applied |
| 1 ✅ | **No-regret gating** (done 2026-10-09, §10.4) | Done: the ZX80/81 records its bus activity (access log, port event, instruction start) only in the last 1024 T-states of a fast frame and always in debug runs, so the CPU panel after pausing a plain Run is unchanged (`test/zx8081-hw/bus-capture.test.ts`); `zx8081OpStartAddress` and the capture flag are volatile (T9). `Z80_ACCESS_LOG_NOINLINE` (`z80.c`, opt-in) moves the access-log write out of line on the cores whose fast frames do not log: ZX80/81, 128K, +3E, Next. Measured and **not** done: the Z88 bus record (its whole debug work measured ~0%), the Next's per-instruction access clearing and port mirror (a DMA hold can end a frame before any instruction, so a capture window could not reproduce the panel exactly, for ≤ 2%), the 48K's out-of-line log (3.3–3.6% slower at the idle ROM, so the 48K and Timex keep the inline log), the Spectrum instruction counters (tested exports, 2 increments per instruction), the RZX/stop-mode word, the Next's trace call (already an early return), its NextReg watch flag (NextReg writes are rare). | Done |
| 2 | **Shared C and build lists** | `z80-cpu-exports.c`, `z80-debug-loop.c` (D7, adopted by Z88 and ZX80/81 first), `zx-spectrum-frame.c`; zero the history context in `z80-history.c` before the hook; shared sp128/spp3e partition peek and profile mapping; the `.cjs` list builders (D8); the contract checker updated (T4). | Binaries export the same names (diff the export lists before/after); all tiers green |
| 3 | **Shared TypeScript** | D9: the loop helper and shared stop functions; the Next moves to `WasmHistorySource`; stale `MachineFrameRunner` comment fixed. | Each host's debug loop is hooks only; all tiers green |
| 4a | **In-core debug loop everywhere** (D13, D14) | `z80-debug-loop.c`'s `ExecuteUntilStop` in sp48/sp128/spp3e/Next too; a stop-table compiler in TypeScript (`DebugSupport` → the core's table, pushed on entry, rebuilt when breakpoints change); partition checks in the core; `extraStop` for the execution point, step-over and step-out; error-stop bits; launch-flow suppression in the table build; the statement-tracker marker. The hosts use it for StopAtBreakpoint, StepOver after its first instruction, StepOut and **NoDebug + UntilExecutionPoint** (Z88/ZX80-81 too). Next: the NextReg/Copper/sprite watches and the SD host-command wait end the loop with a stop reason. RZX record/play steps run in the loop. The per-instruction loop stays for step-into and as the fallback. | T6 equivalence tests pass (breakpoints with partitions, step-over/out, error stops, statement tracking, launch flows); D14's 4a rows hold on every core |
| 4b | **Access breakpoints in the core** (D12) | Read/write bits in the stop table, a port table; the core stops on a flagged access and reports address, value and the instruction's start; the bus mirror is imported only at stops. | Equivalence tests for memory and port breakpoints; D14's 4b row |
| 4c | **Conditions and hit counts in the core** | At a flagged address the loop runs the breakpoint's condition program and its hit rule, and continues when either says no. Hit counters in the slot table, read back by `DebugSupport` at stops and on panel refresh. Conditions that read host-only facts, and logpoints, stop as now. | Equivalence tests for conditions, every hit-count rule (C11) and DeZog conditions; D14's 4c row |
| 4d | **Source-step candidates in the core** | During a source step the core stops only at marker addresses and at the step's SP/interrupt-depth exits; `shouldStopAtSourceStep` runs only there. | The Klive BASIC debugger checks (`scripts/kbasic-ide-check.cjs`, the corpus) unchanged; stepping over a long statement no longer runs per instruction |
| 5 ✗ | **Lean and instrumented variants** — **dropped** by D2 (§10.4); kept here for the record | D1 split of `z80.c`; D3 selection; D6 machine-side rule; lockstep test per core (D4): the same workload, lean frames vs instrumented frames with every feature idle, state blobs equal after N frames, including a mid-frame switch (T7); then the same with history and profiling on, compared on machine state only. Size budgets raised (T3). | Lean fast frames within noise of Phase 0's stripped ceiling; lockstep tests green on every core; reverse-debugging self-checking replay green |
| 6 | **Docs and guards** | `src/emu/z80/wasm/README` (or a section in each core's README): the variant rule, how to add a hook, what may run in lean. A perf-tier test per core holding the lean frame against a recorded budget. | Merged |

Phases 1–3 are independent and can land in any order. Phase 4a builds on 2 and 3; 4b, 4c and 4d each
build on 4a and are independent of each other. Phase 5 builds on 1 and 2 and is gated by D2.

---

## 6. Tests

- Existing suites are the behavioural oracle: `test/wasm/{history,profile,reverse,rzx,state,condition}`,
  `test/zxnext-hw/`, `test/harness/*`, the Klive BASIC corpus (SP checks, debugger), and
  `scripts/kbasic-ide-check.cjs`.
- New: export-list snapshot per core (Phase 2), so a shared file cannot silently drop or rename an
  export.
- New: in-core vs per-instruction stop equivalence per core (Phases 4a–4d, T6): the same program and
  breakpoints run both ways must stop at the same PC, tact and hit counts - breakpoints with partitions,
  conditional breakpoints with every hit rule, logpoints (same lines logged), access breakpoints,
  step-over, step-out, error stops, launch flows, the statement tracker's current statement at every
  stop, source steps, the Next's watches.
- New: D14's budgets as perf-tier tests per core (`benchmark-debug-host-loop.cjs`'s modes).
- New: lean vs instrumented lockstep per core (Phase 5, D4, T7).
- New: perf-tier benchmarks per core (Phase 6). Per the repo rules, tests that instantiate a core are
  listed in `build/e2e-tests.ts`.

---

## 7. Expected outcome

- **Running with debugging**: from a JavaScript stop test per instruction to one per stop or frame,
  on every machine and in every common debugging mode. D14's budgets: about 1.1x a plain Run for a
  debug session (from 2.1–2.3x on the Spectrums), about 1.0x for a project start, 1.2–1.3x with access
  breakpoints, conditions at hot addresses or history recording. At the throttled 50 frames per second
  this mostly shows as lower CPU use; it shows as speed in fast-forward and headless runs (`klive
  test`, `klive run`) under the debugger, and as headroom on the Next at 28 MHz.
- **Running without debugging**: Phase 0 put the whole of the debug work at 0–4.4% of a fast frame
  (§10). Phase 1 takes the cheap part of it (the ZX80/81, Z88 and Next always-on items); Phase 5, which
  would take the rest, is not expected to clear D2's bar.
- **Code**: roughly 400–500 C lines, ~250 build-script names and 300–400 TypeScript lines fewer, and
  one place each for the CPU forwarders, the debug loop, the Spectrum frame loop and the host debug
  loop.

---

## 8. Files

| Area | Files |
|---|---|
| Shared CPU | `src/emu/z80/wasm/z80.c` (split per D1), new `z80-exec.inc`, `z80-cpu-exports.c`, `z80-debug-loop.c`; `z80-history.h/.c`, `z80-profile.h/.c` |
| Spectrum common | new `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-frame.c`; `zx-spectrum-rzx.c` |
| Cores | `sp48.c`, `sp128.c`, `spp3e.c`, `zxnext*.c` (cpu, frame, ports, nextreg, copper, dma, trace, debug), `z88*.c`, `zx8081*.c` |
| Build | `scripts/build-*-wasm.cjs`, new `scripts/z80-cpu-exports.cjs`, `scripts/z80-condition-exports.cjs`, `scripts/check-wasm-cpu-contract.cjs`, `scripts/check-*-wasm-size.cjs`, `scripts/benchmark-*-wasm.cjs` |
| Hosts | `src/emu/machines/*/*WasmV2Machine.ts`, `*/wasm/*WasmV2Loader.ts`, new shared loop helper under `src/emu/machines/`, `DebugStepDecision.ts`, `SourceStepDecision.ts` (4a marker, 4d), `DebugSupport.ts` and a new stop-table compiler beside it (D13), `conditionStore.ts` (4c hit counters), `MachineFrameRunner.ts` (comment) |
| Measurement | `scripts/benchmark-debug-overhead.cjs`, `scripts/benchmark-debug-host-loop.cjs` (D14's budgets) |

---

## 9. The author's answers (2026-10-09)

The suggested answers were accepted.

1. **Shadow step-out stack in lean frames:** keep it, confirmed by Phase 0's stack-only measurement
   (D5).
2. **The Phase 5 threshold:** fixed before measuring: 5% on any core against the post-Phase-1 build
   (D2).
3. **Access breakpoints in the core:** yes, as Phase 4b after Phase 4 (D12).
4. **Profiling during a plain Run:** runs instrumented, costing what it costs today (D11).
5. **The `UnitTestRunner` feature-switch gap:** a separate small change, not part of this plan.

---

## 10. Measurements

### 10.1 Phase 0 (2026-10-09)

Apple Silicon, Node's V8, clang `-O3 -Wl,--strip-all` (the production `speed` profile). Tools:
`scripts/benchmark-debug-overhead.cjs` (the cores from raw exports, three builds) and
`scripts/benchmark-debug-host-loop.cjs` (the production cores through their TypeScript hosts, built by
the test harnesses).

**The switches cost nothing when off.** Each core built from the edited sources is byte-identical to the
one built from the unedited `HEAD` (checked for all six). Every strip build emulated identically to its
baseline in every scenario (registers, RAM and the picture compared after the same frames).

**Fast frames, ms per frame** (minimum of 9 interleaved rounds of 400 frames; the Z88 1000 frames x 15
rounds; two full runs, both shown as run 2 / run 3; a negative gain is noise):

| Core | Workload | Baseline | Gain, stack only | Gain, all debug work |
|---|---|---|---|---|
| 48K | ROM booted, idle at © | 0.454 / 0.460 | 1.4% / −0.1% | 1.9% / 0.1% |
| 48K | mixed RAM loop (EI, ROM interrupts) | 0.429 / 0.442 | 0.2% / 0.3% | 0.2% / 0.4% |
| 128K | ROM booted, menu | 0.508 / 0.505 | 2.5% / 0.4% | 5.4% / 2.8% |
| 128K | mixed RAM loop | 0.502 / 0.509 | 0.7% / 0.0% | 1.8% / 0.9% |
| +3E | ROM booted, menu | 0.566 / 0.576 | −1.6% / 0.2% | 0.2% / 1.3% |
| +3E | mixed RAM loop | 0.513 / 0.521 | 0.1% / −0.3% | 1.8% / 0.1% |
| Next | mixed RAM loop, 3.5 MHz | 1.041 / 1.051 | 0.1% / 0.0% | 1.3% / 1.5% |
| Next | mixed RAM loop, 28 MHz | 5.052 / 5.085 | −0.6% / −0.2% | 2.5% / 2.7% |
| Z88 | mixed RAM loop (flat RAM) | 0.037 / 0.037 | −0.4% / −0.4% | −1.9% / 0.4% |
| ZX81 | SLOW mode, at the prompt | 0.312 / 0.313 | 0.3% / 0.4% | 3.9% / 3.8% |
| ZX81 | SLOW mode, `10 GOTO 10` | 0.314 / 0.315 | 0.6% / 0.5% | 4.4% / 4.4% |

The noise between runs is about ±1.5%. The mixed loop is a block copy, a CALL/RET with PUSH/POP, a port
read and an arithmetic loop (`mixedProgram` in the script); the Next runs it at 34 iterations a frame at
3.5 MHz and 237 at 28 MHz.

**Binary size** (bytes; the stack's share is ~660 bytes everywhere):

| Core | Baseline | Strip-all | Smaller by |
|---|---|---|---|
| 48K | 253,031 | 177,742 | 30% |
| 128K | 518,845 | 434,328 | 16% |
| +3E | 279,543 | 201,407 | 28% |
| Next | 458,184 | 361,120 | 21% |
| Z88 | 187,253 | 123,032 | 34% |
| ZX81 | 231,963 | 164,465 | 29% |

**The hosts, ms per frame** (production cores, minimum of 5 rounds of 100 frames). "debug" is a debug
session with one execution breakpoint that is never hit; "exec-point" is the project-start boot
(NoDebug + UntilExecutionPoint, not reached):

| Host | Run | Debug | Exec-point | Debug loop |
|---|---|---|---|---|
| 48K | 0.429 | 0.985 (2.3x) | 0.902 (2.1x) | per instruction, in TypeScript |
| 128K | 0.491 | 1.068 (2.2x) | 0.956 (1.9x) | per instruction |
| +3E | 0.508 | 1.048 (2.1x) | 0.961 (1.9x) | per instruction |
| Next | 1.031 | 1.403 (1.4x) | 1.335 (1.3x) | per instruction |
| Z88 | 0.039 | 0.046 (1.2x) | 0.108 (2.8x) | in core; exec-point falls back to per instruction |
| ZX81 | 0.301 | 0.318 (1.1x) | 0.896 (3.0x) | in core; exec-point falls back to per instruction |

Calling `ExecuteInstruction` + `GetCpuPc` + `GetFrameCompleted` per instruction **without** the hosts'
JavaScript costs only 1.1–1.4x a fast frame on the Spectrums and the Next (1.2–1.8x on the Z88 and
ZX81). So the per-instruction loop's cost is mostly the JavaScript stop tests it runs per instruction
(`shouldStopAtDebugPoint` and its callbacks), not the boundary crossing. The in-core
`ExecuteUntilStop` runs at 1.01–1.08x a fast frame.

### 10.2 What the numbers decide

- **D5: the stack stays.** Its cost is within noise on every core (the largest single reading, 2.5%,
  was 0.4% on the repeat run).
- **D2: Phase 5 is not expected to clear its bar.** Against today's code, removing every piece of debug
  work gains 0–4.4%, and 5% was reached once (128K menu, 5.4%), not on the repeat (2.8%). Phase 1 takes
  the cheap part of that gain, and D2 measures Phase 5 against the build after Phase 1, so the
  remaining gain will be smaller still. The rule is applied formally when Phase 1's re-measurement is
  recorded here; unless that run differs, Phase 5 is dropped.
- **Where the time goes is the debug path.** A debug session costs 2.1–2.3x a plain Run on the
  Spectrums, and every project start runs 1.9–3.0x slower than it needs to on every machine but the
  Next. The Z88 and ZX81 show what Phase 4 gives: 1.1–1.2x. Phase 4 (and the exec-point fix for the Z88
  and ZX81 in it) is the priority after Phase 1.
- **Size is a reason of its own.** The debug hooks make each core 16–34% larger. That is the price
  Phase 5 would pay twice, and a reason to keep the hooks out of line, as they are.

### 10.3 Limits of these numbers

- The Next and the Z88 run synthetic RAM programs, not their operating systems; their ROM paths
  (NextZXOS, OZ) are not measured. The Next's strip also leaves the port mirror (`lastPort*`), the
  NextReg `lastWrite`/`written` arrays and the Copper/DMA write-origin labels in place, because they may
  be functional (T5); they cost a few stores per port or NextReg access.
- The host loop timings include the hosts' per-frame work, so "run" is not exactly the core's fast
  frame; the ratios, not the absolute values, are what matters.

### 10.4 Phase 1 (2026-10-09)

`benchmark-debug-overhead.cjs --reference HEAD` (the Phase 0 commit): the reference build is the Phase 0
code, "Phase 1" is the gain of the new production build over it, and "all" is the remaining gain of
strip-all over the new build (D2's measure). 400 frames x 9 rounds; one full run shown, the ZX81 and the
Next repeated (below). Every build emulated identically to the reference.

| Core | Workload | Phase 1 | Stack only | All debug work | Size before → after |
|---|---|---|---|---|---|
| 48K | ROM idle | −2.9% (identical binary: noise) | 0.4% | 2.8% | 253,031 (unchanged) |
| 48K | mixed | 0.0% | −3.6% | 0.6% | |
| 128K | ROM menu | 2.1% | −4.4% | −4.7% | 518,845 → 483,028 (−7%) |
| 128K | mixed | 1.2% | 0.2% | −2.5% | |
| +3E | ROM menu | 1.1% | 0.1% | −1.6% | 279,543 → 243,843 (−13%) |
| +3E | mixed | 1.6% | 0.1% | −0.8% | |
| Next | mixed, 3.5 MHz | 0.2% | −0.1% | 1.6% | 458,184 → 421,577 (−8%) |
| Next | mixed, 28 MHz | −1.5% | −0.2% | 2.2% | |
| Z88 | mixed | −0.1% | 5.6% (noise, see Phase 0) | 3.2% | 187,253 (unchanged) |
| ZX81 | SLOW, prompt | 1.5% | 7.7% | 1.2% | 231,963 → 202,119 (−13%) |
| ZX81 | SLOW, `10 GOTO 10` | 1.0% | −0.2% | 0.4% | |

Repeats: the ZX81 prompt measured +6.8%, +7.8%, +8.3% and +8.5% for Phase 1 in four earlier runs; the
Next at 28 MHz measured 2.3%, 2.4% and 2.6% for "all" in three runs (one earlier run said 5.0%, an
outlier). The 48K's out-of-line log measured −3.3% and −3.6% at the idle ROM and was not kept.

**What it decides:**

- **D2: Phase 5 is dropped.** After Phase 1 the remaining debug work is at most 2–3% of a fast frame on
  every core (largest repeatable reading: the Next at 28 MHz, 2.2–2.6%), below the 5% bar and close to
  the measurement noise (T10).
- **D5: the stack stays.** Its readings scatter around zero (−4.4% to +7.7%, never repeatable), which is
  noise (T10), not cost.
- **Phase 1's own gain** is mostly size: 7–13% smaller binaries on four cores. Speed is within noise
  except the ZX81's idle prompt (repeatable +7–8% in most runs), where the display file's forced NOPs make
  per-instruction bookkeeping a large share of the work.
- **One behaviour difference, accepted:** on the ZX81, a reverse-debugging stop in the middle of a frame,
  more than 1024 T-states before its end, now shows no bus accesses in the CPU panel - what the Spectrum
  cores, whose fast frames record none, already show. Recording during the whole frame while a stop
  target is armed would have broken replay determinism (T9).

