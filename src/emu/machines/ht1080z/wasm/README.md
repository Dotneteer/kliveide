# HT-1080Z WASM Core

One C core runs every HT-1080Z model (`.plans/HT1080Z_PLAN.md`, decision D1): `ht1080zConfigure`
picks Series I, Series II or the /64 (the clock follows) and 16K or 48K of RAM at run time, and the
host uploads the model's three ROMs. It builds to `dist/ht1080z.wasm` and is loaded by
`Ht1080zWasmV2Loader.ts`; the TypeScript side is `../Ht1080zWasmHost.ts` (plumbing) and
`../Ht1080zWasmV2Machine.ts` (the adapter). There is no TypeScript HT machine and no second CPU: the
core includes the shared Z80 (`src/emu/z80/wasm/z80.c`) through its `Z80_*` hooks.

The hardware facts come from the research pack `_input/ht1080z/` (HARDWARE.md, VIDEO_TIMING.md),
with the values recorded in the plan's §17. The code is Klive's own.

## Layout

- `ht1080z/ht1080z.c`: the translation unit: state, the `Z80_*` hook wiring, the frame loop, the
  exports, the shared debug loop, condition evaluator, history recorder and access profile.
- `ht1080z/ht1080z-memory.c`: the memory map.
- `ht1080z/ht1080z-keyboard.c`: the 8 x 8 matrix at 3800h-3BFFh.
- `ht1080z/ht1080z-ports.c`: ports FFh, FEh and FDh; the cassette-in latch.
- `ht1080z/ht1080z-video.c`: the catch-up raster renderer, the CPU-access dash, VIDEO CUT and PAGE.
- `ht1080z/ht1080z-audio.c`: the beeper, the AY (the Spectrum's `zx-spectrum-psg.c`, the one shared
  Spectrum device `check-wasm-cpu-contract.cjs` allows here), the mono mix and the sample buffer.

- `ht1080z/ht1080z-tape.c`: the tape: the pulse player, the fast-load and SAVE traps.

## Sound

One speaker, as on the board (SOUND_AY.md §4): the beeper (port FF bits 0-1, three levels; muted
while bit 2, the recorder relay, is on) and the AY's three channels, tied together, summed in mono
and written to both sides of a stereo buffer of doubles after a 1.4 Hz DC high-pass (its coefficient
from the host) and a clamp. Both sources are averaged over each sample.

- **The AY's clock is the CPU clock**: the shared PSG steps its prescaler every 8 T
  (`SP128_PSG_CLOCK_STEP`, overridable since Phase 1; the Spectrum's AY at half its CPU clock steps
  every 16). A tone period of 100 plays 1,110.9 Hz on the /64 (`test/ht1080z-hw/sound.test.ts`).
- **Ports:** OUT 1Fh latches the register, OUT 1Eh writes it, IN 1Fh reads it (MAME reads at 1Eh,
  which the schematic contradicts); IN 1Eh is open bus, FFh. I/O ports A and B read FFh as inputs.
- **Time:** the PSG and the sample schedule count in the frame's tacts (`sp128Tacts` is
  `htFrameTacts`), so the 32-bit CPU counter's wrap never reaches them; `htAudioEndFrame` moves every
  absolute point back by a frame. **A new absolute point must be added there.**
- **Reset:** the AY at power-on only; the RESET key (an NMI) leaves it playing (SOUND_AY.md §6:
  probable, unverified).

## The picture

The frame is a grid of 312 lines x 112 slots, and slot `s` is the CPU's frame tact `s`. On lines
0-191 the display reads video-RAM column n at slot n and shows its 6 dots at slot n + 2, so slots
2-65 are visible; everything else is blanking. The 528 x 288 picture puts that 384 x 192 window at
(72, 48) in a black border (D6); the host reports dots about 2:3 wide (`getAspectRatio`).

Nothing is drawn per T-state. The renderer catches up to the CPU when the memory delay hook sees a
cycle on 3C00h-3FFFh (opcode fetches included), when a video switch changes, at the end of a frame,
and when the IDE shows a paused machine (`ht1080zRenderToBeam`). The delay hook keeps the default
3 T: the HT has no wait states.

