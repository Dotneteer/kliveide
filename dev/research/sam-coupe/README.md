# SAM Coupé — research pack for a Klive machine

Background collected on 2026-11-18 before writing a plan to add the SAM Coupé (MGT, 1989) to Klive.
Nothing here is a plan (the plan is `dev/plans/SAM_COUPE_PLAN.md`). These are the facts, the open
questions, and what the existing emulators can and cannot give us.

Every file cites its sources inline: URLs, and the emulator file and function. Anything the
researcher concluded rather than read is marked *inference*. Where sources disagree, both versions
are kept. **Nothing was downloaded or copied into this folder**: unlike the Enterprise pack there is
no `docs/` and no ported source yet. Each file ends with a "Reference documents" list of what is
worth fetching (with the project author's permission), and every licence was checked on 2026-11-18
against the repository (GitHub API) and the file headers.

| File | Covers |
|---|---|
| [ASIC_VIDEO_MEMORY_TIMING.md](ASIC_VIDEO_MEMORY_TIMING.md) | The ASIC: the 24 MHz clock tree, the 384 × 312 T frame, LMPR/HMPR/VMPR and external memory, the four screen modes, CLUT and the 128-colour palette, border and SOFF, the ATTR and pen ports, **memory and I/O contention**, the frame/line/MIDI interrupts and STATUS, the port map, reset values, the known ASIC quirks |
| [SOUND_INPUT_IO.md](SOUND_INPUT_IO.md) | The Philips SAA 1099 (ports, clock, tones, noise, envelopes, mixing, where MAME and SAASound disagree), the beeper and MIC, the keyboard matrix (9 rows, the extra bits on F9h), joysticks, the MGT mouse, tape hardware and the SAM ROM tape format, MIDI, printer, clocks, add-ons, a combined port map |
| [STORAGE_FIRMWARE_SOFTWARE.md](STORAGE_FIRMWARE_SOFTWARE.md) | Models and connectors, every ROM version with CRCs, **the ROM licensing position**, SAM BASIC (paging as the ROM uses it, the boot sequence, the jump table, system variables, the program format), the VL1772 disk system and the directory format, disk image formats, mass-storage add-ons (Atom Lite, B-DOS, Trinity), loading code without a disk, assemblers, test software |
| [EXISTING_EMULATORS.md](EXISTING_EMULATORS.md) | SimCoupé, SAASound, MAME, the MiST/MiSTer and ZX-Uno FPGA cores, ZEsarUX, web ports, tools (SAMdisk, mgtdisklib, pyz80), licences verified, and what Klive can port or only read |

## The machine at a glance

| Block | Summary | Detail |
|---|---|---|
| CPU | Z80B at 6 MHz (24 MHz / 4). IM 1; nothing drives the bus in an IM 2 acknowledge. | ASIC §1, §5.5 |
| Frame | 384 T × 312 lines = 119 808 T, 50.08 Hz. The screen is 192 lines × 256 T, fetched from `hc` 128–383 (8-T cells). | ASIC §1 |
| Memory | 32 internal 16K pages (512K; 256K machines have 0–15), a 32K ROM (ROM0 in section A, ROM1 in section D). LMPR (FAh) pages A/B and switches ROM0/ROM1/write-protect; HMPR (FBh) pages C/D and selects external memory; VMPR (FCh) selects the screen page and mode. 1 MB external packs on ports 80h/81h. | ASIC §2 |
| Video | Mode 1 (the Spectrum layout), mode 2 (linear, 8×1 attributes), mode 3 (512×192, 4 colours, pixel bits swapped against the CLUT), mode 4 (256×192, 16 colours). 16 CLUT entries from 128 colours (GRBbrgI). Border on FEh with SOFF (screen off, modes 3/4 only). | ASIC §3 |
| Contention | Internal RAM only (ROM and external RAM never): 1 access in 8 T in the screen area, 1 in 4 T elsewhere; mode 1 adds 64-T stripes; SOFF makes the whole frame "border"; ASIC ports F8h–FFh always 1 in 8. Measured by Simon Owen on real hardware. | ASIC §4 |
| Interrupts | Frame (line 244, 52 lines after the screen) and line (port F9h write, at the start of the right border before line N), MIDI in/out. STATUS (F9h read, active low) shows live ~128 T pulses, not latches. | ASIC §5 |
| Sound | Philips SAA 1099 at 8 MHz: 6 tone channels, 2 noise generators, 2 envelope generators, 4-bit stereo amplitudes. Register select at 1FFh, data at 0FFh; write-only. Plus a beeper bit on FEh. | SOUND §1–§2 |
| Keyboard, mouse | 9-row matrix: rows 0–7 bits 0–4 are the Spectrum's on FEh; bits 5–7 come from F9h; row 8 (CNTRL, cursors) when A8–A15 are all 1. Joysticks in Interface 2 order. The MGT mouse is 9 nibble reads at FFFEh. | SOUND §3–§4 |
| Tape | EAR on FEh bit 6, MIC on bit 3. The ROM's own format (SAM header flag 01h) and Spectrum-compatible speed; images are TZX/TAP/CSW/WAV. | SOUND §5 |
| Disk | One VL1772-02 (a WD1772) per drive: E0h–E7h and F0h–F7h, A0–A1 register, A2 side. 80 × 2 × 10 × 512 = 800K, the MGT +D-compatible directory. The ROM boots nothing by itself: F9 / `BOOT` loads track 4 sector 1 and jumps to 8009h if it carries "BOOT". The DOS (SAMDOS, MasterDOS, B-DOS) is on the disk. | STORAGE §3.2, §4 |
| Images | `.mgt` (and raw `.dsk`, often gzipped by pyz80), `.sad`, EDSK `.dsk`, `.sbt` (a self-booting file), `.sdf`, `.hdf` for hard disks. | STORAGE §4.4 |

## Main conclusions

- **No permissive full-machine port source exists.** SimCoupé (GPL-2.0+), MAME's `samcoupe` driver and
  its SAM bus devices (**GPL-2.0+**, unlike most of MAME), ZEsarUX (GPL-3+) and the MiST/MiSTer cores
  (GPL) are read for facts only. The ZX-Uno core has **no licence at all** and should not be read for
  design. Clock Signal has no SAM. The ASIC, contention, video and interrupts are Klive's own code.
- **Portable pieces:** SAASound (BSD-3, Dave Hooper and Simon Owen) for the SAA 1099, the model
  SimCoupé uses and checked against a real chip; MAME's `saa1099.cpp` (BSD-3) as a second view;
  SAMdisk (MIT) and mgtdisklib (MIT) for image formats and the file system; MAME's
  `coupe_{mgt,sad,sdf}.cpp` (BSD-3). The floppy controller is Klive's shared `wd1793.c`, which needs a
  **1772 variant** (step rates 6/12/2/3 ms) beside the Enterprise's 1770.
- **Oracle: SimCoupé 1.2.17** (2026-08-30), run, never read for design. It models per-access
  contention, the interrupt pulses, mid-line effects, the VL1772, Atom/Atom Lite, the mouse and tape.
  The MiSTer core is a second opinion.
- **Contention is measured, not guessed**: Simon Owen's articles (`simonowen.com/sam/timings`,
  `/articles/mode1`, `/blog/2007/08/04/attribute-port/`) give the rules and a per-instruction table
  checked on a real SAM; kosarev/z80 issue #10 (a logic-analyser trace) puts the wait sampling at T2
  of memory cycles and TW of I/O cycles. The pages carry no licence: record facts in Klive's words,
  do not copy the tables.
