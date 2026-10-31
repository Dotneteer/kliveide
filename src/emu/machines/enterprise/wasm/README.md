# Enterprise 64/128 WASM Core

One C core runs both Enterprise models (`.plans/ENTERPRISE_PLAN.md`, decision D2): `epConfigure` picks
128K or 64K of RAM and the ROMs present, and the host uploads the model's ROMs. It builds to
`dist/ep.wasm` (`npm run build:ep-wasm`) and is loaded by `EpWasmV2Loader.ts`. The TypeScript side is
`../EpWasmHost.ts` (plumbing) and `../EpWasmV2Machine.ts` (the adapter). There is no TypeScript
Enterprise machine and no second CPU: the core includes the shared Z80 (`src/emu/z80/wasm/z80.c`)
through its `Z80_*` hooks. It needed no new hook.

The hardware facts come from the research pack `_input/enterprise128/` (`NICK_VIDEO.md`,
`NICK_VIDEO_BACKGROUND.md`, `DAVE_MEMORY_IO.md`, `DAVE_AUDIO_BACKGROUND.md`). The code is Klive's own;
no emulator's code was ported (plan D1).

**State (Phases 1-5, 2026-10-31):** EXOS 2.1 boots to IS-BASIC 2.1, the picture shows it and DAVE
plays; the host keyboard, the joysticks and Klive's `FILE:` device work. The memory map, DAVE's
interrupts, timers and sound generator, NICK's LPT walker and pixels, VINT, vertical sync, DAVE's wait
states and NICK's clock stretch are in. The virtual keyboard waits for its design (plan §9.1).

## Layout

- `ep/ep.c`: the translation unit. It holds the state, the time base, the `Z80_*` hook wiring, the
  frame loop and the exports, plus the shared debug loop, condition evaluator, history recorder and
  access profile.
- `ep/ep-memory.c`: the 256-segment map behind the page registers B0h-B3h.
- `ep/ep-keyboard.c`: the 10 x 8 matrix (B5h) and the external joysticks' J column (B6h).
- `ep/ep-dave.c`: DAVE's interrupt latches, the 1 kHz / 50 Hz / 1 Hz chain, the tone counters, BFh.
- `ep/ep-audio.c`: DAVE's sound generator, the stereo mix and the host's samples.
- `ep/ep-nick.c`: NICK's slot stepper, the LPT walker, LD1/LD2, VINT, vertical sync, port 83h.
- `ep/ep-ports.c`: the I/O decode.
- `ep/ep-tape.c`: the cassette: the tape program the deck plays, the motor, B6h's comparators, and the
  SAVE recording of the left D/A.
- `ep/ep-exdos.c`: the EXDOS floppy card: the shared controller (`../../common/wasm/wd1793.c`) as a
  WD1770, the card's control register, two drives.
- `ep/ep-timing.c`: DAVE's wait states and NICK's clock stretch.

## Physical memory

Only the segments that hold something have room in `epMemory`:

