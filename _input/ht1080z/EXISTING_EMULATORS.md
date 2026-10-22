# HT-1080Z and TRS-80 Model I — existing emulators

Survey for Klive IDE, 2026-10-21. Purpose: find what Klive may **port** (MIT preferred; BSD / zlib /
Apache acceptable with notices) and what it may only **read for facts** (GPL, closed source), and
pick an accuracy oracle. This is research, not an implementation plan.

How licences were verified: GitHub API `repos/<r>` → `license.spdx_id`; the repository's LICENSE
file read through the API or a shallow clone; per-file headers of the files that matter grepped for
`copyright|license|GPL|non-commercial`. Codeberg via its `api/v1`. Activity = `pushed_at` and the last
commits touching the relevant files. Statements not read directly from a source are marked
*inference*.

The machine in one paragraph (for context; the hardware itself is documented elsewhere in
`_input/ht1080z/`): the HT-1080Z (Híradástechnika Szövetkezet, 1983–86) is an EACA Video Genie I /
System 80 — itself a TRS-80 Model I Level II clone — with an **AY-3-8910 at ports 1Eh (data) / 1Fh
(register select)**, a different character generator (Series II: Hungarian accented characters and a
modified extension ROM at 3000h), System-80 style I/O (printer at port FDh, cassette select FEh,
no software 32/64-column switch: Video Cut and Page are hardware buttons) and PAL timing
([MAME `trs80.cpp`](https://github.com/mamedev/mame/blob/master/src/mame/trs/trs80.cpp);
[classic-computers.org.nz](https://classic-computers.org.nz/system-80/other_guises_HT-1080Z.htm);
[ht.homeserver.hu emulator page](https://ht.homeserver.hu/html/emulatorht1080z.html)).

---

## 1. Comparison table

| Emulator | Lang | Licence (verified how) | Activity | HT-1080Z specifically | Accuracy highlights | Port value for Klive |
|---|---|---|---|---|---|---|
| **MAME** `trs/trs80.cpp` (+`trs80_m.cpp`, `trs80_v.cpp`, `trs80.h`) | C++ | **BSD-3-Clause** per-file header (`// license:BSD-3-Clause`, Juergen Buchmueller, Robbbert); repo-level `NOASSERTION` because MAME is mixed | Very active (repo pushed 2026-10-21; `trs80.cpp` touched 2026-07-29) | **Yes**: `ht1080z` (Series I), `ht1080z2` (Series II), `ht108064` (/64); AY8910 on 1Eh/1Fh; HT char layout 128 × 16-byte glyphs; System-80 port map; 50 Hz screen. All flagged `MACHINE_NOT_WORKING`; AY clock "guess" | Instruction-level Z80 with cycle counts; frame-based video (not raster); cassette **as a waveform** sampled at 11025 Hz with edge detection; real FD1771 device (`wd_fdc`); 40 Hz RTC interrupt from the level2 config | **High as facts + BSD logic** (memory/IO map, ROM set CRC/SHA1, HT video decode). Code is MAME-framework-bound; port ideas, not files |
| **MiST `ht1080z`** core (Jozsef Laszlo) | VHDL | **Mixed**. `ht1080z.vhd`, `videoctrl.vhd`, `ps2kbd.vhd`: **BSD-3-style** header ("Copyright (c) 2016-2017 Jozsef Laszlo … Redistribution and use in source and synthezised forms …"); `YM2149.vhd`: BSD-style (MikeJ 2005); `HT1080Z_MiST.sv`: **GPL-2+** (Szombathelyi 2024). No repo LICENSE (`spdx_id` null) | Active (2025-03-07: RS-232, turbo, SiDi128) | **Yes — the only open-source HT-specific design.** AY at 1Eh/1Fh, HT char-gen embedded (4 KB, 256 × 16), video cut/page as keys, 16/48 KB, cassette tape-out sound | Hardware-level video counters (10.5 MHz pixel clock, 672 px × 312 lines PAL, 6×12 cells); **no interrupts** (`INT_n => '1'`); cassette **not** emulated as a signal — ROM is patched to read CAS bytes from port 04h (a trap) | **Facts + BSD-3 logic for the HT video and decode.** Not software; must be re-expressed in C |
| **MiSTer `TRS-80_MiSTer`** ("port of HT1080Z to MiSTer") | VHDL/SV | **Mixed**. `rtl/trs80.vhd`, `videoctrl.vhd`: BSD-3 (Laszlo); `fdc1771/*.sv`: **GPL-3+** (Till Harbaum); `keyboard.sv`, `cmd_loader.sv`, `z80_regset.sv`: BSD-style **with "non-commercial use only"** clause; `ddram.sv`, `dpram.v`, `micro_rs232.vhd`: GPL. No repo LICENSE | Active (2025-12-10) | Descends from the HT core but targets a **Model I** with expansion interface (FDC 1771, 25 ms RTC IRQ, quad drives, JV1 only); AY kept on 1Eh/1Fh | FDC JV1 only, no Write Track; fast-cassette ROM patch | Facts only for the FDC (GPL); BSD video already in the MiST core |
| **lkesteloot/trs80** (`trs80-emulator`, `z80-emulator`, `trs80-base`) | **TypeScript** | **MIT** (`spdx_id` MIT; root + every package `LICENSE` MIT; `package.json` `"license": "MIT"`). **Caveat:** ROM images are embedded in `Model*Rom.ts`; Fuse test vectors (GPL) in `z80-test` | **Very active** (pushed 2026-10-20; Model I fixes 2026-10-12/13) | **No HT/System-80 support.** Model I / III / 4 only | Z80 passes all 1356 Fuse tests, generated decoder, MEMPTR; instruction-step (not per-cycle); **cassette read as a sampled waveform** (threshold + flip-flop, 1 s motor delay); WD1771/1791 FDC with JV1/JV3/DMK; 40 Hz Model I timer; video = write-through character cells, no raster timing; 1-bit cassette audio, Orchestra-85/90 DAC | **Best port source** (licence, language, tests, activity). Copied to `lkesteloot-trs80/` |
| lkesteloot/trs80-emulator | TypeScript | MIT (`spdx_id`) | **Archived**, last push 2024-01-05 | No | Older snapshot of the above | None — superseded by the monorepo |
| **xtrs** (Tim Mann; `TimothyPMann/xtrs`) | C | **Permissive**: LICENSE = Clarendon Hill notice ("use, copy, or redistribute … provided this copyright notice is retained") + **MIT** text (Tim Mann 1996–2020). `spdx_id` NOASSERTION because of the two-part text | Low (last commit 2025-08-19) | No | Model I/III/4/4P; mature FDC (`trs_disk.c`, the reference lkesteloot cites for 1771 vs 1791), cassette, hard disk | Permissive and portable C, but X11-bound and no HT; a second opinion for FDC/cassette |
| **SDLTRS / SDL2TRS** (Mark Grebe, Jens Günther; [codeberg JenGun/SDLTRS](https://codeberg.org/JenGun/SDLTRS)) | C | **BSD-2-Clause** (LICENSE) **+ xtrs licence** (`xtrs.LICENSE`; per-file xtrs headers kept) | **Very active** (2026-10-18) | Partial: **HT-1080Z character set** (CG 11, `trs_chars.c`, "Source: ht.homeserver.hu/bin/rom/ht_s2_chargen.rom") and EACA/System-80 clone modes; **no AY-3-8910** | xtrs core + many EACA/Genie/TCS clones, System-80 printer/cassette addressing | Permissive C — the best **C** reference for System-80 port quirks; HT sound absent. Char data is a ROM dump (not "code") |
| **trs80gp** (George & Peter Phillips; [48k.ca](http://48k.ca/trs80gp.html)) | C++ (closed) | **Closed source, freeware**; manual: "The source code is fully organic and hand-crafted by myself and my brother Peter"; no licence stated | Active (v2.5.8) | **No** HT/System-80/AY support documented. But `-m1` with `-rom file`, `-rom1 file` (map at 3000h, Model I only), `-charrom file`, `-50` (50 Hz) | Claims "Cycle perfect sub-instruction Z-80 and video timing"; scripted input (`-i`, `-iw`, `-icmd`), `-batch` | **Accuracy oracle** for the Model I subset (not for AY or System-80 ports) |
| Hungarian **HT1080Z** emulator (Attila Grósz, 2004–2017, v1.7.0) | Win32 (closed) | No licence stated; binary zips on [ht.homeserver.hu](https://ht.homeserver.hu/html/emulatorht1080z.html) *(no source seen)* | Dormant (2017) | **Yes**: all HT series, VG-1/System-80, 16/64 KB, NMI, Video Cut/Page, 3-channel YM2149 with noise+envelope, CAS r/w, WAV out, Lowe LE18 board, monitor. Missing: AY I/O ports, DMK | "Full and cycle exact Z80" (claim) | Behavioural reference for HT specifics only |
| **Real-80 / Real-80 PRO** (Zoltán Kollár) | DOS / Win32 (closed) | None stated; binaries + docs on ht.homeserver.hu | Dormant | **Yes** (VG-I/HT1080Z, "full HT keyboard", CUT F5/PAGE F6, 8" disk, hires/colour boards) | 1.774 MHz, undocumented flags, precise cycle times (claims) | Behavioural reference; its docs are a fact source |
| **FastZ80** (Lajos Kintli, 2007–08) | Win32 (closed; MSVC + MASM) | None stated | Dormant | Yes (64×16, cut/page, AY, CAS, CMD/HEX, ROM ext /12288, monitor /12710) | Z80 checked on real hardware with his own tests (claim) | None beyond facts |
| Matthew Reed TRS32 / Model III emulators | Win32 (closed, shareware) | Commercial | Not maintained | No | Highly regarded historically | None |
| TRuSt-80 (`trust-80` crate) | Rust | MIT (crates.io metadata; GitHub repo `nicolasbauw/TRS-80` now 404) | 2026-07 (crate v1.2.0) | No | Model I L1/L2, CAS, keyboard; small | Low |
| Clock Signal (TomHarte/CLK) | C++ | MIT (`spdx_id`) | Very active | **No TRS-80** (`Machines/Tandy/` holds only CoCo). Has MIT `Components/AY38910` and `Components/1770` (personalities 1770/1772/1773/1793 — **no 1771**) | — | Klive already has its own AY (ZX 128) and FDC (+3); CLK's WD177x is an MIT reference if a 1771 personality is added |
| Others | JS/Java/Python | `cschweda/trs80-emulator` (Model III, NOASSERTION), `cannikin/trs80.io` (no licence), `DaveCTurner/trs80-emulator` (Java, none), `thing-a-verse/trs-80` (Python, MIT, Copilot-built) | — | No | — | None |
| FPGA forks of the MiST core | VHDL | `Dalekamistoso/HT1080Z_SiDi`, `retrocrypta/TRS80-HT1080Z-poseidon`: no repo licence; inherit Laszlo's BSD headers *(inference)* | 2023–24 | Yes (same core) | Same as MiST | None beyond MiST |
| libretro / ZEsarUX | — | — | — | No dedicated TRS-80 libretro core found; ZEsarUX has no TRS-80 *(inference from searches)*. MAME's libretro build covers it | — | None |

---

## 2. MAME — `src/mame/trs/` (BSD-3-Clause, facts and small logic)

Files (all `// license:BSD-3-Clause`, `copyright-holders:Juergen Buchmueller, Robbbert`):

| File | Lines | What it holds |
|---|---:|---|
| [`trs80.cpp`](https://github.com/mamedev/mame/blob/master/src/mame/trs/trs80.cpp) | 688 | The memory map comment block (0000–37FF ROM, 37DE/37DF UART, 37E0 IRQ latch, 37E1–37E7 drive/cassette select, 37E8 printer, 37EC–37EF FD1771, 3800 keyboard, 3C00 video, 4000 RAM), port FF/FE/FD/F8/F9 semantics, address maps (`m1_mem`, `sys80_io`, **`ht1080z_io`** = `sys80_io` + `0x1E` AY data r/w + `0x1F` AY address w), machine configs, ROM sets with CRC/SHA1, notes on the HT ("identical to the System 80, apart from the character rom"; Series II "modified extension rom and character generator"; `SYSTEM` + `/12288` activates the extensions) |
| [`trs80_m.cpp`](https://github.com/mamedev/mame/blob/master/src/mame/trs/trs80_m.cpp) | 351 | Cassette sampler (`cassette_data_callback`: 11025 Hz timer, latch bit 7 when the input crosses −0.2 downward), `port_ff_r/w` (bits 0–1 cassette out levels, bit 2 motor, bit 3 32/64 cpl, bit 7 cassette in), `sys80_fe_w` (bit 4 tape unit), RTC IRQ, FDC IRQ, keyboard decode (address bits select rows, ORed) |
| [`trs80_v.cpp`](https://github.com/mamedev/mame/blob/master/src/mame/trs/trs80_v.cpp) | 215 | Screen updates: `screen_update_trs80` (software 32/64), `screen_update_sys80` (Video Cut/Page from config switches), **`screen_update_ht1080z`** (16-byte glyph rows, 12 lines per cell, block graphics for codes ≥ 80h, 7-bit vs 8-bit video, a `ht108064` fix) |
| [`trs80.h`](https://github.com/mamedev/mame/blob/master/src/mame/trs/trs80.h) | 129 | State class |

HT-specific configuration (`trs80_state::ht1080z`): `sys80p` (CPU 10.48 MHz / 6 ≈ **1.747 MHz**,
screen 672 × 312 at 10.48 MHz pixel clock, 384 × 192 visible) + `ht1080z_io` + HT gfx layout +
`AY8910(config, "ay1", 1'500'000)` with the comment "guess of clock"; AY ports A/B unconnected
("some kind of expansion slot"). Inherited from `level2`: FD1771, 4 floppy connectors, quickload, UART,
Centronics, and **a 40 Hz periodic interrupt** — which a stock HT without an expansion box would not
have (see §8).

ROM sets (names, sizes, hashes — useful for Klive's ROM-identification table; **ROMs are not bundled**
in MAME, the user supplies them):

| Set | 0000–0FFF | 1000–1FFF | 2000–2FFF | 3000–37FF (ext) | Char-gen (2 KB) |
|---|---|---|---|---|---|
| `ht1080z` | `3001.z10` crc 8f5214de | `3002.z11` 46e88fbf | `3003.z12` 306e5d66 | `sys80.z13` 2a851e33 (= System 80 "blue label") | `ht1080z.z25` e8c59d4f |
| `ht1080z2` | same | same | same | `ht1080z2.z13` 07415ac6 | `ht1080z2.z25` 6728f0ab |
| `ht108064` | `3001_64.z10` 59ec132e | `3002_64.z11` a7a73e8c | `3003.z12` 306e5d66 | `ht108064.z13` fc12bd28 | `ht108064.z25` e76b73a4 |

Accuracy: video is drawn per frame from VRAM (no raster effects), the Z80 is MAME's (instruction
accurate, cycle counts, no per-T-state bus), cassette is genuinely signal-level, FDC is MAME's
`wd_fdc` FD1771 model. All HT sets are `MACHINE_NOT_WORKING`, so MAME is a fact source rather than an
oracle for the HT. Tests: none for this driver; MAME's software list `trs80_cass` has entries filtered
`H` for the HT *(inference: the filter value `"H"` in `SOFTWARE_LIST(...).set_filter("H")`)*.

**For Klive:** BSD-3 permits porting individual functions (e.g. the HT glyph-row/descender logic or
the cassette edge latch) with the notice. Practically the value is the map, the ROM table and the
clocks.

---

## 3. MiST `ht1080z` (Jozsef Laszlo) — the only open HT-specific design

Repo: <https://github.com/mist-devel/ht1080z> (created 2020-05-29; last commit `ba57e3cada`
2025-03-07). Author page: <http://joco.homeserver.hu/fpga/mist_ht1080z_en.html>.

| File | Licence (header) | What it does |
|---|---|---|
| `ht1080z.vhd` (434 lines) | BSD-3-style, Laszlo 2016–17 | Top level: T80 CPU at 42 MHz / 24 = **1.75 MHz** (turbo doubles); decode — ROM `< 3780h` (from SDRAM), RAM `A15:14 ≠ 00`, VRAM `3C00–3FFF`, keyboard `3800–3BFF`; port FDh read returns 30h (printer ready); **AY (YM2149) BDIR when `A7..1 = 0001111b`, BC1 = A0** → OUT 1Fh = register, OUT 1Eh = data; OUT FFh bits 0–2 → `tapebits` → speaker level (cassette-out audio); CAS loading via OUT 04/05/06h (24-bit pointer) + IN 04h (auto-increment) from SDRAM above 64 KB — the **ROM-patch trap**; `INT_n`/`NMI_n` tied high (no interrupts); video byte written as `din or 40h` when `< 20h` (bit-6 emulation for the 7-bit VRAM) |
| `videoctrl.vhd` (654) | BSD-3-style | 1 KB VRAM + **4 KB char ROM embedded** (256 chars × 16 rows; codes 80h–FFh are 2×3 block graphics, first 128 are the HT font — this table is a ROM dump, not code); counters: 10.5 MHz pixel clock, **672 clocks/line, 312 lines (PAL), 262 at 60 Hz**, 384 × 192 active, 6 × 12 cells, H: 42 sync / 84 porch / 81 border / 384 / 81 border; Video Cut halves the pixel clock (32 columns) and Page selects the second half (`vaHoriz <= (page and vcut) & "00000"`); **extra non-original colour registers** OUT 00h/01h/02h = ink/paper/border (the author's addition, "Extra registers") |
| `ps2kbd.vhd` (312) | BSD-3-style | PS/2 → 8 × 8 matrix; F9 = Video Cut, F10 = Page, F11 = reset; F1–F3 cycle the colour extras; **row 3 bits 4/5 = HT "F2"/"F3"-labelled keys** (*inference: the HT/Video Genie function keys sit in the unused Model I row-3 bits*) |
| `YM2149.vhd` (717) | BSD-style (MikeJ 2005) | AY/YM model |
| `HT1080Z_MiST.sv` (499) | **GPL-2+** (Szombathelyi 2024) | MiST board glue — read-only |
| `T80/`, `mist-modules/` | submodules | CPU, board framework |

Facts it contributes that MAME lacks: the PAL raster geometry, that the base HT has **no interrupt
source** ("Since the HT does not detect vertical retrace and does not use interrupts", author page),
the speaker mix of cassette-out bits, and a working AY wiring. Its cassette is a trap (ROM patched),
so it is no reference for tape signal timing.

**For Klive:** BSD-3 logic is portable with the notice; it is the best reference for the HT video
timing and the AY decode. The embedded char-gen and the patched ROM must not be copied (ROM data).

### MiSTer `TRS-80_MiSTer` (fork, Model I flavour)

<https://github.com/MiSTer-devel/TRS-80_MiSTer> (last release 2025-12-09). Keeps the Laszlo BSD files
(`rtl/trs80.vhd` 1634 lines, `rtl/videoctrl.vhd`) and adds an expansion interface: 25 ms RTC IRQ
(`clk_25ms`), FD1771 from Till Harbaum's **GPL-3** `fdc1771.sv`, JV1 only (no Write Track), CMD/BAS
loader (`cmd_loader.sv`, BSD **non-commercial**), MIDI/80, save states. ROM: user-supplied `BOOT.ROM`
(12 or 14 KB). Useful as facts for the Model I expansion-box decode; not portable beyond the BSD
files already in the MiST core.

---

## 4. lkesteloot/trs80 — best permissive candidate (MIT, TypeScript)

<https://github.com/lkesteloot/trs80>, monorepo, 73 stars, created 2021-03-28, pinned at
`11ed9327533567b90d1fdb43986e1bdfd6800908` (2026-10-19). Recent commits (Oct 2026) are Model I
correctness work ("Fire the timer interrupt on the Model I", "Video RAM reads back with bit 6
computed", "Time the cassette start delay in t-states"); the repo carries an `AUDIT.md` listing open
correctness gaps (e.g. Model I double-density adapters not emulated, blank DMK cannot be mounted).
Several recent branches are named `claude/...` *(AI-assisted maintenance — worth knowing when judging
code)*.

### Architecture

- **Z80 core** (`packages/z80-emulator`): `Z80.step()` executes one whole instruction through the
  generated `Decode.ts` (8982 lines, produced by `opcodes/GenerateOpcodes.ts` from `z80-inst`'s
  tables) and adds its T-states to `hal.tStateCount`. Undocumented opcodes and flags, MEMPTR; the
  comment in the generator notes trs80gp and Fuse as references for undocumented X/Y behaviour.
  Interrupts: `maskableInterrupt()` (IM 0/1/2, HALT exit, IFF), `nonMaskableInterrupt()`. Validated by
  the 1356 Fuse tests (`z80-test`, vectors from Fuse = GPL). **Not** a per-T-state/bus-cycle core —
  Klive's own Z80 is already better suited to its WASM cores, so this is not what Klive would port.
- **Machine** (`packages/trs80-emulator/src/Trs80.ts`, 1831 lines) implements `Hal`:
  - `readMemory`: printer status at 37E8h, ROM below `romSize`, RAM ≥ 4000h, VRAM 3C00–3FFF,
    keyboard 3800–3BFF via `Keyboard.readKeyboard(address, tStateCount)`; Model I 37E0–37E3 =
    interrupt latch (reading acknowledges the timer), 37EC–37EF = FDC.
  - `writeMemory`: 37E0–37E3 drive select, 37E4–37E7 cassette select (ignored), 37EC–37EF FDC; VRAM
    writes go through `writeToScreenMemory`, which **computes bit 6 as NOR(bit 5, bit 7)** for the
    stock 7-bit character generator (`CGChip.ORIGINAL`) — the same trick the MiST core does in hardware.
  - Ports: Model I decodes only **FFh** (read: bits 0–5 = 1, bit 6 = not-expanded, bit 7 = cassette
    flip-flop; write: bit 2 motor, bit 3 32-column mode, bits 0–1 cassette out), plus Orchestra-85/90
    DAC ports; Model III/4 ports E0–FF.
  - `step()`: CPU step → Model I HALT pulls the reset NMI → NMI latch → IRQ latch (Model I: timer
    80h | FDC 40h drive INT directly) → **40 Hz timer** at `clockHz/40` (Model I clock **1,774,080 Hz**)
    → `updateCassette()` → `EventScheduler.dispatch(tStateCount)`.
- **Video**: `Trs80Screen` is an abstract sink (`writeChar(address, value)`, expanded/alternate
  flags); rendering (canvas glyph blitting, phosphor colours) lives in `trs80-emulator-web`. No
  raster/beam model: the picture is the VRAM contents.
- **Cassette**: reading is **signal-level** — a `CassettePlayer` supplies audio samples (44.1 kHz
  default); the machine converts elapsed T-states to samples, applies a threshold (5000/32768),
  tracks positive/negative/neutral, sets the flip-flop on edges, the CPU reads it at FFh bit 7 and
  clears it by writing FFh; motor-on waits 1 s (in T-states) before starting. Writing tapes is not
  supported (`CassetteState` has no WRITE); cassette-out bits feed the speaker as audio levels
  `[0, 1, -1, -1]`. `trs80-base/Cassette.ts` parses `.CAS`; `trs80-cassette/LowSpeedTapeEncoder.ts`
  renders 500-baud audio from bytes.
- **Disk**: `FloppyDiskController.ts` (1728 lines) emulates WD1771 and WD1791 (type I–IV commands,
  INTRQ/DRQ scheduled in T-states, 2 s motor-on after select, Write Track with F5/F6/F7 handling) over
  `FloppyDisk` with JV1, JV3 and DMK readers/writers (`trs80-base`). References cited in the file:
  WD1793 docs and xtrs `trs_disk.c`.
- **Sound**: 1-bit cassette-port audio and Orchestra DAC through `SoundPlayer.setAudioValue(l, r,
  tStateCount, clockHz)`. No PSG.
- **Keyboard**: 8 × 8 matrix, address bits select rows and reads OR the selected rows; shift forcing
  for symbolic typing; time-stamped key queue for paste.
- **Tests**: Vitest specs — `Trs80.spec.ts` (399 lines), `FloppyDiskController.spec.ts` (768),
  `Keyboard.spec.ts` (90), `Screenshot.spec.ts`; Fuse CPU suite; a floppy regression suite
  mentioned in `AUDIT.md`.
- **ROMs**: Tandy Level I/II and Model III/4 ROMs are **embedded in the source** (`Model*Rom.ts`).
  They are not MIT-licensable and were not copied.

### HT-1080Z delta it would need

1. **Port map → System 80**: printer at port FDh (read status / write data) instead of 37E8h;
   FEh bit 4 tape unit; F8h/F9h UART; no software 32-column bit (FFh bit 3) — Video Cut / Page are
   front-panel switches; FFh bit 6 behaviour per System 80.
2. **AY-3-8910 at 1Eh (data, read/write) / 1Fh (register)**, clock unknown (MAME guesses 1.5 MHz) —
   Klive already has a PSG from its ZX Spectrum 128 core.
3. **HT character generator**: 2 KB ROM, 16 bytes per glyph, 12 visible rows (MAME layout), Series II
   with Hungarian characters; 64 × 16 with 6 × 12 cells.
4. **ROMs**: 12 KB BASIC (`3001/3002/3003`) + 2 KB extension at 3000–37FF (`sys80.z13` /
   `ht1080z2.z13` / `ht108064.z13`); Model I code assumes 37xxh is the expansion box, which overlaps
   the extension ROM (MAME's `m1_mem`, which the HT inherits, always overlays the 37DE–37EF
   registers on the ROM region; `fdc_r` returns FFh for the status register unless the disk option
   is enabled in the machine configuration).
5. **Clock and timing**: PAL 50 Hz, 312 lines × 672 pixel clocks, CPU ≈ 1.75 MHz (sources disagree,
   §8); a raster-level video model if Klive wants beam-accurate effects (none of the permissive
   sources has one for this machine).
6. **No interrupts** on a base HT (no expansion interface) — the 40 Hz timer must be optional.
7. **HT/Video Genie keyboard** extras (function keys in row 3 bits 4/5, *inference*), Hungarian keys
   on Series II.
8. **Cassette**: keep signal-level reading; add writing (WAV/CAS out), which the MIT source lacks.
9. **16 / 48 / 64 KB** variants (HT-1080Z/64).

### What Klive would take

The machine-level decode and device logic (Trs80.ts I/O, cassette edge model, keyboard matrix,
WD1771 + JV1/JV3/DMK, CAS/CMD/SYSTEM parsers) as a reference for a C/WASM HT core; not its Z80.
Ported files keep the MIT notice (Klive's `THIRD_PARTY_NOTICES.md`).

---

## 5. xtrs and SDLTRS (permissive C)

- **xtrs** — <https://github.com/TimothyPMann/xtrs>. Licence verified from `LICENSE`: Clarendon Hill
  Software 1992 notice + MIT (Tim Mann 1996–2020); the same two blocks head the C files (e.g.
  `trs_io.c`). Key files: `z80.c` (CPU), `trs_memory.c`, `trs_io.c`, `trs_interrupt.c` (timer,
  latches), `trs_cassette.c`, `trs_disk.c` (1771/1791/1793, JV1/JV3/DMK), `trs_keyboard.c`,
  `trs_chars.c` (fonts). No System-80/HT. X11/GTK front-end. Last commit 2025-08-19.
- **SDLTRS / SDL2TRS** — <https://codeberg.org/JenGun/SDLTRS> (updated 2026-10-18). `LICENSE` =
  BSD-2-Clause (Mark Grebe 2006–11, Jens Günther 2018–26), plus `xtrs.LICENSE`; xtrs per-file headers
  retained. Adds many EACA clones (Genie I/II/III/IIIs, System-80 printer and cassette addressing via
  `trs_clones.c`), HT-1080Z **character set** (CG 11 in `trs_chars.c`, taken from
  `ht.homeserver.hu/bin/rom/ht_s2_chargen.rom`), but **no AY-3-8910** (ports 1Eh/1Fh are only used
  for LNW80 banking / selector in `trs_io.c`). State save, debugger, ROM address patching.
- **For Klive:** both are portable with notices (C, close to Klive's WASM style). SDLTRS is the best
  open C reference for **System-80 I/O quirks**; xtrs/SDLTRS `trs_disk.c` is the reference the MIT
  TypeScript FDC itself follows. Neither has HT sound.

---

## 6. trs80gp (closed, the accuracy oracle candidate)

<http://48k.ca/trs80gp.html>, v2.5.8. Closed source, freeware ("fully organic and hand-crafted by
myself and my brother Peter"). Claims "Cycle perfect sub-instruction Z-80 and video timing" (with
caveats for Model 2 and some Model 3/4 effects). Supports Model I, Japanese Model I, II, III, 4, 4P,
4D, 12, 16, 6000, Tandy 10, MC-10, CoCo … **No EACA/System-80/HT-1080Z model and no AY** are
documented. Useful options for oracle runs: `-m1`, `-rom file`, `-rom1 file` (map at 3000h, Model I
only), `-charrom file`, `-50` (50 Hz), `-i` / `-iw str` / `-icmd` (scripted input), `-batch`
(Record menu saves without prompting), `-ee` (emulator extensions). ROMs are built in.

So trs80gp can run **HT ROMs on a Model I** at 50 Hz with the HT char-gen — a good oracle for CPU,
keyboard, video-memory behaviour and the cassette signal path, but not for the AY, the FDh printer
port or the absence of interrupts.

---

## 7. Hungarian HT-1080Z emulators (closed, behavioural references)

All hosted on <https://ht.homeserver.hu> (Hungarian HT site; it also distributes HT ROM images,
e.g. `bin/rom/ht_s2_chargen.rom`, and Hungarian software):

- **HT1080Z** by Attila Grósz (© 2004–2017, v1.7.0 down to a preview `htemu.zip`): all HT series and
  VG-1/System-80, 16/64 KB, NMI (RESET button), Video Cut and Page, 3-channel YM2149 incl. noise and
  envelope, TRS-80-compatible cassette-out sound, full keyboard (positional and symbolic mappings),
  CMD direct load, CAS read/write, WAV for tape output, simple printer (`printer.txt`), Lowe LE18
  graphics board, built-in monitor/disassembler; command line `/m 1|2|3` model, `/r 16|48` RAM.
  Known gaps on its page: AY I/O ports and DMK not emulated. The author states MESS failed in the
  RESET routine with the right ROMs at the time.
- **Real-80 / Real-80 PRO** by Zoltán Kollár (v2.5.5): 1.774 MHz, undocumented flags, precise
  cycles, Z80 reset/NMI/INT keys, CUT F5 / PAGE F6, full HT keyboard, 8" SS SD floppy, debugger,
  hires/colour boards (incl. LE18). Kollár also supplied the hardware knowledge for the MiST core.
- **FastZ80** by Lajos Kintli (v1.02, 2007–08): fast Win32 simulator, AY emulated, cut/page with
  200 % magnifier, CAS/CMD/Intel-HEX, ROM extension (`SYSTEM` `/12288`), monitor (`/12710`), Z80
  validated against a real Z80 board with the author's own tests.

No source or licence is published for any of them *(inference from the download pages, which offer
only zips of Windows/DOS executables and docs)*. They are the only emulators that model the whole HT
(AY + System-80 I/O + HT ROMs), so they are the practical **HT-specific behavioural cross-check**
(run by hand), not port inputs.

---

## 8. ROMs, char-gens and test suites

**ROM handling**

| Emulator | ROMs |
|---|---|
| MAME | User-supplied, identified by CRC/SHA1 (table in §2) |
| MiST / MiSTer | User-supplied (`HT1080Z.ROM` from the author's site; MiSTer `BOOT.ROM`), char-gen embedded in VHDL |
| lkesteloot/trs80 | **Tandy ROMs embedded** in the TypeScript source (`Model*Rom.ts`) |
| trs80gp | Built in |
| xtrs / SDLTRS | User-supplied; xtrs ships free replacement ROM sources (`fakerom.z80`, `xtrsrom4p.z80`); SDLTRS ships char-gen tables incl. HT |
| Hungarian emulators | Bundled with the emulator *(inference)*; ht.homeserver.hu distributes the ROM files |

The HT BASIC ROM is Microsoft Level II BASIC via EACA; redistribution status is unclear — Klive should
expect user-supplied ROMs (or follow whatever policy it uses for other machines).

**Test suites**

- lkesteloot/trs80: Vitest unit specs for the machine, FDC, keyboard and screenshots; Fuse Z80 suite
  (1356 tests; the vectors are GPL — Klive must take them from Fuse, as it presumably already does for
  its Z80, or use its own).
- MAME: no driver tests; software lists (`trs80_cass` / `trs80_quik` with filter `H`) as smoke tests.
- xtrs / SDLTRS: no automated tests seen *(inference: none in the file lists)*.
- MiST/MiSTer: none.
- trs80gp: its scripted input + `-batch` make it scriptable for golden comparisons.

---

## Main conclusions

1. **Recommended port source: `lkesteloot/trs80` (MIT, TypeScript)** — the only actively maintained,
   permissively licensed, tested emulator with clean device code for the Model I subset the HT shares
   (memory/I/O decode, keyboard matrix, signal-level cassette reading, WD1771 + JV1/JV3/DMK, CAS/CMD
   parsers). Copied at `11ed9327…` to `_input/ht1080z/lkesteloot-trs80/` (47 files, ROMs and Fuse
   vectors excluded; see its `README.md`). Klive keeps its own Z80.
2. **HT-specific logic: MiST `ht1080z` core (BSD-3 headers by Jozsef Laszlo)** for the AY decode
   (1Eh/1Fh), PAL raster geometry and Video Cut/Page; **MAME `trs80.cpp` (BSD-3)** for the System-80
   port map, ROM set hashes, char-gen layout and clocks; **SDLTRS (BSD-2 + xtrs)** for System-80 I/O
   quirks in C. All three permit porting with notices; the GPL parts of the MiST/MiSTer repos
   (`HT1080Z_MiST.sv`, `fdc1771.sv`, …) and the non-commercial MiSTer files are facts-only.
3. **Recommended accuracy oracle: trs80gp `-m1` with the HT ROMs (`-rom`, `-rom1`, `-charrom`,
   `-50`)** for CPU/video-memory/keyboard/cassette behaviour (it is the one claiming cycle-exact
   Model I timing and it is scriptable); **Grósz's HT1080Z emulator (and Real-80)** as the
   HT-specific cross-check for the AY and System-80 ports, run by hand. MAME is a fact source, not an
   oracle (its HT sets are `MACHINE_NOT_WORKING`).
4. Nothing open models the HT at T-state/raster level; Klive would be the first if it does.

## Open questions

- **CPU clock**: MAME 10.48 MHz / 6 ≈ 1.747 MHz (PAL System 80), Real-80 1.774 MHz (the NTSC Model I
  value), Laszlo's page 1.65 MHz while his core runs 1.75 MHz. Which crystal does the HT board carry?
- **AY clock** (MAME: "guess", 1.5 MHz) and whether AY ports A/B are wired to anything (MAME:
  "some kind of expansion slot"; Grósz: AY I/O not emulated).
- **Interrupts**: Laszlo states the HT uses none; MAME inherits a 40 Hz IRQ. Is INT simply unconnected
  on a base HT, and what does the HT expansion box (described as "homegrown" by
  classic-computers.org.nz) provide?
- **37DE–37EF over the 3000–37FF extension ROM**: how a disk-equipped HT decodes the expansion-box
  registers on top of the extension ROM.
- **Series I vs II vs /64 differences** beyond ROM and char-gen (the /64 has different BASIC ROMs —
  64 KB RAM banking? MAME uses `empty_init`, i.e. 8-bit video, for it).
- **Keyboard**: the meaning of the extra matrix bits (MiST maps "F2"/"F3" to row 3 bits 4/5) and the
  Hungarian key layout on Series II.
- **ROM redistribution**: ht.homeserver.hu and Laszlo publish HT ROM files; whether Klive may bundle
  any of them.
- Whether the Hungarian emulators' authors (Grósz, Kollár, Kintli) would share source or documentation
  under a permissive licence — the cheapest way to get HT-specific ground truth.