| Rule | Value | Where |
|---|---|---|
| A write | reads up to its T1 slot see the old byte, later reads the new one; a column the beam has read changes from the next scan line | `htVideoCpuAccess` |
| The dash (D7) | an access whose T1 is at slot x blanks the reads at x and x + 1 (VID low from mid-T1 to mid-T3 covers the latch strobes of T2 and T3); off with `ht1080zSetVideoDash(0)` | `HT_DASH_READ_OFFSET`, `HT_DASH_LENGTH` (an inference; one place to change) |
| Characters | the glyph's row from the character ROM, bits 7-3, 6th dot blank; Series I/II draw 00h-1Fh as 40h-5Fh (D10), the /64 its own glyphs | `htVideoDots` |
| Semigraphics | D7 = 1: bit pairs D0/D1, D2/D3, D4/D5 for scan lines 0-3, 4-7, 8-11; even bit left | `htVideoDots` |
| VIDEO CUT, PAGE | 32 columns of 12 dots; PAGE shows 32-63; line and frame totals unchanged. Machine switches, not ports, kept across resets | `ht1080zSetVideoCut`, `ht1080zSetVideoPage` |

The video RAM keeps all 8 bits on every model: a read gives back what was written.

## The machine

| | |
|---|---|
| Clock | 1,774,000 Hz (Series I/II), 1,777,417 Hz (/64); no wait states |
| Frame | 112 T a line (one T per character slot) x 312 lines = 34,944 T |
| Memory | ROMs 0000h-37FFh (BASIC, then the extension); keyboard 3800h-3BFFh; video RAM 3C00h-3FFFh; RAM 4000h-7FFFh, or to FFFFh with 48K. Above a 16K machine's RAM reads give FFh and writes are lost. |
| Keyboard | the TRS-80 Model I matrix: address bits A0-A7 select rows, the selected rows are ORed; key code = `row * 8 + column` |
| Ports | decoded on A0-A7. FFh write latches the cassette/relay bits and clears the cassette-in latch; FFh read gives the latch on bit 7 and 1s elsewhere; FEh bit 4 selects recorder 2; FDh reads 30h (no printer); everything else reads FFh |
| Interrupts | none: INT is unconnected. The RESET key (`ht1080zPressResetKey`) is an NMI to 0066h, taken at the next instruction boundary. HALT does not cause an NMI. |

The memory is one 64K array, the CPU's view: the host uploads the ROMs to its start
(`ht1080zRomPtr`, 3800h bytes) and a power-on clears everything from 3800h up. The condition store
reads it as the machine's linear memory.

## Tape

A tape is a `.cas` bit stream (`.cmd` and tokenised `.bas` files are turned into one by
`../Ht1080zTapeFile.ts`: a SYSTEM tape and a CLOAD tape, as the ROM writes them). The host uploads it
once; the core plays it.

- **Real time:** each bit is a cell with a clock pulse and, for a 1, a data pulse; the cassette-in
  latch is set 227 T into a pulse. The timing is the ROM writer's own: the data pulse 1,763 T after
  the clock pulse, cells of 3,557 T (1) and 3,570 T (0). The tape moves while the recorder's motor
  runs (port FF bit 2) or F1 holds it on. After every sync (00 00 00 A5h at any bit offset) the
  player leaves 1 ms of silence: the ROM's reader draws `**` and returns to CLOAD/SYSTEM there,
  longer than a cell's slack, and a `.cas` does not record the pause a real tape has.
- **Fast load:** at the entry of CTBIT (0241h) and the byte loop (0235h) the core does the routine's
  work itself from the same bit position, so both modes read the same bits and end in the same RAM
  (`test/ht1080z-hw/tape.test.ts`).
- **SAVE:** the bytes the ROM's writer (0264h) sends from a recording's start (0284h) to the motor
  going off (01F8h) are captured as a `.cas`; with fast load on the writer is skipped.
- **Load and Run:** the host's typing script types each command once BASIC is idle at a prompt,
  which the core sees as passes of the wait-for-key loop's `JR` at 004Eh
  (`ht1080zGetKeyWaitLoops`).
- A reset rewinds the tape, as on the ZX80/81 core.

## Building and measuring

`npm run build:ht1080z-wasm` (compiler `clang`, or `HT1080Z_WASM_CC`; `HT1080Z_WASM_OPTIMIZATION` =
`speed` (default), `size` or `lto`). `npm run check:ht1080z-wasm-size`: 269 KB against a 300 KB
ceiling.

## Tests

- `test/harness/ht1080z/` - the session (real ROMs, boot to the prompt, keys, the debugger).
- `test/ht1080z-hw/` - the hardware-rule probes: machine code run under the booted ROM; the video
  probes (`video.test.ts`: the dash, a write against the beam, 32 columns) and the screen goldens
  (`screen.test.ts`, recorded after a look at the PNGs; `goldens.ts` says how).
- `test/machines/ht1080z-rom-images.test.ts` - the shipped ROM images.
- `test/ht1080z/` - the separation from TypeScript machines.
