# Commodore 64: the system around the chips

Research pack, Klive IDE `commodore-plan` branch. Compiled 2026-11-23.

Scope: everything about the C64 that is not the 6510 core, the VIC-II, the SID or the 1541 (other
files of this pack cover those): models, memory map and PLA, the two CIAs, keyboard and controllers,
cartridges and the REU, tape, ROMs and their rights, program formats and autostart, clocks and power.

This file records facts and where they come from. It recommends nothing. Statements marked
*inference* were concluded by the researcher, not read in a source. Where sources disagree, both are
kept and the case is listed in §11.

Provenance rules followed (Klive D4 and the brief): the commented ROM disassembly in
`dev/research/c64_rom_disassembly.txt` and published commented disassemblies were **not** read. ROM
addresses below come from the C64 Programmer's Reference Guide (`dev/research/c64prg.txt`, cited as
"PRG" with line numbers), from emulator sources read for facts (VICE, MAME), and from hardware
documentation. GPL sources (VICE) were read for facts only; nothing was copied.

Licences checked on 2026-11-23 (GitHub API `gh api repos/OWNER/REPO/license` or file headers):

| Project | Licence | How checked |
|---|---|---|
| VICE (`VICE-Team/svn-mirror`) | GPL-2.0-or-later (file headers, e.g. `vice/src/c64/c64model.c`; `vice/COPYING`) | API returns 404 for the licence (no root LICENSE file); headers read |
| MAME (`mamedev/mame`) | Mixed; API says NOASSERTION. `src/mame/commodore/c64.cpp` header: `license:BSD-3-Clause`, copyright Curt Coder | file header |
| MEGA65 Open ROMs (`MEGA65/open-roms`) | API: NOASSERTION. `LICENSE` file: LGPL-3.0-or-later (Paul Gardner-Stephen 2019, Roman Standzikowski 2019-2021); some BASIC files MIT (Copyright Microsoft) | LICENSE file read |
| floooh/chips | zlib | API |
| floooh/chips-test | MIT | API |
| libretro/vice-libretro | GPL-2.0 | API |
| microsoft/BASIC-M6502 | MIT | API |

---

## §1 Models

### §1.1 Breadbin C64 board revisions

Source for the table: C64-Wiki "Motherboard" (https://www.c64-wiki.com/wiki/Motherboard), with chip
lists cross-checked against MAME `src/mame/commodore/c64.cpp` machine configs.

| Board | Years | Notable parts | What changed |
|---|---|---|---|
| 326298 (rev 6, A, B, C) | 1982 | 6510, 6567/6569 VIC-II, 6581 SID, two 6526 CIA, 82S100 PLA (906114-01), eight 4164 DRAMs, 2114 colour RAM, 2364 BASIC/KERNAL, 2364 or 2332 char ROM | Discrete clock circuit (LM556, 74LS629, MC4044). Also used in the PET 64 / CBM 4064. 5-pin A/V on most |
| KU-14194HB (rev A, B) | 1982 | as 326298, 2332 char ROM | Short-lived European board, 8-pin A/V |
| 250407 (rev A, B, C) | 1983 | as above, 2114L-20 colour RAM | Same architecture; used in the 1987 "Golden Edition" |
| 250425 (rev A, B) | 1984 | clock generator IC 7701/8701 (U31) | Discrete clock replaced by one IC; rev B adds IEC-bus protection diodes |
| 250441-01 ("B-2") | – | – | Unconfirmed, probably never released |
| 250466 (rev A, "B-3") | 1986 | two 64Kx4 DRAMs, 6526 or 8521 CIA, 8701 clock | First C64C cases; C64-Wiki notes its own text and parts list disagree on whether 6569R5/6581R4AR or 6567/6581R3 were typical |
| 250469 (rev 1, 3, 4, A, B; "short board", PCB 252311) | 1987-1990s | 64-pin custom IC 251715-01 (rev 1-A) or 252535-01 (rev B) absorbing the PLA and TTL glue; combined 16 KB BASIC+KERNAL ROM (251913-01); 8500 CPU, 8562/8565 VIC-II, 8580 SID; two 41464 DRAMs | Single +5 V rail (the second regulator removed), 9 V SID supply from a transistor circuit; C64-Wiki says colour RAM moved into the custom IC on rev B (used in the C64GS). Suffix -09 NTSC, -10 PAL |

What an emulator must model differently per board (facts from VICE `vice/src/c64/c64model.c`, table
`c64models[]`, and `c64gluelogic.c`):

- **CIA generation.** VICE's "C64" models use `CIA_MODEL_6526` ("old"), its "C64C" models use
  `CIA_MODEL_6526A` ("new"). See §3.3 for the behavioural difference. (Which chip a 250466 had varied.)
- **SID generation.** Old = 6581, new = 8580 (the SID file of this pack covers the differences).
- **Glue logic.** VICE resource `GlueLogic`: discrete (breadbin) vs custom IC (250469). With the custom
  IC, VICE models that a write to $DD00 changing the VIC bank between two values whose XOR is 3 shows
  bank 3 for one cycle first, and that some DDR-driven bank changes take effect a cycle later
  (`c64_glue_set_vbank()`). VICE itself comments that the second case "is not quite accurate".
- **IEC reset.** VICE's table marks old boards `IEC_SOFT_RESET` and C64C/GS `IEC_HARD_RESET`; in
  `machine_specific_reset()` (`vice/src/c64/c64.c`) drives are reset on power-on, or on every machine
  reset when the `IECReset` resource is set.
- **Kernal revision.** VICE's "C64 OLD PAL" uses 901227-02, "C64 OLD NTSC" 901227-01, the others
  901227-03 (§7).
- **VIC-II revision and timing** (6567R56A 64-cycle NTSC, 6567R8 65-cycle NTSC, 6569 PAL, 8562/8565):
  covered by the VIC-II file. VICE `vice/src/c64/c64.h`: PAL 63 cycles x 312 lines, NTSC 65 x 263,
  "old NTSC" 64 x 262, PAL-N 65 x 312.

### §1.2 C64C, C64E, C64G, Aldi C64, C64C CR

- C64C (1986): new flat case, initially on 250466, later 250469 with 8500/8562 or 8565/8580
  (C64-Wiki "C64", https://www.c64-wiki.com/wiki/C64; MAME `c64c`/`c64cp` use MOS8562/8565 and
  MOS8521 CIAs, kernal+BASIC as one 16 KB ROM 251913-01).
- "C64E" is a name used for late C64C units on the 250469 board; the brief mentions it, but no
  separate machine is described in C64-Wiki's model list (*inference*: it is not a distinct
  emulation target).
- C64G (1988, PAL): breadbin-shaped light-grey case with the newer board (C64-Wiki). MAME's `c64g`
  shares the C64C (PAL) config.
- C64-Aldi (1987, Germany) and C64C CR (1988, clip case) are case/cost variants (C64-Wiki).
- Regional ROM variants in MAME: `c64c_es` (Spain, char ROM 325056-03 aka 325245-01), `c64c_se`
  (Sweden/Finland, 325182-01 combined ROM, Scandinavian char ROM), `c64_se` (breadbin Sweden,
  Swedish char ROMs). These change ROMs and keyboard layout only.

### §1.3 SX-64 (Executive 64), DX-64, VIP-64

