# SAM Coupé WASM Core

One C core runs both SAM Coupé models (`dev/plans/SAM_COUPE_PLAN.md`, decision D2): `samConfigure` picks
512K or 256K of internal RAM, the external memory pack, the drives and the mouse, and the host uploads the
ROM. It builds to `dist/sam.wasm` (`npm run build:sam-wasm`) and is loaded by `SamWasmV2Loader.ts`. The
TypeScript side is `../SamWasmHost.ts` (plumbing, Run) and `../SamWasmV2Machine.ts` (the adapter). There is
no TypeScript SAM machine and no second CPU: the core includes the shared Z80 (`src/emu/z80/wasm/z80.c`)
through its `Z80_*` hooks. It needed no new hook.

The hardware facts come from the research pack `dev/research/sam-coupe/` (`ASIC_VIDEO_MEMORY_TIMING.md`,
`SOUND_INPUT_IO.md`, `STORAGE_FIRMWARE_SOFTWARE.md`). The code is Klive's own (plan D1): no emulator's code
was read for design or ported. The SAA 1099 is written from the pack's record of SAASound's behaviour, not
ported from SAASound's sources (see "Sound").

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
ASIC steps eagerly, one cell at a time, as the clock passes a cell's start (`samAdvanceTacts`): the cell is
drawn with the registers as they are at its start, so a CLUT or border write lands from the next cell on.

## Contention (plan §3.2, §6, D5)

A closed-form wait: `(free - sample) & mask`, where `sample` is the frame tact at T2 of a memory cycle or
TW of an I/O cycle, `mask` is 3 (1 in 4) or 7 (1 in 8), and `free` the grid's phase. Internal RAM is 1 in 4
in the border and 1 in 8 on lines 0-191 from hc 124 (4 T before the fetch); mode 1 adds 64-T stripes where
bit 6 of (hc + 4) is clear, border included; SOFF makes the frame border; ROM, external RAM and missing pages
are never held. ASIC ports (low byte F8h-FFh) are 1 in 8 always; others never (plan Q13). The constants
(`SAM_MEM_SAMPLE_T` 1, `SAM_MEM_FREE_PHASE` 1, `SAM_IO_SAMPLE_T` 2, `SAM_IO_FREE_PHASE` 3) are one table.

**Measured against Simon Owen's published instruction timings** (`test/sam-hw/timing.test.ts`): NOP, LD r,n,
LD (HL),n, PUSH, EX (SP),HL, OUT (n),A and IN r,(C) with code and data in internal or external memory, in
the border and on the screen, all match his real-hardware values with these constants. The I/O phase is
pinned by the IN/OUT cases: with the memory grid's free slot at T2 = 1 (mod 8), the I/O grid's at TW = 3
(mod 8) is the one value that gives Owen's 16 T (border) and 24 T (screen) for both.

Refresh cycles and the interrupt acknowledge are not held (plan Q20). Not yet compared with SimCoupé (an
oracle run, plan §13).

## Interrupts (plan §7.4)

STATUS shows live pulses, computed from the frame tact: frame for the first 128 T of the frame (plan Q5),
line N at frame line N + 68 for 128 T (192-255: never), MIDI OUT 96 T at the end of a 1920-T byte (Q7:
the manual's wording). A LINE write during the line pulse ends it (SimCoupé's behaviour, one constant).
/INT is the AND of the active bits, level-triggered: a pulse missed with DI is lost. IM 2 reads FFh (Q12).

## The picture (plan §3.3, §7, D6)

