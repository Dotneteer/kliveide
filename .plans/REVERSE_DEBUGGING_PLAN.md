# Reverse Debugging Plan: Keyframes, an Input Journal and Deterministic Replay

Handoff notes for a new session: [REVERSE_DEBUGGING_HANDOFF.md](REVERSE_DEBUGGING_HANDOFF.md).

Status: **Phase 6 done** (2026-10-08); **Phase 5 done** (2026-10-08); **Phase 4 done** (2026-10-08); **Phase 3 done** (2026-10-08); **Phase 2 done** (2026-10-08); **Phase 1 done** (2026-10-08); **Phase 0 done — GO** (2026-10-07). D1–D21 are the decisions
(2026-10-06); the author accepted the suggested answers to all §9 questions, folded into D2, D6, D11,
D12, D19 and D21. Phase 0 was a **spike with a go/no-go gate**, as the roadmap asks. Its measurements
are in §10; they revised D3, D4, D5 and T5 and added T15–T17. Phase 1's results are in §11; they
revised D7 and added T18–T20. Phase 2's are in §12; they revised D9 and D16 and added T21. Phase 3's are in §13; they revised
D5, D6, D18, T5 and T9. Phase 4's are in §14; they revised D10, D11, D17 and D20 and added T22. Phase 5's are in §15; they
revised D15 and D17. Phase 6's are in §16; they revised D11, D12, D13, D14, D17, T3 and T4. The phases after it are planned in less detail on purpose.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G4.4**, full reverse debugging: step back
  and reverse-continue with **exact memory and device state**, on every WASM machine.
- Also, because the same machinery makes them almost free:
  - **continuing from a point in the past**, either by replaying to the present or by forking a new
    timeline;
  - **reverse watchpoints**: "go back to the last write to `$8000`";
  - the **historical screen**.

Builds on:
- [EXECUTION_HISTORY_VIEWER_PLAN.md](EXECUTION_HISTORY_VIEWER_PLAN.md) (G4.1) and
  [EXECUTION_HISTORY_ALL_CORES_PLAN.md](EXECUTION_HISTORY_ALL_CORES_PLAN.md) (G4.2): the shared
  recorder, its sequence numbers and its record format.
- [LITE_STEP_BACK_PLAN.md](LITE_STEP_BACK_PLAN.md) (G4.3): the history cursor, the commands and keys,
  the walkers (`reverseStep`, `historicalCallStack`), and **D14's `IHistoricalStateProvider`**, which
  this plan implements a second time.
- [SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md](SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md) (G2.6): every
  core's whole state is one linear-memory image, and `test/wasm/state/machine-state-determinism.test.ts`
  proves that save → restore → run equals a straight run on every core. Its header names G4.4 as the
  reason that test exists.
- [RZX_PLAN.md](RZX_PLAN.md) (G2.7/G2.8): proof that input replay works on the Spectrum cores, and
  the "record from here takes over a playback" interaction this plan reuses for forking.

Not in scope: the C64 (TypeScript 6510, no WASM image). Saving a reverse-debugging session to disk is
also out of scope: it is roadmap item **G4.6** (D21).

---

## 1. What is being added, and why

G4.3 lets the user *look at* the registers of the past. G4.4 lets the user *be* in the past:
- every panel shows that moment: memory, Call Stack, Watch, the Next's sprites and Copper, the ULA,
  and the emulator screen;
- conditions that read memory evaluate correctly in reverse;
- the user can continue from that point.

The technique is the one rr and other record-and-replay debuggers use, adapted to an emulator,
which has the advantage that the whole machine is already deterministic data:

1. **Keyframes.** While debugging, capture the machine state periodically. Store it page by page, so
   pages that did not change are shared between keyframes.
2. **An input journal.** Record everything the host feeds into the machine, stamped with the exact
   point in the instruction stream where it arrived.
3. **Replay.** To reach sequence *s*:
   - restore the nearest keyframe at or before *s*;
   - run forward with the journal supplying the inputs, live input ignored, and audio and host side
     effects suppressed;
   - stop exactly at *s*.

Research for this plan (2026-10-06) established what makes this feasible in Klive, and what does not
yet exist:

