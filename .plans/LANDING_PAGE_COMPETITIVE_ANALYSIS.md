# Klive vs. ZX Spectrum Development Environments — Competitive Analysis and Landing-Page Content

Status: **for review** (2026-10-02). Feeds the next phase of
[LANDING_PAGE_PROTOTYPE_PLAN.md](LANDING_PAGE_PROTOTYPE_PLAN.md).

How this was produced: a repo sweep of Klive (README, CHANGELOG, `docs/content`, `.ai/`, `.plans/`,
`src/`), plus web research on the competing tools (official docs, GitHub READMEs and APIs,
release notes, Marketplace pages, Spectrum Computing forums), all as of 2026-10-02. The research
marked which competitor facts were checked against a page and which were not; those it could
not check are marked **(unverified)** here. Check them before anything is said on a public page.

---

## 1. The field

| Tool | What it is | Machines | Platforms | Licence / activity |
|---|---|---|---|---|
| **ZEsarUX** | Emulator with a deep built-in debugger; ZRCP remote protocol | 16K–+3, Next, and many others (QL, Z88, CPC, MSX…) | Win / Mac / Linux | GPLv3; 13.0, Jun 2026; 431★ |
| **CSpect** | Mike Dailly's Next emulator and dev kit, text-mode debugger | Next only | Win (Mac/Linux via Mono) | Free, closed source, "no support"; 3.3.x |
| **DeZog** | VS Code debugger front end for zsim, ZEsarUX, CSpect, MAME and real Next hardware | 48K/128K/ZX81/Next via its remotes | Wherever VS Code runs | MIT; 3.7.x; 276★, about 10.8k installs |
| **Fuse** | The accuracy reference emulator | 16K–+3e, Pentagon, Scorpion, Timex; **no Next** | Win / Mac / Linux | GPLv2+; active again in 2026 (1.10.0) |
| **sjasmplus** | The de facto Next assembler (Lua, `SAVENEX`, SLD debug output) | — | All | BSD-3; 1.24.0 |
| **NextBuild + Boriel ZX Basic** | Boriel compiler, NextLib, VS Code extension, CSpect | Next | All | 0.7.6 (Sep 2025) |
| **ZX Basic Studio** | Avalonia IDE for Boriel BASIC; BASIC breakpoints (reported buggy) | 48K/128K; Next via MAME (beta) | All | MIT; 1.8 beta |
| **Spectrum Analyser** | Best-in-class reverse-engineering workbench | 48K/128K; **no Next** | Win / Mac / Linux | MIT; weekly builds |
| **SpecEmu / ZX Spin / Zeus** | Windows emulators and IDEs with debuggers (Spin has a built-in assembler; Zeus has an editor, assembler and emulator) | 48K/128K(/+3) | **Windows only** | Freeware; SpecEmu last released 2023, Spin abandoned, Zeus 4.17 (2025) |
| **MAME** | General emulator; expression breakpoints, Lua, gdbstub (used by DeZog) | Includes a Next driver (unverified depth) | All | GPL; ongoing |

What the field looks like:
- **Next developers today combine several tools**: an assembler (sjasmplus), an editor (VS Code plus
  Z80 Macro-Assembler or ASM Code Lens), an emulator (CSpect or ZEsarUX) and a debugger bridge (DeZog).
- **No other tool offers one integrated IDE** with emulator, editor, assembler, compiler and debugger
  in a single app on all three desktop platforms. The ones that come close (Zeus, ZX Spin) are
  Windows-only, 48K/128K-only, and in Spin's case abandoned.

---

## 2. Feature comparison

**Key:**
- ✅ strong / ◐ partial / ✗ missing / ? unverified.
- Klive items marked **(main)** are merged but **unreleased** — the last tag is v0.61.0.
- The **ZEs + DeZ** column is ZEsarUX used through DeZog, which is how most developers use it.

