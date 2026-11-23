# Commodore C16, C116, Plus/4 (TED machines) - research notes

Research pack for the Commodore plan. Facts, not a plan. Compiled 2026-11-23.

Conventions:

- Every fact carries a source: a URL, a datasheet page, or an emulator file and function.
  Emulator code was read for facts only; nothing here is copied from it.
- *Inference* marks something concluded rather than read. **Unverified** marks a commonly
  repeated value this pass could not confirm against a primary source.
- The 7501/8501 CPU (6502 core with an on-chip port) is in `CPU_6502_FAMILY.md`, the IEC bus
  and the 1541 drive in `DRIVE_1541.md`. This file records what is specific to the TED machines.
- Short names for sources used below:
  - **DS** is the MOS "HMOS Text Editing Device" TED 7360R0 datasheet, dated 1983-04-19
    (22 sheets plus a 7360R7 NTSC timing page), scanned by Karls Technology:
    <https://www.karlstechnology.com/commodore/TED7360-datasheet.pdf>. "DS p.N" is sheet N.
  - **MAME** is `mamedev/mame` (BSD-3-Clause per file, Curt Coder): `src/devices/sound/mos7360.cpp|.h`
    and `src/mame/commodore/plus4.cpp`. Read at the 2026-11-23 head.
  - **CLK** is Clock Signal, `TomHarte/CLK` (MIT): `Machines/Commodore/Plus4/{Video,Audio,Plus4,Pager,Interrupts,TapeHandler}.*`.
  - **FPGATED** is Istvan Hegedus's Verilog TED (GPL-3), as shipped in `MiSTer-devel/C16_MiSTer`,
    `rtl/ted.v` v1.9 (its revision history was read for facts).

---

## §1 Models

### §1.1 Machines

| Model | RAM | CPU | Keyboard | Extras | Regions |
|---|---|---|---|---|---|
| Commodore 16 | 16K | 7501 (early) / 8501 | full-travel, C64-style case | none | PAL, NTSC; Hungarian kernal 318030 |
| Commodore 116 | 16K | 8501 | rubber keys, small case | none | PAL (Europe) |
| Plus/4 | 64K | 8501 / 7501 | full-travel | 3-plus-1 function ROMs, 6551 ACIA, 6529 user port | PAL, NTSC |
| C232 (prototype) | 32K | 7501 | | | NTSC |
| V364 (prototype) | 64K | 7501 | with numeric keypad | MOS 8706 + T6721A speech | NTSC |
| C264 (prototype) | 64K | 7501 | | ROM sockets for function ROMs | NTSC |

