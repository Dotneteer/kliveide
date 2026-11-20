# SAM Coupé — ASIC: clocks, memory paging, video, contention, interrupts

Research notes for a cycle-accurate SAM Coupé (MGT, 1989) core in Klive IDE. This file covers the
ASIC ("gate array", VLSI VGT-200 class, ~10 000 gates) side: clocks and frame timing, the paging
registers, the four screen modes and the palette, CPU/ASIC memory and I/O contention, the
interrupt sources, and the port decode. Sound (SAA1099), keyboard matrix detail, disk, tape and
MIDI wire protocol are in the sibling files (`SOUND_INPUT_IO.md`, `EXISTING_EMULATORS.md`).

Conventions:
- Ports are given hex and decimal (`F9h` / 249). "Section" A–D is one of the four 16 KB windows of
  the Z80 address space (A = 0000h–3FFFh … D = C000h–FFFFh). "Page" is a 16 KB internal RAM page
  (0–31). "T" is one 6 MHz CPU clock.
- **Coordinate system used in this file (my own, chosen because all three timing-level sources
  agree on it):** `hc` = T-state within a 384-T line, `vc` = line 0–311. `hc = 0` is the point where
  the line and frame interrupts start, which is **the start of the right border after the previous
  screen line**; screen pixels of line `vc` (0–191) are fetched from about `hc = 128` to `hc = 383`.
  Each source's own numbering is converted into this one and the conversion is stated.
- **Manual** = the official *SAM Coupé Technical Manual* v3.0 (MGT 1989/1990), read in Stefan
  Drissen's Markdown transcription:
  <https://github.com/stefandrissen/sam-coupe-technical-manual/blob/main/techmanual.md>.
  **Unofficial manual** = *The Unofficial SAM Coupé Technical Manual* v1.0 (ed. Simon Cooke, Entropy
  1994), text copy <https://sam.speccy.cz/systech/unofficial_tech-man_v1-0.txt>.