- **ROMs: settled on 2026-11-20.** Dr Andrew J. A. Wright, the ROM's author, wrote on 16 April 2008
  (to Hans de Goede, Fedora extras commits list): "I hereby allow all my SAM Coupé titles (including
  ROMs) and associated manuals to be freely (re)distributed." World of SAM reproduces it on its ROM page
  (https://www.worldofsam.org/products/rom), which also offers 3.0 ("plc" and "PLC"), the SAM Computers
  3.0 and 3.1. The original message
  (https://listman.redhat.com/archives/fedora-extras-commits/2008-April/msg07874.html) was not reachable
  from the research environment; read it before committing the readme. Klive can therefore bundle the
  ROMs. SimCoupé's bundled image is in fact **ROM 3.1** (CRC32 0b7e3585), which differs from 3.0
  (e535c25d) only in the version byte and "PLC" vs "plc". The grant also covers Wright's MasterDOS and
  MasterBASIC; **SAMDOS's author is unclear** (credited to Bruce Gordon, though MGT contracted Wright for
  "the ROM and DOS"); B-DOS is explicitly freeware. See STORAGE §2.3 and the plan's decision D3.
- **The ROM-annotation rule applies here too**: a published annotated ROM 3.0 disassembly exists
  (worldofsam). Under `dev/ai/rom-annotations/README.md` D4 it must never feed Klive's sidecars; facts
  the emulator needs from the ROM (the memory-size probe, the boot landmarks) come from running the ROM
  in Klive's core, as the Enterprise's LPT did.

## Points the sources disagree on (to settle with test programs)

| Question | Positions | Where |
|---|---|---|
| Mode-1 stripe phase | SimCoupé (matches Owen's measurement): 64-T stripes from `hc` −4; MIST: opposite phase; ZX-Uno: not alternating | ASIC §4.4, OQ2 |
| Where in an M-cycle the ASIC samples its 4/8-T grid | SimCoupé's `+2` offset and its Z80's call point; kosarev #10: T2 of memory, TW of I/O | ASIC §4.3, §4.7, OQ4 |
| I/O contention scope | Only F8h–FFh (Owen, SimCoupé, MIST) or every port (ZX-Uno) | ASIC §4.6, OQ14 |
| Interrupt pulse length | 120 T (manual, "about 20 µs"), 128 T (SimCoupé, ZX-Uno), 129 T (MIST) | ASIC §5.2, OQ5 |
| Mode-3 pixel/CLUT swap | Swapped 01/10 (SimCoupé, MIST, ZX-Uno) or straight (MAME, which also ignores HMPR 5–6) | ASIC §3.3 |
| ATTR port in the border | Last screen attribute (Owen measured, SimCoupé, ZX-Uno) or FFh (MIST, MAME) | ASIC §3.8, OQ15 |
| Paging register reset values | All zero (SimCoupé, FPGA cores, "VMPR zeroed") or LMPR 0Fh / HMPR 01h / VMPR 81h (MAME) | ASIC §2.8, OQ9 |
| Pages 16–31 on a 256K machine | FFh (MAME, SimCoupé by construction), floating bus, or a mirror | ASIC §2.6, OQ1 |
| HPEN/LPEN with the screen off | Frozen (Unofficial manual, SimCoupé) or HPEN = 192 (MIST, ZX-Uno) | ASIC §3.6, OQ6 |
| MIDI-OUT interrupt time | Soon after the write (SimCoupé) or at the end of the 320 µs byte (manual wording, MIST) | ASIC §5.4, OQ7 |
| SAA envelope scope | Channels 2 and 5 only (SAASound, MiSTer, Furnace) or all three of a group (MAME) | SOUND §1.5, OQ1–OQ2 |
| SAA buffering | Octave/offset changes at the half-cycle boundary, envelope writes at the end of the shape, PDM amplitude (SAASound) vs immediate (MAME) | SOUND §1.7 |
| Mouse timeout | 38 µs (SimCoupé) or 50 µs (MAME) | SOUND §4, OQ8 |
| FEh read bit 7 | SOFF status (manual, SimCoupé) vs always 1 (MAME) vs other readings | ASIC §6.2; SOUND OQ6 |
| Printer ports | E8h–EBh (SimCoupé) vs the manual's OCR "246 and 248" | STORAGE OQ11 |

Each file's own "Open questions" section has the full list.

## Suggested next steps before the plan is accepted

- Read the 2008 grant in the Red Hat archive and confirm the wording World of SAM reproduces; then add
  ROM 3.0 and 3.1 to `src/public/roms/` with a readme quoting it (the Enterprise's `ep-roms-readme.txt`
  pattern).
- Fetch, with permission, the reference documents the files list: the Technical Manual v3.0 PDF (or
  Stefan Drissen's Markdown transcription), the sam-users datasheet repository (SAA 1099, VL1772), the
  One Meg RAM pack manual, Owen's ATTR test program. **Not** the annotated ROM disassembly (above).
- If decision D1 accepts porting SAASound, copy its sources at a pinned commit into `saasound/` here
  with its `LICENCE` and a `COMMIT` file, as the Enterprise pack's `clk/` holds Clock Signal.
