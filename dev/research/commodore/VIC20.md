# Commodore VIC-20 (VC-20, VIC-1001) - research notes

Research pack for the Commodore plan. Facts, not a plan. Compiled 2026-11-23.

Conventions:

- Every fact carries a source: a URL, or an emulator file and function. Emulator code was read
  for facts only; nothing here is copied from it.
- *Inference* marks something concluded rather than read. **Unverified** marks a commonly
  repeated value this pass could not confirm against a primary source.
- The 6502 itself is in `CPU_6502_FAMILY.md`. The 6522 VIA, the IEC serial bus and the
  1540/1541 drive are in `DRIVE_1541.md`. This file records only what is specific to the VIC-20.
- Short names for sources used below:
  - **CLK** is Clock Signal, `TomHarte/CLK` (MIT): `Components/6560/6560.hpp|.cpp` and
    `Machines/Commodore/Vic-20/Vic20.cpp`. Read at the 2026-11-23 head.
  - **MAME** is `mamedev/mame` (BSD-3-Clause, per-file header, Curt Coder):
    `src/devices/sound/mos6560.cpp|.h` and `src/mame/commodore/vic20.cpp`.
  - **chips** is `floooh/chips` (zlib): `chips/m6561.h` and `systems/vic20.h`.
  - **VICE testprogs** is `https://svn.code.sf.net/p/vice-emu/code/testprogs/VIC20/`.

---

## §1 Models

### §1.1 Machines

