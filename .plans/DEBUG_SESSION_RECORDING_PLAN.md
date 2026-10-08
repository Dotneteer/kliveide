# Debug Session Recording Plan: Saving and Reopening a Reverse-Debugging Timeline

Status: **decisions recorded** (2026-10-08). D1–D20 are the decisions; the author accepted the
suggested answers to all §9 questions, which the decisions already assumed. Nothing is
implemented. **Prerequisite:** G4.4 Phase 6 (the Next's SD journal and undo log) for the Next; the
48K can go first (§5).

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G4.6**: save a reverse-debugging timeline
  (keyframes and the input journal, with the SD sector data) to a file, so a bug repro replays later
  with the debugger attached - "an RZX for every machine, with breakpoints". It replays only on the
  same Klive build.

Builds on:
- [REVERSE_DEBUGGING_PLAN.md](REVERSE_DEBUGGING_PLAN.md) (G4.4): the `Timeline`, `KeyframeStore`,
  `InputJournal`, `ReplayEngine`, the export contract and positions. Its D21 defines this item; its
  D9 (replay verifies itself) is what makes a saved timeline trustworthy.
- [SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md](SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md) (G2.6): the
  `.kls` chunked container, the layout fingerprint, the load flow (fit the machine, the project
  guard, the SD-card fingerprint) and the `.kls` viewer.
- [RZX_PLAN.md](RZX_PLAN.md) (G2.7/G2.8): the user model of a recording (play it under the debugger,
  "record from here" to take over).
- [TRACE_EXPORT_PLAN.md](TRACE_EXPORT_PLAN.md) (G4.5): nothing shared in code; §1.2 notes how the two
  meet.

Not in scope:
- Portability across Klive builds. A recording is a bug report, not an archive (D3).
- Converting a recording to RZX (the reverse is not needed either: an RZX already replays).
- Rendering a recording to video. The screen recorder could drive a replay like RZX's D17; it is a
  later item if anyone asks.
- The C64 (it has no reverse debugging).

---

## 1. What is being added, and why

G4.4 makes a debug session a timeline: every keyframe and every input since the session started.
Today the timeline lives in memory and dies with the session (`Timeline.end()` frees it). G4.6 writes
it to a file, so that:

- a user who hit a bug can **send the whole session**: the receiver opens the file and is in the
  debugger at the moment the sender saved, with Step Back, Reverse Continue and reverse watchpoints
  reaching back to the start of the recording, on a machine that is exactly the sender's;
- a developer can **keep a repro** of an intermittent bug and come back to it tomorrow;
- the replay needs **nothing but the file**: the Next's SD sector reads, the tape and every key press
  are in the journal, so it replays even without the sender's SD card image or tape.

Compared with RZX, which Klive already plays on the Spectrum cores: RZX is portable between
emulators, but it holds only IN values and one or a few snapshots, it exists only for the Spectrum,
and stepping backwards in it is impossible. A Klive debug recording runs on every machine with
reverse debugging, carries keyframes for fast navigation, and includes breakpoints - but it opens
only in the Klive build that wrote it.

### 1.1 What the code has and lacks (2026-10-08)

| Needed | Exists | Missing |
| --- | --- | --- |
| The timeline's data | `KeyframeStore` (page pool, keyframe tables with `seed`, `journalIndex`, `meta`), `InputJournal` (`call` and `write` entries keyed by `TimelinePosition`), the hit log, the host-file list, the present's ring snapshot | All of it is private to `Timeline`; no export or import API; `end()` frees it |
| A container | `kliveStateFile.ts` (`KLIVESTA` magic, header JSON, tagged sections, fflate) | A second container, or a generalised one (D4) |
| Build identity | The layout fingerprint (`klive.layout` section, `wasmLayout.ts`) | The fingerprint covers data-symbol addresses, not code: a code-only change keeps it. Replay needs the **code** to be identical (D3, T1) |
| Breakpoints | `DebugSupport.breakpointDefs`, `DebugTimelineState` (hit counts and one-shots by storage key), project persistence (`DebuggerState`, `withoutBreakpointRuntimeState`) | Bundling every owner's breakpoints with a recording, and an owner for them on load (D11) |
| SD data | G4.4 Phase 6: sector reads enter the journal as `write` entries with their 512 bytes; writes are undo-logged and acknowledged from the journal in replay | Phase 6 must be finished (the SD wait disagreement, T3 of G4.4) before Next recordings are trusted |
| Machines | `MF_REVERSE_DEBUG` on the 48K and the Next | Each further core (G4.4 Phase 7) gets recordings for free |

### 1.2 Decisions

| # | Decision |
| --- | --- |
| D1 | **A recording is a serialised timeline**, nothing more: keyframes, the page pool, the journal, the hit log, the present's position and ring, and the breakpoints. Opening it builds a `Timeline` in memory exactly as if the session had just run, so every G4.3/G4.4 command works on it unchanged. No second replay engine, no "playback mode". |
| D2 | **The extension is `.klr`** (Klive recording), with `debug-recording-save` / `drsave` and `debug-recording-load` / `drload`, **Debug → Save Debug Recording…** and **Debug → Open Debug Recording…** (Q1). |
| D3 | **Same build only, checked strictly.** A recording opens only when every identity matches: the Klive version, the core id, the layout fingerprint, and a new **code hash** of the core (`wasm-layout.cjs` adds a SHA-256 over the code and data sections to the `klive.layout` stamp, outside the fingerprint so `.kls` files are unaffected). It also records a hash of the **export contract's journaled names** (journal entries name exports, T2). A mismatch is refused with "recorded by Klive x.y (build …); this build differs", and offers D16's fallback. |
| D4 | **The container is the `.kls` container, generalised.** `kliveStateFile.ts`'s framing (magic, version, header JSON, `{tag, length, payload}` sections, unknown sections skipped) moves to a shared `chunkedContainer.ts`; `.kls` keeps its magic `KLIVESTA` and its bytes do not change (a golden test); `.klr` uses `KLIVEREC`. |
| D5 | **Sections** (§4.1): `HEAD` (JSON header), `THMB` (the thumbnail at the saved present), `PAGE` (the page pool), `KEYF` (keyframe tables), `JRNL` (the journal), `HITS` (the hit log), `RING` (the present's history ring), `BRKP` (breakpoints), `MEDI` (media references), `SRCS` (the compilation's identity), `NOTE` (the user's description), `END ` (a SHA-256 of everything before it). Every bulk section is deflated with fflate (D6). |
| D6 | **Pages are compressed on disk, not in memory.** G4.4 D6 rejected in-memory compression because every restore would inflate thousands of pages. On disk the trade-off is the other way: a file is read once, and render buffers and mostly-zero RAM compress well. The pool is written as one deflate stream of the referenced pages (shared pages once), then inflated into the in-memory pool on load. |
| D7 | **What is saved: the retained keyframes, optionally thinned.** By default every non-transient keyframe the budget kept. `-sparse` keeps only keyframes about one second of replay apart (and always the first and the last); the rest are regenerated lazily (D9). Transient keyframes are never saved. Measured sizes decide the default in Phase 0 (Q3). |
| D8 | **A range can be trimmed from the front.** `-from <-n|#seq>` drops everything before the last keyframe at or before that point: that keyframe becomes the recording's base, the journal before it is dropped, the hit log is rebased. The end is always the present: a recording ends where the user saved it (Q4). |
| D9 | **Loading verifies lazily, as replay always does.** The loaded timeline's replays check the ring and every keyframe they pass (G4.4 D9), so a broken file or an unnoticed build difference shows up as a desync at the first replay that crosses it, never as a silently wrong past. `drload -verify` replays the whole recording once from the base, checking every saved keyframe, and with `-sparse` files also re-creates the thinned keyframes; it reports progress and can be cancelled. |
| D10 | **Opening lands at the saved present, paused, with the debugger attached.** That is the moment the sender chose to save - usually the bug. `-start` lands at the base keyframe instead, and Continue then replays forward with breakpoints active (G4.4 D11), which is the "replay with the debugger attached" of the roadmap. The status bar shows the recording's name while its timeline is active. |
| D11 | **Breakpoints travel with the recording, as session breakpoints.** `BRKP` holds every enabled and disabled breakpoint of every owner (project, `.nex` sidecar, annotation, session), runtime state stripped (`withoutBreakpointRuntimeState`), with the schema version. On load they are restored with owner `session`, so they never leak into the project file, and the hit counts in keyframes and the hit log apply to them by storage key (T5). `-nobreakpoints` loads the recording with the current breakpoints instead, and then hit counts restart from zero (the keyframe counters are for other breakpoints). Watches go along in `BRKP` too and are added, not replaced (Q5). |
| D12 | **Going past the end is ordinary.** At the end of the journal the timeline goes live (G4.4 D11): the recording becomes the past of a new session, and saving again writes the extended timeline. Take over here works anywhere in it. Live input then reaches the machine; for the Next this is when the SD card matters again (D14). |
| D13 | **Sources are identified, not embedded.** `SRCS` holds the compilation's main file, every source file's project-relative path and SHA-256, and the compiler. On load with a project open, mismatching files are listed ("labels and source lines may not match: `main.asm` differs") and stepping still works on the disassembly. `-sources` embeds the source files themselves (UTF-8, deflated) for a self-contained bug report; the viewer can then show them read-only (Q6). The debug info a recording needs to map addresses to lines comes from the current compilation; with `-sources` it is rebuilt from the embedded files by compiling them into memory only if a project is not open. |
| D14 | **The Next's SD card is not embedded but not needed.** Every sector the recorded run read is in the journal (G4.4 D14), so the whole recording replays without the card. `MEDI` holds the `.cim` reference and its fingerprint (G2.6 D12). Going live past the end (D12) needs a card: if the referenced card is present and matches, it is attached; otherwise the machine continues with **no card** and the output says so. A recording never writes to the receiver's card during replay (writes are acknowledged from the journal). |
| D15 | **Other media are already in the timeline.** Tape uploads, +3 and Beta 128 disk images and Z88 cards live in the core image or arrive as journaled writes, so they are in the keyframes and the journal. Their file references go into `MEDI` for display only; disk write-back is detached on load, as a `.kls` load does (G2.6 D11), so replaying another user's session never writes into a local `.dsk`. |
| D16 | **The fallback on a build mismatch is the end state.** A `.klr` also carries a `.kls` of its present (G2.6's container bytes in a `KLS ` section, about 100-250 KB). When D3 refuses the timeline, the user can open just that state, with `.kls`'s own rules (the image when its fingerprint matches, else the `.szx` part on Spectrum machines). It is a bookmark of the bug, without the past. |
| D17 | **Saving pauses briefly, never ends the session.** Like a state save (G2.6 D4): a Running machine is paused, the timeline serialised, the machine resumed. The data is copied out of the pool synchronously (references taken, then the deflate runs over immutable pages), so the session can continue while the file is written. Saving needs an active timeline: "Start the machine with debugging; recordings come from reverse debugging." |
| D18 | **A recording may hold private data, and the save says so.** Everything typed, every SD sector read, and (with `-sources`) the sources. The save dialog's description line and the docs say so; nothing else is done about it. |
| D19 | **A viewer for `.klr`**, like the `.kls` viewer: thumbnail, machine and model, Klive build, length (frames, seconds, records), keyframe count, file size, breakpoints, media, sources, the note, and whether *this* build can open it (unlike `.kls`, it can tell: the code hash of the running core is known to the emulator, D3). Open (at the end) and Open at start buttons; Explorer menu and drag and drop. |
| D20 | **Machines light up with `MF_REVERSE_DEBUG`.** No per-machine code beyond what G4.4 Phase 7 adds; the 48K first, then the Next after G4.4 Phase 6. |

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Timeline | `src/emu/machines/reverse/Timeline.ts` (`start`, `end`, `takeKeyframe`, `fork`, private `hitLog`, `hostFiles`, `present`); `KeyframeStore.ts` (pool, `refs`, keyframe tables, plans, budget); `InputJournal.ts` (entry types); `timelinePosition.ts` (`TimelinePosition`, `PositionSeed`, ring snapshots); `SdUndoLog.ts`; `ReplayEngine.ts` |
| Controller | `MachineController.ts`: `ensureTimeline`/`endTimeline`, `takeOverHere`, `beginRunFromPast`, `reverseContinueByReplay` |
| Machines | `TimelineMachine` on `ZxSpectrum48WasmV2Machine.ts` and `ZxNextWasmV2Machine.ts` (`captureHostState`, `restoreHostState`, `reverseCoreId`) |
| Identity | `scripts/wasm-layout.cjs` (`computeWasmLayout`), `src/emu/machines/state/wasmLayout.ts` (`WasmLayout`), `exportContract.ts` |
| Container | `src/common/machineState/kliveStateFile.ts`, `machineStateTypes.ts` |
| State save/load flow | `src/renderer/appEmu/machines/machineStateFile.ts` (fit machine, SD fingerprint, `.szx` fallback); `MachineStateCommands.ts`; `src/main/machine-menus/state-menus.ts` |
| Breakpoints | `DebugSupport.ts` (`breakpointDefs`, `captureTimelineState`/`restoreTimelineState`); `src/common/abstractions/BreakpointInfo.ts` (owners); `breakpoint-filters.ts` (`withoutBreakpointRuntimeState`); Emu API `listBreakpoints`/`restoreBreakpoints` |
| Viewer | `DocumentPanels/MachineState/` (the `.kls` viewer and `MachineStateLaunchMenu.tsx`) |
| Menus | `src/main/menus/debug-menu.ts` |

---

## 3. The traps

1. **T1: The fingerprint does not pin the code.** It hashes the data-symbol map, the function table
   and the memory size; a change inside a function body keeps it, by design (it guards state files).
   A replay across such a change can desync or, worse, replay plausibly and wrongly between two
   keyframe checks. D3's code hash closes it.
2. **T2: The journal names exports.** A `call` entry stores the export's name and arguments. A
   renamed export, or one whose arguments changed meaning, breaks a recording even when the core
   code is otherwise the same. The code hash covers it in practice; the contract hash makes the
   message precise. On disk, names are stored once in a table and entries refer to them by index.
3. **T3: Positions use 64-bit sequences.** `TimelinePosition.sequence` is a JS number below 2^53;
   the file stores it as a u64 and the reader refuses anything above `Number.MAX_SAFE_INTEGER`. The
   recorder's sequence after a load is reseeded from the keyframe (G4.4 T6), so a loaded timeline
   continues the recording's numbering.
4. **T4: The ring is volatile, and the present's ring is the history views' ring** (G4.4 D17). A
   recording without `RING` would open with an empty Execution History document until the first
   navigation. `RING` stores the present's ring snapshot (4-8 MB, compressing well); with `-from`
   (D8) records before the new base are dropped from it.
5. **T5: Hit counts are keyed by breakpoint storage key.** Keyframe `meta.debug` and the hit log
   refer to breakpoints by `getBreakpointStorageKey`. If D11's reowning to `session` changes the key,
   every count is lost. Phase 2 checks what the key covers; if it includes the owner, the loader maps
   old keys to new ones while restoring.
6. **T6: Host state is JSON from the machine.** `captureHostState()` returns machine-specific fields
   (`normalFrames`, the Next's `sdCardInfoLoaded`, …). They are written as JSON per keyframe; a field
   added in a later build is covered by D3 (same build only), so no schema versioning is needed.
7. **T7: Settings that are not inputs.** Anything the host pushes into the core goes through a
   journaled export (G4.4 D7), so it is in the journal. What is *not* pushed but changes how the
   controller drives the machine - `emuOptions.reverseDebugMemoryMb`, the keyframe interval, the
   throttle - does not affect the machine's path. The machine configuration (model, ROMs, attached
   devices) is in `HEAD` and the loader fits the machine to it, as `.kls` does; a ROM file the
   receiver does not have is not a problem, because the ROM is in the image.
8. **T8: Floating point.** Audio filters in the cores use floats. WebAssembly arithmetic is
   deterministic across hosts except for NaN bit patterns, which no core inspects; the determinism
   tests run on one host only. Phase 4 records a session on one architecture (Apple Silicon) and
   replays it on another (x64 CI) to prove it.
9. **T9: File size.** In memory a ten-minute Next session can reach the 512 MB budget (G4.4 §13). On
   disk the pool deflates; the render buffers change every frame and dominate. Phase 0 measures the
   six workloads of G4.4 §10 at deflate levels 1, 6 and 9 and with `-sparse`, and sets D7's default.
   A file above 2 GB is refused (the IPC and `saveBinaryFile` path holds the whole file in memory);
   the message suggests `-from` or `-sparse`.
10. **T10: Saving must not stall a running session.** Deflating hundreds of MB takes seconds. D17
    copies references synchronously and deflates afterwards; pages are immutable once in the pool,
    and a page evicted meanwhile is kept alive by the save's own reference. The deflate runs in
    chunks between frames (or in a worker, if Phase 1 shows the frame loop stutters).
11. **T11: A recording loaded into a project with other code.** Breakpoints with `resource`/`line`
    resolve against the current sources (D13). If the receiver's sources differ, a source breakpoint
    may land elsewhere; address breakpoints are exact. The load lists D13's mismatches before the
    first step so nobody is misled.
12. **T12: Ending the timeline frees the loaded data.** A loaded recording is a timeline like any
    other: Stop, Reset, a machine change or a state load end it (G4.4 D2). Ending one that came from
    a file loses nothing (the file is still there); ending one extended past its end loses the
    extension unless saved, and the stop asks only if the timeline has unsaved live frames (Q7).

---

## 4. Design

### 4.1 The file (`src/common/debugRecording/debugRecordingFile.ts`, pure)

```
"KLIVEREC" u16 containerVersion=1 u16 flags         (chunkedContainer.ts, D4)
HEAD  JSON { machineId, modelId, config, kliveVersion, coreId, fingerprint, codeHash,
             contractHash, memorySize, pageSize, savedAt, description?,
             base: position, present: position, frames, seconds, records,
             keyframes, sparse, from? }
THMB  u16 w, u16 h, RGBA                          (as .kls)
PAGE  deflate( u32 count, then count × pageSize bytes )   referenced pages only, renumbered
KEYF  deflate( per keyframe: id, seed{position, newest[64]?}, journalIndex, complete,
               pages: Int32 page indices (-1 = absent), meta JSON {host, debug, hitLogIndex} )
JRNL  deflate( names table; per entry: kind, position(u64 seq, u32 sub, u8 phase),
               call: nameIndex, args (varint list) | write: address, length, fill | bytes )
HITS  deflate( per hit: position, key index into a key table )
RING  deflate( the present's RingSnapshot: view header + records )
BRKP  JSON { schemaVersion, breakpoints: BreakpointInfo[], watches }
MEDI  JSON [{ id, fileName, fingerprint, size, kind }]
SRCS  JSON { compiler, mainFile, files: [{ path, sha256 }] }  (+ deflated sources with -sources)
KLS   the .kls bytes of the present (D16)
NOTE  UTF-8 text
END   SHA-256 of all preceding bytes
```

- `writeDebugRecording(parts)` / `readDebugRecording(bytes)`; the reader validates framing, lengths
  and the `END ` hash (a truncated or edited file is refused, not replayed).
- Tested without a machine, including a `.kls` byte-for-byte golden after the D4 refactor.

### 4.2 Timeline export and import (`src/emu/machines/reverse/`)

- `TimelineSnapshot` (in-memory, not bytes): `{ keyframes, pages, journal, hitLog, present, ring,
  base, hostFiles }`, with pages as references into the pool.
- `Timeline.exportSnapshot({ from?, sparse? })`: requires `mode === "live"` or a paused machine at
  any position (a save from the past saves the whole timeline and remembers the cursor in `HEAD` so
  the load can land there too); takes references (T10).
- `KeyframeStore.exportPages(keyframes)` / `importPages(...)`; `InputJournal.encode` / `decode`.
- `Timeline.fromSnapshot(machine, snapshot, options)`: a second constructor path. It installs the
  journal wrapper, restores the pool and tables, sets the recorder's position from the last
  keyframe's seed, restores the present by replaying from the last keyframe to `present` (the same
  `replayTo`), puts `RING` back as the present's ring, and leaves the timeline `live` at the end -
  or navigates to the base for `-start` (D10).

### 4.3 Identity

- `scripts/wasm-layout.cjs`: `codeHash` (SHA-256 over the module's code and data sections, before
  the custom section is appended) in the `klive.layout` stamp; `WasmLayout.codeHash` in
  `wasmLayout.ts`. Rebuild all seven cores.
- `exportContract.ts`: `journaledContractHash(coreId)` over the sorted journaled names.

### 4.4 Orchestration (`src/renderer/appEmu/machines/debugRecordingFile.ts`)

- **Save:** guards (D17), pause if Running, `exportSnapshot`, the `.kls` of the present
  (`saveMachineStateFile`'s capture), breakpoints (`listBreakpoints`), media, sources (via the IDE),
  resume, deflate, write with `saveBinaryFile`.
- **Load:** read and check (D3) → project guard and machine fit (copied from
  `loadMachineStateFile`) → end any timeline → restore the base image (`restoreState`,
  `{ attachMedia: false }`) → restore breakpoints (D11) → `Timeline.fromSnapshot` → land (D10) →
  media and source reports (D13–D15). On D3's refusal: return a result offering D16's fallback; the
  command asks (`-y` accepts).
- Emu API: `saveDebugRecording(options)` returns bytes; `loadDebugRecording(bytes, options)`.

### 4.5 User surface

- Commands (`DebugRecordingCommands.ts`):
  - `debug-recording-save <file> [-from <-n|#seq>] [-sparse] [-sources] [-note <text>] [-f]` (`drsave`);
  - `debug-recording-load <file> [-start] [-verify] [-nobreakpoints] [-y]` (`drload`).
- Debug menu: **Save Debug Recording…** (enabled while a timeline is active), **Open Debug
  Recording…**; save dialogs in main as in `state-menus.ts`.
- Viewer (D19) with **Open** and **Open at start**; Explorer menu; drag and drop of `.klr`.
- Status bar: the recording's name while its timeline is active (Phase 8 of G4.4 owns the
  status-bar segment; this adds a label to it).
- Docs: `docs/content/howto/debug-recordings.mdx` (making a bug report: start with debugging,
  reproduce, pause at the bug, save; what is in the file; same-build rule; the fallback) and the
  command reference.

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 0 — Measure | `Timeline.exportSnapshot` in memory only; serialise G4.4 §10's six workloads (48K now; the three Next ones after G4.4 Phase 6) with deflate 1/6/9, full and sparse; time the save and the load | Sizes and times recorded in §10; D6, D7 and T9 revised; go/no-go on the default |
| 1 — Format | `chunkedContainer.ts` (D4) with the `.kls` golden; `debugRecordingFile.ts` (§4.1) | `node` tests: round trip, every section, truncation and hash refusal, u64 positions |
| 2 — Timeline round trip (48K) | Code hash and contract hash (§4.3); `exportSnapshot` / `fromSnapshot`; breakpoint bundling and the T5 key check | e2e: a 48K session with keys, a tape load and memory edits, saved and loaded into a **fresh** machine and controller; 1,000 Step Backs from the loaded present equal the original's at every step (G4.4 Phase 4's test, run on the loaded timeline); Reverse Continue with a memory watchpoint lands on the same write; an `every 3rd hit` breakpoint's counts match; a flipped code hash is refused; a flipped journal byte (with the `END ` hash recomputed) is caught as a desync |
| 3 — User surface | Commands, menus, viewer, drag and drop, status label, docs | `jsdom` viewer test; command tests; checked in the running IDE (CDP) on the 48K |
| 4 — The Next | After G4.4 Phase 6: SD-backed sessions, D14's card handling | e2e: a NextZXOS session that reads files from the card, saved, then loaded **with no card attached**, replays from base to present without a desync; going live past the end with the card missing reports it; a recording made on macOS replays in CI on x64 (T8) |
| 5 — Further cores and wrap-up | Each core that G4.4 Phase 7 enables gets the Phase 2 round-trip test; roadmap and competitive analysis | Round trip green on every `MF_REVERSE_DEBUG` core |

---

## 6. Tests

- **Format** (`test/debugRecording/`): as Phase 1.
- **Round trip on the real cores** (`test/emu/debug-recording-*.test.ts`, listed in
  `build/e2e-tests.ts`): as Phases 2 and 4. The comparison is G4.4's: the whole image minus volatile
  statics, the C stack and the bus-event fields (G4.4 handoff §5).
- **Identity**: the layout stamp carries a code hash that changes when only a function body changes
  (a test builds nothing; it compares two stamps from fixtures) and leaves the fingerprint alone.
- **Commands and UI**: guards, overwrite, the fallback prompt, the viewer's "opens in this build".

---

## 7. Effort

**M**, as the roadmap says, once G4.4 Phase 6 is in: about two to three weeks. Phase 2 is the bulk
(the timeline's private state, breakpoints and identity); the user surface copies the `.kls` one.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Files too large to send | Phase 0 measures; `-sparse` and `-from`; the D16 end state alone is small |
| A replay silently wrong after a build change | D3's code hash; D9's verification at every replay; `-verify` |
| Breakpoints or sources from the sender mislead the receiver | D11 session owner; D13's mismatch list before the first step |
| Private data shared unknowingly | D18's notice |

---

## 9. Questions (all answered, 2026-10-08: the suggested answers)

1. **Q1 — Names.** `.klr`, `debug-recording-save`/`drsave`, `debug-recording-load`/`drload`, "Debug
   Recording" in menus (suggested)? Alternatives: `.kdr`, "Session Recording".
2. **Q2 — Strict identity.** Refuse on any code-hash difference (suggested, D3), or allow a
   "try anyway" that relies on D9's verification to catch a desync?
3. **Q3 — Default keyframe density.** All retained keyframes (suggested until Phase 0 says files are
   too large), or sparse by default?
4. **Q4 — Trimming.** Only from the front with `-from` (suggested); the end is always the present.
   Should a save from the past (cursor set) also allow cutting the future off?
5. **Q5 — Breakpoints on load.** Loaded as session breakpoints, replacing none of the project's but
   shown alongside them (suggested), or replacing the current breakpoints for as long as the
   recording's timeline lives?
6. **Q6 — Sources.** Identified by hash, embedded only with `-sources` (suggested), or embedded by
   default so a bug report is always self-contained?
7. **Q7 — Unsaved extension.** When a loaded recording was continued live and the timeline is about
   to end, ask to save (suggested only for timelines that came from a file), or never ask?
