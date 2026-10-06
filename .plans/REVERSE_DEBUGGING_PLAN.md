# Reverse Debugging Plan: Keyframes, an Input Journal and Deterministic Replay

Status: **draft** (2026-10-06). Decisions D1–D20 are proposals; the §9 questions are open. Phase 0 is
a **spike with a go/no-go gate**, as the roadmap asks; the phases after it are planned in less detail
on purpose.

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
also out of scope (Q6).

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
| D2 | **Reverse debugging runs only in debug sessions**, like history recording (G4.1 D8). Starting with debugging starts a **timeline**: a base keyframe, an empty journal and a cleared history ring. Restart, reset, a state, snapshot or RZX load, code injection, and a machine or ROM change end the timeline. |
| D3 | **The timeline position is the history recorder's sequence plus a sub-index.** The shared recorder (G4.1) counts every instruction-boundary event on every core. A position is `(sequence, sub)`, where `sub` counts the units already merged into a coalesced record (HALT cycles, Next DMA hold T-states, ZX81 forced-NOP fetches). This is exact at every point where the host can touch the machine, including mid-HALT frame boundaries. The per-core instruction counters are not used: their semantics differ, and two cores have none. |
| D4 | **Stop-at-position in C.** The recorder gains a *target* position. When it is reached, it raises a stop flag that every core's frame loop and `…ExecuteUntilStop` check, the way the Next's frame loop already exits on an SD host command (`zxnext-frame.c:24`). The fast path can then replay at full speed. The per-instruction TypeScript debug loop is only for the last few instructions, when breakpoints must be checked. |
| D5 | **Keyframes at frame boundaries, every *K* frames, page-shared.** The controller captures between `executeMachineFrame` calls. Default *K* = 25 (0.5 s at 50 Hz), set by Phase 0's measurements. An image is split into 4 KiB pages. A page equal to the same page of the previous keyframe is stored as a reference, so each keyframe is a full page table over a pool of immutable, reference-counted pages. There is no base keyframe to rebase, and evicting a keyframe only drops references. A C-side dirty bitmap over the RAM write funnel is an **optimisation** for Phase 3, not a prerequisite. |
| D6 | **A memory budget, not a time budget.** Setting `emuOptions.reverseDebugMemoryMb` defaults to 512 (Q2). When the pool exceeds it, the oldest keyframes are evicted; the timeline start moves forward and the UI shows it. Pages may be compressed with fflate level 1 when the pool passes half the budget (Phase 3). |
| D7 | **Journal at the core's export boundary.** Every call the TypeScript side makes into a core export that *changes* machine state goes through a journaling wrapper on `runtime.exports`, stamped with the current position: key status, joystick, mouse, tape mode/rewind/fast-load, media uploads, writes to memory, registers and ports, NextReg writes, SD responses, Z88 card/flap/battery, the clock multiplier, tacts. TypeScript writes straight into core memory (`memory.set` for tape, ROM and card uploads, the SD buffers) go through a journaled helper. A **contract test** classifies every export of every core as *pure*, *execution* or *journaled*; an unclassified export fails the build, so a new input path cannot silently break replay. |
| D8 | **Journal the effect, not the host event.** The emulated-keystroke queue, the Spectrum keyboard sync, the clock-multiplier read and the ZX81 auto-RUN typer all live in TypeScript outside the image. Their *effects* reach the core through journaled exports. During replay the TypeScript sources are muted and the journal supplies the effects, so state that lives outside the image does not matter. |
| D9 | **Replay verifies itself.** When a replay passes a later keyframe's position, the live image's page hashes must equal that keyframe's. While the history ring still holds a record for the position being replayed, the recorder compares its would-be record with it (PC, SP, AF). A mismatch stops the replay with "Replay diverged at step −N", like an RZX desync (G2.7), and the timeline is cut there. A desync is treated as a bug with a test, never as a user error. |
| D10 | **The historical-state provider is replay.** `ReplayStateProvider` implements G4.3's `IHistoricalStateProvider`: restore keyframe, replay to *s*, report `memoryIsHistorical: true`. Every G4.3 banner then disappears, and every panel shows the past because the machine **is** in the past. |
| D11 | **Continue from the past replays toward the present.** Continue, Step Into/Over/Out and Run-to from a past position run the machine with the journal supplying inputs ("**Replaying**", with the distance to the present in the status bar). Breakpoints are active. Live input is ignored, and the status bar says so. Reaching the end of the journal switches seamlessly to live. |
| D12 | **Forking is explicit: "Take over here".** A command (and status-bar action) discards the future: journal entries, keyframes and history records after the position. Live input then resumes, as RZX's "record from here" does. These also fork after a confirmation: editing a register or memory in the past, loading media, or pressing a key into the emulator while replaying. |
| D13 | **Host side effects are suppressed during replay and undone on fork** (T3, T4). Tape-save publishing, disk write-back publishing, logpoint output, Z88 serial output, audio and frame-completed screen pushes are skipped while replaying. On fork: disk images are re-published from the restored in-core image; Next SD sectors written in the discarded future are restored from the SD undo log (D14); host files written by tape SAVE cannot be unwritten, so the fork confirmation lists them. |
| D14 | **The Next SD card gets a journal and an undo log.** Sector reads in a timeline are journaled with their 512-byte data, so replay never re-reads a host file that later writes may have changed. A write first reads the old sector and journals it, then writes. On fork, the discarded future's writes are reverted in reverse order. During replay, writes are acknowledged from the journal without touching the host. |
| D15 | **Reverse Continue scans forward.** To find the last breakpoint hit before *s*: replay the keyframe interval that ends at or contains *s* with breakpoints in *collect* mode (record hits, do not stop); take the last hit before *s*; if there is none, move one interval back. Then replay to that hit. Every breakpoint kind works: conditions reading memory, memory-write watchpoints, I/O, NextReg and Copper breakpoints. That gives **reverse watchpoints** ("last write to `$8000`") without new machinery. |
| D16 | **Hit counts and one-shots are part of the timeline.** `DebugSupport` hit counters are captured with each keyframe and restored with it, so a replay counts them identically. One-shot breakpoints removed in the future are restored on fork. |
| D17 | **The ring is regenerated by replay.** While replaying, the recorder writes records as usual, so after a deep step back the ring holds the history *up to* the cursor. Future rows beyond the cursor are shown as "not in history — step forward to replay". Reverse step over/out and the historical call stack (G4.3) use the regenerated records. Reaching beyond the ring's reach is just another replay. |
| D18 | **The emulator screen shows the past.** After a replay stops, the screen shows the core's pixel buffer as it is at that instant: a partly drawn frame mid-frame, as on real hardware. When G3.7's beam overlay exists it marks the beam position. |
| D19 | **One mechanism for every WASM core**, enabled per machine with `MF_REVERSE_DEBUG` after that core passes the journal-replay determinism test (§6). Order: the Next and the 48K first (the G4.3 test pair), then the G4.2 order. |
| D20 | **The keys and commands are G4.3's.** Step Back, Step Forward, Reverse Step Over/Out, Reverse Continue and Return to Present keep their names and shortcuts. Only "Return to Present" changes meaning: it replays to the end of the journal. "Take over here" is the one new command. |

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
| Frame loops (stop checks go here) | `sp48ExecuteFrame` (`sp48.c:632`), the sp128/spp3e equivalents, `zxnextExecuteFrame` (`zxnext-frame.c:17-29`), `z88ExecuteUntilStop` (`z88.c:223`), `zx8081ExecuteUntilStop` (`zx8081.c:249`) |
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
   deterministic instruction, which makes them easy to journal.
