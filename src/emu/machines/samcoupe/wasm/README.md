# SAM Coupé WASM Core

One C core runs both SAM Coupé models (`dev/plans/SAM_COUPE_PLAN.md`, decision D2): `samConfigure` picks
512K or 256K of internal RAM, the external memory pack, the drives and the mouse, and the host uploads the
ROM. It builds to `dist/sam.wasm` (`npm run build:sam-wasm`) and is loaded by `SamWasmV2Loader.ts`. The
TypeScript side is `../SamWasmHost.ts` (plumbing, Run) and `../SamWasmV2Machine.ts` (the adapter). There is
no TypeScript SAM machine and no second CPU: the core includes the shared Z80 (`src/emu/z80/wasm/z80.c`)
through its `Z80_*` hooks. It needed no new hook.

The hardware facts come from the research pack `dev/research/sam-coupe/` (`ASIC_VIDEO_MEMORY_TIMING.md`,
`SOUND_INPUT_IO.md`, `STORAGE_FIRMWARE_SOFTWARE.md`). The code is Klive's own (plan D1), except the SAA 1099,
which is ported from SAASound (BSD-3, as D1 allows; see "Sound"). No other emulator's code was read for
design or ported.

## Layout

- `sam/sam.c`: the translation unit: the state, the time base, the `Z80_*` wiring, the frame loop, the
  exports, the shared debug loop, condition evaluator, history recorder and access profile.
- `sam/sam-memory.c`: the sections A-D behind LMPR/HMPR and the external page registers.
- `sam/sam-timing.c`: the ASIC's contention.
- `sam/sam-asic.c`: STATUS, the frame, line and MIDI OUT interrupts.
- `sam/sam-video.c`: the cell stepper, the four modes, the CLUT and palette, the border and SOFF, ATTR,
  LPEN/HPEN.
- `sam/sam-keyboard.c`, `sam/sam-mouse.c`: the 9 x 8 matrix and the MGT mouse.
- `sam/sam-saa.c`, `sam/sam-audio.c`: the SAA 1099, the beeper, the mix and the host's samples.
- `sam/sam-fdc.c`: the two VL1772s on the shared `../../common/wasm/wd1793.c` (`WD1793_VARIANT 1772`).
- `sam/sam-tape.c`: EAR and MIC, the tape player and the SAVE recording.
- `sam/sam-ports.c`: the I/O decode.

## Physical memory

| Offset | What | IDE partition |
|---|---|---|
| 000000h | the ROM, 32K: ROM0 then ROM1 | 40h (R0), 41h (R1) |
| 008000h | internal RAM, 32 pages of 16K | 0-31 |
| 088000h | external RAM, one 1 MB pack (64 pages), when fitted | 80h-BFh (X00-X3F) |
| 188000h | one page of FFh for every missing page | - |

## Time (plan §3.1, D4)

One clock: `cpu.tacts` counts whole T-states (6 MHz). A line is 384 T (48 cells of 8 T), a frame 312 lines
(119 808 T, 50.08 Hz). **The machine frame starts at the frame interrupt** (vc 244, hc 0), so screen line 0
is frame line 68, and an instruction that ends past the frame carries its overshoot into the next. The
ASIC steps eagerly, one cell at a time, as the clock passes a cell's start (`samAdvanceTacts`); a cell is
drawn when the clock leaves it, with the registers as they are at its end, so a CLUT, border or mode write
shows from the start of the cell it happens in (SimCoupé's behaviour, parity probe `pic-clut`; Klive drew
a cell at its start before, one cell late).

## Contention (plan §3.2, §6, D5)

