# Execution History Viewer Plan: A Shared History Recorder and the Next History Document

Status: **decisions recorded** (2026-10-06). D1–D17 are the decisions; the author answered all of
§8's questions (Q1, Q2, Q4, Q6 directly; Q3, Q5, Q7 by accepting the suggested answers). They are
folded into D6, D8, D13, D15–D17 and §1.2.

**Implemented (2026-10-07)** — see §9 for what was built, the measurements, and where the
implementation departs from the text below.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G4.1**, the history viewer on the Next:
  after a stop, list the last N executed instructions with registers, disassembly and source line,
  and jump to the source of any of them. Read-only.
- The **history recorder** itself, which this plan designs **once, for every core**: a shared C
  module next to the shared Z80 (`src/emu/z80/wasm/`), a shared TypeScript reader, and a
  record format whose only per-machine part is a 16-byte context block. G4.1 wires it into the Next
  only.

Follow-up plans that build on this one:
- [EXECUTION_HISTORY_ALL_CORES_PLAN.md](EXECUTION_HISTORY_ALL_CORES_PLAN.md) (**G4.2**) wires the same
  recorder into the 48K, 128K (Pentagon, Scorpion), +2E/+3E, Timex, Z88 and ZX80/81 cores. It adds
  no new design: a context encoder, a context decoder and tests per core.
- [LITE_STEP_BACK_PLAN.md](LITE_STEP_BACK_PLAN.md) (**G4.3**) moves a "history cursor" through the
  same records and shows the historical registers in the CPU panel and the editor.
- **G4.5 trace export** is a small follow-up: the decoder in §4.4 already produces everything a text
  or CSV line needs. It is not planned here.
- **G4.4 full reverse debugging** does not depend on this recorder. It needs checkpoints and
  deterministic re-execution. The history ring will be its index ("which instruction is step −N?"),
  so the record keeps a monotonic sequence number and a frame/tact timestamp for that purpose.

Not in scope: changing the Next's diagnostics **frame trace** (`zxnext-trace.c`). §3 trap T1
explains why it is not reused.

---

## 1. What is being added, and why

"How did I get here?" is the question a breakpoint stop most often raises, and DeZog's execution
history is the feature its users praise most (competitive analysis §4, W2). Klive answers it today
only with the Call Stack panel, which reads 16 words above SP (`Z80MachineBase.getCallStack`,
`Z80MachineBase.ts:532`) and knows nothing about the instructions that ran.

The roadmap's foundation note says "the data exists" on the Next. Research showed it mostly does not
exist **in a usable form**:
- `zxnext-trace.c` records 128-byte records into a **linear** 20 MB buffer that stops when full; it
  is not a ring, despite its comments.
- It records registers **after** the instruction, with no opcode bytes.
- It is off in every production path. Only tests and the harness README (`test/harness/zxnext/README.md:179`)
  enable it, around one frame at a time.
- Enabling it costs about 70 stores and 20 getter calls per instruction, and forces bus-event capture
  in fast frames (`zxnext-frame.c:23`).