Sources: MAME `plus4.cpp`, the `COMP(...)` list (c264, c232, v364, plus4 NTSC, plus4p PAL, c16
NTSC, c16p PAL, c16_hu, c116) and its machine configs (`plus4_mem<0x10000>` for the Plus/4,
`<0x4000>` for the C16/C116, `<0x8000>` for the C232; `MOS8706` and `T6721A` on the V364;
`m_acia->set_xtal(1.8432_MHz_XTAL)`). The 7501 is HMOS-1 and the 8501 HMOS-2; the parts seen
include 7501R1 (C232 and C264 prototypes), 8501R1 and 8501R4
([plus4world MOS 7501/8501](https://plus4world.com/hardware/MOS_75018501)).
CPU differences are in `CPU_6502_FAMILY.md`.

### §1.2 TED parts

- **7360** (HMOS-1, 251535-01) and **8360** (HMOS-2, 251535-02). The only documented difference
  is the process ([plus4world MOS 7360/8360](https://plus4world.com/hardware/MOS_7360_8360)).
  Known marks: 7360R0 (prototype, the datasheet's subject), ceramic 7360R6/R7 in C264 boards,
  ceramic 8360R1 in an early C16, then resin 8360R1 and R2 (R2 from about week 40/1984). The
  datasheet's last page is a "7360R7 timing specifications, NTSC only" table.
- Gaia (Attila Grosz, the YAPE author) knew of R0, R1 and R2 in 2005, with R1 rare and found
  only in C16s ([plus4world forum 9269](https://plus4world.com/forum/9269)). No
  software-visible difference between revisions was established (OQ1).

### §1.3 Clocks (exact)

The TED takes four times the colour subcarrier and generates every machine clock from it
(DS p.19, pin 14: 14.31818 MHz NTSC, 17.734475 MHz PAL).

| | PAL | NTSC |
|---|---|---|
| Input clock | 17,734,475 Hz | 14,318,180 Hz |
| Dot clock (input x 2/5 PAL, / 2 NTSC) | 7,093,790 Hz | 7,159,090 Hz |
| Single clock (dot / 8) | 886,723.75 Hz | 894,886.25 Hz |
| Double clock (dot / 4) | 1,773,447.5 Hz | 1,789,772.5 Hz |
| Dots per line | 456 (counter 0-455) | 456 |
| Lines | 312 (0-311) | 262 (0-261) |
| Frame rate | 49.861 Hz | 59.923 Hz |

Sources: DS p.8 ("894KHz (NTSC) to 1.788MHz"), p.14 (456 dots; 262 and 312 lines), p.19
(φout 894.9 kHz NTSC / 886.7 kHz PAL). CLK `Video.hpp` (`clock_rate`: 14,318,180 /
17,734,448, and "divide by 5 and multiply by 2" for PAL). MAME `plus4.cpp` (`plus4p`:
CPU `17.73447_MHz_XTAL / 10`; `plus4n`: `14.318181_MHz_XTAL / 8`, the double-clock rates).
Frame rates were computed from these figures.

- PAL: 456 x 312 = 142,272 dots per frame = 17,784 single-clock periods per frame.
- NTSC: 456 x 262 = 119,472 dots per frame = 14,934 single-clock periods per frame.

### §1.4 When the CPU runs at single and at double clock

The datasheet gives two descriptions that do not quite agree:

- **Narrative (DS p.8):** in raster lines 0-204 the TED outputs single clock during horizontal
  counts 400-344 (wrapping through 0): processor handshaking 400-432, character fetches
  432-304, DRAM refresh 304-344. Outside that window it outputs double clock. In lines 205-261
  (NTSC) or 205-311 (PAL) it outputs double clock except at 304-344, for refresh. With the
  blank bit (`$FF06` b4) clear, the screen shows the border colour and the double clock runs
  everywhere except during refresh.
- **Pin description (DS p.22):** "raster lines 0-204 and horizontal positions 400-344" and
  "horizontal positions 304-344".
- **Decode table (DS p.11):** the external fetch window starts at 400 and stops at 288, and
  "refresh single clock" is listed as 288 start, 328 stop (the scan's alignment is ambiguous).
- **Emulators:** CLK puts `BeginExternalFetchClock` at 400, `EndExternalFetchWindow` at 296 and
  `EndRefresh` at 336, and runs the CPU slow when
  `single_clock_ || refresh_ || (external_fetch_ && enable_display_)` (`Video.hpp`,
  `cycle_length`). MAME (in half-cycles of 4 dots) turns refresh on at column 74 (dot 296) and
  off at column 84 (dot 336), and starts the single-clock window at column 100 (dot 400)
  (`mos7360_device::even_events`).
- So the refresh window is 296-336 in both emulators and 304-344 in the datasheet text: a
  constant 8-dot offset, probably a different origin for the count (*inference*). See §10.
- `$FF13` bit 1 forces single clock everywhere (DS p.16). `$FF07` bit 5 ("freeze") stops the
  counters and also forces single clock (DS p.14).
- **CPU cycles per line, approximately** (*inference* from the windows above, ignoring DMA
  halts): a display line has 400 dots of single clock (50 cycles) and 56 dots of double clock
  (14 cycles), 64 cycles in all. A border or blank line has 40 dots of single clock (5 refresh
  cycles) and 416 dots of double clock (104 cycles), 109 in all. Each DMA line takes away up to
  40 more cycles plus the 3-cycle lead-in (§2.4).

---

## §2 The TED (7360/8360) at cycle level

### §2.1 Horizontal and vertical decodes

From DS p.11-12, the decode table of horizontal dot counts (0-455) and vertical lines. The
scan's column alignment is poor; the values below read consistently.

- Horizontal: sync 358-390; equalisation pulses 152-170 and 380-398; blanking 344-416; burst
  384-408; character window 432-296; external fetch window 400-288; 40-column screen 451-315
  (the 38-column screen starts 3 or 7 dots later; the scan is unclear); video shift register
  440-304; character position latched to reload at 290; increment vertical line at 376; end of
  screen (clear vertical line, vertical sub and character reload registers) at 384.
- Vertical: end of screen at 311 (PAL) / 261 (NTSC); vertical sync 254-257 (PAL) / 229-232
  (NTSC); equalising 251-260 (PAL) / 226-235 (NTSC); vertical blanking 251-269 (PAL) / 226-244
  (NTSC); attribute fetch lines 0-203; frame window stops at 204; vertical screen window 4-204
  (25 rows) or 8-200 (24 rows).
- CLK's `HorizontalEvent` enum uses its own origin: 40-column start = 0, 38-column start = 8,
  end of 38 = 312, end of 40 = 320, refresh end 336, flash increment 348, blank 353, sync 359,
  end of screen 384, sync end 391, external fetch clock 400, attribute fetch 407, blank end
  423, increment video counter 432, shift register 440, counter reset 455. It also uses
  vsync 254-257 / 229-232 and vblank 251-269 / 226-244, matching the datasheet. CLK calls its
  windows "in FPGATED parlance". MAME's columns are half-cycles 0-113, with the beam origin
  at column 106 (`half_cycle_pre`: `m_beam_x = ((m_col + 114 - 106) % 114) * 4`).

### §2.2 Video modes and memory addresses

All from DS p.3-7, confirmed by CLK `Video.hpp` (`set_video_mode`, the fetch switch in
`run_for`) and MAME (`MODE_*`).

- The **video matrix** (1000 bytes) is at matrix base + `$400`. The **attribute** bytes
  (1000) are at the base. The base is `$FF14` bits 7-3 (A15-A11). Attribute byte: b7 flash,
  b6-4 luminance, b3-0 colour (DS p.3-4).
- **Character data address:** `$FF13` bits 7-2 are A15-A10. With reverse enabled (`$FF07`
  b7 = 0), code bit 7 means "reverse" and only 128 characters (1K) are used. With `$FF07` b7 = 1
  there are 256 characters and A10 comes from the code (DS p.4, p.14; CLK `character_base_mask_`
  0xFC00 / 0xF800).
- **Text:** 40x25 cells of 8x8. A 0 bit takes background 0 (`$FF15`) and a 1 bit takes the
  attribute's colour and luminance.
- **Multicolour text** (`$FF07` b4): attribute b3 = 1 makes a 4x8 multicolour cell. Pair 00 is
  `$FF15`, 01 `$FF16`, 10 `$FF17`, 11 attribute colour b2-0 with luminance b6-4. So only 8
  foreground colours are available in multicolour cells (DS p.5).
- **Extended colour** (`$FF06` b6): code bits 7-6 select background 0-3 (`$FF15-$FF18`). Only
  64 characters; the TED forces A10 and A9 to 0 (DS p.5).
- **Hires bitmap** (`$FF06` b5): the bitmap base is `$FF12` bits 5-3 (A15-A13, 8K aligned). Address
  = base + character position x 8 + row (DS p.6). A 0 bit takes colour from matrix b3-0 and
  luminance from attribute b6-4. A 1 bit takes colour from matrix b7-4 and luminance from
  attribute b2-0 (DS p.7).
- **Multicolour bitmap:** 00 `$FF15`, 01 matrix b7-4 with attribute b6-4 luminance, 10 matrix
  b3-0 with attribute b2-0 luminance (the datasheet prints "bits 4-6"; see §10), 11 `$FF16`
  (DS p.7).
- **Invalid combinations** (ECM with BMM or MCM) display black: CLK `VideoMode::Blank`; MAME
  `fetch_bitmap` with `$FF06` b7 set uses address forms `| 0xf800`, modelling what the chip
  fetches in those modes.
- **Fetch from ROM:** `$FF12` bit 2 = 1 makes TED character and bitmap fetches read ROM, 0 reads
  RAM (DS p.16). On the Plus/4 the default character set is fetched from KERNAL ROM. MAME shows
  TED ROM fetches go through the same `$FDD0` bank selection as the CPU (`update_banks` selects
  `m_video_lo/hi` from `m_addr`).

### §2.3 Hardware cursor, flash and reverse

- **Cursor:** a 10-bit position in `$FF0C` (b1-0) and `$FF0D`. Valid range 0-999; it blinks at
  2 Hz by swapping foreground and background. Standard character mode only (DS p.8).
- **Flash:** attribute b7 makes the character's foreground blink at 2 Hz (DS p.8). The flash
  counter is `$FF1F` bits 6-3. It increments once per frame and gives the 2 Hz signal on
  overflow (DS p.18). The increment happens at line 205: CLK `Flash` delayed event when
  `vertical_counter_ == 205`; MAME `odd_events`, column 87, line 205.

### §2.4 DMA ("badlines") and CPU halts

- Attribute and video matrix fetches happen on the raster line before a character row
  (attributes) and on the first raster line of the row (pointers). During each, the TED takes
  the bus for both halves of the clock cycle for 40 consecutive cycles (DS p.16, register 20).
- **BA** goes low during φ1, 3 single-clock cycles before the TED needs the bus, and stays low
  for the whole fetch. **AEC** toggles with φ out in single-clock periods. When the TED needs
  both halves for the φ1 dot fetches and the φ2 pointer fetches, BA goes low, and on the fourth
  φ1 out AEC stays low until the end of the φ2 fetch (DS p.22). So the CPU is warned 3 cycles
  ahead, as with the C64's VIC-II, because the 6502 core halts on RDY only in read cycles
  (*inference*; see `CPU_6502_FAMILY.md`).
- CLK models this as states `IDLE -> THALT1 -> THALT2 -> THALT3 -> TDMA`, raising the CPU's
  ready line from THALT1 (`Video.hpp`, the DMA state machine; "single_cycle_end's in FPGATED
  parlance"). MAME uses events `EV_DMA_1..5` and `EV_DMA_ABORT`, with `ba_tick`/`update_ba`
  predicting the release from column 76 (`mos7360.cpp`, SCHEDULING).
- **When a line is a DMA line:** MAME starts DMA at column 102 when
  `m_dma_enabled && ((m_line_d1 & 7) == m_vscroll)` (attribute fetch, flag 0x01), or on the
  following line for the pointer fetch (flag 0x02). CLK: `bad_line()` = display enabled,
  `video_line_ < 203` and `(video_line_ & 7) == y_scroll_`, with `bad_line2_` delayed one line.
- **DRAM refresh:** five RAS-only refreshes per line straight after the character fetches,
  256-row scheme, at most 3.26 ms between refreshes of a row (DS p.8). These are the 5 single
  cycles in border lines (§1.4).

### §2.5 Raster interrupt and counters

- The raster compare is 9 bits: `$FF0A` b0 is bit 8 and `$FF0B` the low byte. The datasheet says
  the interrupt fires "8 cycles before the character window" and that a 25-row display is
  visible on lines 4-203 (DS p.14).
- `$FF1C` b0 and `$FF1D` hold the current line (0-261 / 0-311) and are **writable** (DS p.18).
  Writing them moves the frame: CLK `write<0xff1c|0xff1d>`; MAME also re-checks the DMA reset
  and the raster IRQ (`check_dma_reset`, `check_raster_irq`). Demos use this for FLI and
  vertical tricks.
- `$FF1E` is the horizontal position bits 8-1 (0-227). It reads true and is written
  **inverted** ("negative true data is to be written", DS p.18). CLK: `(~value << 1)`. MAME:
  `((~data & 0xfc) >> 1)` into its half-cycle column.
- `$FF1A` b1-0 and `$FF1B` hold the character position reload, which advances by 40 per row
  (DS p.17-18). `$FF1F` b2-0 is the vertical sub-address (row within the character).
- The datasheet warns that writes to registers 26-31 can cause screen flicker (DS p.18).

### §2.6 The 121-colour palette

- 16 colours x 8 luminances. Colour 0 is black at every luminance, so there are
  15 x 8 + 1 = 121 distinct colours. Colour and luminance registers: b3-0 colour, b6-4
  luminance (DS p.16-17; [Wikipedia, MOS Technology TED](https://en.wikipedia.org/wiki/MOS_Technology_TED)).
- Wikipedia gives the chroma as Pb/Pr steps of 0, ±0.3826834, ±0.7071068 and ±1.0 (that is,
  sin/cos of multiples of 22.5°) and 8 luma values from 0.125 to 1.0. Some combinations fall
  outside the RGB gamut. It cites YAPE's source for the colour values.
- Measured palettes: VICE ships `colodore_ted.vpl`, `yape-ntsc.vpl` and ITU-R variants in
  `vice/data/PLUS4/` (GitHub `VICE-Team/svn-mirror`). MAME's `PALETTE_PAL/NTSC` say they were
  "measured from VICE's default internal palettes". CLK's chrominances are "eyeballed".
  *Inference:* Klive must compute its own palette from the luma/chroma model and check it by
  eye; none of the permissive tables is free of VICE-derived data.

### §2.7 Timers

- Three 16-bit down counters, each written as two bytes. Writing the low byte stops the timer
  and writing the high byte starts it (DS p.13; CLK `Timers::write`, `paused_`; MAME
  `m_t1_run`/`m_t2_run`/`m_t3_run`).
- **Timer 1** (`$FF00/01`) reloads: the written value is also the reload value, and counting
  restarts from it after 0. **Timers 2 and 3** (`$FF02-05`) run free: after 0 they wrap to
  `$FFFF` and keep counting, and writes load the live counter. Each raises its interrupt on
  reaching 0 (DS p.13).
- **Rate:** the single-clock rate (886,724 Hz PAL / 894,886 Hz NTSC) whatever the CPU speed.
  The datasheet gives "894 KHZ ... NTSC, 884 KHZ for PAL" (p.13); 884 is wrong against the
  clocks (§1.3). CLK `timer_cycle_length` = 20 (PAL) or 16 (NTSC) input-clock ticks. MAME
  decrements T1 in the even half-cycle and T2/T3 in the odd half-cycle of each 8-dot pair. The
  VICE TAP notes also say the TED timers always run at the slow rate.
- **Quirk:** MAME delays timer 2's start by a half-cycle when its high byte is written in an odd
  half-cycle (`EV_T2_START`). FPGATED 1.7 (2025-11-08) records "Timer2 bug fixed. False Idols
  demo works perfectly now!".
- The datasheet advises: disable interrupts, write low, write high, enable, and avoid more than
  125 µs between the two writes (DS p.13).

### §2.8 Interrupts

- `$FF09` flags: b1 raster, b2 light pen (no light pen in the TED computers; the bit is "for
  future expansion"), b3 timer 1, b4 timer 2, b6 timer 3, b7 = any enabled flag set (the
  inverse of the IRQ pin). Writing 1 to a bit clears that flag (DS p.14).
- `$FF0A` is the mask register with the same bit positions; b0 is raster compare bit 8 (DS p.14).
- Reads: MAME returns `$FF09` as `(flags & 0x7f) | 0x25`, with b7 set when
  `flags & mask & 0x5e`, and `$FF0A` as `| 0xa0` (`reg_r`). CLK uses `| 0x25` for `$FF09`.
  The IRQ pin is open-drain (DS p.22).

### §2.9 Sound

- Two voices. Voice 1 is a square wave. Voice 2 is a square wave or white noise. Each has a
  10-bit frequency: voice 1 is `$FF0E` plus `$FF12` b1-0, voice 2 is `$FF0F` plus `$FF10` b1-0
  (DS p.8, p.15).
- `$FF11`: b3-0 volume, 0 (off) to 8; 9-15 act as 8. b4 voice 1 on, b5 voice 2 square, b6
  voice 2 noise. Voice 2 square overrides noise if both are set. b7 is "used for testing": the
  "sound reload" bit, which clears the voice flip-flops, makes each voice reload its value, and
  initialises the noise generator to all ones (DS p.8-9, p.15).
- **Frequency (DS p.9):** f = 111860.781 / (1024 − x) Hz for NTSC and 110840.45 / (1024 − x) Hz
  for PAL. Those constants are the dot clock / 64. So the voice counters step at dot / 32
  (221,681 Hz PAL; 223,722 Hz NTSC) and flip every (1024 − x) steps (*inference* from the
  arithmetic; it agrees with MAME's stream rate of `clock()/80` on PAL).
- **Emulator models:**
  - MAME `sound_stream_update`: a 10-bit accumulator that reloads `x + 1` and flips the output
    at `$400`. `x = $3FF` stops the oscillator. `x = $3FE` forces the output high on write. An
    8-bit noise LFSR steps when voice 2 flips, feeding back bits 7, 5, 4 and 1 combined by XOR.
    With `$FF11` b7 set the output is a fixed level per volume (digi playback).
  - CLK `Audio::apply_samples`: increments counters to `$3FF` and reloads `frequency + 1`; the
    noise uses the same taps but combines them by XNOR, and steps on a fixed sub-cycle rather
    than when voice 2 flips. Its volume is pulse-width modulated over 32 steps:
    `pwm_count < volume`.
  - These disagree on the noise feedback polarity and clocking, and on whether the test bit
    reseeds the noise (§10).
- MAME's level table `TED_SOUND_LEVEL` (64 entries by volume and voice bits) is its own
  measurement-style data and is non-linear. Mixing two voices is not a simple sum.
- **Digi playback:** software plays samples by holding `$FF11` b7 (or frequency `$3FF`/`$3FE`)
  and writing the volume. *Inference* from MAME's `DIGITAL_ON` path and the FPGATED 1.4 note
  "Adding 16bit digital audio output for PCM".

### §2.10 Keyboard latch ($FF08)

- The TED's K0-K7 pins (DS p.19, pins 15-22) have internal pull-ups and read the keyboard rows.
  Per the datasheet, writing `$FF08` latches the pins and reading returns the latched value
  (DS p.14, p.21).
- **Machine wiring:** the KERNAL writes the column select to the 6529 at `$FD30` (keyboard
  "SPI"), then writes `$FF08`. The data written to `$FF08` also selects the joysticks: data bit 2
  = 0 puts joystick 1 on K0-K3 with fire on K6, data bit 1 = 0 puts joystick 2 on K0-K3 with
  fire on K7 (MAME `plus4_state::ted_k_r(offset)`, where `offset` is the data written; CLK
  `case 0xff08` combines `keyboard_mask_` from `$FD30` with `joystick_mask_`).
- **Latch behaviour on hardware (2005):** a program that reads `$FF08` without writing it first
  was investigated. Gaia concluded on hardware that the latch happens on write and holds until
  the next write, even if `$FD30` changes. TLC reported that some damaged TEDs read the live
  pins instead, from electrical shock through joystick wiring, not a revision difference
  ([plus4world forum 9269](https://plus4world.com/forum/9269)).
- **KERNAL scan pattern:** the IRQ writes `$00` to `$FD30` to check for any key and does a full
  scan only if one is down. The usual frame sequence is `$7F`/`$7F`/`$00`, with a longer one
  every fifth frame (Gaia, same thread). CLK uses the write of 0 to `$FF08` as its typing hook
  ("the kernel posts a 0 to this address upon completing each keyboard scan cycle").
- Two K pins are test inputs: driving K0 to 10 V freezes the horizontal counter, and K1 forces
  NTSC division (DS p.21). Not emulated.

### §2.11 Register map summary ($FF00-$FF3F)

| Reg | Use | Read mask (MAME `reg_r`) |
|---|---|---|
| `$FF00-05` | timers 1-3 | |
| `$FF06` | b7 test, b6 ECM, b5 BMM, b4 display enable, b3 25 rows, b2-0 Y scroll | |
| `$FF07` | b7 reverse off (256 chars), b6 NTSC, b5 freeze, b4 MCM, b3 40 columns, b2-0 X scroll | |
| `$FF08` | keyboard latch | |
| `$FF09` / `$FF0A` | IRQ flags / mask, plus raster b8 | `|0x25` / `|0xA0` |
| `$FF0B` | raster compare low | |
| `$FF0C/0D` | cursor position | `$FF0C |0xFC` |
| `$FF0E/0F/10` | voice frequencies | `$FF10` reads `(v|0x7C)&0x7F` |
| `$FF11` | sound control | |
| `$FF12` | b5-3 bitmap base, b2 ROM fetch, b1-0 voice 1 high | `|0xC0` |
| `$FF13` | b7-2 character base, b1 force single clock, b0 ROM status (read only) | b0 = ROM paged in |
| `$FF14` | b7-3 video matrix base | `|0x07` |
| `$FF15-19` | background 0-3, border | b7 reads 1 |
| `$FF1A/1B` | character position reload | |
| `$FF1C/1D` | raster line | `$FF1C |0xFE` |
| `$FF1E` | horizontal position (write inverted) | |
| `$FF1F` | b6-3 flash counter, b2-0 vertical sub-address | b7 reads 1 |
| `$FF3E` / `$FF3F` | write: ROM on / RAM on (not real registers) | |

Sources: DS p.13-18; CLK `Video::read/write`, `Plus4.cpp`; MAME `mos7360_device::reg_r/write`.

### §2.12 Quirks that emulators model (cycle-exact effects)

1. **Register write timing:** `$FF06`/`$FF07` changes take effect at a single-cycle boundary and
   are delayed if written at a double-cycle end (FPGATED 1.6.2, 2025-10-29). MAME queues mode,
   scroll and colour changes as even/odd half-cycle events (`EV_VSCROLL`, `EV_HSCROLL`,
   `EV_SELECT_RENDER`, `EV_COLOR`).
2. **Colour register writes:** MAME first latches `$FF` into a colour slot and applies the real
   value as an event in the next half-cycle (`write`, cases `0x15-0x19`). That models a short
   glitch on mid-line colour writes (*inference* about the hardware behind it).
3. **Timer 2 start delay** (§2.7).
4. **`$FF1E` writes** shift the line length; FPGATED 0.3 fixed an "FF1E write bug in New FLI".
5. **`$FF1C/$FF1D` writes** and the DMA position counter reset. FPGATED 1.8 moved the video
   counter reset from line 311 to line 205 ("TED Vibes demos works now"). MAME clears
   `m_dma_pos_reload` at line 205 in `EV_STOP_INC_DMA`.
6. **Character position reload `$FF1A/$FF1B`:** FPGATED 1.9 (2026-08-25) rebuilds the reload
   from two write latches and gives a write in the same cycle as the row latch priority, which
   fixes the Rocket Science letter effect.
7. **X/Y scroll timing:** FPGATED 1.8.1 reverted a change to fix the "A trip" demo.
8. **Test mode (`$FF06` b7):** FPGATED 1.6 disabled it "to improve compatibility". The datasheet
   says it must stay 0.
9. **Freeze (`$FF07` b5):** stops the horizontal, vertical and timer counters and forces single
   clock and refresh (DS p.14). MAME `m_frozen`.
10. **Side border:** FPGATED 1.9's notes say mid-line 38/40-column changes can skip the side
    border reset and open the border.
11. **Two DMA lines per character row** with a 3-cycle BA lead (§2.4). FPGATED 1.3 "DMA delay
    fix ... Alpharay".
12. MAME's rewrite promoted "Hidden Wonders" and "Return to Promised Land" to working
    (commit 2026-10-12). Those, the FPGATED demo list (Invincible, Majesty of Sprites, MMS FLI,
    Alpharay, False Idols, TED Vibes, Rocket Science, A trip) and Diag264 make a regression set.

---

## §3 Memory map

### §3.1 CPU map (ROM selected)

| Range | Contents |
|---|---|
| `$0000/$0001` | 7501/8501 on-chip port: DDR and data (§4.2) |
| `$0002-$7FFF` | RAM |
| `$8000-$BFFF` | low ROM bank (`$FDD0` bits 1-0): 0 BASIC, 1 function low (3-plus-1), 2 cartridge C1 low, 3 cartridge C2 low |
| `$C000-$FBFF` | high ROM bank (`$FDD0` bits 3-2): 0 KERNAL, 1 function high, 2 C1 high, 3 C2 high |
| `$FC00-$FCFF` | always the KERNAL's page (banking routines) |
| `$FD00-$FF3F` | I/O (§3.3) |
| `$FF40-$FFFF` | high ROM bank (vectors) |

- With RAM selected (a write to `$FF3F`), `$8000-$FFFF` is RAM except `$FD00-$FF3F`. A write to
  `$FF3E` selects ROM again (DS p.18: "excluding $FD00 to $F3FF" is a typo for `$FF3F`).
  `$FF13` b0 reads which one is selected (DS p.16).
- Sources: MAME `plus4.cpp` (`plus4_mem`; `install_hi_rom` maps the bank at `$C000-$FBFF` and
  `$FF20-$FFFF` and always the KERNAL at `$FC00-$FCFF`; `update_banks`: lo = `m_addr & 3`,
  hi = `(m_addr >> 2) & 3`; `addr_w` latches `offset & 0x0f` on any write to `$FDD0-$FDDF`);
  [plus4world kb 500271](https://plus4world.com/kb.php?id=500271) (`$FC00-$FCFF` unpaged;
  `$FDD0` = BASIC/KERNAL, `$FDD5` = 3-plus-1).
- CLK does **not** implement `$FDD0` banking (a "TODO: set up ROMs") or the function ROMs. It
  pages only BASIC and KERNAL.

### §3.2 RAM size and mirroring

- C16/C116: 16K, mirrored four times over 64K. C232: 32K, mirrored twice. Plus/4: 64K (MAME
  `map(0x0000, RamSize-1).mirror(0xffff & ~(RamSize-1))`; the TED's view is mirrored the same
  way, `ted_videoram_map`).
- *Inference:* because of the mirroring, the C16 KERNAL's RAM test finds the top at `$4000`, and
  programs that write above 16K corrupt low memory. The C16 is often upgraded to 64K.
- Default layout: attributes `$0800-$0BFF`, screen `$0C00-$0FFF`, BASIC from `$1001`, cassette
  buffer `$0333-$03F2` ([zimmers Plus/4 memory map](https://mirrors.archeobits.com/commodore/www.zimmers.net/anonftp/pub/cbm/maps/plus4.MemoryMap.txt)).
  The C16 starts with 12277 bytes free and the Plus/4 with 60671 (well known; **unverified** in
  a primary source here).

### §3.3 I/O area ($FD00-$FF3F)

| Range | Device | Models |
|---|---|---|
| `$FD00-$FD0F` | 6551 ACIA (RS-232), 4 registers mirrored | Plus/4 |
| `$FD10-$FD1F` | 6529 user port; bit 2 also reads cassette sense | Plus/4 (C16: sense only) |
| `$FD20-$FD2F` | MOS 8706 speech | V364 |
| `$FD30-$FD3F` | 6529 keyboard column latch | all |
| `$FD40-$FD5F` | SIDcard (third party; also mirrored at `$FE80`) | add-on |
| `$FDD0-$FDDF` | ROM bank latch (write; the address bits are the data) | all (pointless without ROMs) |
| `$FEC0-$FEFF` | 1551 TCBM interfaces (§4.4) | with 1551 |
| `$FF00-$FF3F` | TED | all |

- Unconnected reads in the I/O area and in empty ROM banks return the TED's floating bus,
  `m_bus` (MAME `bus_r` is used for unmapped I/O and for an absent ACIA, 6529 or cartridge).
  VICE testprogs `Plus4/openbus/`: "There is definitively garbage data on the bus if I read from
  an unconnected area", measured on a 64K C16. There are also `openio/` and `openmem/` tests.
- *Inference:* the address decoding is the PLA 251641-02. MAME loads its dump (CRC `328538af`)
  but its behaviour was not read here.

---

## §4 Peripherals

### §4.1 Tape (1531 Datassette)

- The 1531 uses a mini-DIN connector, not the C2N edge connector.
- **Wiring (CPU port):** b1 = cassette write (shared with IEC CLK out), b3 = motor, b4 =
  cassette read. Sense is on `$FD10` b2 (MAME `cpu_w`, `cpu_r`, `user_r`; CLK `Plus4.cpp`, the
  port comment and `case 0xfd10`). The motor polarity disagrees: CLK notes "1 = off", MAME
  passes `BIT(data,3)` to `motor_w` (§10).
- **Read** is polled through the port bit. There is no edge interrupt as on the VIC-20 (VIA CA1)
  or the C64 (CIA FLAG). The KERNAL tape format differs from the C64's (*inference* from the
  different hardware and timing; OQ6).
- **TAP:** VICE TAP version 2 with signature `C16-TAPE-RAW`, platform byte 2 at `$0D`. Values
  are **half-waves** starting with a 0->1 transition, in cycles of 886724 Hz (PAL) or 894886 Hz
  (NTSC), the TED timer rate. To play back, drive cassette read low for half of each pulse and
  high for the other; to record, count from each 0->1 transition on port bit `$02`
  ([VICE manual §17](https://vice-emu.sourceforge.io/vice_17.html)).
- CLK traps the ROM at `$F0F0` (`TapeHandler::ROMTrapAddress`) for fast loading and uses
  header buffer `$0333`. These are observed landmarks; Klive should find its own by running
  the ROM.

### §4.2 The CPU port and the IEC serial bus

- 7501/8501 port at `$00` (DDR) and `$01`: b0 DATA out, b1 CLK out (and cassette write), b2 ATN
  out, b3 cassette motor, b4 cassette read, b6 CLK in, b7 DATA in. CLK's comment marks b5
  "unconnected". The outputs are inverted onto the bus: a 1 pulls the line low (MAME `cpu_w`:
  `host_data_w(!BIT(data,0))` and so on; CLK `LineLevel(~output & 0x01)`).
- MAME reads unused input bits as `0x2F` on the Plus/4 and 0 on the C16 (`plus4_state::cpu_r`
  against `c16_state::cpu_r`). Whether that is a real difference is unclear (OQ7).
- The bus protocol and the 1541 are in `DRIVE_1541.md`. The TED machines run the IEC at the
  KERNAL's bit-bang speed. A 1541 must be clocked at 1 MHz against a host whose CPU cycle length
  changes every few cycles (CLK `c1541_cycles_ += length * 1'000'000`, divided by
  `media_divider_`).

### §4.3 Joysticks

- Two 8-pin mini-DIN ports, read through the TED K lines (§2.10). The SIDcard adds a C64-style
  DB9 port with paddles; sources disagree on its address (`$FD5F` or `$FD80`)
  ([plus4world forum results](https://plus4world.powweb.com/forum/20130)).

### §4.4 The 1551 parallel drive (note only)

- The 1551 connects through a cartridge-port interface holding a 6523 TIA (tri-port
  interface). The computer sees six registers at `$FEF0` (device 8) or `$FEC0` (device 9)
  ([c64-wiki, 1551 interface](https://www.c64-wiki.com/wiki/Commodore_1551_cartridge_interface)).
  pagetable.com says the PLA maps the TIA at `$FEC0` or `$FEE0`
  ([pagetable p=1331](https://www.pagetable.com/?p=1331); see §10). Inside the drive, its own
  6523 is at `$4000-$4007`.
- The protocol is TCBM, a parallel byte bus. VICE has a `Plus4/tcbm/` test. MAME models the
  1551 as an expansion card (`PLUS4_EXPANSION_SLOT ... "c1551"`). The 1551's CPU is a 6510T at
  2 MHz. **Unverified**; out of scope.

### §4.5 SIDcard

- A third-party card (Solder) with an 8580 SID at `$FD40` and a mirror at `$FE80` for
  compatibility with older prototypes ([plus4world forum results](https://plus4world.powweb.com/forum/20130)).
  MiSTer's C16 core includes it (`rtl/sid_card.v`). It would reuse the C64's SID core.

---

## §5 ROMs

### §5.1 Images (CRC32 / SHA-1 as recorded in MAME `plus4.cpp`, BSD-3)

| ROM | Size | Used in | CRC32 | SHA-1 |
|---|---|---|---|---|
| BASIC 3.5 318006-01 | 16K | all production models | `74eaae87` | `161c96b4ad20f3a4f2321808e37a5ded26a135dd` |
| KERNAL 318004-03 (PAL r3) | 16K | c16p, c116, plus4p | `77bab934` | `97814dab9d757fe5a3a61d357a9a81da588a9783` |
| KERNAL 318004-04 (PAL r4) | 16K | " | `be54ed79` | `514ad3c29d01a2c0a3b143d9c1d4143b1912b793` |
| KERNAL 318004-05 (PAL r5) | 16K | " | `71c07bd4` | `7c7e07f016391174a557e790c4ef1cbe33512cdb` |
| KERNAL 318005-04 (NTSC r4) | 16K | c16, plus4 | `799a633d` | `5df52c693387c0e2b5d682613a3b5a65477311cf` |
| KERNAL 318005-05 (NTSC r5) | 16K | " | `70295038` | `a3d9e5be091b98de39a046ab167fb7632d053682` |
| KERNAL 318030-02 (Hungary r2) | 16K | c16_hu | `775f60c5` | `20cf3c4bf6c54ef09799af41887218933f2e27ee` |
| KERNAL 318004-01 | 16K | C232 prototype | `dbdc3319` | `3c77caf72914c1c0a0875b3a7f6935cd30c54201` |
| 3-plus-1 317053-01 (function low) | 16K | Plus/4 | `4fd1d8cb` | `3b69f6e7cb4c18bb08e203fb18b7dabfa853390f` |
| 3-plus-1 317054-01 (function high) | 16K | Plus/4 | `109de2fc` | `0ad7ac2db7da692d972e586ca0dfd747d82c7693` |
| PLA 251641-02 | 0xF5 | all | `328538af` | `ccda76572e6c164c31454c8ce083e161e1ddfe0a` |

- PAL is 318004, NTSC is 318005. The C16 and the Plus/4 use the same KERNAL ROMs (MAME uses the
  same images for c16/plus4 and c16p/plus4p). The 318030-01 Hungarian r1 has not been dumped.
  MAME also lists the 264 prototype ROMs, a V364 KERNAL, JiffyDOS and Diag264 KERNALs.
- VICE ships `basic-318006-01.bin`, `kernal-318004-05.bin`, `kernal-318005-05.bin`,
  `kernal-318004-01.bin`, `kernal-364.bin` and the two 3-plus-1 images (`vice/data/PLUS4/`).
- *Inference:* the character set is inside the KERNAL ROM (the TED fetches it from ROM with
  `$FF12` b2; there is no separate character ROM in MAME or CLK).
- The checksums were not recomputed here, and how ROMs are obtained is a plan decision (OQ8).

### §5.2 Cartridges and function ROMs

- A ROM bank at `$8000` has `JMP cold` at `$8000`, `JMP warm` at `$8003`, a module number at
  `$8006` (0 = ignore, 1 = autostart, more than 1 = cold start only) and "CBM" at `$8007-$8009`.
  At reset the KERNAL's poll routine (in the unpaged `$FC00` page) tries `$FDD0` values `$0F`,
  `$0A`, `$05`, `$00` and records the found modules in its PAT table
  ([plus4world kb 500271](https://plus4world.com/kb.php?id=500271)). The zimmers map lists
  CURBNK at `$FB` and the PAT/banking area at `$05EC-$06E8`.
- **Cartridge files:** VICE `.crt` with signature `"PLUS4 CARTRIDGE "` (CRT v2.0)
  ([VICE manual §17.14](https://vice-emu.sourceforge.io/vice_17.html)). Raw `.bin` images for
  C1/C2 low and high (MiSTer: "Cartridge support (*.BIN) for Plus/4 model"). VICE's Plus/4
  hardware type IDs were not found in the text read (OQ9).

### §5.3 Reset landmarks, typing and loading

- Klive should find its landmarks (end of reset, "READY.", the key wait) by running the ROMs.
  Two observed hooks from other emulators: CLK's typer advances on each write of 0 to `$FF08`
  (end of a KERNAL scan), and CLK's tape trap is at `$F0F0`.
- **Keyboard buffer:** KEYD `$0527-$0530` (10 bytes), count NDX `$EF`
  ([zimmers Plus/4 map](https://mirrors.archeobits.com/commodore/www.zimmers.net/anonftp/pub/cbm/maps/plus4.MemoryMap.txt)).
- **BASIC pointers:** TXTTAB `$2B/$2C`, VARTAB `$2D/$2E`, ARYTAB `$2F/$30`, STREND `$31/$32`,
  MEMSIZ `$37/$38` (same map). The load/save start is `$B2/$B3` and the end `$9D/$9E`.
- **Program loading:** BASIC PRGs load at `$1001` on every model. To inject one, write it at
  `$1001`, set VARTAB, ARYTAB and STREND to the end, then type RUN through the keyboard buffer
  (*inference*, the same pattern as the VIC-20 and C64). BASIC 3.5 may keep more pointers (for
  example the graphics area moves BASIC to `$4001` after `GRAPHIC`); confirm by running (OQ10).

---

## §6 Implementations and licences (checked 2026-11-23)

### §6.1 MAME (BSD-3-Clause per file) - the strongest permissive reference

- `mos7360.cpp|.h` and `plus4.cpp` carry `license:BSD-3-Clause`, copyright Curt Coder.
- **2026-10-12:** "Rewrite the TED as a cycle-exact state machine". This promoted Hidden Wonders
  and Return to Promised Land to working, and carries "AI disclosure: assisted by Claude Opus
  5.5". **2026-10-15:** bulk border/blank rendering, 13% faster. **2026-09-24:** expansion cards
  mapped directly into the CPU and TED spaces. **2026-04-26:** cassette loading fixed. Diag264
  KERNALs were added 2026-04-27 (GitHub commit history).
- It covers: per-half-cycle events (refresh, DMA 1-5 and abort, single-clock windows, character
  position latches, flash, video counter reset), BA predicted as a timer, the floating bus,
  every register quirk listed in §2.12, `$FDD0` banking, all models and RAM sizes, the ACIA,
  6529s, 1551 and speech. This is the most complete permissive model found.
- **Provenance caution:** its palettes are "measured from VICE's default internal palettes".
  Do not reuse them.

### §6.2 Clock Signal Plus/4 (MIT) - exists, partial

- `Machines/Commodore/Plus4/`, licence MIT. The first files date from 2024-12-07 (`Video.hpp`
  "Created by Thomas Harte on 10/12/2024"); there are more than 100 commits, the latest on
  2026-05-28 ("Add reset."). So it is recent and active.
- **What it has:** the TED horizontal event table and DMA THALT states, the CPU cycle length
  switching between single and double clock, timers, sound, the keyboard and joystick latch, the
  IEC with a 1541, and a fast tape trap.
- **What it lacks:** `$FDD0` banking and 3-plus-1 ROMs (TODO), C16/C116 RAM sizes and
  mirroring, an NTSC KERNAL choice (the target has `// TODO: region`), the ACIA, user port and
  open bus. Its colours are "eyeballed". Its timers step one at a time ("Quick hack"). Its
  timing names follow FPGATED (GPL-3); *inference:* the numbers themselves match the datasheet
  table and so are datasheet facts.
- *Assessment:* a usable, readable second reference for the video timing, but behind MAME's
  October 2026 rewrite on every detail checked.

### §6.3 Others

- **VICE xplus4** (GPL-2): facts and an oracle only. `vice/data/PLUS4/` holds ROMs and palettes.
- **YAPE / yapesdl** by Attila Grosz (Gaia), `calmopyrin/yapesdl`, **GPL-2** (the GitHub API
  and `tedmem.cpp` header "(c) 2000 ... 2015-2026 Attila Grósz"). It also emulates the VIC-20
  and C64. Facts only.
- **plus4emu** by István Varga, `istvan-v/plus4emu`, **GPL-2**. Facts and oracle only.
- **FPGATED** (Istvan Hegedus), **GPL-3**, v1.9 (2026-08-25), a cycle-exact 8360 in Verilog. Its
  revision log is a useful map of the hard cases (§2.12). It says the 1.8.2-1.8.4 fixes were
  found "using emulator behaviour (plus4emu, yapesdl) and AI-assisted analysis".
- **MiSTer `C16_MiSTer`** (Sorgelig): GPL-3 (`gpl-3.0.txt`; the GitHub API shows no licence).
  The TED is FPGATED, and it offers C16 (64K) and Plus/4, SIDcard, `.BIN` cartridges and D64.
  Facts only.
- **floooh/chips:** no TED (its `chips/` folder has m6561, m6569, m6581, m6522, m6526 only).

### §6.4 Test programs

- VICE testprogs (`https://svn.code.sf.net/p/vice-emu/code/testprogs/`): `Plus4/HannesTest`,
  `Plus4/openbus`, `Plus4/openio`, `Plus4/openmem`, `Plus4/tcbm`, `TED/write-scanline-coarse`,
  and `testbench/xplus4-testlist.txt` / `plus4-testlist.in`. Licences are per program (OQ11).
- **Diag264** diagnostic KERNAL/cartridge (MAME has v0.97 PAL and NTSC).
- The demo set in §2.12.
- No dedicated TED timing test suite by Gaia was found in this pass (OQ11).

---

## §7 Things that bear on architecture (*inference* from the above)

1. **Variable CPU cycle length.** The CPU clock changes between 886/894 kHz and 1.77/1.79 MHz
   inside a line, and the TED halts the CPU through BA/RDY for DMA. The core should run on a
   master step of a TED half-cycle (4 dots), where a CPU cycle takes 1 or 2 steps. Timers and
   sound tick on single-clock and dot/32 boundaries, never on CPU cycles. The shared Z80 debug
   loop's "T-states" become dot-based time, and the debugger's cycle counter must say which it
   counts.
2. **RDY semantics:** BA goes low 3 single cycles before DMA because the 6502 core halts only on
   reads. The 7501/8501 core must implement RDY like the C64's 6510 (`CPU_6502_FAMILY.md`). One
   implementation should serve both.
3. **Memory banking is three-layered:** `$FF3E/$FF3F` (ROM or RAM), the `$FDD0` 4x4 bank latch,
   and the fixed `$FC00` page. The TED has its own view (RAM or ROM by `$FF12` b2, the same bank
   latch). This suits a page table with separate CPU and video maps, as MAME and CLK both do.
4. **Model profile:** RAM size (16/32/64K, mirrored), PAL/NTSC (which also needs `$FF07` b6
   written by the ROM), KERNAL revision, the presence of 3-plus-1, ACIA and user port, and
   cartridges. *Inference:* the Next model profiles are a good pattern.
5. **The TED's `$FF07` b6 can switch PAL/NTSC timing at run time** (MAME `set_ntsc`). The line
   count follows the register, not the crystal. The crystal only sets the absolute clock.
6. **Shared IEC/1541 with a non-integer clock ratio**, as on the VIC-20, made harder by the
   changing CPU cycle length. Schedule the drive against absolute (dot) time.
7. **Tape** needs half-wave TAP v2 support and a polled input bit, unlike the VIC-20/C64 edge
   interrupt.

---

## §8 Disagreements between sources

1. **Single-clock and refresh windows:** the datasheet narrative says 304-344 for refresh; its
   table reads 288-328; CLK and MAME use 296-336. All agree the window is 40 dots (5 cycles).
2. **PAL timer rate:** the datasheet says 884 kHz; the clocks give 886.72 kHz (DS p.19 itself
   says 886.7 kHz for φout). Its PAL double clock "1.768MHZ" (p.13) is likewise inexact against
   1.7734 MHz.
3. **Multicolour bitmap pair 10 luminance:** the datasheet table prints "attribute, bits 4-6"
   for both 01 and 10. The hires rule (1 bits use attribute b2-0) and CLK/MAME suggest 10 uses
   b2-0. The scan is ambiguous (OQ2).
4. **`$FF08` latch:** the datasheet says it latches on write. A 2005 investigation briefly
   changed VICE to latch on read, then concluded on hardware that it latches on write. Damaged
   TEDs read the live lines. MAME latches on write (`m_reg[0x08] = m_read_k(data)`).
5. **Noise generator:** MAME XORs taps 7, 5, 4, 1 and steps when voice 2 flips, with a seed of
   `$FF`. CLK XNORs the same taps, steps on a fixed sub-cycle and clears the seed to 0 on the
   test bit. The datasheet says the test bit initialises the noise to all ones.
6. **Cassette motor polarity** on port bit 3: CLK "1 = off"; MAME passes the bit straight to the
   motor line (whose polarity the Datassette port device defines).
7. **1551 interface addresses:** `$FEF0`/`$FEC0` (c64-wiki, plus4world) against `$FEC0`/`$FEE0`
   (pagetable.com). *Inference:* a decoded range against the registers actually used.
8. **SIDcard joystick port:** `$FD5F` against `$FD80` (forum posts).
9. **TED revisions:** "presumably 3 revisions" (plus4world) against marks R0, R1, R2 and ceramic
   R6/R7 (plus4world photos). The numbering schemes of 7360 and 8360 differ.

---

## §9 Open questions

- **OQ1** Any software-visible difference between TED revisions (7360R6/R7, 8360R1/R2) or
  between 7501 and 8501.
- **OQ2** The exact luminance source for multicolour bitmap pair 10, and the 38-column window
  edges. Check against MAME `render` and a hardware screenshot.
- **OQ3** CPU cycles per frame for each display mode, including DMA lines: compute from the
  MAME model and check against a timing test (VICE `TED/write-scanline-coarse`).
- **OQ4** The light pen IRQ bit (b2) and the `$FF09` read value on real hardware (`0x25`
  forced bits).
- **OQ5** Behaviour of `$FF07` b6 (NTSC) on a PAL machine and the reverse: line count, and
  what happens to sound and timers (which follow the input clock).
- **OQ6** The C16/Plus/4 KERNAL tape pulse widths and format compared with the C64's, and
  turbo-loader conventions (for TAP v2 support).
- **OQ7** Port input bits that are not connected on the 7501/8501: `0x2F` on the Plus/4 against
  0 on the C16 in MAME. Is bit 5 missing on the die?
- **OQ8** Recompute ROM CRC/SHA-1 from good images. Decide how ROMs are obtained and whether any
  may be bundled.
- **OQ9** VICE `.crt` hardware type IDs for Plus/4 cartridges and the CHIP bank mapping to C1/C2
  low and high.
- **OQ10** Which BASIC 3.5 pointers must be fixed after injecting a PRG (graphics area,
  `$1001` against `$4001`).
- **OQ11** Licences of the VICE Plus/4 and TED test programs and of Diag264. Locate any public
  TED timing suites by Gaia (YAPE) or the plus4emu author.
- **OQ12** Whether the 6529 at `$FD30` exists on the C116 (MAME treats all models alike) and how
  the C16 decodes `$FD10`.

---

## §10 Reference documents

- MOS TED 7360R0 datasheet (1983-04-19), scan by Karls Technology:
  <https://www.karlstechnology.com/commodore/TED7360-datasheet.pdf>
- Wikipedia, MOS Technology TED: <https://en.wikipedia.org/wiki/MOS_Technology_TED>
- "Talking to TED" (C=Hacking #12): <http://mclauchlan.site.net.au/scott/C=Hacking/C-Hacking12/gfx.html>
  (listed on Wikipedia; not read in this pass)
- Commodore Plus/4 hardware manual: <http://www.zimmers.net/anonftp/pub/cbm/plus4/programming/manual/manual.html>
  (not read in this pass)
- Plus/4 memory map (zimmers mirror):
  <https://mirrors.archeobits.com/commodore/www.zimmers.net/anonftp/pub/cbm/maps/plus4.MemoryMap.txt>
- plus4world: MOS 7360/8360 <https://plus4world.com/hardware/MOS_7360_8360>, MOS 7501/8501
  <https://plus4world.com/hardware/MOS_75018501>, ROM banking and autostart
  <https://plus4world.com/kb.php?id=500271>, `$FF08` latch thread <https://plus4world.com/forum/9269>
- U.S. Patent 4,569,019 (TED concept): <https://patentimages.storage.googleapis.com/pdfs/US4569019.pdf>
- VICE manual §17 (TAP v2, CRT): <https://vice-emu.sourceforge.io/vice_17.html>
- VICE testprogs: <https://svn.code.sf.net/p/vice-emu/code/testprogs/Plus4/>, `.../TED/`
- c64-wiki, 1551 cartridge interface: <https://www.c64-wiki.com/wiki/Commodore_1551_cartridge_interface>
- pagetable.com on the 1551: <https://www.pagetable.com/?p=1331>
- FPGATED: <https://hackaday.io/project/11460-fpgated> (GPL-3); in MiSTer `C16_MiSTer/rtl/ted.v`
- MAME: <https://github.com/mamedev/mame> (`mos7360.*`, `plus4.cpp`, BSD-3)
- Clock Signal: <https://github.com/TomHarte/CLK> (`Machines/Commodore/Plus4`, MIT)
- YAPE: <https://github.com/calmopyrin/yapesdl> (GPL-2); plus4emu <https://github.com/istvan-v/plus4emu> (GPL-2)