A closed-form wait: `(free - sample) & mask`, where `sample` is the frame tact at T2 of a memory cycle or
TW of an I/O cycle, `mask` is 3 (1 in 4) or 7 (1 in 8), and `free` the grid's phase. Internal RAM is 1 in 4
in the border and 1 in 8 on lines 0-191 from hc 124 (4 T before the fetch); mode 1 adds 64-T stripes where
bit 6 of (hc + 4) is clear, border included; SOFF makes the frame border; ROM, external RAM and missing pages
are never held. ASIC ports (low byte F8h-FFh) are 1 in 8 always; others never (plan Q13). The constants
(`SAM_MEM_SAMPLE_T` 1, `SAM_MEM_FREE_PHASE` 5, `SAM_IO_SAMPLE_T` 2, `SAM_IO_FREE_PHASE` 5) are one table.

**Measured against Simon Owen's published instruction timings** (`test/sam-hw/timing.test.ts`): NOP, LD r,n,
LD (HL),n, PUSH, EX (SP),HL, OUT (n),A and IN r,(C) with code and data in internal or external memory, in
the border and on the screen, all match his real-hardware values with these constants. His table measures
each instruction repeated on its own, which leaves many phase pairs open (36 of the 64 pass it).

**Fitted to SimCoupé 1.2.17** (the parity probes, `test/sam-hw/parity/`, 2026-11-26): loop counts of about
100 instruction forms (core, prefixed, undocumented, block, I/O; mode 4 and mode 1; border and screen),
LPEN staircases across both contention boundaries, and interrupt distances. Of the pairs Owen's table
allows, 5/5 and 4/4 reproduce every SimCoupé result; they differ only by a 1-T shift that no program can
read, and 5/5 keeps the border's memory grid as it was. The earlier 1/3 made an ASIC I/O cycle after a
4-T instruction 8 T slower in the border, and shifted the screen grid by 4 T.

Refresh cycles and the interrupt acknowledge are not held (plan Q20).

## Interrupts (plan §7.4)

STATUS shows live pulses, computed from the frame tact: frame for the first 128 T of the frame (plan Q5),
line N at frame line N + 68 for 128 T (192-255: never). The line pulse is a live comparison: active while
LINE equals the line and hc < 128, so writing another value ends it, the same value keeps it, and the
current line written inside the window starts it. MIDI OUT: the pulse is the last 96 T of the 1920-T byte,
and TXFMST stays high 96 T past the byte (Q7). /INT is the AND of the active bits, level-triggered: a pulse
missed with DI is lost. IM 2 reads FFh (Q12). All of this matches SimCoupé 1.2.17 (parity probes `status`,
`status-sweep`, 2026-11-26); the LINE and MIDI rules were Klive's guesses before.

## The picture (plan §3.3, §7, D6)

