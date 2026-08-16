# ZX Spectrum +2E/+3E WASM Core

The ZX Spectrum +2E/+3E WASM implementation is being introduced as a
full-machine backend. The production artifact name is `zx-spectrum-p3e.wasm`,
built from this folder and loaded by `SpP3eWasmV2Loader.ts`.

## Layout

- `spp3e/`: the +2E/+3E C machine implementation.
- `dist/`: generated production WASM artifact.

The runtime switch has two supported values:

- `spp3eImplementation: "wasm"` selects the WASM adapter and is the rollout
  default.
- `spp3eImplementation: "typescript"` explicitly selects the TypeScript
  fallback while final parity work is completed.

Build with `npm run build:spp3e-wasm`. The compiler defaults to `clang`; set
`SPP3E_WASM_CC` to select another C compiler. The build script uses the
portable `wasm32` target and `wasm-ld`, so it does not require Emscripten.
