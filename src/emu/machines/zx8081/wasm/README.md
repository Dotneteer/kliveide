# Sinclair ZX80 / ZX81 WASM Core

One C core runs both machines (`.plans/ZX8081_WASM_PLAN.md`, decisions D2 and D6): `zx8081Configure`
picks the ZX81 or ZX80 ULA, the 8K or 4K ROM, 1K/16K/64K RAM and PAL or NTSC at run time. It builds
to `dist/zx8081.wasm` and is loaded by `Zx8081WasmV2Loader.ts`; the TypeScript side is
`../Zx8081WasmHost.ts` (plumbing) and `../Zx8081WasmV2Machine.ts` (the adapter). There is no
TypeScript ZX81 machine and no second CPU: the core includes the shared Z80 (`src/emu/z80/wasm/z80.c`)
through its `Z80_*` hooks.

The ULA logic and its constants are ported from Clock Signal (CLK) by Thomas Harte (MIT; the notice is
in `zx8081/zx8081.c` and `THIRD_PARTY_NOTICES.md`). The plumbing is Klive's own.

## Layout

- `zx8081/zx8081.c`: the translation unit: state, the `Z80_*` hook wiring, the keyboard (the Spectrum's
  `zx-spectrum-keyboard.c` through aliases - decision D3), the frame loop, the exports.
- `zx8081/zx8081-memory.c`: the memory map and the M1 NOP forcing.
- `zx8081/zx8081-ula.c`: the line timer, HSYNC, the NMI generator and WAIT, the INT on A6, the refresh
  character fetch, the ports.
- `zx8081/zx8081-video.c`: the raster builder (sync black, idle white, 8 pixels a byte) and the TV's
  frame sync and flywheels.
- `zx8081/zx8081-tape.c`: the tape pulse synthesizer, the automatic motor, the fast-load traps.

## How the ULA maps onto the shared Z80 (plan §3)

| ULA behaviour | Hook |
|---|---|
| M1 above 32K of a byte with bit 6 clear: latched for the video, NOP on the bus | `Z80_BEFORE_OPCODE_FETCH` marks the next read as the opcode read; the memory read does the rest. Not `Z80_AFTER_OPCODE_FETCH`: the core calls `Z80_REFRESH` before that hook, and the refresh draws the byte. |
| Refresh: the character row from (I & $FE) + code * 8 + line, ROM or RAM | `Z80_REFRESH(I:R before the increment)`. In RAM the byte comes from the refresh address itself, as in CLK: the ULA substitutes A0-A8 for the ROM only, so RAM sees the CPU's I:R. WRX hi-res depends on it; `test/zx8081-hw/screen.test.ts` ("hi-res") draws stripes with the character address instead. |
| INT wired to A6 during refresh | `Z80_REFRESH` records "refresh ends at `cpu.tacts + 1`"; the frame loop raises INT for the next boundary when the instruction ended there (CLK's retroactive sample). |
| NMI at HSYNC start; WAIT while it is asserted and the CPU is not HALTed | The memory and port delay hooks drain WAIT, as Spectrum contention adds tacts; `Z80_NMI_ACK_WAIT` drains it inside the NMI acknowledge. |
| The INT acknowledge resets the line timer | `Z80_INT_ACK` |
| R counts every M1 | The shared core's fix (C4): a prefixed instruction adds 2. |

The picture is synchronised by the HALT at NMI-CONT: a HALTed CPU is not waited, so the NMI's
acknowledge starts within 4 T of HSYNC and WAIT stretches it to HSYNC's end. An NMI that interrupts
running code is not synchronised (WAIT ends with HSYNC and the rest of the instruction varies) - on the
real machine either. The NMI hook and the stack writes after it are equivalent for this: either one
alone keeps the picture still, so disabling only one of them is not a test of the other.

## The picture

A raw 416 x 400 raster (2 pixels per T, 207-T lines) is built as the beam moves; a VSYNC of at least a
line ends the TV frame once the frame has 200 lines, and the visible 352 x 288 window (352 x 240 NTSC,
decision D4) is copied out of it then. The window is calibrated so the ROM's 256 x 192 picture sits at
(48, 48): 48 pixels of border, from MARGIN 55 (PAL) or 31 (NTSC). The ZX80's HSYNC ends a T later, so
its window starts 2 pixels later. With no VSYNC (FAST mode running, a crashed program) the vertical
flywheel ends the frame after 390 (PAL) or 328 (NTSC) lines, and a line with no HSYNC for two line
times is ended by the horizontal one. A ZX81 running BASIC in FAST mode shows a black screen: the BREAK
check reads port $FE (VSYNC on) and nothing ends it - so does the real machine.

## Tape

A `.p`/`.81` file is the bytes from $4009; the host puts the nameless-file marker $80 in front, as
CLK does, so `LOAD ""` accepts it. `.o`/`.80` files start at $4000. The host uploads the bytes once;
the core synthesizes the pulses from them (CLK's format: 1 s of silence, then for every bit a 1300 us
gap and 4 or 9 waves of 150 us high + 150 us low) rather than taking a pulse list, which would be
millions of entries for 16K. The motor runs only while the ROM's LOAD does ($0340-$03C2 on the ZX81,
$0206-$024C on the ZX80) and play is pressed.

