# ZX Spectrum Next Interrupt Debugging Plan

Status: **implemented, in review** (2026-11-18, branch `next-interrupts-debugging-plan`). All three
phases are built; §10 records what was built where it differs from the text below, and the answers
taken for §7.
Mockups: `dev/plans/next-interrupts/mockups.html` (open in a browser; every value is synthetic, the
timeline comes from a small daisy-chain simulation).
Background: the article *Interrupts: Fourteen Voices, Two Wires*
(`docs/content/en/under-the-hood/emulator-internals/next-interrupts.mdx`), core 3.02.01.

## 1. Goal

Make the Next's interrupt system **visible** in the IDE, so that the traps the article describes are
recognised in seconds instead of hours:

- "Why does my interrupt not fire?": a source is disabled, a higher one is still in service, the
  handler ended with `RETN`, the CPU is in IM 1 while hardware IM2 mode is on, the vector table has a
  hole, or a pulse was missed under `DI`.
- "Why is my raster split late or jittery?": how long a request waited and what it waited behind.
- "Where did the NMI go?": the arbiter's state, the chosen device and the stackless return address.

Three deliverables, in this order (each is useful alone):

1. **Interrupts side bar panel**: the state at a pause (§3).
2. **Interrupt Timeline document**: the events over time (§4).
3. **Interrupt stops**: breakpoints on interrupt events (§5).

Next only. Other machines' interrupt state stays where it is (Enterprise in the DAVE panel, TVC in its
video panel, the Spectrums in the Z80 CPU and ULA panels).

## 2. What exists today

The core already holds almost every value the panel needs, but nothing reaches the IDE as one state:

| Value | Where it lives in the core | Reachable from the IDE today? |
|---|---|---|
| Hardware IM2 mode, vector top bits, stackless flag | `zxnext-interrupts.c` `hwIm2Mode`, `im2TopBits`; NextReg `$C0` | only as NextReg `$C0` |
| Per source (14): enable, status, requesting, in service | `daisyEnabled[]`, `daisyStatus[]`, `daisyPending[]`, `daisyInService[]` | enables/status as NextRegs `$C4`-`$CA`; *requesting* and *in service* not at all |
| Last vector, `/INT`, pulse active | `lastInterruptVector`, `intSignalActive`, `intPulseOn`/`intPulseEnd` | `/INT` via the Z80 CPU panel |
| NMI arbiter state, chosen source, pending causes | `zxnext-nmi.c` `nmiState` (IDLE/FETCH/HOLD/END), `nmiSourceMf`, `nmiSourceDivMmc`, `nmiPending*` | no |
| NMI return address, stackless processed | `nmiReturnAddress`, `stacklessNmiProcessed`; NextRegs `$C2`/`$C3` | only as NextRegs |
| CPU IM, IFF1/IFF2, interrupt depth | `z80.c`; `Z80X(GetInterruptDepth)` | yes (Z80 CPU panel, Call Stack) |

Events (request, acknowledge, `RETI`, lost pulse) are not recorded anywhere. The frame-trace ring
(`zxnext-trace.c`) records memory mapping, not interrupts. The Call Stack already shows interrupt frames
and the Execution History already folds interrupt service spans.

## 3. Phase 1: the Interrupts side bar panel

Mockup tab 1.

### 3.1 Content