- **SimCoupé** = Simon Owen's emulator, read on branch `main` at commit `1f96603` (2026-08-30),
  <https://github.com/simonowen/simcoupe/tree/main/Base>. It is the only source with hardware
  measurements behind its contention model (Owen's articles, §4.1).
- **MIST core** = Sorgelig's SAM Coupé for MiST, <https://github.com/sorgelig/SAMCoupe_MIST>
  (`video.sv`, `SamCoupe.sv`; last push 2020-05-30). The MiSTer port follows it (*inference*: the
  MiSTer repository could not be located by the API on 2026-11-18, see §9).
- **ZX-Uno core** = Miguel Angel Rodriguez Jodar's SAM Coupé clone, `cores/SamCoupe/asic.v` in
  <https://github.com/zxdos/zxuno> (created 2015-07-23).
- **MAME** = `src/mame/samcoupe/samcoupe.cpp` (not `src/mame/sinclair/` as assumed),
  <https://github.com/mamedev/mame/blob/master/src/mame/samcoupe/samcoupe.cpp>; its own TODO says
  "Better timing, emulate memory contention", so it is a source for registers, not timing.
- *Inference* marks my own conclusions. Where sources disagree, every version is kept.
- Everything is paraphrased; no code is copied. File and function names are given for lookup.

Licences, checked 2026-11-18:

| Source | Licence | How checked |
|---|---|---|
| SimCoupé | GPL-2.0 (repo); file headers say "GPL v2 or later" | GitHub API `repos/simonowen/simcoupe` → `gpl-2.0`; `Frame.h` header |
| MAME `samcoupe.cpp` | **GPL-2.0+** (not BSD-3) — header line `license:GPL-2.0+`, copyright Lee Hammerton, Dirk Best | file header; repo licence field reports NOASSERTION (mixed) |
| MIST core | GPL-2.0 (repo); `SamCoupe.sv` header GPL v2+; `video.sv` header reported as **GPL v3+** | GitHub API `repos/sorgelig/SAMCoupe_MIST` → `GPL-2.0`; file headers |
| ZX-Uno `asic.v` | **none stated** — no licence header, repo licence field `null` | GitHub API `repos/zxdos/zxuno`; file header (author/date only) |
| Manual transcription | no licence (repo licence `null`); text © MGT | GitHub API `repos/stefandrissen/sam-coupe-technical-manual` |
| Unofficial manual | "© 1994 Entropy, all rights reserved" | document text |
| simonowen.com articles | © Simon Owen | page footer |

All of these are read for facts only (Klive's provenance rules). ZX-Uno has no grant at all, so
nothing beyond observed facts should be taken from it.

---

## 1. Clocks and frame timing

### 1.1 Stated facts

| Item | Value | Source |
|---|---|---|
| Master crystal (X1) | 24 MHz | MAME header ("XTAL X1: 24 MHz (system clock)"); SimCoupé `SAM.h` `CRYSTAL_CLOCK_HZ` = 24 000 000 |
| PAL encoder crystal (X2) | 4.433619 MHz (RGB→composite encoder only) | MAME header |
| CPU | Z80B, 6 MHz = 24 MHz / 4 | Manual "General Specifications"; MAME machine config; SimCoupé `CPU_CLOCK_HZ` |
| Pixel clock | 12 MHz = 24 MHz / 2 (one mode-3 pixel; modes 1/2/4 pixels are 2 clocks wide) | SimCoupé `GFX_PIXEL_CLOCK_HZ`; MAME `set_raw(24 MHz/2, 768, …)`; ZX-Uno `hc` 0–767 per line |
| SAA1099 clock | 8 MHz = 24 MHz / 3 | MAME; Manual (Euroconnector pin 24A carries 8 MHz) |
| Euroconnector CPU clock | 6 MHz on pin 15C (CPUCLK) | Manual |
| T-states per line | 384 (48 "cells" × 8 T) | SimCoupé `CPU_CYCLES_PER_LINE`; MIST `hc` 0–383; ZX-Uno 768 pixel clocks; Owen mode-1 article |
| Lines per frame | 312 (non-interlaced) | SimCoupé `GFX_HEIGHT_LINES`; MIST `vc` 0–311; ZX-Uno `VTOTAL`; MAME `SAM_TOTAL_HEIGHT` |
| T-states per frame | 119 808 = 384 × 312 | SimCoupé `CPU_CYCLES_PER_FRAME` |
| Frame rate | 6 000 000 / 119 808 = 50.08 Hz | SimCoupé `ACTUAL_FRAMES_PER_SECOND` |
| Line rate | 15.625 kHz (64 µs) | *inference (arithmetic)* 384 / 6 MHz |
| Screen | 192 lines × 256 T (= 512 pixel clocks; 32 cells) | all sources |
| Cell | 8 T = 16 pixel clocks = 4 bytes of mode-3/4 data or 1 data + 1 attribute byte in modes 1/2 | SimCoupé `CPU_CYCLES_PER_CELL`, `GFX_DATA_BYTES_PER_CELL` |

### 1.2 Horizontal layout (in this file's `hc`, T-states)

| Region | ZX-Uno `asic.v` (pixel `hc`/2) | MIST `video.sv` | SimCoupé | MAME |
|---|---|---|---|---|
| Right border | 0–31 | visible 0–31 | 64 T "side border" (8 cells) each side, no blanking modelled | 16 T (32 px) each side, rest not drawn |
| H blank | 32–103 (front porch 32–39, sync 40–71, back porch 72–103) | 32–111 | — | — |
| H sync | 40–71 | 48–79 | — | — |
| Left border | 104–127 | 112–127 | | |
| Screen fetch / display | 128–383 | fetch from 128 (8-T pipeline before display) | screen contention from `hc` = 124 (§4.3) | |

SimCoupé's renderer works in its own raster coordinate: `Frame::GetRasterPos()` subtracts
`CPU_CYCLES_PER_SIDE_BORDER` (64 T) from the frame cycle, so its "line_cycle 0" is `hc = 64` of this
file, and its comment says the first 64 T of the interrupt frame belong to "the final line of
display" (`FIXME`). `SAM.h` also defines `CPU_CYCLES_ASIC_TO_FRAME_OFFSET` = 64 for the same purpose.
SimCoupé's view geometry is 48 cells × 312 lines with `TOP_BORDER_LINES` = 68,
`BOTTOM_BORDER_LINES` = 52, `SIDE_BORDER_CELLS` = 8.

### 1.3 Vertical layout (in this file's `vc`)

| Region | ZX-Uno | MIST (normal mode) | SimCoupé | MAME |
|---|---|---|---|---|
| Screen | 0–191 | 0–191 | 0–191 (its frame lines 68–259) | 37 top border, 192 screen, 46 bottom border |
| Bottom border | 192–239 | 192–235 | 192–243 (52 lines) | |
| V blank | 240–263 | 236–259 | — | |
| V sync | 244–247 | 240–243 | — | |
| Top border | 264–311 | 260–311 | 244–311 (68 lines) | |
| **Frame interrupt** | line 244 | line 244 | frame cycle 0 = line 244 | at MAME's vblank callback |

*Inference*: all three timing-level sources put the frame interrupt **244 lines after the start of
screen line 0, i.e. 52 lines after the screen ends**, at `hc = 0`. The Manual only says the FRAME
interrupt comes when "frame scanning has finished", 50 times a second. The two FPGA cores disagree
by 4 lines on where vsync lies relative to it (OQ3).

### 1.4 Converting SimCoupé's frame cycle

SimCoupé counts `CPU::frame_cycles` from the frame interrupt (event `FrameInterrupt` at cycle 0,
`CPU.cpp` `Init`). So `hc = frame_cycles % 384` and `vc = (frame_cycles / 384 + 244) % 312`
(*inference*, from `TOP_BORDER_LINES` = 68 and 312 − 68 = 244). Overshoot past 119 808 is carried
into the next frame (`frame_cycles %= CPU_CYCLES_PER_FRAME`, `CPU::Run`).

---

## 2. Memory

### 2.1 Physical memory

| Item | Value | Source |
|---|---|---|
| Internal RAM | 256 KB base (pages 0–15), 512 KB with the internal upgrade (pages 0–31); 256K×4 100 ns DRAM | Manual; Unofficial manual |
| ROM | 32 KB: ROM0 (16 KB) and ROM1 (16 KB) | Manual; MAME (one 32 KB image, ROM1 = offset 4000h) |
| External RAM | 1 MB packs on the expansion port, up to 4 packs (64 pages each); "up to 4.5 MB" total | 1 MB pack manual (worldofsam.org, §9); SimCoupé `NUM_EXTERNAL_PAGES_1MB` = 64, `MAX_EXTERNAL_MB` = 4 |
| Highest BASIC address | 528 K − 1 | Manual "BASIC / Machine Code Interface" |

### 2.2 LMPR — port FAh (250), read/write

| Bit | Manual name | Meaning |
|---|---|---|
| 0–4 | BCD 1/2/4/8/16 | Page in section A; section B gets page + 1. Bit 4 selects the 256 KB half |
| 5 | RAM0 | 1 = RAM replaces ROM0 in section A ("ROM0 off") |
| 6 | ROM1 | 1 = ROM1 replaces RAM in section D |
| 7 | WPRAM | 1 = write-protect section A RAM |

All sources agree on the bits (SimCoupé `LMPR_ROM0_OFF` 20h, `LMPR_ROM1` 40h, `LMPR_WPROT` 80h;
MAME `mem_block_a_r/w`, `mem_block_d_r`; ZX-Uno `rom_in_section_a = ~bit5`). Details:
- Write protect affects section A only, whether ROM0 or RAM is mapped there; writes to ROM are
  always ignored (SimCoupé redirects section A writes to a scratch page in `Memory::PageIn`).
- ROM1 in section D replaces whatever HMPR selects there, **unless** external memory is on: in
  SimCoupé's `UpdatePaging()` the order for section D is external RAM (if HMPR bit 7) → ROM1 (if
  LMPR bit 6) → internal page HMPR+1. MAME applies the external-memory test first as well
  (`mem_r`: XMEM decides before the bank map). *Inference*: external RAM wins over ROM1.
- Page wrap: section B = (LMPR + 1) & 31, so page 31 is followed by page 0 (MAME
  `mem_block_b_r`; ZX-Uno adds in 5 bits).

### 2.3 HMPR — port FBh (251), read/write

| Bit | Manual name | Meaning |
|---|---|---|
| 0–4 | BCD 1/2/4/8/16 | Page in section C; section D gets page + 1 (wraps 31 → 0) |
| 5 | MD3S0 | Mode 3 only: CLUT address bit 2 (value 4) |
| 6 | MD3S1 | Mode 3 only: CLUT address bit 3 (value 8) |
| 7 | MCNTRL | 1 = sections C and D (8000h–FFFFh) go to the expansion connector: /XMEM goes low and internal RAM is not selected |

The Manual's table labels bit 2 "BCD 3"; it is evidently BCD 4 (a transcription/print slip).
SimCoupé `HMPR_MD3COL_MASK` = 60h, `HMPR_MCNTRL_MASK` = 80h. MIST `SamCoupe.sv` reads HMPR bits 6:5
but uses them only in the video module. Manual: XMEM switches "only addresses above 8000H".

### 2.4 External memory — ports 80h/81h (128/129), the 1 MB pack (not the ASIC)

- Port 80h (LEPR in SimCoupé) selects the external page for section C, port 81h (HEPR) for
  section D, used only while HMPR bit 7 is set. Bits 0–5 select one of 64 pages of the pack, bits
  6–7 select one of four packs (board ID by DIP switch in MAME's `onemeg.cpp`). Source: the 1 MB
  pack manual (search summary of
  <https://www.worldofsam.org/system/files/2018-09/SAM%20Coup%C3%A9%20One%20Meg%20Ram%20Pack%20Manual.pdf>)
  and MAME `src/devices/bus/samcoupe/expansion/onemeg.cpp` (not read in full).
- SimCoupé `UpdatePaging()`: section C = `EXTMEM + LEPR`, section D = `EXTMEM + HEPR` when MCNTRL is
  set; LEPR/HEPR reset to 0 in `IO::Init()`.
- The Manual does not mention ports 128/129. Whether they are readable is not established (OQ8).
- External memory is **never contended** (§4).

### 2.5 VMPR — port FCh (252), read/write

| Bit | Name | Meaning |
|---|---|---|
| 0–4 | BCD 1–16 | Screen page. Modes 3/4 ignore bit 0 (even page; the 24 KB screen runs on into page + 1) |
| 5 | MDE0 | Mode bit 0 |
| 6 | MDE1 | Mode bit 1 |
| 7 | TXMIDI / RXMIDI | Write: MIDI OUT data line. Read: MIDI IN line state |

Mode encoding (Unofficial manual; SimCoupé `VMPR_MODE_1..4` = 00h/20h/40h/60h): MDE1:MDE0 = 00 mode 1,
01 mode 2, 10 mode 3, 11 mode 4. So **MDE1 = 1 means modes 3/4**. The Manual's own VMPR table does not
say which value is which mode.

Read-back: SimCoupé returns `vmpr | 80h` (MIDI IN idle high, `SAMIO.cpp` `In`); MIST also sets bit 7;
ZX-Uno leaves bit 7 unimplemented. Screens can only be shown from internal RAM (Unofficial manual).
VMPR may be changed at any moment for split screens (Unofficial manual). MAME's `vmpr_w` takes the
screen base as `(vmpr & 1Eh) << 14` in modes 3/4 and `(vmpr & 1Fh) << 14` in modes 1/2.

Timing of a VMPR write (SimCoupé `IO::Out`, VMPR case): a page change, or a mode change that does
not involve MDE1 (mode 1 ↔ 2), takes effect **one cell (8 T) later** — SimCoupé advances
`frame_cycles` by `CPU_CYCLES_PER_CELL` around `Frame::Update()`. A change involving MDE1 is applied
at the current cell and renders an "artefact" cell (§3.7).

### 2.6 What missing RAM returns (256 KB machine)

- MAME: `mem_page_r` returns FFh for a page ≥ the fitted page count, and writes are dropped.
- SimCoupé `Memory::UpdateConfig()`: with 256 KB only pages 0–15 map to RAM; the rest map to the
  read/write scratch pages. All memory is filled with FFh at first init, so *inference*: missing
  pages read FFh and writes are discarded (it is not stated whether a write to the scratch page is
  later readable through another missing page; *inference*: the scratch write page is separate from
  the scratch read page, so no).
- The ROM's Page Allocation Table marks non-existent pages FFh and `PRAMTP` (5CB4h) holds the
  last fitted page (Manual "Page Allocation Table"), so the ROM probes the size. What real hardware
  returns (FFh, floating bus, or a mirror of pages 0–15 because the ASIC drives bit 4 to a missing
  bank) is **not documented** (OQ1).

### 2.7 Power-on RAM contents

SimCoupé (`Memory::Init`, first init): all memory FFh, then for every 256-byte block of RAM the first
80h bytes are set to 00h ("stripe RAM"). Presented by the emulator as a convenience pattern; no
source says it was measured.

### 2.8 Reset state of the paging registers

| Register | Manual / Unofficial | SimCoupé `IO::Init` | ZX-Uno | MIST | MAME `machine_reset` |
|---|---|---|---|---|---|
| LMPR | — | 00h (ROM0 in, page 0 in A, 1 in B) | 00h | 00h | **0Fh** |
| HMPR | — | 00h | 00h | 00h | **01h** |
| VMPR | "VMPR is zeroed" on reset (Unofficial) | 00h | 00h | (in video module) | **81h** |
| Border | — | 00h | 00h | 00h | — |
| Line int | — | FFh | FFh (initial) | 255 | FFh |
| STATUS | — | FFh (no int active) | — | — | 1Fh |
| LEPR/HEPR | — | 00h | — | — | — |
| CLUT | "unaffected by reset" (Unofficial) | zeroed at construction | fixed Spectrum-like palette (FPGA convenience) | "hides garbage in the palette" comment | — |

MAME's 0Fh/01h/81h are not supported by any other source (OQ9). *Inference*: on hardware the ROM
rewrites all of these within microseconds, so only the first instructions after reset see them.

ASIC start-up: SimCoupé (option `asicdelay`) keeps the ASIC "asleep" for
`CPU_CYCLES_ASIC_STARTUP` = 291 675 T (comment: ~49 ms) after power-on: ASIC port reads (low byte
≥ F8h) return 00h and writes are ignored (`SAMIO.cpp` `In`/`Out`, event `AsicReady` in
`Events.cpp`). No other source mentions this (OQ10).

---

## 3. Video

### 3.1 Modes

| Mode | Pixels | Colours | Bytes | Layout |
|---|---|---|---|---|
| 1 | 256×192, 8×8 attribute cells | 2 per cell from 16 CLUT | 6144 data + 768 attr = 6912 | ZX Spectrum layout at the page start: attributes at +1800h |
| 2 | 256×192, 8×1 attribute cells | 2 per cell from 16 CLUT | 6144 data + 6144 attr | Linear: line y data at y×32; attributes at +2000h + y×32 |
| 3 | 512×192 | 4 per line from 16 CLUT (via HMPR MD3S) | 24 576 | Linear, 128 bytes per line, 4 pixels per byte, even page + next page |
| 4 | 256×192 | 16 | 24 576 | Linear, 128 bytes per line, 2 pixels per byte, even page + next page |

Sources: Manual "Screen Modes"; SimCoupé `SAM.h` (`MODE1_DISPLAY_BYTES` 6912, `MODE2_ATTR_OFFSET`
2000h, `MODE34_BYTES_PER_LINE` 128); MAME `draw_mode1_line`/`draw_mode2_line`.
- Mode 1 data address for screen line y: ((y & C0h) << 5) | ((y & 07h) << 8) | ((y & 38h) << 2),
  attribute at 1800h + (y >> 3) × 32 (MAME `draw_mode1_line`; standard Spectrum layout).
- Mode 4: address = y×128 + x/2; even x in the high nibble (left pixel), odd x in the low nibble
  (Unofficial manual; SimCoupé `Mode4Line`; ZX-Uno `sregm4[31:28]`).
- Mode 3: bits 7-6 are the leftmost pixel, then 5-4, 3-2, 1-0 (SimCoupé `Mode3Line`; MAME).
- The 24 KB of modes 3/4 crosses into page + 1 "within the same block" (Manual: page 12 → 13).
- The Manual's memory text gives mode 1 as 6.75 KB and mode 2 as 12 KB "excluding a 2K gap" (the
  1800h–1FFFh hole of mode 2, which is free memory). *Inference*: this "gap" is the "mode 1 and 2
  screen memory" quirk users mention — mode 2's data and attribute blocks are 8 KB apart, so
  1800h–1FFFh of a mode-2 page (and 1B00h–3FFFh of a mode-1 page) are usable RAM that is still
  contended like any other internal RAM. No source calls it a quirk explicitly (OQ11).

### 3.2 Attribute byte (modes 1/2)

Bit 7 FLASH, bit 6 BRIGHT, bits 5–3 PAPER, bits 2–0 INK. CLUT index for ink = BRIGHT×8 + INK, for
paper = BRIGHT×8 + PAPER (MAME `draw_mode12_block`; ZX-Uno `{attr[6], attr[2:0]}` /
`{attr[6], attr[5:3]}`; MIST same). So BRIGHT selects CLUT 8–15, unlike a Spectrum where it changes
the colour itself.

Flash: ink and paper swap while the flash phase is set. Phase period 16 frames (32-frame cycle):
SimCoupé `MODE1_FRAMES_PER_FLASH` = 16; MIST `flashcnt[4]` of a 5-bit per-frame counter; ZX-Uno
`flash_counter[4]`, incremented at `vc` 311, `hc` 767. Flash applies in modes 1 and 2 (SimCoupé
`Mode1Line`/`Mode2Line`).

### 3.3 Mode 3 colours — the swapped entries

The 2-bit pixel value is combined with HMPR bits 6:5 to form a 4-bit CLUT index. **The two pixel bits
are swapped**: the byte's left bit of the pair is the index's bit 0.

| Pixel bits (b7 b6) | CLUT index (low 2 bits) |
|---|---|
| 00 | 0 |
| 01 | **2** |
| 10 | **1** |
| 11 | 3 |

- SimCoupé `Frame.cpp` `Update()`: the mode-3 table is CLUT[base|0], CLUT[base|2], CLUT[base|1],
  CLUT[base|3], with a "swapped entries" comment; base = (HMPR & 60h) >> 3.
- ZX-Uno `asic.v`: index = {HMPR[6:5], sreg[30], sreg[31]} — the first-shifted bit is the LSB.
- MIST `video.sv`: index = {m3_idx, shift[30], shift[31]} — the same.
- **MAME disagrees**: `draw_mode3_line` uses (byte >> 6) & 3 directly and ignores HMPR bits 5–6
  altogether (it indexes CLUT 0–3 only).

Three sources against MAME; *inference*: the swap is real hardware behaviour.

### 3.4 CLUT and the 128-colour palette

- 16 CLUT registers, write-only, 7 bits each. Written at port F8h with the entry number in A8–A11:
  F8h = entry 0, 1F8h = entry 1 … FF8h = entry 15 (Manual write-port table lists 248, 504, 760, …,
  4088). MAME `clut_w` uses (offset >> 8) & 0Fh; MIST `addr[11:8]`; SimCoupé `port_high & 15`;
  ZX-Uno `addr[11:8]`. *Inference*: A12–A15 are ignored, so `OTDR`/`OUTD` with B = 10h…01h and
  C = F8h loads entries 15…0 — the Unofficial manual's recipe is `BC = 10F8h` with `OTDR`.
  (With B = 10h the first write goes out with B already decremented to 0Fh — standard OTDR.)
- Colour byte (Manual "CLUT"; Unofficial manual; MIST output assignment
  `{G1,R1,B1,I,G0,R0,B0} = clut[index]`):

| Bit | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
|---|---|---|---|---|---|---|---|
| Name | GRN1 | RED1 | BLU1 | BRIGHT | GRN0 | RED0 | BLU0 |

- Levels (Unofficial manual): high bit = 4 units, low bit = 2 units, BRIGHT adds 1 unit to all three
  guns, so each gun is 0–7 (8 levels, but BRIGHT is shared). Example: RED1+GRN1+GRN0+BLU0 = (4,6,2),
  plus BRIGHT = (5,7,3). MAME builds the same 3-bit-per-gun palette (`samcoupe_palette`: red from
  bits 5,1,3; green 6,2,3; blue 4,0,3, through `pal3bit`, i.e. linear 0–255). The analogue output
  levels of the real board are not given anywhere read (OQ12).
- The Manual says palette changes made once per scan line fall in the flyback time and do not
  flicker; changes take effect immediately on the next pixel.
- The palette is 128 not 256 colours because the ASIC lacked spare pins (two pins per gun, BRIGHT
  shared): World of SAM "Hardware Bugs" <https://www.worldofsam.org/node/337>.

### 3.5 Border — port FEh (254) write

| Bit | Name | Meaning |
|---|---|---|
| 0–2 | BCD 1/2/4 | Border CLUT entry, low three bits |
| 3 | MIC | Tape output (normally high) |
| 4 | BEEP | Speaker |
| 5 | BCD 8 | Border CLUT entry, bit 3 |
| 6 | THROM | MIDI THRU enable |
| 7 | SOFF | Screen off (modes 3/4 only) |

Border CLUT index = (bit 5 << 3) | bits 2–0 (SimCoupé `BORDER_COLOUR`; MAME; ZX-Uno). ZX-Uno does not
implement bit 6. Unofficial manual: border writes take effect "at the next screen memory sync"; in
modes 3/4 border colour changes snap to roughly 8-pixel blocks, in modes 1/2 the timing "looks
erratic but is stable" (*inference*: that is the mode-1 contention stripes of §4.4). SimCoupé
`BorderArtefact` draws the first pixel of the changed cell partly in the old colour.

### 3.6 Screen off (SOFF)

- Effective only when border bit 7 = 1 **and** VMPR MDE1 = 1 (modes 3/4) — Manual, Unofficial
  manual, SimCoupé `IO::ScreenDisabled()`, ZX-Uno `screen_off = border[7] & screen_mode[1]`, MIST
  (soff = border bit 7 & mode bit 1, `SamCoupe.sv`). MAME's renderer uses the same test.
- Effect: RGB output black, syncs continue, LINE and FRAME interrupts still occur, the display fetch
  stops and **memory contention is removed for the whole frame area** (it behaves like border: §4).
  Manual (BORDER bit 7), Unofficial manual.
- The picture is black, not the border colour: SimCoupé `UpdateLine` → `BlackLine`; MIST forces the
  output to 0 (not CLUT 0); MAME plots pen 0 = palette colour 0 = black.
- Latency (Unofficial manual): screen-off takes effect one pixel clock later in the border, and 8–12
  screen pixels later inside the screen area.
- KEYBOARD port read bit 7 returns the effective SOFF (§6.2).
- HPEN/LPEN while off: Unofficial manual says they **do not update** (so cannot be used for sync);
  SimCoupé keeps the last values; MIST and ZX-Uno return HPEN = 192 (disagreement, OQ6).
- ATTR port while off returns the attribute captured when the display was switched off
  (Owen, "ATTRibute port", 2007; SimCoupé skips refreshing `attr` when disabled).

### 3.7 Mid-line mode changes ("mode artefacts")

SimCoupé `Frame.cpp` `ModeArtefact()`: when MDE1 changes inside the screen area, the 4 bytes the ASIC
fetched for the transition cell in the *old* mode are rearranged by the ASIC's internal bit routing
and then displayed with the *new* mode's decoder ("Perform the necessary massaging the ASIC does to
prepare for display"; "The target mode decides how the data actually appears in the transition
block"). The exact bit routing is in that function and is not reproduced here; it is measured
behaviour from Owen's tests (*inference*: from the comments and the ATTR-port article, which reuses
"the existing mode-change ASIC artefact code"). No FPGA source models it.

### 3.8 ATTR port — FFh (255) read

- Manual: modes 1/2 → the attribute of the cell currently displayed; modes 3/4 → "every third byte
  of each group of four displayed".
- Owen ("ATTRibute port", 4 Aug 2007, <https://simonowen.com/blog/2007/08/04/attribute-port/>),
  measured: in the border the SAM returns **the last attribute fetched from the main screen** (not FFh
  as on a Spectrum); with the screen off it returns the value latched when the screen went off.
- SimCoupé: `In` refreshes `attr` from the ASIC fetch byte `b2` of the current position when the
  screen is on; `Frame::GetAsicData()` clamps positions outside the screen to the last screen cell of
  the previous line / last line. Unhandled ports also return `b2` while the raster is in the screen
  area past the side border, else FFh ("floating bus" equivalent).
- **MIST disagrees**: `attr` = fetched byte while fetching, **FFh** otherwise (Spectrum-like).
  ZX-Uno returns the last fetched `vram_byte3` (closer to Owen). MAME returns the third displayed
  byte of the current cell, FFh in the border.

### 3.9 LPEN / HPEN — ports F8h / 1F8h read

- Decode: A0–A8; A8 = 0 → LPEN (F8h), A8 = 1 → HPEN (1F8h); A9–A15 ignored (SimCoupé
  `PEN_PORT_MASK` = 1FFh; ZX-Uno bit 8; MAME `offset & 100h`).
- Manual: with no light pen they show the current scan position continuously. LPEN bit 0 = BCD 1 of
  the current CLUT address (the colour being output), bit 1 = TXFMST (MIDI OUT busy).
- LPEN bits 7–2 = horizontal position = T-states since the start of the screen area (0–255), low two
  bits masked: SimCoupé `update_lpen` (`xpos & FCh`, bit 0 = bit 0 of the CLUT index of the pixel
  under the beam, computed per mode); MAME `hpos & FCh`; ZX-Uno `hc[8:1] ^ 80h` in the screen,
  0 + CLUT bit 0 in the border; MIST keeps only the top 5 bits ("only the upper 5 bits are
  meaningful because of the constant 1/8 I/O contention"). In the border LPEN is
  (TXFMST) | (border bit 0) in SimCoupé.
- HPEN = current screen line 0–191, 192 in the border (all sources); SimCoupé switches to the next
  line only after the side-border cycles; ZX-Uno increments at `hc` 767 and saturates at 192.

---

## 4. Contention

### 4.1 Sources and their status

1. **Simon Owen, "SAM Instruction Timings"**, <https://simonowen.com/sam/timings/> — rules plus a
   timing table for every instruction, generated by the SimCoupé v1.2.5 core whose rules were checked
   against a real SAM with general timing tests.
2. **Simon Owen, "Mode 1 Contention"**, <https://simonowen.com/articles/mode1/> — border-raster
   measurements on real hardware (red/black border bars, one NOP added per run).
3. **SimCoupé** `Memory.cpp` (`Memory::Init` table construction, `UpdateContention`), `Memory.h`
   (`WaitStates`), `SAMIO.h` (`IO::WaitStates`), `CPU.h` (`on_mreq_wait`, `on_iorq_wait`).
4. **Andrew Collier**, sam-users, 31 Jan 2005,
   <https://www.mail-archive.com/sam-users@nvg.ntnu.no/msg25194.html> ("z-states").
5. **Unofficial manual** (qualitative: mode 1 is slowed "to roughly Spectrum speed", still 10–20 %
   faster than a Spectrum; mode 2 slower than 3/4 "but less than mode 1").
6. **Manual**: no numbers; only that contention exists, that SOFF removes it, and that ROM code runs
   faster than identical RAM code (ROM LDDR "about 8 %" faster).
7. MIST and ZX-Uno cores (FPGA models, not measurements).

### 4.2 The rules (Owen, timings page)

- Contended: memory accesses to the **internal 512 KB RAM**, and I/O to **ASIC ports F8h–FFh**
  (low byte). Uncontended: ROM, external RAM, all other ports.
- Border: internal RAM accesses limited to **1 cycle in every 4**.
- Main screen (the 192 × 256-T fetch area): internal RAM limited to **1 cycle in every 8**.
- Screen disabled (SOFF in modes 3/4): the whole frame counts as border (1 in 4).
- Mode 1: in addition, **alternating 8-cell (64-T) columns** across the whole line also get the
  1-in-8 rule, in the border too (§4.4).
- ASIC ports F8h–FFh: **always 1 in 8**, border or screen, any mode, screen on or off.
- Memory and I/O accesses sample at different points of their machine cycles, so the same 1-in-8 slot
  produces different wait counts for each from the same start.
- Owen: a single contended access aligns the instruction's end to the contention grid; repeated block
  instructions benefit (e.g. LDI/OUTI with code in external RAM stay 16 T even to a contended
  destination); instructions spanning regions take an intermediate time.

### 4.3 SimCoupé's exact model

`Memory::WaitStates(frame_cycles, addr)`: 0 if the section's page is not internal RAM
(`afSectionContended[section] = page < NUM_INTERNAL_PAGES`, set in `PageIn`; ROM, external and
scratch pages are ≥ 32), else `contention_ptr[frame_cycles]`. It is called from `on_mreq_wait` for
every memory access, and the result is added as extra T-states.

Three tables of 119 808 + 64 entries, indexed by `t` = frame cycle (t = 0 at the frame interrupt):
- `line = t / 384`, `line_cycle = (t + 4) % 384` (`CPU_CYCLES_SCREEN_CONTENTION_OFFSET` = 4).
- `main_screen` = 68 ≤ line < 260 **and** `line_cycle` ≥ 128.
- `mode1_band` = bit 6 of `line_cycle` is 0.
- mask = 7 or 3; entry = mask − ((t + 2) & mask).
  - `contention_mode1`: mask 7 if main_screen or mode1_band, else 3.
  - `contention_mode234`: mask 7 if main_screen, else 3.
  - `contention_4T`: mask 3 everywhere.
- `UpdateContention()` (after VMPR and border writes): 4T table if `full_contention` is false
  (always true in the shipped code), mode-1 table in mode 1, 4T table if the screen is disabled,
  else the mode-2/3/4 table.

`IO::WaitStates(frame_cycles, port)`: 0 if (port & FFh) < F8h, else 7 − ((t + 2) & 7) — no region
or mode dependency.

Consequences in this file's `hc` (*inference, arithmetic*):
- Zero wait when (t + 2) ≡ 3 (mod 4) → t ≡ 1 (mod 4) in 1-in-4 regions, and t ≡ 5 (mod 8) in 1-in-8
  regions and for ASIC I/O. Waits are 0–3 T (border) or 0–7 T (screen, I/O). The absolute phase
  depends on where the SimCoupé Z80 core calls `on_mreq_wait` within the M-cycle (its base class is
  not in `Base/`; OQ4).
- Screen contention runs from `hc` = 124 to 379 on lines 0–191, i.e. it starts 4 T before the screen
  fetch window of the FPGA cores (128).
- Mode-1 bands (mask 7 outside the screen): `hc` ∈ [380, 383] ∪ [0, 59], [124, 187] and [252, 315] —
  three 64-T stripes per line, every 128 T. Outside the 192 screen lines all three apply; on screen
  lines only the first (0–59, the right border just after the screen) adds anything.

### 4.4 Mode-1 stripes — measurements and model disagreement

Owen's measurement (mode1 article): ASIC delays are 4 T per conflict; with one NOP added per run the
red bar alternates between 2 and 4 cells at 8-cell intervals; 16 T (2 cells) fastest, 32 T (4 cells)
when every memory and I/O access is delayed. In his 48-cell numbering the delayed columns were 7–14,
23–30 and from 39 — "the ASIC uses forced delays in 8-cell blocks, alternating every 8 cells across
the full width of the display", one cell earlier than the display area because the ASIC prefetches a
cell ahead. He extrapolated to the parts of the border he could not see. His cell 0 is not tied to
the interrupt point in the text read (OQ2).

| Source | Mode-1 extra 1-in-8 region on border lines (this file's `hc`) | Notes |
|---|---|---|
| SimCoupé | 380–59, 124–187, 252–315 (alternating 64 T, period 128) | matches Owen's "alternating every 8 cells" |
| MIST `video.sv` | `hc[6]` = 1 → 64–127, 192–255, 320–383 | the **opposite phase** to SimCoupé (shifted 64 T); gated off by the OSD option "ZX Mode Speed = Full" (`full_zx`) |
| ZX-Uno `asic.v` | pixel `hc` < 128 or ≥ 256 → 0–63 and 128–383 | **not alternating**: 320 of 384 T contended on border lines; comment "extra contention for MODE 1"; a 2016 "test3" model |

On screen lines the three agree that the right border just after the screen (SimCoupé 0–59, ZX-Uno
0–63) is contended in mode 1, except MIST, which contends 64–127 (the left border) instead. The
SimCoupé model is the only one validated against hardware (OQ2).

### 4.5 Owen's timing table (sample)

Columns: code fetch / data access location (Int = internal RAM, Ext = external RAM or ROM), and the
raster region; values in T; "(n)" = with a contended ASIC port; "a/b" = taken/not taken or
repeat/last.

| Instruction | Int/Int border | Int/Int screen | Ext/Int border | Ext/Int screen | Ext/Ext |
|---|---|---|---|---|---|
| NOP | 4 | 8 | 4 | 4 | 4 |
| LD r,n | 8 | 16 | 7 | 7 | 7 |
| LD (HL),n | 12 | 24 | 12 | 16 | 10 |
| PUSH rr | 16 | 24 | 12 | 16 | 11 |
| EX (SP),HL | 24 | 40 | 24 | 40 | 19 |
| LDIR/LDDR | 24/19 | 40/35 | 24/19 | 32/27 | 21/16 |
| OUT (n),A | 12 (16) | 16 (24) | 11 (16) | 11 (16) | 11 (16) |
| IN r,(C) | 12 (16) | 16 (24) | 12 (16) | 12 (16) | 12 (16) |

Collier (2005) states the same rule as "z-states": 1 z = 1 T in the border or with the screen off, 2 T
in the screen area; instruction times are almost always the Z80 figure rounded up to a multiple of 4 z
(LD (HL),n: 10 T → 12 z → 24 T with the screen on); internal RAM accesses only at multiples of 4 z;
ROM and external memory are exempt; in modes 2–4 at most one access per 8 T with the screen on; "in
MODE 1 not even the borders are always safe". He notes INC HL-type instructions (6 T) take 8 T either
way.

### 4.6 FPGA models of the same rules

- **MIST** (`video.sv`): `io_contention` = `hc[2:0]` ≠ 0 (only every 8th T is free), applied only to
  ports with A0–A7 = F8h–FFh (`SamCoupe.sv`); `mem_contention` = `hc[1:0]` ≠ 0, or `hc[2]` = 1 while
  the screen is being fetched (or in the mode-1 stripe), applied to internal RAM only (ROM and
  external RAM excluded). So free memory slots are `hc` ≡ 0 (mod 4) in the border and ≡ 0 (mod 8) in
  the screen. Fetch = `hc` ≥ 128, `vc` < 192, set on 8-T boundaries, cleared at `hc` 0, and not when
  SOFF.
- **ZX-Uno** (`asic.v`, 12 MHz counter): within each 16-pixel-clock (8-T) group positions 0–9 are
  contended while fetching, positions {0, 1, 8, 9} (one T in every four) otherwise. I/O contention
  uses the same two patterns depending on SOFF, and **applies to every port** (no address decode) —
  disagreeing with Owen/SimCoupé/MIST, which contend only F8h–FFh. ROM accesses are never delayed;
  port writes are ignored while WAIT is low.

### 4.7 Points not covered by any source read

- The exact Z80 T-state at which the ASIC samples /MREQ or /IORQ against its 8-T grid, i.e. how many
  waits a given instruction gets at a given `hc` (SimCoupé encodes it in its `+2` and in the call
  point of `on_mreq_wait`; OQ4).
- Whether the refresh cycle or the M1 opcode fetch is treated differently (Owen's table implies M1
  fetches are contended like any other read: NOP = 8 T on screen).
- Whether the interrupt acknowledge cycle is contended.

---

## 5. Interrupts

### 5.1 Sources of /INT and the STATUS register — port F9h (249) read, active low

| Bit | Name | Meaning (0 = active) |
|---|---|---|
| 0 | LINE | Line interrupt |
| 1 | MOUSE | Mouse interrupt (Manual; SimCoupé: "Part of original SAM design, but never used"; ZX-Uno and MIST read 1) |
| 2 | MIDIIN | MIDI byte received (ZX-Uno reads 1; MIST reads 1) |
| 3 | FRAME | Frame interrupt |
| 4 | MIDIOUT | MIDI byte transmitted |
| 5–7 | K6–K8 | Keyboard matrix lines 6–8 for the rows selected by A8–A15 (0 = pressed) |

Manual: "all five interrupts arrive as IM 1" and the status port must be read to find the source; the
ROM vectors through 0038h. The Manual's MIDI OUT section says the MIDIOUT bit goes *high* when the
register is full, contradicting its own status table (noted by the transcriber's text).

The status bits are **not latched**: they show the interrupt only while the ASIC holds /INT active
for its fixed pulse (SimCoupé clears the bit at the event and sets it again `CPU_CYCLES_INT_ACTIVE`
later in `Events.cpp`; MIST/ZX-Uno compute it from the counters). There is no acknowledge register.
*Inference*: an interrupt missed because interrupts were disabled for the whole pulse is lost.

### 5.2 Frame interrupt

- Position: `vc` = 244, `hc` = 0 (§1.3); MIST starts it at `hc` = 3.
- Pulse length:

| Source | Length |
|---|---|
| Manual | "approximately 20 µs" (= 120 T) |
| SimCoupé `CPU_CYCLES_INT_ACTIVE` | 128 T |
| ZX-Uno | `hc` < 256 pixel clocks = 128 T |
| MIST | `hc` 3–131 = 129 T |
| MAME | 20 µs timer |
| Andrew Collier, real SAM, 9 Apr 1999 (<https://www.mail-archive.com/sam-users@nvg.ntnu.no/msg17543.html>) | "3 loops, about 180 T of interrupt activity" from a re-entering handler (coarse; includes handler time) |

### 5.3 Line interrupt — LINE register, port F9h (249) write

- Value 0–191: interrupt "at the end of the scan line before the one matching its value, which is
  the start of the right-hand border"; it works for line 0 too (the previous line is then the last
  top-border line). 192–255 disable it (Manual). Reset value FFh (SimCoupé, MIST, ZX-Uno, MAME).
- Position: `vc` = value, `hc` = 0 (ZX-Uno `vc == lineint && hc < 256`; MIST `hc` 3–131; SimCoupé
  schedules `LineInterrupt` at frame cycle (value + 68) × 384, the same point; MAME fires it at the
  start of the right border of screen line value − 1). Pulse length as for the frame interrupt.
- Write side effects (SimCoupé `IO::Out` LINE case): if the old value was a screen line, any pending
  line-interrupt event is cancelled and the STATUS LINE bit is forced inactive; then the new event is
  scheduled for the current frame if valid. *Inference*: writing the register while the pulse is
  active ends it early in SimCoupé; not stated for hardware (OQ5).
- The line register is write-only; reading F9h gives STATUS.
- Line and frame interrupts never coincide (line 244 is outside 0–191).

### 5.4 MIDI interrupts

- MIDI OUT: writing port FDh starts a 31.25 kbaud byte (10 bits = 320 µs); TXFMST (LPEN bit 1) is
  high while sending; MIDIOUT interrupt when transmission completes (Manual).
- SimCoupé (`SAMIO.h`, `Events.cpp`): `MIDI_TRANSMIT_TIME` = 320 µs (1920 T); `MidiOutStart` drives
  the MIDIOUT status bit active for `MIDI_INT_ACTIVE_TIME` = 16 µs (96 T) and clears TXFMST after
  `MIDI_TXFMST_ACTIVE_TIME` = 32 µs (192 T). *Inference*: SimCoupé raises the interrupt shortly after
  the write rather than 320 µs later (its event is scheduled with an unstated rounding `A_ROUND`); OQ7.
- MIST: 320-tick countdown at 1 MHz, interrupt near the end of it.
- MIDI IN: interrupt when a byte arrives; must be read before the next (320 µs). The ASIC's MIDI IN
  is reported **non-functional** on production machines (World of SAM "Hardware Bugs",
  <https://www.worldofsam.org/node/337>, citing Steve Nutting).

### 5.5 Interrupt mode and the ROM

- The ROM runs IM 1; handler at 0038h. ROM 1.2+ jumps through ANYIV (5B70h, normally 0049h) on every
  interrupt with B = LMPR at the time and C = STATUS read 6–9 µs after the interrupt; user code
  starts 19–23 µs after it (Manual "Stop Press"). Vectors: FRAMIV 5AE2h, LINIV 5AE4h, COMSV 5AE6h,
  MIPV 5AE8h, MOPV 5AEAh, NMIV 5AE0h; LASTSTAT 5AD1h; FRAMES 5C78h (3 bytes) + FRAMES34 5C7Fh;
  LINIPTR 5A09h (line-interrupt palette table).
- IM 2: nothing in the SAM drives the data bus during the acknowledge. SimCoupé returns its base
  vector (*inference*: FFh, an idle bus) unless the `im2random` option is set, which returns a
  sequence starting 24h, 49h, … (step 37) — i.e. SimCoupé offers an "unpredictable vector" mode for
  testing software that assumes FFh (`CPU.h` `on_get_int_vector`). Real value not documented (OQ13).

---

## 6. Ports

### 6.1 Port map (what the ASIC and the board decode)

ASIC ports are decoded on **A0–A7 = F8h–FFh**; the high byte carries data (CLUT entry, keyboard row,
HPEN select, SAA register select). Disk and printer selects are also produced on the board
(ZX-Uno `disc1_n`/`disc2_n`; MAME). The Manual reserves E0h–FFh for the Coupé.

| Port (low byte) | Read | Write | High-byte use | Contended |
|---|---|---|---|---|
| E0h–E7h (224–231) | Disk 1 (VL1772-02); register/side bits are covered in the disk research, not here | same | ignored | no |
| E8h–EBh | Printer 1/2 data/status (232/233 by ROM default) | same | ignored | no |
| EFh | (clock, SAMBus/DALLAS — expansion) | same | A8–A15 select device (SimCoupé `CLOCK_PORT`) | no |
| F0h–F7h (240–247) | Disk 2 | same | ignored | no |
| **F8h (248)** | LPEN (A8 = 0) / HPEN (A8 = 1, port 1F8h) | CLUT entry A8–A11 | A8 (read), A8–A11 (write) | **yes** |
| **F9h (249)** | STATUS (+ keyboard K6–K8 from A8–A15) | LINE INT | A8–A15 row select (read) | **yes** |
| **FAh (250)** | LMPR | LMPR | ignored | **yes** |
| **FBh (251)** | HMPR | HMPR | ignored | **yes** |
| **FCh (252)** | VMPR (bit 7 = MIDI IN) | VMPR | ignored | **yes** |
| **FDh (253)** | MIDI IN data | MIDI OUT data | ignored | **yes** |
| **FEh (254)** | KEYBOARD (K1–K5, SPEN, EAR, SOFF) | BORDER | A8–A15 row select; FFh = mouse | **yes** |
| **FFh (255)** | ATTR | SAA1099 data (A8 = 0) / address (A8 = 1, port 1FFh) | A8 selects SAA register vs data | **yes** |
| 80h / 81h | — (*unknown*) | 1 MB pack page for C / D | — | no |

MAME decodes F8h–FFh with the full high byte passed to the handler and the SAA on 0FFh/1FFh with
mirror FE00h (so only A0–A8 matter for the SAA). SimCoupé `SAA_MASK` = 1FFh, `SAA_ADDR_PORT` = 1FFh.
Reads of undecoded ports: SimCoupé returns the current ASIC fetch byte while the raster is in the
screen area, FFh otherwise; MAME returns FFh (unmap high). *Inference*: ASIC-port contention also
applies to the SAA writes (low byte FFh) — SimCoupé's `IO::WaitStates` tests the low byte only.

### 6.2 KEYBOARD — port FEh read

| Bit | Name | Meaning |
|---|---|---|
| 0–4 | K1–K5 | Keyboard lines for the rows whose A8–A15 bit is 0; with A8–A15 all 1 (port FFFEh) the extra row and the mouse |
| 5 | SPEN | Light-pen strobe / serial input (MAME reads 1; MIST and ZX-Uno read 0) |
| 6 | EAR | Tape input |
| 7 | SOFF | Effective screen-off status (border bit 7 AND mode 3/4) |

SimCoupé ORs the border SOFF bit and the stored EAR/SPEN bits into the result (`SAMIO.cpp` `In`).
MAME returns bit 7 = 1 always (its comment calls it "status bit external memory") — disagrees with
the Manual and the other sources.

---

## 7. Known ASIC bugs and quirks (collected)

1. Mode 3 pixel bit pairs are swapped against the CLUT (§3.3).
2. Mode 1 is deliberately slowed by striped border contention (§4.4); undocumented by MGT (Owen).
3. ATTR port returns the last *screen* attribute in the border, not FFh (§3.8).
4. Mid-line MDE1 changes display a transition cell built from re-routed bits (§3.7); a border/SOFF
   change leaves a partial first pixel in the old colour (`BorderArtefact`).
5. SOFF is ignored in modes 1/2 (§3.6).
6. MIDI IN does not work on production ASICs; MIDI keyboard input reportedly disturbs palette line
   interrupts (World of SAM nodes 337 and 992; unconfirmed).
7. The ASIC does not pass reset to the disk controllers' 8 MHz side (Hardware Bugs page; board-level).
8. The status bits are pulses, not latches (§5.1); an IM 1 handler that tests the wrong bit re-enters
   until the pulse ends (Collier 1999).
9. 128 not 256 colours (pin count).

---

## 8. Summary for an emulator — *inference*

- 384 × 312 T frame; frame interrupt at line 244 (52 lines after the screen), `hc` 0, 128 T long;
  line interrupt at `hc` 0 of line N (right border after line N−1), 128 T long; STATUS is the live
  pulse.
- Screen fetch `hc` 124/128–383 on lines 0–191; memory contention 1-in-8 there, 1-in-4 elsewhere,
  internal RAM only; mode 1 adds 64-T stripes every 128 T; SOFF (modes 3/4) → 1-in-4 everywhere;
  ASIC ports F8h–FFh 1-in-8 always. SimCoupé's wait formulas are the reference to match, with its
  Z80 core's sampling point to be pinned down by tests against Owen's table (§4.5).

---

## 9. Reference documents (to fetch later, with permission)

| Document | URL | Notes |
|---|---|---|
| SAM Coupé Technical Manual v3.0 (PDF) | <https://www.worldofsam.org/system/files/2018-05/sam-coupe_tech-man_v3-0.pdf> | Official; OCR errors |
| Manual, Markdown transcription (S. Drissen) | <https://github.com/stefandrissen/sam-coupe-technical-manual/blob/main/techmanual.md> | Read here; corrected text |
| Manual, plain text | <https://sam.speccy.cz/systech/sam-coupe_tech-man_v3-0.txt> | Not read |
| World of SAM manual page (errata) | <https://www.worldofsam.org/node/587> | Velesoft errata |
| Unofficial Technical Manual v1.0 (PDF / text) | <https://www.worldofsam.org/sites/default/files/dl-29/unofficial_tech-man_v1-0.pdf>, <https://sam.speccy.cz/systech/unofficial_tech-man_v1-0.txt> | Text copy is incomplete (headings only for bugs) |
| sam-users datasheets repo | <https://github.com/sam-users/sam-coupe-datasheets> | Manual PDF, SAA1099, VL1772, SCC2691, RTC datasheets |
| One Meg RAM Pack manual | <https://www.worldofsam.org/system/files/2018-09/SAM%20Coup%C3%A9%20One%20Meg%20Ram%20Pack%20Manual.pdf> | Ports 128/129 |
| ROM 3.0 annotated disassembly | <https://www.worldofsam.org/system/files/2018-06/sam_rom_v3-0_disasm_annotated.pdf> | Memory sizing (OQ1), interrupt handler |
| Owen: SAM Instruction Timings | <https://simonowen.com/sam/timings/> | Full table |
| Owen: Mode 1 Contention | <https://simonowen.com/articles/mode1/> | Measurement diagrams mode1_1…4 |
| Owen: ATTRibute port | <https://simonowen.com/blog/2007/08/04/attribute-port/> | Test program (~9 KB) downloadable there |
| SimCoupé source | <https://github.com/simonowen/simcoupe/tree/main/Base> | `SAM.h`, `SAMIO.h/.cpp`, `Memory.h/.cpp`, `Frame.h/.cpp`, `Events.cpp`, `CPU.h/.cpp` |
| MAME driver | <https://github.com/mamedev/mame/blob/master/src/mame/samcoupe/samcoupe.cpp> | GPL-2.0+ |
| MIST core | <https://github.com/sorgelig/SAMCoupe_MIST> | `video.sv`, `SamCoupe.sv` |
| ZX-Uno core | <https://github.com/zxdos/zxuno/tree/master/cores/SamCoupe> | `asic.v`, `tb_asic.v`; no licence |
| World of SAM "Hardware Bugs" | <https://www.worldofsam.org/node/337>, <https://worldofsam.org/node/992> | |
| sam-users archive | <https://www.mail-archive.com/sam-users@nvg.ntnu.no/> | Collier 1999, 2005 threads |

The MiSTer port (expected at `MiSTer-devel/SAMCoupe_MiSTer`) returned 404 from the GitHub API on
2026-11-18; its licence was therefore not verified.

---

## Open questions

1. **OQ1 — Missing RAM on a 256 KB machine**: do pages 16–31 read FFh (MAME, SimCoupé by
   construction), floating-bus data, or a mirror of 0–15? What does the ROM's size probe test? The
   ROM 3.0 disassembly would show the probe; a real 256 KB machine would settle it.
2. **OQ2 — Mode-1 stripe phase**: SimCoupé (alternating 64-T stripes, the first at `hc` −4…59),
   MIST (opposite phase, 64–127…), ZX-Uno (0–63 and 128–383, non-alternating). Tie Owen's measured
   columns 7–14 / 23–30 / 39 to the interrupt point.
3. **OQ3 — Vertical sync and blanking lines** relative to the frame interrupt (ZX-Uno vsync 244–247,
   MIST 240–243); only matters for the visible-border window.
4. **OQ4 — Wait-state alignment within the M-cycle**: at which T of a memory read, write, opcode
   fetch, I/O cycle and interrupt acknowledge does the ASIC sample against its 4/8-T grid? Pin
   SimCoupé's `+2` and its Z80 core's `on_mreq_wait` call point, then verify against Owen's table.
5. **OQ5 — Interrupt pulse length**: 120 T (Manual, 20 µs), 128 T (SimCoupé, ZX-Uno) or 129 T (MIST);
   and what writing LINE during an active pulse does.
6. **OQ6 — HPEN/LPEN with the screen off**: frozen (Unofficial manual, SimCoupé) or HPEN = 192 (MIST,
   ZX-Uno)?
7. **OQ7 — MIDI OUT interrupt timing**: immediately after the write (SimCoupé) or at the end of the
   320 µs frame (Manual wording, MIST)? And TXFMST length.
8. **OQ8 — Ports 80h/81h**: readable? Reset state on hardware without a pack?
9. **OQ9 — Register reset values**: all zero (SimCoupé, FPGA cores, "VMPR zeroed") vs MAME's
   LMPR 0Fh / HMPR 01h / VMPR 81h; CLUT contents at power-on (garbage per the MIST comment).
10. **OQ10 — ASIC start-up delay**: SimCoupé's optional ~49 ms (291 675 T) "asleep" period where ASIC
    ports read 00h — measured or assumed?
11. **OQ11 — "Mode 1/2 screen memory" quirk**: the request mentions one; no source read names it.
    Candidates: the free 1800h–1FFFh gap of mode 2, or modes 1/2 allowing an odd page (no page
    pairing). Needs the Manual PDF's screen chapter or a forum source.
12. **OQ12 — Analogue colour levels**: linear 0–7 per gun (Unofficial manual units, MAME) or a
    measured non-linear DAC? SimCoupé's palette code (in its UI layer, not read) may carry a table.
13. **OQ13 — IM 2 vector on real hardware**: FFh, or unpredictable as SimCoupé's `im2random` option
    suggests?
14. **OQ14 — I/O contention scope**: only F8h–FFh (Owen, SimCoupé, MIST) or all ports (ZX-Uno)?
    Disk-port timing for fast loaders depends on it.
15. **OQ15 — ATTR port in the border**: last screen attribute (Owen's measurement, SimCoupé, ZX-Uno)
    vs FFh (MIST, MAME) — Owen measured; treat MIST as wrong unless new evidence.
16. **OQ16 — ModeArtefact bit routing**: only SimCoupé models it; obtain Owen's test program/results
    to record the routing in Klive's own words.
