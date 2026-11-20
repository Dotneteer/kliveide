# Existing SAM Coupé Emulators: Survey for Klive

Surveyed 2026-11-18. Every licence below was checked against the GitHub API `license` field and
against file headers (read through `gh api .../contents` or WebFetch). Nothing was cloned or
downloaded to disk. Statements marked *inference* are my reading and were not confirmed from a
source.

## 1. Comparison

| Emulator / component | Language | Licence (verified) | Activity | Accuracy (summary) | Porting suitability for Klive |
|---|---|---|---|---|---|
| **SimCoupé** (Simon Owen) | C++17 | **GPL-2.0-or-later** (API `GPL-2.0`; headers of `SAMIO.cpp`, `CPU.cpp`, `CPU.h`, `SAM.h`, `Memory.cpp`, `Frame.cpp`) | Very active. v1.2.17 on 2026-08-30; v1.2.16 2026-05-25; v1.2.15 2025-08-01 | The reference. Per-access contention measured on hardware (incl. mode 1), exact INT active times, line/MIDI-OUT interrupts, per-cell video with mid-line mode/border artefacts, ASIC start-up delay, VL1772 floppy, Atom/Atom Lite, mouse, tape, debugger | **Read only.** The behavioural oracle |
| **SAASound** (Dave Hooper, Simon Owen) | C++ | **BSD-3-Clause** (repo `LICENCE`; API says `NOASSERTION` because the text names "Dave Hooper") | Active: pushed 2025-10-18 | The SAA 1099 used by SimCoupé and (as a basis) by the MiSTer core; fixed SYNC behaviour, tuned against crowd-sourced hardware test cases | **Port** (BSD-3 notice). The best SAA 1099 source |
| **kosarev/z80** | C++ (header-only) | **MIT** (API) | Active: pushed 2026-10-25 | SimCoupé's Z80 core since 2021-06-24; has WAIT-sampling hooks added for SAM contention | Klive keeps its own Z80; read for the WAIT-sample placement (MIT, so portable if needed) |
| **MAME** `samcoupe` driver (`src/mame/samcoupe/samcoupe.cpp`) + `src/devices/bus/samcoupe/*` | C++ | **GPL-2.0+** (header `// license:GPL-2.0+`, Lee Hammerton, Dirk Best; bus devices GPL-2.0+, Dirk Best) | Driver touched 2026-07-24 (screen split refactor); substantive work 2022 and earlier | Weak: header TODO says "emulate memory contention"; video per 16-pixel block from a timer; MIDI/mouse interrupts never raised | **Read only** (GPL, unlike most of MAME) |
| MAME `saa1099` (`src/devices/sound/saa1099.cpp`) | C++ | **BSD-3-Clause** (Juergen Buchmueller, Manuel Abadia) | Maintained with MAME | Register-level model at clock/256 | Portable, but SAASound is the better reference |
| MAME `wd_fdc.cpp`, `formats/coupe_{mgt,sad,sdf}.cpp` | C++ | **BSD-3-Clause** (Olivier Galibert; Dirk Best) | Maintained | Full WD177x family; SAM disk formats | Portable with notice; Klive already has its own WD1793 (1770 variant) |
| **SAMdisk** (Simon Owen) | C++ | **MIT** (API; `License.txt` "Copyright (c) 2002-2020 Simon Owen") | Pushed 2026-05-30 | Disk image tool: MGT/IMG, SAD, SDF, SBT, CPM, EDSK (`dsk.cpp`), TD0, and many more | **Port** the format readers |
| **mgtdisklib** (Simon Owen) | Python | **MIT** (API) | Pushed 2026-08-09 | SAM/+D disk file-system access | Read or port (MIT) for MGT directory/file layout, e.g. building boot disks |
| **pyz80** (Simon Owen) | Python | **GPL-2.0** (API) | Pushed 2025-08-28 | SAM's de-facto cross assembler; writes MGT images, map files read by SimCoupé | Tool, not emulator: Klive can be compatible with its map format, not copy it |
| **MiSTer SAM Coupé** (`MiSTer-devel/SAM-Coupe_MiSTer`, Sorgelig) | SystemVerilog/Verilog | Repo **GPL-2.0** (API); `rtl/video.sv` **GPL-3.0-or-later** (header); `rtl/saa1099.sv` GPL-2.0-or-later | Release 2026-06-03 | "Precise CPU and video timings" claim; contention as WAIT-style CPU enable gating; 4 MB external RAM, SAA, SID, DAC, mouse | **Read only.** Independent hardware-level opinion on contention and interrupt timing |
| SAMCoupe_MIST (Sorgelig) | VHDL/Verilog | GPL-2.0 (API) | Pushed 2020-05-30 | Ancestor of the MiSTer core | Read only; superseded |
| **ZX-Uno SAM core** (Miguel Angel Rodríguez Jódar, "McLeod"), seen via `ZXMicroJack/sam-coupe` | Verilog | **None found** (API `null`; `common/asic.v` header has no licence) | Fork pushed 2023-11-27; core dates from 2015 | ASIC with WAIT-based contention; README admits "Border effects bad due to memory contention issues" | **Do not use** (all rights reserved by default). Note only |
| **ZEsarUX** SAM machine (César Hernández Bañó) | C | **GPL-3.0-or-later** (header of `src/machines/sam.c`; API returns no licence) | Repo pushed 2026-11-17 | Partial: `sam.c` is 7.9 KB, SAA 1099 described as "Experimental simulation", Atom Lite | Read only; low value |
| **SamCoupeWeb** (anomixer) | C++ to WASM | GPL-2.0 (API) | Created 2026-05-06, pushed 2026-11-12 | SimCoupé compiled with Emscripten | Read only. Proof SimCoupé runs in a browser |
| libretro-simcoupe | C++ | None in API (GPL by derivation, *inference*) | Pushed 2019-08-17 | README: "WORK IN PROGRESS (BUGGY / ... NO SOUND)" | None |
| PSPSIM (PSP-Archive) | C++ | GPL-2.0 (API) | 2020 | SimCoupé port for PSP | None |
| ESP32-P4-PC-SamCoupe | C++ | None (API) | 2026-03-14 | "SimCoupe running in Olimex ESP32-P4-PC" | None |
| SAA1099Tracker `src/libs/SAASound/*.ts` (Martin Bórik) | TypeScript | **MIT** (repo `LICENSE.md` and file header; "Based on SAASound ... Dave Hooper") | Pushed 2026-03-02 | TS port of SAASound (older base, 1998-2004) | Interesting precedent only; port from the upstream C++ SAASound instead |
| Clock Signal (CLK) | C++ | MIT | Active (2026-11-18) | **No SAM Coupé.** `Machines/` has no SAM; the CLK "SAM" issues are the CoCo's 6883 SAM | Only its WD1770/1772 component (`Components/1770/`) is relevant |
| Fuse | C | GPL | — | No SAM Coupé machine (*inference*: Fuse emulates the MGT +D/DISCiPLE interfaces, not the SAM) | None |