| Capability | **Klive** | ZEs + DeZ | CSpect | Fuse | Spectrum Analyser | NextBuild / ZXBS |
|---|---|---|---|---|---|---|
| All-in-one app (no tool assembly needed) | ✅ | ✗ (3–4 tools) | ✗ | ✗ | ✗ | ◐ (VS Code + CSpect) |
| Win / Mac / Linux | ✅ | ✅ | ◐ (Mono) | ✅ | ✅ | ✅ |
| 48K / 128K / +2A / +3 / +2E / +3E | ✅ (**+2A/+3 with the original Amstrad ROMs on main**: v4.0 and v4.1, English and Spanish) | ✅ | ✗ | ✅ (reference accuracy) | ◐ (48/128) | ◐ |
| ZX Spectrum Next | ✅ C/WASM core that cites the FPGA VHDL; about 30-area hardware test suite | ✅ | ✅ (reference dev kit) | ✗ | ✗ | via CSpect / MAME |
| Other machines | Z88, **Pentagon 128 (main)** (the 128K's core with the Pentagon's timing: 71,680-T frame, no contention, no floating bus; the **Beta 128 disk interface on main**: a WD1793 written from its data sheet, two drives, `.trd`/`.scl`, a Disk Loader, TR-DOS from the user's own ROM), **Timex TC2048, TC2068 and TS2068 (main)** (the SCLD's four screen modes including 512 × 192, port `$FF`, the interrupt inhibit; the TC2048's Kempston port; the 2068s' 8K HOME/DOCK/EXROM bank switching, AY, two joysticks and `.dck` cartridges; the user's ROMs or the 48K's), **Scorpion ZS-256 (main)** (256K, `$1FFD`, four ROMs, the Beta 128 built in; the user's ROM or the 128K's), **ZX80 / ZX81 (main)** (C/WASM core: SLOW and FAST modes, WRX hi-res, `.P`/`.O` fast and real-time load, debugger), C64 (experimental) | Very wide | ✗ | Many clones | CPC, C64 | ✗ |
| Editor with language intelligence | ✅ Monaco with compiler-driven completion, hover (incl. macro expansion), rename, references, inlay hints, colour pickers — for asm **and Klive BASIC** (scope-correct hover, definition, references, rename, completion with auto-`#include`, signature help, outline, folding; unreleased) | ✅ (VS Code extensions) | ✗ | ✗ | ✗ | ◐ |
| Built-in assembler | ✅ Klive Z80/Z80N: macros, structs, modules, `.savenex`, `.dma` DSL, **`.copper` DSL (main)** with hover decoding | ✗ (external) | ✗ | ✗ | ✗ | ✗ |
| External toolchains | ✅ sjasmplus (with SLD), zxbc, z88dk, PASTA/80 | ✅ sjasmplus, z80asm, z88dk | map files | ✗ | SkoolKit | Boriel |
| Built-in BASIC compiler | ✅ **(main)** Klive BASIC, Boriel 1.19 + CODEBANK compatible | ✗ | ✗ | ✗ | ✗ | Boriel (external) |
| **BASIC source-level debugging** | ✅ **(main)** statement stepping, symbolic call stack, editable variables, Just My Code, error stops | ◐ (BASIC/vars viewers only) | ✗ | ✗ | ✗ | ◐ (ZXBS, reported buggy) |
| Asm source-level debugging | ✅ (Klive asm; sjasmplus only tested on 48K) | ✅ | labels only | ✗ | ✗ | ✗ |
| Exec / memory / I/O breakpoints | ✅ incl. bank-relative and partition-scoped; **(main)** every data access of an instruction is watched | ✅ | ◐ | ✅ | ✅ | via CSpect |
| NextReg write breakpoints (value/mask, copper, old→new) | ✅ **(apparently unique)** | ? | ? | ✗ | ✗ | ✗ |
| Copper breakpoints and Copper stepping | ✅ **(main; apparently unique)** `cu:<index>`: a WAIT stops when satisfied, a MOVE when issued, with the hit's beam position; hit counts and conditions; Step Copper; a margin click on a `.copper` source line | ? | ? | — | — | ✗ |
| Sprite-attribute breakpoints | ✅ **(main; apparently unique)** `sp:<sprite>`: stops when an attribute byte of a sprite is written - through port `$57` or the `$35`-`$39`/`$75`-`$79` mirrors, by the CPU, the DMA or the Copper - with the byte's old and new value and the writer; `-attr` narrows it to some of the five bytes; hit counts, conditions (`ADDR` = attribute byte, `VAL` = value), run-to; set from the Sprite Inspector's row menu | ? | ? | — | — | ✗ |
| **Conditional / hit-count breakpoints, logpoints** | ✅ **(main)** conditions (registers, flags, memory in any bank, accessed value/address, paging, NextRegs, program and NEX labels) and hit counts on every breakpoint type, with a live count; logpoints with formatted messages, groups and DeZog `LOGPOINT` source comments (Klive assembler and sjasmplus); DeZog `ASSERTION` and `WPMEM` comments with value-reporting stop messages and per-project switches; one-shot breakpoints of every kind (Shift+click); memory watchpoints over ranges, also made from a Watch row | ✅ | ? | ✅ | ✅ (SpecEmu too) | ✗ |
| **Reverse debugging / execution history** | ✅ **(main)** full reverse debugging on every Z80 machine (48K/16K, 128K, Pentagon, +2A/+3/+2E/+3E, Next, Scorpion, Timex, Z88, ZX80/81; G4.4): Step Back/Forward, Reverse Step Over/Out and Reverse Continue put the **whole machine** in the past - memory, devices, the screen - by keyframes and a replayed input journal that checks itself; every breakpoint kind works in reverse (memory-write watchpoints find the last write; NextReg and Copper breakpoints on the Next); Continue from the past replays to the present; Take over here forks (the Next's SD card writes undone, disks re-published); minutes of reverse range. Built on the execution history (G4.1/G4.2): the last 65,536 instructions (131,072 on the Next) with registers, source lines, INT/NMI/HALT/DMA rows, folded interrupts and a filter; export a range as a text or CSV trace made for diffing two runs (G4.5); **save the whole session as a debug recording (`.klr`) that opens elsewhere paused at the bug, with its past to step back through and its breakpoints (G4.6)** | ✅ | ? | ✗ | frame trace | ✗ |
| **Unit tests / code coverage / profiler** | ✅ **(main)** code coverage on every Z80 machine (G5.1): covered, partly covered and never-run source lines in the editor, a coverage column in the disassembly, **per bank** (a banked line counts only when its own bank's code ran - DeZog and ZEsarUX track 16-bit addresses only); a memory **heat map** of execute/read/write counts with five-step shading (G5.2); **self-modifying code detection** (`coverage smc`); LCOV export for CI, CSV, and mergeable `.kcov` runs; counts full-speed runs, not only debug sessions; replays never count. A **profiler** on every Z80 machine (G5.3/G5.4): exact per-instruction time rolled up into a flat "top routines" table (from Klive BASIC SUBs, `.proc` blocks or labels, per bank), a **call graph** with inclusive and exclusive time, **interrupts as their own roots** (a frame-interrupt music player shows as its own cost), `-at`/`-until` windows for one frame of a loop, editor hints, and **speedscope and callgrind exports** (no other retro tool exports either) plus CSV and Fuse's format. **DeZog-compatible unit tests** (G5.5): DeZog's `UT_` labels and assertion macros with **both** the Klive assembler and sjasmplus, run headlessly in a worker on a fresh machine per test - **deterministic** (the time limit is emulated time, so CI and a laptop agree), **T-states per test** (DeZog cannot measure them), stack overflow/underflow and RET-instead-of-TC_END caught; a Unit Tests panel and Tests pane with click-to-source and the failing values; **Debug a test** with the full debugger, reverse debugging included; **Run with coverage**. **Tests in CI** (G5.6): `klive test` runs them headlessly - no window, no display - with exit codes, **JUnit XML** (emulated time, so the file is byte-identical between runs) and **LCOV** coverage, plus TAP; GitHub Actions and GitLab examples (DeZog's tests run only inside VS Code; no other Spectrum tool runs tests in CI) | ✅ (DeZog only; VS Code only, no CI) | ✗ | profiler | memory diff | ✗ |
| Call stack, watches | ✅ (+ BASIC call stack) | ✅ | ? | ✗ | ✅ | ◐ |
| Disassembly insight | ✅ branch verdicts (taken/not-taken, T-state cost), system-variable operands, T-state measuring | ✅ | ◐ | ◐ | ✅ | ✗ |
| NEX reverse engineering | ✅ debug any .nex with no project, live bank vs. file diff, `.nex.dis` annotations, `nex-label` | ◐ (DeZog Analyze: call graph, flowchart) | ✗ | ✗ | ✗ (no Next) | ✗ |
| General reverse engineering (48K/128K) | ◐ (live disassembly only) | ◐ | ✗ | ✗ | ✅ auto code/data detection, annotated ROM, SkoolKit, graphics finder | ✗ |
| **Live Next sprite / Copper / layer inspectors** | ✅ **Copper, sprites, tilemap, Layer 2 and layer composition (main)**: a live Copper panel and a Copper List with a raster ruler, list checks (no HALT, never-matching or out-of-order WAITs) and a source column mapped back to `.copper` lines; a **Sprite Inspector** with all 128 attribute slots decoded (relatives resolved by the core, "why is it hidden" diagnostics, changed-since-last-stop markers), the 16K pattern RAM *as used* in the live palette with usage counts and mixed-format warnings, a sprite-space map with the clip window, and `.spr` export; a **Tilemap Inspector** with the whole map (or as displayed) and the screen's view outlined, every cell decoded with its raw bytes and three addresses, the tile definitions with usage counts, and base-address overlap diagnostics against the ULA screen; a **Layer 2 Inspector** showing the displayed (`$12`), shadow (`$13`) and `$123B`-write-window banks side by side, whole or as displayed, with bank boundaries, the scroll and clip windows, priority pixels, and every pixel resolved to its byte, palette index, transparency (RGB against `$14`) and four addresses; **layer composition**: hide or solo any layer on the emulator screen (the program unaffected: collisions and registers unchanged), a paused picture recomposed exactly under mid-frame Copper changes, the four clip windows drawn on the screen, and a **pixel probe** that names the layer and the mixer rule a pixel won by (apparently unique) | ✅ (ZEsarUX) | ? | — | — | ✗ |
| Beam position on the paused screen | ✅ **(main)** the raster line and position, the paused picture drawn up to the beam and the previous frame's pixels hatched, blanking named, a hover readout of when the beam reaches any pixel, the Copper's breakpoint hit as a second marker; on the Next and every Spectrum model | ✅ (ZEsarUX) | ? | ? | ? | ✗ |
| Next asset editors | ✅ sprite editor (.spr), palette editors (.pal/.npl), Layer 2 picture viewer (.sl2/.nxi, all three resolutions), image viewers | ✗ | ✗ | — | — | ✗ |
| NextZXOS boot, SD image | ✅ cached boot; `ncp` host↔image copy through a built-in FAT32 driver | ✅ | ✅ (bundled hdfmonkey) | — | — | via CSpect |
| Load and save .sna / .z80 / .szx snapshots | ✅ on main (unreleased): all three formats load, run and debug-stop at PC on the 48K/128K/Pentagon/+2A/+3/+2E/+3E/TC2048/TC2068/TS2068/Scorpion (the Timex screen mode, chunk map and AY kept by .szx and .z80, a 2068's cartridge by .szx) (a +2A/+3 snapshot stays on a +2A/+3 project's Amstrad ROMs, and a +2A/+3 model saves as one), with a viewer (screen, registers, paging, AY, RAM banks) and drag and drop; all three are saved from a running or paused machine, with what .z80/.sna cannot hold reported | ✅ | ✗ | ✅ | ✅ | — |
| Save/restore the complete machine state (all machines, incl. Next and Z88) | ✅ on main (unreleased): `.kls` state files and a quick save/restore slot for every WASM machine, exact to the T-state; a Spectrum state also carries a `.szx` for other Klive versions | ◐ (ZEsarUX `.zsf`) | ? | ✅ (`.szx`, Spectrum only) | ? | via CSpect |
| RZX recording / playback | ✅ on main (unreleased): play on the 48K/128K/+2A/+3/+2E/+3E with a viewer, under the debugger (breakpoints and stepping inside a recording), desyncs paused at the instruction; record with autosave, rollback and finalising, "record from here" over a playback; render a recording to video, faster than real time | ? | ✗ | ✅ | ✅ | ✗ |
| Tape / disk | ✅ TAP/TZX (all blocks), tape viewer, DSK create/view | ✅ | — | ✅ | ◐ | — |
| Export | ✅ TAP / TZX / HEX with generated BASIC loader and loading screen, NEX | ◐ | — | — | ✅ SkoolKit | NEX |
| Scripting / automation | ✅ Klive Script (.ksx) with build-pipeline hooks, plus a local, token-authenticated JSON-RPC automation API and the `klive ide` command line (build, run, debug, wait for breakpoints, memory, registers, screenshots; G6.1, unreleased); headless `klive test`, `klive build` and `klive run` for CI (G5.6, G6.1: run a project, tape, snapshot or NEX file to a frame, address, HALT or breakpoint and write screenshots, memory dumps and registers, byte-identical between runs) | ✅ ZRCP, JS peripherals | ✅ C# plugins | ✗ | ✅ Lua | ✗ |
| Debug on real Next hardware | ✗ | ✅ (DeZog serial) | ✗ | — | — | ✗ |
| Video recording of emulator plus IDE | ✅ (bundled FFmpeg; side-by-side capture verified on macOS) | ✗ | ✗ | ◐ | ✗ | ✗ |
| Integrated hardware reference | ◐ "Inside the ZX Spectrum Next" book (chapters 1–8 and three appendices written) | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 3. Where Klive is strong

1. **One app, no assembly required.** The emulator, a Monaco editor with real language intelligence,
   the assembler, a BASIC compiler and the debugger ship together on Mac, Windows and Linux.
   Compile, inject, run and debug take one click, and project templates cover sp48, sp128, +3E,
   Z88 and Next × Klive asm, ZX BASIC, sjasmplus, PASTA/80 and z88dk. Competitors need three or four
   separately installed tools wired together through launch.json and map files.
2. **BASIC as a first-class debug language** (on main). No competitor offers reliable
   source-level debugging for ZX BASIC: ZEsarUX only views BASIC, and ZX Basic Studio's breakpoints
   are reported broken. This is the clearest gap in the market, and Klive fills it.
3. **Next-native workflow.** NextReg write breakpoints, bank-relative breakpoints and watchpoints,
   Next register and MMU panels, a `.dma` assembler DSL, `.savenex` with copper, palette and
   loading bar, sprite and palette editors, SD-image file copy and a cached NextZXOS boot.
4. **NEX reverse engineering.** You can debug any `.nex` with no project, break at its entry point,
   compare a live bank with the file, and keep labels, comments and regions in a sidecar. Spectrum
   Analyser, the reverse-engineering leader, has no Next support at all.
5. **Code understanding in the disassembly.** It shows branch verdicts with the actual T-state
   cost, names system variables as operands, measures T-states between points, and has an Instant
   Screen view, a BASIC listing read from live memory, a ULA panel showing beam phase,
   contention and floating bus, and (on main) the beam drawn on the paused screen.
6. **Engineering credibility.** The Next core is C/WASM and cites the VHDL in about 150 places;
   there are per-opcode Z80 tests, a hardware test catalogue, and visual tests on the real ROMs.
7. **Content creation.** Built-in emulator and IDE video recording, which is useful for tutorials
   and streams.

## 4. Where Klive is weak (missing features)

Ranked by how much each gap would matter to an experienced Spectrum or Next developer comparing
tools:

| # | Gap | Who has it | Notes |
|---|---|---|---|
| W1 | ~~**Logpoints**~~ — closed on main (G1.4, with conditional breakpoints and hit counts; G1.5 DeZog ASSERTION/WPMEM comments and G1.6 one-shot breakpoints done too; unreleased) | ZEsarUX, DeZog, Fuse, SpecEmu, MAME | An annotated DeZog project's LOGPOINT, ASSERTION and WPMEM comments all work unchanged. Remove the README roadmap entry for conditions and logpoints once released. |
| W2 | ~~**Reverse debugging / execution history**~~ — closed on main for every Z80 machine (G4.1–G4.4; unreleased) | DeZog (zsim, ZEsarUX), ZEsarUX, Zeus | DeZog's most-praised feature. G4.1/G4.2 record every instruction of a debug session on every Z80 core (.plans/EXECUTION_HISTORY_VIEWER_PLAN.md, .plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md); G4.3 stepped back through the registers (.plans/LITE_STEP_BACK_PLAN.md); G4.4 puts the whole machine in the past, memory and devices included, with Continue from the past, Take over here and reverse watchpoints (.plans/REVERSE_DEBUGGING_PLAN.md); G4.5 exports a range of the history as a text or CSV trace for diffing two runs, which DeZog cannot save (.plans/TRACE_EXPORT_PLAN.md); G4.6 saves a whole reverse-debugging session to a file that replays elsewhere with the debugger attached - an RZX for every machine, with breakpoints and the ability to step back - which no other Spectrum tool offers (.plans/DEBUG_SESSION_RECORDING_PLAN.md). Claim it on the landing page once released. |
| W3 | ~~**Unit tests**~~, ~~code coverage~~, ~~profiler~~ — all three closed on main (G5.1–G5.6; unreleased), the tests in CI included | DeZog; Fuse and Zeus profilers | Code coverage and the memory heat map work on every Z80 machine (.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md): per-bank line coverage in the editor and disassembly, execute/read/write counts as a heat map, self-modifying code detection, LCOV/CSV/`.kcov` exports - beyond DeZog's and ZEsarUX's 16-bit coverage. The profiler (G5.3/G5.4, .plans/PROFILER_PLAN.md) adds a flat and a call-graph profile with interrupts as roots and speedscope/callgrind exports, which Fuse's and Zeus's per-address profilers lack. Unit tests (G5.5, .plans/Z80_UNIT_TESTS_PLAN.md) run DeZog-style test projects unchanged with both assemblers, deterministically and with T-states per test, and a failing test is debugged with reverse debugging - DeZog runs its tests on the live emulator under a wall-clock timeout. `klive test` (G5.6, .plans/UNIT_TESTS_CLI_PLAN.md) runs them in a CI job with JUnit and LCOV output, which DeZog, tied to VS Code, cannot. |
| W4 | ~~**Live Next hardware inspectors**~~ (~~sprites~~, ~~Copper list~~, ~~tilemap~~, ~~Layer 2~~, ~~layer composition~~) — closed on main: the Copper part (G3.1, with Copper breakpoints from G3.8 and the `.copper` pragma), the sprite part (G3.2/G3.3, the Sprite Inspector), the tilemap (G3.4, the Tilemap Inspector), Layer 2 (G3.5, the Layer 2 Inspector) and layer composition (G3.6); unreleased | ZEsarUX; DeZog sprites | Large impact for a "Next IDE". The Copper List, Copper breakpoints and the `.copper` DSL go beyond ZEsarUX's Copper viewer (.plans/COPPER_DEBUGGING_PLAN.md); the Sprite Inspector's core-resolved relatives, hidden-sprite diagnostics and *as used* pattern sheet go beyond DeZog's sprite view (.plans/SPRITE_INSPECTOR_PLAN.md); the Tilemap Inspector adds base-address overlap diagnostics and cell-to-tile cross-links (.plans/TILEMAP_INSPECTOR_PLAN.md); the Layer 2 Inspector answers "where are my writes going?" by showing the `$123B` write window beside the displayed and shadow banks (.plans/LAYER2_INSPECTOR_PLAN.md); layer composition goes beyond ZEsarUX's layer switches with a solo view, an exact paused recompose and a pixel probe that explains why a layer won (.plans/LAYER_COMPOSITION_PLAN.md); the beam position overlay (G3.7) shows where the raster is on the paused screen and marks which part of the picture is still the previous frame's (.plans/BEAM_POSITION_OVERLAY_PLAN.md). Sprite-attribute breakpoints (`sp:`, the sprite half of G3.8, .plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md) complete G3.8: they catch every writer of an attribute byte - port `$57` from the CPU or the DMA, the NextReg mirrors from the CPU or the Copper - where `nr:` breakpoints on the mirrors saw only part of it. |
| W5 | ~~**Snapshot loading and saving (.sna / .z80 / .szx), machine state files, RZX**~~ — closed on main (G2.1–G2.8; unreleased) | Fuse, ZEsarUX, Spectrum Analyser | Loading, viewing, running, debugging and saving all three formats is done (.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md, .plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md), and so are RZX playback, recording and render to video (.plans/RZX_PLAN.md). Debugging inside a recording goes beyond Fuse. |
| W6 | **No remote or real-hardware debugging**; ~~no external API~~ — the external-API half closed on main (G6.1; unreleased) | DeZog (serial), ZEsarUX ZRCP, CSpect plugins, MAME gdbstub | Shuts Klive out of the VS Code/DeZog ecosystem. The automation API (.plans/COMMAND_LINE_AUTOMATION_PLAN.md) is Klive's answer to ZRCP: JSON-RPC over a Unix socket or named pipe, off by default, a per-start token and permission levels - unlike ZRCP's open TCP port - with `klive ide` verbs for shell scripts and documented Node and Python clients; the headless `klive test`, `klive build` and `klive run` (G5.6, G6.1) bring the same command line to CI. Remote and real-hardware debugging stay open under G6.4. |
| W7 | **48K/128K reverse-engineering depth** (automatic code/data detection, annotated ROMs, SkoolKit, graphics finders) | Spectrum Analyser | Klive's annotation model exists for NEX only. |
| W8 | ~~**BASIC editor intelligence**~~ — closed on main (G8.1–G8.5; unreleased) | — (also weak elsewhere) | Hover, definition, scope-correct references and rename, completion (library routines add their `#include`), signature help, outline and folding for `.zxbas`, from the compiler's own binder. With zxbc selected, keyword help, completion and folding remain. |
| W9 | ~~**Machine breadth**~~ — closed on main (G9; unreleased): ~~ZX80/ZX81~~ (closed on main, G9.3; unreleased), ~~+2A/+3 with the Amstrad ROMs~~ (closed on main, G9.2; unreleased), ~~Pentagon 128~~ (closed on main, G9.1; unreleased), ~~Beta 128 / TR-DOS~~ (closed on main, G9.1b; unreleased; Klive cannot ship the TR-DOS ROM, so the user names their own), ~~Timex TC2048~~ (closed on main, G9.4a; unreleased), ~~TC2068/TS2068~~ (closed on main, G9.4b; unreleased), ~~Scorpion ZS-256~~ (closed on main, G9.4c; unreleased) | ZEsarUX, Fuse | The ZX80 and ZX81 (1K/16K/64K, PAL and NTSC, the ZX80 with the 8K ROM) run on one C/WASM core built on the shared Z80 (.plans/ZX8081_WASM_PLAN.md). The +2A and +3 boot Amstrad's own ROMs (v4.0 and v4.1, English and Spanish) on the +3E's core (.plans/PLUS3_AMSTRAD_ROMS_PLAN.md). The Pentagon 128 is a model of the 128K, its timing taken from the Next FPGA's Pentagon mode (.plans/PENTAGON_128_PLAN.md); its Beta 128 disk interface runs TR-DOS from the user's own ROM, with `.trd`/`.scl` disks written back to `.trd` files (.plans/BETA128_TRDOS_PLAN.md). The TC2048 runs on a new Timex core - the 48K machine built with Timex's SCLD - with its screen modes, port `$FF` and Kempston port; Klive cannot ship its ROM, so it boots the user's own or the 48K ROM (.plans/TIMEX_SCORPION_PLAN.md). The TC2068 and TS2068 are models of the same core, with the 8K chunk map, the AY, both joysticks and `.dck` cartridges; the TS2068 ROM's main loop and EXROM tape routines were found by running it. The Scorpion ZS-256 is its own machine on the 128K core, with 256K, `$1FFD`, its four ROMs (or the 128K's) and the Beta 128. W9's clone list is now complete. |
| W10 | **Proof points**: Next accuracy is unbenchmarked against CSpect/ZEsarUX publicly; sjasmplus debugging tested on 48K only | — | A credibility gap more than a feature gap. |

