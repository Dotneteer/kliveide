# Timex WASM Core

The Timex core (`.plans/TIMEX_SCORPION_PLAN.md`, P2) runs the Timex Computer 2048 (G9.4a); the
TC2068 and TS2068 join it as models in G9.4b. It builds to `dist/zx-timex.wasm`
(`npm run build:timex-wasm`).

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

The 48K build is unchanged bit for bit by these switches; the 128K and +3E cores, which include the
same ULA file, too.

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
SCLD). Klive cannot ship the TC2048 ROM; the machine boots the Sinclair 48K ROM without one, so every
test runs in CI. Set `KLIVE_TC2048_ROM` to a TC2048 ROM to run the ROM-gated cases too.