What a history viewer needs is different: a **ring** of the most recent instructions, each with the
state **before** it ran and the bytes it executed, cheap enough to run during every debug session.
The shared Z80 (`src/emu/z80/wasm/z80.c`) is compiled into every core, so a recorder hooked there is
written once and serves G4.2 for free.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **A new shared recorder, not the frame trace.** `src/emu/z80/wasm/z80-history.c` is included by each core after `z80.c`, like `z80-condition.c`. The Next's frame trace stays as it is: a diagnostics tool (T1). |
| D2 | **The hook lives in `z80ExecuteCpuCycle`, not in the core wrappers.** The 48K-family wrappers execute one *cycle* per call, so a prefix byte, an interrupt acknowledge and a HALT repeat are separate calls (`sp48.c:720`); the Next wrapper loops prefixes but still sees INT acknowledges as calls of their own. Only the CPU knows where an instruction starts. New hook macros with empty defaults (§4.1), in the style of `Z80_BEFORE_OPCODE_FETCH`, cost nothing in a core that does not define them. |
| D3 | **A record is the state *before* the event.** Step −1 shows "this instruction, with these registers, is about to run", which is what the CPU panel shows at a breakpoint today, and what G4.3 needs. The state *after* record *n* is the state before record *n+1* (or the live state, for the newest). |
| D4 | **One 64-byte record format for every core** (§4.2): sequence number, frame and frame tact, event kind, flags, a repeat count, all Z80 registers (with WZ, I, R), the 4 bytes executed, and a 16-byte **machine context** that only the core and its TypeScript decoder interpret. |
| D5 | **The executed bytes are captured, not re-read later.** Byte 0 is `cpu.opCode` *after* the M1 fetch, so a DivMMC automap, a TR-DOS ROM page-in or a ZX81 forced NOP shows what the CPU actually decoded. Bytes 1–3 are peeked through the core's side-effect-free reader at the same moment (T3). Self-modifying code therefore reads correctly in history. |
| D6 | **A ring with a fixed, build-time capacity per core.** The Next gets **131,072 records (8 MB)**, which is roughly two frames at 28 MHz and about fifteen at 3.5 MHz; G4.2's 3.5 MHz cores get 65,536 (4 MB). The ring overwrites the oldest record; a 64-bit sequence counter keeps row identity stable across wraps (§4.2). |
| D7 | **The ring is volatile.** It is listed in each core's volatile symbols, so state files (`.kls`) and the Next checkpoint never capture it, and restoring a state **clears** it (that history belongs to another timeline). |
| D8 | **Recording happens only in debug sessions** (Q1). It is on while `MachineController.isDebugging` is true, i.e. after **Start with debugging** and during steps, and off otherwise. There is no setting and no "always" mode. Plain **Run** pays nothing, and pausing a plain Run shows no history. |
| D9 | **Clearing is explicit and narrow.** The ring is cleared on machine start from Stopped, reset, restart, state or snapshot restore, and checkpoint restore. It is **not** cleared on pause, continue or step: history runs across stops, which is the point. A **Clear** button empties it on demand. |
| D10 | **Coalescing of repeats.** Consecutive HALT cycles at the same PC become one record with a repeat count, so a game waiting for the frame interrupt does not flush the ring with 17,000 HALTs. The same mechanism is reserved for the ZX81's forced-NOP display runs (G4.2). |
| D11 | **One reader for all cores.** `src/emu/machines/history/WasmHistoryReader.ts` reads the header and records through the same export names on every core (`z80History*`), so G4.2 adds no reader code. |
| D12 | **A capability flag, not a machine-id list.** `MF_EXEC_HISTORY` in `common/machines/constants.ts`, set in `machine-registry.ts` for the Next now and for each core as G4.2 lands. Commands, menus and the document gate on it, so G4.2 lights the viewer up without UI changes. |
| D13 | **The viewer is a document, `$history`, "Execution History"**, like the Copper List: it is wide (address, bytes, disassembly, source, register changes) and benefits from a detail pane. There is no side-bar panel; revisit after use (Q2). |
| D14 | **Decoding is pure TypeScript.** `src/common/history/` holds the record decoder, the per-machine context decoders, the register diff and the call/return classifier that G4.3 reuses. No React, no Node; `node`-project tests. |
| D15 | **DMA holds are recorded on the Next** (Q5). A sixth record kind, `DmaHold`: when `zxnextCpuExecuteInstruction` returns early because the DMA holds the bus (`zxnext-cpu.c:356`), the Next calls `z80HistoryEvent(DmaHold)`. Consecutive holds coalesce like HALT (T6), so one burst is one record; the repeat count carries the held T-states (capped at 65,535, then a new record), and the context carries the DMA's source, destination and remaining length (§4.3). The row reads "— DMA held the bus for 3,072 T ($4000 → $C000, 0 left) —". G4.3 skips these records like INT records. |
| D16 | **Klive BASIC statement grouping is not in this plan** (Q7). It ships with G4.3's source-level step back (that plan's D12), which builds the statement-activation walk (`sourceStepBack.ts`) the grouping needs. In G4.1 the Source column shows the BASIC line of every instruction and clicking a row reveals it. |
| D17 | **The frame trace moves to a diagnostics build afterwards** (Q3). Not part of this plan: a follow-up compiles `zxnext-trace.c` only when `ZXNEXT_FRAME_TRACE` is defined, runs the trace's structural tests against that build, and documents it in the harness README. The production Next then shrinks from 40 MB to about 20 MB with the history ring included, and the freed space can enlarge the ring (for example 262,144 records, 16 MB, about four frames at 28 MHz). |

### 1.2 Out of scope, and the hooks left for later

- **Step back** (G4.3). The document's selection model is built so that G4.3 can bind the history
  cursor to the selected row (§4.6.4).
- **Trace export** (G4.5). The row formatter is a pure function, so an export command only needs to
  loop over it.
- **Memory history.** The record holds no memory writes. "What was at `$8000` back then?" is G4.4.
  Recording the instruction's data accesses (the 8-entry `z80AccessLog`) would make a later "who wrote
  this byte?" query possible. It is not reserved (Q4): the 16-byte context is the only extension point,
  and "who wrote this byte" belongs to G4.4 or a separate write log.