| Needed | Exists | Missing |
| --- | --- | --- |
| Exact, complete state capture | ✅ `captureWasmImage` / `restoreWasmImage` copy linear memory; volatile ranges excluded; determinism test on every core | Page-level sharing; render buffers are captured as state (T5) |
| Deterministic cores | ✅ No host time or randomness in any C core. The Next RTC reads `Date` once at setup, then ticks from the emulated clock. The Z88 TIM and its empty-slot generator live in the image. | — |
| Knowing every host input | ◐ `MachineController.interruptRzx` is already called on tape change, disk change, code inject, register edit, memory edit and stop: a ready-made map | A journal; keyboard, joystick, mouse, Z88 card/flap and SD data are not in it (T2) |
| Stopping at an exact instruction | ◐ `UntilExecutionPoint` compares PC only (and ignores the partition on WASM paths); the instruction counters differ per core, and the Z88 and ZX81 have none | A stop-at-sequence primitive in C (D4) |
| Replay at speed | ✅ the cores run far faster than real time (ZX81 ~74×; Next 0.8–2.4 ms per 20 ms frame); `MachineController.unthrottled` exists | A core flag to skip audio (and possibly rendering) work (T9) |
| Suppressing host side effects | ◐ tape saves and disk write-back are revision-gated; choke points identified | A replay flag at those choke points (D12); the Next SD card (T3) |

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **Keyframes + journal + deterministic replay**, not an undo log. An undo log would have to journal the state change of every device (about 20 on the Next) and would break with every device change. Replay reuses the whole-image capture that is already proven deterministic on every core. |
| D2 | **Reverse debugging runs only in debug sessions**, like history recording (G4.1 D8). Starting with debugging starts a **timeline**: a base keyframe, an empty journal and a cleared history ring. Restart, reset, a state, snapshot or RZX load, code injection, and a machine or ROM change end the timeline. **It is on by default in every debug session** (Q1): its value is retroactive, because nobody knows they need it until the bug has happened. Setting `emuOptions.reverseDebugging` (default on) turns it off, and the status bar shows whether it is active. |
| D3 | **The timeline position is the history recorder's sequence plus a sub-index and a prefix phase.** The shared recorder (G4.1) counts every instruction-boundary event on every core. A position is `(sequence, sub, phase)`: `sub` counts the units already merged into a coalesced record (HALT cycles, Next DMA hold T-states, ZX81 forced-NOP fetches); `phase` is how far into a prefixed instruction the CPU is (0 at a boundary, 1 after CB/ED/DD/FD, 2 after DD CB/FD CB; within a record the order is 1, 2, 0). Phase 0 found that the phase is needed (T16): a frame can end, and a debugger step stops, between the cycles of one instruction. This is exact at every point where the host can touch the machine, including mid-HALT frame boundaries and a frame that ends inside `ED 78`. The per-core instruction counters are not used: their semantics differ, and two cores have none. A run of DD/FD prefixes stays in phase 1, so its cycles share a position (a known, pathological gap). |
| D4 | **Stop-at-position in C.** The recorder gains a *target* position. Every core's frame loop and `…ExecuteUntilStop` call `z80HistoryStopNow()` after each CPU cycle - also on the cycle that completes the frame - which marks the target *reached* in the history header and makes the loop return, the way the Next's frame loop already exits on an SD host command. The host reads the mark after each frame call. The fast path can then replay at full speed. A fast frame **continues a frame in progress** instead of beginning another (T17), so a stop leaves nothing to undo. The per-instruction TypeScript debug loop is only for the last few instructions, when breakpoints must be checked. |
| D5 | **Keyframes at frame boundaries, page-shared, at an interval set by replay cost.** The controller captures between `executeMachineFrame` calls. Phase 0 (§10) showed that a fixed *K* = 25 frames is right for the 48K (a 25-frame interval replays in 15-18 ms) but too long for the Next at 28 MHz (190 ms, step back p90 165 ms). *K* is therefore **adaptive**: the timeline takes a keyframe once the frames since the last one would cost about **100 ms** to replay, clamped to 5-50 frames - 50 on the 48K, 13 on the Next at 28 MHz, about 19 on NextZXOS. The cost of a frame is the cost at the base clock times the machine's clock multiplier (a frame at 28 MHz runs eight times the cycles). The base cost is measured, not guessed (Phase 3): at the second keyframe, and then at every 64th, the timeline replays the interval that just ended - which lands on the present, so the machine is unchanged - and times it. That replay also checks the live run against the keyframe (D9). A cost per *record* was tried first and failed: no replay runs while the session is live to measure it, and HALT-heavy code makes it vary tenfold. An image is split into 4 KiB pages. A page equal to the same page of the previous keyframe is stored as a reference, so each keyframe is a full page table over a pool of immutable, reference-counted pages. There is no base keyframe to rebase, and evicting a keyframe only drops references. Capture compares every page with its predecessor and costs 1.2-1.6 ms. A C-side dirty bitmap over the RAM write funnel was not needed (Phase 3: capture stays under 0.5% of the frame period over 10 minutes). |
| D6 | **A memory budget, not a time budget.** Setting `emuOptions.reverseDebugMemoryMb` defaults to **the smaller of 512 MB and 1/16 of physical memory** (256 MB on a 4 GB machine, 512 MB from 8 GB up), adjustable from 64 MB to 2 GB (Q2). Keyframes live in ArrayBuffers in the emulator renderer, outside V8's heap limit but inside the process. When the pool exceeds it, the oldest keyframes are evicted; the timeline start moves forward and the UI shows it. **No compression** (Phase 3): most of every keyframe is pages shared all the way back to the base keyframe, so compressing old pages would put a decompression of ~2,000 pages into every restore, and the budget already buys 2.5-10 minutes on the Next's worst cases and hours on the 48K. |
| D7 | **Journal at the core's export boundary.** Every call the TypeScript side makes into a core export that *changes* machine state goes through a journaling wrapper on `runtime.exports`, stamped with the current position: key status, joystick, mouse, tape mode/rewind/fast-load, media uploads, writes to memory, registers and ports, NextReg writes, SD responses, Z88 card/flap/battery, the clock multiplier, tacts. TypeScript writes straight into core memory (`memory.set` for tape, ROM and card uploads, the SD buffers) go through a journaled helper. A **contract** (`src/emu/machines/reverse/exportContract.ts`) classifies every export of every core as *pure*, *debug* (changes only volatile statics), *execution* or *journaled*; a contract test fails on an unclassified export, so a new input path cannot silently break replay, and it **calls every pure and debug export** of every core and requires the image to be unchanged, so a misclassified one cannot either. Whether a journaled call also *ends* the timeline (a user reset, a snapshot load) is the controller's policy (D2), not a class: the same `HardReset` is an ordinary journaled input when a program asks for it through NextReg `$02` (T11). |
| D8 | **Journal the effect, not the host event.** The emulated-keystroke queue, the Spectrum keyboard sync, the clock-multiplier read and the ZX81 auto-RUN typer all live in TypeScript outside the image. Their *effects* reach the core through journaled exports. During replay the TypeScript sources are muted and the journal supplies the effects, so state that lives outside the image does not matter. Muting drops every journaled call and direct write and counts them (the "input ignored" flash, D12). The TypeScript caches of what was last pushed (keyboard rows, audio rate, clock multiplier) are then stale, so returning to live calls the machine's `invalidateHostSync()` and the next frame pushes the live state again, journaled. |
| D9 | **Replay verifies itself.** When a replay passes a later keyframe's position, the live image's page hashes must equal that keyframe's. While the history ring still holds a record for the position being replayed, the recorder compares its would-be record with it (PC, SP, AF). A mismatch stops the replay with "Replay diverged at step −N", like an RZX desync (G2.7), and the timeline is cut there. A desync is treated as a bug with a test, never as a user error. Since Phase 2: a keyframe restore **rewinds** the ring when it still holds that point (`z80HistoryRewind`), so the recorded run's later records stay in their slots, and with `z80HistorySetVerify` on, the recorder compares each record it is about to write with the one in its slot (PC, SP, AF) and stops the frame loop on a difference. Cutting the timeline ends it; the machine stays where the replay stopped. |
| D10 | **The historical-state provider is replay.** `ReplayStateProvider` implements G4.3's `IHistoricalStateProvider`: restore keyframe, replay to *s*, report `memoryIsHistorical: true`. Every G4.3 banner then disappears, and every panel shows the past because the machine **is** in the past. Since Phase 4: G4.3's `HistoryCursor` takes a `HistoryReplayHook`; moving the cursor to record *s* calls `ReplayStateProvider.enter(s)`, which has the timeline put the machine where it was just before *s* ran (`Timeline.navigateTo`); clearing it replays back to the present. Where the machine cannot go (before the timeline's start, a desync), the cursor falls back to G4.3's lite view and the navigation result says why. The walkers keep the present's PC and SP from the provider. |
| D11 | **Continue from the past replays toward the present.** Continue, Step Into/Over/Out and Run-to from a past position run the machine with the journal supplying inputs ("**Replaying**", with the distance to the present in the status bar). Breakpoints are active. Live input is ignored, and the status bar says so. Reaching the end of the journal switches seamlessly to live. This is the default because it loses nothing and keeps Step Forward meaningful (Q3); a forking "Continue from here (take over)" can be added later if users ask. Since Phase 4: a debug run started while the machine is in the past is a *replay run* (`Timeline.startReplayRun`): the ring is rewound to the machine's position with verification on, the core's stop target is the next journal entry, and the 48K's and the Next's debug loops ask the core after every instruction (`z80HistoryCheckStop`, armed by `ExecutionContext.historyStopArmed`). The controller applies the entries there and goes live at the present; a breakpoint, a step or a pause before that leaves the machine in the past with the cursor on it. Since Phase 6: a replay run that stops older than anything the present's ring holds keeps the ring it regenerated, as a deep landing does (D17), instead of attaching a cursor the ring cannot hold - which had sent the machine back to the present. A frame command (the Next's SD card) is never processed while a replay runs: the journal answered it at its position. G4.3's rule that a machine command returns to the present first (its D5) now holds only while the machine is not itself in the past; a plain Run (no debugging) still returns first. |
| D12 | **Forking is explicit: "Take over here".** A command (and status-bar action) discards the future: journal entries, keyframes and history records after the position. Live input then resumes, as RZX's "record from here" does. These also fork after a confirmation: editing a register or memory in the past, or loading media. **Key presses (and joystick or mouse input) while replaying never fork** (Q4): keys reach the emulator panel by accident, and a fork is irreversible for tape saves. They are ignored *visibly*, as the status bar flashes "Replaying — input ignored · Take over here". Since Phase 6: until Phase 8's confirmation exists, edits and new media in the past return to the present first, as G4.3's D5 has them do: tape and disk changes, Z88 card changes and machine commands (the Z88's flap, battery and shift keys) - in the past the muted journal would drop them silently. `clearHistoryCursor` also leaves a past that has no cursor (a deep landing). `takeOverHere` is asynchronous: it awaits the SD revert (D14). |
| D13 | **Host side effects are suppressed during replay and undone on fork** (T3, T4). Tape-save publishing, disk write-back publishing, logpoint output, Z88 serial output, audio and frame-completed screen pushes are skipped while replaying. On fork: disk images are re-published from the restored in-core image; Next SD sectors written in the discarded future are restored from the SD undo log (D14); host files written by tape SAVE cannot be unwritten, so the fork confirmation lists them. Since Phase 6: the controller drops what a replayed frame produced for the host - `SAVED_TO_TAPE` and the pending disk changes (`discardReplayedHostEffects`) - rather than holding it, since publishing a replay's older sector contents after a return to the present would corrupt the file; to keep the present's own unpublished effects from being taken for a replay's, `TimelineOptions.beforeLeavePresent` publishes them before the machine leaves the present. Machines see a replay through `ExecutionContext.isReplayingHistory` (the Z88 holds its serial output back; the journal clears the core's buffer where the live run did). On fork, `ForkAwareMachine.republishDisks` hands every sector of the inserted disks to the write-back (the +3's `.dsk`, the Beta 128's `.trd`, within the file's geometry); host files are noted by position (`Timeline.noteHostFile`) and `forkPreview()` / `fork()` name the ones after the fork point. |
| D14 | **The Next SD card gets a journal and an undo log.** Sector reads in a timeline are journaled with their 512-byte data, so replay never re-reads a host file that later writes may have changed. A write first reads the old sector and journals it, then writes. On fork, the discarded future's writes are reverted in reverse order. During replay, writes are acknowledged from the journal without touching the host. Since Phase 6: the reads needed nothing new - the sector data already went through `writeCoreBytes` (Phase 1). The undo log (`SdUndoLog.ts`, owned by the `Timeline`, attached to the machine through `TimelineMachine.attachSdUndoLog`) keys each write by the journal index its acknowledgement was journaled at, the index a fork's journal truncation uses, so the two always agree; the old sector is read from the host just before the write (a failed read is logged as unrevertable). `fork()` returns the writes to undo, newest first, and the controller has the machine write them back (`revertSdWrites`); writes it could not undo are reported in the output pane. The Next's debug loop drops, on entry, a command the core no longer waits for. |
| D15 | **Reverse Continue scans forward.** To find the last breakpoint hit before *s*: replay the keyframe interval that ends at or contains *s* with breakpoints in *collect* mode (record hits, do not stop); take the last hit before *s*; if there is none, move one interval back. Then replay to that hit. Every breakpoint kind works: conditions reading memory, memory-write watchpoints, I/O, NextReg and Copper breakpoints. That gives **reverse watchpoints** ("last write to `$8000`") without new machinery. Since Phase 5: collect mode is a D11 replay run with an end limit (`Timeline.startReplayRun(limit)`), driven through the machine's own per-instruction debug loop with breakpoints active; every stop before the limit is noted with the controller's own stop description, and the run continues as a real Continue would. The intervals are the keyframes (transient ones included), searched from the machine's position backwards. Memory, I/O and NextReg stops spend their one-shots as a real stop does; the landing replay restores the breakpoint state of the keyframe it starts from (D16), which brings them back. |
| D16 | **Hit counts and one-shots are part of the timeline.** `DebugSupport` hit counters are captured with each keyframe and restored with it. A fast-path replay checks no breakpoints, so the live run also **logs every counted hit with its position** (`DebugSupport.onHitCounted`); a replay to *s* sets each counter to its keyframe value plus the logged hits up to *s* - exact, because the replay is the recorded run. One-shot breakpoints a keyframe had are restored with it, and so on a fork. Returning to the present restores the present's counters. |
| D17 | **The ring stays the present's.** A navigation replay rewrites the ring, and when it starts from a keyframe older than the ring's oldest record the recorder restarts it and the records land in other slots (T22). So the timeline snapshots the present's whole ring when it leaves the present and puts it back after every navigation replay (4-8 MB, 1-2 ms): the history document, G4.3's walkers and the historical call stack keep the whole recorded run, future rows included - no "not in history" rows. A replay run (D11) and a fork rewind the ring to the cursor, which the ring always holds, and record from there. **A landing older than anything the present's ring holds** (a Reverse Continue hit several intervals back, D15) keeps the ring the replay regenerated - it ends at the landing - as the history views' ring (`Timeline.landAt`): there is no cursor, the machine itself is the point shown, Step Back walks that ring, and Return to Present replays back. Since Phase 6: the same holds for a replay run (D11) that stops that far back (`pauseReplayRun`). |
| D18 | **The emulator screen shows the past.** After a replay stops, the screen shows the core's pixel buffer as it is at that instant: a partly drawn frame mid-frame, as on real hardware. When G3.7's beam overlay exists it marks the beam position. Keyframes keep the picture and the Next's layer buffers (T5), so the bottom of a half-drawn picture is the previous frame's after any replay, and the layer views show the past too. |
| D19 | **One mechanism for every WASM core**, enabled per machine with `MF_REVERSE_DEBUG` after that core passes the journal-replay determinism test (§6). Order: the Next and the 48K first (the G4.3 test pair), then the G4.2 order: 128K family, +3E, Z88, ZX80/81 (Q5). The Z88's unusual inputs need no earlier slot, because Phase 1's export contract classifies every export of every core up front. |
| D20 | **The keys and commands are G4.3's.** Step Back, Step Forward, Reverse Step Over/Out, Reverse Continue and Return to Present keep their names and shortcuts. Only "Return to Present" changes meaning: it replays to the end of the journal. "Take over here" is the one new command: `history-take-over` (`htake`), Emu API `takeOverHere`. Step Forward stays G4.3's walker over the (whole) ring, now with the machine replayed there; Step Into from the past is the D11 step. |
| D21 | **Saving a debugging session is G4.6, a separate roadmap item** (Q6), planned once G4.4 works on at least two cores. It writes the keyframes and the journal (including the SD sector data) to a file, so a bug repro replays with the debugger attached. The first keyframe is effectively a `.kls`, so a recording replays only on the same build: fine for bug reports, not for archives. |

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| State image | `src/emu/machines/state/wasmStateImage.ts`: `captureWasmImage` (~l.83-95, whole-memory `slice()` then zeroes volatile ranges), `restoreWasmImage` (~l.101-124, writes the gaps between volatile ranges), `stateMismatch` (l.52); `wasmLayout.ts`; `scripts/wasm-layout.cjs` (fingerprint, volatile list; the linker map is deleted after stamping) |
| Host state parts | `MachineStateParts.host` per machine, e.g. Next `{normalFrames, debugSteps, lastStopReason, sdCardInfoLoaded, lastRenderedFrameTact}` (`ZxNextWasmV2Machine.ts:598-638`); restores also invalidate syncs and clear audio and keystrokes |
| Next checkpoint | `ZxNextWasmV2Machine.ts:656-708` (`captureCheckpoint`, `tryRestoreCheckpoint`, `invalidateCheckpoints`); used only by code injection (`MachineController.ts:857, 882`) |
| Determinism test | `test/wasm/state/machine-state-determinism.test.ts` |
| Run loop | `MachineController.run` (l.1052-1289): frame execution, logpoint flush (1154), `frameCompleted.fire` (1176), keystroke emulation (1189), frame commands (1247-1253), throttle; `unthrottled` (l.256, loop at 1263) |
| Debug loops | sp48 `ZxSpectrum48WasmV2Machine.ts:821`; Next `ZxNextWasmV2Machine.ts:734`; Z88 `Z88WasmV2Machine.ts:479` and `z88ExecuteUntilStop`; ZX81 `zx8081ExecuteUntilStop` |
| Frame loops (stop checks go here) | `sp48ExecuteFrame` (`sp48.c`) and `zxnextFrameExecute` (`zxnext-frame.c`) have them since Phase 0, with the frame-in-progress rule (T17); still to do: the sp128/spp3e equivalents, `z88ExecuteUntilStop` (`z88.c:223`), `zx8081ExecuteUntilStop` (`zx8081.c:249`) |
| Existing input-event map | `MachineController.interruptRzx`, called from `MainToEmuProcessor.ts` 221 (tape), 528 (disk), 867 (inject), 1272 (register), 1376 (memory) and from `stop` (403) |
| Keyboard | Spectrum: `syncKeyboardToWasmV2` → `sp48SetKeyStatus` (`ZxSpectrum48WasmV2Machine.ts:775`), called at frame/loop entry (431, 839); `invalidateWasmV2Sync` after a restore (1103). Next/Z88/ZX81: direct, at any JS turn (`ZxNextWasmV2Machine.ts:1249`, `Z88WasmV2Machine.ts:991`, `Zx8081WasmV2Machine.ts:619`). Emulated keystrokes: `emulateKeystroke` (`ZxSpectrumBase.ts:425` and the hosts) |
| Joystick, mouse | Next `ZxNextWasmV2Machine.ts:1260, 1274`; Timex `TimexWasmV2Machine.ts:210`; renderer hooks `useEmulatorJoystick.ts`, `useEmulatorMouse.ts` |
| Tape | upload `ZxSpectrum48WasmV2Machine.ts:674`, controls 640-667, fast load in C (`zx-spectrum-tape.c:459`, blocked under RZX), `FAST_LOAD` re-pushed on every run (`MachineController.ts:1113-1114`) |
| Disks | +3 `ZxSpectrumP3eWasmV2Machine.ts:901-946`; Beta 128 `Beta128Disks.ts:59`, `ZxSpectrum128WasmV2Machine.ts:481, 494`; write-back `collectPendingMediaChanges` (`MachineController.ts:1170, 1416`) → `EmulatorPanel.saveDiskChanges` → main `saveDiskChanges` (`RendererToMainProcessor.ts:1320`) |
| Next SD card | `zxnextSdSetHostCommand` (`zxnext-sd.c:109`); `syncWasmV2StorageFrameCommand` (`ZxNextWasmV2Machine.ts:1713`); read/write via IPC (`RendererToMainProcessor.ts:950, 963`); responses `ZxNextWasmV2Machine.ts:1322-1362`; write invalidates checkpoints (1341) |
| Z88 | cards `Z88WasmV2Machine.ts:697, 707`; flap/battery `Z88WasmHost.ts:392`; serial TX `flushUartTx` (922) |
| Tape save output | `publishSavedTapeFromWasmV2` (`ZxSpectrum48WasmV2Machine.ts:719`, revision-gated) → `EmulatorPanel.tsx:306` |
| Breakpoints | `DebugSupport.ts` (`passesFilters`, `hits++` at ~1538, `takeLogLines` 1470); `resetHitCounts` (`MachineController.ts:836, 1079`) |
| Audio and screen | `EmulatorPanel.tsx:~293` (`renderMachineAudioFrame`, already skips for RZX rendering); `audioFrameRendering.ts:42` |
| RAM write funnels (for D5's optimisation) | `Z80_WRITE_MEMORY` (`z80.c:389`); sp48 `sp48-memory.c:77-139`; sp128 `sp128.c:802, 871, 1537, 1548`; spp3e `spp3e.c:1113`; Z88 `z88-memory.c:102, 254, 281, 316`; ZX81 `zx8081.c:120`; Next `zxnextMemoryWritePhysical` (`zxnext-memory.c:225`, reached by CPU and DMA) |
| From G4.1–G4.3 | `src/emu/z80/wasm/z80-history.c`, `WasmHistoryReader`, `src/common/history/`, `HistoryCursor`, `IHistoricalStateProvider`, `MF_EXEC_HISTORY` |
| From Phase 0 | `z80-history.c`'s positions and stop target (`z80HistorySetTarget`/`ClearTarget`/`GetSub`/`GetPhase`/`SetPosition`, header words 40-59); `src/emu/machines/reverse/` (`timelinePosition.ts`, `KeyframeStore.ts`, `InputJournal.ts`, `ReplayEngine.ts`: spike quality, used only by tests); `test/harness/reverseSupport.ts`; `test/wasm/reverse/journal-replay-determinism.test.ts`; `test/reverse/reverse-spike-measure.test.ts` (behind `KLIVE_REVERSE_SPIKE=1`); `KLIVE_WASM_MAP_DIR` in `scripts/wasm-layout.cjs` keeps a build's linker map for symbol attribution |

---

## 3. The traps

1. **T1: Input arrives at different granularities.** On the fast path, input lands at frame
   boundaries. In the debug loops it can land between any two instructions. On the Next, Z88 and ZX81,
   `setKeyStatus` writes the core at any JS turn. The journal stamps the **position** (D3) at the
   moment of the export call, and replay stops at exactly that position (D4) before applying it, so
   all three cases are the same case. A test journals key events in all three modes and replays them.
2. **T2: Inputs that bypass the obvious paths.** The audit found core-mutating paths that
   `interruptRzx` does not cover:
   - the Z88's `setKeyStatus`, which also wakes a snoozed CPU and may raise the key interrupt;
   - Z88 flap and battery custom commands;
   - the Next's joystick and mouse;
   - the clock multiplier, read from the store every frame;
   - `FAST_LOAD`, re-pushed on every run;
   - the Next's NextReg-`$02` reset, which TypeScript turns into `hardReset()` and a ROM re-upload;
   - Timex DOCK insert and eject;
   - `setTacts`.

   D7's export contract test is the answer: it does not rely on anyone remembering a list.
3. **T3: The Next SD card is outside the image.** Sector data comes over IPC from a host file, and
   writes go straight to it (`processWasmV2SdWriteFrameCommand`). A naïve replay would re-read sectors
   the future already overwrote, and re-write them. D14 journals reads, undo-logs writes, and fakes
   write acknowledgements during replay. The machine already *waits* for these responses at a
   deterministic instruction, which makes them easy to journal. Phase 1 found that the two paths
   disagree on that wait: the fast frame loop does not run while an SD host command is pending, but the
   TypeScript debug loop, which a pending frame command sends the machine into, runs on. Phase 6 makes
   them agree before it journals SD traffic. **Since Phase 6:** a stop right after the instruction that
   hands a command to the host (a step, a breakpoint) leaves it pending; on resume the debug loop
   re-reads the command from the core and returns without running anything, so the controller answers
   first. Before, it ran one more instruction, the answer was journaled one instruction late, and a
   replay - whose fast frames wait - could never apply it.
4. **T4: Host files written in the discarded future.** Disk write-back is a publish of the in-core
   image, so re-publishing after a fork restores the host file (D13). A tape SAVE produces a *new
   host file*; Klive will not delete user files, so the fork confirmation lists them instead. A replay
   must not publish its own re-done writes either: short of the present they are the past's contents,
   which would overwrite the present's file (D13, Phase 6).
5. **T5: Render and scratch buffers are captured as state.** On the Next about 3.5 MB of pixel,
   layer and raster-scratch buffers are not volatile, against 2 MiB of RAM. They change every frame,
   so every keyframe would store them. Phase 0 classified each one by restoring a keyframe with the
   buffer filled with garbage, replaying an interval and comparing byte by byte with the next keyframe
   (§10.3), and Phase 3 settled the list:
   - **Left out (frame-boundary scratch):** the 48K's `sp48AudioSamples` and the Next's
     `zxnextUlaSpriteCoverage`. The build scripts name them, the layout stamp carries them
     (`WasmLayout.scratch`, outside the fingerprint), and the T5 proof in
     `test/wasm/reverse/journal-replay-determinism.test.ts` restores every keyframe interval with them
     full of garbage and requires the next keyframe exactly.
   - **Read across the boundary - not scratch:** the beeper's transition buffers on both cores
     (`sp48AudioTransitionTacts/Mic`, `zxnextBeeperTransitionTacts`). Transitions not yet turned into
     samples carry over into the next frame. Phase 0's probe missed it because none of its workloads
     toggled the beeper; a Phase 3 test that did found it, and the proof's Next workload now plays a
     beeper burst every frame.
   - **Kept by choice:** the picture and the Next's four layer buffers. They are not read across a
     boundary, but a step back shows them half drawn (D18), and leaving them out needed a one-frame
     lead-in that doubled some replays and pushed the Next's step-back p90 past 150 ms. Keeping them
     costs memory (51-206 MB a minute on the Next's 28 MHz programs), which the budget can afford.
   Keyframes taken anywhere but a frame boundary (transient ones) keep the scratch too.
6. **T6: The recorder's sequence is volatile, by design.** The history ring is excluded from images
   (G4.1 D7). Each keyframe therefore records the recorder's `(sequence, sub)` in its metadata, and a
   keyframe restore sets the recorder to it explicitly. A test restores a keyframe and checks that the
   next record's sequence continues correctly.
7. **T7: Restores push live host state.** `loadMachineState` calls `invalidateWasmV2Sync`, and the
   next frame entry then pushes the *live* keyboard into the core. Restores also clear audio and the
   keystroke queue. Keyframe restores use a replay-aware path: no live sync, no keystroke queue, and
   host parts restored from the keyframe.
8. **T8: Hit counters and one-shots live in TypeScript.** `DebugSupport`'s counters would double-count
   on replay and change `hitCount`-mode stops (D16). They are part of keyframe metadata; a test replays
   through an `every 3rd hit` breakpoint and checks that it stops at the same hits.
9. **T9: Replay speed.** Cores always render pixels and audio samples; nothing skips them today.
   Phase 0 measured, with the recorder on (§10): the 48K replays a frame in 0.5-0.7 ms; the Next in
   5.3 ms on NextZXOS and 7.6-7.9 ms on programs that switch to 28 MHz (four times the instructions of
   the 2.4 ms the earlier estimate assumed). The recorder adds under 10% to a Next frame. That set D5's
   adaptive interval. A Reverse Continue scanning one emulated second backwards costs about 0.4 s on
   the 28 MHz Next. `replayQuiet` was not built in Phase 3: step backs meet the gate without it. It
   stays available if Reverse Continue over long ranges (Phase 5) feels slow. Rendering cannot simply be skipped where later emulation reads it
   (sprite collision, the Next's raster catch-up); T5's classification found no such read across a
   frame boundary, but within a frame it remains unmeasured.
10. **T10: Wall-clock flows.** Code injection's `WaitIdle`/`WaitKeyQueue` steps poll on wall time, so
    where injection continues is not reproducible. Injection ends the timeline (D2), so replay never
    crosses it.
11. **T11: Reset inside a timeline.** A jump to `$0000` is ordinary code and needs nothing. A reset
    the *program* requests through hardware, the Next's NextReg `$02`, is carried out by TypeScript
    (`hardReset()` and a ROM re-upload). Its uploads go through the journaled memory helper (D7), so
    replay repeats it. A user-initiated reset ends the timeline (D2).
12. **T12: Determinism is only as good as its test.** Every core passes a new
    **journal-replay determinism test** before `MF_REVERSE_DEBUG` is set (D19):
    - run a workload with randomly timed journaled inputs (keys, joystick and, on the Next, mouse
      and SD reads);
    - capture keyframes;
    - restore a random keyframe and replay to a random later position;
    - compare the whole image and the registers with a straight run that stopped at the same
      position.

    It runs in the e2e tier and in CI. Since Phase 0 it exists for the 48K and the Next
    (`test/wasm/reverse/journal-replay-determinism.test.ts`): keys at frame boundaries and mid-frame,
    on the fast path and in the debug loop, four random targets per run, and every keyframe interval
    replayed into the next keyframe (D9). The straight-run machine starts from the recorded machine's
    saved state, not from its own boot: the Next's RTC reads the host clock once at setup, so two
    boots differ (one timeline is one machine, so the RTC is simply part of the image).
    `KLIVE_REVERSE_SEEDS=1-30` runs more seeds locally.
13. **T13: Memory.** 512 MB by default is a lot, but this is a desktop debugger, and page sharing
    makes most keyframes small: a 48K program changing a few KB per half-second costs a few pages.
    The UI shows the timeline length the budget currently buys ("Reverse range: 41 s").
14. **T14: The fingerprint guards keyframes too.** Keyframes never outlive a session or a core
    reload, so they need no fingerprint. They are discarded if the core is rebuilt (dev hot reload) or
    the machine changes.
15. **T15: Debugger observations live in the CPU state.** The Z80 state holds the last port address,
    value and direction and an event flag, which the CPU writes only while its core captures bus
    events: in the per-instruction debug loop, never in a fast frame. A fast-path replay therefore
    leaves them as they were, and after a step back the I/O panel's "last port" would be stale (Phase 0
    found it as a one-byte image difference in the debug-loop variant). They are observations, not
    machine state; the determinism test masks them (`z80HistoryBusEventFields*`). Phase 2 decides
    between writing them unconditionally (a few stores per port access) and clearing the event flag
    after a replay, so the panel shows no event rather than a wrong one.
16. **T16: The host can touch the machine inside an instruction.** A prefixed instruction is one
    history record but two or three CPU cycles. A frame ends on the cycle that crosses its last T-state
    (for example after the `ED` of the ROM's keyboard `IN A,(C)`), and a debugger step runs one cycle,
    so key changes and keyframes land between the cycles of one record. With `(sequence, sub)` alone
    the replay applied such a key one cycle late, and `IN A,(C)` read another value. D3's phase fixes
    it; the determinism test found it within its first few seeds.
17. **T17: A fast frame restarted a frame in progress.** `sp48ExecuteFrame` and `zxnextExecuteFrame`
    began a new frame (audio, border, sample buffers) on every call, so after the debug loop had left a
    frame mid-way, switching to the fast path restarted the frame's bookkeeping in its middle. A replay
    switches paths at every stop, so this became a determinism bug. Both cores now continue a frame
    that has begun and not completed (`sp48FrameBegun`, `zxnextFrameBegun`; the Next's debug loop marks
    its frames begun through `zxnextBeginAudioFrame`). The other cores get the same rule in Phase 7.
18. **T18: A host read can change the machine.** The +3's `spp3eReadMemory` and
    `spp3eReadScreenMemoryOffset` latch the floating-bus value, as the CPU's and the ULA's reads must;
    but the machine's `doReadMemory` and `readScreenMemory` used them too, so refreshing a memory panel
    changed what the next floating-bus read returned - a bug in its own right, and a silent desync for
    replay. The host now reads through the side-effect-free `spp3ePeekMemory` /
    `spp3ePeekScreenMemoryOffset`. The contract test's call of every pure export is what found it.
19. **T19: Host bookkeeping that pushes into the core.** The Next's `syncCpuFromWasmV2` assigned the
    registers through setters that write them back into the core: 17 journaled calls a frame, with the
    values the core already held. Its debug loop also took the NextReg `$02` reset request after every
    instruction - 6,000 journaled calls a frame, which ran a test out of memory. The sync now assigns
    through `super`, and a pure `zxnextGetResetRequest` guards the take. With no input, a frame now
    journals nothing on the 48K and the Next.
20. **T20: The C shadow stack is in the image.** Between exported calls the stack is unwound, but its
    bytes stay: stale frames of whatever the host last called (the condition evaluator's, for one). They
    are not machine state, yet a keyframe comparison would see them. The layout stamp now records the
    stack (`WasmLayout.stack`, outside the fingerprint, so state files are unaffected), and keyframes and
    replay comparisons leave it out.
21. **T21: Several states share one position.** An input arrives between two instructions, so the
    machine before it and after it stand at the same position: a key pushed at the next frame's entry
    lands where the last frame ended. A replay to *s* applies every input recorded at *s* - the state
    the next instruction sees. A Step Back to a frame boundary where a key changed therefore shows the
    key already down. A test that snapshots the live machine must take its snapshot where no input
    lands, or after the inputs there.
22. **T22: The ring is shorter than a keyframe interval.** The 48K's ring holds 65,536 records - about
    six frames of a busy loop - while keyframes come up to 50 frames apart, so a navigation replay
    usually starts from a keyframe older than anything the ring holds. Rewinding is impossible there;
    the recorder restarts the ring and the replayed records fill it from slot 1, so putting the
    present's header back left every record one slot off (the e2e test's cursor and machine
    disagreed by one instruction). D17's snapshot of the present's ring is the fix.

---

## 4. Design

### 4.1 Core additions (shared, in `z80-history.c`)

- `z80HistorySetTarget(seqLo, seqHi, sub)` / `z80HistoryClearTarget()`. When the position reaches the
  target, the recorder sets `z80HistoryStopRequested`.
- Every frame loop and `…ExecuteUntilStop` checks the flag after each instruction and returns early,
  leaving the core at an instruction boundary. A core macro, `Z80_HISTORY_STOP_CHECK()`, keeps that
  to one line per loop. The flag is volatile.
- `z80HistoryGetPosition()` and `z80HistorySetPosition()`, for keyframe metadata (T6).
- `z80HistorySetVerify(on)`: compare would-be records with ring records while replaying (D9).
- Optional (Phase 3): `z80HistoryDirtyBitmapPtr()`. The core's RAM write funnel sets one bit per 4
  KiB page.

### 4.2 Timeline (emulator side, `src/emu/machines/reverse/`)

| Module | Role |
| --- | --- |
| `Timeline.ts` | Owns the keyframe store, the journal, the SD log and the current mode (`live`, `replaying`, `navigating`); starts and ends timelines per D2; forks (D12) |
| `KeyframeStore.ts` | Page pool (4 KiB, reference-counted, optional deflate), keyframe tables `{position, frame, pageRefs[], pageHashes[], hostParts, debugSupportState}`, the budget and eviction (D5, D6) |
| `InputJournal.ts` | Entries `{position, export, args, bytes?}`, appended in order; truncated on fork |
| `JournalingExports.ts` | The wrapper over `runtime.exports` and the journaled `memory.set` helper; mute and replay modes (D7, D8) |
| `ReplayEngine.ts` | `replayTo(position, {collectBreakpoints?})`: restore keyframe → apply journal entries at their positions → set the C target → run frames unthrottled with side effects suppressed → verify at keyframe boundaries (D9) |
| `ReplayStateProvider.ts` | `IHistoricalStateProvider` over the engine (D10) |
| `SdUndoLog.ts` | Next SD reads journal and write undo log (D14) |

`MachineController` gains `timeline`; `run` consults its mode, and the choke points of D13 check
`timeline.isReplaying`.

### 4.3 Navigation semantics (replacing G4.3's lite provider)

| Command | Behaviour |
| --- | --- |
| Step Back | `replayTo(position − 1 instruction)` (G4.3 D8's stop rules) |
| Step Forward | a real Step Into in replay mode (D11) |
| Reverse Step Over / Out | G4.3's walkers over the (regenerated) ring choose the target; `replayTo(target)` |
| Reverse Continue | D15's interval scan |
| Return to Present | `replayTo(end of journal)`, then live |
| Continue / Step / Run-to in the past | replay mode until the present, then live (D11) |
| Take over here | fork (D12, D13) |

Repeated step backs reuse work. Each navigation replay drops **transient keyframes** every 2,000
records over the last 20,000 before the target. They are complete (taken mid-frame, they keep the
scratch), kept in a least-recently-used set of 24 outside the budget, and dropped on a fork, so the
next Step Back replays at most 2,000 records: under a millisecond (§13).

### 4.4 UI

The G4.3 visuals stay, minus the "memory shows the present" banners (`memoryIsHistorical`). Additions:
- **Status bar:** "⟲ −1.24 s · step −3,412" while in the past; "▶ Replaying · 0.8 s to present" in
  replay mode; "Reverse range: 41 s" in the debug status tooltip.
- **Take over here** button, enabled in the past; the fork confirmation lists the side effects that
  cannot be undone (T4).
- **Execution History document:** rows beyond the cursor read "not in history — step forward to
  replay" (D17); a header line shows the timeline start.
- **Desync:** an error toast and an output-pane entry with the position and the first differing page
  (D9).
- **Settings:** `emuOptions.reverseDebugging` (D2); `emuOptions.reverseDebugMemoryMb` (D6); `emuOptions.keyframeIntervalFrames`
  (advanced, D5).

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| **0 — Spike (gate)** ✅ GO, 2026-10-07 (§10) | Prototype on the **48K and the Next**, behind a dev flag. (a) Page-shared keyframes: capture time, changed pages per keyframe for three workloads per machine (a game, a BASIC program, NextZXOS/a NEX demo). (b) T5's render-buffer classification. (c) Stop-at-position in C and the replay time per interval. (d) A minimal journal (keyboard only) and the journal-replay determinism test. | **Go/no-go:** keyframe capture under 5% of frame time at *K* = 25; a step back under 150 ms at the 90th percentile; the determinism test green on both cores; the budget buys at least 30 s on all six workloads. Numbers recorded here; D5, D6 and T9 revised. |
| 1 ✅ 2026-10-08 (§11) | The export contract (D7): classify every export of every core; journaling wrapper; journaled memory helper; mute TypeScript input sources in replay (D8). | Contract test passes on all cores; journal captures the T2 list. |
| 2 ✅ 2026-10-08 (§12) | `Timeline`, `KeyframeStore`, `ReplayEngine`, verification (D9), hit-count state (D16), side-effect suppression (D13). Next and 48K. | Journal-replay determinism test with all input kinds passes on both; hit-count test passes. |
| 3 ✅ 2026-10-08 (§13) | Performance: dirty bitmap (if Phase 0 shows it is needed), transient keyframes, `replayQuiet`, optional page compression. | Phase 0's gate numbers hold with a 10-minute session. |
| 4 ✅ 2026-10-08 (§14) | `ReplayStateProvider`; G4.3 commands on top of it; Continue-from-past replay mode; Take over here and fork. | e2e: step back 1,000 steps and compare with a recorded forward run at every step; fork test. |
| 5 ✅ 2026-10-08 (§15) | Reverse Continue with collect-mode breakpoints; reverse watchpoints (D15). | e2e: last write to an address found across three keyframe intervals. |
| 6 ✅ 2026-10-08 (§16) | Next SD journal and undo log (D14); Z88 cards, flap and battery; disk write-back republish (D13). | SD fork test restores the host image byte for byte. |
| 7 | Remaining cores in the G4.2 order, each gated by the determinism test (D19). | `MF_REVERSE_DEBUG` set per core as it passes. |
| 8 | UI polish, docs page, `.ai/ui-theming-intent-and-lessons.md` (status-bar states, Take over here), competitive analysis §2 (reverse debugging ✅) and §4 (close W2), roadmap. | Verified in the running IDE on the Next and the 48K. |

---

## 6. Tests

- **Journal-replay determinism, per core** (T12): the gate for `MF_REVERSE_DEBUG`. Random inputs,
  random keyframe, random target; whole image and registers equal to a straight run.
- **Export contract** (D7): every export classified; a fixture core with an unclassified export fails.
- **Position exactness** (D3, T1): replay to a mid-HALT `(sequence, sub)`, to a frame boundary, to a
  position inside a Next DMA hold, and to a ZX81 forced-NOP run.
- **Verification** (D9): an injected divergence (a deliberately unjournaled poke) is detected at the
  next keyframe or ring record.
- **Keyframe store:** page sharing, reference counts, eviction under budget, transient-keyframe LRU.
- **Side effects** (D13, D14, T3, T4): no host writes during replay; fork restores disk and SD
  images; tape-save files listed in the fork confirmation.
- **Breakpoints** (D15, D16, T8): reverse continue across intervals; memory-write watchpoint in
  reverse; `every Nth` hit counts identical after replay; one-shots restored on fork.
- **UI** (`jsdom`): status-bar states, Take over here enablement, desync toast, history rows beyond
  the cursor.
- **IDE check** (`scripts/` CDP script): step back 100 times through a NEX program and compare the
  CPU panel, the Memory panel and a screen hash with a recorded forward run.

---

## 7. Effort

**XL**, as the roadmap says, but bounded. Phase 0 is two to three weeks and decides whether the rest
goes ahead. Phases 1–5 on the Next and the 48K are the bulk, roughly two months. Each further core
(Phase 7) is about a week, most of it chasing whatever its determinism test finds.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| A hidden non-deterministic path corrupts replay silently. | Self-verification on every replay (D9), the export contract (D7), the per-core gate test (T12). |
| Keyframes cost too much memory or time on the Next. | Page sharing, T5's buffer classification, the dirty bitmap, the D17 diagnostics-build follow-up of G4.1 (which frees 20 MB of image), and the Phase 0 gate. |
| Replay is too slow for a long Reverse Continue. | Interval-by-interval search from the cursor backwards (most hits are recent), `replayQuiet`, progress UI with cancel. |
| Users lose work through a fork. | Fork is explicit (D12), confirmations list irreversible effects (T4), disk and SD images are restored (D13, D14). |

---

## 9. Questions (all answered, 2026-10-06)

1. **Q1 — Default on?** Yes, in every debug session, with a setting to turn it off (D2).
2. **Q2 — Memory budget.** The smaller of 512 MB and 1/16 of physical memory; 64 MB–2 GB (D6).
3. **Q3 — Continue from the past.** Replays to the present; forking stays explicit (D11, D12).
4. **Q4 — Key presses while replaying.** Ignored visibly, with a one-click Take over here (D12).
5. **Q5 — Order.** The G4.2 order after the Next and the 48K (D19).
6. **Q6 — Saving a timeline.** A new roadmap item, G4.6 (D21).

---

## 10. Phase 0 results (2026-10-07)

**Verdict: GO.** All four gate criteria hold, the step-back one with D5's adaptive interval. The spike
lives in `src/emu/machines/reverse/` and the C recorder; nothing reaches the IDE. Measured on an Apple
Silicon Mac in node (vitest), the recorder on, one machine per workload;
`KLIVE_REVERSE_SPIKE=1 npm test -- test/reverse/reverse-spike-measure.test.ts` repeats it.

### 10.1 The gate

| Criterion | Result | |
| --- | --- | --- |
| Keyframe capture under 5% of frame time at *K* = 25 | 1.20-1.45 ms per keyframe (max 4.8 ms): **0.24-0.29%** of the 25 × 20 ms it covers. Against unthrottled emulation it is 0.7-1.1% on the Next and 8-10% on the 48K, whose frames cost only 0.5 ms | ✅ |
| Step back under 150 ms at the 90th percentile | 48K: 11-14 ms. Next at *K* = 25: 132 ms on NextZXOS, **164-167 ms** on the two 28 MHz programs. At *K* = 12: 60-81 ms on all three | ✅ with D5's adaptive *K* |
| The determinism test green on both cores | 8 runs in CI (fast path and debug loop, two seeds); 120 runs over 30 seeds locally; and all 709 replayable keyframe intervals of the six workloads replayed into their next keyframe byte for byte | ✅ |
| The budget buys at least 30 s on all six workloads | Worst case 285 s at 512 MB and 140 s at 256 MB (*K* = 25; Layer 2 rewritten every frame); 136 s at 512 MB at *K* = 12. With T5's buffers left out, at least 1,311 s | ✅ |

### 10.2 Keyframes and replay per workload (*K* = 25)

Image pages: the 4 KiB pages a keyframe covers after volatile statics (48K 2,014; Next 1,852). The
first keyframe stores all of them (48K 7.9 MB, Next 7.2 MB); later ones store only changed pages.

| Workload | Frame ms | New pages per keyframe, mean (p90) | Without T5's buffers | MB per minute | Timeline at 512 / 256 MB | 25-frame replay | Step back p50 / p90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 48K game (*A Yankee in Iraq*, a key every 7 frames) | 0.55 | 22.2 (57) | 10.2 | 10.4 | 2,903 / 1,429 s | 15 ms | 8.3 / 12.4 ms |
| 48K BASIC (`FOR` loop printing) | 0.50 | 8.3 (10) | 7.0 | 3.9 | 7,764 / 3,822 s | 14 ms | 7.8 / 11.3 ms |
| 48K tape loading at normal speed | 0.65 | 88.3 (107) | 8.7 | 41.4 | 731 / 360 s | 18 ms | 9.1 / 14.4 ms |
| Next demo (PAR-005: Copper, line interrupt, sprite, Layer 2 scroll; 28 MHz) | 7.9 | 130.4 (131) | 11.6 | 61.1 | 496 / 244 s | 194 ms | 114 / 167 ms |
| Next, Layer 2 rewritten every frame (worst case; 28 MHz) | 7.6 | 226.6 (227) | 22.6 | 106.2 | 285 / 140 s | 190 ms | 112 / 164 ms |
| Next NextZXOS (booted from the SD card, then the menu) | 5.3 | 28.3 (28; max 219) | 14.6 | 13.3 | 2,283 / 1,125 s | 132 ms | 66 / 132 ms |

At *K* = 12 on the Next: the demo replays an interval in 95 ms (step back p90 81 ms, 243 s at 512 MB),
the Layer 2 worst case in 92 ms (78 ms, 136 s), NextZXOS in 64 ms (60 ms, 1,304 s). The recorder costs
under 10% of a Next frame (7.3 → 7.7 ms on the demo). Restoring a keyframe takes 0.2 ms.

What changes between keyframes, in bytes per 25-frame interval: on the 48K game the pixel buffer
(6.6 KB), the audio buffers (1 KB), RAM (218 bytes), and a few dozen bytes of CPU, timing and filter
state; on the Next demo the pixel buffer (118 KB) and Layer 2 buffer (79 KB) against a handful of RAM
bytes. Page sharing makes RAM almost free; the render buffers are what costs (T5).

NextZXOS: 5 of 119 intervals had SD traffic and were not replayed, because Phase 0's journal holds the
keyboard only (D14, Phase 6). The two NEX files in `_experiments/` could not be used: one needs a
loading-screen loader the harness lacks, the other needs esxDOS on the card.

### 10.3 T5's buffers

Each buffer was filled with garbage after a keyframe restore; six intervals per workload were then
replayed and compared with the next keyframe byte by byte.

| Core | Buffer | Read across a frame boundary? | Rewritten in an interval? |
| --- | --- | --- | --- |
| 48K | `sp48PixelBuffer` | no | all but 15,744 bytes the 48K picture never uses |
| 48K | `sp48AudioSamples`, `sp48AudioTransitionTacts`, `sp48AudioTransitionMic` | no | partly: the frame's samples |
| Next | `zxnextPixelBuffer` | no | fully |
| Next | `zxnextLayerUla`, `zxnextLayerL2`, `zxnextLayerSpr` | no | fully while the layer is on |
| Next | `zxnextLayerTm` | no | never (no workload used the tilemap) |
| Next | `zxnextUlaSpriteCoverage`, `zxnextBeeperTransitionTacts` | no | partly |

### 10.4 What the spike found

- **T16** (positions need a prefix phase) and **T17** (fast frames restarted a frame in progress):
  both caught by the determinism test, both fixed in the C cores, D3 and D4 revised.
- **T15**: the CPU's last-port fields are debugger observations kept in the image.
- **D5**: a fixed *K* misses the step-back gate on the 28 MHz Next; the interval is set by replay cost.
- **T9**: the Next at 28 MHz is about 7.6 ms a frame, not 2.4 ms; `replayQuiet` stays optional.
- The page store needs nothing smarter yet: capture is a full compare against the previous keyframe
  and still costs only 1.2-1.5 ms; the dirty bitmap stays a Phase 3 option.

---

## 11. Phase 1 results (2026-10-08)

**Done.** The contract test passes on all seven cores, and the journal captures every T2 input.

- **The contract** (`exportContract.ts`): 1,707 function exports across the seven cores (1,370
  distinct names) - 1,083 *pure*, 192 *debug*, 17 *execution*, 415 *journaled*. The classes come from
  verb rules over the name without its core prefix (`Get`/`Is`/`Has`/`Peek` read; `Set`, `Write`,
  `Upload`, `Insert`, ... and the device nouns `Tape`, `Disk`, `Fdc`, `Dock`, `Sprite`, ... change), the
  shared `z80History*` and `cond*` exports, and about fifty named exceptions, each with its reason. An
  export with a verb the rules do not know is unclassified.
- **The test** (`test/wasm/reverse/export-contract.test.ts`): per core, every export classified, the
  layout stamp's stack present, and every pure and debug export called with five argument sets on a
  booted, running machine without changing the image (volatile statics and the stack excluded). It found
  eight misclassifications - exports named like getters that bring a device up to the current tact or
  count their reads (the Next's beeper sample, two UART-peer and three mouse-port reads, the +3's PSG
  output) and the ZX81's auto-RUN watch, which is not volatile - plus the +3 bug of T18 and the stack
  of T20. All but the T18 pair are test-only exports; they are journaled now.
- **The wrapper** (`JournalingExports.ts`): `installJournal` replaces `runtime.exports`, journals the
  journaled exports and passes the rest through; `coreMemoryWrites.ts`'s `writeCoreBytes` /
  `fillCoreBytes` journal the host's direct writes (tape buffers on the 48K, 128K and +3; the +3's
  disk-change maps; the Next's ROM uploads, SD sector data and saved-picture restore; Z88 cards and
  snapshot RAM; the Timex DOCK; the ZX81 ROM and tape). Both drop and count live input while the journal
  is muted. Only debug-class code caches `runtime.exports` (conditions, RZX, the history reader).
- **The T2 list** (`test/wasm/reverse/journal-inputs.test.ts`): the 48K's keys, clock multiplier,
  FAST_LOAD, `setTacts` and tape upload; the Next's keys, both joysticks and the mouse; the Z88's keys,
  flap and battery; the Timex DOCK insert and eject; the ZX81's clock multiplier - each through the
  machine's own API. A program's NextReg `$02` hard reset is journaled as the take, the CPU reset, the
  `HardReset` export and four ROM writes, and replaying it from an earlier keyframe reproduces the
  image byte for byte (T11).
- **D8**: `IReplayHostSync.invalidateHostSync()` on the 48K (and Timex), 128K, +3, Next and ZX81; the
  Z88 caches nothing it pushes.
- The journal-replay determinism test now runs on the full contract journal instead of Phase 0's
  keyboard list, and still passes on both cores and both paths.

---

## 12. Phase 2 results (2026-10-08)

**Done.** The journal-replay determinism test passes on the 48K and the Next with every input kind,
and the hit-count test passes.

- **`Timeline.ts`**: one per debug session. `start` turns the recorder on, journals the core and takes
  the base keyframe; `afterFrame` takes a keyframe once the frames since the last would take
  `targetReplayMs` (100 ms) to replay, between 5 and 50 frames (D5), from a cost per record that every
  replay re-measures; `replayTo` remembers the present (position, wrapper fields, breakpoint state),
  mutes live input and replays; `returnToPresent` replays back and restores it; `fork` drops the
  journal entries, keyframes and logged hits after the current point (D12); `end` takes the journal
  off the core. `isReplaying` is the D13 flag.
- **`KeyframeStore`** keeps each keyframe's wrapper fields and breakpoint state (`meta`), leaves the C
  stack out (T20), drops keyframes after a fork point, and computes D6's budget
  (`reverseDebugBudgetBytes`).
- **`ReplayEngine`**: verification on for every replay (D9's ring check), an optional check against
  every keyframe passed, `ReplayDesyncError` with the position and what found it.
- **Machines**: the 48K and the Next implement `TimelineMachine` (`captureHostState`,
  `restoreHostState` - the T7 replay-aware path - `isAtFrameBoundary`, the core and its frame export);
  `saveMachineState` and `loadMachineState` share those fields. Both carry `MF_REVERSE_DEBUG` (D19).
- **The controller** starts a timeline whenever the recorder starts recording for a debug run, on a
  machine with `MF_REVERSE_DEBUG`, unless `emuOptions.reverseDebugging` is off; it ends it when the
  recorder stops, at every stop (which every reset, restore and machine switch goes through), at a
  checkpoint restore and at a code injection (T10). The run loop calls `afterFrame` after every frame.
  Logpoint output, tape and disk publishing, and the frame-completed push (audio, screen) are skipped
  while `isReplaying` (D13). In Phase 2 a replay is synchronous and outside the run loop, so those
  guards wait for Phase 4's replay mode. The settings `emuOptions.reverseDebugging` (default on) and
  `emuOptions.reverseDebugMemoryMb` (default 0: D6's automatic budget) exist; their settings-page rows
  are Phase 8's.
- **Tests**: `test/wasm/reverse/journal-replay-determinism.test.ts` now also feeds memory edits, the
  clock multiplier and a tape upload (48K), joysticks, the mouse and NextReg writes through the ports
  (Next); 120 runs over 30 seeds pass. `test/wasm/reverse/timeline.test.ts`: step back to saved
  points in any order, mid-frame ones included, with the whole image equal; return to the present;
  fork and step back again; an "every 3rd hit" breakpoint stops at the same positions and counts after
  a step back and a fork (T8); a byte poked behind the journal's back is caught by the ring check and
  ends the timeline (D9); the Next's keyframe interval follows replay cost.
  `test/emu/reverse-timeline-controller.test.ts`: the timeline's lifecycle through the controller.
- Not yet: Step Back and the other commands (Phase 4), transient keyframes and leaving T5's buffers out
  (Phase 3), the SD card (Phase 6).

---

## 13. Phase 3 results (2026-10-08)

**Done: Phase 0's gate holds over a 10-minute session** on all six workloads, on the real `Timeline`
(adaptive *K*, D6's 512 MB budget, transient keyframes). 30,000 frames each; 40 step backs to random
points of the timeline, each followed by four more one-record steps back. Measured as in §10 with
`KLIVE_REVERSE_SESSION=1 npm test -- test/reverse/reverse-spike-measure.test.ts`.

| Workload | *K* (frames) | Capture mean / max | Capture, % of frame period | Pool after 10 min | Timeline range | Step back p50 / p90 | Repeated step back p90 | Return to present |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 48K game | 50 | 1.28 / 5.1 ms | 0.13% | 44 MB | 600 s (all of it) | 26 / 38 ms | 0.45 ms | 15 ms |
| 48K BASIC | 50 | 1.20 / 2.8 ms | 0.12% | 30 MB | 600 s | 20 / 33 ms | 0.47 ms | 13 ms |
| 48K tape loading | 50 | 1.25 / 4.9 ms | 0.13% | 81 MB | 600 s | 26 / 39 ms | 0.74 ms | 12 ms |
| Next demo (28 MHz) | 13 | 1.19 / 2.4 ms | 0.21% | 512 MB (budget; 1,259 evicted) | 273 s | 69 / 98 ms | 0.72 ms | 32 ms |
| Next, Layer 2 every frame (28 MHz) | 13 | 1.26 / 3.1 ms | 0.12% | 512 MB (budget; 1,732 evicted) | 149 s | 68 / 103 ms | 0.54 ms | 39 ms |
| Next NextZXOS | 4-46 (19) | 1.61 / 5.5 ms | 0.42% | 140 MB | 600 s | 59 / 100 ms | 0.80 ms | - (SD traffic, Phase 6) |

Gate: capture under 5% of frame time - at most 0.42%; step back under 150 ms at the 90th percentile -
at most 103 ms; the budget buys at least 30 s - at least 149 s, and the whole session on four of six.

What Phase 3 built and decided:

- **Keyframe spacing by calibrated frame cost** (D5): frames weighted by the clock multiplier, the base
  cost measured by replaying the latest interval at the second keyframe and every 64th (a free D9 check
  of the live run). The first version, a cost per record that navigation replays measured, never
  learned anything during a live session and left the Next's step-back p90 at 200 ms.
- **Frame-boundary scratch** (T5): the layout stamp names it (`scratch`), lean keyframes leave it out,
  the T5 proof covers it on every interval. The list shrank to what is truly scratch and costs nothing
  to lose: the 48K's audio samples and the Next's coverage map. The beeper transition buffers turned
  out to be state; the picture and layer buffers are kept for D18.
- **Transient keyframes** (§4.3): `ReplayEngine`'s `checkpoints` option and the store's ordered,
  least-recently-used transient set; repeated step backs cost under 1 ms.
- **Not built, by measurement:** the dirty bitmap (capture is cheap), `replayQuiet` (replay is fast
  enough for step backs), page compression (it would slow every restore; the budget is ample).
- The calibration replay restores the keyframe's copy of the CPU's bus-event fields, so after it the
  I/O panel's "last port" may show an older access (T15, still Phase 2's open decision).

---

## 14. Phase 4 results (2026-10-08)

**Done.** On the real 48K through the real `MachineController`
(`test/emu/reverse-step-back-controller.test.ts`): after a debug run to a breakpoint (keyframes on the
way) and 1,300 forward steps logged with a hash of the whole machine, **1,000 Step Backs each put the
machine exactly where the forward run had it** - every position found in the log, every hash equal,
the cursor's record the machine's next instruction - and Step Forward and Return to Present come back
to the present's exact state. The fork test: Step Into from the past (20 steps, each equal to the
forward run), Continue from the past to a breakpoint (the visit the recorded run made first), stepping
on into the present (live again, journal unchanged), Take over here 200 steps back (later keyframes
gone), a journaled memory edit and 60 new steps, then back through the new future and past the fork
point into the old past - all equal to the runs that made them.

What Phase 4 built:

- **`ReplayStateProvider`** (D10) and **`HistoryCursor`'s replay hook**: `memoryIsHistorical` follows
  it, so G4.3's banners go while the machine is in the past.
- **`Timeline.navigateTo(s)`** (the machine before record *s*), the **present-ring snapshot** (D17,
  T22), and **replay runs** (D11): `startReplayRun`, `onReplayTarget`, `pauseReplayRun`.
- **`z80HistoryCheckStop`** in every core and its use in the 48K's and the Next's debug loops; test
  doubles of the cores' exports carry it.
- **The controller**: runs from the past, journal entries applied in the run loop, a replay run that
  stops short leaves the cursor on the machine (`HistoryCursor.attach`), `takeOverHere`, and D13's
  suppression now active during replay runs (no screen, audio, logpoint, tape or disk side effects
  until the present).
- **`history-take-over`** and Emu API `takeOverHere`.

Noted for later phases:

- Every run re-pushes FAST_LOAD (`sp48TapeSetFastLoad`), one journal entry per step (T2's prediction).
  Harmless; a push-on-change would keep the journal leaner.
- Register and memory edits in the past still return to the present first (G4.3 D5); D12's
  fork-on-edit with a confirmation is UI (Phase 8).
- During a replay run the screen does not update until the run stops or reaches the present (D13);
  Phase 8's status bar says "Replaying".
- A replay run on the Next cannot cross SD traffic until Phase 6 (T3).

---

## 15. Phase 5 results (2026-10-08)

**Done.** `test/emu/reverse-continue-controller.test.ts`, on the real 48K through the controller: a
loop writes `$9500` only while a flag is set; a journaled memory edit sets it, a second clears it, and
the session runs on for at least three keyframe intervals. Reverse Continue with a memory-write
watchpoint on `$9500` then lands on **the last write** - before the flag went off, three intervals and
more back, the machine just after the store with the written value in memory. A second Reverse
Continue finds the write before it (one loop earlier, the value one less); from the present again the
same search lands on the same write; a Continue from there with the watchpoint still set replays to
the present without a stop (so no later write was missed); and an execution breakpoint whose
condition reads memory (`(b[$9500] & 1) == 0`) finds the last pass that wrote an even value - a
condition G4.3's lite Reverse Continue could not check.

What Phase 5 built:

- `MachineController.reverseContinueByReplay`: with a timeline, `navigateHistory("reverseContinue")`
  searches backwards interval by interval with `collectBreakpointHits`; without one it is still
  G4.3's walker over the ring.
- `Timeline.startReplayRun(limit)` and the `"limit"` outcome; `Timeline.keyframeBefore`.
- `HistoryCursor.moveToRecord` (no walker rule moves the landing on - an INT row after a write must not
  turn into the interrupt handler's first instruction) and Return to Present with no cursor.
- Deep landings (D17): `Timeline.landAt`, `viewHolds`, `ReplayStateProvider.anchorHere`.

Noted for later phases:

- Collect mode runs the TypeScript debug loop, which is several times slower than the fast path, so a
  search over many intervals takes a while; Phase 8 shows progress and lets it be cancelled. A
  C-side collect mode is the speed-up if users need one.
- After a deep landing there is no cursor: the history document shows the regenerated run up to the
  landing, but no row is marked, and Step Forward past the landing returns to the present (Step Into
  replays forward instead). Phase 8 marks the landing in the status bar.
- The Next's NextReg and Copper breakpoints go through the same debug loop and are untested in
  reverse; Phase 7's per-core work covers them with the Next's determinism and reverse tests.

---

## 16. Phase 6 results (2026-10-08)

**Done.** `test/emu/reverse-sd-fork-controller.test.ts`, on the real Next through the controller: a
program reads one sector and writes another through the SPI ports on every pass, so the card's host
image changes all the time. Stops right after the instructions that hand a read and a write to the
host leave them pending, and resuming answers them before anything runs (T3). After 160 passes, a
replay to an early point and a replay run 40 passes forward **never ask the host** - not a read, not a
write - and what each pass read is the sector as it was *then*, though the host image holds later
writes. **Take over here then writes the discarded future's sectors back: the host image equals, byte
for byte, the image after that pass**; the run goes on live from there exactly as the model of the
program predicts, and a second fork further back (over the first fork point) restores the image again.

What Phase 6 built:

- **The SD wait (T3):** the Next's debug loop re-reads a pending command from the core on entry and
  returns without running. Removing that makes the test fail.
- **The SD undo log (D14):** `SdUndoLog.ts`; writes keyed by their acknowledgement's journal index;
  `Timeline.fork()` returns them, the controller has the machine write them back (`revertSdWrites`,
  newest first) and reports any it could not undo. Reads needed nothing: their data was journaled
  since Phase 1.
- **No host side effects from replays (D13, T4):** frame commands are not processed while replaying (and
  the Next's debug loop drops a command the core no longer waits for); a replayed frame's tape saves and disk
  changes are dropped, after `beforeLeavePresent` published the present's own; the Z88's serial output
  waits (`ExecutionContext.isReplayingHistory`).
- **On fork:** disks republished (`republishDisks` on the +3 and the Beta 128, within the file's
  geometry); tape-save files of the discarded future named (`noteHostFile`, `forkPreview`, by position).
- **Media and machine commands in the past** (tape, disk, Z88 cards, flap, battery) return to the
  present first, also from a cursor-less landing; the muted journal used to drop them silently.
- **Found on the way:** a replay run that stopped older than the present's ring attached a cursor the
  ring could not hold, which cleared itself and sent the machine back to the present. It now keeps the
  regenerated ring, as a deep landing does (D11, D17).

**NextZXOS, the 10-minute session** (§13's workload, now with SD traffic replayed): step backs crossing
SD reads are no longer skipped and Return to Present runs.

| Workload | *K* (frames) | Capture mean / max | % of frame period | Pool after 10 min | Range | Step back p50 / p90 | Repeated p90 | Return to present |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Next NextZXOS | 4-45 (19) | 1.64 / 4.5 ms | 0.43% | 139 MB | 600 s | 58 / 108 ms | 0.62 ms | 40 ms |

Phase 0's gate still holds. The phase 0 spike's interval check (`KLIVE_REVERSE_SPIKE=1`) now replays
the intervals with SD traffic too (`intervalsWithSd`) instead of skipping them.

Noted for later phases:

- The fork confirmation (Phase 8) has its data in `controller.forkPreview()`: SD writes to revert and
  tape files that stay.
- The +3's and 128K's own publishing inside `executeMachineFrame` keeps TypeScript revisions that a
  replay moves past; their `TimelineMachine` (Phase 7) must re-read them in `restoreHostState`.
