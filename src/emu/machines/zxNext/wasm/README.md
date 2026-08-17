# ZX Spectrum Next WASM Scaffold

The ZX Spectrum Next WASM backend is currently an explicitly selectable
integration scaffold, not a migrated emulator core. The production artifact name
is `zx-spectrum-next.wasm`, built from this folder and loaded by
`ZxNextWasmV2Loader.ts`.

## Layout

- `zxnext/`: the freestanding C scaffold.
- `dist/`: generated production WASM artifact.

The runtime switch has two supported values:

- `zxnextImplementation: "typescript"` selects the existing TypeScript machine
  and remains the default.
- `zxnextImplementation: "wasm"` selects the incomplete WASM scaffold for
  migration work.

Diagnostics from `ZxNextWasmV2Machine.getWasmV2Diagnostics()` always report
`implementationIncomplete: true` and list the scaffolded surfaces: registers,
memory, disassembly, ULA, screen, frame, and debug.

Build with `npm run build:zxnext-wasm`. The compiler defaults to `clang`; set
`ZXNEXT_WASM_CC` to select another C compiler. The build script uses the
portable `wasm32` target and `wasm-ld`, so it does not require Emscripten.