C64-Wiki "SX-64" (https://www.c64-wiki.com/wiki/SX-64), MAME `sx64`/`sx64p`/`vip64`/`dx64`, VICE model
table, COMPUTE! issue 50 (https://www.atarimagazines.com/compute/issue50/286_1_Commodore_64_ROM_Generations.php):

- Built-in 1541-compatible half-height drive as device 8; **no datasette port**; no RF modulator;
  built-in 5" colour CRT; separate keyboard on a 25-pin connector.
- KERNAL 251104-04 (VICE ID byte at $FF80 = $43). Default device for LOAD/SAVE and SHIFT+RUN/STOP is
  8; cassette use gives ILLEGAL DEVICE NUMBER (COMPUTE!). Banner "SX-64 BASIC V2.0", 38911 bytes free.
- Power-on colours: white background, blue text, cyan border (C64-Wiki). COMPUTE! says clear screen
  fills colour RAM with the cursor colour from $0286.
- VICE models the SX-64 with `NO_DATASETTE` and `CIATICK_60HZ` (TOD driven at 60 Hz even on PAL),
  marked "FIXME: guessed" in the source.
- MAME's `sx64_state` adds a 6522 VIA (for the internal drive in the drive device). DX-64 (two drives)
  is a prototype with an undumped kernal (MAME `dx64`: `NO_DUMP`). VIP-64 is the Swedish/Finnish SX-64.

### §1.4 C64 Games System (C64GS)

C64-Wiki "C64GS", MAME `c64gs` (CONS driver, PAL), VICE model "C64 GS":

- No keyboard; joysticks and the cartridge port only (the cartridge is inserted on top). VICE marks
  `NO_DATASETTE`, `NO_IEC`, `NO_USERPORT`, `NO_KEYBOARD`, new CIA, new SID (all "FIXME: guessed").
- Board 250469 rev B with 252535-01 (MAME ROM region labels).
- KERNAL 390852-01. MAME loads it as a 16 KB combined image (CRC32 b0a9c2da); VICE uses an 8 KB
  KERNAL image with SHA1 3ad6cc18... (see §7.2, the two sizes are a disagreement in §11).
- The cartridge format "C64 Game System, System 3" (CRT type 15) is the GS's own banking (§5.4).

### §1.5 PET 64 / CBM 4064 / Educator 64

C64-Wiki "Educator 64" (https://www.c64-wiki.com/wiki/Educator_64), MAME `pet64`/`edu64`:

- C64 board (326298) in a PET-style case with a built-in monochrome monitor (black-and-white or green
  screen) and an internal speaker.
- PET 64 KERNAL 901246-01 (ID byte $64 per VICE; own start-up screen). The Educator 64-2 used the
  standard KERNAL.
- MAME renders it with a fixed 16-entry green palette (`PALETTE_PET64`): a monochrome luminance
  mapping of the 16 colours. An emulator needs a monochrome palette option, nothing else.

### §1.6 Japanese C64, Swedish/Finnish VIC-64S, Commodore MAX

- Japanese C64 (MAME `c64_jp`, NTSC): KERNAL 906145-02, character ROM 906143-02 (katakana); VICE
  model "C64 Japanese" with the same names (`kernal-906145-02.bin`, `chargen-906143-02.bin`),
  "FIXME: guessed".
- VIC-64S / C64 Sweden-Finland (MAME `c64_se`): own kernal and Swedish char ROMs; keyboard map differs.
- Commodore MAX Machine (VC-10, Japan 1982, C64-Wiki "C64"): no KERNAL, no BASIC, no CIA2; boots only
  from Ultimax cartridges. VICE has it as the "ultimax" model (`BOARD_MAX`, `NO_CIA2`,
  `C64_KERNAL_NONE`, `kernal-none.bin`). It is the reason the Ultimax mode exists (§2.3).

### §1.7 Drean Commodore 64 (Argentina, PAL-N)

- Built by Drean from Commodore parts; VIC-II replaced by a 6572 for PAL-N (C64-Wiki "MOS
  Technology VIC-II" / search summary of https://www.c64-wiki.com/wiki/MOS_Technology_6573 family pages;
  Drean service manual: https://ftp.funet.fi/pub/cbm/schematics/computers/c64/servicemanuals/C64_Service_Manual_314001-02_(1985_Feb)_Drean_(ES).pdf).
- VICE `vice/src/c64/c64.h`: `C64_PALN_CYCLES_PER_SEC 1023440`, 65 cycles per line, 312 lines.
  The TAP header's video byte has a PAL-N value (3) (VICE manual §17.1).
- A CRT hardware type "Drean" (74) exists for a Drean-specific cartridge (VICE manual, CRT list).

### §1.8 Re-issues and FPGA machines (2017-2026)

- THEC64 / THEC64 Mini (Retro Games Ltd): emulator boxes; not hardware targets.
- Ultimate 64 (Gideon Zweijtzer): FPGA C64 board. Commodore 64 Ultimate (2025, Commodore
  International Corporation) is reported to be built on that design (Artix-7 FPGA)
  (https://www.cnx-software.com/2025/07/16/fpga-based-commodore-64-ultimate-keyboard-pc-is-compatible-with-original-c64-games/,
  https://www.hackster.io/news/the-commodore-64-returns-as-the-fpga-powered-commodore-64-ultimate-4a8ea04e9dab).
  Its spec list says ROMs come "under license or via guided ROM setup on first boot" (CNX summary).
  Open ROMs ships `kernal_ultimate64.rom`/`basic_ultimate64.rom` builds in its `bin/` folder.
- Relevance to an emulator: none as a model; relevant to §8 (ROM rights).

---

## §2 Memory map and the PLA

### §2.1 The five control lines

From PRG lines 12949-12960 and 15615-15625:

| Line | Source | Meaning |
|---|---|---|
| LORAM | 6510 port $01 bit 0 | RAM/ROM at $A000-$BFFF (BASIC) |
| HIRAM | $01 bit 1 | RAM/ROM at $E000-$FFFF (KERNAL) |
| CHAREN | $01 bit 2 | I/O or character ROM at $D000-$DFFF |
| /GAME | expansion port pin 8 | cartridge, active low, pulled up |
| /EXROM | expansion port pin 9 | cartridge, active low, pulled up |

$01 bits 3-5 belong to the datasette (§6.1). The PRG gives the DDR value $2F (47) as the proper
setting (PRG line 12966ff). The PLA (82S100, MAME dump 906114-01, 0xF5 bytes, CRC32 54c89351) also
takes the address lines A12-A15, BA, AEC, R/W, VA12-VA14 (VIC address) and CAS; MAME evaluates the
dumped PLA directly (`PLA_TAG`, `pla->read()` in `c64.cpp`), VICE uses a hand-written table
(`vice/src/c64/c64meminit.c`, `c64pla.c`).

### §2.2 The banking table

The 32 combinations of LORAM, HIRAM, CHAREN, GAME, EXROM (1 = high/inactive for GAME/EXROM) from
C64-Wiki "Bank Switching" (https://www.c64-wiki.com/wiki/Bank_Switching). R = RAM, B = BASIC,
K = KERNAL, C = char ROM, I = I/O, L = cartridge ROML, H = cartridge ROMH, - = unmapped (open bus).

| Mode | Lo Hi Ch G Ex | $0000-0FFF | $1000-7FFF | $8000-9FFF | $A000-BFFF | $C000-CFFF | $D000-DFFF | $E000-FFFF |
|---|---|---|---|---|---|---|---|---|
| 31 | 1 1 1 1 1 | R | R | R | B | R | I | K |
| 30 | 0 1 1 1 1 | R | R | R | R | R | I | K |
| 29 | 1 0 1 1 1 | R | R | R | R | R | I | R |
| 28 | 0 0 1 1 1 | R | R | R | R | R | R | R |
| 27 | 1 1 0 1 1 | R | R | R | B | R | C | K |
| 26 | 0 1 0 1 1 | R | R | R | R | R | C | K |
| 25 | 1 0 0 1 1 | R | R | R | R | R | C | R |
| 24 | 0 0 0 1 1 | R | R | R | R | R | R | R |
| 16-23 | x x x 0 1 | R | - | L | - | - | I | H |
| 15 | 1 1 1 1 0 | R | R | L | B | R | I | K |
| 14 | 0 1 1 1 0 | R | R | R | R | R | I | K |
| 13 | 1 0 1 1 0 | R | R | R | R | R | I | R |
| 12 | 0 0 1 1 0 | R | R | R | R | R | R | R |
| 11 | 1 1 0 1 0 | R | R | L | B | R | C | K |
| 10 | 0 1 0 1 0 | R | R | R | R | R | C | K |
| 9 | 1 0 0 1 0 | R | R | R | R | R | C | R |
| 8 | 0 0 0 1 0 | R | R | R | R | R | R | R |
| 7 | 1 1 1 0 0 | R | R | L | H | R | I | K |
| 6 | 0 1 1 0 0 | R | R | R | H | R | I | K |
| 5 | 1 0 1 0 0 | R | R | R | R | R | I | R |
| 4 | 0 0 1 0 0 | R | R | R | R | R | R | R |
| 3 | 1 1 0 0 0 | R | R | L | H | R | C | K |
| 2 | 0 1 0 0 0 | R | R | R | H | R | C | K |
| 1 | 1 0 0 0 0 | R | R | R | R | R | R | R |
| 0 | 0 0 0 0 0 | R | R | R | R | R | R | R |

Rules readable from the table (C64-Wiki; PRG line 13093ff):

- With LORAM = HIRAM = 0 (and no Ultimax), CHAREN is ignored and the whole map is RAM.
- Writes always go to RAM underneath ROM (the RAM at $A000/$E000/$D000 is written even when ROM is
  read). *Inference from the PRG's "RAM under ROM" usage and from both emulators' write handlers*,
  except in Ultimax mode where unmapped areas take no writes and ROML/ROMH writes go to the cartridge.
- The default after the KERNAL's reset is mode 31 ($01 = $37 with DDR $2F; the PRG gives $2F as the
  proper DDR value).

### §2.3 Ultimax mode

- GAME = 0, EXROM = 1 selects Ultimax regardless of the CPU port bits (modes 16-23): only $0000-$0FFF
  RAM, ROML at $8000, I/O at $D000, ROMH at $E000; $1000-$7FFF and $A000-$CFFF are unmapped
  (C64-Wiki "Bank Switching").
- The VIC-II side: in Ultimax mode the VIC's fetches with VA12-VA13 = 11 (i.e. $3000-$3FFF of each
  16 KB bank) read ROMH instead of RAM. Source: Christian Bauer's VIC article
  (https://ist.uwaterloo.ca/~schepers/MJK/ascii/VIC-Article.txt). Also covered by the VIC-II file.
- Freezer cartridges (Action Replay etc.) use Ultimax to take over the NMI/IRQ/reset vectors at
  $FFFA-$FFFF on a freeze (§5.5).

### §2.4 Open bus / unmapped reads

- VICE: a read from unconnected space returns `vicii_read_phi1()`, the byte the VIC-II fetched in the
  preceding phi1 half-cycle (`vice/src/c64/c64mem.c`, "unconnected memory space"). This applies to the
  Ultimax holes and to $DE00-$DFFF with nothing attached.
- VICE also stores the VIC's phi1 byte into RAM at $0000/$0001 when the CPU writes $00/$01
  (`zero_store()` in `c64mem.c`): the 6510 port captures the write, and the RAM underneath receives
  whatever is on the bus. *Inference*: software that reads RAM $00/$01 through the VIC or by DMA can see it.
- $DE00-$DFFF reads with no cartridge are therefore "VIC data", which is display-dependent. Some
  software and copy protections are known to read it (VICE models read collisions between several
  I/O devices: `io_source_t` entries carry "detach on read collision" flags).

### §2.5 The I/O area $D000-$DFFF

PRG lines 13054-13060 and 15729-16051:

| Range | Device | Mirroring (facts from emulator address decoding) |
|---|---|---|
| $D000-$D3FF | VIC-II (47 registers $D000-$D02E) | repeats every 64 bytes; $D02F-$D03F read $FF (VIC-II file) |
| $D400-$D7FF | SID | 32-byte register block mirrored through 1 KB |
| $D800-$DBFF | Colour RAM | 1024 x 4 bits |
| $DC00-$DCFF | CIA 1 | 16 registers mirrored every 16 bytes |
| $DD00-$DDFF | CIA 2 | 16 registers mirrored every 16 bytes |
| $DE00-$DEFF | I/O1 (expansion port /I/O1, unbuffered) | cartridge-defined |
| $DF00-$DFFF | I/O2 (/I/O2, buffered) | cartridge-defined (REU at $DF00) |

### §2.6 Colour RAM

- 2114 SRAM, 1K x 4 (PRG 13056; C64-Wiki board table); on 250469 rev B inside the custom IC.
- Only the low nibble exists. On a CPU read the high nibble is whatever is on the data bus.
  VICE returns `colour_ram | (vicii_read_phi1() & 0xf0)` (`c64mem.c`); MAME keeps the high nibble of
  the data-bus value it already holds (`data = (data & 0xf0) | (m_color_ram[...] & 0x0f)` in
  `c64.cpp`). See §11.
- The VIC-II reads it in parallel through its own 4 extra data lines (MAME `vic_colorram_map`).

### §2.7 RAM power-on pattern

- DRAM contents at power-on are not defined and vary by machine and DRAM type (VICE bug tracker
  https://sourceforge.net/p/vice-emu/bugs/1866: the default "was tweaked to resemble a common init
  pattern - and then carefully tweaked further so certain software that relies on it works").
- VICE C64 defaults (`vice/src/ram.c`, `ram_resources_init()`, referencing VICE's
  `testprogs/c64/raminitpattern`): `RAMInitValueOffset` 2, `RAMInitStartValue` 0,
  `RAMInitValueInvert` 4, `RAMInitPatternInvert` 16384, `RAMInitPatternInvertValue` 255, no random
  bytes. *Inference from the parameter names*: blocks of 4 bytes alternate $00/$FF, starting at offset
  2, and the whole pattern is inverted every 16 KB.
- The commonly reported real-machine pattern is alternating runs of $00 and $FF in 64-byte blocks
  (VICE's older default had `value_invert = 128` with start $FF, still in the static initialiser of
  `ram.c`). Chameleon's compatibility table lists RAM-init tests (`typicaltest.prg`) that "might fail if
  not run directly after power-up" (https://wiki.icomp.de/wiki/Chameleon_Core_Bugs_(old)).
- Which titles depend on it: no authoritative list was found (OQ5).

---

## §3 CIA 6526 / 6526A / 8521

### §3.1 Registers and timers

From the PRG appendix M (MOS 6526 data sheet, PRG lines ~19997-20600) and C64-Wiki "CIA"
(https://www.c64-wiki.com/wiki/CIA):

| Reg | Name | Notes |
|---|---|---|
| 0 / 1 | PRA / PRB | port data |
| 2 / 3 | DDRA / DDRB | 1 = output |
| 4 / 5 | TA LO / HI | read: counter; write: latch |
| 6 / 7 | TB LO / HI | read: counter; write: latch |
| 8-B | TOD 10ths, sec, min, hr | BCD; hr bit 7 = PM |
| C | SDR | serial shift register |
| D | ICR | read: flags (read clears); write: mask (bit 7 = set/clear) |
| E | CRA | start, PB6 on, toggle/pulse, one-shot, force load, count phi2/CNT, SP direction, TOD 50/60 Hz |
| F | CRB | start, PB7 on, toggle/pulse, one-shot, force load, count source (phi2, CNT, TA underflow, TA underflow while CNT high), TOD write = alarm/clock |

- Each 16-bit timer has a 16-bit latch; it reloads from the latch on underflow, on force-load, and
  (data sheet behaviour) when the high byte is written while the timer is stopped.
- PB6/PB7 can output a one-cycle pulse or toggle on underflow (C64-Wiki).
- Timer B can count Timer A underflows, chaining them into a 32-bit timer (used by the KERNAL tape
  loader with A as a /8 prescaler, pagetable.com p=964).
- Cycle-exact start/stop/load pipeline delays are not in the data sheet; VICE models them as state
  bits per timer (`vice/src/core/ciatimer.h`, `ciacore.c`). *Inference*: Klive will need the same
  test-program-driven model (VICE testprogs, Lorenz suite) rather than the data sheet.

### §3.2 ICR semantics

- Bits 0 TA, 1 TB, 2 TOD alarm, 3 SDR complete, 4 FLAG edge, 7 = any enabled source set
  (C64-Wiki). Reading clears all flags and releases the IRQ/NMI output.
- Writing: bit 7 = 1 sets the given mask bits, 0 clears them. A flag already set when its mask is
  enabled asserts the interrupt (VICE `ciacore.c`: "pending interrupts ... are never cancelled").

### §3.3 Old (6526) vs new (6526A/8521) CIA

From VICE `vice/src/core/ciacore.c` (GPL, read for facts):

- **Interrupt delay.** For the old 6526, VICE raises the IRQ and sets ICR bit 7 one cycle later than
  for the new CIA (old: `CIA_IRQ_RAISE1`/`D7SET1`; new: `RAISE0`/`D7SET0`, except when the ICR was
  read in the cycle before, which delays the new chip too).
- **ICR read and acknowledge.** Different code paths: the new CIA keeps an acknowledge mask applied a
  cycle later; for the old CIA "ack_irqflags effectively isn't used".
- **Timer B bug.** Old 6526 only: if the ICR is read in the cycle right before Timer B's underflow
  flag would be set, the TB flag is lost (`cia_do_update_tb()` sets `CIA_IM_TBB`; the ICR read then
  clears both TBB and TB). Wikipedia's CIA article describes many CIAs failing to raise a Timer B
  interrupt when the ICR was read one or two cycles before; a Wikipedia talk-page comment says VICE
  developers never found a machine showing it (https://www.wikipedia.org/wiki/Talk:MOS_Technology_CIA).
  See §11.
- **Which chip is "new".** VICE maps C64C models to `CIA_MODEL_6526A` (new) and breadbins to
  `CIA_MODEL_6526` (old) (`c64model.c`, `CIA_MODEL_DEFAULT_OLD/NEW`). MAME configures C64C and C64GS
  with `MOS8521` and breadbins with `MOS6526`. A 2005 comp.sys.cbm thread reports that the 8521 (and the
  Amiga 8520) have the *old* timing and only the 6526A differs
  (https://groups.google.com/g/comp.sys.cbm/c/8ARNvBMjlls). See §11.
- 6526 is rated 1 MHz, 6526A 2 MHz (C64-Wiki "CIA").
- Test programs: VICE `testprogs/interrupts/irqnmi/cia-int-irq-new.prg` and `...-nmi-new.prg` are
  cited in `ciacore.c`; the "Lorenz" CIA tests (e.g. "cia1tb123") are standard references
  (*inference from VICE comments*; not run here).

### §3.4 Time of day clock

PRG appendix M ("Time of Day Clock (TOD)", PRG lines 20564-20600):

- 24-hour AM/PM clock in BCD, 1/10 s resolution, driven by an external 50 or 60 Hz TTL input,
  selected by CRA bit 7.
- Writing hours stops the clock; it restarts after a write to tenths.
- Reading hours latches all four registers until tenths is read; the clock keeps counting while
  latched.
- Alarm registers share the addresses; CRB bit 7 selects alarm writes; alarm is write-only.
- On the C64 the TOD pin is fed from the 9 V AC of the power supply (mains frequency), so it is
  50 Hz or 60 Hz by country, not by video standard (*inference from the user-port 9 VAC pins (PRG
  17218ff) and the VICE resource layout*; VICE `cia1_set_timing(cia, cycles_per_sec, powerfreq)` and
  `todticks = tickspersec / powerfreq` in `c64cia1.c`). VICE's SX-64 uses a 60 Hz tick
  (`CIATICK_60HZ`, "guessed"). See OQ3 for whether the KERNAL programs CRA bit 7 by region.

### §3.5 Serial shift register

- SDR shifts on CNT; in output mode (CRA bit 6 = 1) the shift clock is derived from Timer A
  underflows (data sheet, PRG appendix M); 8 bits complete sets ICR bit 3.
- On the C64, CNT1/SP1 and CNT2/SP2 are on the user port (PRG user-port table, §10.4). The C128 uses
  CIA1's SDR for its fast serial bus (C128 file); the C64 KERNAL does not use the SDRs.

### §3.6 Pin assignments

CIA 1 ($DC00, drives /IRQ) - C64-Wiki "CIA", PRG:

- PA0-PA7: keyboard columns (output), joystick port 2 (bits 0-4: up, down, left, right, fire),
  PA6/PA7 select which control port feeds the SID's POT inputs.
- PB0-PB7: keyboard rows (input), joystick port 1 (bits 0-4), PB6/PB7 timer outputs. The VIC-II's
  light-pen input LP is on control port 1's fire pin, which is also PB4 (*inference*; C64-Wiki "CIA"
  mentions a "lightpen fire input" but lists it under port A, see §11).
- FLAG1: cassette read line and serial SRQ IN (*inference*; C64-Wiki says FLAG1 serves the datasette;
  SRQ wiring: C64 schematic).
- TOD: 50/60 Hz.

CIA 2 ($DD00, drives /NMI) - C64-Wiki "CIA":

- PA0-PA1: VIC bank, inverted (%11 = bank 0 $0000-$3FFF ... %00 = bank 3 $C000-$FFFF).
- PA2: RS-232 TXD / user port PA2 (pin M).
- PA3-PA5: IEC ATN OUT, CLK OUT, DATA OUT (inverted through open-collector drivers).
- PA6-PA7: IEC CLK IN, DATA IN.
- PB0-PB7: user port data; the KERNAL's RS-232 uses PB0 RXD and PB1-PB7 for handshake lines.
- FLAG2: user port pin B, RS-232 received data edge.
- /NMI is shared with the RESTORE key circuit and the expansion port /NMI (§4.3).

---

## §4 Keyboard, joysticks, paddles, mouse

### §4.1 Keyboard matrix

The PRG states 8 columns written to $DC00 and 8 rows read from $DC01 (PRG lines 5220-5232). C64-Wiki
"Keyboard" (https://www.c64-wiki.com/wiki/Keyboard) gives the matrix (C64-Wiki says its table is
garbled in places; the table below is the conventional layout and agrees with it):

| $DC00 bit low | PB0 | PB1 | PB2 | PB3 | PB4 | PB5 | PB6 | PB7 |
|---|---|---|---|---|---|---|---|---|
| PA0 | INST/DEL | RETURN | CRSR right | F7 | F1 | F3 | F5 | CRSR down |
| PA1 | 3 | W | A | 4 | Z | S | E | left SHIFT |
| PA2 | 5 | R | D | 6 | C | F | T | X |
| PA3 | 7 | Y | G | 8 | B | H | U | V |
| PA4 | 9 | I | J | 0 | M | K | O | N |
| PA5 | + | P | L | - | . | : | @ | , |
| PA6 | £ | * | ; | CLR/HOME | right SHIFT | = | up-arrow | / |
| PA7 | 1 | left-arrow | CTRL | 2 | SPACE | C= | Q | RUN/STOP |

- SHIFT LOCK is a latching switch in parallel with left SHIFT; RESTORE is not in the matrix
  (C64-Wiki "Keyboard").
- The matrix is passive: a key connects a PA line to a PB line, so it can be driven from either side
  (software can write PB and read PA). With three keys held at three corners of a rectangle the
  fourth position reads as pressed (ghosting), and a pressed key can pull a line that is
  configured as output low through the other side. *Inference from the passive-matrix design*; Open
  ROMs lists "improved keyboard scanning, resistant to ghosting and joystick interference" as a
  feature (`open-roms/STATUS.md`), confirming the effect exists with the stock scan.
- VICE implements the matrix in `vice/src/c64/c64keyboard.c` and the CIA1 port read in
  `c64cia1.c` (both directions).
- Keyboard buffer: 10 bytes at 631-640 ($0277-$0280), count at 198 ($C6), documented for direct POKE
  use in the PRG (lines 5234-5238). Last key matrix code at 197 ($C5) (PRG).

### §4.2 Joysticks

- Port 2 on CIA1 PA0-PA4, port 1 on CIA1 PB0-PB4, active low (C64-Wiki "CIA", "Joystick").
- Because port 1 shares the row inputs, joystick 1 movements look like key presses to the KERNAL
  scan (and vice versa). Writing $DC02 = 224 makes PA0-PA4 inputs for reading port 2 and disables the
  keyboard scan (C64-Wiki "Keyboard", "Paddle").

### §4.3 RESTORE and NMI

- RESTORE drives /NMI through a debounce stage on breadbin boards (half of the 556 timer U20 on long
  boards; Breadbox64 gives ~24 µs RC: https://breadbox64.com/c64-restore-mod/). Sources disagree on the
  556's role (one says it is the reset one-shot) - see §11.
- /NMI is wired-OR of RESTORE, CIA2 and the expansion port. The 6510 NMI is edge-triggered: if CIA2
  holds /NMI low (an unacknowledged CIA2 interrupt), RESTORE produces no further edge; this is the
  known way to disable RESTORE (community source:
  https://libreddit.winscloud.net/r/c64/comments/1npj1rl/interrupts_on_the_c64_lesser_known_aspects).
- RUN/STOP + RESTORE: the KERNAL's NMI handler checks the STOP key (PRG lines 5151-5152, 5341).

### §4.4 Paddles and the 1351 mouse

- SID POTX $D419 and POTY $D41A, 0-255, measured "once per 512 machine cycles" (C64-Wiki "Paddle",
  https://www.c64-wiki.com/wiki/Paddle). The SID first discharges the capacitor and then counts the
  charge time (SID file covers the internals).
- CIA1 PA6/PA7 select the port through a 4066 analog switch: port 1 with PA7=0 PA6=1, port 2 with
  PA7=1 PA6=0. These lines are also keyboard columns, so the scan must stop while reading paddles.
- Paddle fire buttons: port 1 on $DC01 bits 2-3, port 2 on $DC00 bits 2-3 (C64-Wiki "Paddle").
- 1351 mouse, proportional mode (1351 User's Guide,
  https://www.retroisle.com/commodore/c64128/OriginalDocs/1351mousev11.php): POT bits 6-1 = position
  mod 64, bit 0 noise, bit 7 don't care; the mouse updates its POT output every 512 µs by itself; the
  4066 must have been switched to the mouse for >1.6 ms before the value is valid; left button =
  fire, right button = joystick UP line. Joystick mode (right button held at power-on) pulses the
  direction lines ~20 ms. *Inference*: an emulator models the mouse as a device that makes the SID
  measure a charge time encoding the position, synchronised to the SID's 512-cycle measurement.

---

## §5 Cartridges and the expansion port

### §5.1 Expansion port signals

PRG lines 17555-17600 (pin table): GND, +5 V (450 mA shared with the user port), /IRQ, R/W,
DOT CLOCK (8.18 MHz), /I/O1 ($DE00-$DEFF), /GAME, /EXROM, /I/O2 ($DF00-$DFFF), /ROML ($8000-$9FFF),
BA (VIC bus available), /DMA (input), D0-D7, /ROMH ($E000 per the PRG; $A000 in 16 KB mode per the
banking table), /RESET, /NMI, phi2, A0-A15.

- /DMA pulls the 6510 off the bus (RDY and AEC); a DMA device must respect BA to avoid colliding with
  VIC badline fetches (*inference from the signal descriptions*; the REU logic in VICE `reu.c` checks
  BA before stealing cycles).

### §5.2 CRT file format

VICE manual chapter 17 (https://vice-emu.sourceforge.io/vice_17.html), CRT section.

Header (64 bytes, multi-byte values **big-endian**):

| Offset | Size | Field |
|---|---|---|
| $00 | 16 | "C64 CARTRIDGE   " |
| $10 | 4 | header length (usually $40) |
| $14 | 2 | version (e.g. $0100) |
| $16 | 2 | hardware type |
| $18 | 1 | EXROM line state (0 = active) |
| $19 | 1 | GAME line state (0 = active) |
| $1A | 1 | hardware subtype/revision |
| $1B | 5 | reserved |
| $20 | 32 | name, zero-padded |

CHIP packet (repeated):

| Offset | Size | Field |
|---|---|---|
| $00 | 4 | "CHIP" |
| $04 | 4 | packet length incl. this header |
| $08 | 2 | chip type: 0 ROM, 1 RAM (may carry no data), 2 Flash, 3 EEPROM |
| $0A | 2 | bank number |
| $0C | 2 | load address ($8000, $A000, $E000) |
| $0E | 2 | image size |
| $10 | n | data |

C64 hardware type IDs (VICE manual): 0 generic; 1 Action Replay; 2 KCS Power Cartridge; 3 Final
Cartridge III; 4 Simons' BASIC; 5 Ocean type 1; 6 Expert; 7 Fun Play/Power Play; 8 Super Games;
9 Atomic Power; 10 Epyx Fastload; 11 Westermann; 12 Rex Utility; 13 Final Cartridge I; 14 Magic
Formel; 15 C64 Game System/System 3; 16 Warp Speed; 17 Dinamic; 18 Zaxxon/Super Zaxxon (Sega);
19 Magic Desk/Domark/HES Australia; 20 Super Snapshot V5; 21 Comal-80; 22 Structured BASIC; 23 Ross;
24-26 Dela EP64/EP7x8/EP256; 27 Rex EP256; 28 Mikro Assembler; 29 Final Cartridge Plus; 30 Action
Replay 4; 31 Stardos; 32 EasyFlash; 33 EasyFlash Xbank; 34 Capture; 35 Action Replay 3; 36 Retro
Replay; 37 MMC64; 38 MMC Replay; 39 IDE64; 40 Super Snapshot V4; 41 IEEE-488; 42 Game Killer;
43 Prophet64; 44 EXOS; 45 Freeze Frame; 46 Freeze Machine; 47 Snapshot64; 48 Super Explode V5;
49 Magic Voice; 50 Action Replay 2; 51 MACH 5; 52 Diashow-Maker; 53 Pagefox; 54 Kingsoft;
55 Silverrock 128; 56 Formel 64; 57 RGCD; 58 RR-Net MK3; 59 EasyCalc; 60 GMod2; 61 MAX Basic;
62 GMod3; 63 ZIPP-CODE 48; 64-66 Blackbox V8/V3/V4; 67 REX RAM-Floppy; 68 BIS-Plus; 69 SD-BOX;
70 MultiMAX; 71 Blackbox V9; 72 Lt. Kernal Host Adaptor; 73 RAMLink; 74 Drean; 75 IEEE Flash! 64;
76 Turtle Graphics II; 77 Freeze Frame MK2; 78 Partner 64; 79 Hyper-BASIC; 80-82 Universal
Cartridge 1/1.5/2; 83 BMP Data Turbo 2000; 84 Profi-DOS; the list continues past 84 in the manual.

### §5.3 Generic cartridges (type 0)

- 8 KB: EXROM = 0, GAME = 1 → ROML at $8000-$9FFF.
- 16 KB: EXROM = 0, GAME = 0 → ROML $8000, ROMH $A000.
- Ultimax: EXROM = 1, GAME = 0 → ROMH at $E000 (optional ROML at $8000).
- The CRT header's EXROM/GAME bytes give the mode (VICE manual).
- Autostart: the KERNAL reset checks for the "CBM80" signature at $8004 and jumps via $8000 (cold)
  / $8002 is the NMI (warm) vector (PRG memory map; standard documented cartridge header).
  *Inference*: the C64 KERNAL's cartridge test is a documented interface fact in the PRG's
  programming chapters, not from the disassembly.

### §5.4 Banked game cartridges (first-to-support candidates)

Facts from the description comments of VICE `vice/src/c64/cart/*.c`:

- **Ocean type 1** (5): banks of 8 KB selected by writing $DE00, low 6 bits = bank (bit 7 always set,
  no effect). "Type A" (128/256 KB: Batman, Robocop 2, Shadow of the Beast, ...) uses the 16 KB
  configuration with the same bank at ROML and ROMH; the 256 KB carts address banks 16-31 at
  $A000. "Type B" (512 KB, Terminator 2) uses 8 KB mode. VICE notes a generic 16 KB mirrored
  implementation also runs Terminator 2 (`ocean.c`).
- **Fun Play / Power Play** (7): 16 x 8 KB at $8000; bank number scrambled in the $DE00 value
  (bits 5-3 = bank bits 2-0, bit 0 = bank bit 3); $86 switches the ROM off. CRT bank numbers are the
  register values, not 0-15. VICE flags parts as guesswork (`funplay.c`).
- **C64GS / System 3** (15): 64 x 8 KB at $8000 in 8 KB mode; any read or write to $DE00-$DEFF
  latches address bits 0-5 as the bank. VICE confirmed this on the "C64GS 4in1" cart; System 3 carts
  are assumed the same (`gs.c`).
- **Magic Desk / Domark / HES Australia** (19): 8 KB at $8000; $DE00 bits 0-6 bank, bit 7 = 1
  disables the cartridge (EXROM high). 32/64/128 KB originals, up to 1 MB homebrew clones
  (`magicdesk.c`).
- **EasyFlash** (32): $DE00 bank register (0-63), $DE02 control (bit 7 LED, bit 2 mode, bit 1 !EXROM,
  bit 0 GAME; combined with the boot jumper into a memory mode), registers mirrored across
  $DE00-$DEFF; 256 bytes RAM at $DF00; two 512 KB AM29F040 flash chips (ROML/ROMH) with a flash
  command state machine (`easyflash.c`; flash in `flash040core.c`). A CRT write-back option exists
  in VICE.
- **Action Replay 4.2/5/6** (1): 32 KB ROM (4 x 8 KB), 8 KB RAM. $DE00 write: bit 0 GAME low, bit 1
  EXROM high, bit 2 disable cartridge, bits 3-4 bank, bit 5 RAM at ROML (and $DF00-$DFFF = $9F00-$9FFF),
  bit 6 leave freeze mode; $DF00 page reads cartridge ROM/RAM (`actionreplay.c`). Freeze button pulls
  /NMI and switches to Ultimax so the cartridge's vectors appear.
- **Retro Replay / Nordic Replay** (36): 64 KB of a 128 KB flash (bank jumper), 32 KB RAM, registers
  at $DE00/$DE01, ROM/RAM visible in I/O1 and I/O2 (`retroreplay.c`); a superset of the Action
  Replay interface with flash mode and RR-Net clock port.

### §5.5 Freezers

Freezer types (Action Replay, Final Cartridge III, Super Snapshot, Retro Replay) need: an NMI line
from the cartridge, Ultimax switching at the freeze, the cartridge's reading of $DE00/$DF00 I/O,
and the open-bus behaviour of §2.4. *Inference*: they are a later tier than §5.4.

### §5.6 RAM Expansion Unit (1700/1764/1750)

- Sizes: 1700 128 KB, 1764 256 KB (C64), 1750 512 KB (C128); all work on both machines with
  power/timing caveats (C64-Wiki "REU", https://www.c64-wiki.com/wiki/REU).
- Registers at $DF00-$DF0A, mirrored to $DF1F (VICE `vice/src/c64/cart/reu.c`): $00 status (IRQ
  pending, end of block, verify fault, 256K-chips flag, version; read clears), $01 command (bit 7
  execute, bit 5 autoload, bit 4 = 1 disables the $FF00 trigger, bits 0-1 transfer type: 00 C64→REU,
  01 REU→C64, 10 swap, 11 verify), $02/$03 C64 address, $04/$05/$06 REU address and bank, $07/$08
  length (0 = 64 KB), $09 interrupt mask (bit 7 enable, 6 end-of-block, 5 verify error), $0A address
  control (bit 7 fix C64 address, bit 6 fix REU address). Unused bits read 1.
- Transfer: one byte per cycle plus setup (C64-Wiki); the CPU is halted via /DMA. With the $FF00
  trigger enabled, an execute command waits for a write to $FF00 so the code can bank the ROMs out
  first (VICE register comment). VICE also models the "half-autoload" bug with shadow registers.
- Relevance: the REU is the standard expansion for C64/C128 productivity software, GEOS and many
  demos; it touches the bus-arbitration core (BA, DMA). VICE carries extensive test programs for it.

---

## §6 Tape: Datasette 1530 / C2N

### §6.1 The cassette port and the 6510 port

- Cassette port signals: motor (+ about 6 V switched from the board), read, write, sense, +5 V, GND
  (PRG I/O guide).
- 6510 port $01 (PRG lines 12949-12960 and 15615-15625): bit 3 cassette write (output), bit 4 switch
  sense (input), bit 5 motor control (output, 0 = motor on). The two PRG tables give opposite
  polarities for bit 4 (see §11); pagetable.com's loader waits for bit 4 to read low when PLAY is down
  (https://www.pagetable.com/?p=964).
- The read line goes to CIA1 /FLAG; a falling edge sets ICR bit 4 (pagetable.com: the loader polls
  ICR bit 4 and reads Timer B).

### §6.2 KERNAL format at pulse level

C64-Wiki "Datassette Encoding" (https://www.c64-wiki.com/wiki/Datassette_Encoding) and pagetable.com
p=964:

- Three pulse lengths (one full square-wave period each):

| Pulse | Frequency | Period (NTSC, C64-Wiki) | PAL (C64-Wiki) | Timer units used by pagetable's loader ($ x 8 cycles) |
|---|---|---|---|---|
| Short (S) | 2840 Hz | 352 µs (C64-Wiki prints the half-period 176 µs) | 182.7 µs half-period | $30 = 384 cycles |
| Medium (M) | 1953 Hz | 512 µs (256 µs half) | 265.7 µs half | $42 = 528 cycles |
| Long (L) | 1488 Hz | 672 µs (336 µs half) | 348.8 µs half | $56 = 688 cycles |

  A cbm-hackers post reports measured short pulses around 316 µs on PAL and says the book figures are
  outdated (search summary, §11).
- Bit 0 = S,M; bit 1 = M,S; byte marker = L,M; end-of-data = L,S. A byte is: marker, 8 data bits LSB
  first, odd-parity bit.
- Leader of short pulses (~10 s before the first block, ~2 s otherwise) used to calibrate speed;
  countdown $89..$81 before the first copy, $09..$01 before the second copy; every block (header
  and data) is written twice; a 1-byte XOR checksum follows the payload; inter-record gap is one long
  pulse then 60 shorts.
- Header block: 192 bytes: type ($01 relocatable program, $02 data block, $03 non-relocatable program,
  $04 data file header, $05 end-of-tape), start address, end address, 16 displayed filename bytes,
  171 more bytes.
- VICE pulse classification bands for its tape traps (`vice/src/c64/c64.c`, `tapeinit` table, in
  8-cycle units): short $24-$36, medium $37-$49, long $4A-$64.

### §6.3 Turbo loaders

- Most commercial tapes use a short KERNAL-format loader followed by a custom format (Turbo Tape,
  Novaload, Cyberload, Freeload, ...) that reads the FLAG edges or $DC0D directly with their own pulse
  thresholds. *Inference*: only a pulse-exact datasette (TAP replay into FLAG with exact timing)
  loads them; KERNAL traps cannot.
- VICE's KERNAL tape traps hook `TapeFindHeader` at $F72F and `TapeReceive` at $F8A1 (`c64.c`,
  `c64_tape_traps[]`), with the expected ROM bytes checked before trapping.

### §6.4 TAP format

VICE manual §17.1 (https://vice-emu.sourceforge.io/vice_17.html):

| Offset | Size | Field |
|---|---|---|
| $00 | 12 | "C64-TAPE-RAW" (or "C16-TAPE-RAW") |
| $0C | 1 | version: 0 original, 1 overflow-exact, 2 half-wave (C16) |
| $0D | 1 | platform: 0 C64, 1 VIC-20, 2 C16/Plus4, 3 PET, 4 C5x0, 5 C6x0/C7x0 |
| $0E | 1 | video: 0 PAL, 1 NTSC, 2 old NTSC, 3 PAL-N |
| $0F | 1 | reserved |
| $10 | 4 | data length, little-endian |
| $14 | ... | pulse data |

- A data byte is the pulse length in units of 8 cycles. v0: byte $00 = a pulse longer than 255 x 8
  (length unknown). v1: $00 is followed by 3 bytes (little-endian) giving the exact length in cycles.
  v2: each value is a half-wave, starting with a 0→1 transition.
- VICE's text says the header is 14 bytes, but the offsets put data at $14 (20 bytes); the offsets
  are what files use (§11).
- Clock for conversion: C64 PAL 985248 Hz, NTSC 1022730 Hz (VICE manual).

### §6.5 T64

VICE manual §17.2: not a tape image but a container of files. 64-byte header ("C64S tape image
file", version $0100/$0101/$0200, max entries, used entries, 24-byte name), then 32-byte entries
(entry type, C64 file type, start, end, data offset, 16-byte name), then data. The end address field
is often wrong in real files (*inference: common emulator practice is to trust the data length*;
VICE supports only entry type 1).

---

## §7 ROMs

### §7.1 BASIC and character ROMs

Hashes from MAME `src/mame/commodore/c64.cpp` (`ROM_LOAD` lines) and VICE `vice/src/c64/c64rom.h`
(SHA1 and additive checksums agree where both list a ROM):

| ROM | Size | CRC32 | SHA1 |
|---|---|---|---|
| BASIC V2 901226-01 | 8 KB | f833d117 | 79015323128650c742a3694c9429aa91f355905e |
| Character 901225-01 | 4 KB | ec4272ee | adc7c31e18c7c7413d54802ef2f4193da14711aa |
| Character 906143-02 (Japan) | 4 KB | 1604f6c1 | 0fad19dbcdb12461c99657b2979dbb5c2e47b527 |
| Character Swedish (charswe) | 4 KB | bee9b3fd | 446ae58f7110d74d434301491209299f66798d8a |
| Character Swedish alt / Scandinavian | 4 KB | 377a382b | 20df25e0ba1c88f31689c1521397c96968967fac |
| Character 325056-03 (Spain) | 4 KB | c890c175 | 4f57259fff9ef1963a4e87165a6f35ca23864c76 |
| PLA 906114-01 (dump) | 0xF5 | 54c89351 | efb315f560b6f72444b8f0b2ca4b0ccbcd144a1b |

VICE additive checksum for BASIC: 15702 (`C64_BASIC_CHECKSUM`).

### §7.2 KERNAL revisions

| KERNAL | Used in | $FF80 ID (VICE) | CRC32 (MAME) | SHA1 |
|---|---|---|---|---|
| 901227-01 | first NTSC C64s | $AA | dce782fa | 87cc04d61fc748b82df09856847bb5c2754a2033 |
| 901227-02 | 1982-83, PAL/NTSC | $00 | a5c687b3 | 0e2e4ee3f2d41f00bed72f9ab588b83e306fdb13 |
| 901227-03 | from ~1983, also C128's C64 mode | $03 | dbe3e7c7 | 1d503e56df85a62fee696e7618dc5b4e781df1bb |
| 906145-02 | Japanese C64 | $00 | 3a9ef6f1 | 4ff0f11e80f4b57430d8f0c3799ed0f0e0f4565d |
| 251104-04 | SX-64 | $43 | 2c5965d4 | aa136e91ecf3c5ac64f696b3dbcbfc5ba0871c98 |
| 901246-01 | PET 64 / Educator | $64 | 789c8cc5 | 6c4fa9465f6091b174df27dfe679499df447503c |
| 390852-01 | C64GS | $03 | 8 KB (VICE): SHA1 3ad6cc1837c679a11f551ad1cf1a32dd84ace719; 16 KB combined (MAME): CRC32 b0a9c2da, SHA1 21940ef5f1bfe67d7537164f7ca130a1095b067a | – |
| 251913-01 | C64C (16 KB BASIC+KERNAL) | – | 0010ec31 | 765372a0e16cbb0adf23a07b80f6b682b39fbf88 |
| 325182-01 | C64C Sweden/Finland (16 KB) | – | 2aff27d3 | 267654823c4fdf2167050f41faa118218d2569ce |
| Swedish C64 kernal ("kernel.u4") | c64_se | – | f10c2c25 | e4f52d9b36c030eb94524eb49f6f0774c1d02e5e |

VICE additive checksums (`c64rom.h`): -01 54525, -02 50955, -03 50954, Japanese 53635, GS 46538,
SX-64 50955, PET 64 49680. (The SX-64 sum equals -02's; VICE tells them apart by the ID byte.)

What changed (COMPUTE! issue 50, July 1984,
https://www.atarimagazines.com/compute/issue50/286_1_Commodore_64_ROM_Generations.php; mist64/cbmsrc
README via search):

- **-01**: clear screen fills colour RAM with white; tape LOAD waits indefinitely for a key after
  FOUND; no PAL detection.
- **-02**: "universal" PAL/NTSC: detects PAL at reset (by a raster interrupt test) and sets $02A6 = 1;
  clear screen fills colour RAM with the *background* colour, so POKEd characters are invisible;
  tape FOUND wait times out; better PRINT# error handling.
- **-03**: fixes INPUT prompt problems and a crash after editing lines over 80 characters (COMPUTE!
  predicted these fixes); clear screen uses the current text colour ($0286). Used in the C64C's
  combined ROM 251913-01 and in the C128's C64 mode.
- **"-03 variants"**: the same KERNAL code appears in the combined 16 KB ROMs (251913-01) and in
  regional versions (Swedish/Finnish 325182-01, Danish) that differ in keyboard tables and
  character sets (MAME ROM sets). VICE carries a placeholder `C64_KERNAL_REV3SWE` marked FIXME.
- Commercial replacement KERNALs listed by MAME as BIOS options: JiffyDOS 6.01, SpeedDOS, Dolphin DOS,
  Professional DOS, Turbo ROM, EXOS, etc. (§8.6).

Each Commodore ROM carries a self-check byte such that the 8-bit sum matches the upper 8 bits of its
address; the checksum scheme changed in 1983 (mist64/c64rom README, https://github.com/mist64/c64rom,
via search summary).

### §7.3 Landmarks an emulator uses (documented interfaces only)

- Hardware vectors at $FFFA (NMI), $FFFC (RESET), $FFFE (IRQ/BRK); RAM vectors at $0314/$0315 (IRQ),
  $0316/$0317 (BRK), $0318/$0319 (NMI) (PRG memory map, lines ~15570-15600).
- KERNAL jump table $FF81-$FFF3 (39 routines; C64-Wiki "Kernal", PRG chapter 5): e.g. CHROUT $FFD2,
  LOAD $FFD5, SAVE $FFD8, GETIN $FFE4, SCNKEY $FF9F, SETLFS $FFBA, SETNAM $FFBD.
- Reset to READY: the KERNAL tests for a cartridge (§5.3), initialises I/O, RAM test, screen, then
  BASIC prints the banner and "READY.". VICE's autostart waits for "READY." on the line above the
  cursor and the cursor in column 0 and blinking on (`check2()` in `vice/src/autostart.c`); the
  timing default for the stock KERNAL is built in (`AutostartDelay` 0 = built-in).
- Keyboard buffer: $0277-$0280 (10 bytes), count $C6 (PRG). VICE `kbdbuf_init(631, 198, 10, ...)`
  in `c64.c`. Writing up to 10 PETSCII codes and the count makes BASIC execute them as typed.
- Tape traps (VICE): $F72F (find header), $F8A1 (receive); see §6.3. Serial-bus traps for virtual
  drives: VICE `serial_traps_reset()` / `c64_serial_traps` hook the KERNAL's IEC byte routines; the
  addresses are in VICE's `c64.c` (*not copied here; read for facts only if needed*).
- BASIC program pointers (C64-Wiki "Zeropage", https://www.c64-wiki.com/wiki/Zeropage): $2B/$2C
  TXTTAB (default $0801), $2D/$2E VARTAB, $2F/$30 ARYTAB, $31/$32 STREND, $33/$34 FRETOP,
  $37/$38 MEMSIZ, $AE/$AF end of LOAD, $C1/$C2 LOAD/SAVE start, $90 STATUS, $93 LOAD/VERIFY flag,
  $BA current device.

---

## §8 ROM rights

This section is a decision point for the project author. It records claims and their sources; it is
not legal advice.

### §8.1 Who claims the copyrights

- **Cloanto / Amiga Corporation.** Cloanto's knowledge base states that the "older CBM 8-bit system
  ROMs (PET/CBM, C64, etc.)" are "copyrighted works owned and published by Amiga, and may only be used
  or distributed under license", and that without a license "we are not aware of any reason why you
  would be able to" redistribute them (https://www.c64forever.com/kb/13-122, also
  https://cloanto.com/kb/13-122). C64 Forever ships licensed ROM sets.
- **Chain of title as Cloanto describes it.** amiga-news.de, 19 Feb 2015
  (https://amiga-news.de/en/news/AN-2015-02-00027-EN.html): ESCOM assigned all former
  Commodore/Amiga copyrights to Gateway in 1997; they passed to later owners; Cloanto completed the
  transfer in 2012; Tulip Computers bought only the "Commodore" trademarks in 1997, no copyrights.
  Cloanto's Michael Battilana: Cloanto owns copyrights to "all works created by the Commodore/Amiga
  companies up to 1993". The article notes not all works appear in the US Copyright Office database
  (registration is voluntary). OSnews coverage: https://www.osnews.com/story/28330/cloanto-confirms-transfers-of-commodoreamiga-copyrights/.
- **Older claim: Tulip.** VICE's Debian packaging (`debian/README.ROMs`,
  https://sources.debian.org/src/vice/3.7.1%2Bdfsg1-2/debian/README.ROMs) says Tulip Computers
  "appears to hold the copyright" and is "somewhat persnickety about who uses them"; Debian therefore
  strips the ROMs and points to the VICE source tarball's `data/` directory or zimmers.net. This
  contradicts Cloanto's account (§11).
- **Commodore International Corporation (2025).** Completed the purchase of Commodore Corporation BV
  and its 47 trademarks (final payment by 31 July 2025)
  (https://www.tomshardware.com/video-games/retro-gaming/commodore-corporation-bv-acquisition-completed-by-fan-led-consortium-prepare-for-new-retro-futurist-products-with-the-deal-signed-sealed-and-paid-for-ahead-of-schedule;
  https://www.timeextension.com/news/2025/08/as-ceo-my-mission-is-clear-ensure-commodore-never-falls-again).
  The sources describe trademarks; none found says the 8-bit ROM copyrights moved with them, and no
  public licence between Commodore International and Cloanto for the C64 Ultimate's ROMs was found
  (OQ1). Trademarks matter for naming ("Commodore", logos) independently of ROM copyright.
- Forum reports (Lemon64, not primary): Cloanto's public US registration list reportedly includes
  1541 ROMs but not the C64 BASIC/KERNAL; some hardware vendors (Individual Computers' Chameleon)
  reportedly licensed ROMs from Cloanto; the Ultimate 64 historically shipped without ROMs. (Lemon64
  returned HTTP 403 to this researcher; claims taken from search summaries:
  https://www.lemon64.com/forum/viewtopic.php?t=73857.)

### §8.2 What other emulators do

- **VICE** (GPL-2.0+): the upstream source tarball and Windows builds include the CBM ROMs in
  `data/`; Debian and Ubuntu remove them (`+dfsg` packages) (Debian README.ROMs; LinuxLinks summary).
  No written permission statement from a rights holder was found in VICE's manual (the ROM section of
  `vice_4.html` does not discuss it).
- **MAME** (BSD-3/GPL mix): ships no ROMs; drivers list CRC32/SHA1 so users supply their own dumps
  (`c64.cpp`).
- **floooh chips / tiny8bit web emulators**: `floooh/chips-test` (MIT) contains the C64 ROMs in
  `examples/roms/` (`c64_basic.bin`, `c64_char.bin`, `c64_kernalv3.bin`, `c64-roms.h`, plus 1541 and
  Plus/4 ROMs) and its web builds embed them. The repository's MIT licence cannot cover the ROMs
  (*inference*); no permission statement was found in the repo listing.
- **Cloanto C64 Forever**: licensed; its EULA restricts use outside the product (Cloanto KB).
- **Commodore 64 Ultimate**: "ROMs included under license or via guided ROM setup on first boot"
  (CNX summary, §1.8).

### §8.3 Microsoft 6502 BASIC (MIT, 2025)

- On 3 Sept 2025 Microsoft published `microsoft/BASIC-M6502` (version 1.1 source, 6,955 lines) under
  the MIT licence (API: MIT; https://opensource.microsoft.com/blog/2025/09/03/,
  https://www.theregister.com/2025/09/04/microsoft_open_sources_6502_basic/). Commodore's PET BASIC V2
  derives from 6502 BASIC 1.1, and C64 BASIC V2 from that.
- *Inference*: this licenses Microsoft's source, not Commodore's modified 901226-01 binary; whether a
  rebuilt C64 BASIC from MIT source plus Commodore's changes is clear of Cloanto's claim is open
  (OQ2). Open ROMs already uses MIT-licensed Microsoft files for some BASIC parts (its LICENSE).

### §8.4 Open replacement ROMs: MEGA65 Open ROMs

- Repository https://github.com/MEGA65/open-roms; licence LGPL-3.0-or-later (some BASIC files MIT,
  Microsoft); last push 2026-05-16; not archived.
- Prebuilt images in `bin/`: `kernal_generic.rom`, `basic_generic.rom`, `chargen_openroms.rom`,
  `chargen_pxlfont_2.3.rom`, `*_crt` variants, `*_ultimate64.rom`.
- Status (`STATUS.md`): KERNAL keyboard (C64, C128) and VIC-II screen done; IEC loading works, with
  JiffyDOS and DolphinDOS protocols; tape LOAD only (normal and turbo), no SAVE/VERIFY/sequential tape
  files; RS-232 missing; NMI handling incomplete; **"most BASIC commands" and BASIC integer/float
  variables and expression handling missing**. So programs that only LOAD and SYS machine code run;
  BASIC programs largely do not. Software that calls KERNAL internals (not the jump table) will fail
  (*inference*).
- The README argues an implied licence for the original ROMs "would seem ... likely" to exist, but the
  project chose a clean-room approach to avoid challenges.

### §8.5 Other routes

- Asking the user for ROM files at first run (the MAME, Debian VICE and early Ultimate 64 approach).
- Licensing from Cloanto (C64 Forever product line; the Commander X16 ROM licence names Cloanto as the
  contact for the KERNAL and BASIC used there:
  https://ftp.netbsd.org/pub/NetBSD/NetBSD-current/pkgsrc/licenses/commander-x16-rom-license).

### §8.6 JiffyDOS

Commercial: copyright Mark Fellows, sold under licence by RETRO Innovations
(https://store.go4retro.com/jiffydos-64-kernal-rom-overlay-image). A purchase licenses the image for
"one computing device or emulation environment". It needs a matching drive ROM (sold separately)
and true drive emulation.

---

## §9 Program file formats and loading

### §9.1 PRG

A raw file whose first two bytes are the little-endian load address; the rest is loaded there
(KERNAL LOAD with secondary address 1, `,8,1`), or at TXTTAB for secondary address 0 (BASIC load,
relocated). (VICE `AutostartBasicLoad` documents the two choices.)

### §9.2 P00 (PC64)

Peter Schepers' format notes (https://ist.uwaterloo.ca/~schepers/formats/PC64.TXT): 26-byte header:
"C64File" + $00 (8 bytes), 16-byte PETSCII name padded with $00, $00, REL record size (0 for non-REL),
then the file data (for a PRG, including its load address). Extensions .Pxx/.Sxx/.Uxx/.Rxx (PRG/SEQ/
USR/REL); xx increments when names collide.

### §9.3 T64 and D64

T64: §6.5 (an archive; emulators extract the PRG). D64: 35-track 1541 disk image (683 sectors,
174,848 bytes; with error bytes 175,531; 40-track variants) - covered by the 1541 file.

### §9.4 The BASIC stub `10 SYS 2061`

Bytes at $0801 (*derived from the documented BASIC line format: link, line number, tokens, 0, and
end marker $0000*):

```
$0801: 0B 08        link to next line = $080B
$0803: 0A 00        line number 10
$0805: 9E           token SYS
$0806: 32 30 36 31  "2061"
$080A: 00           end of line
$080B: 00 00        end of program (null link)
$080D: ...          machine code (2061 = $080D)
```

The PRG file is these bytes preceded by the load address `01 08`.

### §9.5 How emulators autostart

VICE (`vice/src/autostart.c`, `autostart-prg.c`; manual §6.3.1):

1. **Keyboard-buffer typing** (all modes): after reset VICE waits for "READY." and types
   `LOAD"name",8,1` / `LOAD"*",1` and then `RUN` (or `RUN:` with `AutostartRunWithColon`) into the
   keyboard buffer ($0277/$C6, `kbdbuf_feed()`), checking for "SEARCHING FOR", "LOADING" and "READY."
   on screen.
2. **`AutostartPrgMode`** for PRG files: 0 = virtual filesystem (a virtual device 8 served by KERNAL
   traps, needs `AutostartHandleTrueDriveEmulation` with true drive emulation), 1 = inject into RAM,
   2 = copy into a temporary D64 and load from it.
3. **Injection**: after reset and READY, the bytes are written to RAM (`mem_inject`), then
   `mem_set_basic_text(start, end)` sets $2B/$2C and $AC/$AD to the start, and $2D/$2E, $2F/$30,
   $31/$32 and $AE/$AF to the end (`vice/src/c64/c64mem.c`); then `RUN` is typed. With
   `AutostartBasicLoad` the start becomes TXTTAB.
4. `AutostartWarp`, `AutostartDelay` (0 = built-in), `AutostartDelayRandom` (0-10 extra frames,
   to defeat software that detects identical start timing).

Pointers to fix after an injected load (*inference from VICE's `mem_set_basic_text` and the
zero-page meanings above*): VARTAB $2D/$2E = end+1 is required for BASIC programs (RUN's CLR derives
ARYTAB/STREND from it); $AE/$AF = end mirrors what KERNAL LOAD leaves; TXTTAB must point at the program
for BASIC loads; for `,8,1` loads of machine code nothing is required but a following `RUN` uses the
pointers. A BASIC program loaded at another address than $0801 also needs the line links rebuilt
(BASIC's relink after LOAD; *inference*).

---

## §10 Clocks, power, reset, user port

### §10.1 Master clocks

| System | Crystal | Dot clock | CPU clock | Source |
|---|---|---|---|---|
| PAL (6569/8565) | 17.734475 MHz (4 x 4.43361875 MHz PAL subcarrier) | crystal x 4/9 ≈ 7.882 MHz | crystal / 18 ≈ 985,248.6 Hz | MAME uses `XTAL(17'734'472)/18` (985,248.4 Hz); VICE `C64_PAL_CYCLES_PER_SEC 985248`; C64-Wiki 0.9852486 MHz |
| NTSC (6567/8562) | 14.31818 MHz (4 x 3.579545 MHz) | crystal x 4/7 ≈ 8.1818 MHz | crystal / 14 ≈ 1,022,727.1 Hz | MAME `XTAL(14'318'181)/14`; VICE 1,022,730; C64-Wiki 1.0227273 MHz |
| PAL-N (Drean, 6572) | – | – | 1,023,440 Hz | VICE `C64_PALN_CYCLES_PER_SEC` |

- The dot clock / 8 = CPU clock; the PRG calls it the "8.18 MHz video dot clock" (expansion pin 6).
  The crystal ratios above are *inference* from the quoted divisors; the VIC-II file owns the details.
- Early boards made the dot clock with a discrete PLL (74LS629/MC4044), later with the 8701 clock IC
  (§1.1).

### §10.2 Power

- Breadbin: external brick supplying +5 V DC and 9 V AC; the board regulates +12 V for the 6581 SID
  and VIC-II (from 9 V AC); 250469 boards use only +5 V on the logic (C64-Wiki "Motherboard").
- 9 V AC also reaches the user port (pins 10-11, 50 mA max; PRG) and the TOD circuit (§3.4).
- Combined expansion-port and user-port +5 V budget: 450 mA (PRG); user port +5 V: 100 mA (PRG).

### §10.3 Reset

- Power-on and reset button (none on stock breadbins; the user port pin 3 and expansion port /RESET
  can be grounded: "the Commodore 64 will do a COLD START", memory not cleared - PRG user-port table).
- Breadbin boards generate reset with a 556 timer half (C64-Wiki / schematic commentary at
  https://www.commodore.ca/manuals/funet/cbm/schematics/computers/c64/manual-html/Page_05.html);
  see §11 for the conflicting role descriptions.
- The /RESET line reaches the IEC port, so a hardware reset also resets attached drives (VICE
  `IECReset`, §1.1).

### §10.4 User port

PRG user-port table (PRG lines ~17255-17290):

| Pin | Signal | Pin | Signal |
|---|---|---|---|
| 1 | GND | A | GND |
| 2 | +5 V (100 mA) | B | FLAG2 |
| 3 | /RESET | C-L | PB0-PB7 (CIA2 $DD01) |
| 4 | CNT1 | M | PA2 (CIA2) |
| 5 | SP1 | N | GND |
| 6 | CNT2 | | |
| 7 | SP2 | | |
| 8 | PC2 (CIA2 handshake) | | |
| 9 | serial ATN | | |
| 10-11 | 9 V AC | | |
| 12 | GND | | |

- RS-232 through the user port is bit-banged by the KERNAL using CIA2 timers and FLAG2 (NMI-driven)
  at TTL levels (PRG chapter 6, "RS-232 interface description").
- Common user-port devices: parallel cables to 1541 speeders (Dolphin DOS, SpeedDOS), 4-player
  joystick adapters, RS-232 modems (UP9600 etc.), audio digitisers. *Inference*: none is on the
  critical path of a first C64 core.

---

## §11 Disagreements

1. **8521 timing.** VICE treats the C64C's CIA as the "new" 6526A (`c64model.c`); a 2005 comp.sys.cbm
   test report says the 8521 has the old 6526 timing and only the 6526A differs. MAME models C64C as
   MOS8521 (a distinct type).
2. **Timer B bug existence.** VICE implements it for the old 6526; Wikipedia's article describes it;
   a Wikipedia talk-page comment says VICE developers never found a machine showing it.
3. **Tape pulse durations.** C64-Wiki "Datassette Encoding" prints 176/256/336 µs (NTSC) with
   frequencies 2840/1953/1488 Hz (whose periods are 352/512/672 µs); pagetable.com uses 352/512/672 µs
   and timer units $30/$42/$56 (384/528/688 cycles); a cbm-hackers post reports ~316 µs measured short
   pulses on PAL. VICE's trap bands are $24-$36/$37-$49/$4A-$64.
4. **$01 bit 4 polarity.** PRG line 12957: "Cassette switch sense (0=play button down)"; PRG line
   15623: "Cassette Switch Sense: 1 = Switch Closed". pagetable.com's loader waits for 0.
5. **Colour RAM high nibble.** VICE uses the VIC's phi1 byte; MAME keeps the high nibble of its current
   data-bus value.
6. **ROM copyright holder.** Debian's VICE README: Tulip (2000s wording). Cloanto (2015 onwards):
   Tulip had only trademarks; copyrights went ESCOM → Gateway → ... → Cloanto. Commodore International
   (2025) owns the trademarks; no source links it to the copyrights.
7. **C64GS KERNAL image.** VICE uses an 8 KB `kernal-390852-01.bin`; MAME loads 390852-01 as a 16 KB
   combined ROM.
8. **TAP header length.** VICE manual text says 14 bytes; its own offsets (data at $14) make 20.
9. **250466 typical chips.** C64-Wiki's own text (6569R5, 6581R4AR) disagrees with its parts list
   (6567, 6581R3).
10. **556 timer role.** One schematic commentary: U20 556 is the reset one-shot; another wiki: NMI by
    timer A, RESET by timer B; Breadbox64: RESTORE debounce. *Inference*: both halves are used, one per
    function, but this was not verified on a schematic.
11. **PRG user-port text errata.** The PRG labels SP2 as "from CIA #1" and port B as "on CIA chip #1"
    while giving its address as $DD01 (CIA 2).
12. **PAL clock value.** 17.734475 MHz / 18 = 985,248.6 Hz; MAME's XTAL 17.734472 MHz gives 985,248.4;
    VICE uses the integer 985,248.
13. **Light pen line.** C64-Wiki "CIA" lists the light-pen fire input under CIA1 port A; the
    control-port wiring (fire of port 1 = PB4 = VIC LP) puts it on port B (*inference*, schematic not read).

---

## §12 Open questions

- **OQ1** Does any rights holder (Cloanto/Amiga Corporation, Commodore International Corporation) grant
  permission for bundling C64 KERNAL/BASIC/char ROMs with a free, open-source emulator? None found.
  Can a licence be obtained, and on what terms?
- **OQ2** Does Microsoft's MIT release of 6502 BASIC 1.1 make a C64-compatible BASIC buildable without
  Commodore's code, and how much of 901226-01 is Commodore's own work?
- **OQ3** Does the stock KERNAL set CRA bit 7 (50/60 Hz TOD) according to the detected video system,
  or does it leave it at 60 Hz? (To be answered by running the ROM in a test harness, not by reading a
  commented disassembly.) And which TOD frequency did PAL/NTSC SX-64s actually see?
- **OQ4** 8521 vs 6526A timing (§11.1): which behaviour do real C64C boards show on the VICE/Lorenz CIA
  test programs?
- **OQ5** Which commercial titles depend on the RAM power-on pattern, and which pattern do they need?
- **OQ6** Is the character ROM visible to the VIC in Ultimax mode, and what exactly does the VIC read
  in the Ultimax holes? (VIC-II file.)
- **OQ7** Exact cycle timing of REU DMA start/stop relative to BA and badlines, and of the swap
  transfer (VICE has the reference behaviour; no data sheet).
- **OQ8** Whether System 3 cartridges (as opposed to the C64GS 4-in-1) latch the bank on reads as
  well as writes (VICE `gs.c` caution).
- **OQ9** Open ROMs compatibility on a real game/demo corpus (tape turbo, disk fast loaders, programs
  calling KERNAL internals) - no measured list exists.
- **OQ10** Drean PAL-N timing: VICE says 65 cycles x 312 lines at 1,023,440 Hz; a primary measurement
  was not found.

---

## §13 Reference documents

Primary / documentation:

- Commodore 64 Programmer's Reference Guide, in repo: `dev/research/c64prg.txt` (memory map, $01
  port, CIA data sheet appendix M, user/expansion port tables, keyboard buffer).
- VICE manual, ch. 6 (autostart resources) and ch. 17 (TAP, T64, CRT formats):
  https://vice-emu.sourceforge.io/vice_6.html, https://vice-emu.sourceforge.io/vice_17.html
- C64-Wiki: Motherboard, C64, Bank Switching, CIA, Keyboard, Paddle, REU, SX-64, Educator 64, C64GS,
  Datassette Encoding, Zeropage, Kernal (https://www.c64-wiki.com/wiki/...).
- Christian Bauer, "The MOS 6567/6569 video controller (VIC-II) and its application in the C64":
  https://ist.uwaterloo.ca/~schepers/MJK/ascii/VIC-Article.txt
- Peter Schepers, PC64 (P00) format: https://ist.uwaterloo.ca/~schepers/formats/PC64.TXT ;
  TAP: https://ist.uwaterloo.ca/~schepers/formats/TAP.TXT
- Michael Steil, "A Minimal C64 Datasette Program Loader": https://www.pagetable.com/?p=964
- 1351 Mouse User's Guide: https://www.retroisle.com/commodore/c64128/OriginalDocs/1351mousev11.php
- COMPUTE! issue 50, "Commodore 64 ROM Generations":
  https://www.atarimagazines.com/compute/issue50/286_1_Commodore_64_ROM_Generations.php
- Drean C64 service manual (ES): https://ftp.funet.fi/pub/cbm/schematics/computers/c64/servicemanuals/C64_Service_Manual_314001-02_(1985_Feb)_Drean_(ES).pdf
- Breadbox64 RESTORE article: https://breadbox64.com/c64-restore-mod/

Emulator sources read for facts (not copied):

- VICE (GPL-2.0+), GitHub mirror https://github.com/VICE-Team/svn-mirror : `vice/src/c64/c64model.c`,
  `c64model.h`, `c64rom.h`, `c64-resources.c`, `c64gluelogic.c`, `c64.c`, `c64.h`, `c64mem.c`,
  `c64cia1.c`, `vice/src/core/ciacore.c`, `vice/src/ram.c`, `vice/src/autostart.c`,
  `vice/src/autostart-prg.c`, `vice/src/c64/cart/{ocean,funplay,gs,magicdesk,easyflash,actionreplay,retroreplay,reu}.c`.
- MAME (BSD-3-Clause for this file), `src/mame/commodore/c64.cpp`.
- floooh/chips-test (MIT), `examples/roms/` listing.

Rights and licensing:

- Cloanto KB 13-122: https://www.c64forever.com/kb/13-122
- amiga-news.de 2015-02-19: https://amiga-news.de/en/news/AN-2015-02-00027-EN.html
- Debian VICE README.ROMs: https://sources.debian.org/src/vice/3.7.1%2Bdfsg1-2/debian/README.ROMs
- MEGA65 Open ROMs: https://github.com/MEGA65/open-roms (LICENSE, STATUS.md, bin/)
- Microsoft BASIC-M6502: https://github.com/microsoft/BASIC-M6502 ; announcement
  https://opensource.microsoft.com/blog/2025/09/03/
- Commodore International acquisition: Tom's Hardware and Time Extension articles cited in §8.1.
- Commodore 64 Ultimate: CNX Software and Hackster articles cited in §1.8.
- JiffyDOS licence: https://store.go4retro.com/jiffydos-64-kernal-rom-overlay-image
- Commander X16 ROM licence: https://ftp.netbsd.org/pub/NetBSD/NetBSD-current/pkgsrc/licenses/commander-x16-rom-license

Community (secondary, used only where marked):

- comp.sys.cbm 8521 timing thread: https://groups.google.com/g/comp.sys.cbm/c/8ARNvBMjlls
- Wikipedia talk on the Timer B bug: https://www.wikipedia.org/wiki/Talk:MOS_Technology_CIA
- VICE bug 1866 (RAM init pattern): https://sourceforge.net/p/vice-emu/bugs/1866
- Chameleon core bugs (RAM init tests): https://wiki.icomp.de/wiki/Chameleon_Core_Bugs_(old)
- Lemon64 ROM copyright thread (403 to fetch; search summary only): https://www.lemon64.com/forum/viewtopic.php?t=73857