### Housekeeping found during the sweep (fix before marketing anything)
- **Klive BASIC is unreleased.** The BASIC compiler and its debugger are on main after v0.61.0
  with no CHANGELOG entry. The landing page must not lead with them until a release ships them.
- **`docs/content/machine-types.mdx` still says the Next is "still in development"**, which
  contradicts the README.
- **The README roadmap lists memory and I/O breakpoints and custom ROMs as planned**, but both
  are shipped. The README "Technology" section still describes pure-TypeScript emulators; they
  are now C/WASM.
- **The book is partial**: chapters 9–22 are stubs. Present it as "in progress" if it is mentioned.

---

## 5. Landing page: the five features where Klive is ahead

The choice follows two rules: each feature must be **something no single competitor matches**,
and it must be **visible in a screenshot or a 20–40-second clip**. Order: broadest appeal first,
deepest specialism last.

### Hero
- **Headline:** *The complete ZX Spectrum and Next development studio.*
- **Subhead:** *Write, assemble, compile, run and debug Z80 code and ZX BASIC in one app, on Mac,
  Windows and Linux. No toolchain to wire up.*
- **CTAs:** Download (OS-detected) · Documentation.
- **Media:** a 30-second looped, muted clip of the whole loop: edit code → Ctrl+F5 → the program
  runs in the emulator → a breakpoint hits → step. Record it with Klive's own IDE and emulator
  recording.

