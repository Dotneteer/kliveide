# ZX Spectrum 128K WASM Core

The ZX Spectrum 128K WASM implementation is a full-machine backend. The
production artifact name is `zx-spectrum128.wasm`, built from this folder and
loaded by `Sp128WasmV2Loader.ts`.

## Layout

- `sp128/`: the 128K C machine implementation, including the AY PSG core.
- `dist/`: generated production WASM artifact.

The backend reuses the shared C Z80 core from the 48K WASM tree.

The runtime switch has two supported values:

- `sp128Implementation: "wasm"` uses the default C/WASM implementation.
- `sp128Implementation: "typescript"` uses the TypeScript fallback.

`DEFAULT_SP128_IMPLEMENTATION` in `ZxSpectrum128Implementation.ts` is `"wasm"`.

Build with `npm run build:sp128-wasm`. The compiler defaults to `clang`; set
`SP128_WASM_CC` to select another C compiler. The build script uses the portable
`wasm32` target and `wasm-ld`, so it does not require Emscripten.
