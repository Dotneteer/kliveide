# The Shared Z80 and Its Debugging Support

Every WASM machine core (the 48K and Timex, 128K, +2E/+3E, Next, Z88, ZX80/81) is one C translation
unit that includes the files here. Nothing here is built on its own except `z80-condition.c`'s test
module. Read this before adding a hook, a debugger feature or a core.

| File | What it is | How a core uses it |
|---|---|---|
| `z80.c` | The CPU: registers, every opcode, the bus funnels | Defines its `Z80_*` hook macros, then includes it |
| `z80-history.h` / `.c` | The execution-history recorder | `.h` before `z80.c`, `.c` after its `Z80_HISTORY_*` macros |
| `z80-profile.h` / `.c` | Coverage, heat map, profiler | `.h` before `z80.c`, `.c` after its `Z80_PROFILE_*` macros |
| `z80-condition.c` | The breakpoint-condition evaluator | After its `COND_PEEK*` macros |
| `z80-cpu-exports.c` | Register, step-out, interrupt-depth, access-log and last-port exports | `Z80_EXPORT_PREFIX`, after `z80.c` |
| `z80-debug-loop.c` | The debugger's in-core loop | `Z80_DEBUG_LOOP_PREFIX`, after `<prefix>ExecuteInstruction` |

The plans behind them: `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md`, `.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`,
`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` and, for the cost of debugging and the in-core loop,
`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`. `scripts/check-wasm-cpu-contract.cjs` checks the includes.

## Contention hooks

A core with memory contention defines `Z80_DELAY_MEMORY_READ`/`_WRITE` (a memory cycle),
`Z80_DELAY_PORT_READ`/`_WRITE` (an I/O cycle) and `Z80_DELAY_ADDRESS_BUS_ACCESS` (an internal T-state
with an address on the bus, the timing tables' `ir:1`, `hl:1`, `pc+1:1` entries). The second T-state
of an M1's refresh, with IR on the bus, goes through `Z80_DELAY_REFRESH_BUS_ACCESS`, which defaults to
the address-bus hook; the 48K and 128K define it as nothing, because the ULA halts the CPU only on an
M-cycle's first T-state (IR Contention's real-machine pictures, `.plans/SPECTRUM_ACCURACY_DOCS_PLAN.md`).
The +2A/+3's gate array contends memory cycles only, so its address-bus and port hooks add no delay.

## The Next's CPU is a T80N, not a Zilog Z80

`Z80_T80N`, defined only by the Next (`zxnext-cpu.c`), switches `z80.c` to the FPGA's T80N
(`_input/next-fpga/src/cpu/`) where the two differ:
- *Flags:* `BIT` takes flag bits 3/5 from the operand, or 0 for `(HL)`/`(IX+d)`, never from MEMPTR.
  `IN r,(C)`, `LD A,I` and `LD A,R` keep flag bits 3/5, and `IN r,(C)` sets parity. `CPI` and friends
  take flag bits 3/5 from the byte. Block I/O keeps the flags of `SUB B,1`. The Z80N block copies
  set `LDI`'s flags.
- *`ED B6` (LDIRSCALE):* runs as `LDIRX`.

Without the define, a core keeps the Zilog behaviour that ZEXALL and the Spectrum suites check.
PIXELDN, a Z80N-only instruction, follows the T80N everywhere.

The T80N differential in `test/vhdl/f1/` (`node test/vhdl/f1/run-f1.cjs --full`, about 30 s) runs
115,854 single-instruction cases on the simulated VHDL and on the Next core and must report 0
mismatches. Run it after any change to `z80.c` that the Next can see. It needs `nvc`
(`brew install nvc`). The `test/wasm/z80` corpus covers the build without the define.

## A fast frame does no debugging work it can avoid

A plain Run is `<prefix>ExecuteFrame`, one call per frame. Every debugging hook in it is either compiled
in behind one predictable runtime branch (history, profile: off unless the user turned them on), or gated
by the core's capture flag (the access log and port event, which only a debug run records). The plan's
Phase 0 measured what is left: 0-4% of a fast frame, the step-out stack within noise (§10.1); compiling
the instruction set twice to remove it was dropped (D2).

When you add debugging work:

