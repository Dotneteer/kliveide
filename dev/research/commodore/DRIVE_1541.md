# Commodore 1541 disk drive (and its relatives): hardware, disk surface, IEC bus, images, ROMs, implementations

Research notes for an accurate ("true drive") 1541 in Klive IDE's Commodore cores (C64 family, VIC-20,
C16/Plus/4, C128). The project author wants the drive to run fast loaders and copy-protected disks, so this
file goes down to the read/write logic and the flux level. It is facts, not a plan. The 6502 itself is in
the CPU research file; this file only says what the drive needs from it (the SO pin, cycle timing).

Conventions:

- "Drive cycle" = one 1 MHz φ2 cycle of the drive's 6502. "Ref cycle" = one cycle of the drive's 16 MHz
  crystal (62.5 ns), the clock of the read/write logic. "Host" = the computer (C64, VIC-20, ...).
- Track numbers are 1-based as in CBM DOS; a "half-track" is one stepper step (track *n* = half-track
  *2n* in VICE's and P64's numbering; G64 stores entries for 1, 1.5, 2, ...).
- *Inference* marks my own conclusions. Where sources disagree, all versions are kept and listed in §11.
- Everything is paraphrased; no code is copied. GPL sources (VICE, nibtools, Pi1541, Hoxs64, MiSTer,
  1541 Ultimate) were read for facts only. File and function names are given for lookup.
- No commented disassembly of the drive DOS was used. Register and pin facts come from schematics-level
  sources, emulator I/O code and the VIA datasheet.

Sources read, with licences (checked 2026-11-23 through the GitHub API `license.spdx_id` field and the
file headers):

