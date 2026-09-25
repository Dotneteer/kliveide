# ZX Spectrum 48K WASM Core

The ZX Spectrum 48K WASM implementation is the full-machine C core under this
folder. It builds to `dist/zx-spectrum48.wasm` and is loaded by
`Sp48WasmV2Loader.ts`.

## Layout

- `sp48/`: the SP48 C machine implementation.
- `dist/`: generated production WASM artifact.

The backend reuses the shared C Z80 core from `src/emu/z80/wasm/z80.c`.

Classic ZX Spectrum 48K/16K models always use this WASM backend. The machine
model menu intentionally stays implementation-neutral and shows only the ZX
Spectrum 48K PAL, ZX Spectrum 48K NTSC, and ZX Spectrum 16K models.

Build with `npm run build:sp48-wasm`. The compiler defaults to `clang`; set
`SP48_WASM_CC` to select another C compiler. The build script uses the portable
`wasm32` target and `wasm-ld`, so it does not require Emscripten.

## The tact counter's epoch

The counter is 32 bits, and the frame loop, the frame position, the beeper and the PSG compare
absolute tact points by value. Left alone, the counter wrapped after about 20 minutes and the frame
loop stopped for good (issue #1374). Once a frame starts past `SP48_TACT_REBASE_THRESHOLD` (2^30),
`sp48ShiftTactOrigin` moves every absolute point back by that start, and `sp48TactEpoch` keeps what
was taken off. Every export that hands out or takes an absolute tact adds or removes the epoch, so
the host's counter is continuous. The 128 and +3E cores mirror this (`sp128…`, `spp3e…`), with the
PSG's clock included.

**A new absolute tact point must be added to the shift function**, or it goes stale at the first
rebase, about 5 minutes into a session. A duration (a difference of two points) needs nothing.
`test/wasm/zxSpectrum/wasm-tact-rebase.test.ts` drives all three cores through five rebases using
the `<core>TestAdvanceTacts` hook.