Other names checked: "ArcSAM", "SAMemu", "jsamcoupe": nothing found on GitHub or the web. X128 and
ASCD are listed on sam.speccy.cz beside SimCoupé and ZEsarUX, but both are Spectrum emulators
(*inference*; not investigated). No Rust or Go SAM emulator was found (the only Go project,
`petemoore/samfile`, MIT, extracts files from disk images).

---

## 2. SimCoupé (Simon Owen): the reference

- **URLs:** https://github.com/simonowen/simcoupe, https://simonowen.com/simcoupe/
- **Licence:** **GPL-2.0-or-later.** API `GPL-2.0`; `License.txt` (18 KB, GPL text); every core
  header read carries the "version 2 ... or (at your option) any later version" clause. Copyright
  lines:
  - `SAMIO.cpp`: Simon Owen 1999-2015, Allan Skillman 1996-2001, Dave Laundon 2000-2001.
  - `CPU.cpp`: Simon Owen 1999-2015, Dave Laundon 2000-2003, Allan Skillman 1996-2001.
  - `Memory.cpp`: Simon Owen, Allan Skillman. `SAM.h`, `Frame.cpp`: Simon Owen.
- **Lineage:** descends from Allan Skillman's XCoupe (Linux, 1996) and SimCoupe 0.72 for DOS/Unix;
  Simon Owen extended it as WinCoupe, then rewrote it. Credits: Dave Laundon (CPU contention and
  sound), Dave Hooper (SAASound), Ivan Kosarev (Z80), Dag Lem (reSID), Philip Kendall
  (libspectrum). Dr Andy Wright gave permission to distribute the SAM ROMs (ReadMe).
