# Closing the Gaps — Feature Roadmap for Klive's Weak Spots

Status: **decisions recorded** (2026-10-02; see [Decisions](#decisions)). This is a roadmap, not an implementation plan: each feature
gets its own plan before work starts.
Source of the gap list: §4 of [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md).

> **Standing rule:** when a feature from this plan is implemented, update
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) in the same change:
> its §2 comparison table (the Klive column), and its §4 gap table, where you move or remove the
> closed gap. Also mark the feature as done here.

## How to read the effort ratings

| Size | Meaning |
|---|---|
| **S** | Days. Fits existing infrastructure; mostly UI or a parser. |
| **M** | 1–3 weeks. A new subsystem or new WASM exports, but a clear design. |
| **L** | Over a month. Touches every machine core or needs a new protocol or format. |
| **XL** | A project of its own, with open design questions or determinism or hardware risks. |

The ratings come from a quick look at the existing code, noted per item as **Foundation**. They
are estimates for prioritising, not commitments.

---

## Overview

| # | Gap | Overall | Low-hanging pieces |
|---|---|---|---|
| G1 | Conditional breakpoints, hit counts, logpoints | **S–M** | ✅ done (2026-10-03): G1.1–G1.4, G1.5 (DeZog ASSERTION/WPMEM comments) and G1.6 (one-shot breakpoints) |
| G2 | Load and save snapshots (.sna/.z80/.szx), RZX | **S → L** | ✅ done (2026-10-04): G2.1–G2.8 |
| G3 | Live Next hardware inspectors | **M** (layers: M–L) | ✅ done (2026-10-05 – 10-08): G3.1–G3.9 (G3.8's sprite half on 2026-10-08) |
| G4 | Execution history and reverse debugging | **M → XL** | ✅ done (2026-10-07 – 10-08): G4.1–G4.6 |
| G5 | Code coverage, profiler, unit tests | **M → L** | ✅ G5.1 and G5.2 done (2026-10-08): coverage per bank and the heat map on every Z80 machine · ✅ G5.3 and G5.4 done (2026-10-08): flat and call-graph profiler on every Z80 machine · ✅ G5.5 done (2026-10-08): DeZog-compatible unit tests with both assemblers · ✅ G5.6 done (2026-10-09): `klive test` in CI, with exit codes, JUnit and LCOV |
| G6 | Remote debugging, real hardware, external API | **M → XL** | ◐ G6.1 done (2026-10-09): a local, token-authenticated JSON-RPC automation API and the `klive ide` command line, and headless `klive run` (with `klive test`/`klive build` from G5.6) · G6.2–G6.4 open |
| G7 | 48K/128K reverse-engineering depth | **M → L** | ✅ G7.1 done (2026-10-09): annotations on every machine with a bank space (Next, 48K, 128K/Pentagon, +2A/+3/+3E, Scorpion, Timex, ZX80, ZX81) · G7.2 in progress: ROM sidecar mechanism, tools and the first `sp48.rom.dis` (R0–R1) done; authoring the ROMs to level 2 (R2–R4b) open · ✅ G7.3–G7.6 done (2026-10-09): code/data detection from coverage (`ann-detect`, the Detect dialog), the graphics finder (static and live, `gfx`), SkoolKit skool/ctl import and export, export as source verified by reassembly (`export-asm`) |
| G8 | BASIC editor intelligence | **M** | ✅ done (2026-10-03): G8.1–G8.5 |
| G9 | Machine breadth (ZX80/81, clones) | **M → XL** | ✅ G9.1 Pentagon 128, G9.1b Beta 128 / TR-DOS, G9.2 +2A/+3, G9.3 ZX80/81, G9.4 Timex TC2048/TC2068/TS2068 and Scorpion done |
| G10 | Proof points (accuracy evidence) | **S–M** | Publishing results of known test suites |

---

## G1. Rich breakpoints — **S–M, the clearest low-hanging fruit**

**Why it matters:** every serious competitor has it, the README roadmap still lists it, and its
absence is the first thing an experienced developer notices.

**Status:** G1.1–G1.3 are **done** (2026-10-03), implemented by
[CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md). Its condition engine
(`src/common/utils/breakpoint-condition/`) is the one G1.4 and G1.5 build on. G1.4 is **done**
(2026-10-03), implemented by [LOGPOINTS_PLAN.md](LOGPOINTS_PLAN.md), together with the
source-annotation pipeline and the DeZog expression dialect G1.5 reuses.

**Plan:** G1.1–G1.3 are planned in [CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md);
G1.4 in [LOGPOINTS_PLAN.md](LOGPOINTS_PLAN.md) (decisions recorded), which also builds the
source-annotation pipeline and DeZog expression dialect that G1.5 reuses; G1.5 and G1.6 in
[ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md](ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md).
The conditional-breakpoints plan found one exception to the "no C core changes" note below: the WASM cores record only the
last memory access of an instruction, so its Phase 0 makes them record every one (which also fixes
memory breakpoints that miss multi-byte accesses today).

**Foundation:** breakpoints are a 64K flag table plus per-address data in `DebugSupport`
(`src/emu/machines/DebugSupport.ts`), pushed to the WASM cores, which stop the frame on a hit.
A `hitCount` field already exists for memory breakpoints and is shown in `BreakpointDialog`.
None of the extensions below has to change the C cores: the core stops, the TypeScript side
evaluates, and it either stays stopped or resumes silently.

| Feature | What it does | Size |
|---|---|---|
| G1.1 Hit-count breakpoints ✅ **done** | Stop only on the Nth hit, every Nth hit, or after N hits (`bp-set $8000 -hit >=10`). Shows the live count in the Breakpoints panel. | S |
| G1.2 Register / flag conditions ✅ **done** | Stop only when an expression is true, e.g. `A == $FF && !Z` or `HL > $C000`. | S–M (needs an expression evaluator over registers; check whether the watch or command expression code can be reused) |
| G1.3 Memory and value conditions ✅ **done** | Conditions on memory contents (`[IX+3] == 0`, `w[$5C3A] > 100`), on the value being written (memory or I/O value breakpoints, like SpecEmu's MWV/PWV), and on the current paging or bank. | M |
| G1.4 Logpoints ✅ **done** | A breakpoint that does not stop: it writes a formatted message (`"x={A} at {PC}"`) to the output pane and resumes. Also recognised from source comments using DeZog's LOGPOINT convention (decision D3). | S, once G1.2 exists |
| G1.5 Assertions and watchpoints in source ✅ **done** | DeZog-compatible ASSERTION and WPMEM source comments (decision D3) become conditional breakpoints and memory watchpoints when the program is debugged, so annotated DeZog projects work unchanged. | M |
| G1.6 Temporary / one-shot breakpoints ✅ **done** | Remove themselves after the first hit. | S |

**Risk:** a conditional breakpoint inside a hot loop stops and resumes the frame on every pass,
which is slow. That is acceptable at first; the fix, if needed, is evaluating simple register
conditions in C (M).

---

## G2. Snapshots and recordings — **S for loading, L for RZX**

**Why it matters:** sharing a machine state is everyday practice for 48K/128K users, and games
are commonly distributed as snapshots.

**Foundation (before the work):** none for the Spectrum. `SnaFileViewerPanel` and `Z80FileViewerPanel` were
"not implemented" stubs. The code-injection flow already writes memory and registers into a
running machine. The Next core has a checkpoint (whole-state capture) used internally by
`MachineController`. Z88 snapshot loading exists (`Z88SnapshotCommand`) as a UX reference.

**Plan:** G2.1–G2.3 (and the G2.5 viewers they bring along) are planned in
[ZX_SPECTRUM_SNAPSHOT_PLAN.md](ZX_SPECTRUM_SNAPSHOT_PLAN.md). **Done (2026-10-04):** `.sna`, `.z80`
(v1–v3) and `.szx` load, run and debug-stop at PC on the 48K, 128K and +2E/+3E (the snapshot picks
the machine), from the viewer's tab bar, the Explorer, the `zx-snapshot` command, File and Machine
menus, and by drag and drop; one viewer serves all three formats.
G2.4 (saving) and G2.6 (Klive state files, with a quick save/restore slot) are planned together in
[SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md](SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md). **G2.4 done (2026-10-04):** `.szx`,
`.z80` (v3) and `.sna` are saved from a running or paused 48K, 128K or +2E/+3E, from File and Machine
menus and the `zx-snapshot-save` command, with what `.z80`/`.sna` cannot hold reported.
**G2.6 done (2026-10-04):** `.kls` state files and a quick save/restore slot for every WASM machine
(48K, 128K, +2E/+3E, Next, Z88, ZX80/81), exact to the T-state, guarded by a per-build memory-layout
fingerprint, with a `.szx` fallback for Spectrum states from another Klive version.
G2.7 (RZX playback) and G2.8 (RZX recording), paired with the emulator video recording, are planned
in [RZX_PLAN.md](RZX_PLAN.md). That plan argues (§1.3) that they need neither G2.6 nor the Wave 4
replay spike. **G2.7 and G2.8 done (2026-10-04):** `.rzx` files play on the 48K, 128K and +2E/+3E
(+2A/+3 recordings on the Amstrad ROMs) from File and Machine menus, the viewer, the Explorer, the
`zx-rzx` command and by drag and drop, including under the debugger; a desync pauses at the
instruction that caused it. Recording has 5-second autosaves with Fuse's pruning, rollback, inserted
rollback points and finalising on save, and "record from here" takes over a playback. A recording
renders to video through the screen recorder, unthrottled. A round-trip test proves every recorded
session replays to identical RAM and registers.

| Feature | What it does | Size |
|---|---|---|
| G2.1 Load .sna (48K and 128K) ✅ **done** | Open a snapshot from the file menu, by drag and drop, or with a command; switches to the right machine and restores RAM, registers, paging and border. | S |
| G2.2 Load .z80 (v1–v3, compressed) ✅ **done** | The most common format in archives; includes 128K paging and AY state. | S–M |
| G2.3 Load .szx ✅ **done** | Modern chunked format (zlib) with full peripheral state: AY, +3 disk, keyboard, ULA timing. | M |
| G2.4 Save snapshots ✅ **done** | Save the current machine as .z80 / .szx (and .sna). Lets users bookmark a debugging situation or share a bug repro. | M |
| G2.5 Real snapshot viewers ✅ **done** | Replace the stubs: header, registers, a memory map, and a screen preview. Done for .sna/.z80/.szx (one viewer). | S |
| G2.6 Klive state files (all machines, including Next) ✅ **done** | Save and restore the full emulator state, building on the Next checkpoint mechanism; formats are Klive-specific. | M–L (each core needs a complete, versioned state serialiser) |
| G2.7 RZX playback ✅ **done** | Plays a recorded input stream frame by frame (the standard for verified game recordings and speedruns). | M (IN replay and fetch-counted interrupts need no deterministic peripherals, RZX_PLAN.md §1.3) |
| G2.8 RZX recording ✅ **done** | Record your own session for exact replay or bug reports. | M, after G2.7 |

---

## G3. Live Next hardware inspectors — **M; the "Next IDE" credibility item**

**Why it matters:** a Next IDE that cannot show what the sprites, Copper or layers are doing
at a breakpoint loses to ZEsarUX on the platform it should own.

**Foundation:** the C core has dedicated modules (`zxnext-sprites.c`, `zxnext-copper.c`,
`zxnext-layer2.c`, `zxnext-tilemap.c`, `zxnext-palette.c`). The loader exports very little of
their state (`zxnextCopperRead`), so each inspector needs a small state-export API first. The
renderer already draws sprite patterns, palettes and Layer 2 images for NEX files and asset
editors (`NexBankSpritesView`, the image viewers, the palette editor), so most drawing code can
be reused.

**Plan:** G3.1 (and the Copper half of G3.8) in [COPPER_DEBUGGING_PLAN.md](COPPER_DEBUGGING_PLAN.md);
G3.2 and G3.3, as one Sprite Inspector document, in [SPRITE_INSPECTOR_PLAN.md](SPRITE_INSPECTOR_PLAN.md) (done);
G3.4 in [TILEMAP_INSPECTOR_PLAN.md](TILEMAP_INSPECTOR_PLAN.md) (done); G3.5 in
[LAYER2_INSPECTOR_PLAN.md](LAYER2_INSPECTOR_PLAN.md) (done); G3.6 in
[LAYER_COMPOSITION_PLAN.md](LAYER_COMPOSITION_PLAN.md) (done); G3.7 in
[BEAM_POSITION_OVERLAY_PLAN.md](BEAM_POSITION_OVERLAY_PLAN.md) (done); the sprite half of G3.8 in
[SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md](SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md) (done).
Research for those four corrected two assumptions in the table below: the `.sl2`/`.shr` viewers G3.5
was to reuse are stubs (the Layer 2 plan builds the decoder and replaces the `.sl2`/`.nxi` stubs),
and G3.6 is nearer **M–L** than L, because the core already renders each layer into its own buffer
and mixes them in one function. G3.6 landed first after all: it brought its own screen overlay
(`NextLayersScreenOverlay`) and the paused preview buffer (`zxnextLayerPreview`), which G3.7 reused: its
overlay now sits on a shared `EmulatorScreenOverlay`, and its render to the beam draws into that preview.

| Feature | What it does | Size |
|---|---|---|
| G3.1 Copper list viewer ✅ **done** | The 1K Copper program decoded as `WAIT line,h` / `MOVE reg,val`, with the current Copper PC highlighted and NextReg names. | S–M |
| G3.2 Sprite table inspector ✅ **done** | All 128 sprite attribute slots: position, pattern, palette offset, mirror/rotate/scale, relative/anchor, visible; click to show the pattern. | M |
| G3.3 Pattern memory viewer ✅ **done** | All 16K of sprite pattern RAM as 8-bit or 4-bit images with the active palette. | S (reuses the sprite drawing) |
| G3.4 Tilemap / tile definition viewer ✅ **done** | The live tilemap with tile indices and attributes, plus the tile definitions. | M |
| G3.5 Layer 2 live viewer ✅ **done** | Current Layer 2 banks as an image at its resolution (256×192 / 320×256 / 640×256), with scroll and clip shown. Delivered as the Layer 2 Inspector: the displayed, shadow and `$123B`-window banks, whole or as displayed. | S–M (there were no viewers to reuse: `.sl2` was a stub and `.shr` is a Timex mode; the Layer 2 decoder was built once and also replaced the `.sl2`/`.nxi` stubs) |
| G3.6 Layer composition view ✅ **done** | Toggle individual layers (ULA, Layer 2, sprites, tilemap) on and off in the emulator screen; show the priority order, clip windows and transparency. Delivered as a debug mask in the core's mixer (the program is unaffected), a Layers strip with hide/solo/transparency/clips, an exact paused recompose from a per-span capture, a pixel probe that names the rule a pixel won by, and a `$layers` document. | M–L (the core already rendered each layer into its own buffer and mixed them in one function; the mask, the capture and the probe all live there) |
| G3.7 Beam-position overlay ✅ **done** | Show the raster position on the paused screen; useful with Copper and with the ULA panel's beam phase. Delivered on the Next and every Spectrum core (48K, 128K, Pentagon, Scorpion, +2A/+3, +2E/+3E, Timex): the beam line and pill, the paused picture rendered up to the beam without changing the machine, the previous frame's pixels hatched, blanking named, a hover readout of when the beam reaches any pixel, the Copper's hit as a second marker, and the ULA panel's RAS/POS fixed on the non-Next machines. | S–M |
| G3.8 Copper / sprite breakpoints ✅ **done** | Stop when the Copper reaches an instruction (`cu:<index>`, Step Copper), or when a sprite attribute is written (`sp:<sprite>`, with an `-attr` byte filter; port `$57` and the NextReg mirrors, by the CPU, the DMA or the Copper; set from the Sprite Inspector). | M, after G1 |
| G3.9 `.copper` assembler pragma ✅ **done** | `.copper wait/move/nop/halt/word` in the Klive Z80 Assembler, with highlighting, completion and hover; the Copper List maps the live list back to these source lines and a margin click on one sets a Copper breakpoint. | S |

---

## G4. Execution history and reverse debugging — **M → XL; full reverse debugging is in scope (D2)**

> **Feature switch (G4 and G5):** the whole group is on unless the user runs
> `set -u features.advancedDebugging 0` and restarts (`docs/content/howto/advanced-debugging.mdx`).
> The main process reads it once at startup into `emulatorState.advancedDebugging`;
> `src/common/features/advancedDebugging.ts` is the one gate. Off, `MF_EXEC_HISTORY` and
> `MF_REVERSE_DEBUG` read as absent (`hasMachineFeature`) and the machine controller never starts the
> recorder or the timeline. **Every G5 piece must honour it too**: add its machine feature (the
> coverage plan's `MF_PROFILE`) to `ADVANCED_DEBUGGING_FEATURES`, and gate its commands, views and
> hooks on `isAdvancedDebuggingEnabled`. Tests of the group turn it on with
> `test/advanced-debugging-helper.ts`.

**Why it matters:** this is DeZog's most-praised feature: "how did I get here?" answered by
stepping backwards.

**Foundation:** the Next core already records a per-instruction **frame trace**
(`zxnext-trace.c`: 160,000 records × 128 bytes, PC plus memory-map context), used for boot
traces and diagnostics. The Next also has full-state checkpoints. The 48K/128K/+3 cores have
neither.

**Plan:** G4.1 in [EXECUTION_HISTORY_VIEWER_PLAN.md](EXECUTION_HISTORY_VIEWER_PLAN.md), G4.2 in
[EXECUTION_HISTORY_ALL_CORES_PLAN.md](EXECUTION_HISTORY_ALL_CORES_PLAN.md), G4.3 in
[LITE_STEP_BACK_PLAN.md](LITE_STEP_BACK_PLAN.md), G4.4 in [REVERSE_DEBUGGING_PLAN.md](REVERSE_DEBUGGING_PLAN.md),
G4.5 in [TRACE_EXPORT_PLAN.md](TRACE_EXPORT_PLAN.md) and G4.6 in
[DEBUG_SESSION_RECORDING_PLAN.md](DEBUG_SESSION_RECORDING_PLAN.md) (decisions recorded for both,
2026-10-08: the suggested answers accepted).
The G4.1 and G4.2 decisions and G4.3's D1–D14 are recorded (2026-10-06). G4.4's decisions are recorded
too; its Phase 0 spike passed its go/no-go gate on the 48K and the Next (2026-10-07; results in the
plan's §10). G4.3's §8 questions were answered as suggested and G4.3 is done (2026-10-07). G4.4 uses keyframes that share unchanged
pages, an input journal kept at each core's export boundary, and deterministic replay to an exact
instruction, which the replay checks itself. Research for
them corrected the foundation note above. The frame trace is a **linear** buffer that stops when
full, not a ring. It records registers *after* each instruction, holds no opcode bytes, and is off
in every production path. So G4.1 does not reuse it. Instead it adds a shared history recorder
hooked into the shared Z80 (`src/emu/z80/wasm/`). The recorder keeps a ring of 64-byte "state before
the instruction" records. Because every core compiles that Z80, G4.2 is per-core wiring only: a
16-byte context, a memory increase and tests. Recording runs only in debug sessions. G4.1 raises
the Next's memory from 32 to 40 MB for a 131,072-record ring, and records DMA bus holds. A follow-up
then moves the frame trace to a diagnostics build, which shrinks the Next to about 20 MB.

| Feature | What it does | Size |
|---|---|---|
| G4.1 History viewer (Next) ✅ **done** (2026-10-07) | After a stop, list the last N executed instructions with registers, disassembly and source line; click one to jump to its source. Read-only. | M (the data exists; needs an export, a UI and source mapping) |
| G4.2 History in the other cores ✅ **done** (2026-10-07) | The same trace recording for 48K/128K/+3E (and Z88). Done for every Z80 core: 48K/16K, Timex, 128K/Pentagon/Scorpion, +2A/+3/+2E/+3E, Z88 and ZX80/81, with the ZX80/81's display NOPs merged per line and interrupt service folded in the viewer. | M |
| G4.3 "Lite" step back ✅ **done** | Step backwards through the trace and show the historical registers and PC in the CPU panel and editor. Memory stays at the present. This is DeZog's "lite" mode. | M, after G4.1 |
| G4.4 Full reverse debugging ✅ **done** (2026-10-08) | Step back and reverse-continue with exact memory and device state: periodic checkpoints plus deterministic re-execution to the target instruction. Done on every Z80 machine: keyframes, an input journal at each core's export boundary and self-checking replay; Continue from the past, Take over here, reverse watchpoints, the Next's SD card undone on a fork (.plans/REVERSE_DEBUGGING_PLAN.md). | XL (every core needs cheap state capture; input, tape, disk and audio must replay deterministically) |
| G4.5 Trace export ✅ **done** (2026-10-08) | Save a history range as a text or CSV trace for diffing two runs. Done: `history-export` (`hexp`), Debug › Export Execution History… and the document's Export button; diff-friendly defaults (relative time, masked wait counts, `-nointerrupts`), selectable columns, CSV with a column per register (.plans/TRACE_EXPORT_PLAN.md). | S, after G4.1 |
| G4.6 Debug session recording ✅ **done** (2026-10-08) | Save a reverse-debugging timeline (keyframes and the input journal, with SD sector data) to a file, so a bug repro replays later with the debugger attached: an RZX for every machine, with breakpoints. Replays only on the same Klive build. Done on every machine with reverse debugging: `.klr` files (`drsave`/`drload`, Debug › Save/Open Debug Recording…, a viewer, drag and drop) open paused where they were saved with their whole past; breakpoints travel as session breakpoints; another build's file opens as its end state; 1-4 MB per minute (.plans/DEBUG_SESSION_RECORDING_PLAN.md). | M, after G4.4 works on two cores |

---

## G5. Coverage, profiling and unit tests — **M → L**

> **Feature switch (G4 and G5):** the whole group is on unless the user runs
> `set -u features.advancedDebugging 0` and restarts (`docs/content/howto/advanced-debugging.mdx`).
> The main process reads it once at startup into `emulatorState.advancedDebugging`;
> `src/common/features/advancedDebugging.ts` is the one gate. Off, `MF_EXEC_HISTORY` and
> `MF_REVERSE_DEBUG` read as absent (`hasMachineFeature`) and the machine controller never starts the
> recorder or the timeline. **Every G5 piece must honour it too**: add its machine feature (the
> coverage plan's `MF_PROFILE`) to `ADVANCED_DEBUGGING_FEATURES`, and gate its commands, views and
> hooks on `isAdvancedDebuggingEnabled`. Tests of the group turn it on with
> `test/advanced-debugging-helper.ts`.

**Why it matters:** DeZog's unit tests and coverage are unique in the field. Klive has a strong
*internal* test harness (`test/harness/sp48`, `test/harness/zxnext`), but nothing for users.

**Plan (decisions recorded, 2026-10-08: the suggested answers accepted for all four plans):**
- G5.1 and G5.2 are in [CODE_COVERAGE_AND_HEAT_MAP_PLAN.md](CODE_COVERAGE_AND_HEAT_MAP_PLAN.md). **Done
  (2026-10-08)** on every Z80 core: the shared in-core access profile (`z80-profile.c`), the editor
  strip, the disassembly cell, the memory view's heat map, the `coverage` commands, the SMC report
  and LCOV/CSV/`.kcov` exports. The core module also records the per-instruction time G5.3 reads.
  It also builds the shared in-core access profile (`z80-profile.c`: a flag byte per physical byte,
  plus a counter pool with per-instruction time) that the profiler reads.
- G5.3 and G5.4 are in [PROFILER_PLAN.md](PROFILER_PLAN.md). **Done (2026-10-08)** on every Z80
  core: the flat "top routines" profile rolled up from Klive BASIC callables, `.proc` extents or labels;
  a call tracker in `z80-profile.c` (inclusive/exclusive time, interrupts as their own roots, stack
  switches counted); the `$profiler` document; `profile` commands with `-at`/`-until` windows; editor
  hints; and speedscope, callgrind, CSV and Fuse exports.
- G5.5 is in [Z80_UNIT_TESTS_PLAN.md](Z80_UNIT_TESTS_PLAN.md). **Done (2026-10-08)**: DeZog's labels
  and macro names with both assemblers (Klive's own includes, written from scratch), an Electron-free
  runner in a worker on the 48K/16K, 128K, +2A/+3/+2E/+3E and Next (deterministic, T-states per
  test, emulated-time timeout, stack guards), the Unit Tests panel and Tests pane with click-to-source,
  `test-*` commands, Debug a test in the emulator (not on the Next yet), and Run with coverage.
- G5.6 is in [UNIT_TESTS_CLI_PLAN.md](UNIT_TESTS_CLI_PLAN.md). **Done (2026-10-09)**: `klive test` and
  `klive build` run headlessly in Klive's own binary in Node mode (exit codes 0–4, pretty/plain/TAP
  reporters, JUnit with emulated time, LCOV and `.kcov` coverage), launchers in the packaged app, the
  macOS Install Command Line Tool item and the Windows installer's PATH entry, the Test panel's
  Export results as JUnit…, and a docs page with GitHub Actions and GitLab examples.

Research for the plans corrected four assumptions in the table below:
- **G5.3 is S–M, not M.** The coverage module already measures time per instruction.
- **G5.4 is M–L, not L.** The shared Z80's shadow-stack functions are ready-made CALL/RET hook
  points.
- **G5.5's runner is Electron-free.** It runs in a worker on its own machine instance, not on the
  user's emulator.
- **G5.6 does not need G6.1.** CI needs a headless Node process, not a transport into a running
  IDE. The CLI it adds (`klive test`) becomes the skeleton G6.1 extends.

| Feature | What it does | Size |
|---|---|---|
| G5.1 Code coverage map ✅ **done** | A per-address (and per-bank) "executed" bitmap in the core; executed lines are marked in the editor gutter and disassembly, and can be reset. | M (a C bitmap in each core, then source mapping through the existing debug info) |
| G5.2 Memory access heat map ✅ **done** | Read, write and execute counts per address, shown as a heat map in the memory view; also spots self-modifying code. | M, alongside G5.1 |
| G5.3 Flat profiler ✅ **done** | T-states spent per address, rolled up per label or procedure; a "top routines" table. | M |
| G5.4 Call-graph profiler ✅ **done** | Inclusive and exclusive time per routine using the call stack. | L |
| G5.5 Z80 unit tests ✅ **done** | **DeZog-compatible** (decision D3): the same test-case labelling and assertion-macro conventions, so DeZog unit-test projects run in Klive unchanged, with both Klive asm and sjasmplus. A runner sets up the machine headlessly, calls each test, checks results, and reports pass/fail in a Test panel with click-to-source. Debug a failing test. | L (assembler support for the conventions, a headless runner, UI; the exact DeZog conventions are researched in this feature's own plan) |
| G5.6 Tests from the command line / CI ✅ **done** | Run the G5.5 tests without the UI (`klive test project/`), with exit codes and JUnit output. | M, after G5.5 (not G6.1: CI needs no transport) |

---

## G6. Remote, hardware and external integration — **M → XL**

**Why it matters:** this connects Klive to the VS Code/DeZog ecosystem and to real Next
hardware, where competitors lead.

| Feature | What it does | Size |
|---|---|---|
| G6.1 Command line / automation ✅ **done** (2026-10-09) | Drive Klive from a CLI or script: build, run, test and read memory headlessly. Scoped to CI and automation, **not** editor integration (decision D1). Done: the automation server and protocol, `klive ide …`, the docs page; headless `klive run` (projects, tapes, snapshots, state files, NEX files and ZX80/81 programs; frame, T-state, address, HALT, breakpoint and timeout stops; memory, register, screenshot and state outputs) on the machine handling shared with the harness and the unit-test runner in `src/common/headless/`; the CLI skeleton, the packaged `klive` launcher and headless `klive build` came with G5.6. | M (the IDE command service already exists; this needs a transport and a security model) |
| ~~G6.2 Debug-adapter protocol server~~ | **Dropped** (decision D1): Klive stays a standalone IDE. | — |
| ~~G6.3 DeZog-compatible remote~~ | **Dropped** (decision D1). DeZog compatibility applies to source conventions instead (D3). | — |
| G6.4 Real Next hardware debugging (**deferred**, 2026-10-08: built only if the future calls for it) | Run and debug on a physical Next over UART **from Klive's own debugger UI**, with an on-Next agent program handling breakpoints and memory. Fits D1: Klive is the client. | XL (hardware, a Z80N agent, timing and banking constraints) |
| G6.5 Send to Next | Push a built `.nex` to real hardware **over Wi-Fi** (the Next's ESP module) and start it, without debugging. Stands alone: it does not need G6.4. | M |

**Plan:** G6.1 is planned in [COMMAND_LINE_AUTOMATION_PLAN.md](COMMAND_LINE_AUTOMATION_PLAN.md)
(decisions recorded, 2026-10-08: the suggested answers accepted; the live half is built first). It has two halves:
- headless `klive build`/`klive run` verbs on G5.6's CLI, for CI;
- a local, token-authenticated JSON-RPC transport into a running IDE (Unix socket or named pipe,
  off by default, permission levels), with `klive ide …` verbs.

It re-sizes G6.1 to M–L with the headless runner, or M if G5.6 lands first.

**Status (2026-10-09):** the live half (the plan's Phases 3–6) is done: the server in the main
process, `klive ide …`, and `docs/content/working-with-ide/automation.mdx`. G5.6 (2026-10-09) then
built the CLI skeleton's headless half: `klive test`, `klive build` and the packaged `klive`
launcher. Headless `klive run` and the harness move remain.

**Plan:** G6.5 is planned on its own in [SEND_TO_NEXT_WIFI_PLAN.md](SEND_TO_NEXT_WIFI_PLAN.md)
(draft, open questions, 2026-10-08):
- Klive runs a small, off-by-default, read-only HTTP server, and the Next pulls the build over Wi-Fi.
- The zero-install route uses the stock `.http` command and `.nexload`. The everyday route is a
  Klive dot command, `.klive -w`, that waits, downloads in checksummed ranges, saves to the SD card
  and runs the file.
- The plan also delivers a user guide to setting up Wi-Fi on the Next.
- A fake ESP on the emulated UART lets the whole path run in CI.

G6.4 is planned in [NEXT_HARDWARE_DEBUGGING_PLAN.md](NEXT_HARDWARE_DEBUGGING_PLAN.md) (draft,
**deferred**). It uses a joystick-port UART through a USB-serial adapter and a Klive agent on the
Next. Its Phase 2 (send-to-Next over serial) is replaced by the Wi-Fi plan.

---

## G7. Reverse-engineering depth for 48K/128K — **M → L**

**Why it matters:** Spectrum Analyser owns this niche on the classic machines. Klive already has
the model (labels, comments, regions, sidecar); it just exists for NEX files only.

| Feature | What it does | Size |
|---|---|---|
| G7.1 Annotations for any machine ✅ **done** | Generalise the `.nex.dis` sidecar: label, comment and region-mark code in a running 48K/128K program and in snapshots (G2), shown in the live disassembly. | M |
| G7.2 Annotated ROMs (R0–R1 ✅ done: ROM sidecars, byte binding, user layers, `ROM:` breakpoints, the tools; R2–R5 authoring open) | Ship labels and comments for the 48K/128K/+3 ROMs so ROM calls and jumps read by name. | M–L (mostly data, but **written from scratch** (decision D4): existing commented disassemblies are not copied or used as a source, as with Klive BASIC's provenance rule) |
| G7.3 Code/data auto-detection ✅ **done** | Use the coverage and heat maps (G5.1–G5.2) to classify executed bytes as code and data-only bytes as data. | M, after G5 |
| G7.4 Graphics finder ✅ **done** | Browse memory as bitmaps at a chosen width (UDGs, sprites, fonts) to find and name graphics. | M |
| G7.5 SkoolKit import / export ✅ **done** | Exchange annotations with SkoolKit's skool files, the community standard for published disassemblies. | M |
| G7.6 Export as source ✅ **done** | Export an annotated region as re-assemblable Klive asm source. | M, after G7.1 |

**Plan:** G7.1 and G7.2 are planned together in
[REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md](REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md) (decisions
recorded, 2026-10-09). It covers:
- one annotation model and a per-machine *bank space* in place of the Next's 8K arithmetic, with
  the **ZX80 and ZX81 added** by the author (Q4), annotated by canonical address;
- an active annotation set (NEX, snapshot, project or command) in place of "the launched NEX";
- a shared address-to-name resolver;
- the live Disassembly view as an editable annotated listing;
- ROM annotations as `<rom file>.dis` sidecars: shipped read-only beside the ROMs in
  `src/public/roms`, the user's own beside their ROM file or in the Klive home folder by CRC, found
  by CRC and bound to their bytes, and written from scratch under D4. The ZX81 and ZX80 ROMs are
  targets too. Under Q1, the conventional routine names may be used as interface facts; the
  comments that come with them may not.

**Plan:** G7.3–G7.6 are planned together in
[REVERSE_ENGINEERING_TOOLS_PLAN.md](REVERSE_ENGINEERING_TOOLS_PLAN.md) (decisions recorded,
2026-10-09: the suggested answers accepted; **all phases implemented 2026-10-09**). All four write to or read from G7.1's model, and they share one set of model
additions: `text`/`graphic` regions, a region `origin`, named graphics, an end comment and a SkoolKit
passthrough. All of them are keys that shipped builds ignore.
- **G7.3** classifies each bank's bytes from the coverage flags, follows branches from code it has
  seen run, and *proposes* regions that the user applies. Regions it writes are marked `origin: "auto"`.
- **G7.4** is a bitmap view: a fourth view mode of the static dump, plus a live document. It knows
  four byte orders and masks, can dim bytes that were never read, and names graphics.
- **G7.5** has its own skool/ctl parsers and writers. They are written only from SkoolKit's documented
  formats; an installed SkoolKit may be run as a local oracle. An import is checked against bytes
  Klive already has. D4 still keeps published ROM skool files out of the shipped sidecars.
- **G7.6** emits Klive asm and proves it by reassembling the output. Non-canonical encodings fall
  back to `.defb`, and an exhaustive test checks that list.

The G7.6 encoding table, the skool parsers and the static graphics view do not depend on G7.1 and
can start first.

---

## G8. BASIC editor intelligence — **M**

**Why it matters:** BASIC debugging (on main) is a headline feature, but editing BASIC gets only
diagnostics, while asm gets 11 language providers.

**Foundation:** Klive BASIC is a TypeScript compiler in-process (`src/main/kbasic/`), so its
symbol tables are available. The asm providers (`services/z80-providers.ts`) give the pattern to
follow.

| Feature | What it does | Size |
|---|---|---|
| G8.1 Hover ✅ | Types of variables and functions, `SUB`/`FUNCTION` signatures, keyword help. | S–M |
| G8.2 Go to definition / find references ✅ | For SUBs, FUNCTIONs, labels, variables, constants, across `#include`d files. | M |
| G8.3 Completion ✅ | Keywords, in-scope identifiers, library functions from the stdlib API. | M |
| G8.4 Rename ✅ | Cross-file rename of user symbols. | M, after G8.2 |
| G8.5 Signature help, outline, folding ✅ | Parameter hints while typing calls; document symbols; folding for `SUB`/`IF`/`FOR` blocks. | S–M |

**Plan:** [BASIC_EDITOR_INTELLIGENCE_PLAN.md](BASIC_EDITOR_INTELLIGENCE_PLAN.md). **Done (2026-10-03):**
G8.1–G8.5 on Klive BASIC snapshots from the background check, with keyword, directive and library
help generated from Klive's spec; checked in the running IDE by `scripts/kbasic-ide-check.cjs`.

---

## G9. Machine breadth — **M → XL**

| Feature | What it does | Size |
|---|---|---|
| G9.1 Pentagon 128 ✅ **done** | Popular Russian clone: a model of the 128K on its core, with the Pentagon's timing (71,680-T frame, 3.5 MHz, no contention, no floating bus) (main, 2026-10-04; unreleased); plan: [PENTAGON_128_PLAN.md](PENTAGON_128_PLAN.md). | M |
| G9.1b Beta 128 / TR-DOS ✅ **done** | The Pentagon's disk interface: a WD1793 from its data sheet, two drives, `.trd`/`.scl` images (written back to `.trd`; an `.scl` never), a Disk Loader, the TR-DOS ROM as partition R2 (main, 2026-10-05; unreleased); plan: [BETA128_TRDOS_PLAN.md](BETA128_TRDOS_PLAN.md). The TR-DOS ROM cannot be distributed, so the user names their own copy. | M–L |
| G9.2 ZX Spectrum +2A/+3 (non-E ROMs) ✅ **done** | The original Amstrad ROMs alongside the +E ones: eight +2A/+3 models (v4.0 and v4.1 English, v4.1 Spanish) on the `spp3e` core (main, 2026-10-04; unreleased); plan: [PLUS3_AMSTRAD_ROMS_PLAN.md](PLUS3_AMSTRAD_ROMS_PLAN.md). The archive had no Spanish v4.0 set, so its two models were dropped. | S–M |
| G9.3 ZX80 / ZX81 ✅ **done** | Both Sinclair machines on one C/WASM core (main, 2026-10-03; unreleased); plan: [ZX8081_WASM_PLAN.md](ZX8081_WASM_PLAN.md). | XL |
| G9.4 Timex TC2048/2068, Scorpion ✅ **done** | Long-tail clones, in three parts: **G9.4a TC2048 ✅ done** (a new Timex core: the 48K machine built with the SCLD - four screen modes, port `$FF`, the interrupt inhibit, a Kempston port; main, 2026-10-05; unreleased; the TC2048 ROM cannot be shipped, so the machine boots the user's or the 48K ROM), **G9.4b TC2068/TS2068 ✅ done** (models of the Timex core: the 8K HOME/DOCK/EXROM chunk map, the AY with two joysticks, `.dck` cartridges, partitions H0-H7/D0-D7/X0-X7; main, 2026-10-05; unreleased), **G9.4c Scorpion ZS-256 ✅ done** (its own machine on the 128K core: 256K, `$1FFD`, four ROMs R0-R3, the Beta 128 built in; main, 2026-10-05; unreleased); plan: [TIMEX_SCORPION_PLAN.md](TIMEX_SCORPION_PLAN.md). | L each; low priority |

---

## G10. Proof points — **S–M; cheap credibility**

| Feature | What it does | Size |
|---|---|---|
| G10.1 Published Z80 test results | Run the well-known instruction exercisers and timing suites (ZEXALL/ZEXDOC, FUSE's tests, z80test) and publish the results on the site. | S–M (much is probably covered by `test/z80`; this is about publishing it) |
| G10.2 Next accuracy page | Publish the hardware test catalogue's coverage (the ~30 areas checked against the VHDL) as a page. | S |
| G10.3 sjasmplus on 128K / Next | Verify, and fix if needed, SLD source-level debugging for banked targets (tested on 48K only). | S–M |
| G10.4 Docs and README accuracy | Fix the stale items found in the competitive analysis (Next "in development", roadmap, "pure TypeScript"). | S |

---

## Decisions

Answers from the project author, 2026-10-02:

- **D1. Klive remains a standalone IDE. No VS Code integration.**
  - G6.2 (DAP server) and G6.3 (DeZog remote) are dropped.
  - G6.1 is narrowed to a CLI and automation for CI.
  - G6.4 (real hardware) stays, with Klive as the debugger client.
- **D2. Aim for a very strong feature set.**
  - Full reverse debugging (G4.4) is in scope, not just the "lite" history (G4.3); G4.3 is now a
    milestone on the way.
  - The same ambition keeps G3.6 (layer composition) and RZX (G2.7–G2.8, now done) on the roadmap.
- **D3. Be compatible with DeZog's conventions.**
  - Unit tests (G5.5) use DeZog's test-case and assertion conventions.
  - For consistency, the ASSERTION, LOGPOINT and WPMEM source comments are honoured too (G1.4,
    G1.5).
  - Goal: a DeZog-annotated project debugs and tests in Klive unchanged.
  - The exact syntax is researched from DeZog's documentation when those features are planned.
    Only the conventions are adopted; no DeZog code is copied.
- **D4. ROM annotations are written from scratch** (G7.2), under the same provenance discipline as
  Klive BASIC.

## Suggested order (revised for the decisions)

**Wave 1 — low-hanging fruit:**
G1.1 hit counts · G1.2 register conditions · G1.4 logpoints · G1.6 one-shot breakpoints ·
~~G2.1 .sna load · G2.2 .z80 load · G2.5 snapshot viewers~~ (done) · ~~G3.1 Copper list~~ (done) · ~~G3.3 pattern viewer~~ (done) ·
G10.1–G10.4 proof points.

**Wave 2 — the Next leadership set:**
~~G3.2 sprite inspector~~ (done) · ~~G3.4 tilemap~~ (done) · ~~G3.5 Layer 2~~ (done) · ~~G4.1 history viewer (Next)~~ (done) · ~~G4.3 lite
step back~~ (done) · G5.1 coverage · G1.3 memory and value conditions · G1.5 DeZog-compatible ASSERTION
and WPMEM comments.

**Wave 3 — depth:**
- ~~G5.5 DeZog-compatible unit tests~~ (done), ~~G5.6 tests in CI~~ (done) and ~~G6.1 CLI and automation~~ (done).
- ~~G7.1 annotations for any machine~~ (done), G7.2 ROM annotations written from scratch (mechanism and
  tools done; authoring the ROMs open), ~~G7.3–G7.6 detection, graphics finder, SkoolKit, export as
  source~~ (done).
- ~~G8.x BASIC intelligence~~ (done), ~~G2.4 snapshot saving~~ (done), ~~G5.2–G5.4 heat map and profiler~~ (done).
- ~~**G4.2 history in every core**~~ (done), which is the groundwork for G4.4.

**Wave 4 — the big bets:**
- **G4.4 full reverse debugging.** Start with a design spike on cheap state capture and
  deterministic replay across all cores. The spike (Phase 0) is done and passed its gate; Phase 1, the
  export contract and the journal, is done (2026-10-08); Phases 2 (the timeline and replay engine on
  the Next and the 48K), 3 (performance: the gate holds over a 10-minute session) and 4 (Step Back
  and the other G4.3 commands put the machine itself in the past; Continue from the past; Take over
  here) and 5 (Reverse Continue checking every breakpoint on the real past machine, reverse
  watchpoints) and 6 (the Next's SD card journaled and undone on a fork, disk write-back republished,
  replays kept away from every host side effect) and 7 (every Z80 machine: 128K, Pentagon, Scorpion,
  +2A/+3/+3E, Timex, Z88, ZX81, ZX80) and 8 (the status bar, Take over here with its confirmation,
  Reverse Continue progress and cancel, settings rows, the docs page) are done: **G4.4 is done**
  (2026-10-08). (RZX, G2.7–G2.8, turned out not to need it and is done;
  Klive state files, G2.6, are done too.)
- ~~G3.6 layer composition~~ (done).
- G6.5 send-to-Next over Wi-Fi, on its own; G6.4 real Next hardware debugging is deferred.
- ~~G9.3 ZX80/81~~ (done).
- ~~G9.2 +2A/+3 with the Amstrad ROMs~~ (done).
- ~~G9.1 Pentagon 128~~ (done); ~~G9.1b Beta 128 / TR-DOS~~ (done).
- ~~G9.4a Timex TC2048~~ (done); ~~G9.4b TC2068/TS2068~~ (done); ~~G9.4c Scorpion~~ (done).

**Cross-cutting note:** deterministic replay is the shared foundation of G4.4 and G2.6 (RZX,
G2.7–G2.8, replays its inputs instead and needed only an exact CPU and snapshot restore). **The capture half is done (G2.6):** every core's whole state is a memory image, and
`test/wasm/state/machine-state-determinism.test.ts` proves save → restore → run equals a straight
run on every core. What G4.4 still needs is incremental (dirty-page) capture and periodic keyframes. Designing it once, early in Wave 4 (or as a spike during Wave 3), is the key
technical decision of this roadmap.
