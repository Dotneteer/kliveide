# Profiler Plan: Flat and Call-Graph Profiling

Status: **implemented** (2026-10-08), Phases 1–5, on every Z80 core. D1–D17 are the decisions; the
author accepted the suggested answers to all §8 questions, which the decisions already assume. §9
records what was built, the measurements and the departures.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G5.3**: the T-states spent per address,
  rolled up per label or procedure, shown in a "top routines" table.
- **G5.4**: inclusive and exclusive time per routine, taken from the call stack.

Builds on:
- [CODE_COVERAGE_AND_HEAT_MAP_PLAN.md](CODE_COVERAGE_AND_HEAT_MAP_PLAN.md) (G5.1/G5.2). Its core
  module `z80-profile.c` already records, per physical byte, the execution count and the time from
  instruction start to instruction end (its D7/D8). Interrupt acknowledge, DMA, snooze and HALT time
  go to separate buckets. So **G5.3 adds no core work**: it is a rollup, a document and exports.
  G5.4 adds a call tracker to the same module.
- The shared Z80's shadow stack: `callCore`, `rstCore`, `pushPcForInterrupt` and `retCore` (`z80.c`
  l.812–853). Every CALL, RST, interrupt push and RET/RETI/RETN passes through these four functions.
  G5.4 hooks them.
- G4.4's replay muting (coverage plan D10). It applies to the call tracker too.

Not in scope:
- **Sampling.** Every instruction is measured exactly; an emulator has no reason to sample.
- **Profiling Klive BASIC at the statement level as a separate engine.** Statements and SUB/FUNCTION
  callables are rollup *keys* (D6), not a separate recorder.
- **A flame-graph renderer inside Klive.** D13's speedscope export opens in speedscope.app or its
  offline viewer. A built-in one can come later (§1.2).

---

## 1. What is being added, and why

Fuse's profiler writes one line per address with its cumulative T-states (`0x1234,456`) and nothing
else. ZEsarUX has counters but no profile. DeZog has none: it suggests step-over T-state deltas for
timing. VICE 3.8 (6502 only) and Mesen are the models for a modern retro profiler. They offer a flat
self-time list, a call graph with callers and callees, inclusive and exclusive time, and call
counts. No retro tool we found exports callgrind or speedscope, so Klive would be first there.

The Z80 makes a call graph harder than on a modern CPU:
- **tail calls** are `JP`s;
- **"pop the return address and jump"** tricks are common;
- **stack switching** (`LD SP,…`) happens in interrupt handlers and in banked-call trampolines;
- **RST** doubles as a call and as a ROM service entry;
- an interrupt can land inside any routine.