12 MHz pixels (16 a cell), so mode 3's 512 pixels need no special path. The TV window is 640 x 288: hc 96-383
of a line and hc 0-31 of the next (the right border after it), 48 lines above and below the screen (Q3).
A cell's bytes are fetched at its start, in the mode then (hc 128-383), and the cell is drawn in the mode at
its end. Modes 1/2: BRIGHT is CLUT 8-15,
FLASH swaps ink and paper on bit 4 of a 5-bit frame counter. Mode 3: pixel 01 is CLUT 2 and 10 is CLUT 1
(the swap), HMPR bits 6-5 the high index bits. Mode 4: the high nibble left. SOFF (modes 3/4) shows black,
fetches nothing, freezes LPEN/HPEN at the beam's position when it takes effect (Q6; SimCoupé's rule). HPEN
reads 192 on screen line 0 until hc 128; lines 1-191 read their number from hc 0 (SimCoupé's). ATTR reads
the last attribute fetched, also in the border (Q15,
Owen's measurement); unmapped ports read the last fetch byte in the screen area, FFh elsewhere (Q14).
Palette: three 3-bit guns, linear (Q11; SimCoupé's too). **The mode-change artefact cell (Q15):** a VMPR
write that moves between modes 1/2 and 3/4 inside a cell draws that cell in the new mode from the bytes
fetched in the old one (the rules are in `samCellIndexes`, fitted to SimCoupé 1.2.17 from 96 cells of
random bytes, parity probe `pic-q15`; mode 3 is inferred from mode 4); the next cell is the new mode. LPEN
bit 0 is the CLUT bit of the pixel under the beam (SimCoupé reads one from two lines above: not followed).
The CLUT powers on
from a fixed seed (random on a real machine) and survives the reset button.

**Observed:** ROM 3.0 sets mode 4 on pages 30-31 (14-15 on 256K) and draws the copyright screen's colour
bars with the line interrupt. LMPR 5Fh also pages ROM1 into section D, so the main loop (D600h) and the
handler's second half (D42Dh-D50Fh) are ROM1 code. The interrupt comes at hc 0 one line early; the handler
reads FEh and, **with SPEN (bit 5) low, waits on the pen position** (`IN A,(C)` on F8h until it passes
the table's value) before writing the CLUT, so the change lands in the blanking and the bars are clean.
SPEN idles low (no light pen). With it high (MAME's reading, Klive before 2026-11-24) the handler writes at
once, 16-24 T into the right border, and the bars step there. Confirmed against SimCoupé 1.2.17
(`dev/ai/sam-coupe.md`, "Oracle runs").

## Sound (plan §8, D8)

`sam-saa.c` is **ported from SAASound** (Dave Hooper and Simon Owen, BSD-3; commit 3d92322 pinned in
`dev/research/sam-coupe/saasound/`; the notice is in the file and in `THIRD_PARTY_NOTICES.md`). SAASound is
the best-tested SAA 1099 model available: its fixes came from real SAMs (Defender, the Fred 59 demo) and its
noise from a recorded chip, though no per-feature hardware measurement is published. Ported unchanged: the
tone generators (half period `(511 - N) << (8 - octave)` master clocks; buffered octave/offset, with
SAASound's rule that an offset written with no octave change pending acts one half cycle later; sync), the
18-bit Galois noise LFSR (taps 20400h, seed all ones) at 31.25/15.6/7.8 kHz or clocked by tone 0/3, the two
envelopes on channels 2 and 5 only (SAASound's level tables, buffering at points (3) and (4), the 3/4-bit
switch mid-shape, internal clock from tone 1/4, external clock from an address write of 18h/19h), the mixer
(`tone * (2 - noise)`), and the amplitude stage with its **pulse-density table** for enveloped channels.
Levels are SAASound's units: 0-480 a channel, 0-2880 a side (424 at most with an envelope).

**What is Klive's:** time. SAASound steps once per output sample (oversampled) with 12-bit fractional
periods; Klive keeps each generator's next edge as an exact time (24 MHz units, events in time order) and
runs in catch-up every cell and before each write. A noise source change keeps the fraction of the period
already run, as SAASound's counter does. The audio integrator averages the level over each host sample in
place of SAASound's oversampling. The beeper (FEh bit 4) goes into both sides; the tape's EAR level is
echoed while it plays. Levels: one SAA side full scale 0.5, the beeper 0.1875, the tape 0.05. The beeper's
is SimCoupé 1.2.17's ratio (a swing 2.25 times one SAA channel's at amplitude 15, parity probe `snd-mix`); no
hardware measurement exists (SOUND OQ4). A DC high-pass (1.4 Hz, every Klive core's) follows; SimCoupé's
cuts off near 14 Hz (a held level fades in about 30 ms), not followed. Pitch and the SAA's amplitude law
agree with SimCoupé's. Only the heard mix (with the audio mixer's gains) is computed; its integrator is
volatile.

## Keyboard, joysticks, mouse (plan §9.1-§9.2)

Rows 0-7 by A8-A15 (several AND together), bits 0-4 on FEh, 5-7 on F9h; row 8 at FFFEh, with the mouse's
nibble ANDed into bits 0-3. Stick 1 is keys 6-0, stick 2 keys 1-5 (the host presses them). The mouse:
strobe, dummy, buttons, Y and X as 12-bit deltas, latched at the buttons read, on at the dummy after the
last, reset after 228 T (38 us, Q18) without a read, the time restarting on each read. **Compared with SimCoupé
1.2.17** (parity probes `mouse`, `keys`, 2026-11-27): the sequence and the timeout match to the 4 T a probe
resolves; a BASIC line typed with every symbol is stored the same.

**Observed** (`test/sam-hw/keyboard.test.ts`): ROM 3.0's legends, read back from stored BASIC lines: SHIFT
gives the digit row's ! @ # $ % & ' ( ) ~ and - + = give / * _; SYMBOL gives < > (comma, period), | (9),
{ } (F, G), ^ (H), [ ] (R, T), ? (X), ` (L); \ is SHIFT with INV.

## Disks (plan §10)

Two WD1772s on the shared controller (`sam-fdc.c` includes `wd1793.c` twice), E0h-E7h and F0h-F7h, A2 the
side. They run on the CPU's T-states; the reset button does not reach them. Disks are 80 (up to 82)
cylinders, two sides, ten 512-byte sectors - the MGT image's own layout.

**Compared with SimCoupé 1.2.17** (parity probes `fdc-*`, `img-*`, 2026-11-27): status bits, ID fields,
sector data, record not found, write protection, both drives and sides, and SAD/EDSK images (the
written-back disks too) match. SimCoupé's controller is not timed (seeks finish at once, data waits on
every status read, the disk turns about 17 times too fast), so Klive keeps the WD1772 data sheet's
timing; also its Force Interrupt status and READ TRACK's bit 4, where the data sheet says otherwise. A
missing drive's ports read FFh (SimCoupé: 00h).

**Observed:** the key that leaves the copyright screen is consumed; **F9 then boots from the editor**
(F9 still held when the editor starts boots too). The ROM loads track 4 sector 1 into the page below the
screen (29 on 512K) at 8000h and enters at 8009h when "BOOT" is at byte 256.

## Klive's boot loader (plan §3.4, §9.3, D7)

`src/public/sam/sam-klive-boot.asm` (499 bytes; the image is `src/common/samcoupe/samKliveBootImage.ts`,
checked against the source by `test/machines/sam-klive-boot.test.ts`). It reads directory entry 1, loads
that CODE file through the first drive's controller into its pages (through sections A/B), restores
BASIC's paging and starts the program with HMPR = 1 (pages 0-2) or HMPR = its exec page. A read error or a
missing program file ends in SAM BASIC's "Loading error". Run builds the disk (`samBootDisk.ts`), puts it in
drive 1, leaves the copyright screen with a key and presses F9; the `.mgt` export writes the same disk.

## Tape (plan §9.4)

The host gives edges in 3.5 MHz T-states (TZX/TAP through the shared reader); the core plays them at
6 MHz (n x 12/7 T). The SAM has no motor control, so the deck starts itself when a frame reads FEh 1000
times or more (a loader polling EAR) and stops after 50 quieter frames. The SAVE recording keeps MIC's
half-periods. **Observed** at the ROM's default speed (112): pilot 3688 T, sync about 1000 T, bits 1496 T
and 2984 T; a SAVE ... CODE round-trips through `SamTapeFile.ts` (`test/sam-hw/tape.test.ts`). TZX pure tones,
pulse sequences and direct recordings play as their pulses, one edge each.

**Compared with SimCoupé 1.2.17** (parity probes `tape-*`, 2026-11-27): ROM 3.0's `LOAD` of standard, faster,
slower and paused tapes loads the same bytes (the ROM loads 0.25 to 1.18 times the standard pulse lengths
here). The edge timing of short pulses differs: SimCoupé places pulses of 800 T and less tens of T off the TZX
timing (its tape stepping); Klive plays each pulse to the T-state. SimCoupé starts its tape only while ROM
code reads it; Klive's deck starts for any program that polls EAR.

## Testing

`test/harness/samcoupe/` scripts the real core (`bootToCopyright`, `bootToBasic`, typing, pages, ports, the
ASIC and SAA state); `test/sam-hw/` covers boot (both models, both ROMs), memory, contention, interrupts,
the picture (with goldens checked by eye), keyboard, sound, mouse, disks, the boot loader, Run and tape.
`npm run benchmark:sam-wasm`: about 30x real time.
