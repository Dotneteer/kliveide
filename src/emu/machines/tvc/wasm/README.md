# Videoton TVC WASM Core

One C core runs both TVC models (`.plans/VIDEOTON_TVC_PLAN.md`, decision D2): `tvcConfigure` picks
the 64K or the 64K+ at run time, and the host uploads the model's ROMs. It builds to `dist/tvc.wasm`
(`npm run build:tvc-wasm`) and is loaded by `TvcWasmV2Loader.ts`. The TypeScript side is
`../TvcWasmHost.ts` (plumbing) and `../TvcWasmV2Machine.ts` (the adapter). There is no TypeScript
TVC machine and no second CPU: the core includes the shared Z80 (`src/emu/z80/wasm/z80.c`) through
its `Z80_*` hooks, including H1, `Z80_DELAY_OPCODE_FETCH`, which was added for this machine.

The hardware facts come from the research pack `_input/videoton-tvc/`: `TVC_HARDWARE_OVERVIEW.md`,
`TVC_VIDEO_GENERATION.md` (the video path, checked against the manual and the board schematics) and
`TVC_CLOCK_STRETCH_FIGURES.md`. The code is Klive's own.

## Layout

- `tvc/tvc.c`: the translation unit. It holds the state, the time base, the `Z80_*` hook wiring, the
  frame loop and the exports, plus the shared debug loop, condition evaluator, history recorder and
  access profile.
