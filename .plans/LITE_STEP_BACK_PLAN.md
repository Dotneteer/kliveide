# Lite Step Back Plan: Walking Backwards Through the Execution History

Status: **implemented** (2026-10-07); §9 records what was built, the T1 audit and what was deferred.
Drafted 2026-10-06. Depends on [EXECUTION_HISTORY_VIEWER_PLAN.md](EXECUTION_HISTORY_VIEWER_PLAN.md)
(G4.1). Works on every machine that [EXECUTION_HISTORY_ALL_CORES_PLAN.md](EXECUTION_HISTORY_ALL_CORES_PLAN.md)
(G4.2) has reached, with no extra work per machine. Decisions D1–D14 are **accepted** (2026-10-06);
§8's suggested answers were taken as given when the plan was executed (2026-10-07).

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G4.3**, DeZog's "lite" reverse debugging:
  step backwards through the recorded history and show the **historical registers and PC** in the
  CPU panel, the editor and the disassembly. **Memory and devices stay at the present.**
- Commands: **Step Back**, **Step Forward** (through history), **Reverse Step Over**, **Reverse Step
  Out**, **Reverse Continue** (to the previous breakpoint hit in history), and **Return to Present**.

Decision D2 of the roadmap makes G4.3 "a milestone on the way" to **G4.4** (full reverse debugging).
This plan therefore keeps the user-facing model (a cursor, the commands, the "historical" visual
state) independent of *how* a historical state is obtained. G4.4 will replace "read the record" with
"restore a checkpoint and re-execute to the record", and memory will stop being "the present"; the
commands, keys and visuals stay.

---

## 1. What is being added, and why

After a stop, G4.1's Execution History document lists what ran. G4.3 lets the user **be** at any of
those points: press Step Back and the CPU panel shows the registers before the previous instruction,
the editor's execution marker moves to its source line, and the disassembly follows. Repeated,
it answers "which path led here and what were the registers on the way?" without re-running the
program.

