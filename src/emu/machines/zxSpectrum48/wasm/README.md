# ZX Spectrum 48K WASM Core

The ZX Spectrum 48K WASM implementation is the full-machine C core under this
folder. It builds to `dist/zx-spectrum48.wasm` and is loaded by
`Sp48WasmV2Loader.ts`.

## Layout

- `sp48/`: the SP48 C machine implementation.
- `dist/`: generated production WASM artifact.

The backend reuses the shared C Z80 core from `src/emu/z80/wasm/z80.c`.

The runtime switch has only two supported values:

- `sp48Implementation: "wasm"` uses the WASM implementation.
- `sp48Implementation: "typescript"` uses the TypeScript implementation.

`DEFAULT_SP48_IMPLEMENTATION` in `ZxSpectrum48Implementation.ts` controls the
default. The machine model menu intentionally stays implementation-neutral and
shows only the ZX Spectrum 48K PAL, ZX Spectrum 48K NTSC, and ZX Spectrum 16K
models.

Build with `npm run build:sp48-wasm`. The compiler defaults to `clang`; set
`SP48_WASM_CC` to select another C compiler. The build script uses the portable
`wasm32` target and `wasm-ld`, so it does not require Emscripten.
