# RZX Playback (G2.7) and Recording (G2.8) Plan

Status: **planned** (2026-10-04). Nothing is implemented. Decisions D1–D20 are accepted.
Scope: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md):
- **G2.7**: play an `.rzx` input recording on the 48K, 128K and +2E/+3E;
- **G2.8**: record one, with periodic snapshots, rollback and finalising;
- and pair playback with the existing emulator video recording, so a recording can be rendered to a
  video file.

Builds on the finished [ZX_SPECTRUM_SNAPSHOT_PLAN.md](ZX_SPECTRUM_SNAPSHOT_PLAN.md) (loading `.z80`/
`.szx`, machine fitting) and the G2.4 half of
[SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md](SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md) (capture and the
`.szx` writer). It does **not** need G2.6 state files or the Wave 4 deterministic-replay spike
(§1.3).

Format reference (normative; the reader and writer are written from it, in Klive's own words):
- RZX v0.13: <https://worldofspectrum.net/RZXformat.html>

Behaviour references. These were read to learn facts only; their code is not copied, converted or
used as a design template (the same discipline as D3/D4 of the roadmap):
- Fuse 1.10.0 and libspectrum (playback conventions, desync handling, autosave and rollback):
  <https://sourceforge.net/p/fuse-emulator/fuse/ci/master/tree/ChangeLog>, bugs
  [#304](https://sourceforge.net/p/fuse-emulator/bugs/304/),
  [#336](https://sourceforge.net/p/fuse-emulator/bugs/336/),
  [#508](https://sourceforge.net/p/fuse-emulator/bugs/508/);
- SkoolKit's `rzxplay.py` options, which list known real-world quirks:
  <https://skoolkit.ca/docs/skoolkit/commands.html>.

---

## 1. What is being added, and why

An RZX file is a snapshot followed by every value the CPU read with an `IN` instruction, grouped
into frames. Each frame stores how many opcode fetches happen before the next interrupt, and the
values read. Playback loads the snapshot, answers every `IN` from the recording, and raises the
interrupt when the fetch count is reached. Because every external input is replayed, the program
takes exactly the same path. That holds whatever the peripheral timing is, so recordings play across
emulators.

Users get:
- **Playback** of the RZX Archive's thousands of verified game playthroughs, and of recordings people
  attach to bug reports;
- **debugging inside a recording**. Breakpoints, stepping and every panel work while a recording plays,
  which few emulators offer (D10);
- **recording** of their own sessions for exact replay, for bug reports and for playthroughs;
- **rendering a recording to video**: a longplay, without playing it in real time (D17–D19).

The competitive analysis (§2 row "RZX recording / playback", §4 W5) lists RZX as the last part of the
snapshot gap.

### 1.1 The format, in brief

Little-endian. The header is `"RZX!"`, version 0.13, then a DWORD of flags (b0: signed). Blocks
follow, each one an ID byte, a DWORD length (including those 5 bytes), then the data:

| ID | Block | Contents | Klive |
| --- | --- | --- | --- |
| `0x10` | Creator | ASCIIZ[20] name, WORD major, WORD minor, custom data | read: shown in the viewer; written: "Klive IDE" plus the version |
| `0x20` | Security information | key ID, week code | skipped, with a note (D6) |
| `0x21` | Security signature | DSA r, s | skipped, with a note (D6) |
| `0x30` | Snapshot | DWORD flags (b0 external, b1 zlib), ASCIIZ[4] extension, DWORD uncompressed length, data | `.z80`/`.sna`/`.szx` through the existing parsers; external descriptors refused (D5) |
| `0x80` | Input recording | DWORD frame count, reserved BYTE, DWORD T-state counter at start, DWORD flags (b0 protected, b1 zlib), frames | b0 refused (D5) |

A frame is WORD fetch count, WORD IN count, then the IN bytes. An IN count of `65535` means the frame
repeats the INs of the last non-repeated frame in the same block, and no bytes follow. A repeat frame
first in a block is invalid. Several snapshot/input pairs may follow one another.

**The fetch count** is the number of R-register increments before the interrupt, excluding the
interrupt acknowledge:
- +1 per unprefixed opcode;
- +2 for a CB/ED/DD/FD-prefixed one;
- +2 for DDCB/FDCB, because the displacement and the last byte are not M1 fetches;
- +1 for each extra chained DD/FD prefix;
- +1 for every 4T cycle spent in HALT.

It is 16-bit and does not wrap at 128 like R.

### 1.2 What the code already has

| Concern | Where | Notes |
| --- | --- | --- |
| One Z80 for all three machines | `src/emu/z80/wasm/z80.c`, unity-included by `sp48.c:287-301`, `sp128.c:790-804`, `spp3e.c:776-790` | Hooks are `Z80_*` macros, documented at `z80.c:24-95` |
| One point for every CPU port read | `readPort()`, `z80.c:401-420` → `Z80_READ_PORT` → `sp48CpuReadPort` (`sp48.c:326`), `sp128ReadPort`, `spp3eReadPort` | Callers: `IN A,(n)` 1563, `IN r,(C)` 1701, `IN (C)` 1830, INI/IND/INIR/INDR 1893-1943. The debugger's `doReadPort` calls the *exported* `sp48ReadPort` directly, so RZX must tap the CPU wrapper, not the export |
| Fetch hook | `Z80_REFRESH(IR)`, default no-op at `z80.c:67-69` | Fires on every M1: an unprefixed fetch (3263), the opcode after a prefix (3276) and each HALT cycle (3251). DDCB/FDCB displacement and opcode are plain reads (3329-3338). **It also fires on the INT acknowledge (`processInt`, 883) and the NMI acknowledge (868).** Only the ZX81 defines it, so the Spectrum cores are free to use it |
| INT acknowledge hook | `Z80_INT_ACK()`, called first in `processInt` (876) | Lets the counter exclude the acknowledge |
| Interrupt and frame end | `sp48ExecuteInstruction` (`sp48.c:565-589`), `sp128.c:~1203-1241`, `spp3e.c:1805-1849` | INT while `currentFrameTact() < 32`; the frame ends on T-states (586). Both the fast path (`sp48ExecuteFrame`, 542) and the TS debug loop go through this function |
| Interrupt acceptance | `z80.c:3241` | Only with `prefix == NONE && iff1 && eiBacklog == 0`; a prefix is its own step |
| Tact rebasing | `sp48ShiftTactOrigin` (`sp48.c:453-490`) | Any new absolute tact field must be shifted with the others |
| Snapshot parse and write | `src/common/spectrum/snapshot/`: `parseSpectrumSnapshot`, `writeSpectrumSnapshot`, `szxWriter.ts` | Uses `fflate` for zlib |
| Snapshot load (machine switch, restore, start) | `src/renderer/appEmu/machines/spectrumSnapshotLoad.ts`; `machine.loadSnapshotState` / `captureSnapshotState` (48K `ZxSpectrum48WasmV2Machine.ts:968/986`, 128K :1066/1084, +3 :1332/1350) | Capture refuses a mid-prefix state |
| Mapping a snapshot to a machine | `spectrumSnapshotMapping.ts:35-73` | +2 runs on the 128K; +2A/+3 run on the +2E/+3E **with the +E ROMs** (warning) |
| Frame loop | `MachineController.run()` (`MachineController.ts:915-1124`) | Throttle at :986-1107; `beforeFrameDelay` (:1101) feeds the video recorder |
| Emulator video recording | `src/renderer/appEmu/recording/RecordingManager.ts`; `EmulatorPanel.tsx:350` | **Driven by emulated frames**: `submitFrame` runs once per completed frame from `beforeFrameDelay`, and audio is submitted per frame. It does not depend on the wall clock |
| Recording indicator | `RecordingStateOverlay.tsx`, `emulatorState.screenRecordingState` | The pattern for a PLAY/REC indicator |
| Snapshot UI | `SpectrumSnapshotCommand.ts`, `SpectrumSnapshotSaveCommand.ts`, `zx-specrum-menus.ts:523-633`, `dropped-file-action.ts:19`, `registry.ts:457-463, 779-827`, `SpectrumSnapshotLaunchMenu.tsx` | Reused for `.rzx` |
| Harnesses | `test/harness/sp48/` (keys, tape, snapshots), `test/harness/sp128/` | e2e tier listed in `build/e2e-tests.ts` |

### 1.3 Why this does not wait for Wave 4

The roadmap rated G2.7 "L (needs … fully deterministic emulation)" and tied it to the Wave 4
replay spike. RZX deliberately avoids that requirement. Every input comes from the file, and the
interrupt comes from a fetch count rather than a T-state. So playback needs only:
- an exact CPU, which the shared core already is, including undocumented flags;
- an exact snapshot restore, which G2.1–G2.3 already provide.

Peripheral timing, contention and the floating bus do not matter: their results are in the file. This
plan's round-trip test (Phase 3) is the determinism proof RZX needs. It is narrower than G2.6's
Phase 6, which proves "save, load, continue" identity for the whole machine.

### 1.4 Decisions

| # | Decision |
| --- | --- |
| D1 | **Playback and recording are both in scope**, built in one plan. |
| D2 | **Machine order: 48K (and 16K, NTSC) first, then 128K, then +2E/+3E.** |
| D3 | **Recording includes Fuse-style periodic snapshots, rollback and finalising.** Signing, security blocks and competition mode are out of scope. |
| D4 | **The fetch counter lives in the C core**, counted at `Z80_REFRESH` and corrected by `Z80_INT_ACK`. It is not derived from R: `LD R,A` and the acknowledge would make R wrong. The NMI acknowledge *is* counted, because the spec excludes only INTA. Fuse does the same. |
| D5 | **The reader refuses what cannot be played faithfully**, with a message naming the block: external snapshot descriptors (b0 of `0x30`), protected input blocks (b0 of `0x80`), a first-frame repeat, and a file with no snapshot. Fuse prompts for an external snapshot instead; Klive refuses, and may reconsider later. |
| D6 | **The reader is more lenient than libspectrum about unknown blocks.** It skips any block it does not know, using the block's length, and adds a note to the viewer. Archive files from newer Spectaculator versions carry such blocks (bug #336). |
| D7 | **The IN tap is in the CPU's port-read wrapper** (`sp48CpuReadPort` and its 128K/+3 equivalents), after all port merging, so it sees exactly what the CPU sees. The debugger's direct port reads are never recorded or replayed. |
| D8 | **The playback interrupt rule follows Fuse 1.10.** At a frame boundary the interrupt line is raised for one step. It is accepted only if IFF1 is set; under DI the frame just moves on. A pending EI delay is ignored at the boundary unless the *next* frame's fetch count is 4 or less (an EI or retrigger frame). Bug #508: this rule fixed 144 of Fuse's 202 failing test recordings. Live interrupts from the ULA are suppressed for the whole playback. |
| D9 | **The recording frame rule mirrors D8.** A frame is written at every ULA frame end, including DI frames, and also at each interrupt accepted later in the same INT window (a retrigger, or one postponed by EI). |
| D10 | **Playback runs in both the fast frame path and the debug loop.** Breakpoints stop it, stepping works, and every panel reads the real machine. Anything that changes machine state from outside the CPU ends playback, with a message (§3, trap 4). |
| D11 | **On a desync, playback stops and the machine pauses in the debugger.** The output names the frame, the expected and actual IN counts, and the creator. From there the user can continue live, as Fuse does, or inspect the machine. The CPU is left at the instruction that desynced, which makes this the most useful moment to stop. |
| D12 | **When the recording ends, the machine pauses.** It does not keep running on live input. The user can resume (live input) or start recording from there (D16). |
| D13 | **The tape fast-load trap is disabled during playback and recording.** Tape loading inside a recording runs at real speed (the EAR bit goes through IN). The trap writes RAM directly, without an IN. |
| D14 | **The clock multiplier is fixed at 1 while playing or recording** in this version. Turbo would change ULA frame length and break picture alignment, though not the program path. To be revisited (§9). Playback speed comes from the throttle (D18), not the CPU clock. |
| D15 | **The embedded snapshot is written as `.szx`** (G2.4's writer), as Fuse does. It holds the full peripheral state, and `.z80` would lose some of it. Every snapshot is zlib-compressed. |
| D16 | **"Record from here"**: a paused machine, including one paused at the end of or during a playback, can start a recording whose initial snapshot is that state. This is how a user takes over a recording, and it is the RZX convention for continuing one. |
| D17 | **"Render to video" pairs playback with the existing emulator screen recording.** Klive arms the screen recorder, plays the RZX from its first frame and stops the video when the recording ends or desyncs. The encoding options are the existing ones (fps, quality, format). Nothing new is added to the encoder. |
| D18 | **Rendering to video can run unthrottled** (as fast as the core allows). The video recorder is driven by emulated frames, not the wall clock, so the result is identical. Live audio output is muted while it runs, and the audio still goes into the file. |
| D19 | **One video frame per picture, not per RZX frame.** An RZX frame with a fetch count of 4 or less (an EI or retrigger frame) does not complete a picture. Otherwise the video would gain stutter frames. |
| D20 | **The IDE + emulator window recording is not automated.** It is wall-clock driven (`beginFrameSubscription`), so it can be started by hand during a normal-speed playback but cannot run unthrottled. |

### 1.5 Out of scope

- Signing, verifying signatures, and competition mode (D3).
- The ZX Spectrum Next, ZX80/81 and Z88. RZX has no conventions for them, and Copper or DMA activity
  does not go through `IN`.
- Pentagon, Scorpion and Timex recordings. They would arrive with G9.1/G9.4.
- The original Amstrad +2A/+3 ROMs. That is G9.2; until then, +2A/+3 recordings play on the +E ROMs
  with a warning (§3, trap 6).
- Seeking to an arbitrary frame. Jumping to an embedded snapshot (autosave point) is in scope
  (Phase 6); free seeking needs G4.4's keyframes.
- A CMOS Z80 mode for pre-6.25 Spectaculator recordings (§7).
- Per-creator compatibility workarounds (Fuse carries several for SPIN 0.5 and old Spectaculator).
  These may be added later only if the archive check (Phase 8) shows they are worth it.

### 1.6 Naming

- Files: `src/common/spectrum/rzx/` (pure) and `src/emu/machines/zxSpectrum/rzx/` (core-facing).
- C: `zx-spectrum-rzx.c` in `src/emu/machines/zxSpectrum/wasm/common/`, renamed per core with the same
  macro scheme as the shared ULA, port and tape files.
- Commands: `zx-rzx <file> [-d]` (play, or play under the debugger), `zx-rzx-record`, `zx-rzx-stop`,
  `zx-rzx-rollback [n]`, `zx-rzx-video <file>`.
- Menu: **Machine → RZX** (Play Recording…, Record, Stop and Save…, Insert Rollback Point, Roll Back,
  Render Recording to Video…), with Play Recording… also in **File**, beside Open Snapshot.

---

## 2. Current code paths this touches

| Concern | Change |
| --- | --- |
| `z80.c` | None. It already exposes `Z80_REFRESH` and `Z80_INT_ACK`. |
| `sp48.c`, `sp128.c`, `spp3e.c` | Define `Z80_REFRESH`/`Z80_INT_ACK` for the counter; wrap the CPU port read with the RZX tap; replace the INT source and frame end in `*ExecuteInstruction` while in RZX mode; include `zx-spectrum-rzx.c`; shift the new tact fields in `*ShiftTactOrigin`. |
| `scripts/build-{sp48,sp128,spp3e}-wasm.cjs`, `*WasmV2Loader.ts`, `scripts/check-wasm-cpu-contract.cjs`, `check-*-wasm-size.cjs` | New exports (§4.2); size budgets checked |
| `*WasmV2Machine.ts` (×3), `IAnyMachine.ts` | The `IRzxMachine` surface (§4.3) |
| `MachineController.ts` | RZX mode: no live keyboard sync, fast load off, multiplier pinned, an optional unthrottled mode, and playback ending or desync pausing the machine |
| `spectrumSnapshotLoad.ts` | Reused by playback for the embedded snapshot |
| `RecordingManager.ts`, `EmulatorPanel.tsx` | Render-to-video orchestration and automatic stop (§4.7) |
| `AppState.ts` / actions | `emulatorState.rzx` (§4.6) |
| Commands, menus, drop handling, registry, viewer | §4.6 |

---

## 3. The traps

1. **The interrupt acknowledge goes through `Z80_REFRESH`.** It must be subtracted, or every frame
   counts one too many (D4). The NMI acknowledge stays counted.
2. **A prefix is its own step.** The count can reach its target after a prefix byte. The frame ends
   only when the count has reached the target *and* `prefix == NONE`. The comparison is `>=`, not
   `==`, so an overshoot by a prefix still ends the frame at the next boundary. Interrupt acceptance
   has the same condition, so a recorded frame always ends at an instruction boundary.
3. **Tape fast load bypasses IN.** `fastLoadCurrentTapeBlock()` (`zx-spectrum-tape.c:451-507`) writes
   RAM and registers when PC hits `0x056C` (D13). Turn it off for the whole RZX session and restore the
   user's setting afterwards. The setting is pushed every run (`MachineController.ts:976`), so the
   override must sit where the setting is applied, not where the run starts.
4. **The IDE changes state outside the CPU.** These end playback with a message:
   - memory and register edits;
   - code injection (`injectCodeToRun`, `SetReturn`);
   - `setTacts`, snapshot loads, reset, a machine switch;
   - tape and disk changes;
   - frame commands that write state.

   Recording handles them the same way: the recording stops, the file keeps every complete frame,
   and the user is offered the save dialog. Breakpoints, stepping and reading panels never end
   either mode.
5. **The ULA picture is driven by T-states; RZX frames are driven by fetch counts.** At each
   playback frame boundary with a fetch count above 4, the picture is completed and the next frame's
   tact origin is set to the current tact (`NextFrameStartTact = tacts`), as Fuse does by
   subtracting the elapsed T-states. This keeps the interrupt at frame tact 0, where Klive's ULA
   expects it, and keeps contention and the border aligned. Frames with a count of 4 or less complete
   no picture (D19). An RZX frame much longer than a ULA frame must not let the tact counter run
   away: the existing rebasing covers the counter, and the picture is completed only at a boundary.
6. **The ROM is not in the file.** A recording made on a real +2A/+3 that calls ROM routines whose
   addresses differ in the +E ROMs will desync. This is a warning in the viewer and in the output,
   using the existing mapping (`spectrumSnapshotMapping.ts:58-71`), not a refusal. G9.2 removes it.
   A grey +2 on the 128K ROM is safe, because only the menu text differs.
7. **The +3 floppy controller drifts.** During playback the FDC's IN values are replayed, but its
   internal state does not follow. That is harmless to the program path. Disk changes during playback
   end it (trap 4). Disks are not needed to play a +3 recording, because their contents arrive
   through IN.
8. **The keyboard during playback.** The live keyboard is not synced into the core while playing (it
   would be overridden anyway), so a user typing during playback does nothing. It comes back when
   playback ends or desyncs.
9. **Buffer limits.** A tape loader can read thousands of ports per frame (about 6,000 at worst). The
   C buffers (§4.2) are sized for two ULA frames of worst-case INs. On overflow, the core sets an
   error flag and stops recording at the last complete frame, rather than truncating silently.
10. **Snapshots inside a recording are taken after interrupt processing** (Fuse bug #304). Other
    players treat a snapshot plus an input block as a self-contained start. Autosave and rollback
    points are therefore captured at a frame boundary, after the interrupt has been accepted.
11. **The initial T-state field.** Playback sets the frame tact from the input block's T-state
    counter. Recording writes the current frame tact. Each later input block (after a snapshot)
    carries its own value.
12. **`.z80` RAM page IDs from Spectaculator 6.1** (bug #336) are non-standard. The existing `.z80`
    parser decides; such files fail in the parser with its normal message.

---

## 4. Design

### 4.1 Format layer (pure): `src/common/spectrum/rzx/`

- `rzxModel.ts`: `RzxFile { version, flags, creator?, blocks: RzxBlock[], notes: string[] }`. A
  block is a creator, a snapshot (`{ extension, bytes, compressed }`), an input block
  (`{ tstates, frames: RzxFrame[] }`) or a skipped block. `RzxFrame { fetchCount, ins: Uint8Array }`
  stores repeat frames already expanded: the reader expands them, and the writer re-collapses them.
- `rzxFile.ts`: `parseRzxFile(bytes): RzxFile | RzxError`. It validates lengths, inflates zlib through
  `fflate`, expands repeat frames, applies D5/D6, and checks that each block's frame count matches its
  frames.
- `rzxWriter.ts`: `writeRzxFile(file, { compress: true })`. The creator block is written first. A
  frame identical to the previous non-repeated frame becomes a repeat frame, but only if its IN count
  is not 0.
- `rzxSegments.ts`: turns the block list into **segments** (a snapshot plus the input blocks until the
  next snapshot). Playback walks segments, and the viewer lists them as jump points.
- `rzxFinalise.ts`: drops the intermediate snapshots and merges adjacent input blocks, keeping the
  first snapshot (D3).

### 4.2 Core layer (C): `zx-spectrum-rzx.c`

State, in statics (renamed per core):
- `rzxMode` (OFF / PLAY / RECORD);
- the fetch counter (`uint32`), counted at `Z80_REFRESH` and decremented at `Z80_INT_ACK`;
- **playback:**
  - the current frame's target fetch count;
  - an IN buffer, its length and a read index;
  - the next frame's fetch count, for D8;
  - a status (OK / FRAME_DONE / DESYNC_OVER / DESYNC_UNDER / ENDED);
- **recording:**
  - a byte buffer for INs;
  - a small frame table `{ fetchCount, inCount }`;
  - an overflow flag.

Behaviour:
- **Port tap.** In PLAY, the next byte is returned from the buffer. Past the end, the core sets
  DESYNC_OVER, returns the live port value and ends the step's frame. In RECORD, the live value is
  appended.
- **INT and frame end in PLAY.** At each step, if `fetchCount >= target && prefix == NONE`:
  - check underrun (read index < length → DESYNC_UNDER);
  - set FRAME_DONE;
  - raise `sigInt` for this one step, with the EI rule from D8;
  - complete the picture when `target > 4`;
  - reset the counter.

  The T-state `shouldRaiseInterrupt` is not used.
- **INT and frame end in RECORD.** The normal ULA rules run unchanged. A frame is closed and
  appended to the table at each ULA frame end, and at each interrupt acceptance after the first in
  the same INT window (D9).
- **Fast path.** `*ExecuteFrame` returns at FRAME_DONE in PLAY, so one call is one RZX frame. TS then
  supplies the next one.

Exports (each in the C file, the build script's list and the loader's types):
- `rzxSetMode`;
- `rzxPlayBufferPtr`, `rzxPlayBufferCapacity`, `rzxSetPlayFrame(fetchCount, inCount, nextFetchCount)`;
- `rzxGetStatus`, `rzxGetFetchCount`, `rzxGetReadIndex`;
- `rzxRecBufferPtr`, `rzxRecFrameTablePtr`, `rzxGetRecFrameCount`, `rzxGetRecByteCount`,
  `rzxClearRec`, `rzxGetOverflow`.

### 4.3 Machine layer (TS)

`IRzxMachine` (optional on `IAnyMachine`, implemented by the three Spectrum machines through a shared
helper in `src/emu/machines/zxSpectrum/rzx/rzxCoreBridge.ts`):
- `rzxBeginPlayback()`, `rzxSupplyFrame(frame, nextFetchCount)`, `rzxPlaybackStatus()`;
- `rzxBeginRecording()`, `rzxDrainRecordedFrames(): RzxFrame[]`;
- `rzxEnd()`.

`executeMachineFrame` and the debug loop call the bridge:
- after FRAME_DONE, supply the next frame;
- after a recorded frame closes, drain;
- report `frameJustCompleted` only for picture frames (D19).

`RzxPlayer` (in `src/emu/machines/zxSpectrum/rzx/`) walks segments. At a segment's snapshot it uses
`loadSnapshotState`; this is a normal transition and does not end playback. It tracks frame N of M
and raises ended/desync events.

`RzxRecorder` collects frames into input blocks and, every 250 frames (5 s, D3), captures a snapshot
at a boundary (trap 10). It prunes autosaves as Fuse does:
- all of them up to 15 s old;
- then one every 15 s up to 1 min;
- one per minute up to 5 min;
- one every 5 min after that.

It also provides rollback to the latest or the n-th point (restore the snapshot, discard later
blocks, start a new input block) and finalising on save.

### 4.4 Controller

`MachineController` gains an `rzxSession` slot. While one is set:
- fast load is forced off (trap 3);
- the clock multiplier is pinned to 1 (D14);
- keyboard sync is skipped in PLAY (trap 8);
- the IDE operations in trap 4 call `rzxSession.interrupt(reason)` first.

An `unthrottled` flag skips the frame delay. It is used only by render-to-video (D18).

### 4.5 Orchestration (emulator renderer): `src/renderer/appEmu/machines/rzxPlayback.ts`, `rzxRecording.ts`

- **Play:**
  1. parse;
  2. map the first snapshot to a machine (existing fitting, warnings included);
  3. `loadSpectrumSnapshot`-style restore;
  4. start the player;
  5. start, or start under the debugger with `-d`.
- **Record:**
  1. pause;
  2. capture `.szx` (retry on mid-prefix, as `spectrumSnapshotSave.ts` does);
  3. start the recorder;
  4. resume.
- **Stop:** pause, finalise, show the save dialog, write the file.

### 4.6 User surface

- **File type** `.rzx` in `registry.ts`, with an RZX viewer panel:
  - header, creator, version, notes;
  - segments, with frame counts and durations (frames / 50);
  - the first snapshot through the existing snapshot viewer component, so it shows registers, the
    memory map and a screen preview;
  - Play, Debug and Render to video in the document tab bar;
  - Explorer context menu items through `SpectrumSnapshotLaunchMenu`'s pattern.
- **Drag and drop:** `rzx` in `dropped-file-action.ts`.
- **Commands and menus** as in §1.6.
- **State:** `emulatorState.rzx = { mode: "idle" | "playing" | "recording" | "rendering", frame,
  frames?, file?, desync? }`.
- **Indicator:** a PLAY/REC badge with the frame counter in the emulator status bar, following
  `RecordingStateOverlay`. Colours come from the token layers. This is a visual change, so
  `.ai/ui-theming-intent-and-lessons.md` gets its rule in the same change.

### 4.7 Render to video (D17–D20)

`zx-rzx-video <file>` and the menu item:
1. ask for the output path, using the existing recording path rules;
2. load and fit the machine;
3. arm `RecordingManager` with the stored fps, quality and format;
4. play from the first frame, unthrottled if the user ticks **As fast as possible** (default on);
5. mute live audio;
6. stop the video on ended or desync, report the file, and unmute.

The video gets one frame per picture frame (D19), and audio is submitted per emulated frame as
today, so audio and video stay in step with emulated time. A desync ends the video at the desynced
frame and says so.

---

## 5. Phases

### Phase 1: Format (pure, nothing user-visible)

- `rzxModel`, `rzxFile`, `rzxWriter`, `rzxSegments`, `rzxFinalise`.
- Unit tests with **synthetic fixtures built by the tests**:
  - an uncompressed and a compressed input block;
  - repeat frames, zero-IN frames, and a first-frame repeat (invalid);
  - two segments;
  - unknown and security blocks (skipped, with a note);
  - external and protected blocks (refused);
  - a byte-exact write → read → write round trip.
- No third-party file is committed.

### Phase 2: Core counter and tap (48K)

- `zx-spectrum-rzx.c`, the hooks and exports on `sp48`, and the build, loader and contract updates.
- Fetch-count tests in the style of `test/wasm/z80-hooks/` cover:
  - unprefixed, CB, ED, DD, DDCB, chained DD DD and FD DD;
  - HALT cycles;
  - an INT acknowledge (not counted) and an NMI acknowledge (counted);
  - `LD R,A` (no effect on the counter);
  - INIR iterations.
- Port-tap tests: every IN form is recorded once, and a debugger `doReadPort` is not recorded.

### Phase 3: Play and record on the 48K, with the determinism proof

- `IRzxMachine`, the bridge, `RzxPlayer`, `RzxRecorder` (without autosave yet), and the controller
  changes.
- Harness methods on `sp48`: `startRzxRecording`, `stopRzxRecording(): Uint8Array`, `playRzx(bytes)`,
  `rzxStatus`.
- **Round-trip test (the proof).** It records a session, plays it back from the start and asserts
  that RAM, registers and the frame count are identical at the end and at every 50th frame. The
  session includes:
  - booting to BASIC;
  - typing a program;
  - a program that polls the keyboard and reads the floating bus;
  - a real-speed tape load;
  - a DI stretch;
  - an `EI; HALT` loop;
  - an interrupt handler short enough to retrigger.
- A second run plays the same file with different live keys held. The result must be identical.
- Desync tests: drop one IN (underrun) and add one IN (overrun). Each pauses at the right frame with
  the right message.
- Added to `E2E_CORE_TESTS`.

### Phase 4: 128K and +2E/+3E

- The same C module on `sp128` and `spp3e`, plus round-trip tests on the `sp128` harness:
  - paging;
  - AY register reads;
  - for `fdd1`, an FDC status poll.
- The +2A/+3 ROM warning (trap 6) appears in the output and the viewer.

### Phase 5: Playback user surface

- The viewer, the `zx-rzx` command, menus, drop handling, the Explorer menu, the status badge, and
  the desync and end messages (D11, D12).
- Every trap 4 operation ends playback with a message.
- Debugging inside playback: break, step and continue resume playback.
- Manual check in the running app on a few RZX Archive files (local only).

### Phase 6: Recording user surface

- `zx-rzx-record`, `zx-rzx-stop` (save dialog, finalise), autosave with pruning, `zx-rzx-rollback`
  and Insert Rollback Point.
- "Record from here" (D16), including at the end of a playback.
- The viewer gains "Play from this segment" for each embedded snapshot.
- Interop: a Klive recording plays in Fuse (and Spectaculator, if available), checked by hand and
  recorded in §8. Like G2.4's manual interop check, this needs those emulators installed.

### Phase 7: Render to video

- `zx-rzx-video`, the menu item, the unthrottled controller mode, the live-audio mute, the automatic
  stop, and D19 picture-frame gating.
- A test with a stubbed `RecordingManager` checks that a synthetic recording with retrigger frames
  produces exactly one frame per picture and stops on ended and on desync.
- Manual check: render a long archive recording, then compare its duration and audio sync with
  real-time playback.

### Phase 8: Compatibility check, docs and roadmap

- `scripts/rzx-archive-check.cjs` (local, never CI) plays every `.rzx` in a folder headless on the
  harness. It reports pass, desync (frame, creator) or refused per file, with a summary by creator. It
  is the yardstick for the long tail (§7) and for whether any compatibility workaround is worth adding.
- Docs:
  - a how-to page under `docs/content/howto/` (play, debug, record, roll back, render to video);
  - the commands in `commands-reference.mdx`;
  - `.rzx` in `project-explorer.mdx`.

  Verify with `npm run doc:build && npm run doc:check`.
- Mark G2.7 and G2.8 done in `CLOSING_THE_GAPS_PLAN.md`, and update §2 and §4 (W5) of
  `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` in the same change. This is a standing instruction.

---

## 6. Effort

| Phase | Size |
| --- | --- |
| 1 Format | S |
| 2 Core counter and tap | S–M |
| 3 48K play/record + proof | M |
| 4 128K and +2E/+3E | S |
| 5 Playback UI | M |
| 6 Recording UI (autosave, rollback, finalise) | M |
| 7 Render to video | S |
| 8 Archive check, docs, roadmap | S |

The total is M + M (playback, then recording), against the roadmap's L + L. The difference is §1.3.

---

## 7. Risks

- **The real-world long tail.** About 6% of archive files failed in Fuse at one point (bug #336). The
  known causes:
  - CMOS vs NMOS behaviour;
  - EI conventions at frame boundaries (handled by D8);
  - snapshot quirks;
  - tape traps in the recording emulator;
  - ULAplus;
  - Scorpion recordings.

  Phase 8 measures this. The target is "plays what Fuse 1.10 plays". Workarounds are added only per
  measured need.
- **The +E ROMs** (trap 6) will desync some +2A/+3 recordings until G9.2.
- **Picture alignment** (trap 5). The program path is exact by construction. The picture may show
  border or multicolour effects one frame early or late if the tact rebase is wrong. The round-trip
  test cannot see this, so Phase 5 checks it by eye on a border-effect demo.
- **WASM size budgets.** The new module is small, but `check-*-wasm-size.cjs` may need a raise with a
  stated reason.
- **The RZX Archive has no licence statement.** Its files are used locally only. Committed tests use
  synthetic fixtures and Klive's own recordings of its own test programs.

---

## 8. Implementation notes

(Filled in as phases land: where the build differs from this plan, and why. This includes the
manual interop results from Phase 6.)

---

## 9. Open questions

- **D14, turbo while recording.** Recording at a multiplier above 1 is valid RZX: frames just get
  longer and playback reproduces the path. The cost is that the picture during playback misaligns.
  Allow it with a warning, or keep it blocked? Keep it blocked until someone asks.
- **Playback speed control.** Is a 0.5× / 2× / 4× throttle for normal playback, separate from
  rendering, wanted in this plan or later?
