# ZX Spectrum 128K WASM Core

The ZX Spectrum 128K WASM implementation is being migrated in small V2
full-machine slices. The production artifact name is `zx-spectrum128.wasm`, built
from `wasm/v2` and loaded by `Sp128WasmV2Loader.ts`.

The runtime switch has two supported values:

- `sp128Implementation: "typescript"` uses the current TypeScript implementation.
- `sp128Implementation: "wasm"` opts into the V2 WASM migration path.

`DEFAULT_SP128_IMPLEMENTATION` in `ZxSpectrum128Implementation.ts` remains
`"typescript"` until the WASM backend reaches parity.

Build with `npm run build:sp128-wasm`. The compiler defaults to `clang`; set
`SP128_WASM_CC` to select another C compiler. The build script uses the portable
`wasm32` target and `wasm-ld`, so it does not require Emscripten.