| Model | Market | Video chip | Notes |
|---|---|---|---|
| VIC-1001 | Japan, 1980 | 6560 (NTSC) | Japanese KERNAL 901486-02 and character ROM 901460-02 with katakana (MAME `vic20.cpp`, `ROM_START(vic1001)`). VGMPF reports a 6560 dated week 44/1980 on a VIC-1001 board ([vgmpf 6560](https://www.vgmpf.com/Wiki/index.php?title=6560)). |
| VIC-20 (NTSC) | USA/Canada, 1981 | 6560-101 | KERNAL 901486-06 (MAME `ROM_START(vic20)`). |
| VIC-20 / VC-20 (PAL) | Europe, 1981 | 6561 (6561E ceramic early, 6561-101 later) | KERNAL 901486-07 (MAME `ROM_START(vic20p)`). "VC-20" is the German name for the same PAL machine. |
| VIC-20 Sweden/Finland | Nordic | 6561 | NEC-numbered KERNAL and character ROMs (MAME `ROM_START(vic20_se)`). CLK also lists Danish and Swedish regions (`Analyser/Static/Commodore/Target.hpp`, `Vic20Target::Region`). |

### §1.2 Board revisions

- Early boards have a two-pin power input, a 7805 regulator on board, and separate PAL and NTSC
  designs with different crystals: 14.31818 MHz (NTSC) and 8.867238 MHz (PAL, divided by two
  by an extra 74S74). The later cost-reduced "CR" board is one design for both, regulated
  externally like the C64, with a 4.43361875 MHz crystal on PAL machines
  ([Tynemouth, "How the VIC20 works"](http://blog.tynemouthsoftware.co.uk/2019/09/how-the-vic20-works.html)).
- Assembly and fab numbers seen: ASSY 250403 / FAB 251040-01 rev D, and the VIC-20CR 251027-01
  rev D (NTSC). The PAL CR board differs by its crystal (4433618 Hz) and one extra 56 pF capacitor
  ([funet schematics index](https://bio.nic.funet.fi/pub/cbm/schematics/computers/vic20/index.html)).
  Sources disagree on which revision letter 250403 belongs to (see §10).
- Early machines use many 2114 static RAMs. Later ones use two 6116 plus three 2114. All RAM is
  static, because the VIC has no DRAM refresh (Tynemouth;
  [Wikipedia, MOS Technology VIC](https://en.wikipedia.org/wiki/MOS_Technology_VIC)).
- *Inference:* no board revision changes anything software can see, apart from the ROM set and
  PAL/NTSC.

### §1.3 Clocks (exact)

| | NTSC (6560) | PAL (6561) |
|---|---|---|
| Master | 14.31818 MHz crystal, divided by 14 by the VIC | 4.43361875 MHz (PAL colour subcarrier), divided by 4 |
| CPU clock φ2 | 1,022,727 Hz (14318181.8 / 14) | 1,108,404.7 Hz (4433618.75 / 4) |
| Dots per CPU cycle | 4 | 4 |
| Dot clock | 4.0909 MHz | 4.4336 MHz |
| Cycles per line | 65 | 71 |
| Lines per frame | 261 progressive; 262/263 per field when interlaced | 312 |
| Frame rate | 60.28 Hz progressive; 59.94 Hz interlaced | 50.04 Hz |

Sources: MAME `mos6560.h` (`mos6560_device::CLOCK = 14.318181_MHz_XTAL / 14`, `CYCLES = 65`,
`LINES = 261`; `mos6561_device::CLOCK = 4.433619_MHz_XTAL / 4`, `CYCLES = 71`, `LINES = 312`).
CLK `Vic20.cpp` uses 1022727 and 1108404. chips `vic20.h` uses `VIC20_FREQUENCY 1108404`
(PAL only). The VICE TAP documentation gives 1108405 Hz (PAL) and 1022727 Hz (NTSC)
([VICE manual §17](https://vice-emu.sourceforge.io/vice_17.html)). The 6561 datasheet states
the PAL input as 4.436187 MHz, which VGMPF calls a typo with a dropped digit
([vgmpf 6560](https://www.vgmpf.com/Wiki/index.php?title=6560)). Frame rates were computed from
these figures.

---

## §2 The VIC (6560 / 6561) at cycle level

### §2.1 Chip variants and revisions

- **6560** (NTSC, 6560-101 in production machines) and **6561** (PAL, 6561-101). The **6561E**
  is an early ceramic PAL part used in early VIC-20s. The 6562 and 6564 were prototypes that were
  never produced ([Wikipedia, MOS Technology VIC](https://en.wikipedia.org/wiki/MOS_Technology_VIC)).
- Interlace (`$9000` bit 7) works only on the 6560. MAME passes `interlace=true` for the 6560
  and `false` for the 6561 (`mos6560_device` constructors). CLK sets
  `timing_.supports_interlacing` only for NTSC.
- MAME also has a "656X Attack UFO" variant with fixed geometry, for an arcade board
  (`mos656x_attack_ufo_device`). It is not relevant to the VIC-20.
- No documented software-visible difference between the 6561E and the 6561-101 was found. VICE
  testprogs has a `vic6561/` set (test36864..test36867, `testcharheigh`, `testmemfetch`) and
  `raminitpattern/`, which may expose one (OQ2).

### §2.2 Bus sharing: no cycle stealing

- The VIC owns the bus in φ1 of every cycle and the CPU in φ2. The VIC never halts the CPU, so
  the 6502 runs at one cycle per clock all the time, with no badlines. Each 8-pixel character
  needs two VIC accesses on two consecutive φ1 phases: the **matrix fetch** (screen code, read
  together with the 4-bit colour nibble) and the **character fetch** (pattern byte). (CLK
  `MOS6560::run_for`: `column_counter_` alternates between the matrix address and
  `character_cell_start_address + code*height + row`. chips and MAME work the same way.)
- One CPU cycle is 4 dots, so one character column is 2 cycles. `$9000` (horizontal origin) is
  in CPU-cycle units (4 dots) and `$9001` (vertical origin) is in units of 2 lines (CLK compares
  `first_row_location == vertical_counter >> 1`; MAME `mos6560.cpp` compares
  `m_reg[1] == m_line >> 1`).
- **Open bus:** because the VIC drives the data bus in φ1, a CPU read of an unconnected address
  returns the byte the VIC fetched last. MAME maps the whole space to `mos6560_device::bus_r()`
  (which returns `m_vbus`) and lets CPU accesses to RAM, the character ROM and I/O update
  `m_vbus` (`vic20.cpp`, `vic20_mem` and the `vbus_*` taps). The VICE test
  `VIC20/unconnected/unconnected.asm` (Hannu Nuotio, 2009) classifies results as "vbus
  (random)", "addr MSB" or "ROM". CLK returns `0xFF` for unmapped reads (`Vic20.cpp`,
  `perform`), and chips does not model it.

### §2.3 Frame geometry

- See §1.3. MAME `mos6560.h` sets HBEND/HBSTART 4/204 (NTSC) and 24/248 (PAL) dots, and VBEND
  28 for both. CLK places sync in the last 7 cycles of a line and colour burst in the last 3,
  which its source calls "a guess" (`MOS6560::run_for`).
- **Raster register:** `$9004` holds line bits 8..1 and `$9003` bit 7 holds bit 0. The value
  seen is offset from the internal line counter: CLK uses `line_counter_increment_offset` 4
  (PAL) and 40 (NTSC), plus a special case on the last line (`raster_value()`, citing
  [sleepingelephant t=7237](http://www.sleepingelephant.com/ipw-web/bulletin/bb/viewtopic.php?f=14&t=7237&start=15#p80737)).
  MAME uses `raster_offset` 37 (6560) and 0 (6561) (`raster_line()`).
- **NTSC line-0 quirk (hardware measurement):** on a real NTSC VIC-20, a program polling `$9004`
  sees every value from 1 to 130 change at cycle position 0, but value 0 changes 33 cycles
  late. With interlace on, one field shows the delay and the other does not. So the late
  update happens at the start of a frame, not of a field (VICE testprogs
  `VIC20/vic_line0/readme.txt`).

### §2.4 Registers ($9000-$900F, mirrored through $9000-$90FF)

The VIC decodes A13..A8 = `010000`, so its 16 registers repeat through `$9000-$90FF`
(chips `M6561_SELECTED_ADDR`). Bit meanings come from the Power20 register table
([Power20 AD-Custom Chips](https://infinite-loop.at/Power20/Documentation/Power20-ReadMe/AD-Custom_Chips.html)),
cross-checked against CLK `MOS6560::write` and chips `_m6561_regs_dirty`.

| Reg | Bits |
|---|---|
| `$9000` | b7 interlace (6560 only); b6-0 horizontal origin |
| `$9001` | vertical origin (units of 2 lines) |
| `$9002` | b7 = video matrix address bit 9; b6-0 number of columns |
| `$9003` | b7 = raster bit 0 (read); b6-1 number of rows; b0 = 8x16 characters |
| `$9004` | raster bits 8-1 (read only) |
| `$9005` | b7-4 video matrix A13-A10; b3-0 character generator A13-A10 (VIC address space, see §3.3) |
| `$9006`/`$9007` | light pen X / Y (read) |
| `$9008`/`$9009` | POT X / POT Y (read) |
| `$900A`-`$900C` | voices 1-3: b7 on; b6-0 frequency |
| `$900D` | noise: b7 on; b6-0 frequency |
| `$900E` | b7-4 auxiliary colour; b3-0 master volume |
| `$900F` | b7-4 background colour; b3 = 0 reverse mode; b2-0 border colour |

- The default values the KERNAL writes are commonly given as PAL `$9000=$0C`, `$9001=$26` and
  NTSC `$9000=$05`, `$9001=$19`, both with 22 columns, 23 rows, screen `$1E00` and characters
  `$8000`. **Unverified** from a primary source: confirm by running the real ROMs (OQ3).
- MAME delays writes to `$900E` and `$900F` into a pending latch (`m_pend_reg`/`m_pend_data`),
  so a colour change can take effect part-way through a character. CLK applies colours at once
  and notes "palette changes can happen within half-characters" as a TODO. CLK also leaves "a
  further two-cycle delay on pixels" as a TODO. MAME uses `OUTPUT_DELAY = 7`.

### §2.5 Characters, colours and modes

- Characters are 8x8, or 8x16 with `$9003` b0 (CLK `tall_characters`). Character fetch address
  = character base + code x height + row. Up to 256 codes.
- Each matrix fetch also reads a 4-bit colour nibble from colour RAM: bits 2-0 are the
  foreground colour (only colours 0-7) and bit 3 selects multicolour for that cell.
- **Hires cell** (bit 3 = 0): a 1 bit is the foreground and a 0 bit is the background
  (`$900F` b7-4, any of 16 colours). With **reverse** (`$900F` b3 = 0) the two are swapped
  (CLK `invertedCells`; chips `inv_color`).
- **Multicolour cell** (bit 3 = 1): each 2-bit pair is one double-width pixel. 00 is the
  background, 01 the border (`$900F` b2-0), 10 the cell colour and 11 the auxiliary colour
  (`$900E` b7-4). Reverse does not apply to multicolour cells (CLK, chips).
- **Palette:** 16 colours. The border and the cell foreground can use only the first 8. The
  chip builds them from 5 luma levels and a set of chroma phases
  ([Wikipedia](https://en.wikipedia.org/wiki/MOS_Technology_VIC)). MAME's `PALETTE_6561` table
  and chips' `_m6561_colors` are the same RGB values, and chips names its source as VICE's
  `mike-pal.vpl`. Klive should derive its own palette from luma/phase data, not reuse those
  tables (see §8.6).
- **Bitmap emulation:** there is no bitmap mode. Software builds one by filling the matrix with
  unique codes, for example 20x10 cells of 8x16 characters give 160x160 pixels. The firmware
  default screen is 22x23 characters, 176x184 pixels
  ([Wikipedia](https://en.wikipedia.org/wiki/MOS_Technology_VIC)).

### §2.6 Light pen and paddles

- The light pen input is shared with the joystick fire line, which is also VIA1 PA5 (MAME
  `vic20.cpp`, `via1_pa_w` drives `m_vic->lp_w(BIT(data,5))`). MAME latches X as
  `2 * (cycle + 1) + extra` and Y as line/2, with a once-per-frame trigger and an edge case on
  the last line (`mos6560_device::lp_w`, the light pen logic in `raster`). CLK has the light pen
  only as a TODO. The MiSTer core's header says its light pen "may not be correct"
  (`rtl/m6561.vhd`).
- **POT X/Y** (`$9008/$9009`) are 8-bit A/D converters with two paddles on the joystick port
  ([Wikipedia](https://en.wikipedia.org/wiki/MOS_Technology_VIC)). The paddle fire buttons share
  joystick left (VIA1 PA4) and right (VIA2 PB7). *Inference* from the shared lines; VICE has a
  `vic_paddles/` and a `paddlescope/` test. MAME reads them through callbacks. CLK and the MiSTer
  core do not implement them. The conversion rate and timing were not found (OQ4).

### §2.7 Sound

The VIC has three square-wave voices one octave apart, a noise voice and a 4-bit master
volume. Writing 0 to a voice register turns it off.

- **Shift-register waveform:** each pulse voice is an 8-bit shift register, a 7-bit counter, a
  7-bit frequency value and an on bit, not a simple flip-flop. When the counter wraps, the
  register shifts left and its new low bit is the inverse of the old top bit while the voice is
  on, or 0 while it is off. The output is bit 0, which gives the normal 8-low/8-high square
  wave. Toggling the on bit with exact timing loads other bit patterns into the register, and
  16 distinct waveforms are possible
  ([viznut/pwp, "15 new waveforms for the VIC-20", 2003, archived](http://web.archive.org/web/2016/http://www.pelulamu.net/pwp/vic20/waveforms.txt)).
  MAME (`mos6560_device::sound_stream_update`) and CLK (`AudioGenerator::apply_samples`, the
  `shift` lambda) both implement this model. The MiSTer core's header credits viznut's model.
- **Voice clocks:** `$900C` (high) every 4 CPU cycles, `$900B` every 8, `$900A` (bass) every 16
  (viznut). MAME runs a stream at clock/2 with per-voice prescale masks 0x0f/0x07/0x03 that give
  the same 16/8/4 cycles. CLK runs at clock/4 and shifts the counter comparisons by 2/1/0.
- **Counter reload:** MAME increments the counter until it reaches `$7F`, then reloads
  `(value + 1) & $7F` and shifts. Lance Ewing's die-shot analysis describes the same step
  ([VICE feature request #328](https://sourceforge.net/p/vice-emu/feature-requests/328/)). CLK
  reloads `value`, tests against `$80`, and says a value of `$7F` shifts every cycle. These
  disagree for `$7F` and differ by one step in the period (§10, item 3). Square frequency =
  CPU clock / (prescale x 16 x period).
- **Noise:** a 16-bit LFSR with taps at bits 3, 12, 14 and 15, combined XNOR and gated with the
  on bit. It feeds an 8-bit output shift register that shifts only on a rising edge of LFSR
  bit 0. Lance Ewing reverse-engineered it from a 6561 die shot in 2019, and Antonino Porcino
  (nippur72) reported it to VICE and wrote a VHDL model; VICE added it in r36241 and fixed an
  octave error in r36994 ([VICE feature request #328](https://sourceforge.net/p/vice-emu/feature-requests/328/),
  forum thread [sleepingelephant t=8733](http://sleepingelephant.com/ipw-web/bulletin/bb/viewtopic.php?f=11&t=8733&start=210#p104360)).
  MAME implements it (`m_noise_lfsr`, `m_noise_lfsr0`) and advances it every 2 CPU cycles. CLK
  instead uses a 1 KiB pattern table marked "Source: VICE. Not original." (`6560.cpp`,
  `noise_pattern`), stepped every 8 CPU cycles. The noise clock rate is a disagreement (§10).
- **Mixing and volume:** the output is the sum of the voice bits times the volume. MAME uses
  `m_dac[(bits*7+1)*volume]`, an exponential DAC curve. CLK uses
  `sample*volume + volume/16` and notes "what's the real ratio of this stuff?". Every volume
  change makes a click, which allows 4-bit sample playback through `$900E`
  ([vgmpf](https://www.vgmpf.com/Wiki/index.php?title=6560)).
- No VIC register reflects the noise output, so it cannot be tested by software, only by ear or
  recording (VICE feature request #328).

---

## §3 Memory map

### §3.1 CPU map (unexpanded)

| Range | Contents |
|---|---|
| `$0000-$03FF` | 1K internal RAM (zero page, stack, KERNAL/BASIC work area) |
| `$0400-$0FFF` | RAM1-RAM3: 3K expansion (cartridge port), else open |
| `$1000-$1FFF` | 4K internal RAM (BASIC, screen at `$1E00` unexpanded) |
| `$2000-$7FFF` | BLK1, BLK2, BLK3: 8K each, expansion port |
| `$8000-$8FFF` | character ROM 901460-03 (4K) |
| `$9000-$90FF` | VIC (16 registers, mirrored) |
| `$9100-$93FF` | VIAs: VIA1 at `$9110`, VIA2 at `$9120` (see §4 and §10 for mirroring) |
| `$9400-$97FF` | colour RAM, 1K x 4 bits |
| `$9800-$9BFF` | I/O2 (expansion port) |
| `$9C00-$9FFF` | I/O3 (expansion port) |
| `$A000-$BFFF` | BLK5: cartridge ROM, or RAM |
| `$C000-$DFFF` | BASIC ROM 901486-01 |
| `$E000-$FFFF` | KERNAL ROM 901486-06/-07 |

Sources: chips `vic20.h` (`vic20_init` memory comment), CLK `Vic20.cpp` (constructor), MAME
`vic20.cpp` (`vic20_mem`). Address decoding uses 74LS138s that split the space into eight 8K
blocks, with a second '138 decoding block 0 into RAM1-3. BASIC and KERNAL (blocks 6 and 7)
cannot be switched out from the expansion port (Tynemouth).

### §3.2 Colour RAM

- One 2114 (1K x 4). Only bits 0-3 exist. CPU reads of `$9400-$97FF` return the upper nibble
  from the floating bus: MAME `vic20_mem` returns `m_color_ram | (bus_r() & 0xf0)`. CLK returns
  the stored byte. The VIC reads the colour nibble together with each matrix byte, indexed by
  matrix address bits 9..0 (CLK `colour_memory[address & 0x3ff]`).
- Which half is used (`$9400` or `$9600`) follows video-matrix address bit 9 (`$9002` b7). With
  the screen at `$1E00` the colours are at `$9600`. With 8K or more of expansion (screen at
  `$1000`) they are at `$9400` (Tynemouth; *inference* from the address wiring).

### §3.3 What the VIC can see

- The VIC has a 14-bit address bus (16K). It reaches only internal memory, so expansion RAM,
  including the 3K block, is invisible to it (Tynemouth). VIC address A13 is inverted and used
  as CPU A15:

| VIC address | CPU address | Contents |
|---|---|---|
| `$0000-$0FFF` | `$8000-$8FFF` | character ROM |
| `$1000-$13FF` | `$9000-$93FF` | I/O area; no useful data, open bus in MAME |
| `$1400-$17FF` | `$9400-$97FF` | colour RAM, as data |
| `$1800-$1FFF` | `$9800-$9FFF` | I/O2/3, nothing internal |
| `$2000-$23FF` | `$0000-$03FF` | 1K RAM |
| `$2400-$2FFF` | `$0400-$0FFF` | 3K expansion, **not visible** |
| `$3000-$3FFF` | `$1000-$1FFF` | 4K RAM |

  Sources: CLK `Vic20.cpp` maps `(addr & 0x1fff) | (((addr & 0x8000) >> 2) ^ 0x2000)` for
  `$0000-$03FF` and `$1000-$1FFF` only. MAME `vic_videoram_map` maps the character ROM at
  `$0000`, colour RAM at `$1400` with the open-bus high nibble, RAM0 at `$2000` and RAM at
  `$3000`; the rest reads open bus.
- **Disagreement:** chips `vic20.h` maps the 3K expansion into the VIC's view at `$2400`. Its
  own comment asks whether the VIC can read colour RAM. Tynemouth, CLK and MAME agree that the
  3K block is not visible (§10, item 1).

### §3.4 Expansion and where BASIC and the screen go

| Configuration | BASIC start | Screen | Colour | Notes |
|---|---|---|---|---|
| Unexpanded (5K) | `$1001` | `$1E00` | `$9600` | 3583 bytes free (well known; *unverified* here) |
| +3K (VIC-1210, Super Expander) | `$0401` | `$1E00` | `$9600` | |
| +8K or more in BLK1 | `$1201` | `$1000` | `$9400` | the screen moves down because the VIC cannot see BLK1 |

- These start addresses and screen moves are well known
  ([Wikipedia](https://en.wikipedia.org/wiki/MOS_Technology_VIC) gives screen `$1000` with
  expansion and `$1E00` without; PRG load addresses `$1001`/`$0401`/`$1201`). How the KERNAL
  decides with both 3K and BLK1 fitted is **unverified**. *Inference:* it uses BLK1's layout,
  `$1201`, and leaves the 3K block unused by BASIC (OQ5).
- Expansion products: Commodore VIC-1210 (3K), VIC-1110 (8K), VIC-1111 (16K, BLK1+2), and the
  Super Expander VIC-1211A (3K RAM plus a 4K graphics/sound BASIC extension ROM in BLK5).
  Third-party 32K boards fill BLK1-3 and usually BLK5, with switches.
  *Inference / common knowledge:* these products are not documented in a primary source here.
- **"35K":** RAM1-3 (3K) + BLK1/2/3 (24K) + BLK5 (8K) = 35K of expansion, 40K of RAM in all.
  The **Final Expansion 3** (512K RAM + 512K flash, registers in the I/O area), the
  **UltiMem** and the **Mega-Cart** (large ROM collection with RAM) bank-switch on top of this.
  VICE testprogs has `fe3diag/`, `fe3test/` and `ultimem/`, and MiSTer has `rtl/megacart.v`. Note only.
- **BLK5 as RAM:** loading a cartridge image into RAM at `$A000` makes it writable, which can
  break software that writes to its own ROM (copy protection, or bugs). Many RAM expansions
  therefore have a BLK5 write-protect switch. *Inference / community knowledge* (OQ6).
- CLK's memory models are Unexpanded, 8K (it enables bank0 = the 3K block, which looks like a
  naming slip in `Target.hpp`, `set_memory_model`) and 32K (all banks plus BLK5). chips has
  `STANDARD`, `8K`, `16K`, `24K`, `32K` and `MAX` (`vic20.h`).

### §3.5 Cartridge areas

- ROM cartridges sit in BLK1/2/3/5 and in I/O2/I/O3. Autostart cartridges live at `$A000`: a
  cold-start vector at `$A000`, an NMI/RESTORE vector at `$A002`, and the signature
  `$41 $30 $C3 $C2 $CD` ("A0CBM", with the high bit set on "CBM") at `$A004-$A008`. The KERNAL
  checks for it at reset and when RESTORE is pressed
  ([sleepingelephant p=121095](https://www.sleepingelephant.com/~sleeping/ipw-web/bulletin/bb/viewtopic.php?p=121095),
  [p=123231](https://www.sleepingelephant.com/~sleeping/ipw-web/bulletin/bb/viewtopic.php?p=123231)).
- Larger cartridges put a second 8K at `$2000`, `$4000` or `$6000`. A file image does not record
  which, so file names carry the address (§7).

---

## §4 The two VIAs

### §4.1 Wiring

| | VIA1 (`$9110-$911F`) | VIA2 (`$9120-$912F`) |
|---|---|---|
| Interrupt output | **NMI** | **IRQ** |
| PA0 | serial CLK in | keyboard rows (read) |
| PA1 | serial DATA in | " |
| PA2 | joystick up | " |
| PA3 | joystick down | " |
| PA4 | joystick left (paddle X fire) | " |
| PA5 | joystick fire / light pen | " |
| PA6 | cassette switch sense | " |
| PA7 | serial ATN out (inverted) | " |
| PB0-7 | user port (RS-232 lines) | keyboard column select (output); PB3 also cassette write; PB7 also joystick right |
| CA1 | RESTORE key | cassette read |
| CA2 | cassette motor | serial CLK out (inverted) |
| CB1 | user port (RS-232 receive) | serial SRQ? (OQ7) |
| CB2 | user port (RS-232 transmit) | serial DATA out (inverted) |

Sources: MAME `vic20.cpp` (`via1_pa_r`, `via1_pa_w`, `via2_pa_r`, `via2_pb_r`, `via2_pb_w`,
`via2_ca2_w`, `via2_cb2_w`; in `add_clocked_devices` VIA1's IRQ goes to `M6502_NMI_LINE`, VIA2's
to `M6502_IRQ_LINE`, and VIA1 CA2 drives the cassette motor). CLK `Vic20.cpp` (`UserPortVIA`:
CA2 tape motor, PA7 inverted to ATN, CA1 RESTORE; `KeyboardVIA`: "CB2 is inverted to become
serial data; CA2 is inverted to become serial clock", CA1 tape input). Also the
[Denial wiki VIA page](https://sleepingelephant.com/denial/wiki/index.php/Versatile_Interface_Adapter)
and the [Power20 table](https://infinite-loop.at/Power20/Documentation/Power20-ReadMe/AD-Custom_Chips.html).

- **IEC polarity:** the three outputs (ATN from VIA1 PA7, CLK from VIA2 CA2, DATA from VIA2 CB2)
  are inverted on the way to the bus: a VIA output of 1 pulls the line low. The inputs on VIA1
  PA0/PA1 read the bus level (MAME `host_*_w(!state)`, CLK `LineLevel(!value)`). For the bus
  protocol see `DRIVE_1541.md`.
- **Naming of rows and columns:** MAME names VIA2 port A "rows" and port B "columns". The Denial
  wiki swaps the names. The Power20 table calls port B "row select" and port A "column result".
  They all agree on the electrical fact: the KERNAL drives port B (`$9120`) as output and reads
  port A (`$9121`), and joystick right shares PB7. Clock Signal uses the same direction. Klive
  should name them by direction.
- RESTORE is not in the matrix. It drives VIA1 CA1, and the KERNAL enables that interrupt, so
  it reaches the CPU as an NMI through VIA1 (CLK `set_key_state(KeyRestore)` drives
  `user_port_via_ ... Port::A, Line::One`).

### §4.2 Interrupts

- The 60 Hz "jiffy" IRQ comes from VIA2 timer 1 in free-running mode. The KERNAL loads a
  different latch value on PAL and NTSC so both run at about 60 Hz. *Inference* from the
  VIA2-to-IRQ wiring and the two KERNAL variants; the exact latch values should be read from
  the running ROMs (OQ3). There is no raster interrupt: the VIC has no IRQ output
  ([Wikipedia](https://en.wikipedia.org/wiki/MOS_Technology_VIC)).
- NMI comes from VIA1: RESTORE (CA1) and RS-232, which the KERNAL bit-bangs with VIA1's timers
  and CB1/CB2.

### §4.3 Mirroring and decoding (disagreement)

- CLK: in `$9000-$93FF`, the VIC is selected when A8 = 0, VIA1 when A4 = 1 and VIA2 when A5 = 1.
  When both A4 and A5 are set, both VIAs answer and the results are ANDed (`perform`).
- MAME maps VIA1 at `$9010-$901F` and VIA2 at `$9020-$902F`, each with `mirror(0x3c0)`, and
  ANDs both at `$9030` (`vic20_mem`). Its VIC appears only at `$9000-$900F`.
- chips decodes the VIC through `M6561_SELECTED_ADDR`, which mirrors it over `$9000-$90FF`.
- These disagree about whether `$9010-$90FF` reach a VIA, the VIC or both. VICE testprogs
  `via_mapping/` and `vic_9000test/` exist to settle it (OQ8).

### §4.4 User port

VIA1 PB0-7, CB1 and CB2 go to the user port edge connector. The PA lines of VIA1 also appear on
the top side, together with the 9 V AC and reset pins
([Denial wiki](https://sleepingelephant.com/denial/wiki/index.php/Versatile_Interface_Adapter);
Tynemouth). This is the RS-232 port at TTL levels.

---

## §5 Tape (C2N / 1530 Datassette)

- **Wiring:** motor on VIA1 CA2 (through a transistor driver), sense on VIA1 PA6, write on VIA2
  PB3 (shared with a keyboard column), read on VIA2 CA1 as an edge interrupt (§4.1; MAME;
  CLK `tape_did_change_input`). The Datassette port also has 9 V AC (Tynemouth).
- **Format:** the VIC-20 KERNAL uses the Commodore pulse-width tape format (short, medium and
  long pulses, a header block and a data block, each recorded twice). The C64 KERNAL's tape code
  comes from it. *Inference / common knowledge:* the two are physically compatible, and a C64
  can load a VIC-20 tape file. The pulse thresholds are timed with the VIA timers rather than
  the CIA, so exact pulse durations differ slightly; this was not measured (OQ9).
- **TAP files:** the VICE TAP format (`C64-TAPE-RAW`) has a platform byte at offset `$0D`
  (1 = VIC-20). Pulse lengths are in machine cycles at 1108405 Hz (PAL) or 1022727 Hz (NTSC)
  ([VICE manual §17](https://vice-emu.sourceforge.io/vice_17.html)).
- **Fast-load hooks in other emulators:** CLK traps the KERNAL tape routines at `$F7B2`
  (header) and `$F90B` (data) and fills the tape buffer at the address in `$B2/$B3`
  (`Vic20.cpp`, `perform`, `use_fast_tape_hack_`). This records KERNAL entry points as observed
  in a working emulator, not from a disassembly. Klive should find its own landmarks by
  running the ROM.

---

## §6 ROMs

### §6.1 Images (CRC32 / SHA-1 as recorded in MAME `vic20.cpp`, BSD-3)

| ROM | Size | CRC32 | SHA-1 |
|---|---|---|---|
| BASIC 901486-01 (all regions) | 8K | `db4c43c1` | `587d1e90950675ab6b12d91248a3f0d640d02e8d` |
| KERNAL 901486-06 (NTSC) | 8K | `e5e7c174` | `06de7ec017a5e78bd6746d89c2ecebb646efeb19` |
| KERNAL 901486-07 (PAL) | 8K | `4be07cb4` | `ce0137ed69f003a299f43538fa9eee27898e621e` |
| KERNAL 901486-02 (VIC-1001 Japan) | 8K | `336900d7` | `c9ead45e6674d1042ca6199160e8583c23aeac22` |
| Character 901460-03 | 4K | `83e032a6` | `4fd85ab6647ee2ac7ba40f729323f2472d35b9b4` |
| Character 901460-02 (Japan) | 4K | `fcfd8a4b` | `dae61ac03065aa2904af5c123ce821855898c555` |
| KERNAL nec22081.206 (Sweden/Finland) | 8K | `b2a60662` | `cb3e2f6e661ea7f567977751846ce9ad524651a3` |
| Character nec22101.207 (Sweden/Finland) | 4K | `d808551d` | `f403f0b0ce5922bd61bbd768bdd6f0b38e648c9f` |
| JiffyDOS NTSC / PAL (third-party) | 8K | `683a757f` / `705e7810` | `83fb83e9...` / `5a03623a...` |

- These checksums were not recomputed from images here. Doing so is a plan step (OQ10).
- Licensing of Commodore ROMs is a plan decision, not a fact (OQ10).

### §6.2 Reset landmarks, typing and loading

- The reset vector is at `$FFFC`. Klive should take its landmarks (end of RAM test, "READY.",
  the key-wait loop) from running the ROM, as it did for the ZX81 and SAM. CLK's typer hook is
  the KERNAL keyboard-scan entry, at the opcode fetch of `$EB1E` (`Vic20.cpp`, `perform`). That
  is an observed address in one KERNAL, so check it against both -06 and -07.
- **Keyboard buffer for auto-typing:** the buffer is `$0277-$0280` (10 bytes) and the count is
  `$C6`; the buffer size limit is at `$0289`. Same layout as the C64. **Unverified** against
  the VIC-20 Programmer's Reference Guide here (OQ11).
- **BASIC pointers:** TXTTAB `$2B/$2C`, VARTAB `$2D/$2E`, ARYTAB `$2F/$30`, STREND `$31/$32`,
  MEMSIZ `$37/$38`, the same as the C64. **Unverified** for the VIC-20 (OQ11).
- **Injecting a PRG:** write the bytes at the load address. For a BASIC program at TXTTAB, set
  VARTAB, ARYTAB and STREND to the end address, then RUN. Use `$1001`, `$0401` or `$1201` by
  memory configuration (§3.4). A PRG with a different load address in BLK5 (`$A000`) is usually
  a cartridge image (§7).

---

## §7 File formats

| Format | Notes |
|---|---|
| `.prg` | 2-byte load address, then data. `$1001`/`$0401`/`$1201` for BASIC, `$A000` for a BLK5 cartridge dump, `$2000`/`$4000`/`$6000` for other blocks. |
| Raw cartridge `.bin`/`.rom` | no header. Naming conventions such as `-2000`, `-6000`, `-a000` or `.20`, `.60`, `.a0` tell the address. The MiSTer README warns that the load address must often be guessed from the file name ([VIC20_MiSTer README](https://github.com/MiSTer-devel/VIC20_MiSTer)). |
| `.crt` (VICE) | 16-byte signature `"VIC20 CARTRIDGE "`, added in CRT v2.0. Uses the common CHIP packets, where the bank and load address say where each block goes ([VICE manual §17.14](https://vice-emu.sourceforge.io/vice_17.html)). The VIC-20 hardware type IDs were not found in the manual text (OQ12). |
| `.tap` | §5. |
| `.d64` / `.g64` | for the 1540/1541 (`DRIVE_1541.md`). |
| `.p00` | PC64 container around a PRG (VICE manual §17). |

---

## §8 Implementations and licences (checked 2026-11-23)

### §8.1 Clock Signal (MIT) - usable as a port source

- `TomHarte/CLK`, licence MIT per the GitHub API. Files read: `Components/6560/*`,
  `Machines/Commodore/Vic-20/*`, `Components/6522/*`, `Machines/Commodore/SerialBus.*`,
  `Machines/Commodore/1540/*`. Klive has already ported CLK (MIT) code for the ZX80/ZX81
  (`AGENTS.md`), so the precedent exists.
- **Accuracy (assessment):**
  - Good: the line/frame state machine with PAL/NTSC tables and NTSC interlace; matrix and
    character fetches on alternate cycles; the raster-register edge cases from the Denial forum;
    the viznut shift-register voices; VIC-visible memory correctly limited to internal RAM; both
    VIAs wired; a real 1540 on the serial bus.
  - Missing or simplified: light pen and POTs; open bus (returns `$FF`); the colour RAM upper
    nibble; mid-character register changes and the pixel output delay (both TODOs); sync and
    burst timing ("a guess"); the noise generator.
- **Provenance caution:** CLK's `noise_pattern` table in `6560.cpp` is marked "Source: VICE. Not
  original." VICE is GPL-2, so that table must not be ported. Klive should implement the
  die-shot LFSR (§2.7) instead.

### §8.2 MAME (BSD-3-Clause per file) - the strongest permissive reference

- `src/devices/sound/mos6560.cpp|.h` and `src/mame/commodore/vic20.cpp` all carry
  `license:BSD-3-Clause`, copyright Curt Coder.
- On 2026-10-12 the VIC was rewritten "as a cycle-exact raster pipeline", and on 2026-10-15 it
  moved to on-access catch-up. The commit says the reVICion and Orb MegaDemo Delux disks were
  promoted to working, and carries "AI disclosure: assisted by Claude Opus 5.5" (GitHub commit
  history for `mos6560.cpp`).
- It models: the floating video bus (`m_vbus`) and the colour RAM high nibble, the light pen
  with its edge cases, interlace field lengths, pending `$900E/$900F` writes, an output delay,
  the die-shot noise LFSR, and the viznut voices.
- **Provenance caution:** `PALETTE_6561` matches VICE-derived values (chips says its identical
  table comes from VICE's `mike-pal.vpl`). Do not reuse the palette tables.

### §8.3 floooh/chips (zlib)

- `chips/m6561.h` (2019, zlib) and `systems/vic20.h` (2018, zlib), PAL only. Simpler: border
  and display logic is computed from register values (`_m6561_regs_dirty`). It maps the 3K
  block into the VIC's view, which the other sources say is wrong. Its noise is described as
  "tweaked to sound right" (`0x40 factor is not a bug`). The palette comes from VICE. Useful
  for structure only.

### §8.4 VICE xvic (GPL-2) - facts only

- `VICE-Team/svn-mirror` on GitHub mirrors the sources, and `svn.code.sf.net/p/vice-emu/code`
  holds the testprogs. The data folders ship VIC-20 palettes. Use for facts and as an oracle.
- **VICE testprogs for the VIC-20** (`testprogs/VIC20/`): `fe3diag`, `fe3test`, `joystick`,
  `paddlescope`, `raminitpattern`, `split-tests`, `ultimem`, `unconnected`, `via_defaults`,
  `via_mapping`, `via_pb7`, `via_sr`, `via_t1crash`, `via_t1irqack`, `via_wrap`, `viavarious`,
  `vic6561`, `vic_9000test`, `vic_interlace` (includes `flinale`, `retina_display`),
  `vic_line0`, `vic_paddles`, `vic_vert0`. The test bench lists are `testbench/xvic-testlist.txt`
  and `vic20-testlist.in`. The programs' licences were not checked one by one: run them as
  tests, do not copy them into the repository (OQ13).

### §8.5 Others

- **MiSTer `VIC20_MiSTer`:** `rtl/m6561.vhd` (MikeJ / WoS) is licensed for non-commercial use
  "on Replay hardware only". It is unusable as a port source, and only its header facts are
  recorded here. The header credits viznut's voice model and Lance Ewing's noise analysis, and
  says POTX/Y are not implemented. The repository has no top-level licence (GitHub API:
  `null`).
- **Lance Ewing** `lanceewing/mos-6561-reverse` (die-shot schematic in Logisim, 2019, no
  licence) and `lanceewing/jvic` (Java emulator, no licence in the API). Facts only. The 6561
  die-shot work is a primary source for the noise and counter circuits (OQ14).
- **YAPE** (`calmopyrin/yapesdl`, GPL-2) also emulates the VIC-20 (`vicmem.cpp`,
  `keysvic.cpp`). Facts only.
- nippur72 `vic20-emu` (WASM VIC-20, no licence in the API). Facts only.

### §8.6 Palette

Every permissive source examined carries VICE-derived RGB tables. *Inference:* Klive needs a
palette it computes itself, from the luma levels and chroma phases of the 6560/6561 datasheet
(5 luma levels per [Wikipedia](https://en.wikipedia.org/wiki/MOS_Technology_VIC)), checked by
eye against real-hardware photographs, as the project did for its other machines.

---

## §9 Things that bear on architecture (*inference* from the above)

1. **One clock domain, no stalls.** The CPU never waits for the VIC. A core can step the VIC by
   one CPU cycle (4 dots, one fetch) per 6502 cycle, so it fits the shared in-core debug loop
   with no RDY handling. This is simpler than the C64's VIC-II and the TED.
2. **Shared parts:** the 6522 (two here, two in the 1540/1541) and the IEC bus should be one C
   module each, shared with the drive core (`DRIVE_1541.md`).
3. **The 1540/1541 clock is asynchronous:** 1,000,000 Hz against 1,108,405 or 1,022,727 Hz.
   Lock-step co-simulation needs a fractional scheduler (CLK `media_divider_`-style), not an
   integer ratio.
4. **Memory configuration is part of the machine model**, as with the Next profiles: RAM blocks
   (3K, BLK1/2/3/5), the BLK5 write-protect and the cartridge images change the BASIC start,
   the screen position and what the VIC sees. It must be part of the machine identity for
   saved state and for the Run/inject rules (`$1001`/`$0401`/`$1201`).
5. **Open bus must come from the VIC's last fetch**, both for the unconnected-area tests and
   for the colour RAM high nibble.
6. **Run/inject** can follow the ZX81 and TVC pattern: boot to the key-wait loop, place a PRG,
   fix the BASIC pointers, and type RUN through the keyboard buffer (§6.2).

---

## §10 Disagreements between sources

1. **Can the VIC see the 3K expansion?** chips says yes (`vic20.h` maps `ram_3k` at VIC
   `$2400`). Tynemouth, CLK and MAME say no.
2. **Board 250403 revision letter:** early "rev A" in one source, the cost-reduced "rev C/D" in
   another (search results summarised from the funet schematics index and
   [retroisle](https://www.retroisle.com/commodore/vic20/Technical/Hardware/vic_troubleshooting.php)).
3. **Voice counter reload and period:** MAME and the die-shot description reload `value + 1` on
   `$7F`, so `$7E` shifts every step and `$7F` gives the longest period. CLK reloads `value` and
   says `$7F` shifts every step. viznut says the counter resets to the frequency value when the
   incremented value is `$7F`. The pitch of every note differs by one step of the period.
4. **Noise clock:** MAME steps the noise counter every 2 CPU cycles (Ewing: half of the input
   clock / 4 divider). viznut guessed "cpuclock/32 (?)". CLK steps every 8 cycles with a VICE
   lookup table. VICE had a one-octave error, fixed in 2019. One reporter said VICE 3.5 matched
   real hardware, but the ticket stays open over a "minor difference".
5. **Raster register offsets:** CLK uses offsets 4 (PAL) and 40 (NTSC) with special cases. MAME
   uses `raster_offset` 0 (PAL) and 37 (NTSC). The VICE `vic_line0` test documents a 33-cycle
   NTSC delay at line 0.
6. **VIA and VIC mirroring in `$9000-$93FF`:** see §4.3.
7. **VIA2 row and column names:** see §4.1. The Denial wiki also lists VIA2 CA1 as "cassette
   port write", while MAME, CLK and Power20 give cassette read.
8. **Sound voices "half an octave apart"** (Wikipedia) against one octave apart (viznut's
   prescalers /4, /8, /16; VGMPF; MAME; CLK). The prescalers settle it at one octave.
9. **PAL clock in the datasheet:** 4.436187 MHz (datasheet, called a typo by VGMPF) against
   4.43361875 MHz (PAL subcarrier; Tynemouth gives 4.43618 MHz, also slightly off). Klive should
   use 4.43361875 / 4 = 1,108,404.69 Hz.

---

## §11 Open questions

- **OQ1** Exact 6561 sync, blanking and burst positions in the line. CLK calls its own a guess.
  Read the MAME rewrite and Lance Ewing's die-shot schematic, then confirm with VICE
  `vic_vert0`/`split-tests`.
- **OQ2** Is there any software-visible difference between the 6561E and the 6561-101, or
  between 6560 revisions? Run VICE `vic6561/` on both if hardware reports exist.
- **OQ3** The KERNAL's VIC init values (`$9000-$900F` per region) and the VIA2 T1 jiffy latch
  value per region. Read them from the running ROMs (register dump after reset), not from a
  disassembly.
- **OQ4** POT X/Y conversion timing and update rate, and how the paddle buttons map. VICE
  `vic_paddles`/`paddlescope`.
- **OQ5** BASIC start, top and screen position when 3K and BLK1 are both fitted.
- **OQ6** How common BLK5 write-protect is and which software needs it (needed for a
  cartridge-as-RAM option).
- **OQ7** Is the serial SRQ line connected on the VIC-20, and to which VIA input (cassette read,
  as on the C64?). Check the 251027 schematic.
- **OQ8** True decoding of `$9000-$93FF`: VIC mirror range, VIA chip-selects, and the read value
  when both VIAs are selected. VICE `via_mapping`, `vic_9000test`.
- **OQ9** VIC-20 tape pulse widths compared with the C64, and whether every C64 TAP loader is
  usable. Matters for a shared tape module.
- **OQ10** Recompute CRC32/SHA-1 from good ROM images. Decide how ROMs are obtained (bundling
  rights: the Commodore ROM rights holder must be identified before any bundling).
- **OQ11** Confirm the keyboard buffer (`$0277`, `$C6`, `$0289`) and BASIC pointer addresses
  from the VIC-20 Programmer's Reference Guide memory map.
- **OQ12** VIC-20 `.crt` hardware type IDs (generic, Mega-Cart, Final Expansion, UltiMem,
  Behr Bonz, ...) from VICE's cartridge documentation or `cartridge.h` (facts only).
- **OQ13** Licence of the individual VICE testprogs (many are by third parties). Decide whether
  they are run from a fetched copy, as the Next SD cards are, rather than committed.
- **OQ14** Licence status of Lance Ewing's die-shot schematic. If it is usable as a fact
  source, it is the best primary reference for the sound circuits and counters.

---

## §12 Reference documents

- MOS 6560/6561 VIC datasheet (Commodore). Not re-read in this pass; VGMPF quotes its clock
  figures. Index: <https://www.commodore.ca/manuals/funet/cbm/documents/chipdata/index.html>
- Wikipedia, MOS Technology VIC: <https://en.wikipedia.org/wiki/MOS_Technology_VIC>
- Tynemouth Software, "How the VIC20 works" (2019):
  <http://blog.tynemouthsoftware.co.uk/2019/09/how-the-vic20-works.html>
- viznut/pwp, "15 new waveforms for the VIC-20" (2003), archived:
  <http://web.archive.org/web/2016/http://www.pelulamu.net/pwp/vic20/waveforms.txt>
- VICE feature request #328 (6561 noise from the die shot):
  <https://sourceforge.net/p/vice-emu/feature-requests/328/>
- Denial forum noise thread:
  <http://sleepingelephant.com/ipw-web/bulletin/bb/viewtopic.php?f=11&t=8733&start=210#p104360>
- Denial forum raster thread:
  <http://www.sleepingelephant.com/ipw-web/bulletin/bb/viewtopic.php?f=14&t=7237&start=15#p80737>
- Denial wiki, VIA: <https://sleepingelephant.com/denial/wiki/index.php/Versatile_Interface_Adapter>
- Power20 custom chips register table:
  <https://infinite-loop.at/Power20/Documentation/Power20-ReadMe/AD-Custom_Chips.html>
- VGMPF, 6560: <https://www.vgmpf.com/Wiki/index.php?title=6560>
- VICE manual §17 (TAP, CRT, P00): <https://vice-emu.sourceforge.io/vice_17.html>
- VICE testprogs: <https://svn.code.sf.net/p/vice-emu/code/testprogs/VIC20/>
- Schematics index (VIC-20, VIC-20CR): <https://bio.nic.funet.fi/pub/cbm/schematics/computers/vic20/index.html>
- Lance Ewing, 6561 die-shot reverse: <https://github.com/lanceewing/mos-6561-reverse>
- Clock Signal: <https://github.com/TomHarte/CLK> (MIT)
- MAME: <https://github.com/mamedev/mame> (`mos6560.*`, `vic20.cpp`, BSD-3)
- floooh/chips: <https://github.com/floooh/chips> (zlib)
- MiSTer VIC-20: <https://github.com/MiSTer-devel/VIC20_MiSTer> (restrictive core licence)