12 MHz pixels (16 a cell), so mode 3's 512 pixels need no special path. The TV window is 640 x 288: hc 96-383
of a line and hc 0-31 of the next (the right border after it), 48 lines above and below the screen (Q3).
Screen bytes are fetched one cell before they are shown (hc 120-375). Modes 1/2: BRIGHT is CLUT 8-15,
FLASH swaps ink and paper on bit 4 of a 5-bit frame counter. Mode 3: pixel 01 is CLUT 2 and 10 is CLUT 1
(the swap), HMPR bits 6-5 the high index bits. Mode 4: the high nibble left. SOFF (modes 3/4) shows black,
fetches nothing, freezes LPEN/HPEN (Q6). ATTR reads the last attribute fetched, also in the border (Q15,
Owen's measurement); unmapped ports read the last fetch byte in the screen area, FFh elsewhere (Q14).
Palette: three 3-bit guns, linear (Q11). No mode-change artefact cell (Q15 of the plan). The CLUT powers on
from a fixed seed (random on a real machine) and survives the reset button.

**Observed:** ROM 3.0 sets mode 4 on pages 30-31 (14-15 on 256K) and draws the copyright screen's colour
bars with the line interrupt; the palette change lands about 24 T into the right border, so the bars step
there (as on the hardware, where the interrupt comes at the start of the right border).

## Sound (plan §8, D8)

`sam-saa.c` is Klive's own model written from the pack's record of the chip and of SAASound's behaviour
(SOUND §1): six tones (half period `(511 - N) << (8 - octave)` master clocks), buffered octave/offset writes
(octave-first defers the offset one more half cycle), the 18-bit Galois noise LFSR (taps 20400h, seed all
ones) at 31.25/15.6/7.8 kHz or clocked by tone 0/3, the two envelopes on channels 2 and 5 only (8 shapes,
4/3-bit, internal or external clock, buffered control bytes, mirror), the mixer (tone+noise: half when both
high), sync and sound enable. **Not modelled:** SAASound's pulse-density table for enveloped amplitudes
(not in the pack: Klive uses `(amp & 0Eh) * env / 16`). Porting SAASound (BSD-3) would bring it; plan D1
allows that as a follow-up. The SAA runs in catch-up (24 MHz units, events in time order) every cell and
before each write; the beeper (FEh bit 4) goes into both sides; the tape's EAR level is echoed while it
plays. Levels: one SAA side full scale 0.5, the beeper 0.25, the tape 0.05 (SOUND OQ4: unmeasured). A DC
high-pass follows. Only the heard mix (with the audio mixer's gains) is computed; its integrator is
volatile.

## Keyboard, joysticks, mouse (plan §9.1-§9.2)

Rows 0-7 by A8-A15 (several AND together), bits 0-4 on FEh, 5-7 on F9h; row 8 at FFFEh, with the mouse's
nibble ANDed into bits 0-3. Stick 1 is keys 6-0, stick 2 keys 1-5 (the host presses them). The mouse:
strobe, dummy, buttons, Y and X as 12-bit deltas, latched at the buttons read, on at the dummy after the
last, reset after 228 T (38 us, Q18) without a read.

**Observed** (`test/sam-hw/keyboard.test.ts`): ROM 3.0's legends, read back from stored BASIC lines: SHIFT
gives the digit row's ! @ # $ % & ' ( ) ~ and - + = give / * _; SYMBOL gives < > (comma, period), | (9),
{ } (F, G), ^ (H), [ ] (R, T), ? (X), ` (L); \ is SHIFT with INV.

## Disks (plan §10)

Two WD1772s on the shared controller (`sam-fdc.c` includes `wd1793.c` twice), E0h-E7h and F0h-F7h, A2 the
side. They run on the CPU's T-states; the reset button does not reach them. Disks are 80 (up to 82)
cylinders, two sides, ten 512-byte sectors - the MGT image's own layout.

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
and 2984 T; a SAVE ... CODE round-trips through `SamTapeFile.ts` (`test/sam-hw/tape.test.ts`).

## Testing

`test/harness/samcoupe/` scripts the real core (`bootToCopyright`, `bootToBasic`, typing, pages, ports, the
ASIC and SAA state); `test/sam-hw/` covers boot (both models, both ROMs), memory, contention, interrupts,
the picture (with goldens checked by eye), keyboard, sound, mouse, disks, the boot loader, Run and tape.
`npm run benchmark:sam-wasm`: about 30x real time.