- Put it behind a runtime flag, or behind the capture flag if it records bus activity for the IDE.
- **Anything a debug run writes and a fast frame does not is volatile** (the build script's volatile
  symbols). The state image is compared between a replay (fast frames) and the debug run it replays;
  a debug-only static in the image breaks reverse debugging (the plan's trap T9).
- Measure it: `npm run benchmark:debug-overhead -- --reference HEAD` builds the core from `HEAD` beside
  yours, times both and checks they emulate identically. Below about 3% a difference is noise (T10).
- Prefer out-of-line bodies for hooks that sit at every memory access: inlined, they grow every opcode
  (`Z80_PROFILE_NOINLINE`, `Z80_ACCESS_LOG_NOINLINE`).

## The debugger runs in the core

The hosts' debug loop is `src/emu/machines/wasmDebugLoop.ts` (`runWasmDebugLoop`), shared by every
machine. It runs a debug session, a step and a project start (`ReachExecPoint`) through
`<prefix>ExecuteUntilStop(extraStop, mask, accessMask)` wherever it can, and crosses into TypeScript only
where the stop policy might stop. The rule (the plan's D13): **the core decides whether to stop;
TypeScript decides what a stop means.** The core only ever stops early - at a *candidate* - and the
unchanged TypeScript policy (`shouldStopAtDebugPoint`, `DebugSupport`) decides there, so running in the
core decides exactly as running instruction by instruction does.

The stop table the host pushes on every entry (`buildCoreStopTable`) is a copy of
`DebugSupport.breakpointFlags` (bits 0-12) with two bits of its own:

| Bit | Name | Meaning in the core |
|---|---|---|
| 0x01, 0x02 | EXEC_BP, PART_BP | Stop: an execution breakpoint (the partition is decided in TypeScript) |
| 0x08-0x40 | MEM_READ/MEM_WRITE/IO_READ/IO_WRITE | With `accessMask`: stop after an instruction that touched the address or port |
| 0x4000 | `CORE_STOP_CONDITION` | Run the address's conditions from the plan (`<prefix>CondPlan`); stop unless all are false |
| 0x8000 | `CORE_STOP_CANDIDATE` | Stop: an error stop, or an address the BASIC statement tracker or a source step acts at |

`extraStop` is the run's execution point, a step-over's return address or a step-out's target. The core
also returns at the frame's end, at a reverse-debugging stop target and where a core's own frame loop
would (`Z80_DEBUG_LOOP_STOP()`: the Next's SD host command and reset request). After every run the host
sets `lastDecisionPc` from `<prefix>GetDebugOpStart`, as the per-instruction policy had it.

What stays instruction by instruction in TypeScript: step-into, an RZX session, the Next's NextReg,
Copper and sprite watches (`canRunInCore`), and anything a test forces with
`wasmDebugLoopOptions.inCore = false`.

### Adding a stop the core should know

1. Decide whether the core can reproduce the TypeScript decision **exactly**. If it can only find the
   places where the decision could be "stop", mark those as candidates and let TypeScript decide there.
2. If the core decides itself (as for false conditions), keep everything that has an effect in
   TypeScript: hit counters, logpoints and the reverse-debugging hit log stay there (Phase 4c).
3. Extend `test/wasm/debug-loop-equivalence.test.ts` (and, for source-level work,
   `test/kbasic/codegen/source-step-in-core.test.ts`): the same program and breakpoints, in the core and
   instruction by instruction, must stop at the same PC, registers, T-states and decision point. Check the
   test fails when your core path is disabled.
4. Measure: `npm run benchmark:debug-host-loop` (modes run, debug, exec-point, history, access, cond;
   `--source-step`), and keep `npm run test:perf` green (`test/wasm/debug-loop-budgets.perf.test.ts`
   holds the D14 budgets).

### Adding a core

Include `z80-cpu-exports.c` and `z80-debug-loop.c`, export `cpuExports(...)` and `debugLoopExports(...)`
(`scripts/z80-cpu-exports.cjs`) and list `debugLoopVolatileSymbols(...)` as volatile, give the loader the
`breakpointFlags` and `condPlan` views, and give the host's `WasmDebugLoopHost` its `executeUntilStop`,
`lastOpStart`, `pushBreakpointFlags` and `conditionPlan` hooks. If the core's bus record is not the shared
Z80's, define `Z80_DEBUG_LOOP_ACCESS_HIT` (the Z88 and the Next do).
