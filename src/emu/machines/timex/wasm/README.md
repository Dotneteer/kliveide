# Timex WASM Core

The Timex core (`.plans/TIMEX_SCORPION_PLAN.md`, P2) runs the Timex Computer 2048 (G9.4a), the
Timex Computer 2068 and the Timex Sinclair 2068 (G9.4b), chosen by `timexHardReset(model)`. It builds
to `dist/zx-timex.wasm` (`npm run build:timex-wasm`).

## How it is built

The TC2048 is a 48K Spectrum whose ULA is Timex's SCLD, so `timex/timex.c` is short: it switches on
`SP48_SCLD` and includes the 48K machine (`zxSpectrum48/wasm/sp48/sp48.c`), with every shared
Spectrum piece that file includes. The SCLD itself is the shared
`zxSpectrum/wasm/common/zx-spectrum-scld.c`, which `zx-spectrum-ula.c` includes in place of its own
renderers when `SP48_SCLD` is defined. The switches:

| Switch | 48K | Timex |
|---|---|---|
| `SP48_SCLD` | undefined | defined: the SCLD renderer, port `$FF`, the Kempston port, the interrupt inhibit |
| `SP48_PIXEL_SCALE` | 1 | 2: two buffer pixels per Spectrum pixel |
| `SP48_SCREEN_BUFFER_WIDTH_MAX` | 352 | 704 |
| `SP48_BASE_CLOCK_FREQUENCY_PAL` | 3 500 000 | 3 528 000 (the SCLD's 14.112 MHz / 4) |
| `SP48_DISPLAY_MEMORY_END` | `$5B00` | `$7B00` (the second display file) |
| `SP48_CONTENDED_MEMORY` | `$4000-$7FFF` | the same, while HOME is mapped there |
| `SP48_PORT_IS_ULA` | A0 low | A0 low (TC2048); the full low byte `$FE` (2068s) |
| `SP48_TAPE_*_ROUTINE` | the 48K ROM's | per ROM (`timexSetTapeTraps`), and in which ROM (`SP48_TAPE_TRAP_ACTIVE`) |

The 48K build is unchanged bit for bit by these switches; the 128K and +3E cores, which include the
same ULA, port and tape files, too.

## The 2068s' memory

`sp48Memory` is the HOME bank (the 16K HOME ROM, then 48K of RAM). Each 8K chunk the CPU addresses
comes from HOME, or - when its bit in port `$F4` is set - from the DOCK (`$FF` bit 7 clear) or the
EXROM bank (set): `timexRebuildChunkMap` keeps a base pointer, a writable flag and a source per
chunk. The 8K EXROM answers in every chunk of its bank; an unpopulated DOCK chunk, and the EXROM bank
with no EXROM, read `$FF`. The display always comes from HOME, and only HOME's display RAM is
contended. The DOCK's 64K and its chunk types are statics, so a state file carries the cartridge.

The TS2068 ROM keeps the 48K's tape routines, moved into the EXROM; the host passes their addresses
(`timexModels.ts`, `TIMEX_KNOWN_ROMS`), and the trap fires only while chunk 0 is the EXROM.

The core keeps the 48K's exports under their `sp48` names, so the host reuses the 48K's loader and
machine (`TimexWasmV2Machine` extends `ZxSpectrum48WasmV2Machine`); `timex*` exports add the model's
hard reset, port `$FF` and the Kempston port. A Klive state file records the core as `timex`, so a
48K state never loads into it.

## The picture

The buffer is 704 x 288 (two pixels per Spectrum pixel in every mode), so the 512-wide mode needs no
size change mid-frame; the emulator panel shows it at half width (`getAspectRatio`). The timing
tables stay in Spectrum pixels: the renderer doubles their indexes. A port `$FF` write draws the
picture up to the current tact first, so a mode change takes effect at the `OUT`.

## Tests

`test/timex-hw/` through the harness in `test/harness/timex/` (the 48K harness's session plus the
SCLD, the chunk map and the cartridge). Klive cannot ship the Timex ROMs; a machine boots the Sinclair
48K ROM without its own, so every test runs in CI. Set `KLIVE_TC2048_ROM`, `KLIVE_TC2068_ROM` or
`KLIVE_TS2068_ROM` (the 2068s' as one 24K file) to run the ROM-gated cases too.
