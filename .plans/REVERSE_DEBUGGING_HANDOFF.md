# Reverse Debugging (G4.4) — Handoff

For an AI session picking up [REVERSE_DEBUGGING_PLAN.md](REVERSE_DEBUGGING_PLAN.md). Written 2026-10-08,
after Phases 0–5; updated after Phases 6 and 7. The plan is the source of truth; this note is the map into it and the code, plus what
only the previous session knew.

## 1. Where things stand

- **Done:** Phases 0–7 (§5 of the plan marks each ✅). Full reverse debugging works on **every WASM Z80
  machine** - 48K, 128K, Pentagon, Scorpion, +2A/+3/+2E/+3E, Timex, Next, Z88, ZX81, ZX80
  (`MF_REVERSE_DEBUG`) - through the real `MachineController`: Step Back
  and the other G4.3 commands put the whole machine in the past, Continue/Step from the past replays
  toward the present, Take over here forks, Reverse Continue checks every breakpoint kind on the real
  past machine (reverse watchpoints included). Since Phase 6 the Next's SD card is safe in a timeline:
  replays never ask the host, and a fork writes the discarded future's sectors back (§16 of the plan).
- **Next:** Phase 8 (UI, docs, competitive analysis). See §4 below.
- **Committed:** Phases 0–6 are commit `7bb36ace5` on `dotneteer/execution-history`, Phase 7 the commit after it.
  `_experiments/testprojects/disann/klive.project` was already modified before this work
  and is not part of it. Commit only when the user asks.
- Last verified state (after Phase 6): `npm run build:check` clean (112 known), full `npm test` green,
  `npm run lint:renderer` warnings only.

## 2. Read first

1. `AGENTS.md` (repo rules; standing instructions at the end of this note).
2. The plan: §1.1 **decisions D1–D21** (several revised in place: D3, D4, D5, D6, D7, D8, D9, D10, D11,
   D15, D16, D17, D18, D20 — each says "Since Phase N"), §3 **traps T1–T22** (T15–T22 were found during
   implementation), §5 phases, then the results sections **§10–§15** — they record what was measured,
   what was tried and rejected, and what is deferred.

## 3. Map of the implementation

### C (shared recorder, every Z80 core)
- `src/emu/z80/wasm/z80-history.{h,c}` — header words 40–63 now hold the **stop target** (seq, sub,
  phase), `stopState`, `verifyState`. Exports (listed in `scripts/z80-history-exports.cjs`):
  `z80HistorySetTarget/ClearTarget/GetSub/GetPhase/SetPosition/Rewind/SetVerify/CheckStop/
  BusEventFieldsPtr/BusEventFieldsSize`. `z80HistoryStopNow()` is the per-instruction check.
- **Every frame loop calls `z80HistoryStopNow()`** (and every `…ExecuteUntilStop`), with the
  **frame-in-progress rule** (`sp48FrameBegun`, `sp128FrameBegun`, `spp3eFrameBegun`, `zxnextFrameBegun`;
  the Z88 and ZX80/81 begin a frame only after one completed, which is the same rule; T17). The Timex
  compiles `sp48.c`.
- The header is **80 bytes** since Phase 7: words 64-76 hold the self-check's copy of the recorded
  record (T23). `z80HistoryVerifySlot` compares with it; a mismatch counts at publish.
- `spp3e.c`: new side-effect-free `spp3ePeekMemory` / `spp3ePeekScreenMemoryOffset` (T18).
- `zxnext.c`: `zxnextGetResetRequest` (T19).
- `scripts/wasm-layout.cjs`: the layout stamp now carries `stack` and `scratch` (outside the
  fingerprint); `KLIVE_WASM_MAP_DIR=<dir>` keeps a build's linker map for symbol lookups.

### TypeScript, `src/emu/machines/reverse/`
| File | Role |
| --- | --- |
| `timelinePosition.ts` | `TimelinePosition` `(sequence, sub, phase)`, `HistoryPositionPort` (target, verify, rewind, reseed, ring views/snapshots) |
| `exportContract.ts` | Every export of every core classified `pure`/`debug`/`execution`/`journaled` (D7) |
| `JournalingExports.ts`, `InputJournal.ts`, `coreMemoryWrites.ts` | The journal: wrapped exports + journaled direct memory writes (`writeCoreBytes`/`fillCoreBytes`) |
| `KeyframeStore.ts` | Page-shared keyframes, lean/complete plans, transient keyframes (LRU), budget (D5, D6, T5) |
| `ReplayEngine.ts` | `replayTo` with ring verification, keyframe checks, transient checkpoints, `ReplayDesyncError` |
| `Timeline.ts` | One per debug session: modes `live`/`navigating`/`replaying`, adaptive *K* with calibration, `navigateTo`, `landAt`, replay runs (`startReplayRun(limit?)`, `onReplayTarget`, `pauseReplayRun`), `returnToPresent`, `fork`, hit log |
| `ReplayStateProvider.ts` | The `HistoryReplayHook` behind G4.3's `HistoryCursor` (D10) |
| `IReplayHostSync.ts` | `invalidateHostSync()` contract (D8) |
| `SdUndoLog.ts` | The SD undo log (D14): writes keyed by their acknowledgement's journal index, `takeFrom` for a fork, `revertSdWrites` |

