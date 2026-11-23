# Commodore 8-bit machines — research pack for Klive

Background collected on 2026-11-23 before writing the plan to add the Commodore 64 (all models), the
VIC-20, the C16/C116/Plus/4 and the C128, with a cycle-accurate 1541 drive, as C/WASM cores. Nothing
here is a plan (the plan is `dev/plans/commodore/COMMODORE_PLAN.md`). These are the facts, the open
questions and what existing emulators can and cannot give us.

Every file cites its sources inline: URLs, and the emulator file and function. Anything the researcher
concluded rather than read is marked *inference*. Where sources disagree, both versions are kept.
**Nothing was downloaded or copied into this folder**: no datasheet, no ROM, no third-party source. Each
file ends with a "Reference documents" list of what is worth fetching (into `.local/`, with the project
author's permission). Licences were checked on 2026-11-23 against the repositories (GitHub API) and the
file headers.

The pack was written as if Klive's earlier TypeScript C64 (`src/emu/m6510Va/`, `src/emu/machines/c64/`)
did not exist; nothing in it relies on that code.

| File | Covers |
|---|---|
| [CPU_6502_FAMILY.md](CPU_6502_FAMILY.md) | 6502, 6510, 8500, 8502, 7501/8501: the processor ports and their fading bits, the cycle-by-cycle bus sequence of every addressing mode, interrupts (polling, hijacking, the branch quirk), RDY/AEC/SO, NMOS decimal mode, every undocumented opcode with the unstable ones, test suites and their licences, permissive implementations, how a debugger meets a 6502 |
| [C64_VIC_II.md](C64_VIC_II.md) | Every VIC-II model's geometry and clocks, the per-cycle access sequence, badlines, BA/AEC, display states, the border unit, sprites and collisions, interrupts and the light pen, demo tricks, palettes, the VIC's view of memory, test programs, implementations |
| [C64_SYSTEM.md](C64_SYSTEM.md) | The C64 models and board revisions, the PLA and every banking mode, CIA 6526/8521, keyboard/joysticks/paddles/mouse, cartridges and the CRT format, the Datasette and TAP, ROMs with hashes, **ROM rights**, program formats and autostart, clocks and reset |
| [SID.md](SID.md) | The 6581 and 8580: oscillators, waveforms, combined waveforms, noise, the ADSR and its bug, the analog filter and digis, POT and read-back, accuracy levels and cost, implementations and licences |
| [DRIVE_1541.md](DRIVE_1541.md) | The 1541 family's hardware, the VIA 6522 at cycle level, the disk surface and the bit-level read logic, the IEC bus and fast loaders, the 1570/1571/1581/1551, image formats (D64, G64, NIB, P64, D71, D81), drive ROMs, implementations, **interleaving two independently clocked CPUs**, performance |
| [VIC20.md](VIC20.md) | VIC-20 models, the 6560/6561 at cycle level (video and sound), the memory map and RAM expansions, the two VIAs, tape, ROMs, file formats, implementations |
| [TED_C16_PLUS4.md](TED_C16_PLUS4.md) | C16, C116, Plus/4: the TED 7360/8360 (the changing CPU clock, DMA, video, timers, sound), the three-layer banking, peripherals, ROMs, implementations |
| [C128.md](C128.md) | C128, C128D, C128DCR: clocks, the 8502 + Z80 design (the Z80 boots first), the MMU 8722, the VDC 8563/8568, the keyboard, C128-mode software, burst serial, implementations |
| [EXISTING_EMULATORS.md](EXISTING_EMULATORS.md) | VICE, Clock Signal, MAME, floooh/chips, VirtualC64, Denise, Hoxs64, YAPE, MiSTer and others with verified licences; accuracy benchmarks; test-suite licences; **ROM rights across all machines**; the developer-tools landscape (assemblers, VICE's monitor, debug formats) |

## The machines at a glance

| | C64 | VIC-20 | C16 / Plus/4 | C128 |
|---|---|---|---|---|
| CPU | 6510 (8500), φ2 985 248.6 Hz PAL / 1 022 727.3 Hz NTSC | 6502, 1 108 405 Hz PAL / 1 022 727 Hz NTSC | 7501/8501, 0.886/1.773 MHz PAL, switching inside a line | 8502 at 1 or 2 MHz **and** a Z80 (T-state = half a 1 MHz cycle) |
| Video | VIC-II, steals cycles via BA/RDY (badlines, sprites) | VIC 6560/6561, own half-cycle, never stalls the CPU | TED, halts the CPU for character DMA | VIC-IIe (40 columns) + VDC (80 columns, own 16 MHz clock) |
| Sound | SID 6581 / 8580 | in the VIC (3 voices + noise) | in the TED (2 voices) | SID |
| I/O | 2 × CIA | 2 × VIA | TED timers, 6529 latch, ACIA (Plus/4) | 2 × CIA, MMU |
| Drive | 1541 (1 MHz 6502 + 2 × VIA + GCR read logic) on IEC | 1540/1541 | 1541 (via the CPU port), 1551 parallel | 1571 (burst), 1541 |
| Detail | CPU, C64_VIC_II, C64_SYSTEM, SID | VIC20 | TED_C16_PLUS4 | C128 |

## Main conclusions

- **One CPU family, many CPUs per machine.** All the CPUs share the NMOS 6502's instruction set,
  undocumented opcodes included. They differ in the processor port (width, pull-ups, fading bits), SO,
  RDY use and the 8502's 2 MHz mode (CPU §1). A C64 with a 1541 runs two 6502s; a C128 with a 1571 runs
  three CPUs, one of them a Z80 (C128 §3).
- **Cycle-exact everything, with read/write known in advance.** The VIC-II and TED stall the CPU only
  on read cycles, three cycles after warning (CPU §4, VIC-II §2, TED §2). A cycle-stepped CPU that
  publishes each cycle's bus request fits all four machines and the drive. floooh's pin-mask design is
  the reference shape; it lacks SO, port fade, RDY-aware SHx and configurable ANE/LXA (CPU §8.2).
- **The 1541 needs a bit-level model.** A 16 MHz read process with the UE7/UF4 counters, the flux
  filter and the AGC noise, SYNC detection and BYTE READY on SO, exact to the cycle (1541 §3). The
  drive's crystal is independent of the host's, so the ratio is an exact rational, and the drive must
  never run ahead of the host on the IEC lines (1541 §9).
- **Port sources exist for most chips; the SID is the exception.**
  - Permissive: MAME (BSD-3 per file: CPU, CIA, VIC-II, VIC, TED, MMU, VDC, VIA, 1541 read logic,
    formats), Clock Signal (MIT: 6502, VIA, CIA, VIC, TED, 1540) and floooh/chips (zlib).
  - **No high-accuracy SID is permissively licensed** (reSID/reSIDfp GPL; MAME wraps reSIDfp). Klive's
    SID will be its own (SID §7).
  - Watch provenance inside permissive code: MAME's 1541 noise constants match VICE's (1541 §8), CLK's
    VIC-20 noise table is marked "Source: VICE" (VIC20 §8), the permissive palettes are VICE-derived
    (VIC20 §8, TED §6).
- **ROM rights are not settled and there is no grant to quote** (EXISTING §5, C64 §8). Amiga Corporation
  (Cloanto) is the owner of record of the CBM 8-bit ROMs and says they may be used only under licence.
  The 2025 Commodore brand purchase did not include them. VICE and floooh ship them without stated
  permission, while Debian, MAME and Clock Signal do not. MEGA65 Open ROMs (LGPL-3) cover the C64 only,
  with BASIC incomplete and no drive DOS. The four options are in EXISTING §5.7.
- **The rule on commented ROM disassemblies applies.** `dev/research/c64-rom.txt` and
  `dev/research/c64_rom_disassembly.txt` are fully commented KERNAL/BASIC disassemblies; under
  `dev/ai/rom-annotations/README.md` D4 they never feed ROM annotations. The emulator takes its ROM
  landmarks from running the ROM.
- **Oracles:** VICE (x64sc, xvic, xplus4, x128) for all machines, run and never read for design, and
  sidplayfp/reSIDfp for the SID. The VICE testprogs (no licence) are the de-facto acceptance suite and
  are fetched, never committed.

## Points the sources disagree on (a selection; each file lists all)

| Question | Positions | Where |
|---|---|---|
| ANE / LXA magic constants | $EF (VICE, real games) vs $EE (Harte's tests, floooh, CLK) vs $00/$FF (MAME) | CPU §6, §10 |
| SHA/SHX/SHY/TAS across a page | the value replaces the address high byte (Harte, VICE, MAME) vs not (floooh) | CPU §6.4 |
| 6510 port bit fade time | ~100s of µs to ~1.5 s | CPU §1.3, OQ |
| CIA 8521 timing; the timer B bug | old vs new timing; whether the bug exists on hardware | C64 §3, §11 |
| VIC-II sprite check cycles on NTSC, MCBASE/crunch, VCBASE reset | Bauer vs VICE tables | VIC-II §13 |
| Luma levels | Pepto's model vs 8565R2 voltage measurements | VIC-II §7, §13 |
| SID combined waveforms, noise output bits, exponential-counter break points | reSID vs reSIDfp vs SID-Article | SID §10 |
| 1541 highest track, write-protect polarity, ATN to CA1 or CB2 | per source | 1541 §11 |
| VIC-20 3K block visible to the VIC | yes (floooh) vs no (CLK, MAME, Tynemouth) | VIC20 §10 |
| TED refresh window | dots 304–344 (datasheet text) vs 288–328 (its table) vs 296–336 (emulators) | TED §8 |
| C128 Z80 speed; VDC version numbers | "4 MHz" vs half-cycle T-states; MAME returns 1 for both chips | C128 disagreements |

## Suggested next steps before the plan is accepted

- The project author decides the ROM position (plan decision D2) and, if a licence is wanted, writes to
  Amiga Corporation (Cloanto) covering every machine and drive in scope.
- Fetch, with permission, into `.local/commodore/` (never committed): Tom Harte's 65x02 SingleStepTests,
  Klaus Dormann's functional tests, the VICE testprogs, the datasheets the files list (6526, 6522, 6581,
  TED, VDC), the 1541 schematics. Lorenz's suite is public domain and may be committed.
- Decide whether VirtualC64's MPL-2.0 files may be read for design (EXISTING OQ11) and what Clock
  Signal's "All rights reserved" file headers mean against its MIT LICENCE (EXISTING OQ5).