- **Klive BASIC statement grouping** (one row per executed statement): with G4.3 (D16).
- **The frame trace's 20 MB:** the diagnostics-build follow-up (D17).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Shared Z80 | `src/emu/z80/wasm/z80.c`: hook-macro defaults at `:24-93`; `z80ExecuteCpuCycle` at `:3215` with the NMI branch (`processNmi`), the INT branch (`:3240`, `processInt`), the HALT branch (`:3247`) and the M1 fetch (`:3255-3276`); `z80AccessLog` at `:205-217`. `z80-condition.c` is the precedent for a shared module included after `z80.c`. |
| CPU contract | `scripts/check-wasm-cpu-contract.cjs`, `test/wasm/wasm-shared-z80-cpu-contract.test.ts` |
| Next wrapper | `zxnext-cpu.c:341-444` `zxnextCpuExecuteInstruction`: DivMMC entry checks before the cycle (`:368-370`), the prefix loop (`:383-388`), the DMA early return (`:356`), the frame-trace call (`:442`) |
| Next memory peek | `zxnext-memory.c:282` `zxnextMemoryPeekMapped` |
| Next frame trace (unchanged) | `zxnext-trace.c`, `frameTraceLayout.ts`, exports at `zxnext.c:465-473` |
| Next build | `scripts/build-zxnext-wasm.cjs`: `ZXNEXT_VOLATILE_SYMBOLS` `:18-45`, `productionExports` `:60-420`, memory size `:426`. The shared-export precedent is `scripts/rzx-core-exports.cjs` (`RZX_VOLATILE_SYMBOLS`, `rzxExports`). |
| Next loader | `ZxNextWasmV2Loader.ts`: export typings `:122-130`, required exports `:518-526`, views `:752ff`, frame-trace view `:853` |
| Next checkpoint | `ZxNextWasmV2Machine.ts:654-701` cuts the frame trace out of the checkpoint (`memoryBeforeTrace`/`memoryAfterTrace`) |
| Next debug loop | `ZxNextWasmV2Machine.ts:734-899` `executeWasmV2DebugLoop`; fast frames `:540-544` → `zxnext-frame.c:17-29` |
| State files | `src/emu/machines/state/wasmLayout.ts`, `wasmStateImage.ts`; fingerprint in `scripts/wasm-layout.cjs:186` |
| Run modes | `MachineController.ts`: `start` `:349` (`isDebugging = false`), `startDebug` `:366` (`isDebugging = true`), steps `:644-700`, `run` `:1052` |
| Capability flags | `common/machines/constants.ts` (`MF_*`), `machine-registry.ts:307` (Next features) |
| Emu API | `common/messaging/EmuApi.ts` (`getCpuState` `:311`, `Z80CpuState` `:757`); handler `renderer/appEmu/MainToEmuProcessor.ts` (`getCpuState` `:601`) |
| Source mapping | `renderer/appIde/utils/source-location.ts`: `locateSource` `:37`, `listItemsAtPc` `:101` (pure, partition-aware) |
| Navigation | `renderer/appIde/IdeEventsHandler.tsx:182` `refreshCodeLocation` → `nav "<file>" <line>` |
| Disassembler | `renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts`; `allowExtendedSet` for Z80N (`:992`); the one-instruction pattern at `SideBarPanels/BreakpointsPanel.tsx:364`; `setAddressOffset()` |
| Document template | `DocumentPanels/CopperListPanel.tsx` (`createCopperListPanel` `:478`, `useEmuStateListener` `:88`); `common/state/common-ids.ts`; `features/documents/specialDocuments.ts`; `renderer/registry.ts` (`documentPanelRegistry` `~:404`); `appIde/commands/CopperCommands.ts` (`show-copper`); `appIde/IdeCommands.ts:167-170`; `main/machine-menus/zx-next-menus.ts:378` |
| Data primitives | `@renderer/controls/data` (`PanelHeader`, `DataRow`, `DataValue` with `changed`, `HexValue`, `EmptyState`, `PartitionPrefix`); `controls/data/registers.tsx`; `controls/VirtualizedList.tsx` |
| Refresh cadence | `renderer/appIde/useStateRefresh.ts` `EmuStateListener` (100 ms poll; immediate when paused) |
| Harness | `test/harness/zxnext/README.md` ("Adding a method"); `test/wasm/zxNext/` |

---

## 3. The traps