Fast load traps the ZX81 ROM's three calls of IN-BYTE (checked against the ROM listing): NEXT-PROG
($0347, answered as its silence timeout), IN-NAME ($0366) and IN-PROG ($037C); the ZX80's is CLK's
($0220 -> $0248). Bytes after E_LINE are never read: the ROM stops there.

## Models

| | RAM | Notes |
|---|---|---|
| ZX81 1K / 16K | from $4000, mirrored to $FFFF | the ROM at $0000 and $2000 |
| ZX81 64K | $2000-$FFFF | an opcode fetch above 32K reads the lower 32K, as the RAM packs that keep the display working do; CLK's 64K map has no picture |
| ZX81 US (NTSC) | 1K / 16K | port $FE bit 6 reads 0, the ROM sets MARGIN 31, 54,167-T frames |
| ZX80 1K / 16K | from $4000 | 4K ROM; no NMI generator; the line timer only resets at an INT acknowledge |
| ZX80 with the 8K ROM | 16K | the ZX81 ROM on ZX80 hardware: FAST mode only; keys and characters follow the ROM |

## Building and measuring

`npm run build:zx8081-wasm` (compiler `clang`, or `ZX8081_WASM_CC`; `ZX8081_WASM_OPTIMIZATION` =
`speed` (default), `size` or `lto`). `npm run check:zx8081-wasm-size`: 227 KB against a 240 KB ceiling (185 KB before the access profile's hooks; the M1 path of the memory read is `noinline` so those hooks do not copy it into every access).
`npm run benchmark:zx8081-wasm`: on an Apple M4 Pro, 0.27 ms per 20 ms frame in SLOW mode at the
prompt (74x real time), 0.30 ms running BASIC (66x), 0.26 ms in FAST mode (77x). The hooks are
`noinline`, as the Z88's tact hook is.

## The access profile

Code coverage, the heat map and the profiler's time (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`) use
the shared `z80-profile.c`; the mapping is at the end of `zx8081.c`. A byte's profile offset is its
canonical address (the ROM at $0000-$1FFF through its mirrors, the 1K/16K RAM at $4000 up through its
echoes, the 64K RAM at its address), plus $10000-$11FFF for the 64K's lowest 8K, which only an opcode
fetch above 32K reaches - so one layout (`src/common/profile/layouts/zx8081.ts`) serves every model.
The display file's forced NOPs are M1 cycles at its bytes and are profiled as such: it reads as
executed, and as self-modified once the ROM writes it.

## Tests

- `test/wasm/z80-hooks/` - the shared core's hooks C1-C3; `test/z80/r-register.test.ts` - C4, on both
  CPUs.
- `test/harness/zx81/` - the session (real ROM, boot to the K cursor, typing, program loading, the
  debugger); `test/zx8081-hw/` - ULA timing, screen goldens, tape, ZX80, debugger; `test/zx8081/` -
  file recognition, characters, typing, the build, the separation from TypeScript machines.
- `scripts/doc-shots/recipes/zx81.cjs` - the machine in the running app.