- `tvc/tvc-memory.c`: the mapper (port 02h, the 64K+'s port 0Ch, the card port 03h), as sixteen 4K
  slots over one physical array (`tvcMemory`: U0-U3, VID0-VID3, SYS, CART, the card window, EXTH,
  the HBF card's ROM and RAM).
- `tvc/tvc-hbf.c`: the HBF floppy interface card in slot 0, on the shared WD1793
  (`src/emu/machines/common/wasm/wd1793.c`, also the Beta 128's).
- `tvc/tvc-keyboard.c`: the 11 x 8 active-low matrix (port 03h selects the row, port 58h reads it).
- `tvc/tvc-crtc.c`: the 6845 (Hitachi type 0 by default, D6; `tvcCrtcSetMotorola` for the MC6845).
- `tvc/tvc-video.c`: the pixel pipeline, blanking, the sync-driven TV window and the interrupt
  flip-flop.
- `tvc/tvc-ports.c`: the I/O decode.
- `tvc/tvc-timing.c`: the clock stretch on video RAM and the 64K's M1 WAIT.
- `tvc/tvc-audio.c`: the sound divider, its 4-bit counter, the DAC and the sound interrupt.
- `tvc/tvc-tape.c`: the tape player (port 59h bit 5), the motor, and the SAVE decoder.

## Time

`cpu.tacts` counts whole CPU T-states (320 ns). The CPU clock can be stopped for half a T-state at a
time, so the core also keeps `tvcHalfClock` in 160 ns units. It is always 2 x tacts plus the half-T
phase, which is its lowest bit (plan §3.1, D5). The CRTC, the pixel clocks and (in Phase 4) the sound
divider run on the fixed clock tree, so they follow `tvcHalfClock`. A CRTC character is 4 half-T
units, and characters start at multiples of 4: the DEB phase after reset is 0 (plan Q7).

`tvcAdvanceTacts` runs eagerly, at the start of every character as the CPU clock passes it. So a
palette, border, mode or video RAM write lands at the character it happens in.

A machine frame ends where the CRTC starts a new frame. With the ROM's CRTC values that is 62,800 T
(49.76 Hz). A CRTC "frame" shorter than half a nominal frame does not count (the CRTC is not
programmed yet), and two nominal frames end one whatever the CRTC does.

## The clock stretch (plan §6)

A CPU access to a slot that shows video RAM is stretched by 1-4 half-T-states. The amount depends on
the phase its T1 starts at in the character (read/write: 2 1 4 3; opcode fetch: 3 2 1 4). Nothing
else stretches: I/O cycles, interrupt acknowledges and refresh cycles don't (Q3).
`test/tvc-hw/timing.test.ts` checks every phase.

One consequence: a stretch leaves the CPU at a fixed phase, so code that keeps touching video RAM
locks to the slots. A NOP sled in video RAM settles at phase 3, 6 T per NOP.

The WAIT circuit (64K only) adds one T to an M1 from the cartridge. The system ROM is not slow by
default, since the factory jumper setting is open (Q4).

## Video (plan §7)

Each character runs these steps in order:

1. The CRTC tick.
2. The previous character's byte and display enable reach the video register. Both lag one
   character: the shift registers load at the end of the CRTC slot, and the border flip-flop G15 is
   clocked by DEB.
3. The horizontal blank applies: 180 dots (14.4 µs) from HS rising.
4. The vertical blank latch applies: set by the 135 µs VS monostable, cleared while MA9 is 1.
5. The TV places the character, 21 characters after the line sync (HS falling) and 26 line syncs
   after the frame sync (VS rising). That centres the 512 x 240 paper in the 560 x 288 picture. The window
   starts just after the horizontal blank ends, so no blanked dot shows on its left.
6. The fetch for this character, from the displayed bank.
7. The interrupt flip-flop, which is set when NOR(cursor, sound IT) rises: at the end of the cursor
   pulse.

Colours come from the 270/360 Ω network: a gun is off, dark (`92h`) or bright (`FFh`), and "bright
black" is black. The aspect ratio is 7/12.5: a TVC dot against Klive's square 7 MHz Spectrum pixel.

## Sound (plan §10)

The divider and its counter run on the fixed clock. So the counter is a function of time,
`floor((t - anchor) / period) mod 16`, and nothing runs per T-state:
- a restart (`IN 5Bh`) sets the anchor;
- a divisor write keeps the counter's value.

QD (bit 3) is the square wave and, with port 05h bit 5 set, the sound interrupt input. That input
meets the cursor in the interrupt flip-flop's NOR gate, so the first interrupt after a restart comes
16 periods later (plan Q2).

A sample is the output's average over its interval: the square wave integrated in closed form, the
DAC level otherwise. It is unipolar, then passes a DC high-pass.

## Tape (plan §9)

**Playing.** The host turns a `.cas` into a tape program of 32-bit words (`TvcCasFile.ts`): silence,
runs of equal cycles, and data bytes the player expands bit by bit. The tape's time advances with
the machine's while the motor runs (port 05h bits 7-6), brought up to date lazily.

**Fast load.** `FAST_LOAD`, on by default, runs 25 machine frames per displayed frame while the
tape plays with its motor on (`TvcWasmV2Machine.ts`). Nothing is trapped: the ROM decodes the real
signal, only sooner.

**SAVE.** It is decoded from the output toggles (any access to 50h-57h) while the motor runs:
1. half-periods are classified against the measured pilot: the sync is two halves over 1.4 pilots,
   and a 0 bit is a cycle over 1.03 pilot cycles;
2. bytes are collected LSB first, one block after each sync;
3. the recording is published once a data block has ended (the ROM stops the motor between the
   header and the data);
4. the host checks every CRC and builds the `.cas` (`tvcSavedFileOf`).

**How the ROM times the tape.** It times every half-period with the sound timer: wait for the
interrupt, toggle, reload the divider, restart. Its divisors give 42 (pilot), 34 (1), 50 (0) and 68
(sync) counts. So the tape's frequencies follow from Q2:
- with the 16-period first interrupt, this core writes cycles of 1,466 / 1,210 / 1,722 / 2,298 T;
- the established converter's are 1,276 / 1,134 / 1,558 / 2,410 T.

The ROM reads both, because it calibrates on each tape's pilot. A real recording's frequencies would
settle Q2.

## The HBF card and VT-DOS (plan §9.4)

`MC_TVC_HBF` plugs the card into slot 0: its 16K VT-DOS ROM shows a 4K page (port 18h bits 5-4) at
C000h of the EXT page and its 4K RAM at D000h, its controller answers at 10h-13h, the status (DRQ,
INTRQ) and drive register at 14h, and port 5Ah reports type 2 in slot 0. That is why the slots are
4K: the card splits the 8K window.

The controller is the Beta 128's WD1793, extracted into a shared file with its geometry as
parameters: here two drives of 82 cylinders, two sides, nine 512-byte sectors (720K). A raw `.dsk`
is read by its FAT12 boot sector (`TvcDiskImage.ts`); a single-sided one is spread over side 0. The
guest's writes go back as the whole image (`TvcHbfDisks.ts`).

VT-DOS hooks the cassette calls, so `LOAD"name"` and `SAVE"name"` use the disk, and `EXT2` starts its
command line (`DIR`, `CD`, ...). It moves the cursor, and with it the interrupt, from 0EFFh to 0AFFh:
scan line 175 instead of 239 (`test/tvc-hw/hbf.test.ts`).

## Testing

`test/harness/tvc/` scripts the real core: `bootToBasic`, frames, stepping, the CRTC and the picture.
`test/tvc-hw/` holds the hardware tests:

- `boot.test.ts`: BASIC 1.2's boot, with an eye-checked picture hash;
- `video.test.ts`: the pixel formats, palette/border bits, the paper position, blanking, mid-line
  palette writes and the interrupt's moment;
- `timing.test.ts`: the stretch and the WAIT;
- `sound.test.ts`: the divider, the interrupt period, the square wave's pitch, the DAC;
- `tape.test.ts`: SAVE to `.cas`, then LOAD and RUN in a fresh machine, at both timings, with and
  without fast load;
- `keyboard.test.ts`: the typer's characters, found unchanged in the program BASIC stored;
- `plus.test.ts`: the 64K+'s BASIC 2.2 boot, its video banks and the bank it shows;
- `hbf.test.ts`: VT-DOS's directory listing, SAVE and LOAD through the disk (and through the image
  the drive publishes), write protection, the moved cursor interrupt.

Most of these run on a "bare" machine, with the CPU parked in RAM and the CRTC set by the test
(`bare.ts`).

The ROM's boot takes about 6 seconds of machine time: RAM test, sign-on, key, banner.