"Lite" means the memory and devices are not rewound. A record holds registers and the executed
bytes, not memory (G4.1 D4, Q4). Every view that reads memory therefore keeps showing the present,
and the UI must say so clearly. That honesty is the main design problem of this plan, together with
reverse stepping that stays correct across calls, interrupts and ring boundaries.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **A history cursor owned by the emulator side.** `MachineController` holds `historyCursor: { sequence, position } | null` (position 1 = the newest record, i.e. step −1; `null` = the present). Only a **Paused** machine can have a cursor. |
| D2 | **`getCpuState()` answers from the cursor.** When a cursor is set, `MainToEmuProcessor.getCpuState()` returns the record's registers, PC, interrupt flags and partition, plus `history: { position, sequence, frame, tact }`. The CPU panel, the editor's execution point (`MonacoEditor.refreshCurrentBreakpoint`), the code-location navigation (`IdeEventsHandler.refreshCodeLocation`) and the disassembly's Follow-PC all read `getCpuState()`, so they follow the cursor **without per-view changes**. Views that must not follow it opt out (D6). |
| D3 | **The store carries the cursor.** `emulatorState.historyPosition` (and the sequence) is dispatched with every cursor move, so IDE effects keyed on `execState` / `pcValue` re-run. `getCpuStateChunk()` reports the historical PC and tact, so `EmuStateListener` notices the change without a new mechanism. |
| D4 | **Navigation is a new Emu API call, not a `MachineCommand`.** `emuApi.navigateHistory(op)` with `op` = `back`, `forward`, `backOver`, `backOut`, `reverseContinue`, `present`, or `{ toSequence }`. `MachineCommand`s change the machine; history navigation never does. |
| D5 | **Any machine command returns to the present first.** Continue, Step Into/Over/Out, Run, Pause, Reset, Stop, and any register or memory edit clear the cursor, then act on the live machine. "Continue from here" in the past is impossible in lite mode; the UI says "Resumes from the present" on hover while a cursor is set. |
| D6 | **Memory-reading views stay live, and say so.** Memory, Watch, Disassembly *bytes*, the Next/ULA state panels and the Variables panel (Klive BASIC) show the present with a thin "present" banner while a cursor is set. The **Call Stack** panel reads memory above SP, which would be wrong for a historical SP: it shows the call stack **reconstructed from history** instead (D10), or "not available at this point" when the ring does not reach back far enough. |
| D7 | **The visual state is unmistakable and shared.** While a cursor is set: the editor's execution marker uses a distinct **historical** decoration (outlined, secondary accent, not the solid current-line fill); the CPU panel shows a header banner "History · step −42 · frame 1,203 · memory shows the present"; the status bar shows "⟲ History −42" with a click to return. The visual vocabulary is recorded in `.ai/ui-theming-intent-and-lessons.md`. |
| D8 | **Steps land on instruction records.** INT/NMI records are not stops: stepping back from an ISR's first instruction lands on the interrupted instruction, and the CPU panel banner says "entered by IM 2 interrupt". A coalesced HALT record is one stop, shown as `HALT ×1,203`. A ZX81 forced-NOP run (G4.2) and a Next DMA hold (G4.1 D15) are skipped like an interrupt record. When the history document collapses interrupt service (G4.2 D10; on by default for the ZX80/81), Step Back and Step Forward treat a whole INT/NMI … `RETI`/`RETN` span as one step, as Reverse Step Over does, so stepping back from ZX81 user code does not land in the ROM's NMI service. |
| D9 | **Reverse step over and out pair calls with returns by instruction kind, not by SP.** G4.1's `flowKind` classifies each record (call, rst, taken ret, int, nmi, …). Reverse Step Over from the instruction after a returned call walks back past the matching call; Reverse Step Out walks back to the call that entered the current routine. SP is only a consistency check, because `PUSH`/`POP`, `EX (SP),HL` and `LD SP,…` move SP without a call (T3). |
| D10 | **The historical call stack is computed from the records.** Walking back from the cursor with the same pairing gives the chain of active calls (each with its call site and return address). It is exact as long as the ring reaches the outermost call, and honest when it does not ("… earlier frames before recorded history"). |
| D11 | **Reverse Continue stops at enabled execution breakpoints** (address and partition, from the record's context) found in history. Hit counts are ignored. Logpoints neither stop nor print. A condition is evaluated against the historical registers when it reads **only registers and flags**; a condition that reads memory, ports, partitions or the frame counter cannot be evaluated in the past and is treated as **true**, with a one-time note in the output pane (T5). |
| D12 | **Source-level stepping back for Klive BASIC and SLD sources.** When the editor is source-stepping (`usesSourceStepping`), Step Back moves to the start of the previous **statement** that ran, using the same `SourceDebugIndex` as forward source stepping; Reverse Step Over/Out work on statements and BASIC procedures. The same walk also gives the Execution History document its *by statement* grouping (one row per executed statement, expandable to its instructions), which G4.1 deferred to this plan (G4.1 D16). (Q4 asks whether this is in the first release.) |
| D13 | **The history document and the cursor are linked both ways.** Selecting a row moves the cursor (when the machine is paused) and moving the cursor selects the row (G4.1 §4.6.4). |
| D14 | **The cursor reads its state through a historical-state provider.** `IHistoricalStateProvider` (`src/emu/machines/history/`) answers "the CPU state at sequence *s*" and says whether memory and devices are historical (`memoryIsHistorical`). G4.3's provider reads history records and answers `false`; G4.4's ([REVERSE_DEBUGGING_PLAN.md](REVERSE_DEBUGGING_PLAN.md)) restores a keyframe and replays to *s*, and answers `true`. The banners of D6 and the "resumes from the present" rule of D5 key off that flag, so they disappear when G4.4 lands without touching the views. |

### 1.2 Out of scope

- **Historical memory and devices** (G4.4).
- **Changing anything in the past.** No register edits, no "set next statement" while a cursor is set.
- **Reverse watchpoints** ("go back to the last write to `$8000`"): the records hold no writes
  (G4.1 Q4).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| CPU state API | `common/messaging/EmuApi.ts`: `getCpuState` `:311`, `getCpuStateChunk` `:697`, `Z80CpuState` `:757`; handlers `renderer/appEmu/MainToEmuProcessor.ts:601` and `:1421` |
| Refresh | `renderer/appIde/useStateRefresh.ts` `EmuStateListener` (100 ms poll; immediate when Paused) |
| CPU panel | `renderer/appIde/SideBarPanels/Z80CpuPanel.tsx` (`useEmuStateListener` `:28-30`); register widgets in `controls/data/registers.tsx`; `DataValue`'s `changed` prop (`controls/data/index.tsx:338, 373-376`) |
| Editor execution point | `features/editor/monaco/MonacoEditor.tsx`: `refreshCurrentBreakpoint` `:1757`, `createCurrentStatementDecoration`, `createCurrentBreakpointDecoration`, the effect at `~:421` (deps `breakpointsVersion, compilation, execState, hubVersion, sourceFrame`) |
| Code-location navigation | `renderer/appIde/IdeEventsHandler.tsx:47-55, 182` |
| Disassembly | `DocumentPanels/useDisassemblyRefresh.ts` (`createFollowPcMemorySections` `:139`, `setPausedPc`, `createBranchCpuSnapshot` `:86`); `DisassemblyRow.tsx:237` (`execPoint`) |
| Call stack | `SideBarPanels/CallStackPanel.tsx`; `debugger/source/SourceCallStack.tsx`, `call-stack-model.ts`; `Z80MachineBase.getCallStack` `:532` |
| Source stepping | `emu/machines/SourceStepDecision.ts` (`SourceDebugIndex` `:57`, `locateActivations` `:256`); `debugger/source/step-targets.ts` |
| Machine control | `emu/machines/MachineController.ts` (state setter `:209`, steps `:644-700`, `run` `:1052`); `abstractions/MachineCommand.ts`; `controls/ExecutionControls.tsx:170-220` |
| Commands and menus | `appIde/commands/MachineCommands.ts` (`em-sti`, `em-sto`, `em-out`, `stepCommand()` `~:190`); `main/app-menu.ts:300-306` (shortcut settings), `~:920-1000` (Debug menu) |
| State | `common/state/AppState.ts:160` (`emulatorState`) and its actions/reducer |
| Conditions | `common/utils/breakpoint-condition/` (`condition-parser.ts`, `condition-checker.ts`, `condition-bytecode.ts`; evaluation is in C, `src/emu/z80/wasm/z80-condition.c`) |
| History (from G4.1) | `src/common/history/` (`historyRecord.ts`, `registerDiff.ts`, `flowKind.ts`, `contexts/`); `IExecutionHistorySource`; `WasmHistoryReader` |

---

## 3. The traps

1. **T1: "Paused" is no longer one state.** Many IDE effects run on `execState === Paused` and read
   `getCpuState()`. With D2 they all see the historical PC, which is the goal, but some must not act
   on it: `revealNexBankForPc()` pages the NEX bank view to the historical bank (fine), while the
   breakpoint-hit handling and "stopped at" output must not re-fire on a cursor move. Audit every
   `execState`/`pcValue` consumer (a grep list is part of Phase 1) and classify each as *follow*,
   *present* or *ignore*; a test per class.
2. **T2: The disassembly shows present bytes at a historical PC.** If the code was overwritten since
   (self-modifying code, a reloaded overlay, a different bank now mapped at that address), the
   disassembly at the historical PC is not what ran. The disassembly compares the record's executed
   bytes with present memory at that address and, if they differ, marks the row "code has changed
   since" and shows the historical instruction in a tooltip. When the record's partition differs from
   the present one, Follow-PC shows the historical partition if the view can (it is paged memory,
   still present-time contents) and says so.
3. **T3: SP is not a call depth.** Reverse step over by "first earlier record with SP ≥ current SP"
   fails after a `POP` (SP grew), a `PUSH`, `EX (SP),HL`, `LD SP,HL`, a `JP (HL)` dispatch through a
   pushed address, or a `POP`+`JP` return. Pairing uses `flowKind` and a depth counter (D9); SP is
   checked only to detect an unbalanced pairing, in which case the step stops at the best candidate
   and the status bar says "call/return pairing uncertain here". Tests cover each idiom.
4. **T4: Conditional returns and calls.** `RET NZ`, `CALL C,nn` and `RST` decide by flags. Whether a
   RET was **taken** is known from the next record's PC (G4.1 `flowKind`); the newest record compares
   with the live PC. A test steps back over a not-taken `RET Z` as an ordinary instruction.
5. **T5: Conditions cannot see the past's memory.** The C evaluator (`z80-condition.c`) reads the
   live CPU and memory. Reverse Continue evaluates in TypeScript instead: a small pure evaluator,
   `common/history/historyCondition.ts`, over the parsed condition tree, for **register, flag and
   constant** nodes only. A tree with any memory, port, partition, bank or frame node is "not
   evaluable in history" (D11). A differential test runs random register-only conditions through both
   evaluators on the same registers and requires identical results.
6. **T6: The ring moves under the cursor.** While paused it does not, but a cursor must never survive
   a run: D5 clears it on every machine command. The cursor holds a **sequence number**, and every
   read checks it is still in the ring (G4.1 T11) and that the header's clear generation has not
   changed; otherwise the cursor is dropped and the views return to the present.
7. **T7: The start of recorded history.** Step Back at the oldest record, Reverse Step Out with no
   matching call, or Reverse Continue with no hit, stops at the oldest record with the status "Start
   of recorded history (131,072 instructions)". It never wraps.
8. **T8: Interrupts in the middle of a reverse step over.** An interrupt that fired inside the
   stepped-over call adds an INT…RETI pair inside it; one that fired *between* the instruction and
   the cursor appears as an INT record followed by the ISR. Reverse Step Over from the instruction
   after an ISR's `RETI` returns to the interrupted instruction (the INT record is a "call"). Tests
   cover both, plus an NMI on the Next and the ZX81.
9. **T9: Interrupt flags and the HALT state are part of the historical state.** The CPU panel shows
   IFF1/IFF2/IM and HALT from the record's flags, not from the live machine. The `opStartAddress`,
   last memory and I/O access fields of `Z80CpuState` are **not** in the record and are omitted
   (shown as "—") in history, rather than showing present values that look historical.
10. **T10: Source stepping back across statements.** A BASIC statement is many instructions, often
    with runtime-library calls in between. "Previous statement" is the nearest earlier record whose
    PC is a statement start of a *different* statement activation, skipping records inside library
    code (the "just my code" setting, `SETTING_EMU_JUST_MY_CODE`, applies as it does forward). The
    forward source-step tests in `test/kbasic/corpus` give the fixtures; `scripts/kbasic-ide-check.cjs`
    gains a step-back check.
11. **T11: Keyboard shortcuts collide.** The step keys are settings (`shortcuts.stepInto/Over/Out`,
    `stepOverLine`; `app-menu.ts:300-306`) with `Shift+F10/F11/F12` already taken. Step Back gets its
    own settings key, `shortcuts.stepBack` (proposed default `Ctrl+Shift+F10`), and so does Step
    Forward (Q3).

---

## 4. Design

### 4.1 The cursor and navigation (emulator side)

`src/emu/machines/history/HistoryCursor.ts`, owned by `MachineController`:
- `position` / `sequence` (D1), validated against the reader on every use (T6);
- `navigate(op)` implements the operations below with the pure walkers in §4.2 and returns the new
  position or a reason it did not move (T7);
- `clear()`, called first by every machine command and register/memory edit (D5), and on any change
  of the ring's clear generation.

Operations:

| Op | Moves to |
| --- | --- |
| `back` | the previous instruction record (D8) |
| `forward` | the next one; past the newest, the present (`null`) |
| `backOver` | as `back`, but a returned call (a taken `RET`/`RETI`/`RETN` just before the cursor) is skipped back to its call instruction (D9) |
| `backOut` | the call (or INT/NMI) that entered the routine containing the cursor |
| `reverseContinue` | the most recent earlier record at an enabled execution breakpoint (D11) |
| `present` | `null` |
| `{ toSequence }` | that record, from the history document (D13) |

### 4.2 Pure walkers (`src/common/history/`, `node` tests)

- `reverseStep.ts`: `stepBack`, `stepBackOver`, `stepBackOut` over a record source (an interface
  that reads by sequence, so tests can feed arrays and the emulator feeds the ring). Pairing by
  `flowKind` with a depth counter; SP as a consistency check (T3, T4, T8).
- `historicalCallStack.ts`: the active call chain at a cursor (D10).
- `historyCondition.ts`: the register-only condition evaluator (T5).
- `sourceStepBack.ts`: statement-level stepping over `SourceDebugIndex` (D12, T10).

The walkers read records in pages and stop after a bounded number of records per call (the whole
ring at most), so a pathological search cannot hang the emulator process.

### 4.3 Emu API and state

- `EmuApi.navigateHistory(op): Promise<HistoryNavigationResult>` (`{ position, sequence, reason? }`).
- `Z80CpuState.history?: { position, sequence, frame, tact, enteredBy?: "int" | "nmi" }` (D2, D8).
- `getCpuStateChunk()` includes the history position, so the listener refreshes on a cursor move.
- `emulatorState.historyPosition` and an action `setHistoryPositionAction` (D3).
- `getCallStack()` returns the historical call stack while a cursor is set (D6, D10), with a
  `historical: true` flag and an `incomplete` flag.

### 4.4 Views

| View | Behaviour while a cursor is set |
| --- | --- |
| Z80 CPU panel | Historical registers and flags (T9); banner (D7); values that differ from the **present** are marked with the existing `changed` treatment, so "what is different now" is visible at a glance. |
| Editor | Historical execution decoration on the source line (D7); the solid current-line decoration is removed; source-stepping mode marks the statement. |
| Disassembly | Follows the historical PC and partition; "code has changed since" marker (T2). |
| Execution History | The cursor row is selected and scrolled into view (D13). |
| Call Stack | Reconstructed from history (D10). |
| Memory, Watch, Variables, ULA, Next state panels | Present values; "present" banner (D6). |
| Status bar | "⟲ History −42" with a click to return to the present (D7). |
| Execution controls | Step Back / Step Forward / Return to Present buttons, enabled when the machine is paused and has history; forward steps and Continue carry a "resumes from the present" tooltip (D5). |

### 4.5 Commands, menu and keys

- IDE commands in `appIde/commands/HistoryCommands.ts` (beside G4.1's): `step-back` (`stb`),
  `step-forward` (`stf`), `step-back-over` (`stbo`), `step-back-out` (`stbu`),
  `reverse-continue` (`rcont`), `history-present` (`hpres`), `history-goto <-n | #seq>`.
- **Debug** menu: a "Reverse" group with the same items, enabled per machine with
  `MF_EXEC_HISTORY` and a paused machine.
- Shortcut settings `shortcuts.stepBack`, `shortcuts.stepForward`, `shortcuts.reverseContinue`
  (T11).

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 0 | Mockup `mockups/lite-step-back.html`: the CPU panel banner, the historical editor decoration, the status bar, the controls; agree D7 with the author. | Reviewed; Q1–Q3 answered. |
| 1 | Audit `execState`/`pcValue`/`getCpuState` consumers (T1) into a table in this plan. | Every consumer classified. |
| 2 | Pure walkers: `reverseStep`, `historicalCallStack`, `historyCondition` (with the differential test against the C evaluator), `sourceStepBack`. | Node tests (§6.1). |
| 3 | `HistoryCursor`, `MachineController` clearing (D5), `navigateHistory`, `getCpuState`/`getCpuStateChunk`/`getCallStack` overrides, store state. | e2e tests on the Next harness (§6.2). |
| 4 | Views: CPU panel banner, editor decoration, disassembly (T2), status bar, controls, Call Stack. | jsdom tests; lint clean; theming notes recorded. |
| 5 | Commands, menu, shortcut settings; the history document link (D13). | Command tests; menu items enabled per machine. |
| 6 | Source-level step back for Klive BASIC and SLD, and the history document's *by statement* grouping (D12) — or deferred, per Q4. | `kbasic-ide-check.cjs` step-back checks pass. |
| 7 | Verification in the running IDE on the Next and the 48K (CDP); docs page; competitive analysis §2/§4; roadmap. | Screenshots of a reverse step over and a reverse continue. |

---

## 6. Tests

### 6.1 Pure (`node`)

Reverse step, step over and step out over hand-built record arrays covering: CALL/RET, conditional
CALL/RET taken and not taken, RST, `PUSH`/`POP` inside a routine, `EX (SP),HL`, `LD SP,HL`, a
`POP`+`JP (HL)` return, nested interrupts, an NMI, an ISR between cursor and target, HALT records,
forced-NOP runs, and running off the start of the ring (T3, T4, T7, T8). The historical call stack
for the same fixtures. The condition evaluator, including the differential test (T5). Statement
stepping back over a Klive BASIC debug index (T10).

### 6.2 Machine (Next harness first, then the 48K; e2e tier)

A program with a known call tree runs to a breakpoint; then: Step Back *n* times equals the registers
seen by stepping forward *n* instructions from an earlier stop on an identical run; Reverse Step Over
lands on the CALL; Reverse Step Out lands on the caller's CALL; Reverse Continue finds the previous
hit of a breakpoint with a register condition, and treats a memory condition as true with the note;
any machine command clears the cursor; a state restore clears it.

### 6.3 UI (`jsdom`)

The CPU panel in history (banner, flags from the record, omitted fields, changed-vs-present markers);
the editor decoration switch; the status-bar indicator and its click; controls enablement.

---

## 7. Effort and risks

**Effort: M**, as the roadmap estimated: the walkers and the consumer audit are most of it; the
views are small because D2 makes most of them follow the cursor for free.

| Risk | Mitigation |
| --- | --- |
| A user mistakes present memory for historical memory. | Banners on every memory-reading view, the status-bar indicator, and the distinct editor decoration (D6, D7). |
| A view acts on a historical PC as if the machine had stopped there. | The consumer audit (T1) with a test per class. |
| Reverse step over picks the wrong call in tricky stack code. | Kind-based pairing with an SP consistency check and an explicit "uncertain" status (T3). |
| G4.4 needs a different model. | The cursor, the commands and the visuals are independent of how a state is obtained; G4.4 swaps the source of the historical state (and makes memory historical). |

---

## 8. Questions

Suggested answers, awaiting the author's confirmation (2026-10-06):

1. **Q1 — Visual treatment: the outlined secondary-accent marker plus banners, not a tint.**
   - A tint across the CPU panel and the gutter reads as "disabled" in the neutral data hierarchy.
     Under G4.4 it would also have to stay on while every panel is genuinely historical, which makes
     the whole IDE look tinted.
   - The marker and the status-bar indicator mean "you are in the past". They outlive the
     "memory shows the present" banners, which disappear with G4.4 (D14).
   - Colours come from `--accent-secondary-*` tokens, as `.ai/ui-theming-intent-and-lessons.md`
     requires.
2. **Q2 — Changed markers compare with the chronologically previous step.** This *revises* the
   earlier proposal ("compare with the present").
   - The marker then answers "what did the instruction just before this point do?": the
     registers that differ between record *n+1* (older) and record *n*.
   - That is what a forward debugger's changed markers mean, so it reads the same whichever direction
     the user is stepping. It also matches the history document's *Changes* column.
   - Compared with the present, almost everything is marked a few hundred steps back, so the marker
     stops saying anything.
   - The present value goes into each register's tooltip ("now: $8001").
3. **Q3 — Keys: the forward key plus Alt; all of them settings.**

   | Command | Key | macOS |
   | --- | --- | --- |
   | Step Back | `Alt+F11` | `Alt+F12` |
   | Reverse Step Over | `Alt+F10` | `Alt+F10` |
   | Reverse Step Out | `Alt+Shift+F11` | `Alt+Shift+F12` |
   | Reverse Continue | `Alt+F5` | `Alt+F5` |
   | Step Forward | `Alt+Shift+F10` | `Alt+Shift+F10` |

   - **Return to Present** has no default key; it is reachable from the toolbar, the status bar and
     the `history-present` command.
   - **Why "+Alt" and not the earlier `Ctrl+Shift+F10`.** One rule is easier to remember than a list.
     It is also collision-free in Klive, where `Shift+F5` (Pause), `Ctrl+F5` (Start with Debugging),
     `Shift+F10` (Step Over Line) and `Shift+F11`/`Shift+F12` (Step Out) are already taken, and
     `Ctrl+Shift+F11` would clash with "Step Out + Ctrl".
   - **Linux.** GNOME binds `Alt+F5`, `Alt+F7`, `Alt+F8` and `Alt+F10` to window actions, so on
     Linux the defaults use `Ctrl+Alt+` instead.
   - New settings keys: `shortcuts.stepBack`, `stepBackOver`, `stepBackOut`, `reverseContinue`,
     `stepForward`, read where `app-menu.ts:300-306` reads the forward ones.
4. **Q4 — Source-level step back (D12) is in the first release, for Klive BASIC and SLD sources.**
   - With source stepping on, an *instruction* step back from a BASIC statement lands in runtime-library
     code almost every time. To a BASIC user, step back would look broken.
   - Klive BASIC debugging is a headline feature, so it should not get the weaker version.
   - It also brings the history document's *by statement* grouping (G4.1 D16).
   - Fallback if it slips: ship G4.3 with step back **disabled** while source stepping is on (with a
     tooltip saying why), rather than shipping the instruction-level behaviour there.
5. **Q5 — A condition that cannot be evaluated counts as true, and the stop says so.**
   - **Over-stopping is the safer failure.** A false candidate is visible and one more Reverse
     Continue moves on. Skipping the breakpoint could silently miss the real hit, and the user would
     never know.
   - **How it is reported.**
     - The output pane notes it once per breakpoint and command.
     - The stop is labelled "condition not checked: it reads memory, which is not historical in lite
       mode".
     - The Breakpoints panel marks the row for the duration of the history visit.
   - **Temporary by design.** G4.4 makes memory historical, so every condition is evaluated there and
     this rule disappears with the lite provider.

---

## 9. Implementation record (2026-10-07)

### 9.1 Where things are

| Part | Where |
| --- | --- |
| Walkers (§4.2) | `src/common/history/reverseStep.ts` - step back/forward, reverse step over/out, reverse continue, the historical call stack, `PagedHistorySource`. Statement-level stepping (D12) is the same walkers with an `isStop` that accepts statement entries (`SourceDebugIndex.entryAt`); no separate `sourceStepBack.ts` was needed. |
| Register-only conditions (T5) | `src/common/history/historyCondition.ts`; a zero divisor fails safe (stops), as the live `DIVZERO` does |
| API types | `src/common/history/historyNavigation.ts` |
| Cursor and lite provider (D1, D14) | `src/emu/machines/history/HistoryCursor.ts`, owned by `MachineController` (`historyCursor`, `navigateHistory`, `clearHistoryCursor`) |
| Emu API (§4.3) | `navigateHistory`; `getCpuState({ present })`; `Z80CpuState.history`; `CpuStateChunk.historyPosition`; `CallStackInfo.historical`; `MemoryInfo.history` (the disassembly's T2 check) |
| Store (D3) | `emulatorState.historyPosition` / `historySequence` / `historyMemoryIsHistorical`, `setHistoryPositionAction` |
| Reverse Continue's breakpoints | `DebugSupport.historicalExecBreakpoints` |
| Views | `debugger/history/HistoryBanner.tsx` (CPU band), `HistoryPresentBanner.tsx` (D6 band), `HistoricalCallStack.tsx`; the editor's `asHistoricalDecoration`; the disassembly's `historyExecPoint` / `historyCodeChanged` rows; the status-bar chip; three toolbar buttons |
| Commands, menu, keys (§4.5, Q3) | `HistoryCommands.ts`; the Debug menu's reverse group; `src/common/settings/reverse-shortcuts.ts` |

**Interrupt pairing.** Reverse step over/out and the call stack treat a complete interrupt service
(G4.2's `serviceSpans`) as one opaque step rather than pairing INT with RETI by kind. That copes with
the ZX81's NMI service, which leaves by `JP (HL)`, and keeps an ISR's own calls out of the depth count.

### 9.2 The T1 audit

| Consumer | Class | What it does in the past |
| --- | --- | --- |
| `Z80CpuPanel` | follow | the record's registers, the band, changed-vs-previous-step washes, "Now:" tooltips, unknowns as `--` |
| `MonacoEditor.refreshCurrentBreakpoint` | follow | historical decoration; the present's source stop, step-into targets and frame marker are left out |
| `IdeEventsHandler.refreshCodeLocation`, `revealNexBankForPc` | follow | re-run on `historyPosition`; the present's source stop report is not used |
| Disassembly Follow-PC (`getMemoryContents`) | follow | `history.pc`; branch verdicts get the record's registers and no stack reads |
| `BreakpointsPanel` (row at PC) | follow | marks the breakpoint at the historical PC |
| `useNexLiveBank` | follow | pages the bank view to the historical PC (present contents) |
| `CallStackPanel` | follow (rebuilt) | `HistoricalCallStack`, never the memory above SP |
| Execution History document (`liveRegs`), `history` command | present | `getCpuState({ present: true })` |
| `em-pause`/`em-stop`/step commands' "at PC=" | present | `getCpuState({ present: true })`; the command then clears the cursor |
| Memory, Watch, Variables, ULA, Next registers, memory mapping, system variables, disassembly bytes | present | `HistoryPresentBanner` |
| Breakpoint-hit handling, "stopped at" output | ignore | keyed on `execState` only, which a cursor move never changes |

### 9.3 Verification

- `test/common/history/reverse-step.test.ts`, `history-condition.test.ts`, `history-navigation.test.ts` (node).
- `test/wasm/condition/history-condition-differential.test.ts`: 3,000 random register-only conditions, TypeScript against C.
- `test/emu/history-step-back-real-machine.test.ts` (e2e, 48K): step back reproduces the registers stepping
  forward produced; over, out, call stack, reverse continue with register and memory conditions; D5 and T6 clearing.
- `test/controls/LiteStepBackUi.test.tsx` (jsdom): the CPU band, controls, status-bar chip.
- `scripts/doc-shots/recipes/lite-step-back.cjs`: the running app on the 48K - a reverse step over and a
  reverse continue, verified in the DOM and photographed (`step-back-over.png`, `reverse-continue.png`).

### 9.4 Deferred

- **Phase 0's mockup** was not made: the Q1 treatment was built directly and checked in the running app.
- **The history document's *by statement* grouping** (D12, G4.1 D16) is not built; statement-level stepping is.
- **`scripts/kbasic-ide-check.cjs` step-back checks** are not written; statement-level walks are covered by the
  node tests only.
- **The Next (§6.2 "Next first")**: the e2e test and the recipe run on the 48K only. The cursor has no
  machine-specific code, but nothing has yet stepped back on the Next or the ZX81 in a test.
- **The Breakpoints panel marking a row whose condition was not checked (Q5)**: the note goes to the output pane only.