| Offset | Segments | What |
|---|---|---|
| 00000h | 00h-01h | EXOS (32K) |
| 08000h | 04h | the cartridge (IS-BASIC, 16K) |
| 0C000h | 10h | Klive's `FILE:` ROM (Phase 5) |
| 10000h | 20h-21h | EXDOS 1.3, with the EXDOS card (`MC_EP_EXDOS`) |
| 18000h | F8h-FBh | RAM on the 128 |
| 28000h | FCh-FFh | RAM, the video RAM (NICK's 0000h-FFFFh) |
| 38000h | every other | one segment of FFh |

The IDE's partitions are the segment numbers.

## Time

`cpu.tacts` counts whole CPU T-states (250 ns). NICK makes the CPU clock from the 8 MHz crystal and
stretches it by whole 8 MHz periods, so the core keeps `epHalfClock` in 125 ns units beside it (the
TVC's scheme, plan D4). DAVE ticks every 32 half-T units (48 with BFh bit 1 set).

NICK runs from its own oscillator, 14 237 536.27 Hz: exactly 40 434 603 / 22 720 000 NICK clocks per
half-T unit. `epNickAcc` holds NICK's position inside its current slot in units of 1/22 720 000 NICK
clock; a slot (16 clocks) passes for every 363 520 000. Integer arithmetic only, so it never drifts
and a replay sees exactly the same slots. NICK steps eagerly, one slot at a time, as the clock passes
it (`epClockAdvance`).

The machine frame ends where NICK's vertical sync starts. With EXOS's LPT that is 312 lines,
79 941.9 T (50.04 Hz): frames are 79 941 or 79 942 T, ending on a slot boundary. A frame shorter than
half a nominal one does not count; two nominal frames end one whatever the LPT does.

## The bus timing (plan §3.3, §6)

**DAVE's waits** (BFh bits 3-2): 00 one T on every memory access, 01 on M1 only, 10/11 none. Never on
I/O, never on video RAM. EXOS sets BFh = 04h (M1 only) during boot (`test/ep-hw/boot.test.ts`), which
settles the research pack's question about EXOS's default.

**NICK's stretch:** an access to a page that shows FCh-FFh, or to ports 80h-8Fh, is held in half-T
steps until its access point falls in the Z80's window of a slot (NICK clocks 10-15). The access
points are the EXOS book's: M1 at T2.0, memory at T2.5, I/O at T3.5 (`EP_ACCESS_*_HALVES`). Where
NICK really samples a request is not documented (plan Q3); the constants are one table. Consequences
the tests pin (`test/ep-hw/timing.test.ts`): code that runs from video RAM takes one slot per NOP
(4.495 T), a loop of video RAM reads locks to whole slots, and a write to NICK's ports lands inside the
Z80's window.

**Not yet compared with ep128emu** (an oracle run, plan §13): its tuned latencies (≈ 356-363 ns) may
place the window differently, which would change single-access costs but not the lock to the grid.

## NICK

The LPB is fetched on every line; the first line of a block loads the line counter and LD2, and LD1
loads then and on every line while VRES is clear. The margins are compared before a slot's own fetch,
right margin first; LD1 counts in every slot inside the margins, the control slots included. VINT is
MB bit 7 for the line; port 83h follows the flag model of `NICK_VIDEO.md` §3.5. Port reads return the
last byte NICK fetched.

NICK's port registers are random at power-on on a real machine; the core seeds them
(`epNickSetSeed`), and EXOS boots from any seed (its forced reload).

**The picture** (plan §7.2-§7.4) is drawn as each slot runs, 16 pixels a slot:

- one slot of pipeline: slot n shows what slot n - 1 fetched, and whether it was inside the margins;
  slots that fetch nothing inside the margins (54, 55) show the last bytes again;
- slots 56 and 0-9 are blanked (colour 0), and so is a whole VSYNC line;
- PIXEL shows two bytes a slot, LPIXEL and the character modes one byte across it, ATTRIBUTE one
  bitmap byte in its attribute's two colours; 2/4/16/256 colours with the guide's bit order;
- palette 0-7 from the LPB, 8-15 from FIXBIAS; the ALT options OR their offsets onto the index;
- **ALTIND1 is RM bit 6** (plan Q2, settled): EXOS writes RM = 73h and stores "IS-BASIC" and the
  cursor (8Eh) with code bit 7 set, while every ordinary letter has bit 6 set. With bit 6 as ALTIND0
  every letter would turn blue and the digits stay green. So the Programmer's Guide (and ep128emu) are
  right, and both editions of "The Nick Chip" have the two bits the other way round;
- colour levels from the board's resistor DAC (`epNickRgb`), or linear (`epNickSetLinearPalette`,
  `MC_EP_PALETTE`).

The TV window is slots 10-55 (736 pixels) and 288 lines from the 25th line after vertical sync starts:
EXOS's 252-line screen has 18 lines of border above and below, and its 40 columns (margins 11-51,
shown one slot late) sit 32 pixels from the left. No vertical sync for two frames loses the picture
(`epIsVideoSignalLost`). `epNickGetSyncSlot` tells interlaced fields apart (each is shown as it comes).

## DAVE (plan §8.1)