1. **T1: The frame trace looks reusable and is not.** It is linear (drops records once full and
   latches `overflow`), post-instruction, 128 bytes, opcode-less, and it forces bus capture in fast
   frames. Turning it into a ring would change a diagnostics tool that tests and the harness rely on,
   and would still cost several times the recorder below. It stays untouched; the new ring lives
   beside it. (Q3 asks whether the frame trace's 20 MB should later be reclaimed.)
2. **T2: An instruction is not a call to the wrapper.** In the 48K family one call is one CPU
   *cycle*: `DD`, `CB`, the displacement and the opcode of `DD CB d op` are separate calls, and
   so are an interrupt acknowledge and every HALT repeat. A wrapper-level hook would record prefix
   bytes as instructions. The recorder hooks the cycle and starts an instruction only where
   `cpu.prefix == PREFIX_NONE` at the M1 fetch (D2). A test executes `DD CB 05 C6` and asserts one
   record with all four bytes.
3. **T3: Capture the bytes after the fetch, through a peek.** The Next's DivMMC entry points and the
   128K's TR-DOS ROM page code in *at* an M1 fetch, and the ZX81 ULA feeds the CPU a NOP for
   display-file bytes. Peeking `PC..PC+3` before the fetch would record the wrong instruction.
   Byte 0 is `cpu.opCode` after the fetch; bytes 1–3 are read with `zxnextMemoryPeekMapped`, which
   has no side effects (no automap, no contention, no floating-bus sampling). The machine context is
   captured at the same moment, so it names the map the fetch saw. Tests: a `RST $08` that automaps
   DivMMC, and an instant entry point.
4. **T4: Registers must be captured before the fetch, but the bytes after it.** The M1 fetch
   increments R before the bytes are known. The recorder therefore works in two phases: *begin*
   stages the registers before `Z80_BEFORE_OPCODE_FETCH`, *commit* adds the bytes and the context
   after `Z80_AFTER_OPCODE_FETCH` and writes the record. A test compares every record's R with the R
   the CPU panel shows when stepping the same code.
5. **T5: Interrupts are events, not instructions.** `processInt` and `processNmi` push PC and jump
   without executing an opcode. They get records of kind `Int`/`Nmi` with PC = the interrupted
   address (the return address), and byte 0 = the data-bus vector for IM 2. The ISR's first
   instruction is the next record. Rows show them as separators, and G4.3's reverse step-over treats
   them as calls.
6. **T6: HALT floods the ring.** A HALTed CPU runs a 4-T cycle per call. Without coalescing, a
   48K game waiting for the interrupt writes ~17,000 records per frame. The recorder merges
   consecutive HALT cycles at one PC into one record (repeat count saturating at 65,535; a further
   repeat starts a new record). The Next's 28 MHz HALT is eight times worse.
7. **T7: The Next checkpoint copies linear memory.** `captureCheckpoint` copies everything except the
   frame trace. An 8 MB ring would be copied on every code-injection checkpoint and *restored* with
   it, resurrecting stale history. Generalise the cut: exclude **every volatile range** from the
   `klive.layout` section instead of the one hard-coded range. A test asserts the ring survives a
   checkpoint restore unchanged (it is cleared by the controller, not by the restore, D9).
8. **T8: The layout fingerprint changes.** Any new static changes the SHA-256 over the data symbols
   (`scripts/wasm-layout.cjs:186`), so Next `.kls` files saved by an earlier build will not restore.
   That is the existing per-build policy, not a regression, but the release note says so.
9. **T9: Memory headroom.** The Next is 32 MB; the frame trace takes 20 MB, and the `klive.layout`
   section's last volatile range ends near 23.2 MB, leaving about 8.7 MB (to be confirmed from the
   linker map in Phase 1). An 8 MB ring does not fit safely: raise the Next to **40 MB** (Q6, accepted; the alternative was
   65,536 records at 32 MB instead).
10. **T10: Frame and tact, not absolute tacts.** The 48K-family cores rebase their tact epoch
    (`sp48ShiftTactOrigin`); an absolute 64-bit tact in a record would need rebasing too. The record
    stores the core's frame counter and the tact within the frame. The decoder knows each machine's
    unit (the Next's frame position is in 28 MHz ticks).
11. **T11: The ring is read while the machine may be running.** The document reads only when the
    machine is paused (and on demand), never during a running frame, so there is no torn record.
    The read is by sequence number: if the requested sequence was overwritten between header and
    record reads, the reader returns "gone" instead of a newer record (a test wraps the ring between
    two reads).
12. **T12: Disassembling 131,072 rows.** The disassembler is async and built around memory sections.
    The document disassembles only the rows it renders, caches by `(address, bytes)`, and uses
    `setAddressOffset` over the record's 4 bytes. It never disassembles the whole ring.
13. **T13: A source line needs the partition.** On the Next the same address maps to different
    source in different banks. Each row resolves its partition from the record's context (the MMU
    slot for the PC), not from the live machine, then calls `locateSource(result, pc, undefined,
    {partition, machineId})`. A test pages two banks with code at the same address and checks both
    rows map to their own file.
14. **T14: The hook must stay free when disabled.** One predictable branch per cycle
    (`if (z80HistoryEnabled)`) is the budget. A performance-boundary test, in the style of
    `wasm-next-performance-boundary.test.ts`, asserts that a build with the hook and recording off
    runs within noise of the baseline, and that recording on costs at most **8%** in the debug loop
    (which already pays a TypeScript round trip per instruction).

---

## 4. Design

### 4.1 Hooks in the shared Z80

Three new macros in `z80.c`, each with an empty `#ifndef` default:

| Macro | Where in `z80ExecuteCpuCycle` | Recorder call |
| --- | --- | --- |
| `Z80_HISTORY_EVENT(kind)` | before `processNmi()` (kind `Nmi`), before `processInt()` (kind `Int`), in the HALT branch (kind `Halt`) | `z80HistoryEvent(kind)` |
| `Z80_HISTORY_BEGIN()` | before `Z80_BEFORE_OPCODE_FETCH()` when `m1Active` | `z80HistoryBegin()`: stage the registers |
| `Z80_HISTORY_COMMIT()` | after `Z80_AFTER_OPCODE_FETCH()` when `m1Active` | `z80HistoryCommit(cpu.opCode)`: add bytes and context, write |

`check-wasm-cpu-contract.cjs` learns the new macros, and the contract test asserts that a core which
defines one defines all three.

### 4.2 `z80-history.c` and the record

The core provides, before including it:
- `Z80_HISTORY_CAPACITY` (a power of two);
- `Z80_HISTORY_PEEK(address)`: a side-effect-free byte read through the current map (T3);
- `Z80_HISTORY_CONTEXT(uint8_t* out16)`: the machine context (§4.3);
- `Z80_HISTORY_FRAME()` and `Z80_HISTORY_FRAME_TACT()`.

Header (64 bytes): magic `"KHST"`, version (u16), record size (u16), capacity (u32), enabled (u32),
count (u32, saturates at capacity), write index (u32), newest sequence (u64), a "cleared" generation
(u32, bumped by every clear so the renderer can drop its caches), and spare bytes.