4. **T4: Host files written in the discarded future.** Disk write-back is a publish of the in-core
   image, so re-publishing after a fork restores the host file (D13). A tape SAVE produces a *new
   host file*; Klive will not delete user files, so the fork confirmation lists them instead.
5. **T5: Render and scratch buffers are captured as state.** On the Next about 3.5 MB of pixel,
   layer and raster-scratch buffers are not volatile, against 2 MiB of RAM. They change every frame,
   so every keyframe would store them. Phase 0 classifies each one:
   - *needed* across a frame boundary (for example a partially drawn line);
   - *rewritten before it is read*, which a keyframe taken at a frame boundary can skip.

   The proof is a determinism-test variant that zeroes the candidates at a frame-boundary restore and
   still requires identical results. Anything not proven stays in.
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
9. **T9: Replay speed.** Cores always render pixels and audio samples; nothing skips them today. The
   Next's worst measured frame is 2.4 ms with all layers, so a 25-frame interval replays in about 60 ms
   at worst. That is acceptable for a step back but slow for a Reverse Continue over many intervals.
   Phase 0 measures replay time per core. If it is too slow, Phase 3 adds a core `replayQuiet` flag
   that skips audio-sample generation. Rendering cannot simply be skipped where later emulation reads
   it (sprite collision, the Next's raster catch-up); T5's classification tells which parts can be.
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

    It runs in the e2e tier and in CI.
13. **T13: Memory.** 512 MB by default is a lot, but this is a desktop debugger, and page sharing
    makes most keyframes small: a 48K program changing a few KB per half-second costs a few pages.
    The UI shows the timeline length the budget currently buys ("Reverse range: 41 s").
14. **T14: The fingerprint guards keyframes too.** Keyframes never outlive a session or a core
    reload, so they need no fingerprint. They are discarded if the core is rebuilt (dev hot reload) or
    the machine changes.

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
instructions near the target. They are kept in a small LRU outside the budget, so the next Step Back
replays at most 2,000 instructions.

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
- **Settings:** `emuOptions.reverseDebugMemoryMb` (D6); `emuOptions.keyframeIntervalFrames`
  (advanced, D5).

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| **0 — Spike (gate)** | Prototype on the **48K and the Next**, behind a dev flag. (a) Page-shared keyframes: capture time, changed pages per keyframe for three workloads per machine (a game, a BASIC program, NextZXOS/a NEX demo). (b) T5's render-buffer classification. (c) Stop-at-position in C and the replay time per interval. (d) A minimal journal (keyboard only) and the journal-replay determinism test. | **Go/no-go:** keyframe capture under 5% of frame time at *K* = 25; a step back under 150 ms at the 90th percentile; the determinism test green on both cores; the budget buys at least 30 s on all six workloads. Numbers recorded here; D5, D6 and T9 revised. |
| 1 | The export contract (D7): classify every export of every core; journaling wrapper; journaled memory helper; mute TypeScript input sources in replay (D8). | Contract test passes on all cores; journal captures the T2 list. |
| 2 | `Timeline`, `KeyframeStore`, `ReplayEngine`, verification (D9), hit-count state (D16), side-effect suppression (D13). Next and 48K. | Journal-replay determinism test with all input kinds passes on both; hit-count test passes. |
| 3 | Performance: dirty bitmap (if Phase 0 shows it is needed), transient keyframes, `replayQuiet`, optional page compression. | Phase 0's gate numbers hold with a 10-minute session. |
| 4 | `ReplayStateProvider`; G4.3 commands on top of it; Continue-from-past replay mode; Take over here and fork. | e2e: step back 1,000 steps and compare with a recorded forward run at every step; fork test. |
| 5 | Reverse Continue with collect-mode breakpoints; reverse watchpoints (D15). | e2e: last write to an address found across three keyframe intervals. |
| 6 | Next SD journal and undo log (D14); Z88 cards, flap and battery; disk write-back republish (D13). | SD fork test restores the host image byte for byte. |
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

## 9. Questions

1. **Q1 — Default on?** Reverse debugging in every debug session (proposed, consistent with
   history), or opt-in per session with a toolbar toggle?
2. **Q2 — Memory budget default.** 512 MB (proposed), 256 MB, or a percentage of system memory?
3. **Q3 — Continue from the past.** Replay to the present (proposed, D11), or fork immediately as
   DeZog-style tools tend to? Replay is safer; forking is what users of "set next statement" may
   expect.
4. **Q4 — Key presses while replaying.** Ignore them with a status note (proposed), or treat the
   first one as an implicit "Take over here" after a confirmation?
5. **Q5 — Order after the Next and the 48K.** The G4.2 order (128K family, +3E, Z88, ZX80/81), or the
   Z88 earlier because its card and flap inputs are the strangest and would test the export contract
   hardest?
6. **Q6 — Saving a timeline.** Out of scope here. Is a "save debugging session" (keyframes + journal
   to a file, replayable later) worth a roadmap entry of its own? It would be the Klive analogue of an
   RZX with a debugger attached.