- **Mode**: pulse or hardware IM2 (`$C0` bit 0, with `$C0`'s value); CPU IM, IFF1, IFF2; `/INT`; the pulse
  bit (`$22` bit 7); the vector range (`$C0` bits 7-5) and the last vector; in IM 2 the table address
  `I×256 + vector base`, in IM 1 `$0038`.
- **Diagnostics** (a short list of messages, see §3.3).
- **The daisy chain**: one row per source in priority order (line, UART 0/1 Rx, CTC 0-3, the reserved CTC
  4-7 as one dimmed row, ULA, UART 0/1 Tx, then the expansion bus). Columns: index, source, EN, ST, state
  (*idle / requesting / acknowledged / in service*), vector, handler.
  - **Blocking**: the highest-priority source in service gets a divider under its row ("the sources below
    wait for its RETI") and the rows below it are hatched. This is the article's queue made visible.
  - **Handler**: in IM 2 with hardware IM2 mode on, the word at `I×256 + vector`, with its label when a
    symbol is known. Clicking it opens the disassembly there. `$0000`/`$FFFF`, or an address in ROM while
    the source is enabled, is flagged.
  - In pulse mode the state column shows only "status set", since there is no chain to show.
- **NMI**: arbiter state and chosen device; the allows (`$06` bits 3 and 4); the I/O trap (`$D8` bit 0);
  stackless (`$C0` bit 3); the return address (`$C2`/`$C3`).
- **Actions** (only while paused; each one is a normal machine write and shows in the NextReg write log):
  - **Ring** on rows that NextReg `$20` can request (line, ULA, CTC 0-3).
  - **Clear status** (write 1 to the source's bit in `$C8`-`$CA`).
  - Header actions: open the Interrupt Timeline; show the NextRegs (`$C0`-`$CE`) in the Next Registers panel.

### 3.2 Plumbing

The Copper panel's pattern (`dev/plans/COPPER_DEBUGGING_PLAN.md`):

- Core: `zxnextGetInterruptState(ptr)` fills one fixed struct in WASM memory (14 × 4 flags, mode, vector,
  pulse, NMI fields): one call across the boundary, not 60. **It must be side-effect free**: no
  `zxnextUartSync()`, no status latching. A unit test reads the state twice around no execution and
  checks the machine is byte-identical (a checkpoint compare).
- `InterruptState` type in `src/common/messaging/EmuApi.ts`; `getInterruptState()` on
  `IZxNextIdeMachine`, `ZxNextWasmV2Machine`, `MainToEmuProcessor` and `EmuApi`.
- The derivations (blocker, diagnostics, handler lookups) are a pure view model in
  `src/renderer/features/interrupts/interruptsViewModel.ts`, tested without rendering.
- Handler words are read through the existing memory read API in one batch (at most 14 words).
- Panel: `src/renderer/appIde/SideBarPanels/InterruptsPanel.tsx`, registered in `src/renderer/registry.ts`
  beside `nextCopperPanel` (`restrictTo: [MI_ZXNEXT]`, debug activity). Refreshes on `useEmuStateListener`.
- Built on `@renderer/controls/data`; a **converted state panel** (values in `--color-state-value`);
  widths in `ch` (M2), row heights from `rowSizes.ts` (M3). The state badges and the hatching use tokens
  (aliased at L4 if new), never literals. Update `dev/ai/ui-theming-intent-and-lessons.md` with what the
  hatching and the state badges teach.

### 3.3 Diagnostics

Each is a pure function of the state (plus the Call Stack), with a test:

| Id | Condition | Message (gist) |
|---|---|---|
| D-IM1 | hardware IM2 on, CPU in IM 0/1, any source requesting | "Only the ULA rings; the others wait for IM 2" |
| D-STUCK | a source in service, but the Call Stack has no interrupt frame for it | "Its handler most likely ended with RETN; it and everything below are blocked" |
| D-WAIT | a source requesting behind a source in service | "X waits behind Y" (info) |
| D-HOLE | an enabled source's handler word is `$0000`/`$FFFF`/in ROM | "The vector table entry is empty" |
| D-POLL | CTC/UART status set with its enable off | "Polled mode" (info) |
| D-LOST | pulse mode, ULA/line status set, no acknowledge since it was set (needs the Phase 2 ring; until then, omitted) | "Lost under DI" |
| D-NMI | stackless NMI in progress | the return address and where `RETN` will go (info) |

### 3.4 Done when

The panel shows the right state at every pause on the six scenarios of the mockup, each built as a
harness test program (`test/zxnext-hw/interrupts/`) that pauses at a known point and asserts on
`getInterruptState()`; the view model is unit-tested; `i18n:check`, `build:check`, `lint:renderer`
pass; a guide page `docs/content/en/guides/next/interrupts.mdx` with a generated screenshot
(`guides-*` doc-shot recipe).

## 4. Phase 2: the Interrupt Timeline document

Mockup tab 2.

### 4.1 Recording in the core

A small event ring in the core (`zxnext-int-trace.c`, its own buffer, not the 20 MB frame-trace ring),
written only while recording is switched on (off by default; the document switches it on). Record
(16 bytes): T-state (frame-relative, 32 bits), frame number, kind, source index, vector, PC, SP.
Kinds:

- `REQ`: a source's request (`zxnextInterruptsRequest`, including `$20` requests, marked as software).
- `ACK`: the acknowledge (`zxnextInterruptsAcknowledge`, and the pulse-mode acceptance) with the
  interrupted PC.
- `RETI`: the release (`zxnextInterruptsReti`), and `RETI-IGNORED` when not in IM 2.
- `RETN-ISR`: a `RETN` while a maskable source is in service.
- `LOST`: a pulse that ended while IFF1 was 0 (checked when the pulse ends).
- `NMI-REQ`, `NMI-TAKE` (with the device), `NMI-END`.

**Capacity is counted in events, not frames** (D8): **64K records, 1 MB**, still small next to the
20 MB frame-trace ring. How many frames that holds depends on the program, and the document says so:

| Program | Events per frame | Frames held |
|---|---|---|
| ULA and two line splits | about 10 | about 6,500 |
| Plus a CTC at 8 per frame and the UARTs | about 40 | about 1,600 |
| Sample playback, a CTC at about 15.6 kHz (312 interrupts, ×3 events) | about 940 | about 70 |

A frame whose oldest events the ring has already overwritten is shown as **partial** (the lanes start
where its first held event is) and is never counted in the latency table. The ring is
written by the core, read by TypeScript in one copy per pause or per refresh tick, like the Copper RAM.
Writes are guarded by one flag so a fast frame without recording pays one branch per event site.
Measure with `npm run benchmark:debug-host-loop` before and after (budget: no measurable change with
recording off).

### 4.2 The document

- **A view of 1, 2 or 4 consecutive frames** (default 1), paged frame by frame with ◀ ▶ so a pattern
  that drifts across a frame boundary stays in view; frame boundaries are drawn and labelled with the
  frame number. Swimlanes per source plus the main program; solid bar = running, hatched = in service
  but interrupted; ▲ request, ● acknowledge (red when late), ◆ `RETI`. Zoom inside the view: all, ¼,
  1/16. The time axis is T-states with beam lines (from the active timing).
- **The toolbar shows what the ring holds**: the first and last frame held, their count, and the ring's
  fill (for example "frames 1,135-1,204 (70) · 65,536 / 65,536 events"), so a short history is never a
  surprise.
- Event list and a selection pane: request/acknowledge/`RETI` times, beam position, latency, vector,
  interrupted PC, handler time. "Go to handler" and "Show in Execution History" (which already knows
  interrupt spans).
- **Latency table** over every complete frame held: per source taken/min/avg/max/jitter, judged against the
  article's budget (0-22 T for the running instruction plus 13 or 19 T of acknowledge).
- Opened from the panel's header action, from the command palette, and from the Debug menu.
- MVC split (`dev/ai/ui-mvc-guide.md`): the swimlane model (segments from events) is pure and tested.

### 4.3 Done when

Harness tests prove each event kind is recorded at the right T-state against the instruction-by-
instruction run, including nesting (the article's six-moment figure), `RETI` in IM 1, `RETN` in a handler
and a lost pulse; the document renders those runs; the slow tier is unchanged in time.

## 5. Phase 3: interrupt stops

Mockup tab 3. Follows the Copper and sprite breakpoints' precedent: a binding field on `BreakpointInfo`
(`interruptStop: { kind, source? , waitLimit? }`), shown in the Breakpoints panel, persisted like
other breakpoints, with conditions and log-only like the others.

Kinds: acknowledged (any source or one), lost, `RETN` ending a maskable handler, `RETI` outside IM 2, a
request waiting longer than N T-states, NMI taken (any device or one).

Per `src/emu/z80/wasm/README.md`, **the core decides whether to stop, TypeScript decides what the stop
means**: each kind is a new stop candidate in the core's debug loop, and
`test/wasm/debug-loop-equivalence.test.ts` gains cases proving the in-core run stops exactly where the
instruction-by-instruction run does. An acknowledge stop stops at the handler's first instruction.

Docs: a section in `docs/content/en/guides/next/next-breakpoints.mdx`.

## 6. Decisions (proposed; confirm or change)

| Id | Decision |
|---|---|
| D1 | Next only. Other machines keep their interrupt state in their existing chip panels. |
| D2 | A side bar panel for the state, a document for the history: the panel is cheap and answers most "why doesn't it fire" questions from one pause; timing questions need time. |
| D3 | The state comes from one side-effect-free core export, not from reading NextRegs (NextRegs do not show *requesting* and *in service*, nor the NMI arbiter's state). |
| D4 | The event ring is separate from the frame-trace ring and off unless the timeline is open or an interrupt stop that needs it exists. |
| D5 | Ring/Clear actions are real machine writes (through NextReg `$20` / `$C8`-`$CA`), only while paused. |
| D6 | Diagnostics are hints with a reason, never errors: every one names the evidence (the register, the address, the missing frame). |
| D7 | The panel is a converted state panel (`--color-state-value`). |
| D8 | The event ring is sized in events (64K), not frames: a frame-count ring would either waste memory on quiet programs or lose most of a sample player's frame. The document shows the frames actually held and marks a partly overwritten frame as partial. |

## 7. Questions for the project author

1. Panel placement: its own panel beside Copper, or a section of Next Registers? (Proposed: its own.)
2. Should Phase 2's recording be always on (cheap enough?) so the timeline can show what happened
   *before* it was opened? Measure first.
3. Should the expansion-bus interrupt get a row even though Klive emulates nothing on the bus?
   (Proposed: yes, dimmed, for completeness with the article.)
4. Is a "Ring" button acceptable, given that it changes the machine's state from a debug panel?

## 8. Effort (rough)

| Phase | Core | TS/UI | Tests/docs |
|---|---|---|---|
| 1 Panel | 0.5 day | 2 days | 1.5 days |
| 2 Timeline | 1.5 days | 2.5 days | 1.5 days |
| 3 Stops | 1.5 days | 1 day | 1 day |

## 9. When finished

A changeset (`feature`) for the whole plan in the commit that completes it; the comparison table (§2)
and gap table (§4) of `dev/plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` gain an "interrupt debugging"
line; all UI text through `t()` with translator context (`dev/ai/i18n-guide.md`).

## 10. As built (2026-11-18)

**Answers taken for §7** (change them in review): (1) its own panel, in the Machine info activity below Copper (moved there with Next Memory Mapping and Copper; the Next Registers side-bar panel was removed in favour of its document); (2) recording only
while the Interrupt Timeline is open, which the timeline's toolbar says; (3) the expansion bus has a
dimmed row saying "not emulated"; (4) Ring and Clear exist, only while paused, as real NextReg writes.

**Where it lives**

| Part | Files |
|---|---|
| Core: snapshot, event ring, stop watch | `zxnext-int-events.c` (new), `zxnext-interrupts.c` (`zxnextInterruptsSnapshot`, RETI/RETN/WAIT events), `zxnext-cpu.c` (ACK, NMI, END, LOST hooks), `zxnext-nmi.c` (`zxnextNmiSnapshot`), `zxnext.c` (exports, `Z80_DEBUG_LOOP_STOP`) |
| Types and decoding | `src/common/zxnext/interrupts/interruptState.ts`, `interruptStops.ts` |
| Machine and messaging | `ZxNextWasmV2Machine` (`getInterruptState`, `getInterruptEvents`, `setInterruptRecording`, `clearInterruptEvents`, `writeInterruptNextReg`, the debug loop's watch), `IZxNextIdeMachine`, `EmuApi`, `MainToEmuProcessor` |
| Panel | `SideBarPanels/InterruptsPanel.tsx`, `features/interrupts/interruptsViewModel.ts` |
| Timeline | `DocumentPanels/InterruptTimeline/`, `features/interrupts/timelineModel.ts`, `show-int-timeline` / `hide-int-timeline` |
| Stops | `BreakpointInfo.interruptStop`, `bp-set int:...`, the dialog's **Interrupt event** type, `DebugSupport.buildInterruptWatch` / `hasInterruptHit`, the Breakpoints panel's **Interrupt stop** group |
| Tests | `test/zxnext-hw/interrupts/interrupt-debugging.test.ts`, `test/wasm/zxNext/wasm-next-interrupt-stop.test.ts`, `test/debug/interruptStops.test.ts`, `test/debug/interruptViews.test.ts`, `test/commands/InterruptStopCommands.test.ts` |
| Docs | `docs/content/en/guides/next/interrupts.mdx` (screenshots: `dev/scripts/doc-shots/recipes/guides-interrupts.cjs`) |

**Differences from the text above**

- **An END event** joins the kinds: the handler returned to the address it interrupted (the core keeps
  a small stack of acknowledged handlers and their return SP). The timeline's bars run from ACK to END,
  so pulse-mode handlers ending in `EI; RET` and handlers ending in `RETN` get bars too; RETI stays a
  separate event because it is about the chain, not the handler.
- **ACK is recorded after the acknowledge cycle**, at the handler's first instruction, so latency is
  request to handler start. The record carries the **CPU speed** (flags bits 5-4): latencies and handler
  times are in the CPU's own T-states, frame positions in 3.5 MHz T-states (the frame's clock). At
  28 MHz a measured acknowledge latency is about 30 T (memory reads wait a clock).
- **The snapshot is 96 bytes**, with the I register and the 14 vector-table words peeked in the core.
- **D-STUCK compares the sources in service with the Z80 core's interrupt depth** (the same count the
  Call Stack shows), not with call-stack frames read separately. **D-DI** was added after the first run
  in the app: interrupts disabled outside any handler while sources wait (a handler that returned
  without `EI`). **D-POLL leaves the UART transmitters out**: their status is set whenever the buffer
  is empty.
- **Stops keep the in-core debug loop.** The core latches the first watched event; the latch is part of
  `Z80_DEBUG_LOOP_STOP`, so `ExecuteUntilStop` returns at the end of that instruction and `afterStep`
  asks `DebugSupport.hasInterruptHit` (hit counts, conditions, logpoints). No stop-table candidate was
  needed. `wasm-next-interrupt-stop.test.ts` checks the in-core and instruction-by-instruction runs stop
  at the same PC, T-states and SP.
- **A condition on an interrupt stop is an execution condition** (registers, memory, flags at the stop);
  `VAL` and `ADDR` mean nothing for it.
- **Several `int:wait` stops share the smallest limit** (the core keeps one limit); the dialog's hint
  says so.
- **The core's memory grew from 56 to 58 MB** for the 1 MB ring. Every new static is volatile, and the
  export contract classifies the new exports (`SetIntWatch`, `TakeIntHit`, `IntEventsSetEnabled`,
  `IntEventsClear` debug; `IntEventsGetCount`, `IntEventsGetEnabled` pure).

**Not done**: the debug-overhead benchmark with recording off (D4's budget) is to be run before the
merge; the timeline's event list shows the first 500 rows rather than a virtualized list.