### Feature 1 — Everything in one place
- **Title:** *One app. Zero glue.*
- **Copy:** Emulator, editor, assembler, BASIC compiler and debugger, built to work together.
  Start from a template for 48K, 128K, +3E, Next or Z88 and press Run. Elsewhere this takes an
  assembler, an editor, an emulator and a debugger bridge, configured by hand.
- **Proof bullets:** one-click Compile → Inject → Run → Debug · project templates · works with
  sjasmplus, Boriel zxbc, z88dk and PASTA/80 when you want them.
- **Media:** a screenshot of the dual-window layout (IDE + emulator) on a project.
- **Beats:** DeZog + CSpect/ZEsarUX + VS Code; NextBuild.

### Feature 2 — Debug ZX BASIC like a modern language *(feature only after Klive BASIC is released)*
- **Title:** *Step through your BASIC, line by line.*
- **Copy:** Klive's built-in ZX BASIC compiler, compatible with Boriel ZX Basic and NextBuild
  CODEBANK, debugs at the source level: breakpoints on statements, Step Over and Step Into, a
  real call stack, live variables you can edit, and stops on runtime errors.
- **Media:** a clip of a breakpoint in a `SUB`, stepping, then editing a variable in the
  Variables panel.
- **Beats:** everyone; this need is currently unmet (ZX Basic Studio's version is reported broken).
- **Fallback if not yet released:** swap in Feature 6 below.

### Feature 3 — Built for the Next, down to the registers
- **Title:** *Speaks Next natively.*
- **Copy:** Break when a game writes a NextReg, with value and mask filters, Copper writes and
  old→new values. Set breakpoints and watches on banks rather than addresses. Program the DMA with
  a symbolic `.dma` assembler syntax, and build `.nex` files with palettes, copper and loading
  bars. Edit sprites and palettes in the IDE, copy files onto the SD image, and boot NextZXOS
  from a cached state.
- **Media:** a three-image strip: a NextReg breakpoint hit with old→new values · the Memory
  Mapping panel · the sprite editor.
- **Beats:** CSpect (text debugger), ZEsarUX (general-purpose UI).

### Feature 4 — Take any .nex apart
- **Title:** *Open a .nex. Understand it.*
- **Copy:** Debug any NEX file without a project and stop at its entry point. Watch a bank change
  live against the file on disk, name routines as you discover them, and keep your labels,
  comments and data regions in a sidecar file that is there next time.
- **Media:** a clip of `nex-run -d -e`, the popped-out bank's diff highlighting, then adding a
  label with `nex-label` and seeing it appear everywhere.
- **Beats:** Spectrum Analyser (no Next), DeZog (no NEX-specific workflow).

### Feature 5 — See what the CPU will do
- **Title:** *Disassembly that explains itself.*
- **Copy:** Every conditional branch shows whether it will be taken and what it costs in
  T-states, worked out from the live flags. System variables appear by name, you can measure
  T-states between any two points, and the ULA panel shows beam position, contention and
  floating bus as you step.
- **Media:** a close-up of the branch-verdict column ("NC met · 12 T"), plus the ULA panel.
- **Beats:** every competitor's plain disassembly.

### Feature 6 — reserve (use if Feature 2 isn't released yet)
- **Title:** *An editor that knows your assembler.*
- **Copy:** Completion, go to definition, find references and rename across files; hover over a
  macro to see its expansion, hover over an address to see its bytes; inline hex/decimal hints and
  colour pickers for `attr()`/`ink()`/`paper()`, all driven by the real compiler.
- **Beats:** standalone emulators. It is on par with VS Code + Z80 Macro-Assembler, so it is
  positioned as integration, not uniqueness.

### Supporting strip (below the five)
Small cards: *Cycle-accurate 48K/128K/+3E* · *Next core built from the FPGA's VHDL* · *Z88 and
experimental C64* · *Record your session as video* · *Klive Script automation* · *Free and open
source*.

### Deliberately **not** claimed
- Conditional breakpoints and logpoints until a release ships them (they are on main), reverse debugging, unit
  tests, code coverage and the heat map (on main), live Copper/sprite/tilemap inspectors, snapshot loading and saving and RZX until a release ships them (they are on main),
  real-hardware debugging
  (see §4).
- "Most accurate" anything. There is no public benchmark against CSpect, ZEsarUX or Fuse.
- No named competitor on the page. Comparisons stay implicit ("no toolchain to wire up").

---

## 6. Suggested next steps

1. **Review this document**, especially the five-feature choice and the Feature 2 timing.
2. **Fix the housekeeping items in §4** (machine-types.mdx, README roadmap and Technology sections).
3. **Capture the media** with `scripts/doc-shots/` (screenshots) and Klive's built-in recording
   (clips). This needs a fixture project per feature, which is a separate plan.
4. **Implement the content** on the landing page prototype: hero video, five feature sections,
   supporting strip, and OS-detected download links.
5. **Separately, consider the roadmap**: W1 (conditional breakpoints, logpoints, DeZog's ASSERTION/WPMEM
   comments and one-shot breakpoints — all done on main) and W5 (snapshot loading and saving, RZX — all done on main) look like the cheapest gaps to close with the biggest
   perception payoff. W4 (live Next
   inspectors — now all done on main, layer composition included) and W2 (reverse debugging — done on
   main too) are the ones that make Klive the clear Next leader.

## Sources (competitors)
ZEsarUX github.com/chernandezba/zesarux (FEATURES, releases) · CSpect mdf200.itch.io/cspect ·
DeZog github.com/maziac/DeZog (Usage.md), Marketplace maziac.dezog · Fuse
fuse-emulator.sourceforge.net, sourceforge news · sjasmplus github.com/z00m128/sjasmplus ·
NextBuild github.com/em00k/NextBuild · Boriel github.com/boriel-basic/zxbasic ·
ZX Basic Studio github.com/boriel-basic/ZXBasicStudio, forum.boriel.com tid=2571 ·
Spectrum Analyser colourclash.co.uk/spectrum-analyser, github.com/TheGoodDoktor/8BitAnalysers ·
SpecEmu / ZX Spin: spectrumcomputing.co.uk forums · Zeus desdes.com · MAME docs.mamedev.org/debugger ·
Spectrum Computing dev FAQ spectrumcomputing.co.uk/faq/Developing_software.html.