- **Activity:** v1.2.17 on 2026-08-30 (debugger key mappings, macOS fixes); v1.2.16 on 2026-05-25
  (improved mouse, `-keyin`, Atom Lite as drive 1); CI for Windows, macOS, Linux.
- **External dependencies** (CMake FetchContent): `kosarev/z80` (MIT), `stripwax/SAASound`
  (BSD-3), `simonowen/resid` (GPL-2), `simonowen/libspectrum` (GPL-2, tape formats), zlib, fmt;
  SDL2 on non-Windows.

### Code structure (`Base/`, the emulation core)

| File | What it does |
|---|---|
| `SAM.h` | All SAM constants (see timing model) |
| `CPU.cpp/.h` | `sam_cpu : z80::z80_cpu<sam_cpu>` (CRTP over kosarev's core). Hooks `on_tick` (adds to `frame_cycles`), `on_mreq_wait` -> `Memory::WaitStates`, `on_iorq_wait` -> `IO::WaitStates`; frame loop, reset, NMI, fast-boot turbo for 200 frames; IM 2 random-bus option |
| `Memory.cpp/.h` | Paging (internal 256/512K, external 0-4 MB, ROM0/ROM1, optional ROM write), contention tables, screen-write invalidation per mode, ROM loading and ROM-hook pattern scanning (ROM 3.0; some hooks missing in 1.0/1.4) |
| `SAMIO.cpp/.h` | All ports: keyboard/status, LMPR/HMPR/VMPR, HEPR/LEPR, CLUT, border, LINE, ATTR, LPEN/HPEN, SAA, MIDI, printers/DACs, clocks (SAMBUS, Dallas), Kempston, floppy ranges, mouse; ASIC-asleep start-up; floating bus |
| `Frame.cpp/.h`, `FrameBuffer.*`, `Video.*` | Per-cell (8 T) renderer, modes 1-4, mid-line mode and border artefacts, ASIC fetch position |
| `Clock.cpp` | SAMBUS and Dallas real-time clocks |
| `Events.cpp` | Cycle-scheduled events (frame INT, line INT, MIDI, tape, ASIC ready, input) |
| `Sound.cpp`, `BlipBuffer.*` | Beeper, SAA (via SAASound), DACs; band-limited synthesis (BlipBuffer is LGPL in origin, *inference*) |
| `VL1772.h`, `Drive.cpp`, `Disk.cpp` | VL1772 (WD1772-compatible) controller and drive; MGT/SAD/EDSK/SBT/file images |
| `ATA.cpp`, `Atom.cpp`, `AtomLite.cpp`, `AtaAdapter.cpp`, `SDIDE.cpp`, `HardDisk.cpp` | Atom, Atom Lite, SD-IDE hard-disk interfaces (HDF images) |
| `Mouse.cpp` | SAM mouse protocol (50 µs read timeout, accumulating movement) |
| `Tape.cpp` | TAP/TZX/CSW through libspectrum, with tape traps and flash loading |
| `Keyboard.cpp`, `Keyin.cpp` | Key matrix and host mapping; ROM-based auto-typing (`-keyin`) |
| `SID.cpp`, `SAMVox.cpp`, `Paula.cpp`, `BlueAlpha.cpp`, `VoiceBox.cpp`, `sp0256.cpp`, `Parallel.cpp` | Add-ons: SID, DACs, Blue Alpha sampler, VoiceBox speech, printer |
| `Debug.cpp` (92 KB), `Breakpoint.cpp`, `Expr.cpp`, `Disassem.cpp`, `Symbol.cpp` | Full debugger; reads pyz80 map files |
| `Options.cpp`, `GUI*.cpp`, `AVI/GIF/WAV/SavePNG` | Options, built-in GUI, recording |

### Timing model (in my words)

- **Clocks:** 24 MHz crystal; 12 MHz pixel clock; CPU 6 MHz. A cell is 8 T (16 hi-res pixels);
  a line is 48 cells = 384 T; a frame is 312 lines = 119,808 T (about 50.08 Hz, run as 50).
- **Geometry:** 192 screen lines; 68 top-border lines, 52 bottom; 32 screen cells with 8 border
  cells each side (64 T); the ASIC-to-frame offset is 64 T.
- **Contention** (Dave Laundon's per-access model, later refined): three frame-length tables
  indexed by frame cycle, with the delay `mask - ((t + 2) & mask)`:
  - border (and screen-off) lines: mask 3, so an access waits for the next 4-T slot;
  - main-screen area: mask 7 (one slot in 8);
  - mode 1 additionally uses mask 7 in alternating 8-cell bands across the whole line.
  Only internal RAM is contended; ROM and external RAM are not (since v1.0, 2006). ASIC ports
  F8-FF are always contended at one slot in 8. A `full_contention` option can turn it all off.
  Alignment was corrected in 2021-07 and the main-screen offset in v1.2.11 (2022-05-04).
- **Wait placement:** SimCoupé's 2021 work with kosarev/z80 (issue #10, closed 2021-07-04) moved
  waits to WAIT sampling during T2 of memory cycles and TW of I/O cycles, matching a logic-analyser
  trace of `OUT (C),B` on a real SAM. That patch "passed his timing test suite".
- **Interrupts:** INT active for 128 T (`CPU_CYCLES_INT_ACTIVE`); frame INT at cycle 0 of the
  frame; a LINE write cancels and reschedules the line INT at
  `(line + 68) * 384`; MIDI OUT sets the TX flag and schedules an interrupt from transmit and active
  times. Exact INT durations fixed Defender (2000); MIDI-OUT timing fixed a demo (2001).
- **ASIC start-up:** for 291,675 T (about 49 ms) after power-on the ASIC ports read 0 and ignore
  writes; ROMs from 1.0 on wait about 55 ms for this (samrom ReadMe).
- **Video:** rendered per cell up to the current raster position on any write that matters.
  Mode changes take two steps (page change one cell after the mode); a mid-cell border change
  draws one blended transition pixel; the CLUT is read per cell; mode 3's four colours come from
  HMPR bits once per frame. Screen-off draws black.
- **Floating bus:** unhandled ports return the current ASIC display byte on screen lines, else
  0xFF. ATTR port (FF) fully emulated since 1.1.
- **Measured facts published by the author** (not GPL code, but © Simon Owen, no licence stated):
  - https://simonowen.com/articles/mode1: mode 1 adds 4-T holds in alternating 8-cell blocks
    (columns 7-14, 23-30, 39-) one cell ahead of the pixels because the ASIC prefetches; port
    248-255 writes cost 4 T unless they land in the last 4 T of a cell. Measured with border-colour
    bars on real hardware.
  - https://simonowen.com/sam/timings: per-instruction timing tables generated with v1.2.5's core
    and rules, for border, screen, mode 1 and external/ROM columns.
  These are facts to record in Klive's words and to test against; the tables must not be copied.

### Media, loading and IDE-relevant features

- Disks MGT, SAD (v1/v2 gzip), EDSK, SBT (read-only); TD0 via SAMdisk. Tapes TAP/TZX/CSW.
  HDF for Atom/Atom Lite.
- Auto-boot of a disk inserted at the start-up screen (default); "DOS boot" swaps in an internal
  DOS image to boot a non-bootable disk, then restores it; fast reset skips the RAM test.
  Boot failure codes 55/19/53/101/0 documented in `Manual.md`.
- Auto-typing (`-keyin`, 1.2.16) through ROM hooks.
- Debugger: execution/memory/IO/interrupt breakpoints with conditions, raster position, upcoming
  events (FINT, LINT, MIDI, ASIC), pyz80 symbols.

### Known inaccuracies (from its own comments and docs)

- `Frame.cpp`: mode-change artefacts are drawn by temporarily rewriting display memory (three TODOs);
  border transitions are approximated ("We don't have the resolution to show only part").
- `Memory.cpp`: the main-screen test's side-border threshold is `2 * CPU_CYCLES_PER_SIDE_BORDER`;
  worth checking against hardware (*inference*, from reading the description, not a stated bug).
- MIDI in is "future"; MIDI out goes to a host synth on Win32 only.
- No public test suite in the repo; the changelog mentions none. The timing test suite mentioned in
  kosarev/z80 #10 is not published (*inference*: searched GitHub and the web).

**Suitability:** **Read only, never copied or translated** (GPL-2+). It is the oracle: run it on
Klive-authored test programs and record observed screens, cycle counts (its debugger shows raster
position and frame cycles) and audio. Its published measurement articles are the best fact source.

## 3. SAASound (Dave Hooper, with Simon Owen)

- **URL:** https://github.com/stripwax/SAASound (Simon's mirror `simonowen/SAASound`, pushed 2023-08-19).
- **Licence:** **BSD-3-Clause.** `LICENCE`: "Copyright (c) 1998-2004, Dave Hooper" and
  "Copyright (c) 2004-2025, Dave Hooper + Simon Owen", standard three clauses with "Dave Hooper" in
  the endorsement clause (why the API says `NOASSERTION`). File headers say only "Part of SAASound
  copyright 1998-2018 Dave Hooper"; the repo `LICENCE` governs (*inference*, same situation as CLK).
- **Activity:** pushed 2025-10-18 (register-log formatting for VHDL text I/O, debug-log fix). Only
  "bleeding-edge" CI tags; SimCoupé pins a commit.
- **Structure (`src/`):** `SAAImpl.cpp` (output stage, public API), `SAADevice.cpp` (register file,
  six channels), `SAAFreq.cpp` + `SAAFreq.dat` (frequency generators, table), `SAANoise.cpp` (two
  noise generators), `SAAEnv.cpp` (two envelope generators), `SAAAmp.cpp` (amplitude/mixing),
  `SAASndC.cpp` (C API), `SAAConfig.cpp` + `minIni/` (optional INI config; minIni has its own
  licence, *inference*: not needed for a port).
- **Model:** clock defaults to the 8 MHz external clock (`SetClockRate`); each output sample is the
  average of `1 << oversample` chip steps; optional DC-blocking high-pass (about 5 Hz); 16-bit
  stereo or six separate channel buffers. **No timestamped write API**: writes apply at once, so the
  host must run the chip up to the write's cycle first (*inference*: Klive's host already does
  this for other sound chips).
- **Validation:** README says accuracy work since 2018 uses DOSBox-team reverse engineering and
  crowd-sourced test cases; `tests/SimCoupe dsk/testcases.dsk.gz` is a SAM disk of test cases
  (licence of its contents not stated).
- **Suitability:** **Port** into the C core with the BSD-3 notice in `THIRD_PARTY_NOTICES.md`.
  It is the same SAA model SimCoupé uses, so Klive's audio can be compared against SimCoupé.

## 4. MAME `samcoupe`

- **URLs:** https://github.com/mamedev/mame/blob/master/src/mame/samcoupe/samcoupe.cpp;
  `src/devices/bus/samcoupe/{drive,expansion,mouse}/`.
- **Licence:** **GPL-2.0+**, not BSD: `// license:GPL-2.0+`, copyright-holders Lee Hammerton, Dirk
  Best. All bus devices checked (`floppy.cpp`, `atom.cpp`, `mouse.cpp`, `sdide.cpp`, `onemeg.cpp`)
  are GPL-2.0+ (Dirk Best). BSD-3 parts used by the driver: `sound/saa1099.cpp`,
  `machine/wd_fdc.cpp` (WD1772 at 24 MHz/3), `formats/coupe_mgt.cpp`, `coupe_sad.cpp`,
  `coupe_sdf.cpp`.
- **Activity:** last commits 2026-07-24 (screen device split), 2024-09, 2023-11 (software list).
- **Accuracy:**
  - Header TODO: "Better timing, emulate memory contention". No wait states at all.
  - Video: a timer every 16 pixel clocks draws one block, so mid-line changes land at block
    granularity; modes 1-4; blanking in modes 3/4 with VMPR bit 6 and BORDER bit 7.
  - Line INT at the right border of the matching line; frame INT from vblank; each INT held for a
    20 µs timer (SimCoupé uses 128 T, about 21.3 µs). MIDI and mouse interrupt bits defined but
    never raised.
  - Expansion devices: Atom, SD-IDE, 1 MB, SAMBUS/Dallas clocks, SID, Blue Alpha sampler, VoiceBox,
    SPI; tape (TZX); 14 ROM versions from 0.1 to 3.1 plus an Atom auto-boot ROM.
- **Suitability:** read only for the GPL driver. Its **list of ROM versions with hashes** and its
  reset values (LMPR 0x0F, HMPR 0x01, VMPR 0x81) are facts. The BSD-3 SAM disk-format readers are
  portable, but SAMdisk (MIT) covers more.

## 5. FPGA cores

### MiSTer SAM Coupé (Sorgelig)

- https://github.com/MiSTer-devel/SAM-Coupe_MiSTer; release 2026-06-03 (previous 2024-04-21).
- **Licence:** repo GPL-2.0; `rtl/video.sv` GPL-3.0-or-later ("Copyright (c) 2016 Sorgelig");
  `rtl/saa1099.sv` GPL-2.0-or-later, "Based on SAA1099.v code from Miguel Angel Rodriguez Jodar,
  Based on SAASound code from Dave Hooper". CPU is T80 (`rtl/T80/`); floppy is `wd1793.sv`.
- **Model:** contention gates the CPU clock enable (`ram_wait`/`io_wait`); the video module derives
  `mem_contention` from the horizontal counter (fetch window, plus the mode-1 band from `hc[6]`
  when not in full-ZX mode). Line INT and frame INT (`vc == 244`) are held for counter values
  3-131 of the line. ROM and external RAM are excluded from waits, agreeing with SimCoupé.
  "Real CPU frequency for ZX mode", turbo up to 24 MHz, auto-start of a disk on the stripes screen.
- **Suitability:** read only; a second, hardware-level opinion on wait windows and INT length.

### ZX-Uno core (Miguel Angel Rodríguez Jódar), `ZXMicroJack/sam-coupe`

- Verilog ASIC (`common/asic.v`, 2015, Spartan 6), TV80 CPU, `wd1770.v`, `saa1099.v`, PS/2 mouse;
  repo also commits `ROM30.bin`. **No licence** in the repo or headers read: do not use. Its own
  README says border effects are wrong because of contention problems.

## 6. ZEsarUX

- https://github.com/chernandezba/zesarux, `src/machines/sam.c`, `src/cores/core_sam.c`.
- GPL-3.0-or-later (file header, "Copyright (C) 2013 Cesar Hernandez Bano"). Active (2026-11-17).
- `FEATURES` lists "Sam Coupe", Atom Lite, and "Experimental simulation of the Sam Coupe Audio Chip
  (SAA1099)". Small machine file; contention through ZEsarUX's generic `contend.h`.
  *Inference:* well behind SimCoupé. Read only, not needed.

## 7. Web and other ports

- **SamCoupeWeb** (https://github.com/anomixer/SamCoupeWeb, GPL-2.0, 2026-05-06 to 2026-11-12):
  SimCoupé under Emscripten with drag-and-drop, 7z, URL loading; describes itself as AI-assisted.
  *Inference:* shows a full SimCoupé core runs at speed in WASM, which bears on Klive's per-cell
  design. Read only.
- libretro-simcoupe (2019, unfinished), PSPSIM (GPL-2), ESP32-P4 port: SimCoupé derivatives, none
  useful.

## 8. Tools and supporting material

- **SAMdisk** (MIT, https://github.com/simonowen/samdisk): `src/types/mgt.cpp` (MGT and the +D IMG
  track order), `sad.cpp`, `sdf.cpp`, `sbt.cpp`, `cpm.cpp`, `dsk.cpp` (EDSK), `td0.cpp`;
  `SAMCoupe.cpp` (SAM-specific format detection). **Portable** with the MIT notice for Klive's disk
  image loading.
- **mgtdisklib** (MIT, Python): SAM/+D directory and file handling; reference for writing a boot
  disk containing the IDE's output (*inference*: Klive would write it in TS).
- **pyz80** (GPL-2.0): the community assembler; outputs MGT disks with an auto-boot file and map
  files. Klive need only read its documented formats.
- **samrom** (https://github.com/simonowen/samrom): ROM 3.0 source ("Copyright Andrew J.A. Wright
  1989-90") plus binaries ROM01-ROM30, "released with kind permission from the ROM author, Dr Andy
  Wright". The repo carries a GPL-2 `COPYING` (API `GPL-2.0`). *Inference:* the GPL applies to the
  source files in that repo; the binaries' redistribution rests on Andy Wright's permission, which
  SimCoupé also relies on. Klive should record that permission's wording before bundling a ROM.
- **SAM Coupé Technical Manual v3.0** in Markdown (stefandrissen, no licence; OCR of the World of
  SAM scan): a fact source, not code.
- **sam-users/sam-coupe-std-headers** (MIT): port and system-variable names for assembly.
- **samdos** source (simonowen/samdos, stefandrissen/samdos; no licence) and **MasterDOS** source
  (dandoore, GPL-3.0): references for DOS behaviour only.

## 9. Test programs and validation material

- **No public automated SAM test suite** was found. SimCoupé's repo has none; Simon Owen's timing
  suite (kosarev/z80 #10, 2021) is unpublished.
- SAASound's `tests/SimCoupe dsk/testcases.dsk.gz`: SAA test cases on a SAM disk (licence of the
  contents not stated; usable as an oracle input only after checking).
- Published measurement methods: the mode 1 border-bar method (simonowen.com/articles/mode1) and the
  instruction timing tables (simonowen.com/sam/timings), both © Simon Owen with no licence. Klive
  can write its **own** border-bar and instruction-timing programs from the described method and
  compare its core with SimCoupé.
- kosarev/z80 has its own Z80 timing tests (MIT) but nothing SAM-specific.
- Demos named in SimCoupé's changelog as timing-sensitive (Defender, the Fred 59 Space demo, MOD
  Player, sample-player demos, SAM Mines, KEDisk, Legend of Eshan) make a practical regression list
  for oracle comparison (their own licences are not Klive's to redistribute).

## 10. Recommendation for Klive

1. **No permissive full-machine source exists.** SimCoupé, MAME's driver, ZEsarUX and the FPGA
   cores are all GPL (or unlicensed); CLK has no SAM. The ASIC, contention, video and interrupts are
   Klive's own code, written from the Technical Manual and from facts recorded in Klive's words.
2. **Port SAASound** (BSD-3) into the C/WASM core for the SAA 1099, keeping both copyright lines in
   `THIRD_PARTY_NOTICES.md`. Drive it from the host with cycle-ordered writes.
3. **Port SAMdisk's format readers** (MIT) for MGT/IMG, SAD, SDF, SBT and EDSK; MAME's BSD-3
   `coupe_*` readers are an alternative.
4. **Floppy:** reuse Klive's shared WD1793 in its 1770/1772 variant (as for the Enterprise EXDOS),
   checked against CLK's MIT `Components/1770` and MAME's BSD `wd_fdc.cpp`.
5. **Z80:** Klive's shared core. SAM contention must be applied as WAIT samples at T2 of memory
   cycles and TW of I/O (the 2021 finding), with ROM and external RAM never contended.
6. **Oracle: SimCoupé v1.2.17** (GPL-2+, run as a behavioural oracle only). Compare screens,
   frame-cycle counts and audio of Klive-authored test programs (border bars, per-instruction
   timing in border/screen/mode 1, line-INT position, INT length, mode switch artefacts). The MiSTer
   core is a second opinion where SimCoupé's comments admit approximation.
7. **Read only, never copy or translate:** SimCoupé (and SamCoupeWeb, PSPSIM, libretro port),
   MAME `samcoupe.cpp` and `bus/samcoupe/*`, ZEsarUX, the MiSTer/MiST cores, pyz80, MasterDOS.
   Do not read the unlicensed ZX-Uno core for design.
8. **ROMs:** the samrom binaries are distributed by permission of Dr Andy Wright; Klive should
   obtain or quote that permission precisely before bundling ROM 3.0 (open question).

## Sources

- SimCoupé: https://github.com/simonowen/simcoupe (API `repos/simonowen/simcoupe`, releases, commits);
  `Base/SAM.h`, `Base/CPU.cpp`, `Base/CPU.h`, `Base/Memory.cpp`, `Base/SAMIO.cpp`, `Base/Frame.cpp`,
  `CMakeLists.txt`, `ReadMe.md`, `Manual.md`, `ChangeLog.md`; https://simonowen.com/simcoupe/
- Measurements: https://simonowen.com/articles/mode1, https://simonowen.com/sam/timings,
  https://github.com/kosarev/z80/issues/10
- SAASound: https://github.com/stripwax/SAASound (`LICENCE`, `README.MD`, `src/SAAImpl.cpp`)
- kosarev/z80: https://github.com/kosarev/z80
- MAME: `src/mame/samcoupe/samcoupe.cpp`, `src/devices/bus/samcoupe/**`, `src/devices/sound/saa1099.cpp`,
  `src/devices/machine/wd_fdc.cpp`, `src/lib/formats/coupe_{mgt,sad,sdf}.cpp` (headers via GitHub API)
- MiSTer: https://github.com/MiSTer-devel/SAM-Coupe_MiSTer (`README.md`, `SAMCoupe.sv`, `rtl/video.sv`,
  `rtl/saa1099.sv`); https://github.com/sorgelig/SAMCoupe_MIST
- ZX-Uno: https://github.com/ZXMicroJack/sam-coupe (`README.txt`, `common/asic.v`);
  https://www.worldofsam.org/node/981
- ZEsarUX: https://github.com/chernandezba/zesarux (`src/machines/sam.c`, `src/cores/core_sam.c`, `src/FEATURES`)
- CLK: https://github.com/TomHarte/CLK (`Machines/`, `Components/`)
- SamCoupeWeb: https://github.com/anomixer/SamCoupeWeb; libretro: https://github.com/libretro/libretro-simcoupe
- Tools: https://github.com/simonowen/samdisk, https://github.com/simonowen/mgtdisklib,
  https://github.com/simonowen/pyz80, https://github.com/simonowen/samrom,
  https://github.com/mborik/SAA1099Tracker, https://github.com/stefandrissen/sam-coupe-technical-manual,
  https://github.com/sam-users/sam-coupe-std-headers
- History: https://www.worldofsam.org/node/806, https://sam.speccy.cz/pctools.html

## Open questions

1. **ROM permission.** What exactly did Dr Andy Wright permit (which ROMs, which redistributors)?
   SimCoupé and samrom quote it without the text.
2. **Main-screen contention threshold.** SimCoupé's main-screen test uses twice the side-border
   width; MiSTer derives the window from its counter. Confirm with a Klive border-bar test run on
   SimCoupé (and ideally real hardware).
3. **INT length.** SimCoupé 128 T vs MAME 20 µs vs MiSTer counter 3-131: confirm with an oracle test.
4. **SAASound test disk.** Licence of `testcases.dsk` contents; can Klive use it in CI or only locally?
5. **MIDI.** No emulator implements MIDI in; is MIDI OUT interrupt timing enough for Klive?
6. **mgtdisklib vs SAMdisk** for writing auto-boot disks from IDE output: which file-system details
   (directory entry, auto-run line) are needed, recorded from the MIT sources.