The four latches, B4h, the 1 kHz / 50 Hz / 1 Hz chain and the tone counters for the tone-generator
interrupt. **The VINT edge (D6, Q1):** `EP_VINT_AT_BLOCK_END` = 1 latches INT1 where a VINT block
ends (ep128emu and the EXOS book's appendix), not where it starts (the NICK documents). EXOS's own LPT
puts its 14-line VINT block just before vertical sync, so its interrupt comes three lines before the
frame ends.

## Sound (plan §8.2-§8.3)

`ep-audio.c` steps once per DAVE tick, inside `epDaveTick`, in the order the research pack records for
ep128emu: the polynomial counters (the noise one only if its clock fell before this tick), then the
counters and interrupts (`ep-dave.c`), then the channels in the order noise, ch2, ch1, ch0, each using
its partners' values as that order leaves them. So the effects that couple channels see a one-tick
skew against the gate plan's "everything samples the last tick" (plan Q8), as ep128emu does.

- Tone channels: toggle on reload, or sample the 4/5/7-bit (or swapped variable) poly; high-pass by the
  next channel, ring (XNOR) with the partner, continuously; sync holds the flip-flop at 0 and the
  counter at its code, and the ring still applies, so two held channels with ring make a constant 1.
- Noise: the 31.25 kHz square (a toggle every 4 ticks, free-running) or a tone channel's falling edge
  steps the noise poly; low-pass by ch2, high-pass by ch0, ring with ch1, in that order.
- The polys start from all ones (plan Q7: ep128emu's state; the chip's reset state is open). The
  variable poly is one register with switched feedback, so a length change keeps its low bits.
- Output: per side the amplitudes of the channels that are high (0-252), or 4 x ch0's in D/A mode. A
  one-pole low-pass at the board's 22.6 kHz runs at the tick rate; each host sample averages the
  filtered level over its interval (samples due before a tick are emitted before it); a DC high-pass
  stands in for the output capacitors. Gain 1.0: four channels at full amplitude swing +-0.5, one
  channel +-0.125 (ep128emu's proportion).
- Not modelled: the DAC's non-linearity, the 8 us output multiplex, the speaker and its mute (VC1).

With sound on, the core runs about 28 x real time in the harness (IS-BASIC idling).

## The keyboard and the joysticks (plan §9.1)

`ep-keyboard.c` holds the 10 x 8 matrix (B5h) and the external joysticks' J column: B6h bit 0 is low
while the selected row's contact is closed, rows 0-4 joystick 1 (fire, up, down, left, right), rows
5-9 joystick 2. The host side maps host keys by position (`EpKeyMappings.ts`), types text
(`EpTyper.ts`, read off the running ROM: 3 frames held, 3 released) and drives the joysticks from the
emulator panel's bindings (`setJoystickState`). IS-BASIC's `JOY(1)` reads the external stick.

## Klive's FILE: device (plan §9.2)

An EXOS extension ROM in segment 10h (`../fileio/ep-klive-fileio.asm`, Klive's own) adds the device
`FILE:`. Each device call pushes AF and writes the call's number to port **BCh**, which no real
hardware decodes (B8h-BEh are inside DAVE's range and unused). The core then holds the CPU - no
instruction runs, time passes - until the host has answered (`epHostFsState`: 1 new, the frame loop
and the debug loop return for it; 2 taken; 0 done). The host (`../EpHostFs.ts`) takes the channel from
the stack, puts the status back there and the other results in B, C and DE.

An open file is a byte array on the host side, so reads, writes and seeks are answered inside the
frame. Opening a file, closing a written one and destroying one need the file store - the main
process in the app (`EpMainFileStore.ts`: the folder `EP_FILEIO_FOLDER` names, else `FILEIO` in the
Klive home folder), a map in the tests - and run as the controller's frame command, while the CPU
keeps waiting. With the ROM fitted, EXOS keeps 19 bytes of system RAM for the device (IS-BASIC reports
116102 bytes unused instead of 116121).

A new application (`$$APP`, a `.com`) loaded through `FILE:` starts at 0100h; like any EXOS
application it must set up its own stack before it enables interrupts (the kernel spec §9.3).

## The cassette (plan §9.3)

`ep/ep-tape.c`'s header has the details. The host turns a tape file (`../EpTapeFile.ts`: an ep128emu
`.tap`, an EPTE/TAPir `.tap` or a `.wav`) into a *tape program*, a list of words (silence, runs of equal
half-periods, a byte at EXOS's fast or slow timings, a single edge), so a file needs no sample buffer.
The tape runs while REM1 or REM2 (B5h bits 6, 7) is set, and B6h bits 7 and 6 read its level. While a
motor runs, every change of the left output's level (EXOS writes through the left D/A) ends a
half-period, recorded in a ring the host decodes into chunks, checks (CRC-16, 0810h feedback, low byte
first) and publishes as an ep128emu `.tap`.

What the ROM does, observed on it: `LOAD` alone loads from tape (TAPE: is the default device) and
`RUN "TAPE:"` loads and runs; EXOS writes its PROTECT variable (34) into the header as it is, FFh for an
ordinary SAVE and 00h after `TOGGLE 34`, so 00h is the protected value. Fast load runs extra machine
frames per displayed frame while the tape plays with its motor on.

A new application loaded by Run (`common/enterprise/codePlacement.ts`) comes through `FILE:` too: the
machine serves the assembled program as `KLIVE.COM` from memory before it asks the file store, and a
store marked `synchronous` (the headless runner's) is answered inside the frame.

## The EXDOS card (plan §10)

`MC_EP_EXDOS` fits the card (off by default): the host uploads EXDOS 1.3 (`ep-exdos13.rom`) to segments
20h-21h and sets `EP_ROM_EXDOS` in `epConfigure`'s mask, which maps the ROM and decodes the ports.
Without it, 10h-1Fh read FFh as before.

- **Ports.** 10h-13h the controller (status/command, track, sector, data), mirrored at 14h-17h;
  18h-1Fh the control register, taken as one register (the pack's OQ4; CLK's decode). Write: bits 0-3
  select drive 0-3 (the lowest set bit; drives 2 and 3 have nothing in them), bit 4 the side, bit 5
  /DDEN (kept, not modelled: MFM only), bit 6 = 1 clears the selected drive's disk-change flag, bit 7 the
  LED. Read: bit 7 DRQ, bit 6 the disk-change line inverted (1 = no disk went in or out since the last
  clear; MAME's and ep128emu's polarity), bit 1 INTRQ, the rest 0.
- **The controller** is the shared WD1793 with `WD1793_VARIANT 1770` (`wd1793.c`'s header lists the
  differences): Motor On in status bit 7, spin-up (six index pulses unless command bit 3 is set) and
  Spin-up in Type I's bit 5, the motor off after nine idle revolutions, no READY wait and no side compare.
  A drive without a disk gives no index pulses, so a command on it waits until EXDOS gives up and sends
  a Force Interrupt. Its time is the 8 MHz half-T clock, not the stretched T-states. The 128K and TVC
  cores, which include the same file as a 1793, built byte-identical after the change.
- **Disks** (`../EpExdosDisks.ts`, `../EpDiskImage.ts`): raw `.img`/`.dsk` FAT12 images, the geometry
  from the boot sector; the controller's layout has nine 512-byte sectors a track, 82 cylinders, two
  sides, so 720K, 360K (40 x 2 or 80 x 1) and 180K disks go in and 8-, 10- and 18-sector disks are
  refused. The guest's writes go back as the whole image (`DSK_WHOLE_IMAGE_KEY`), as on the TVC.

What EXDOS does, observed on it: with an empty drive B it spends about 2 s at the cold start on that
drive (about 7.5 s when the controller failed such a command after four revolutions instead of waiting
for index pulses); `:HELP` lists "EXDOS version 1.3"; `SAVE "NAME"` and `LOAD "NAME"` use the disk
(DISK: becomes the default device); a write-protected disk gives "Write protected disk -- drive A:" and
asks to retry or abort. `EXDOS.INI` (EXDOS commands, one a line) runs at a cold start, not at the reset
button's warm start, which keeps the time it set. The ROM's text names a `START` file beside `EXDOS.INI`; what it does with it was not checked.

## Testing

`test/harness/enterprise/` scripts the real core: `bootToBasic`, frames, stepping, the LPT and the
screen's text, DAVE. `test/ep-hw/`:

- `boot.test.ts`: EXOS's RAM test, the banner, IS-BASIC with 128K; EXOS's LPT (observed); 312-line
  frames; BFh after boot; booting from several NICK seeds;
- `dave.test.ts`: the timers, tone-generator interrupts, sync hold, B4h, IM 1, BFh bit 1, VINT;
- `nick-lpt.test.ts`: the LPB read every line, LD1/LD2, margins that run on, the floating bus, port
  83h, the frame;
- `timing.test.ts`: DAVE's wait modes and M1s, NICK's stretch and the lock to the slot grid;
- `nick-picture.test.ts`: every mode and colour mode on a worked byte, FIXBIAS, the ALT options, the
  pipeline, blanking, a mid-line border write, the colour levels, the beam, signal loss, the IS 1984
  demo's frame, and EXOS's IS-BASIC screen (a picture hash checked by eye; `EP_SHOTS_PNG=<dir>` writes
  the PNGs);
- `sound.test.ts`: pitch, sync, BFh bit 1, the high-pass, ring with held channels, the polys' periods,
  the noise clocks, distortion aliasing, the sides and D/A mode, a 1 kHz tone through to the host's
  samples, and EXOS's keyclick;
- `keyboard.test.ts`: every typed character back from the screen, a program typed and run, the host
  mapping's targets, the external joysticks through B6h and IS-BASIC's `JOY(1)`;
- `hostfs.test.ts`: the ROM in segment 10h, IS-BASIC's `SAVE`/`LOAD` through `FILE:`, a `.com` loaded
  and started, and a missing file. (`test/machines/ep-fileio-rom.test.ts` checks the ROM image against
  its source.)
- `exdos.test.ts`: the card's ports and ROM, the disk-change flag, the WD1770's motor, spin-up and
  time-out, an empty drive's wait, `:DIR`, a 40-track disk, `SAVE`/`LOAD` through the published image,
  write protection, and `EXDOS.INI`; the disks come from the tests' own FAT12 writer
  (`test/ep/fat12Image.ts`; `test/ep/ep-disk-image.test.ts` checks the image conversion).

Most run on a bare machine (`bare.ts`): the CPU in segment F8h, the LPT written by the test.