Record (64 bytes, little-endian):

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | sequence (low 32 bits; the header's 64-bit newest sequence and the ring position give the rest) |
| 4 | 4 | frame number |
| 8 | 4 | tact within the frame (machine unit) |
| 12 | 1 | kind: 0 instruction, 1 INT acknowledge, 2 NMI acknowledge, 3 HALT, 4 forced-NOP run (G4.2), 5 DMA hold (Next, D15) |
| 13 | 1 | flags: bit 0 IFF1, bit 1 IFF2, bits 2–3 IM, bit 4 interrupt pending, bit 5 opcode bytes truncated (peek crossed a non-readable region) |
| 14 | 2 | repeat count (1 for an ordinary record; held T-states for a DMA hold) |
| 16 | 2 each | PC, AF, BC, DE, HL, AF', BC', DE', HL', IX, IY, SP |
| 40 | 1 + 1 | I, R |
| 42 | 2 | WZ |
| 44 | 4 | executed bytes (byte 0 as decoded, T3); for INT, the IM 2 vector byte |
| 48 | 16 | machine context (§4.3) |

Exports (one shared list, `scripts/z80-history-exports.cjs`, used by every core's build script as
`rzx-core-exports.cjs` is): `z80HistoryGetHeaderOffset`, `z80HistorySetEnabled`, `z80HistoryClear`.
Everything else is in the header. The volatile symbols are the ring, the staged record and the
counters.

### 4.3 The Next's machine context (16 bytes)

| Offset | Field |
| --- | --- |
| 0–7 | MMU0–MMU7 (NextReg `$50`–`$57`) |
| 8 | port `$7FFD` |
| 9 | port `$1FFD` |
| 10 | port `$DFFD` |
| 11 | DivMMC port `$E3` |
| 12 | mapping flags: bit 0 DivMMC mapped at `$0000`–`$3FFF`, bit 1 Multiface paged, bit 2 Alt ROM, bit 3 ROM in slot 0/1 (vs RAM) |
| 13 | CPU speed (NextReg `$07` effective) |
| 14–15 | reserved |

A **DMA hold** record (D15) uses its own context layout, because the MMU state at a hold is already
in the neighbouring instruction records: bytes 0–1 the port A address, 2–3 the port B address, 4–5
the remaining block length, 6 the transfer direction and mode (burst/continuous), 7–15 reserved. All
are read through side-effect-free DMA getters. The record's PC and registers are those of the
instruction that is waiting.

`src/common/history/contexts/zxnextContext.ts` decodes it into the **partition of an address** (the same partition number
that the Next's `getPartition` override returns) and a short text for the
detail pane. Its key test: at random points of a running program, `partitionFor(context, a)` equals
the live machine's `getPartition(a)` for every slot.

### 4.4 TypeScript: reader, decoder, machine contract, Emu API

- `src/emu/machines/history/WasmHistoryReader.ts` (D11): `info()` (capacity, count, newest
  sequence, generation, enabled), `read(fromSequence, count): Uint8Array`, `clear()`,
  `setEnabled()`. It copies records out of linear memory and handles the wrap and the "gone" case
  (T11).
- `src/emu/abstractions/IExecutionHistorySource.ts`: the machine-side contract, implemented by
  `ZxNextWasmV2Machine` now and by each core in G4.2. A `historyMachineId` names the context decoder.
- `MachineController`: enables recording from `isDebugging` (D8) at the start of every
  `run`; clears per D9.
- `EmuApi`: `getHistoryInfo(): ExecutionHistoryInfo | undefined` and
  `getHistoryRecords(fromSequence, count): { info, records: Uint8Array }`, and `clearHistory()`.
  Handlers in `MainToEmuProcessor.ts` use an `isExecutionHistorySource()` guard, not
  `requireZxNextIdeMachine`, so G4.2 needs no new handler.
- `src/common/history/historyRecord.ts`: `decodeHistoryRecord(bytes, offset): HistoryRecord`.
- `src/common/history/registerDiff.ts`: changed registers between two consecutive states, with the
  flags broken out (`F: Z→1 C→0`).
- `src/common/history/flowKind.ts`: classifies a record as `call`, `rst`, `ret` (taken or not, from
  the next record's PC), `jump`, `int`, `nmi`, `other`. The viewer uses it for icons; G4.3 for reverse
  stepping.

### 4.5 Commands

- Commands (`appIde/commands/HistoryCommands.ts`):
  - `show-history` / `shhist`: open the document;
  - `history-clear` / `hclr`;
  - `history [n]`: print the last *n* rows to the output pane (the formatter G4.5 will reuse).
- Menu: **Debug → Execution History** (all machines with `MF_EXEC_HISTORY`), not the Next menu, so
  G4.2 does not move it.

### 4.6 The Execution History document

#### 4.6.1 Layout

- **Header strip** (`PanelHeader`): "12,345 of 131,072 recorded" · a recording indicator (on in debug
  sessions, D8) · **Clear** · **Follow newest** · a filter field.
- **Row list** (`VirtualizedList`, newest at the bottom, scrolled to it on every stop):

  | Column | Content |
  | --- | --- |
  | Step | `−1` for the newest, `−2`, …, matching G4.3's numbering |
  | Time | frame-relative tact; a frame boundary draws a hairline with the frame number |
  | Address | `PartitionPrefix` + address, from the record's context (T13) |
  | Bytes | the executed bytes, only as many as the instruction is long |
  | Instruction | disassembly with labels from the current compilation (T12) |
  | Source | `file.asm:123` when the address maps, otherwise empty |
  | Changes | the registers this instruction changed (`HL=8001 SP=FFFC Z↑`), from `registerDiff` |

  INT/NMI records render as separator rows ("— IM 2 interrupt, vector $FF —"); a HALT record reads
  `HALT ×1,203`; a DMA hold reads "— DMA held the bus for 3,072 T ($4000 → $C000, 0 left) —" (D15).
- **Detail pane** for the selected row: the full register set *before* and *after* (the next record,
  or the live CPU for the newest), with changed values marked through `DataValue`'s `changed` prop;
  the decoded context ("MMU 0:FF 1:FF 2:0A 3:0B …, DivMMC off"); the frame and tact.
- **Empty states:** "History is recorded only when the machine is started with debugging" (D8),
  "No history yet", and "This machine does not record history" (before G4.2).

#### 4.6.2 Interaction

- Click a row: select it and **reveal its source line** in the editor without stealing focus;
  Enter or double-click focuses the editor (the roadmap's "click to jump to source"). A row with no
  source reveals the address in the disassembly instead.
- Filter: an address or range (`$8000-$80FF`), a label, or free text over the instruction.
- Context menu: *Go to source*, *Show in disassembly*, *Show in memory*, *Copy row*, *Copy rows as
  text* (the G4.5 formatter), *Set breakpoint here*.

#### 4.6.3 Refresh

The document reads **on stop** (via `useEmuStateListener` while paused) and on scroll, by sequence
number, 512 records per page, and drops its caches when the header's generation changes. While the
machine runs it shows "Running — history updates at the next stop", because the ring changes faster
than any view could follow.

#### 4.6.4 Hook for G4.3

The selected row is a sequence number held in a small model (`historyViewModel.ts`, per
`.ai/ui-mvc-guide.md`). G4.3 binds the history cursor to it in both directions without changing the
view.

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 0 | Mockup `mockups/execution-history.html` (rows, separators, detail pane, empty states). | Reviewed with the author. |
| 1 | Measure the Next's real headroom from the linker map; settle D6/Q6. | Ring size and memory size recorded here. |
| 2 | `z80.c` hooks and `z80-history.c`, contract script and test. | The contract test passes for all cores (no core defines the hooks yet). |
| 3 | Wire the Next: context encoder, peek, exports, volatile symbols, memory size, loader views, generalised checkpoint cut (T7). | Harness tests (§6.1) pass; `machine-state-determinism` still passes; size check passes. |
| 4 | `WasmHistoryReader`, `IExecutionHistorySource`, controller enable/clear, Emu API, `MF_EXEC_HISTORY`. | Node tests for reader wrap and "gone"; an e2e test reads history after a breakpoint stop. |
| 5 | Pure modules: decoder, Next context decoder, register diff, flow kind, row formatter. | Node tests (§6.2). |
| 6 | The document, commands, menu, special-document registration and restore. | jsdom tests for the model; lint and type check clean. |
| 7 | Source mapping per row (T13), labels, filter, context menu. | Two-bank test passes; Klive BASIC rows map to statements. |
| 7b | DMA hold records (D15): the Next hook at the early return, coalescing, DMA getters, the row. | A burst and a continuous transfer each produce the expected hold records (§6.1). |
| 8 | Performance boundary (T14). | Disabled within noise; enabled ≤ 8% in the debug loop. |
| 9 | Verification in the running IDE (CDP), docs page, `.ai/ui-theming-intent-and-lessons.md` (row kinds, separators), competitive analysis §2/§4 and the roadmap. | Screenshot of a real stop with a populated history. |

---

## 6. Tests

### 6.1 Core (Next harness, `test/wasm/zxNext/` or `test/zxnext-hw/history/`)

- One record per instruction, including `DD CB d op` and Z80N `NEXTREG n,n` (4 bytes) (T2).
- Every record's registers equal the CPU state observed by single-stepping the same code (D3, T4).
- INT and NMI records: PC is the interrupted address; the ISR's first instruction follows (T5).
- HALT coalescing and saturation at 65,535 (T6).
- DivMMC automap at `$0008` and an instant entry point record the bytes the CPU decoded (T3).
- No instruction record while the DMA holds the bus; one coalesced `DmaHold` record per contiguous
  hold, with the held T-states and the DMA addresses and length (D15).
- Ring wrap: sequence continuity, count saturation, oldest-overwritten; the reader's "gone" (T11).
- Disabled recording writes nothing (header and ring unchanged after a frame).
- A checkpoint restore leaves the ring alone (T7); a state restore through the controller clears it
  (D9).
- `machine-state-determinism.test.ts` still passes with recording on.

These run a core, so they go in a folder `build/e2e-tests.ts` already globs (`test/wasm/**`), or are
added to `E2E_CORE_TESTS`.

### 6.2 Pure (`node` project)

Record decoding against hand-built bytes; the Next context decoder against `getPartition`
(fixtures captured in 6.1); register diff (flags broken out); flow kind for every call/ret/rst
variant, including conditional RETs (taken vs not taken via the next PC); the row formatter.

### 6.3 UI (`jsdom`)

The view model: selection by sequence, paging, cache drop on generation change, filter parsing, empty
states per machine and run mode.

---

## 7. Effort and risks

**Effort: M**, as the roadmap estimated, but with a different split: about a third in the core and
the recorder (which G4.2 then reuses), a third in the pure modules and the reader, a third in the
document.

| Risk | Mitigation |
| --- | --- |
| The hook slows the hottest loop of every core. | Empty defaults; one branch when off; a performance-boundary test per core (T14). |
| A wrong context makes a row map to the wrong source. | The `partitionFor` ≡ `getPartition` invariant test (§4.3). |
| 131,072 rows overwhelm the UI. | Paging by sequence, virtualised rows, disassembly per visible row only (T12). |
| The fingerprint change breaks users' `.kls` files. | Existing policy; release note (T8). |

---

## 8. Questions (all answered, 2026-10-06)

1. **Q1 — Recording default.** Debug sessions only, with no setting (D8).
2. **Q2 — Side-bar panel.** Document only; revisit after use (D13).
3. **Q3 — The frame trace's 20 MB.** It holds exactly one worst-case Next frame at 28 MHz (at most
   about 142,000 instructions of 4 T in a ~567,000-tick frame). It was built for the record-by-record
   parity check between the TypeScript and WASM Nexts (`9c56b7105`). The TypeScript Next is gone, and
   only structural tests reference the trace now. Move it to a diagnostics build in a follow-up (D17).
4. **Q4 — Data accesses in the record.** Not reserved (§1.2).
5. **Q5 — DMA marker rows.** Yes, as the `DmaHold` record kind, in this plan (D15, Phase 7b).
6. **Q6 — Next ring size.** 131,072 records, Next memory raised to 40 MB (D6, T9).
7. **Q7 — Klive BASIC statement grouping.** With G4.3's source-level step back, not here (D16).

---

## 9. Implementation record (2026-10-07)

### 9.1 Where things are

| Piece | Files |
| --- | --- |
| Hooks | `src/emu/z80/wasm/z80.c` (`Z80_HISTORY_EVENT/BEGIN/COMMIT`, no-op defaults, the record kinds); `z80-history.h` turns them on (one `if (enabled)` each) |
| Recorder | `src/emu/z80/wasm/z80-history.c`; exports and volatile symbols in `scripts/z80-history-exports.cjs` |
| Next wiring | `zxnext-cpu.c` (header include, the DMA-hold call), the end of `zxnext.c` (context, `Z80_HISTORY_PEEK3`, `zxnextHistoryDmaHold`), `zxnext-memory.c` (the slot-partition cache), `scripts/build-zxnext-wasm.cjs` (40 MB) |
| Contract | `scripts/check-wasm-cpu-contract.cjs` (`recordsHistory`, the machine macros, the exports) |
| Reader, contract, API | `src/emu/machines/history/WasmHistoryReader.ts`, `src/emu/abstractions/IExecutionHistorySource.ts`, `ZxNextWasmV2Machine` (source + generalised checkpoint cut), `MachineController` (`applyHistoryRecording`, clears), `EmuApi`/`MainToEmuProcessor` (`getHistoryInfo`, `getHistoryRecords`, `clearHistory`) |
| Pure modules | `src/common/history/` (`historyTypes`, `historyRecord`, `registerDiff`, `flowKind`, `historyRow`, `contexts/`) |
| Document | `ExecutionHistoryPanel.tsx` + `.module.scss`, `features/history/historyViewModel.ts`, `historyDisassembly.ts`; `HistoryCommands.ts`; Debug → Execution History |
| Tests | `test/zxnext-hw/history/` (core, §6.1), `test/common/history/` (pure, §6.2), `test/renderer/history/` (model, §6.3), `test/emu/execution-history-controller.test.ts` (controller on the real core), `test/wasm/zxNext/wasm-next-history.perf.test.ts` (T14), the checkpoint and contract tests, the harness self-test |
| Docs | `docs/content/working-with-ide/execution-history.mdx`, the command reference, `scripts/doc-shots/recipes/execution-history.cjs` |

### 9.2 Measurements

- **Phase 1 (T9).** Before this work the Next's last volatile static ended at about **31.1 MB** of the
  32 MB (the layer-capture and beam-preview buffers had grown since the plan's 23.2 MB estimate), so
  the 8 MB ring needed the 40 MB memory (Q6). With the ring the data ends at about **39.4 MB**.
- **T14.** Debug loop at 28 MHz, recording on vs off, interleaved rounds, minimum of each:
  **5.9–7.2%** (budget 8%). A fast frame with recording on costs about 12% (a plain Run never
  records, D8). Getting there took two changes: `Z80_HISTORY_PEEK3` (one mapping resolution for
  the three operand bytes, about 2%) and caching the eight slot partitions until
  `zxnextMemorySetPageInfo` changes the page tables (about 1.5%). What remains is mostly the
  64-byte store per instruction into an 8 MB ring. The "off" cost against a build *without* the
  hook was not measured: a test cannot build the core twice.

### 9.3 Departures from the text

- **The context's bytes 0–7 are the partition of each slot, not MMU0–7** (§4.3). ROM, DivMMC and Alt
  ROM overlay slots 0–1 whatever MMU0/1 say, so the raw registers could not reproduce `getPartition`;
  the partition can, and it is what source mapping needs (T13). Encoding: 0–223 a RAM page, 233–255 the
  negative partitions −23..−1, 224 none. The invariant test compares it with `getPartition` per slot.
- **`getPartition` itself ignores the DivMMC and Multiface overlays** (it reads the raw page offset, not
  `zxnextMemoryResolveReadOffset`), so while DivMMC is mapped the context says ROM for slot 0 - exactly
  as the live machine does. The context carries "DivMMC mapped" in byte 12. Fixing `getPartition` is a
  separate task (it changes breakpoints and source mapping too).
- **`Z80_HISTORY_CONTEXT` takes the kind** (`(kind, out16)`), and the recorder exposes
  `z80HistoryAppend`/`z80HistoryNewest` so a core can write its own event records (the DMA hold).
- **DMA holds** are recorded whenever `zxnextCpuRunDma` held the bus before an instruction (a whole
  continuous block runs inside one call; the early return happens only at a frame end). The context
  holds the source and destination addresses at the start of the hold (not port A/B), the bytes
  left, and the direction/mode/I-O flags in byte 6.
- **Sequence numbers keep counting across a clear**; a clear empties the ring and bumps the
  generation. The ring is aligned to the write index, not to `sequence % capacity`.
- **The checkpoint excludes every volatile range** of the layout stamp (T7), which also leaves out the
  layer captures and beam previews: the checkpoint shrank accordingly.
- **Click selects; double-click or Enter goes to the source** (§4.6.2). `nav` activates the source
  document, which would hide the history document in the same editor area on every click.
- **"Copy rows as text"** copies from the selected row to the newest (at most 10,000 rows).
- **The bytes-truncated flag** (bit 5) is defined but never set on the Next: its peek reads every
  address.
- **Not done:** the Phase 0 mockup (the document was built directly from §4.6); an NMI test in
  §6.1 (the INT path is tested; NMI shares the event code); the "records' R equals the CPU panel's
  R when stepping" test is the harness `registers()` comparison.