The tracker therefore has to be robust rather than exact on every trick, and it must say when it
had to guess (D10).

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **Two profilers, one switch.** "Profiling" is the coverage plan's switch with counters on: the **flat** profile is always available from the counters. **Call graph** is a second switch (`profile on -calls`), because its tracker costs work on every CALL/RET. Debug → **Start Profiling** turns both on and resets them. **Stop Profiling** freezes the data (it sets `enabled = 0` without a reset) and opens the Profiler document. |
| D2 | **A profiling run is a window, not a session.** `profile start` resets and enables; `profile stop` disables. Between the two, the machine may run, pause, step and reverse-step; replay is muted (coverage D10). `profile start -at <addr>` / `-until <addr>` arm one-shot internal breakpoints that start and stop the window, so "profile one frame of the game loop" is one command: `profile start -at MainLoop -until MainLoop`. |
| D3 | **Flat profile rows are routines, not addresses.** The table rolls each instruction start's `exec` and `time` up into a **routine**, chosen by D6. It has these columns: routine, partition, entry address, self time, self %, executions of its entry (calls, when the call graph is on), instructions executed, average time per call, and source location. An **Addresses** tab gives the raw Fuse-like view per instruction start, with its disassembly. |
| D4 | **Non-code time is shown as pseudo-rows.** "HALT (waiting)", "Interrupt acknowledge", "DMA bus hold (Next)" and "Snooze (Z88)" appear as rows in italics with their share, so a game that spends 70% of its frame in HALT reads honestly. A **Hide waiting** toggle (default **on**) removes HALT from the percentages' denominator. |
| D5 | **Time is shown in the core's unit and as wall time.** T-states (or 28 MHz ticks on the Next, coverage D8), plus µs or ms at the machine's clock. On the Next the clock is the 28 MHz reference, so a speed change mid-run stays comparable. A column **per frame** divides by the frames in the window, which is the number a game programmer budgets against: "this routine costs 9% of a frame". |
| D6 | **Routines come from the best debug info available, in this order.** (1) **Klive BASIC callables** (`CallableDebugInfo`/`CallableFrameInfo`: exact extents and partition). (2) **Klive asm `.proc`/`.endp`** extents, which the assembler does not emit today (D7). (3) **Labels**: an address belongs to the nearest preceding *non-local* label in the same partition and segment, up to the next one (sjasmplus `module.main` labels, Klive asm labels; local `.label`s and sjasmplus `@`/`.local` labels never start a routine). (4) **Call targets** seen by the call tracker (G5.4) when no symbols exist. (5) The bare 256-byte block, `$8000–$80FF`. The table header names the source used, e.g. "Routines from labels (sjasmplus)". |
| D7 | **The Klive assembler emits procedure extents.** `processProcStatement` (`common-assembler.ts` l.5311–5360) records `{name, startAddress, endAddress, partition?, fileIndex, startLine, endLine}` into a new `AssemblerOutput.procedures` (`CompilerInfo.ts`). The name is the label on the `.proc` line, or the enclosing label. `extractIntelData.ts` also emits them as `"proc"` outline entries, which the type already allows. That fixes the editor outline as a side effect. |
| D8 | **sjasmplus debug info is fixed where the profiler needs it.** (a) `sldSymbols` (`SjasmPCompiler.ts` l.414–439) sets `type: Label` for `L`/`F` lines, so `historyLabelLookup` and the rollup see them. The Execution History's label column for sjasmplus builds is fixed by the same change. (b) The SLD `page` is kept in `listFileItems` as a partition, so banked sjasmplus code rolls up per bank. This overlaps G10.3 (sjasmplus on 128K/Next) and is done once, here or there, whichever lands first. |
| D9 | **The call tracker (G5.4) is a shadow stack in `z80-profile.c`.** Hooks: `Z80_PROFILE_CALL(target, retAddr)` in `callCore`/`rstCore`, `Z80_PROFILE_INT(kind, target)` in `pushPcForInterrupt`, and `Z80_PROFILE_RET()` in `retCore`. A frame is `{calleePhys, calleeAddr, slotSp, startTime, childTime, isInterrupt}` with depth 256 (like `stepOutStack`). On CALL it pushes with `slotSp = SP after the push`. On RET it pops **every frame whose `slotSp` is below the new SP**. That one rule handles a normal RET, a RET that skips frames (a "pop and ret" unwinder), and a routine that discarded its return address and jumped away: the frame closes at the first RET that climbs past it. |
| D10 | **What the tracker cannot see is counted, not hidden.** **Tail calls via `JP`** charge the jumped-to code to the caller, as every stack-based profiler does. The docs say so, and the Addresses tab still shows the truth. **Stack switches:** when SP moves by more than 512 bytes between two hooks, or is loaded by `LD SP`/`EX (SP)` (the cheap check runs at `Z80_PROFILE_RET` and at each CALL), the tracker flushes the stack to the root and increments `header.stackResyncs`. **Overflow** past 256 frames increments `header.depthOverflows`. The document shows these counters in its header with an explanation, so a user knows when the graph is approximate. |
| D11 | **Interrupts are their own roots.** An interrupt push opens a frame marked `isInterrupt`, whose time is **excluded** from the interrupted routine's inclusive time (Q3). The graph shows "IM 1 handler at $0038" (or "IM 2 → $FDFD") as a root, with its callees below it. That is the only way a frame-interrupt music player shows up as the cost it is, instead of being smeared over whatever it interrupted. |
| D12 | **Edges are aggregated in C.** An open-addressed table of 16,384 entries (24 bytes each, 384 KB) is keyed by `(callerRoutineEntry, calleeEntry)`, each a physical offset, and holds `calls`, `inclusiveTime` and `exclusiveTime`. A frame's exclusive time is its inclusive time minus its children. Recursion is handled by counting inclusive time only at the outermost activation of a callee on the stack, which Mesen and VICE also do. When the table is full, new edges go to an `(other)` edge and `header.edgesDropped` counts them. The call tracker therefore never allocates, and its cost per CALL/RET is a hash and an add. |
| D13 | **Exports, four formats.** (1) **Fuse profile** (`0xADDR,TSTATES` per instruction start, 64K-logical): existing users' scripts and `profile2map` keep working. (2) **CSV** of the flat table (routines or addresses). (3) **Callgrind** (`callgrind.out.*`: `fl=`/`fn=`/`cfn=`/`calls=` with source lines) for KCachegrind/QCachegrind. (4) **speedscope JSON** (the "sampled" profile type, built from call edges as weighted stacks) for flame graphs in the browser. The format follows the file extension; `-format` overrides it. |
| D14 | **One document, `$profiler`.** Tabs: **Routines** (D3), **Addresses**, **Call tree** (top-down: inclusive/exclusive/calls, expandable) and **Callers** (bottom-up for a selected routine, as in VICE's `func`). It has a header with the window (frames, total time, waiting share, the D10 counters) and Start/Stop/Reset/Export buttons. A double-click goes to the source (`nav … -r profiler`) or the disassembly (`show-disass`). The table is a `VirtualizedList` of `DataRow`s with `ch` widths (M2). |
| D15 | **Editor and disassembly hints.** With a profile present, a setting (default off) adds a Monaco **inlay at each routine's first line** ("9.4% · 1,204 calls") and the disassembly's coverage cell (coverage D13) gains a tooltip with the instruction's time share. Nothing else in the editor changes. |
| D16 | **Commands.** `profile start [-calls] [-at <addr>] [-until <addr>]`, `profile stop`, `profile reset`, `profile status`, `profile top [n] [-by self|inclusive|calls]` (a text table in the output pane, also for KSX and G5.6), and `profile export <file> [-format fuse|csv|callgrind|speedscope]`. Aliases: `prof`, `pst`, `psp`. |
| D17 | **Profiling uses the coverage plan's `MF_PROFILE` gate.** All Z80 machines get the flat profile. The call graph comes with the same per-core wiring, because the four hooks are in shared `z80.c`. The Next's Z80N extra opcodes need no hook: none of them calls or returns. |

### 1.2 Out of scope, and the hooks left for later

- **A built-in flame graph.** speedscope covers the need. A later item could embed a canvas flame
  graph in the document from the same edge data.
- **Per-frame time series** ("which frame was slow?"). The header's `timeTotal` could be sampled per
  frame into a ring. The hook is the controller's existing every-10-frames publish.
- **Differential profiles.** These compare two exports, e.g. two `.kprof` files (D13 could add a
  Klive JSON later), as G4.5 left trace diffing to external tools.
- **Profiling interrupts by source** (ULA frame, CTC, line interrupt on the Next). The INT hook
  receives the vector, so the root can be split by vector later.

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Counter source | `z80-profile.c` (coverage plan §4.1): `Z80ProfileEntry.exec/time`, the header's time buckets |
| Shadow stack hooks | `src/emu/z80/wasm/z80.c`: `retCore` l.812–822, `callCore` l.824, `rstCore` l.834, `pushPcForInterrupt` l.853 |
| Historical call stack (logic reference) | `src/common/history/reverseStep.ts` `historicalCallStack` l.369–416, `flowKind.ts` l.34–68 |
| Klive BASIC callables | `CompilerInfo.ts` l.668–813 (`CallableDebugInfo`), `SourceDebugInfo.ts` (`CallableFrameInfo` l.77–103, `CallSiteDebugInfo` l.59–75) |
| Klive asm procedures | `src/main/compiler-common/common-assembler.ts` `processProcStatement` l.5311–5360; `assembler-in-out.ts`; `extractIntelData.ts` |
| sjasmplus symbols | `src/main/sjasmp-integration/SjasmPCompiler.ts` `sldSymbols` l.414–439, `extractSldInfo` l.376, T lines l.158–175 |
| Label lookup | `src/renderer/features/history/historyDisassembly.ts` `historyLabelLookup` l.74–86 |
| Document pattern | `common/state/common-ids.ts`, `renderer/features/documents/specialDocuments.ts`, `renderer/registry.ts` `documentPanelRegistry`; reference `ExecutionHistoryPanel.tsx`, `ShowHistoryCommand` |
| One-shot internal breakpoints | G1.6's one-shot breakpoints (`DebugSupport`), owner kind for D2's window markers |
| File writing | `MainApi.saveTextFile`, `MainApi.showSaveFileDialog` (from [TRACE_EXPORT_PLAN.md](TRACE_EXPORT_PLAN.md) D13; whichever lands first adds it) |
| Menu | `src/main/menus/debug-menu.ts` |

---

## 3. The traps

1. **T1: RET that is not a return.** `PUSH HL / RET` is a computed jump, and the D9 rule treats it as
   a return. If a frame's `slotSp` lies below the new SP, that frame closes, which is wrong when the
   pushed value was not the frame's return slot. The sequence leaves SP back where it was, though: a
   PUSH lowers SP by 2 and the RET raises it by 2. So no frame below is closed, because a frame
   closes only when SP rises *past* its slot. A fixture with `PUSH HL / RET` dispatch tables proves
   the call depth is unchanged.
2. **T2: RST used as a call that never returns normally.** The 48K's `RST 8` (error) unwinds via
   `ERR_SP`. D9's "close every frame below the new SP" absorbs it at the next RET, after the ROM's
   `LD SP,(ERR_SP)` (a D10 resync if the jump is large).
3. **T3: Banked trampolines.** A call through a paging stub (Next MMU, 128K `$7FFD`) has the stub
   as the callee. The routine key is the **physical** offset (D12), so the same logical address in
   two banks gives two routines. The stub shows as a routine with high call counts and tiny self
   time, which is accurate.
4. **T4: Interrupt time inside a routine.** If the INT frame's time were not excluded (D11), the
   interrupted routine's inclusive time would include the music player. A test with a 48K IM 2
   player proves the main loop's inclusive time drops by the handler's time.
5. **T5: Counting from the middle.** When `profile start` is issued inside a routine, the tracker's
   stack is empty, and the first RET pops nothing. The time before that RET goes to the `(root)`
   frame. The Call tree shows `(entered before profiling)` for it, rather than inventing a caller.
6. **T6: The pause inside a window.** While paused, time does not advance. Stepping charges each
   stepped instruction normally, and reverse steps are muted (coverage D10). The window's "frames"
   column counts emulated frames, not wall time, so a long pause does not distort "per frame".
7. **T7: The rollup's label-to-next-label heuristic.** Data between routines (tables after a RET) is
   attributed to the preceding routine. That is harmless for time, because data is never executed.
   Routine sizes shown in the table are therefore "up to the next label", and the column says so in
   its tooltip.
8. **T8: Performance of the call tracker.** CALL/RET are perhaps 5–10% of executed instructions.
   The hash insert is amortised by caching the current edge in the frame, so a hot inner call pair
   costs one compare. Phase 2 measures it against the coverage plan's T10 gate: call graph ≤ 10% on
   top of counters.

---

## 4. Design

### 4.1 Rollup (pure, `src/common/profile/`)

```ts
export type RoutineSource = "kbasic" | "proc" | "labels" | "callTargets" | "blocks";

export type Routine = {
  key: string;                // `${partition}:${entry}` or the callable's index
  name: string; partition?: number; entry: number; end: number;
  file?: string; line?: number; source: RoutineSource;
};

export function buildRoutineMap(compilation, machineLayout, callTargets?): RoutineMap;
export function rollupFlat(entries: ProfileTouched[], routines: RoutineMap, opts): FlatRow[];
export function buildCallTree(edges: ProfileEdge[], routines: RoutineMap): CallTreeNode;
export function toFuse(entries, layout): string;          // D13 (1)
export function toCallgrind(tree, flat, meta): string;     // D13 (3)
export function toSpeedscope(tree, meta): object;          // D13 (4)
```

- All functions are pure and have no React, so G5.6 (the CLI) and KSX can use them.
- The CSV writer is shared with the trace export's `csv.ts` (T6 formula guard included).

### 4.2 Core (G5.4 additions to `z80-profile.c`)

```c
typedef struct { uint32_t calleePhys; uint16_t calleeAddr, slotSp;
                 uint64_t start, child; uint16_t edge; uint8_t isInt, pad; } Z80ProfileFrame;
typedef struct { uint32_t callerPhys, calleePhys, calls, pad;
                 uint64_t inclusive, exclusive; } Z80ProfileEdge;   // aligned to 32 B
static Z80ProfileFrame z80ProfileStack[256];
static Z80ProfileEdge  z80ProfileEdges[16384];
```

- The header gains `callsOn`, `depth`, `stackResyncs`, `depthOverflows` and `edgesDropped`.
- The new exports are `z80ProfileGetEdgesOffset` and `z80ProfileGetStackOffset`.
- All new statics are volatile.

### 4.3 Renderer

- `ProfilerPanel.tsx` (document `$profiler`), with tabs from existing primitives and its view models
  in `src/renderer/features/profiler/`.
- `ProfileCommands.ts`.
- The Debug menu gets Start/Stop Profiling and Show Profiler.
- The inlay hint provider is registered in the asm and BASIC language providers, behind the
  setting.

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 1 | Flat rollup (pure), D7 procedures, D8 sjasmplus fixes | `node` tests: routine maps from Klive asm (`.proc`, labels, modules), sjasmplus SLD fixtures (labels, pages) and Klive BASIC callables; rollup of a synthetic profile; Fuse export golden; the Execution History shows sjasmplus labels |
| 2 | Call tracker in `z80-profile.c` on the 48K and the Next; edges export | Core tests: nested calls give exact inclusive/exclusive times; T1 dispatch, T2 `RST 8`, T4 IM 2, D10 resync on `LD SP`; recursion; overhead measured (T8) |
| 3 | Remaining cores (wiring only) | Per-core smoke test: a CALL/RET program gives one edge with the right time |
| 4 | `$profiler` document, commands, menu | `jsdom` tests of the view models; commands with a faked Emu API; `profile start -at/-until` window on a 48K e2e test |
| 5 | Callgrind and speedscope exports, inlay hints, docs | Callgrind parsed by a minimal reader in tests (`fn`/`cfn`/`calls` consistency); speedscope JSON validated against its schema; docs page `working-with-ide/profiler.mdx`; §7 updates |

---

## 6. Tests

- **Pure** (`test/common/profile/`): routine maps, rollup, call tree, every exporter (goldens).
- **Core** (`test/wasm/profile/`, e2e tier): tracker semantics (T1–T5), per-core smoke tests.
- **Assembler** (`test/z80-assembler/`): `.proc` extents, including nested procs and procs in
  modules and banked segments.
- **sjasmplus** (`test/sjasmp/`): SLD fixture parsing with `page`; label `type`.
- **UI** (`jsdom`): profiler view models; command parsing.

---

## 7. Effort and the standing rule

- **G5.3:** **S–M** (lower than the roadmap's M), because the coverage plan's module already
  measures time. About a week: the rollup, the D7/D8 fixes and the document.
- **G5.4:** **M–L**, about three weeks: the tracker and its edge cases, the call tree UI and two
  exporters. That is less than the roadmap's L, because the shadow-stack hook points already exist.

When each lands:
- mark it done in [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md);
- update [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) §2 (the
  "Unit tests / code coverage / profiler" row: flat and call-graph profiles, interrupts as roots,
  callgrind/speedscope export, which no other retro tool has) and §4 (W3);
- if the document introduces any new visual rule, record it in
  `.ai/ui-theming-intent-and-lessons.md`.

---

## 8. Questions (all answered, 2026-10-08: the suggested answers)

1. **Q1: One switch or two?** Suggested: the flat profile rides on coverage counters, and the call
   graph is a separate `-calls` switch (D1). The alternative, always tracking calls when profiling,
   is simpler UI but costs T8's overhead on every coverage run.
2. **Q2: Routine source priority** (D6). Is "nearest preceding non-local label" the right default
   for asm without `.proc`? The alternative is "only call targets seen at run time". It is more
   accurate for hand-written code, but needs the call graph on.
3. **Q3: Interrupts excluded from the interrupted routine?** Suggested yes (D11), with a toggle
   "Include interrupts in callers" for the rare case where the user wants wall-clock-inclusive
   numbers.
4. **Q4: Export formats.** Fuse, CSV, callgrind and speedscope are suggested (D13). Is a Klive JSON
   (`.kprof`) for reloading and diffing worth adding now?
5. **Q5: D8 ownership.** The sjasmplus label-type and SLD-page fixes are needed by G10.3 too. Do
   them here (suggested, because the profiler cannot roll up sjasmplus code without them), or land
   G10.3 first?
6. **Q6: Inlay hints in the editor** (D15). Suggested: in, but off by default. They are cheap, and
   they are what makes a profile actionable while editing.

---

## 9. Implementation notes (2026-10-08)

### 9.1 Where things are

| Part | Files |
| --- | --- |
| Call tracker, armed window | `src/emu/z80/wasm/z80-profile.c/.h` (header v2, 192 bytes), hooks in `z80.c`; exports in `scripts/z80-profile-exports.cjs` |
| Reader, Emu API | `WasmProfileReader.edges()` (open frames folded in), `IAccessProfileSource.setProfileCalls/armProfileWindow/readProfileEdges`, `startProfiling`/`stopProfiling`/`getProfileEdges`/`getProfileSlotOffsets`; `MachineController.startProfiling/stopProfiling`, `frameTicks`/`clockHz` in the status |
| Pure rollup and exports | `src/common/profile/routineMap.ts`, `profileRollup.ts`, `profileExport.ts` |
| D7, D8 | `common-assembler.ts` `processProcStatement` → `AssemblerOutput.procedures`, outline `"proc"` entries; `SjasmPCompiler.ts` `sldSymbols` (types, `isLocal`, page → partition), `ListFileItem.partition` |
| IDE | `ProfilerPanel.tsx`, `features/profiler/profilerModel.ts`, `profilerInlays.ts`, `ProfileCommands.ts`, Debug menu |
| Tests | `test/wasm/profile/sp48-calls.test.ts` (T1, T2, T4, T5, D2, D10, D12, open frames), a CALL/RET smoke test in every core's profile test, `test/common/profile/{routineMap,profileRollup}.test.ts`, `test/z80-assembler/proc-extents.test.ts`, `test/sjasm-int/sld-profiler.test.ts`, `test/commands/ProfileCommands.test.ts`, `test/renderer/profiler/profilerModel.test.ts`, `test/emu/profile-controller.test.ts` (the `-at`/`-until` window); running-app check `scripts/doc-shots/recipes/profiler.cjs` |

### 9.2 Measurements

- **T8: the call tracker costs 0.6%** on top of counters in a loop that is nearly all CALL/RET (300
  frames of the 48K, median of five), and nothing measurable with the ROM idling in BASIC. The gate
  was 10%. The edge cache in the parent frame makes a hot pair one compare.
- The running-app recipe checks the numbers end to end: in a frame loop where `Draw` calls `Plot` 200
  times, the table shows exactly 200 × Draw's calls for Plot.

### 9.3 Departures from the plan

- **The header grew to 192 bytes (version 2)** rather than taking new fields in place; the call
  tracker's fields start at offset 116. The edge is 32 bytes (§4.2's struct), so the table is 512 KB,
  not the 384 KB D12 quoted. It stops adding edges at 7/8 full, to keep linear probing short.
- **The hooks only note the event; the instruction's end settles it.** A CALL's own time is its
  caller's, a RET's its callee's, and SP and PC are final when the frame opens or closes. An
  interrupt's frame starts before its acknowledge, so a handler's cost includes it.
- **A frame carries its excluded interrupt time** (`excluded`) besides `child`: the D11 exclusion has
  to propagate to every frame the interrupt nested in, not only its parent. A push also closes the
  frames whose return slot it overwrote (a routine that dropped its return address and called on).
- **D10's resync is distance-based**: a push more than 512 bytes below the open frame flushes the
  stack, and a RET or push that closed every frame by jumping more than 512 bytes counts as a switch
  too. `LD SP` is not hooked; the cheap check catches it at the next hook.
- **D2's markers live in the profile module, not in `DebugSupport`.** The fetch hook compares the M1
  address with the armed start and stop: no machine stop, no IDE round trip, deterministic. Markers
  are CPU addresses (unbanked), one-shot, disarmed when profiling turns off. An armed stop turns
  profiling off inside the core; the controller notices `windowClosed` at its next publish and
  updates the switch.
- **D4 needed a flag bit:** `PF_HALT` (bit 6) marks a byte where a HALT waited, so the flat profile
  moves that byte's time to the "HALT (waiting)" row. Bit 7 stays spare for branch coverage.
- **D5's frames are the total time over one frame's length** (`frameTicks`: `tactsInFrame` times the
  clock multiplier, or the Next's 28 MHz frame), not a count of frame ends: a one-pass window of a
  60-T loop then reads 0.0009 frames instead of 0 or 1.
- **D6:** the Klive assembler stores names lower-case in a case-insensitive build, so a symbol now
  carries `writtenName`, and the routine keeps the name as written. sjasmplus output carries
  `sourceType: "sjasmp"`, which names the compiler in the header. The heuristic is as decided: a
  global label on a loop splits its routine, which the docs explain (use `` `loop`` or `.proc`).
- **D12's Call tree is the call graph expanded**: each row shows the edge from its parent with that
  edge's exact numbers; deeper rows show the callee's own edges, summed over all its callers. The
  speedscope export splits those below the first level in proportion to each caller's time (gprof's
  estimate), so its weights add up to the total.
- **D15:** the disassembly tooltip is shown whenever times are known, not behind the setting - it
  changes nothing visible. The inlay provider re-registers itself on new hints instead of firing
  `onDidChangeInlayHints`: Monaco 0.55's inlay controller adds that listener to a store it resets on
  every request yet remembers the provider as watched, so after a second request the event is lost.
  The hook throttles its reads (750 ms): a debounce never fired while the machine ran, because the
  profile moves every 10 frames.
- **New Emu API method `getProfileSlotOffsets`**: the profile offset each 8K slot maps to now, so the
  rollup places unbanked code where it runs. `getProfileSample` returns per-address time with counts.
- `nav` gained the `profiler` navigation reason (D14's `nav … -r profiler`).