### Integration points
- **Machines:** every WASM Z80 machine implements `TimelineMachine` (`reverseCoreId`, `reverseRuntime`,
  `reverseFrameExport`, `isAtFrameBoundary`, `captureHostState`, `restoreHostState`,
  `invalidateHostSync`) and its debug loop honours `ExecutionContext.historyStopArmed` (the Timex
  inherits the 48K's). `restoreHostState` re-reads what the wrapper mirrors of the core - tape-save
  and disk-write revisions (128K's Beta 128 via `Beta128Disks.followCoreRevision`, +3), frame flags -
  and empties the Z88's serial output.
- **`MachineController.ts`:** `ensureTimeline`/`endTimeline` (lifecycle tied to history recording, D2),
  `afterFrame` keyframes in the run loop, D13 guards (`suppressingSideEffects`), `beginRunFromPast`,
  `serviceReplayRun`, `settleReplayRun`, `takeOverHere`, `reverseContinueByReplay`/`collectBreakpointHits`,
  `clearCursorForCommand` (G4.3 D5 relaxed while in the past).
- **`HistoryCursor.ts`:** replay hook, `memoryIsHistorical` getter, `clear(leavePast)`, `attach`,
  `moveToRecord`.
- **`DebugSupport.ts`:** `onHitCounted`, `captureTimelineState`/`restoreTimelineState` (D16).
- **IDE:** command `history-take-over` (`HistoryCommands.ts`), Emu API `takeOverHere`.
- **Settings:** `emuOptions.reverseDebugging` (default on), `emuOptions.reverseDebugMemoryMb` (0 = auto);
  no settings-page rows yet (Phase 8).
- **Host side effects (Phase 6):** `Timeline.sdUndo` + `TimelineMachine.attachSdUndoLog` (the Next logs
  each SD write's old sector); `Timeline.fork()` returns `{ sdReverts, hostFiles }`, `forkPreview()` the
  same without forking (for Phase 8's confirmation); `ForkAwareMachine` (`revertSdWrites`,
  `republishDisks` - the Next, the +3, the 128K family's Beta 128); `TimelineOptions.beforeLeavePresent`
  (the controller publishes pending tape saves/disk writes); `ExecutionContext.isReplayingHistory` (the
  Z88's serial output). The controller drops what replayed frames produce (`discardReplayedHostEffects`)
  and never processes a frame command while replaying. `takeOverHere` is now `async`.

## 4. What is next

**Phases 6 and 7 are done** (plan §16, §17). What they leave for Phase 8: the fork confirmation
itself (`controller.forkPreview()` has the data). The Phase 7 cores have no frame-boundary scratch
(T5) - their keyframes keep the audio buffers; worth it only if memory says so. A fork test that writes
a disk end to end (the +3, the Beta 128) is still missing; `republishDisks` is tested on the machines.

**Phase 8:** status bar ("⟲ −1.24 s · step −3,412", "▶ Replaying", "Reverse range"), Take over here
button and fork confirmation (incl. D12's fork-on-edit), desync toast, progress/cancel for Reverse
Continue, a marker for deep landings, settings-page rows, docs page,
`.ai/ui-theming-intent-and-lessons.md`, and **the competitive-analysis tables** (standing instruction).

**Open decisions to raise with the author:** whether Phase 8's fork confirmation should also offer to
skip the SD revert (today a fork always reverts); T15 (stale "last port" after replays: write the fields
unconditionally vs clear the event flag), whether to push FAST_LOAD only on change (one journal entry
per run today), and whether Reverse Continue needs a C-side collect mode for speed.

## 5. Things that bit the previous session

- **Positions have a phase** (T16): a frame can end inside `ED 78`. Never compare positions by sequence
  alone; use `comparePositions`.
- **Several states share one position** (T21): replays land *after* all inputs at that position.
  Tests that snapshot the live machine must avoid positions where an input lands next.
- **The ring is shorter than a keyframe interval** (T22): never assume the ring holds a keyframe's
  position. Navigation restores the snapshotted view ring; deep targets use `landAt`.
- **Image comparisons** must mask: volatile statics (via `captureWasmImage`), the C stack
  (`layout.stack`), the CPU bus-event fields after debug-loop runs (T15), and the audio scratch tails.
  The picture and layer buffers are *kept* on purpose (D18).
- **Scratch is only what the T5 proof covers:** the beeper transition buffers looked like scratch but
  carry state across frames (Phase 0 was wrong about them).
- **Changing `z80-history-exports.cjs` means rebuilding all 7 cores** (`npm run build:<core>-wasm` for
  sp48, timex, sp128, spp3e, zxnext, z88, zx8081) and updating test doubles that fake core exports
  (`test/zxSpectrum/*-wasm-v2-loader.test.ts`).
- **Tests redirect `HOME`** (`test/vitest.setup.ts`): use `os.userInfo().homedir` for real files.
- **Controller tests:** a controller started from `None`/`Stopped` hard-resets the machine; set
  `controller.state = MachineControllerState.Paused` first, then `startDebug()`/`stepInto()` and poll for
  `Paused`. Helpers live in the `test/emu/reverse-*.test.ts` files.
- **A cursor the ring cannot hold clears itself - and clearing it returns to the present.** A replay run
  that stopped older than the present's ring did exactly that until Phase 6 (D11, D17). Anything that
  attaches a cursor must check `timeline.viewHolds` first.
- **The recorder's self-check is only as good as the slot it reads** (T23, T24): staging writes into
  the next slot; a run's record changes its repeat count after the fact. A desync on a fresh core
  with an empty journal is a recorder bug - compare the replay without verification first.
- **Order host effects by what decides them.** SD writes are keyed by journal index, because the fork
  truncates the journal by index; tape-save notes by position, because several can share one journal
  index when no input lands between them.
- Host-side code that pushes into the core every frame becomes journal noise (T19) — keep host syncs
  push-on-change and assign mirrors through `super` setters.

## 6. Tests and commands

| What | Where / how |
| --- | --- |
| Export contract (every core) | `test/wasm/reverse/export-contract.test.ts` |
| Journal-replay determinism (every core; T5 proof on the 48K and Next) | `test/wasm/reverse/journal-replay-determinism.test.ts`; more seeds: `KLIVE_REVERSE_SEEDS=1-30` |
| T2 inputs journaled, NextReg `$02` reset replay | `test/wasm/reverse/journal-inputs.test.ts` |
| Timeline (step back, fork, hit counts, desync, transients) | `test/wasm/reverse/timeline.test.ts` |
| Controller lifecycle / 1,000 step backs + fork / Reverse Continue | `test/emu/reverse-{timeline,step-back,continue}-controller.test.ts` |
| SD card in a timeline (T3 wait, journaled reads, fork restores the image) | `test/emu/reverse-sd-fork-controller.test.ts`; `test/emu/reverse-sd-undo-log.test.ts` (unit) |
| Disk republish | `test/sp128-hw/beta128/wd1793.test.ts`, `test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts` |
| Every Phase 7 machine through the controller (step back, step into/continue from the past, fork) | `test/emu/reverse-cores-controller.test.ts` |
| NextReg and Copper breakpoints in Reverse Continue | `test/emu/reverse-next-breakpoints-controller.test.ts` |
| Measurements (dev flag) | `KLIVE_REVERSE_SPIKE=1` (Phase 0) or `KLIVE_REVERSE_SESSION=1` (10-minute gate) `npm test -- test/reverse/reverse-spike-measure.test.ts`; `KLIVE_REVERSE_SPIKE_OUT=<file.json>` writes results |

All of these are in `build/e2e-tests.ts`. Run focused tests first, then `npm run build:check`,
`npm run lint:renderer` for renderer changes, and the full `npm test`.

## 7. Standing instructions that apply here

- When G4.4 is complete (Phase 8): update §2 and §4 of
  `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` and mark G4.4 done in `.plans/CLOSING_THE_GAPS_PLAN.md`.
- Any style/visual change updates `.ai/ui-theming-intent-and-lessons.md` in the same change.
- Record each phase's results in a new numbered section of the plan and revise decisions/traps in
  place ("Since Phase N: …"), as Phases 0–5 did; keep the roadmap line in
  `.plans/CLOSING_THE_GAPS_PLAN.md` (Wave 4, G4.4) current.