| Source | What it is | Licence | How checked |
|---|---|---|---|
| VICE (`vice/src/drive/*.c`, read in the libretro mirror <https://github.com/libretro/vice-libretro>) | The reference true-drive emulator | GPL-2.0 (facts only) | repo licence; file headers |
| VICE `src/lib/p64/p64.c`, `p64.h` | P64 reference implementation by Benjamin Rosseaux | **zlib** | file header (2011-2012) |
| MAME `src/devices/bus/cbmiec/c1541.cpp`, `c1571.cpp`, `c1581.cpp`, `cbmiec.cpp`, `src/devices/machine/64h156.cpp`, `6522via.cpp`, `mos6526.cpp`, `src/devices/bus/plus4/c1551.cpp`, `src/devices/imagedev/floppy.cpp`, `src/lib/formats/g64_dsk.cpp`, `d64_dsk.cpp` | Curt Coder's Commodore drives and the floppy subsystem | **BSD-3-Clause on every one of these files** (repo-level SPDX is NOASSERTION because MAME is mixed) | `// license:` line of each file |
| Clock Signal (`Machines/Commodore/1540/Implementation/C1540.cpp`, `C1540Base.hpp`, `Machines/Commodore/SerialBus.cpp`, `Components/6522/`, `Storage/Disk/`) | Thomas Harte's emulator; C1540 used by its VIC-20 and Plus/4 | **MIT** | repo licence |
| floooh/chips (`systems/c1541.h`, `chips/m6522.h`) | Header-only C chips | **zlib** | repo licence and headers |
| MiSTer `C64_MiSTer` (`rtl/iec_drive/*`) | FPGA C64 with 1541/1581 | no repo licence file; `iecdrv_via6522.vhd` says **GPL 3.0**; other files carry author credits only | file headers |
| 1541 Ultimate II (<https://github.com/GideonZ/1541ultimate>) | Gideon Zweijtzer's cartridge firmware/FPGA | GPL-3.0 | repo licence |
| Pi1541 (<https://github.com/pi1541/Pi1541>) | Cycle-exact 1541/1581 on a Raspberry Pi | GPL-3.0 | repo licence |
| Hoxs64 (<https://github.com/davidhorrocks/hoxs64>) | Windows C64 emulator | GPL-3.0 | repo licence |
| Denise (<https://sourceforge.net/projects/deniseemu/>) | C64/Amiga emulator by PiCiJi | GPLv3 (SourceForge project page) | project page, not a file header |
| nibtools (<https://github.com/rittwage/nibtools>) | Pete Rittwage's disk imaging tools (from Markus Brenner's MNIB) | GPL-3.0 | repo licence |
| g64conv (<https://github.com/markusC64/g64conv>) | G64 text converter | GPL-3.0 | repo licence |
| Bitfire (<https://github.com/bboxy/bitfire>) | Demo loader | **BSD-3-Clause** | repo licence |
| VICE test programs (mirror <https://github.com/libsidplayfp/VICE-testprogs>) | Test suite | no licence file (per-test authors) | repo API |
| Peter Schepers' format documents (<http://unusedino.de/ec64/technical/formats/g64.html>, `d64.html`) | G64/D64 descriptions (rev. 1.6, 2004) | documentation | read |

---

## §1 The 1541 hardware

### §1.1 Models and board revisions

From the parts and board notes in MAME `c1541.cpp` (header comment, which cites
<http://www.amiga-stuff.com/hardware/cbmboards.html>), the c64-wiki page
(<https://www.c64-wiki.com/wiki/Commodore_1541>) and Wikipedia (<https://en.wikipedia.org/wiki/Commodore_1541>):

| Model | Board(s) | Logic | ROM | Mechanism | Notes |
|---|---|---|---|---|---|
| VIC-1540 | 1540001-01/-03, 1540008-01 ("long board") | 6502, 2× 6522, discrete TTL read/write logic, 4× 2114 RAM | 325302-01 (C000) + **325303-01** (E000) | Alps | For the VIC-20; serial timing too fast for a C64 unless the VIC-II display is blanked (Wikipedia: badline CPU stalls break the timing) |
| VIC-1541 / 1541 (long board) | 1540001, 1540008 | as above | 325302-01 + 901229-01…-06 | Alps | Off-white case, 1982 |
| 1541 ("short board") | 1540048-01/-03, 1540049, 1540050, 251777, 251830 | 6502, 2× 6522, 2016 RAM, **64H105 40-pin gate array (325572-01)** | as above | Alps (-01) or Newtronics (-03) | |
| 1541A / 1541A-2 | 250442-01 / 250446-01 | as short board; jumper selects mechanism | as above | Alps or Newtronics | A2: 74LS123 replaces a 9602 |
| SX-64 built-in | 250410-01 | "most similar to 1540048-01" | MAME's `sx1541` set: 325302-01 + 901229-04/-05 | Alps | |
| 1541B / 1541C | 250448-01, 251854 | **64H156** gate array (42-pin) + **64H157** (20-pin) + R/W hybrid | single 16 KB 251968-01 / -02 | Newtronics with **optical track-0 sensor** | 1986; quieter |
| 1541-II | (MAME lists U-numbers) | 6502A, 2× 6522, **64H156 (40-pin, 251828-01)**, Sony CX20185 R/W amp | 16 KB 251968-03 or 355640-01 | Chinon FZ-501M (direct drive), Newtronics D500, others | 1988; external PSU |
| Oceanic OC-118, Indus GT, MSD, Blue Chip, Enhancer 2000 … | third-party | various clones | various | | *Note only*; out of scope |

Notes:

- MAME's comment says the 1541 ROMs are interchangeable between boards (the 1541-II ROM can be put into an
  original 1541); c64-wiki says the 1541C ROM cannot (the 1541C ROM uses the track-0 sensor). Kept both;
  see §11 D1.
- *Inference:* for emulation, the board revision matters through (a) the ROM, (b) the track-0 sensor
  (1541C only; MAME `c1541c_device`), (c) the header gap the ROM writes (§3.3) and (d) motor/mechanism
  speed stability. The read logic of the discrete long board and the 64H105/64H156 gate arrays is modelled
  identically by VICE and MAME (both name the counters after the long-board chips, §3.5).

### §1.2 Clocks

- The drive has its own **16 MHz crystal**. The 6502 and both VIAs run at 16 MHz / 16 = **1.000000 MHz**
  (MAME `c1541.cpp` device config: `XTAL(16'000'000)/16` for the CPU and both VIAs; the 64H156 is clocked
  at the full 16 MHz). Clock Signal also uses 1 000 000 Hz (`C1540.cpp`, `Storage::Disk::Controller(1000000)`).
- The host has an unrelated crystal. Nominal ratios (drive cycles per host cycle; host clocks from the host
  crystals, to be checked against the machine files of this pack):

  | Host | Host φ2 | Drive cycles per host cycle | 16.16 fixed-point factor |
  |---|---|---|---|
  | C64 PAL (17.734475 MHz / 18) | 985 249 Hz | 1.01497 | 66 517 |
  | C64 NTSC (14.31818 MHz / 14) | 1 022 727 Hz | 0.97778 | 64 079 |
  | VIC-20 PAL (4.433618 MHz / 4) | 1 108 404 Hz | 0.90220 | 59 126 |
  | VIC-20 NTSC | 1 022 727 Hz | 0.97778 | 64 079 |
  | C16/Plus/4 PAL, single clock (17.734475 / 20) | 886 724 Hz | 1.12775 | 73 908 |

  The last row is *inference* (TED clocking belongs to the TED file); the Plus/4 also runs at double clock
  outside the screen, which changes the ratio per line.
- VICE computes the factor as `65536 × 1 MHz / host cycles-per-second` and multiplies by the drive's clock
  multiple (1 for 1541/1571 at 1 MHz, 2 for 1551/1581/1571 at 2 MHz) (`drivesync.c`,
  `drive_set_machine_parameter`, `drivesync_factor`, `drivesync_clock_frequency`). The manual describes
  the same "sync factor" (<https://vice-emu.sourceforge.io/vice_6.html>, section 6.11).
- Crystal tolerance (tens of ppm) is irrelevant next to the **disk rotation speed**, which is set by a
  motor servo, not the crystal: VICE comments that a real drive runs anywhere from about 295 to 305 RPM
  with a fairly constant offset and small short-term variation (`rotation.c`, comment in
  `rotation_1541_gcr`). VICE bug #2093 records that ~320 RPM is about the maximum a real drive reaches
  (<https://sourceforge.net/p/vice-emu/bugs/2093>). nibtools measures the RPM of the real drive and adjusts
  track capacity (`readme.txt`, option `-c`).
- *Inference:* the crystal ratio is therefore a constant (one per host model), and all realistic
  "drift" is the rotation speed, which only affects the disk side (bits per drive cycle), not the
  CPU-to-CPU interleave.

### §1.3 Memory map (1541)

From MAME `c1541.cpp` (address map), Clock Signal `C1540.cpp` (`MachineBase::perform`) and VICE
(`drivemem.c`, not quoted):

| Range | Device | Notes |
|---|---|---|
| $0000-$07FF | 2 KB RAM | mirrored at $0800-$0FFF per MAME (*verify*; Clock Signal does not mirror) |
| $1800-$180F | VIA1 ("UC3"/"UAB1"): serial bus | mirrored through $1800-$1BFF |
| $1C00-$1C0F | VIA2 ("UC4"/"UCD4"): disk controller | mirrored through $1C00-$1FFF |
| $2000-$7FFF | open bus (VICE test `drive/openbus`) | VICE's `DriveNRAM2000`…`RAMA000` options add 8 KB RAM blocks here (drive RAM expansions used by e.g. some copiers/fast DOSes) |
| $8000-$BFFF | open bus or ROM mirror (*verify* per board) | |
| $C000-$FFFF | 16 KB ROM (2× 8 KB on early boards, 1× 16 KB on 1541C/-II) | |

Clock Signal returns $FF for unmapped reads; real open-bus behaviour is tested by VICE's `drive/openbus`
test (listed in `drive/readme.txt` of the test suite). *Open question OQ5.*

### §1.4 VIA1 ($1800): the serial bus

Port B bit layout (VICE `via1d1541.c` comment above `read_prb`; Clock Signal `SerialPortVIA::set_port_output`
and `set_serial_line_state`; MJK's "1541 map" text <https://ist.uwaterloo.ca/~schepers/MJK/ascii/1541map.txt>,
hardware part only):

| Bit | Dir | Signal |
|---|---|---|
| PB0 | in | DATA in (inverted: 1 = line pulled low) |
| PB1 | out | DATA out (1 = pull line low) |
| PB2 | in | CLK in |
| PB3 | out | CLK out |
| PB4 | out | **ATNA** (ATN acknowledge), feeds the XOR auto-acknowledge (§4.4) |
| PB5-PB6 | in | device number jumpers: 00 = 8, 01 = 9, 10 = 10, 11 = 11 |
| PB7 | in | ATN in |
| CA1 | in | **ATN in** (edge → IRQ, so the drive answers ATN within the 1 ms limit) |
| Port A | | unused on a stock 1541; the "parallel cable" mods (SpeedDOS, Dolphin DOS, ProfDOS) attach here (VICE `DriveNParallelCable`) |

VICE uses read mask $E5 and write mask $1A for these bits (same comment). On the **1571**, VIA1 port A is
used: PA0 track-0 sensor and PA7 BYTE READY on read (VICE `via1d1541.c`, `read_pra` for 1570/1571/1571CR;
MAME `c1571.cpp` `via0_pa_r`), PA1 fast-serial direction, PA2 side select, PA5 1/2 MHz, PA6 ATN out
(MAME `via0_pa_w`).

### §1.5 VIA2 ($1C00): the disk controller

| Bit / line | Dir | Signal | Sources |
|---|---|---|---|
| PB0-PB1 | out | stepper phase (STP); incrementing the 2-bit value by 1 steps one half-track inward, by 3 (−1) outward | Clock Signal `DriveVIA::set_port_output<B>`; MAME `c1551::port_w` (same STP bits on the 1551) |
| PB2 | out | spindle motor (MTR) | all |
| PB3 | out | activity LED | all; VICE test `drive/pwm` checks LED PWM dimming |
| PB4 | in | write-protect sensor (WPS); **0 = protected** in VICE and Clock Signal | VICE `drive-writeprotect.c`; Clock Signal `DriveVIA::set_is_read_only`; MJK's map says the opposite (§11 D4) |
| PB5-PB6 | out | density select DS1:DS0 (speed zone 0-3), wired to the read clock divider (§3.5) | VICE `rotation.c` (`ue7_dcba`), MAME `ds_w` |
| PB7 | in | SYNC (0 while the last 10 read bits were all 1) | all |
| Port A | in/out | the GCR byte: read latch (YB) or byte to write | all |
| CA1 | in | BYTE READY (edge latches port A if latching enabled; also flags CA1) | MJK map; MAME `byte_w` → `write_ca1` (on 1571) |
| CA2 | out | **SOE**: enables BYTE READY onto the 6502's SO pin | Clock Signal `DriveVIA::set_control_line_output` (CA2 → `set_cpu_overflow_`) |
| CB2 | out | read/write MODE: low = write | Clock Signal (CB2 low → write mode); MAME `oe` |

### §1.6 BYTE READY, the SO pin and `BVC *`

- The read/write logic raises BYTE READY every 8 bit cells after a SYNC ends (§3.5). With SOE (VIA2 CA2)
  high, BYTE READY drives the 6502's **SO** input; a falling edge on SO sets the V flag. DOS and every fast
  loader wait for a byte with a two-instruction loop of the form "branch-on-V-clear to itself, then clear
  V", and read port A afterwards.
- At the four bit rates a byte arrives every **26, 28, 30 or 32 drive cycles** (zone 3 → 0; 8 cells of
  3.25/3.5/3.75/4.0 µs, §3.1). GCR-on-the-fly decoders such as Bitfire's decode inside that window
  (Bitfire `README.md`, which describes table-driven decoding of quintuples "so fast that the checksumming
  … is also done on the fly"). *Inference:* the emulated SO edge must land on the exact drive cycle, and
  the CPU must sample SO with the real 6502's latency, or such loaders lose bytes.
- VICE models the delay from the byte boundary (in 16 MHz ref cycles) to the SO edge as the distance to
  the next 1 MHz cycle boundary, never less than 10 ref cycles (`rotation.c`, `so_delay` in
  `rotation_1541_gcr`). MAME models BYTE READY as a combinational output of the counters (low while the
  bit counter is 7, SOE is high and cell-counter bit 1 is clear) (`64h156.cpp`, `live_run`). The 6502
  side (when an SO edge becomes visible in V relative to the instruction) is a CPU-file question; *OQ1*.
- Clock Signal asserts the 6502 overflow line when 8 bits have been shifted and drops it on the next bit
  (`C1540.cpp`, `MachineBase::process_input_bit`).

### §1.7 Head and stepper

- 4-phase stepper driven by PB0-PB1; each phase change moves half a track. DOS uses whole tracks
  (two steps); protections use half-tracks (nibtools table: "Half Tracks … Big Five") and fat tracks
  (data written on track *n*, *n*+0.5 and *n*+1 so it reads anywhere; "Wide/Fat Tracks … early EA,
  Activision XEMAG") (nibtools `readme.txt`).
- Range: tracks 1-35 under DOS; the mechanism reaches about 40-42 (sources differ: §11 D2). G64 and P64
  define 84 half-tracks (track 1 to 42.5; P64 half-tracks 2..85, `p64.h` `P64FirstHalfTrack`,
  `P64LastHalfTrack`).
- The long/short-board 1541 has **no track-0 sensor**: DOS finds track 1 by stepping outward against the
  mechanical stop ("head knocking", Wikipedia). The 1541C and the 1571 have an optical track-0 sensor
  (MAME `c1541.cpp` notes; Wikipedia). *Inference:* the emulator must clamp the head at the stop and keep
  stepping silently, and may play a knock sound (VICE `DriveSoundEmulation`).
- What a head between two recorded tracks reads (a half-track with no data of its own) is an emulator
  decision; *OQ3*.

### §1.8 Motor, spin-up, write protect, disk change, LED

- MTR (PB2) switches the spindle. VICE's test suite has a `drive/inertia` test (motor inertia, listed in
  the suite's `drive` folder) and `drive/rpm` (rotation speed measurement). *OQ4*: real spin-up and
  spin-down times have not been found in a primary source.
- Write protect: PB4 reads the light barrier at the notch. **Disk change is detected through this
  sensor**: inserting or removing a disk interrupts the beam. VICE simulates the sequence on detach
  (PB4 = 0 for 0.6 s), between images (PB4 = 1 for 1.2 s) and on attach (PB4 = 0 for 1.8 s)
  (`drive-writeprotect.c`, `drive_writeprotect_sense`; constants `DRIVE_DETACH_DELAY`,
  `DRIVE_ATTACH_DETACH_DELAY`, `DRIVE_ATTACH_DELAY` = 3×200 000, 3×400 000, 3×600 000 drive cycles in
  `drive.h`). VICE's `drive/diskchange` test covers "various methods of detecting disk changes".
  *Inference:* a disk swap in the IDE must play this sensor sequence, not just replace the image.
- No disk: VICE reports "not protected" (PB4 = 1); with no media there is no flux, so the read logic
  produces only noise transitions (§3.6).
- The LED is PB3; the 1541-II/1541C have a separate power LED.

---

## §2 The VIA 6522 at cycle level (reusable for the VIC-20)

The VIC-20 has two VIAs (keyboard, joystick, serial bus, cassette, user port); the 1541 has two;
the 1571 two plus a CIA. One VIA implementation serves all of them.

### §2.1 Registers

From the MOS datasheet transcription (<https://ist.uwaterloo.ca/~schepers/MJK/ascii/6522-via.txt>):
0 ORB/IRB, 1 ORA/IRA (with handshake), 2 DDRB, 3 DDRA, 4 T1C-L, 5 T1C-H, 6 T1L-L, 7 T1L-H, 8 T2C-L,
9 T2C-H, A SR, B ACR, C PCR, D IFR, E IER, F ORA/IRA without handshake.

- **Port reads differ between A and B** (datasheet tables): reading port B returns ORB for pins set as
  outputs and the pin level for inputs; reading port A returns the **pin levels** for all bits. With input
  latching enabled (ACR bit 0 for A, bit 1 for B), the read returns the level captured at the last active
  CA1/CB1 edge.
- **ACR**: bits 7-6 T1 mode (00 one-shot, PB7 off; 01 free-run; 10 one-shot with PB7 pulse; 11 free-run
  with PB7 square wave); bit 5 T2 mode (0 one-shot timed, 1 count negative pulses on PB6); bits 4-2 the
  shift register mode (§2.3); bits 1-0 latch enables.
- **PCR**: bit 0 CA1 active edge (0 negative, 1 positive); bits 3-1 CA2 mode (input negative edge, input
  negative "independent" (IFR not cleared by port access), input positive, independent positive,
  handshake output, pulse output, manual low, manual high); bits 4 and 7-5 the same for CB1/CB2.
- **IFR**: bit 7 = any enabled flag set (IRQ), 6 T1, 5 T2, 4 CB1, 3 CB2, 2 SR, 1 CA1, 0 CA2. Writing 1s
  clears flags. **IER**: write with bit 7 = 1 sets, bit 7 = 0 clears the selected enables; reads with
  bit 7 = 1.
- Flags are cleared by side effects: T1 by reading T1C-L or writing T1C-H; T2 by reading T2C-L or
  writing T2C-H; CA1/CA2 by reading or writing port A (reg 1, not reg F; and not CA2 in "independent"
  mode); SR by reading or writing SR.

### §2.2 Timers

- **T1**: write T1L-L (via reg 4 or 6), then writing T1C-H (reg 5) copies both latches into the counter,
  clears the T1 flag and starts it. One-shot: the flag sets **N + 1.5 cycles** after the write (datasheet
  timing figure "N + 1.5 CYCLES"); the counter keeps decrementing after time-out but the flag will not set
  again until T1C-H is rewritten. Free-run: after the first N + 1.5 the period is **N + 2 cycles**, the
  counter reloading from the latch on each time-out (datasheet figure "N+1.5 … N+2 CYCLES"; jsbeeb's
  analysis <https://www.xania.org/201406/jsbeeb-getting-the-timings-right-interrupts-and-timers> agrees and
  places the reload half a cycle after the flag). Writing the latches in free-run changes the next period
  without disturbing the current one.
- floooh's `m6522.h` (zlib) follows the 6502.org analysis
  (<http://forum.6502.org/viewtopic.php?f=4&t=2901>, cited in its source) that **T1 always reloads from the
  latch on underflow, in one-shot mode too**, and that the counter reaches $FFFF before the reload
  (`_m6522_tick_t1`). It delays counting and the IRQ output through small per-cycle pipelines
  (`_m6522_tick_pipeline`): the load-to-count delay and a one-cycle delay from flag to IRQ output.
- **PB7**: in T1 modes 10/11 PB7 is driven by the timer (low during the one-shot, toggling in free-run),
  overriding DDRB bit 7. The VIC-20 tests `VIC20/via_pb7` exercise this.
- **T2**: 8-bit low latch; writing T2C-H loads the counter and clears the flag. One-shot only (the flag
  sets once; the counter then wraps and keeps counting; it **never reloads**, per the datasheet and
  `m6522.h` `_m6522_tick_t2`). In pulse-counting mode it decrements on each negative edge of PB6.
  T2's low byte also clocks the shift register in the T2 modes (§2.3).
- floooh's T2 code carries a "6526-style Timer B bug?" FIXME: whether T2 has any underflow quirk is open
  there (*OQ6*).

### §2.3 Shift register

ACR bits 4-2 (datasheet): 000 disabled; 001 shift in at T2 rate; 010 shift in at φ2; 011 shift in on
external CB1 clock; 100 shift out free-running at T2 rate; 101 shift out at T2 rate (8 bits); 110 shift
out at φ2; 111 shift out on external CB1. CB1 is the clock (output in internal modes), CB2 the data.

- **The famous bug**: an external CB1 edge arriving close to the falling edge of φ2 is missed, losing a
  bit (Wikipedia <https://en.wikipedia.org/wiki/MOS_Technology_6522>, workaround: resynchronise CB1 with a
  flip-flop clocked by φ2). Wikipedia and Butterfield (quoted there) tie the slow software-driven IEC bus
  of the VIC-20 to a shift register problem (§11 D7).
- **Implementation status**: floooh `m6522.h` does **not** implement the shift register (`case
  M6522_REG_SR: /* FIXME */`, "FIXME: shift-in/out on CB1"); CA2/CB2 pulse-output timing is also marked
  FIXME. VICE's suite lists "VIA serial shift register test" as TODO for drives but has `VIC20/via_sr`.
  The 1541 DOS does not use the SR; some fast loaders and the VIC-20 user port can. *Inference:* the SR is
  needed for VIC-20 completeness, rarely for the 1541.

### §2.4 Handshake lines

- CA1/CB1 are edge inputs that set IFR bits and (if enabled) latch the port. CA2/CB2 are inputs or
  outputs; in handshake mode CA2 goes low on a port A read/write and back high on the next active CA1 edge;
  in pulse mode it goes low for one cycle after the access (`m6522.h` `_m6522_update_cab`; datasheet).
- On the 1541 VIA2, CA2 and CB2 are used as **manual outputs** (SOE, MODE) (§1.5). On the VIC-20, CA2 and
  CB2 of the keyboard VIA drive the serial CLK and DATA out lines (inverted) (Clock Signal `Vic20.cpp`,
  `set_control_line_output`).

### §2.5 Quirks emulators model, and test material

- Reset clears all registers except the timers' latches/counters and the SR (datasheet: "except T1 and T2
  latches and counters and the Shift Register"); `m6522.h` sets latches to $FFFF at init.
- One-cycle IRQ-output delay after a flag sets (`m6522.h` interrupt pipeline). The VICE suite has a
  `drive/interrupts` test and `VIC20/via_t1irqack`, `via_t1crash`, `via_wrap`, `via_defaults`,
  `via_mapping`, and `drive/viavarious` (14 reference-checked programs, "ported from André Fachat's
  ciavarious") (`drive/readme.txt`, folder listing of the mirror).
- MiSTer's VIA (`iecdrv_via6522.vhd`, Gideon Zweijtzer, GPL-3.0) states that "a lot of reverse
  engineering" went into it; facts only.
- Clock Signal's VIA (MIT, `Components/6522/`) has a `6522Tests.swift` test file and is usable as a
  permissive reference.

---

## §3 The disk surface

### §3.1 Speed zones and bit cells

The read/write clock divides 16 MHz by 16 − DS (DS = density bits, VIA2 PB6-PB5), and one bit cell is
four such divided periods (MAME `d64_dsk.cpp` `cell_size`: "16MHz/16/4", "/15/4", "/14/4", "/13/4";
VICE `rot_speed_bps`):

| Zone (DS) | Divider | Cell | Bit rate | Bits per rev at 300 RPM | Bytes per rev | Drive cycles per byte | DOS tracks | Sectors |
|---|---|---|---|---|---|---|---|---|
| 3 | 13 | 3.25 µs | 307 692 | 61 538 | 7 692 | 26 | 1-17 | 21 |
| 2 | 14 | 3.50 µs | 285 714 | 57 143 | 7 143 | 28 | 18-24 | 19 |
| 1 | 15 | 3.75 µs | 266 667 | 53 333 | 6 667 | 30 | 25-30 | 18 |
| 0 | 16 | 4.00 µs | 250 000 | 50 000 | 6 250 | 32 | 31-35 (and 36-42) | 17 |

Total 683 sectors on 35 tracks (D64 document). nibtools' `gcr.h` gives the same capacities as bytes per
minute (`DENSITY3` 2 307 692 … `DENSITY0` 1 875 000). Wording varies: Schepers' G64 document calls zone 3
both the "slowest writing speed" and (implicitly) the 7692-byte zone; §11 D3.

### §3.2 GCR 4-to-5 encoding

Each nibble becomes 5 bits so that no code word, or pair of code words, contains more than two 0s in a row
(the read logic needs a flux transition at least every third cell), and no pair contains 10 or more 1s
(which would be a SYNC). Table (nibble → 5-bit code, binary):

| Nibble | Code | Nibble | Code | Nibble | Code | Nibble | Code |
|---|---|---|---|---|---|---|---|
| 0 | 01010 | 4 | 01110 | 8 | 01001 | C | 01101 |
| 1 | 01011 | 5 | 01111 | 9 | 11001 | D | 11101 |
| 2 | 10010 | 6 | 10110 | A | 11010 | E | 11110 |
| 3 | 10011 | 7 | 10111 | B | 11011 | F | 10101 |

Checked by decoding the header bytes in Schepers' G64 sample (`52 54 B5 29 4B 7A 5E 95 55 55` → $08,
checksum $01, sector 0, track 1, ID $58 $58, $0F $0F; the checksum equals the XOR of sector, track and
IDs) and by verifying the two run-length properties over all 256 code pairs (longest 1-run across a pair:
8; no "000"). Four data bytes become five GCR bytes. 16 of the 32 code words are illegal; reading one
gives DOS error 24 (§6.2).

### §3.3 Sector layout as written by DOS

From the G64 document (Schepers, "Analysing the GCR data stream") and nibtools `gcr.h`:

1. Header SYNC: 40 one-bits (5 × $FF raw); hardware needs only 10.
2. Header, 10 GCR bytes = 8 bytes: $08, checksum (XOR of sector, track, ID2, ID1), sector, track, ID2,
   ID1, $0F, $0F.
3. Header gap: **9** bytes of $55 on later ROMs, **8** on early 1540/1541 ROMs (the difference caused
   write incompatibility with 4040 disks; Schepers names the fixing ROM "901225-3", which looks like a
   typo for a 901229 part, §11 D5). nibtools: "this must be 9 or 1541 will corrupt the sector if written".
4. Data SYNC: 40 one-bits. **DOS rewrites this SYNC and everything after it when it writes a sector**;
   the header is never rewritten except by FORMAT.
5. Data block, 325 GCR bytes = 260 bytes: $07, 256 data bytes, checksum (XOR), $00, $00.
6. Tail (inter-sector) gap of $55: varies with zone, drive speed and even/odd sector; the document gives
   "4 to 12" in its layout list and "4 to 19" (8-19 measured) in the text (§11 D3). Measured on a
   clean disk: even/odd tail gaps 9/9 (zone 3), 9/19 (zone 2), 9/13 (zone 1), 9/10 (zone 0).

The **write splice** (where a rewritten data block meets the old track) and the end-of-track overlap after
FORMAT are where track lengths differ from the ideal; MAME's D64 loader models a track skew between tracks
(`d64_dsk.cpp`, `get_track_skew`) and a write-splice position.

### §3.4 What the head reads: flux, not bits

- Recording is NRZI-like: a **1 cell holds a flux reversal, a 0 cell holds none** (VICE `rotation.c`;
  MAME `64h156.cpp`; P64 stores pulse positions). Bits are recovered by the read clock (§3.5), so the
  drive never sees "bytes" on the disk, only reversal times.
- **Sector-level** emulation (a D64 decoded into sectors, served by trapping DOS) cannot run protections or
  custom formats. **GCR bit-stream** emulation (G64-style: a circular bit string per half-track, each 1
  bit becoming a reversal at a fixed cell spacing) runs nearly everything that does not depend on
  analogue effects. **Flux-level** emulation (P64 or MAME's flux tracks: reversal positions at 16 MHz or
  finer resolution, independent of any cell size) also represents density changes inside a track,
  overlong/short cells and missing reversals exactly.
- Both VICE and MAME, when playing a G64, spread the track's bits evenly over one revolution: the cell
  length comes from the **stored track length**, not from the speed-zone byte. VICE: a bit every
  `ref-cycles-per-rev / (8 × track bytes)` ref cycles (`rotation_1541_gcr`: `count_new_bitcell`,
  `cyc_sum_frv`). MAME: "the declared density is not used to time the cells either way", and per-byte
  speed tables (zone value > 3) are ignored (`g64_dsk.cpp`). *Inference:* a G64 track that was written at
  one density but is read with the drive set to another still decodes as on hardware, because the read
  clock (§3.5) recovers whatever timing the flux has.
- VICE also has a "simple" byte-level rotation for perfect images (`rotation_1541_simple`, comment: "very
  simple and fast emulation for perfect images like those coming from dxx files"), and a P64 path
  (`rotation_1541_p64`) which ignores the RPM and wobble settings (FIXME there).

### §3.5 The read logic: clock recovery, SYNC and byte framing

The long-board schematic names (used by VICE's and MAME's models): **UE7**, a 74LS193 4-bit counter
clocked at 16 MHz and reloaded with DS on every flux reversal (and on carry); **UF4**, a second 4-bit
counter clocked by UE7's carry; a 10-bit read shift register; UE3 the bit counter. Behaviour as modelled
by VICE (`rotation.c`, `rotation_1541_gcr`, fields `ue7_counter`, `uf4_counter`, `ue7_dcba`) and MAME
(`64h156.cpp`, `live_run`, `cycle_counter`, `cell_counter`, `bit_counter`), which agree:

1. On a (filtered) flux reversal: UE7 ← DS, UF4 ← 0.
2. Each 16 MHz tick: UE7 += 1; when it reaches 16 it reloads DS and UF4 += 1 (mod 16). So UF4 advances
   every 16 − DS ref cycles, four times per bit cell.
3. When UF4 bit 1 rises (UF4 goes 1→2, 5→6, 9→10, 13→14), a bit is shifted into the read register. The
   bit is **1 only at the first such point after a reversal** (UF4 = 2, i.e. bits 3-2 of UF4 clear) and
   0 at the later ones. A reversal therefore yields a 1 about half a cell after it; each further 4
   UF4 steps without a reversal yields a 0. This is the **clock recovery**: the cell grid re-phases on
   every reversal, and a reversal arriving early or late shifts the grid instead of corrupting a bit.
4. **SYNC** = the last 10 bits read are all 1 (and the logic is in read mode). SYNC holds the bit counter
   in its reset state (MAME loads it so the next byte starts cleanly; VICE resets `bit_counter`), so no
   BYTE READY is produced during a SYNC. Clock Signal does the same with a 10-bit mask
   (`process_input_bit`).
5. After SYNC ends, every 8th bit completes a byte: port A shows the low 8 bits of the shift register and
   BYTE READY fires (if SOE). The byte boundary is fixed by the SYNC's end, so data after a SYNC is
   always byte-aligned, and data without a preceding SYNC is framed wherever the counter happens to be.
6. Writing (CB2 low): the byte from port A is loaded into a write shift register at the same byte
   boundary and shifted out one bit per cell; a 1 produces a reversal (MAME `load`, `write_next_bit`;
   VICE `last_write_data`). In MAME, in read mode the write register is loaded from the read register;
   this is the hardware quirk behind reading the "last byte" after switching to write (*inference from
   MAME's model*).

**Time-domain filter**: both models ignore a reversal that comes within **2.5 µs (40 ref cycles)** of the
previous accepted one (VICE `filter_counter` vs 40; MAME `CYCLES_TIME_DOMAIN_FILTER 40`).

### §3.6 Weak bits, "no flux" areas and killer tracks

- When no reversal reaches the decoder for about **18 µs**, the read amplifier's automatic gain control
  has turned the noise up far enough that the peak detector produces reversals of its own. Both VICE and
  MAME model this: the first random reversal after 289-319 ref cycles of silence, then further ones every
  33-399 ref cycles, from an xorshift generator (VICE `fr_randcount`; MAME `get_next_bit`,
  `CYCLES_UNTIL_ANALOG_DESYNC 288 // 18 us`). The numbers, and the generator's seed value, are the same in
  both (*inference*: one model derives from the other or both from the same measurement; see §8.2 on
  provenance).
- **Weak bits / unformatted areas**: a region with no (or too few) reversals reads as different random
  data on each pass. Protections (RapidLok, Datasoft, Rainbow Arts, Mindscape, per nibtools' table) read
  such an area twice and require the results to differ. In a G64 such an area is stored as a run of
  zero bits (three or more 0s are illegal GCR, so the emulator's silence model takes over); nibtools
  writes $00 bytes for "bad GCR" by default ("drive will read semi-random values", option text in
  `readme.txt`).
- **Killer tracks**: a track that is all SYNC ($FF everywhere) holds SYNC forever, so no byte is ever
  framed; DOS times out ("ALL sync marks (killer) … Br0derbund" in nibtools' table; nibtools `-k` skips
  them because some drives time out). Error 21 is "no SYNC within 20 ms" (D64 document). No special
  emulation is needed beyond §3.5 step 4, but images must be able to store them.
- Other protections listed by nibtools, each of which only a bit- or flux-level model can pass: tracks
  35-40, half-tracks, fat tracks, long tracks (more data than fits at nominal RPM), slowed-motor tracks,
  sync counting, non-standard bit rates (V-MAX!, RapidLok), **bit-rate changes inside a track**
  (Chessmaster 2100; "cannot be written"), no sync marks, short (10-bit) syncs, and **track-to-track
  synchronisation** (RapidLok). The last needs the relative angular position of tracks to be preserved
  (*inference*: G64 has no field for it; nibtools aligns tracks heuristically, options `-a*` and
  `ALIGN_*` constants in `gcr.h`).
- The VICE suite's `drive/hls-protection` and `drive/skew` (track skew and block distribution) target
  these effects.

### §3.7 Rotation speed modelling

- VICE: `DriveNRPM` (RPM × 100; 30000 = 300.00), `DriveNWobbleFrequency` (1000 = 1 Hz) and
  `DriveNWobbleAmplitude` (1000 = ±1 RPM) (manual §6.11); `rotation_do_wobble` adds a sinusoidal
  wobble with a small random component to the reference cycles per revolution (`rotation.c`). Defaults are
  not stated in the manual (*OQ4*).
- A Denise tracker issue reports a protection that fails at 300 RPM and works at 306 RPM
  (<https://bitbucket.org/piciji/denise/issues/6/setting-for-drive-rpm-is-missing>, search snippet; not
  opened). *Inference:* the emulator needs a configurable RPM and wobble, and tests should run at more
  than one speed.

---

## §4 The IEC serial bus

### §4.1 Lines and electrical model

Six-pin DIN: SRQ, GND, ATN, CLK, DATA, RESET (MAME `cbmiec.cpp` header; pagetable
<https://www.pagetable.com/?p=1135>). All signal lines are **open collector, wired-AND**: any device pulls
a line low, a released line floats high, and nobody can tell how many are pulling. All are active low.
SRQ is unused by the C64 (CIA1 FLAG input); the C128 uses it as the fast-serial clock (§4.6). RESET resets
the drives (VICE `IECReset`).

Host wiring:

- **C64**: CIA2 port A (`$DD00`): bit 3 ATN out, 4 CLK out, 5 DATA out, 6 CLK in, 7 DATA in (common
  knowledge; to be cited from the CIA/C64 file of this pack).
- **VIC-20**: VIA1 port A bit 7 → ATN out (inverted), VIA1 PA0/PA1 read CLK/DATA; VIA2 CA2 → CLK out and
  CB2 → DATA out (inverted) (Clock Signal `Vic20.cpp`, `set_port_output`, `set_control_line_output`,
  `set_serial_line_state`). The VIC-20's bus is **entirely VIA-driven**, so the bus timing depends on the
  VIA model of §2.
- **C16/Plus/4**: the serial bus is on the **CPU's built-in I/O port** (7501/8501 at $00/$01), not on TED:
  bit 0 DATA out, bit 1 CLK out, bit 2 ATN out, bit 6 CLK in, bit 7 DATA in (Clock Signal `Plus4.cpp`).
  The task brief called it a "TED port"; the source says CPU port (§11 D8). The 1551 is a parallel drive
  on the expansion port (§5.3).

### §4.2 Standard (KERNAL) byte transfer

Paraphrased from pagetable "Commodore Peripheral Bus: Part 4: Standard Serial" (Michael Steil):

1. Idle between bytes: sender holds CLK, receivers hold DATA.
2. Sender releases CLK ("ready to send"). Each receiver releases DATA when ready; DATA rises when the
   last one does ("ready for data").
3. For each of 8 bits, LSB first: sender pulls CLK, puts the bit on DATA (released = 1), waits, releases
   CLK (bit valid); receivers sample DATA while CLK is released.
4. After bit 8 the sender pulls CLK and releases DATA; a receiver must pull DATA within 1000 µs (frame
   acknowledge), or the sender reports a timeout.
5. At least 100 µs later the next byte may start.

**EOI**: the sender marks the last byte by not starting step 3 for more than 200 µs after "ready for
data"; the receiver acknowledges by pulling DATA for at least 60 µs, then the sender sends the last byte
normally. Empty stream: the sender waits more than 512 µs.

**Timing table** (Commodore's, reproduced in MAME `cbmiec.cpp` and VICE's old `serial.txt`):

| Symbol | Meaning | Min | Typ | Max |
|---|---|---|---|---|
| Tat | ATN response (required) | | | 1000 µs |
| Th | listener hold-off | 0 | | ∞ |
| Tne | non-EOI response to RFD | | 40 µs | 200 µs |
| Ts | bit set-up (talker) | 20 µs | 70 µs | |
| Tv | data valid | 20 µs | 20 µs | |
| Tf | frame handshake | 0 | 20 µs | 1000 µs |
| Tr | frame to release of ATN | 20 µs | | |
| Tbb | between bytes | 100 µs | | |
| Tye | EOI response | 200 µs | 250 µs | |
| Tei | EOI response hold | 60 µs | | |
| Try | talker response limit | 0 | 30 µs | 60 µs |
| Tpr | byte acknowledge | 20 µs | 30 µs | |
| Ttk | talk-attention release | 20 µs | 30 µs | 100 µs |
| Tdc | talk-attention acknowledge | 0 | | |
| Tda | talk-attention ack. hold | 80 µs | | |
| Tfr | EOI acknowledge | 60 µs | | |

Notes in the same table: Tv and Tpr must be at least 60 µs for an external device to act as talker; Tei
at least 80 µs for it to be a listener. Steil: the C64 holds CLK about 42 µs and the 1541 about 74 µs per
bit; device-to-host throughput is under 1 KB/s (Wikipedia: about 512 bytes/s for DOS loads; c64-wiki:
about 300 bytes/s). §11 D9 for the EOI figure.

### §4.3 ATN, commands and turnaround

- The controller pulls ATN at any time, pulls CLK, releases DATA and sends command bytes (LISTEN $20+n,
  UNLISTEN $3F, TALK $40+n, UNTALK $5F, secondary $60+sa, CLOSE $E0+sa, OPEN $F0+sa). Every device must
  pull DATA within 1000 µs or the host reports DEVICE NOT PRESENT. Releasing ATN ends the command phase.
- **Turnaround** after TALK: the controller (now listener) pulls DATA and releases CLK; the device (now
  talker) sees CLK released, pulls CLK and releases DATA (pagetable, "Turnaround").

### §4.4 The 1541's ATN hardware

- ATN in is inverted and goes to VIA1 PB7 and **CA1** (the CA1 edge makes an IRQ, so the drive reacts to
  ATN even in the middle of a disk job).
- **Auto-acknowledge**: an XOR gate compares ATN in with ATNA (VIA1 PB4); when they differ, the drive pulls
  DATA, independent of software. So when ATN is asserted and the drive has not yet acknowledged (ATNA = 0),
  DATA goes low within gate delays, which satisfies Tat even if the CPU is busy. The drive's software sets
  ATNA to match and then drives DATA itself. Modelled as "DATA pulled if PB1 set, or ATN-in ≠ ATNA" in
  Clock Signal (`SerialPortVIA::update_data_line`, which quotes the schematic's description of ATN going to
  PB7 and CA1 after inversion) and VICE (`via1d1541.c`, the `iec_drive_write` paths).
- *Inference:* the auto-acknowledge is combinational. An emulator must recompute the drive's DATA output
  when the **host** changes ATN, without running the drive CPU, or the host can see a "device not present"
  that a real drive would never cause, or miss the effect in fast loaders that toggle ATN as a sync
  signal.

### §4.5 Fast loaders and why both CPUs must be cycle-exact

- Fast loaders upload code into the drive (M-W/M-E), then exchange data **without per-bit handshakes**:
  typically 2 bits per step on CLK and DATA, the receiver sampling at fixed cycle offsets after one
  synchronising edge (often on ATN or CLK) (*general knowledge, not taken from a single source*; Bitfire's
  README mentions table-swapped bit orders "better suited to a specific method of serial transfer").
  Throughput goes from about 0.3-0.5 KB/s to about 10 KB/s (c64-wiki) or more.
- The sender writes a new bit pair every few cycles; the receiver reads 4 times per byte with only a
  handful of cycles of margin. Both sides were written for both PAL (0.985 MHz) and NTSC (1.023 MHz) hosts
  against a 1.000 MHz drive, so the protocols tolerate the ~2% clock difference within one byte and re-sync
  per byte or per block. On the C64 the host side must also avoid VIC-II badlines (40 stolen cycles) or
  blank the screen (the 1540-on-C64 story, Wikipedia) (*inference about the tolerances*).
- *Inference (architecture):* the IEC lines must be **time-stamped to the cycle on both sides**. When one
  side reads the bus at its cycle *t*, the other side must have run exactly up to *t* in common time, no
  further and no less; a whole-instruction overshoot by the drive (2-7 cycles) is the same size as a
  loader's margin. §9 lists the ways emulators do this.
- VICE's test `drive/iecdelay` ("IEC bus delay test, original program by Jochen Adler") and the
  `readtest` fast-load-and-checksum loop exist for exactly this.

### §4.6 C128 fast serial, burst mode, the 1571

- Fast serial uses the host's **CIA1 serial port**: SP carries data on the DATA line and CNT carries the
  clock on **SRQ**, through a driver whose direction the MMU controls (FSDIR in MMU register 5, $D505; the
  bit number was not confirmed) (C128 System Guide via manualslib page 453; c64-wiki "Fast serial bus
  protocol" <https://c64-wiki.com/wiki/Fast_serial_bus_protocol>; c65gs blog 2024-01).
- Bit time: about 10 µs from the C128 (5 µs low, 5 µs high on SRQ), about 7 µs from the 1571 (c64-wiki).
  A device announces fast capability by toggling SRQ during the ATN phase (*inference from the protocol
  descriptions*; *OQ8*). "Burst mode" is the same hardware driven by special `U0` commands.
- On the 1571 side the drive's **CIA 6526 at $4000** provides SP/CNT, with VIA1 PA1 setting the
  fast-serial direction (MAME `c1571.cpp`, `cia_sp_w`, `cia_cnt_w`, `via0_pa_w`).
- *Inference:* fast serial needs the C128's and the 1571's CIA serial ports with correct CNT/SP edges; it
  does not need anything beyond the CIA model of the C64 file.

### §4.7 Parallel cables

Many fast DOSes (SpeedDOS, Dolphin DOS 3, Formel 64, ProfDOS) add a parallel cable from the C64 user port
to the drive's VIA1 port A. VICE supports None/Standard/Dolphin DOS 3/Formel64 for the C64 family and
Standard for the Plus/4 (`DriveNParallelCable`, manual §6.11). MiSTer's C64 has a parallel cable for
DolphinDOS ("about 20x", README). *Inference:* it is cheap once VIA1 port A is wired, but optional.

---

## §5 Related drives

### §5.1 1570 / 1571 (C128)

- 6502 at **1 or 2 MHz** (16 MHz / 16 or / 8, chosen by VIA1 PA5), 2 KB RAM, VIA1 $1800, VIA2 $1C00,
  **WD1770 at $2000** (8 MHz), **CIA 6526 at $4000**, 32 KB ROM $8000-$FFFF, the same **64H156** gate array
  for GCR (MAME `c1571.cpp` address map and config). Double-sided (side select VIA1 PA2), track-0 sensor
  (VIA1 PA0), BYTE READY also readable on VIA1 PA7.
- The **native 1571 format is GCR** on both sides (D71 = two D64 sides, §6). The WD1770 is used only for
  MFM formats (CP/M, foreign disks). *Inference:* a 1571 is the 1541 model plus side select, the 2 MHz
  switch (the disk logic's timing stays in 16 MHz ref cycles, but the drive/host clock ratio doubles), a
  CIA and a WD1770.
- 1570 = single-sided 1571. 1571CR (built into the C128DCR) uses a 5710 combo chip (VICE resource
  `DosName1571cr`, drive type 1573; *details OQ9*).
- VICE's `drivesync_set_1571` re-initialises the rotation code on the 1/2 MHz switch.

### §5.2 1581 (3.5")

- 6502 at **2 MHz** (16 MHz / 8), 8 KB RAM (mirrored), **CIA 8520 at $4000**, **WD1772 at $6000**,
  32 KB ROM at $8000 (MAME `c1581.cpp`). MFM, 80 tracks × 2 sides × 10 × 512-byte sectors, presented to
  DOS as 40 × 256-byte logical sectors per track; D81 (§6.6). Burst/fast serial through the CIA.
- No GCR. *Inference:* sector-level MFM is enough for almost all 1581 software.

### §5.3 1551 (C16/Plus/4, parallel)

- **6510T at 2 MHz** (16 MHz / 8): its on-chip I/O port drives the stepper (P0-P1), motor (P2), LED (P3)
  and density (P5-P6) — the same signals as the 1541's VIA2 PB, moved to the CPU port. The same 64H156 read
  logic. A **6523/6525-family TPI at $4000** carries the parallel byte to the host's interface (MAME
  `c1551.cpp`, `port_w` comment, `TPI6525` config, address map). 2 KB RAM, 16 KB ROM 318001-01 at $C000.
  A PLA (251641-03) is not dumped (MAME `NO_DUMP`).
- *Note only* (task scope): it shares the disk side and the 6502 core with the 1541; the bus side is a
  different, parallel protocol (the TCBM bus, VICE `drive/tcbm`).

### §5.4 IEEE-488 drives

2031 (a 1541 with IEEE-488), 2040/3040/4040, 8050/8250/SFD-1001: PET family, out of scope. VICE emulates
them (`DosName2031` … `DosName1001`).

### §5.5 Reuse of Klive's WD1793

`src/emu/machines/common/wasm/wd1793.c` is a shared C implementation (Beta 128, TVC HBF, Enterprise
EXDOS as 1770, SAM Coupé as 1772) with `WD1793_VARIANT` 1793/1770/1772; the 1770/1772 variants model
motor-on instead of READY/head-load, the six-revolution spin-up and the 1772 step rates (file header). It
is **lazy** (plays due events on every port access) and holds disks in a **canonical sector layout**
(cylinder-major, two sides, a fixed number of fixed-size sectors per track) (file header). *Inference:*
it fits the 1581 (10 × 512 per side) and the 1571's MFM mode for standard formats directly; it does not
represent per-track sector counts, non-standard sector sizes or raw MFM tracks, so MFM-level protection
on 1571/1581 disks would need more (rare; *OQ10*). It shares nothing with the 1541's GCR path.

---

## §6 Disk image formats

### §6.1 Summary

| Format | Level | Preserves protections? | Source |
|---|---|---|---|
| D64 | sectors (+ optional error byte per sector) | only read errors and tracks 36-40 | §6.2 |
| G64 | GCR bit stream per half-track, speed zone per track or per byte | nearly all, except weak-bit physics, density changes inside a track (if the emulator ignores per-byte zones), inter-track alignment | §6.3 |
| NIB / NBZ | raw track reads from a real drive (nibtools), 8 KB per half-track, density per track; NBZ = LZ-compressed NIB | the raw capture; converted to G64 for use | §6.4 |
| P64 | flux reversal positions (3 200 000 per revolution, i.e. 16 MHz at 300 RPM) per half-track, with strengths; range-coded | everything a flux capture can hold | §6.5 |
| D71 / G71 | 1571 double-sided D64 / G64 | as D64 / G64 | §6.6 |
| D81 | 1581 sectors | n/a | §6.6 |

nibtools estimates about **99%** of protected originals convert to working G64 images; MiSTer's README
says G64 "can accurately represent over 90%" of protected software. Both are claims, not measurements.

### §6.2 D64

(Schepers <http://unusedino.de/ec64/technical/formats/d64.html>.) Sectors in track order, 256 bytes each,
track 1 at offset 0; 35 tracks = 683 sectors. File sizes: 174 848 (35 tracks), 175 531 (35 + 683 error
bytes), 196 608 (40 tracks), 197 376 (40 + 768 error bytes). VICE and others also accept 42 tracks
(205 312 / 206 114 with errors, *by the same arithmetic; inference*). One error byte per sector, values
are the drive controller's codes, not DOS error numbers:

| Code | DOS error | Meaning |
|---|---|---|
| 01 | 00 | OK |
| 02 | 20 | header not found |
| 03 | 21 | no SYNC |
| 04 | 22 | data block ID ($07) not found |
| 05 | 23 | data checksum |
| 06 | 24 | see §11 D10: "write verify (on format)" (Schepers) vs "bad GCR code" (nibtools `gcr.h`) |
| 07 | 25 | write verify |
| 08 | 26 | write protect |
| 09 | 27 | header checksum |
| 0A | 28 | write error / long data block |
| 0B | 29 | disk ID mismatch |
| 0F | 74 | drive not ready |

Turning a D64 into a GCR track for true drive emulation: MAME `d64_dsk.cpp` builds each track from the
sector descriptions with zone-dependent gaps and models the errors and a track-to-track skew; VICE does the
equivalent (`diskimage` code, not read). *Inference:* errors like 21/23/27 are synthesised by corrupting
the generated GCR (missing sync, wrong checksum), which is how a protection's read-error check passes.

### §6.3 G64

(Schepers <http://unusedino.de/ec64/technical/formats/g64.html>, rev. 1.6, 2004; defined 1998 by Per
Håkan Sundell (CCS64), Andreas Boose (VICE) and Joe Forster/STA.)

- Header: "GCR-1541" (8 bytes), version byte ($00), number of track entries (usually 84 = tracks 1 to
  42.5 in half steps), maximum stored track size (usually 7928, i.e. 7692 + ~3% for slow drives).
- 84 × 4-byte track offsets (0 = no data for this half-track), then 84 × 4-byte speed entries: a value
  0-3 is the zone for the whole track; a larger value is a file offset to a per-byte speed table (1982
  bytes, 2 bits per GCR byte).
- Each track: 2-byte actual length, then the raw GCR bytes; the rest of the slot is filler.
- MNIB's nominal track lengths: 7692 / 7142 / 6666 / 6250 bytes for zones 3 / 2 / 1 / 0.
- Limitations (*inference*, partly from nibtools' alignment options): the bit stream starts at an
  arbitrary angle on each track, so track-to-track position is lost unless the writer aligned it; weak
  areas are represented only as runs of zeros; MAME ignores per-byte speed tables (§3.4).
- A "G71" variant exists for 1571 images (VICE supports it; signature "GCR-1571" per common usage,
  *unverified, OQ11*).

### §6.4 NIB and NBZ

From nibtools (`fileio.c`, `gcr.h`, `readme.txt`): header signature "MNIB-1541-RAW", a 256-byte header
with a (track, density) table from offset $10, then **8192 bytes ($2000) per stored track**, which is a raw
read of more than one revolution; nibtools converts NIB/NBZ to G64 or D64 (`nibconv`), finding the track
cycle and alignment heuristically. NBZ is NIB compressed with the bundled LZ (`lz.c`). Pi1541 accepts
D64, G64, NIB and NBZ (README). *Inference:* NIB is a preservation format; an emulator can load it by
running the same cycle detection, or ask the user to convert.

### §6.5 P64

- Defined by Benjamin "BeRo" Rosseaux (2011-2012); reference implementation in VICE `src/lib/p64/` under
  the **zlib licence** (file header) — directly usable.
- Per half-track (2..85), a list of pulses, each with a 32-bit position in units of 1/3 200 000 of a
  revolution (`P64PulseSamplesPerRotation 3200000`, i.e. one 16 MHz ref cycle at 300 RPM) and a strength;
  the file is range-coded with CRC32 checks (`p64.c`).
- VICE's P64 path ignores RPM/wobble (FIXME in `rotation.c`).
- *Inference:* P64's resolution equals the 16 MHz ref clock of §3.5, so a P64 track can be fed to the
  UE7/UF4 model reversal by reversal with no resampling at nominal speed.

### §6.6 D71, D81

- D71: two D64 sides, 70 tracks, 349 696 bytes (351 062 with 1366 error bytes) (*arithmetic; the D71
  document was not fetched*), BAM for side 2 on track 53.
- D81: 80 tracks × 40 logical 256-byte sectors = 819 200 bytes (822 400 with error bytes), header/BAM on
  track 40 (*from general knowledge; to verify against Schepers' D81 document, OQ11*).

### §6.7 The 1541 DOS file system (for an IDE file browser)

(D64 document.)

- Track 18 holds the directory. **18/0** is the BAM sector: bytes 0-1 point to the first directory sector
  (18/1), byte 2 the DOS version ($41 'A'; anything other than $41/$00 makes DOS report error 73 and
  refuse writes), bytes $04-$8F four bytes per track (free-sector count + 24-bit free map, bit set =
  free, sector 0 = bit 0 of the first byte), $90-$9F disk name padded with $A0, $A2-$A3 disk ID, $A5-$A6
  DOS type "2A". 40-track DOSes put tracks 36-40 BAM at $C0 (SpeedDOS) or $AC (Dolphin DOS), PrologicDOS
  after $8F with the name moved.
- Directory sectors 18/1…: 8 entries of 32 bytes; bytes 0-1 of the sector link to the next directory
  sector (track 0 = last). Entry: file type byte (bit 7 closed, bit 6 locked, low bits DEL/SEQ/PRG/USR/
  REL; $00 = scratched), first track/sector, 16-byte PETSCII name padded with $A0, REL side-sector
  track/sector and record length, size in blocks at $1E-$1F.
- Files are chains of sectors; bytes 0-1 are the next track/sector; on the last sector, track = 0 and
  the "sector" byte is the index of the last used byte. 254 data bytes per sector. Interleave 10 for files,
  3 for the directory (fast DOSes differ).
- **REL files**: side-sector blocks (up to 6, each listing up to 120 data sectors) give random access to
  fixed-length records; the record length is in the directory entry.
- *Inference:* a read-only browser needs only this section; writing needs BAM allocation with DOS's
  interleave and the track-18 rules.

---

## §7 Drive ROMs

### §7.1 Part numbers and hashes

From MAME's ROM definitions (BSD-3, `c1541.cpp`, `c1571.cpp`, `c1581.cpp`, `c1551.cpp`). CRC32 and SHA-1
as MAME lists them; they identify the dumps only.

| Drive | Part | Size, address | CRC32 | SHA-1 |
|---|---|---|---|---|
| 1540/1541 (lower half) | 325302-01 | 8 KB, $C000 | 29ae9752 | 8e0547430135ba462525c224e76356bd3d430f11 |
| 1540 (upper) | 325303-01 | 8 KB, $E000 | 10b39158 | 56dfe79b26f50af4e83fd9604857756d196516b9 |
| 1541 r1 | 901229-01 | 8 KB, $E000 | 9a48d3f0 | 7a1054c6156b51c25410caec0f609efb079d3a77 |
| 1541 r2 | 901229-02 | 8 KB, $E000 | b29bab75 | 91321142e226168b1139c30c83896933f317d000 |
| 1541 r3 | 901229-03 | 8 KB, $E000 | 9126e74a | 03d17bd745066f1ead801c5183ac1d3af7809744 |
| 1541 r4 | 901229-04 | 8 KB, $E000 | 102457cd | c67f13f13305e4e2100b7f79b6ca2089af07289f |
| 1541 r5 | 901229-05 AE | 8 KB, $E000 | 361c9f37 | f5d60777440829e46dc91285e662ba072acd2d8b |
| 1541 r6 | 901229-06 AA | 8 KB, $E000 | 3a235039 | c7f94f4f51d6de4cdc21ecbb7e57bb209f0530c0 |
| 1541C r1 | 251968-01 | 16 KB | 1b3ca08d | 8e893932de8cce244117fcea4c46b7c39c6a7765 |
| 1541C r2 | 251968-02 | 16 KB | 2d862d20 | 38a7a489c7bbc8661cf63476bf1eb07b38b1c704 |
| 1541-II (Chinon) | 251968-03 | 16 KB | 899fa3c5 | d3b78c3dbac55f5199f33f3fe0036439811f7fb3 |
| 1541-II (Mitsumi/Newtronics) | 355640-01 | 16 KB | 57224cde | ab16f56989b27d89babe5f89c5a8cb3da71a82f0 |
| 1570 | 315090-01 | 32 KB | 5a0c7937 | 5fc06dc82ff6840f183bd43a4d9b8a16956b2f56 |
| 1571 r3 | 310654-03 | 32 KB | 3889b8b8 | e649ef4419d65829d2afd65e07d31f3ce147d6eb |
| 1571 r4 | 310654-04 | 32 KB | 49cc496d | cc61b82ed9e102ff28a337d075ed00dfb8e7ae52 |
| 1571 r5 | 310654-05 | 32 KB | 5755bae3 | f1be619c106641a685f6609e4d43d6fc9eac1e70 |
| 1581 r1 | 318045-01 | 32 KB | 113af078 | 3fc088349ab83e8f5948b7670c866a3c954e6164 |
| 1581 r2 | 318045-02 | 32 KB | a9011b84 | 01228eae6f066bd9b7b2b6a7fa3f667e41dad393 |
| 1551 | 318001-01 | 16 KB | 6d16d024 | fae3c788ad9a6cc2dbdfbcf6c0264b2ca921d55e |
| JiffyDOS 1541 v6.01 | (commercial) | 8 KB | bc7e4aeb | db6cfaa6d9b78d58746c811de29f3b1f44d99ddf |

(MAME also lists JiffyDOS for 1541-II, SX-64, 1571 and 1581, "1541 FLASH!" and a 1581 beta; a 1563 ROM.)

- MAME's comments give the 2364 mask numbers (325302-01 = 2364-130, 325303-01 = 2364-131, 901229-01 =
  2364-173, 901229-03 = 2364-197) and call 901229-01/-03/-05 DOS 2.6 "rev. 0/1/2".
- All report "CBM DOS V2.6 1541"; the 1541C and 1541-II ROMs fix bugs (c64-wiki). VICE's resources name
  one ROM per drive type (`DosName1540`, `DosName1541`, `DosName1541ii`, `DosName1570`, `DosName1571`,
  `DosName1571cr`, `DosName1581`, `DosName1551`, …).
- *Inference:* a 1541 setting needs a 16 KB image (either 325302-01 + 901229-0x concatenated or a single
  16 KB 1541C/-II ROM); offer 901229-06 AA and 251968-03 as the defaults commonly used.

### §7.2 Rights position

- Cloanto states that the CBM 8-bit system ROMs are copyrighted works now owned by "Amiga" and licensed
  (C64 Forever KB <https://www.c64forever.com/kb/13-122>; it does not mention drive ROMs specifically).
  Cloanto's claim to own Commodore copyrights up to 1993 has been questioned (Debian legal list, OSnews
  2014). Debian removes the ROMs from its VICE package (`debian/copyright`). Clock Signal ships no 1540 ROM
  ("copyright status … uncertain", `ROMImages/Commodore1540/readme.txt`). Pi1541 requires the user to
  supply it.
- JiffyDOS is commercial (sold today by Retro Innovations; *not verified this session*).
- Open alternatives: none found for the 1541 DOS. The Commander X16's CMDR-DOS is an open CBM-DOS-like
  implementation for a different machine (search result only). Michael Steil reconstructed buildable
  sources of all 1540/1541/1541C/1541-II ROMs (<https://pagetable.com/?p=1063>), and `mist64/cbmsrc` holds
  original Commodore sources (no licence) — **both are Commodore's code and fall under the project's "no
  commented ROM sources" rule; not read.**
- *Inference:* like Klive's other machines, the drive ROM should be user-supplied (or shipped only with a
  licence), with the hash table above used to identify it.

---

## §8 Implementations and licences

### §8.1 Per implementation

**VICE** (GPL-2.0; facts only). The most complete: 1540/1541/1541-II/1551/1570/1571/1571CR/1581/2000/
4000/CMD HD and IEEE drives; G64/P64/D64/D71/D81; RPM and wobble; drive sound; parallel cables; RAM
expansions; idle methods (§10). Read logic modelled at 16 MHz with UE7/UF4 counters, the 2.5 µs filter,
AGC noise (§3.5-3.6). Credits in `rotation.c`: "1541 circuitry simulation code by Istvan Fabian … Benjamin
'BeRo' Rosseaux", "GCR hardware tests by Peter Rittwage". The CPU is caught up lazily (§9).

**MAME** (BSD-3-Clause per file; **permissive**). `c1541.cpp` (1540/1541/1541C/1541-II/SX1541),
`c1571.cpp`, `c1581.cpp`, `c1551.cpp`, with the 64H156 as a device (`64h156.cpp`) and a general flux-based
floppy subsystem (`imagedev/floppy.cpp`, image formats in `lib/formats/`). The 64H156 model is
cycle-of-16-MHz with checkpoint/rollback for synchronising with the CPUs (`live_run`, `checkpoint`,
`rollback`, `live_sync`) and idle skipping (`skip_idle_cycles`). The G64 loader says its speed-zone map
follows VICE's `disk_image_speed_map()`, and the AGC constants match VICE's (§3.6): *inference*, parts of
the design may be derived from GPL VICE; treat MAME's facts as facts and keep Klive's code its own.

**Clock Signal** (MIT; **permissive**). `C1540` with personalities 1540/1541, used by the VIC-20 and the
Plus/4. Bit-level: a generic disk controller with a DPLL (`Storage/Disk/DPLL/DigitalPhaseLockedLoop.hpp`)
feeds `process_input_bit`, which detects SYNC (10 ones) and frames bytes; VIA2/VIA1 wiring as in §1.4-1.5;
ATN auto-ack. It does **not** model the UE7/UF4 counter logic, the time-domain filter or AGC noise (read
from `C1540.cpp`); writing serialises whole bytes from port A (`serialise_shift_output`); the disk runs only
while the motor is on (`Machine::run_for`); index holes are ignored. Formats: D64, G64 (`Storage/Disk/
DiskImage/Formats/`). The VIC-20 runs the drive **one drive cycle per VIC-20 cycle** (`Vic20.cpp`,
`c1540_->run_for(Cycles(1))` in the bus loop), which ignores the 1.108 vs 1.000 MHz difference; the
Plus/4 scales by the real ratio (`Plus4.cpp`, `c1541_cycles_ … divide(media_divider_)`). *Inference:*
accurate enough for DOS and simple loaders, not for clock-sensitive loaders on the VIC-20.

**floooh/chips** (zlib; permissive). `c1541.h` is a **stub**: it maps RAM and ROM and ticks the 6502, but
the two VIAs are initialised and never connected, and `c1541_insert_disc` / `remove_disc` are `// FIXME`
(read in full, 194 lines). `m6522.h` is a usable cycle-ticked VIA without the shift register (§2.3).

**Hoxs64** (GPL-3.0). Windows C64 emulator known for accuracy (*reputation; its drive code was not
read*). **Denise** (GPLv3): cycle-accurate C64/Amiga, 1541/1570/1571/1581, open tracker issues on 1571
and 1581 accuracy (search results).

**1541 Ultimate II** (GPL-3.0): FPGA drive emulation inside a cartridge (VHDL + firmware); real
hardware, useful as a behavioural oracle, facts only.

**MiSTer C64** (GPL; no repo licence file; VIA GPL-3.0): `rtl/iec_drive/c1541_*.sv` derived from Dar's
1541 (credits Mark McDougall's `c1541_logic`, Gideon's VIA, Sorgelig's track code). README: "low-level
read logic based on original schematics", "physical disk rotation and AGC weak-bit flux events", D64/G64
for the 1541, D81 for the 1581, two drives, parallel cable. Note that `c1541_logic` was "modified for: slow
down CPU (EOI ack missed by real c64)" — a deliberate deviation from hardware.

**Pi1541** (GPL-3.0): "real-time, cycle exact" 1541 (and 1581) on a Raspberry Pi 3, connected to real
machines; has its own `m6502.cpp`, `m6522.cpp`, `m8520.cpp`, `wd177x.cpp`, `gcr.cpp`; D64/G64/NIB/NBZ.

**Permissive summary**: MAME (BSD-3, per file), Clock Signal (MIT), floooh/chips (zlib, incomplete
drive), P64 library (zlib), Bitfire (BSD-3). Everything else listed is GPL.

### §8.2 Provenance notes

- *Inference:* because MAME's 64H156 noise constants and xorshift seed coincide with VICE's GPL
  `rotation.c`, Klive's implementation should take those numbers as **measured facts with a source note**
  (both credit hardware tests by Pete Rittwage in VICE) rather than port either file.
- MiSTer and Pi1541 are GPL; MAME's comments reference VICE functions. Klive's own rules for other
  machines (write from the research pack, read GPL for facts only) apply unchanged.

---

## §9 Interleaving two independently clocked CPUs

What the sources do:

- **VICE (lazy catch-up)**: the drive keeps `last_clk` and a 16.16 accumulator. `drivecpu_execute(drv,
  host_clk)` converts the host cycles since the last call into drive cycles with the sync factor, then
  runs the drive CPU **until its clock reaches the target** (`drivecpu.c`). Every host read of the IEC
  bus first catches the drive(s) up to the host clock (`iecbus/iecbus.c`, `iecbus_cpu_read_conf1`…`3`
  call `drive_cpu_execute_all(clock)` or `drive_cpu_execute_one`); the C64's CIA2 also catches up before
  ICR and SDR accesses when the burst-mode modification is on (`c64/c64cia2.c`, `read_ciaicr`,
  `read_sdr`). The bus is the only coupling, so the drive only needs to be current when the bus is
  touched, plus at the end of each frame (manual, "trap idle"). The drive core is VICE's
  instruction-stepping `6510core.c` with per-cycle accounting. *Inference:* it can overshoot the target
  by part of an instruction, so a drive bus write in that overshoot becomes visible to the host a few
  cycles early; VICE's results with fast loaders show this is mostly tolerated, but it is an
  approximation.
- **MAME (scheduler)**: each CPU is a device on the global scheduler; time slices are bounded by the
  interleave/perfect-quantum settings, and the 64H156 uses checkpoint/rollback (`live_sync`,
  `rollback`) to replay disk time when a CPU access lands inside an already-computed slice
  (`64h156.cpp`).
- **Clock Signal**: the host bus loop ticks the drive by host cycles (VIC-20 one for one; Plus/4 by a
  fractional divider) (§8.1).
- **MiSTer / 1541U / Pi1541**: real parallel hardware or real-time lockstep; nothing to interleave.

*Inference (options for Klive's cores, not a decision):*

1. **Lockstep with a fractional accumulator**: after each host cycle, run as many drive cycles as the
   16.16 accumulator yields (0, 1 or 2). Simple and exact to one drive cycle; costs a function call per
   cycle and keeps the drive running even when idle.
2. **Lazy catch-up at bus accesses, cycle-granular**: as VICE, but the drive core must stop at an exact
   cycle (a cycle-stepped 6502 can), and every IEC line change on either side is time-stamped. Host reads
   of the IEC port catch the drive up to the exact common time; host writes do the same first, then
   change the line (and recompute the ATN XOR, §4.4). Between accesses the drive can run ahead in large
   batches only if it is guaranteed not to touch the bus (it cannot know in general), so the drive must be
   **behind** the host and catch up, never ahead.
3. **Drive as the leader**: symmetric to 2; no source does this.

Common facts for any option: the coupling surface is small (ATN/CLK/DATA/SRQ/RESET, plus the parallel
cable and, for the 1551, the TCBM port), each crossing must carry a timestamp in a common time base, and
the disk logic underneath the drive CPU is a separate 16 MHz process that can be advanced lazily up to the
drive CPU's current cycle whenever the drive reads VIA2 or samples SO (VICE calls `rotation_rotate_disk`
before VIA2 port reads, `via1d1541.c`/`viad`; MAME `live_sync`).

---

## §10 Performance

- VICE describes true drive emulation as "slow but offers maximum compatibility" and offers **idle
  methods** (`DriveNIdleMethod`, manual §6.11):
  - *Skip cycles*: the drive catches up only when the host touches the serial bus, and discards cycles if
    too many have accumulated. Usually fastest, but can cause slowdowns, never updates the LED, and can lose
    sync.
  - *Trap idle*: also run at the end of every frame, but when the drive CPU is in DOS's idle loop, only
    pending interrupts are emulated (a ROM trap). LED and sync stay correct; a non-standard idle loop
    falls back to full emulation.
  - *None*: full emulation, no shortcuts.
- VICE also offers kernal **traps** with "virtual drives" (fast, not hardware; disabled by default since
  VICE 3.0, which also disables "fast 1541 emulation" for images, manual §6.11).
- Clock Signal advances the disk only while the motor is on. MAME skips 16 MHz ticks in which no counter
  output can change (`skip_idle_cycles`). VICE batches ref cycles up to the next possible event (`todo`
  computed from UE7, the filter and the noise timer, `rotation_1541_gcr`).
- *Inference:* a second 1 MHz 6502 roughly doubles the CPU-emulation cost of a C64 (C64 CPU ≈ 1 MHz) but is
  small next to a cycle-exact VIC-II; the 16 MHz disk process is cheap when batched (a few operations per
  bit, ~300 000 bits/s). Skipping the drive while idle is safe only when (a) the drive CPU is in a known
  ROM idle loop with no pending IRQ/timer effects, (b) no bus line changes, and (c) the disk process is
  advanced anyway (the motor may run). Loaders that leave custom code running in the drive defeat any
  idle trap; the emulator must then run the drive fully. VICE's "skip cycles" discarding is an accuracy
  loss and would break fast loaders.

---

## §11 Disagreements

- **D1 Track-0 sensor and ROM interchangeability**: MAME's notes say 1541 ROMs are interchangeable and
  the 1541-II ROM runs in an original 1541; c64-wiki agrees for the 1541-II ROM but says the 1541C ROM
  cannot be used in an original 1541.
- **D2 Highest track**: Wikipedia "the mechanism has 40 tracks"; c64-wiki "tracks 40 or 41"; G64 document
  "at most 42 tracks and 42 half tracks … pushing past 42 might be hazardous"; nibtools `MAX_TRACKS_1541
  42`; P64 up to half-track 85 (42.5).
- **D3 Zone naming and gaps** (Schepers' G64 document, internally): its zone table calls zone 3 (tracks
  1-17) the "slowest writing speed" and zone 0 the "fastest", while its text derives the 7692-byte track
  from "the fastest write speed possible (speed zone 0)"; by the bit rates (§3.1) zone 3 has the highest
  bit rate and the 7692-byte tracks. It also lists per-zone "storage" of
  7820/7170/6300/6020 bytes in one table and 7692/7142/6666/6250 in another; tail gap "4 to 12 bytes" in the
  layout list and "4 to 19" in the text.
- **D4 Write-protect polarity**: VICE (`drive-writeprotect.c`) and Clock Signal (`set_is_read_only`):
  PB4 = 0 when protected. MJK's 1541 map: "1 = protected".
- **D5 Header gap ROM fix**: Schepers says the 8→9 byte header gap fix came with ROM "901225-3"; no such
  1541 part exists in MAME's list (901229-03 is "rev. 1"). Likely a typo; unresolved.
- **D6 ATN on VIA1**: MJK's map labels "PB7 / CB2: ATN in"; Clock Signal and the schematic description it
  quotes say ATN goes to PB7 and **CA1**. MAME/VICE also use CA1 (CA1 is the IRQ source).
- **D7 Why the serial bus is slow**: Wikipedia (Butterfield) blames a 6522 shift-register bug that forced
  software bit-banging; pagetable gives the shipped timings as a design compromise (the original 4 µs design
  "never shipped") without naming the bug as the cause.
- **D8 Plus/4 serial port**: the brief says "TED port"; Clock Signal wires it to the CPU's I/O port
  (bits 0-2 out, 6-7 in).
- **D9 EOI timing**: pagetable says the sender delays at least 200 µs while its section heading says 256 µs;
  Commodore's table gives Tye min 200 / typ 250 µs; Wikipedia says the listener pulls DATA "about 200 µs".
- **D10 D64 error code 06**: Schepers: error 24 "write verify (on format)"; nibtools `gcr.h`:
  `BAD_GCR_CODE` "24, READ ERROR".
- **D11 C1541 crystal vs host**: Clock Signal's VIC-20 treats drive and host cycles as equal; VICE, MAME
  and Clock Signal's own Plus/4 use the real ratio.
- **D12 Serial throughput**: Wikipedia ~512 bytes/s; c64-wiki ~300 bytes/s; Steil "below 1 KB/s".

---

## §12 Test material

All for manual use unless a licence says otherwise.

- **VICE test programs** (`drive/` in the testprogs tree; mirror
  <https://github.com/libsidplayfp/VICE-testprogs>, no licence file): `1541-testsuite`, `diskchange`,
  `diskid`, `format`, `hls-protection`, `iecdelay`, `inertia`, `interrupts`, `openbus`, `pwm`, `readtest`,
  `rpm`, `scanner` (tracks 1-42), `selftest`, `skew`, `viavarious` (via1…via21 with reference dumps),
  `writeprotect`. VIC-20 VIA tests: `VIC20/via_pb7`, `via_sr`, `via_t1crash`, `via_t1irqack`, `via_wrap`,
  `via_defaults`, `via_mapping`, `viavarious`. The suite's own TODO lists "physical limits", "VIA serial
  shift register test" and "half-tracks behave correctly" as missing for drives. *Inference:* most tests
  report on screen and some need the exact D64 from their folder; a headless harness needs screen or
  memory probes, as Klive's other harnesses do.
- **Lorenz suite**: CPU tests (6502 file), not drive.
- **Protected-disk images**: G64/NIB/P64 preservation images (e.g. from the C64 Preservation Project,
  <https://c64preservation.com>) are copyrighted games; use locally, never commit.
- **Fast loaders as accuracy probes**: Bitfire (BSD-3, on-the-fly GCR decoding, §1.6; GitHub);
  Spindle (Linus Åkesson; "Go ahead and use this in your demos", formal terms in its COPYING file, not
  read); Krill's loader (licence not found; plus4world lists v146, 2013); IRQ-loader demos (trackmos) are
  the strictest test because the host keeps running VIC-II effects during transfer. Commercial fast
  loaders and protections (V-MAX!, RapidLok, Vorpal) as listed in nibtools' table.
- Codebase64 (formerly the usual loader reference) redirected to an unrelated domain on 2026-11-23
  (`codebase64.org` → `xoilaczda.tv`); not followed. Use an archive copy if needed (*OQ12*).

---

## §13 Open questions

- **OQ1** SO latency: exactly when the 6502 sees an SO edge in V relative to the cycle the gate array
  raises BYTE READY, and how VICE's "≥10 ref cycles before the next φ2 boundary" rule maps onto it (CPU
  file).
- **OQ2** Whether the BYTE READY pulse width (MAME: while cell-counter bit 1 is clear) matters for any
  known loader, and whether VIA2 CA1 latching is used by any loader.
- **OQ3** What a half-track position between two recorded tracks returns (both, one, noise); VICE's
  `drive/1541-testsuite` or a real-drive measurement is needed.
- **OQ4** Motor spin-up/spin-down times, VICE's default RPM and wobble values, and how the drive DOS
  reacts to a slowly spinning disk (`drive/inertia` test).
- **OQ5** Open-bus value on the 1541's unmapped addresses and RAM mirroring at $0800 (`drive/openbus`).
- **OQ6** VIA T2 underflow quirks; exact PB7 timing in T1 one-shot; CA2/CB2 pulse-mode length.
- **OQ7** Track-to-track angular alignment: how to represent it for G64 and whether P64's positions are
  aligned to a common index.
- **OQ8** The exact C128/1571 fast-serial detection handshake and the MMU FSDIR bit number.
- **OQ9** The 1571CR's 5710 chip: which CIA/VIA functions it merges.
- **OQ10** Whether any 1571/1581 software needs MFM bit-level emulation (beyond Klive's sector-level
  WD1793).
- **OQ11** G71 signature and layout; the D71/D81 documents (Schepers) were not fetched in this session.
- **OQ12** Primary documentation of a 2-bit fast-loader protocol with cycle margins (Codebase64 archive,
  Spindle's manual PDF, Krill's loader source and licence).
- **OQ13** Whether JiffyDOS (drive and KERNAL ROMs) may be supported as a user-supplied ROM only, and its
  current rights holder.

---

## §14 Reference documents

- VICE manual, section 6.11 drive settings: <https://vice-emu.sourceforge.io/vice_6.html>
- VICE source (GPL-2.0, facts only), libretro mirror: <https://github.com/libretro/vice-libretro> —
  `vice/src/drive/rotation.c`, `drivecpu.c`, `drivesync.c`, `drive-writeprotect.c`, `drive.h`,
  `iec/via1d1541.c`, `vice/src/iecbus/iecbus.c`, `vice/src/c64/c64cia2.c`; P64 library `vice/src/lib/p64/` (zlib)
- VICE test programs mirror: <https://github.com/libsidplayfp/VICE-testprogs> (`drive/readme.txt`)
- MAME (BSD-3 per file): <https://github.com/mamedev/mame> — `src/devices/bus/cbmiec/{c1541,c1571,c1581,cbmiec}.cpp`,
  `src/devices/machine/64h156.cpp`, `src/devices/bus/plus4/c1551.cpp`, `src/lib/formats/{g64,d64}_dsk.cpp`
- Clock Signal (MIT): <https://github.com/TomHarte/CLK> — `Machines/Commodore/1540/Implementation/C1540.cpp`,
  `Machines/Commodore/Vic-20/Vic20.cpp`, `Machines/Commodore/Plus4/Plus4.cpp`, `Components/6522/`
- floooh/chips (zlib): <https://github.com/floooh/chips> — `systems/c1541.h`, `chips/m6522.h`
- MiSTer C64 core: <https://github.com/MiSTer-devel/C64_MiSTer> (`rtl/iec_drive/`, README)
- Pi1541 (GPL-3.0): <https://github.com/pi1541/Pi1541>
- 1541 Ultimate (GPL-3.0): <https://github.com/GideonZ/1541ultimate>
- Hoxs64 (GPL-3.0): <https://github.com/davidhorrocks/hoxs64>
- Denise (GPLv3): <https://sourceforge.net/projects/deniseemu/>
- nibtools (GPL-3.0): <https://github.com/rittwage/nibtools> (`readme.txt`, `gcr.h`, `fileio.c`);
  homepage <https://diskpreservation.rittwage.com/dp.php?pg=nibtools>
- Bitfire (BSD-3): <https://github.com/bboxy/bitfire>
- Spindle: <https://linusakesson.net/software/spindle/v3.php>
- G64 format (Schepers, rev. 1.6): <http://unusedino.de/ec64/technical/formats/g64.html>
- D64 format (Schepers): <http://unusedino.de/ec64/technical/formats/d64.html>
- 6522 datasheet transcription: <https://ist.uwaterloo.ca/~schepers/MJK/ascii/6522-via.txt>
- 1541 hardware register map (MJK; hardware part only): <https://ist.uwaterloo.ca/~schepers/MJK/ascii/1541map.txt>
- 1541 schematics: <http://www.zimmers.net/anonftp/pub/cbm/schematics/drives/new/1541/> (short board
  251748 rev. E, 1541-II, parts and boards lists; listed, not studied in this session)
- jsbeeb VIA timer analysis: <https://www.xania.org/201406/jsbeeb-getting-the-timings-right-interrupts-and-timers>
- 6502.org VIA timer thread: <http://forum.6502.org/viewtopic.php?f=4&t=2901>
- Wikipedia: <https://en.wikipedia.org/wiki/MOS_Technology_6522>, <https://en.wikipedia.org/wiki/Commodore_1541>
- c64-wiki: <https://www.c64-wiki.com/wiki/Commodore_1541>, <https://c64-wiki.com/wiki/Fast_serial_bus_protocol>
- Michael Steil, "Commodore Peripheral Bus: Part 4: Standard Serial": <https://www.pagetable.com/?p=1135>
- Cloanto ROM licensing KB: <https://www.c64forever.com/kb/13-122>
- Debian VICE copyright: <https://sources.debian.org/src/vice/3.9%2Bdfsg-1/debian/copyright>
- VICE bug #2093 (max RPM): <https://sourceforge.net/p/vice-emu/bugs/2093>
