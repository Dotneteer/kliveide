# ZX Spectrum 48K C/WASM core

`sp48_core.c` is the libc-free WebAssembly ABI for the experimental Spectrum 48K
backend. The C core owns the 48K memory map, Z80 execution, FE I/O, contention
and floating-bus timing tables, border/audio/tape event traces, and debug access
logs. Normal running enters WASM once per frame; debug running enters WASM at
instruction boundaries so TypeScript can keep the IDE breakpoint and stepping
policy.

Build with `npm run build:sp48-wasm`. The compiler defaults to `clang`; set
`SP48_WASM_CC` to select another C compiler. The build script uses the portable
`wasm32` target and `wasm-ld`, so it does not require Emscripten. The generated
`.wasm` is a build artifact and is not committed; Electron packaging copies it
from `src/emu/machines/zxSpectrum48/wasm/dist` to
`wasm/zxSpectrum48/zx-spectrum48.wasm`.

The WASM backend is the default for 48K machines. The default switch is kept in
one place: `DEFAULT_SP48_IMPLEMENTATION` in
`ZxSpectrum48Implementation.ts`. Change it to `"typescript"` to swap the rollout
default back. Explicit machine config can still select either backend with
`sp48Implementation: "wasm"` or `sp48Implementation: "typescript"`; unknown
values use the centralized default.

When the WASM backend is selected, loading is strict: missing
artifacts, ABI-version mismatches, and layout mismatches throw clear loader
errors instead of silently falling back to TypeScript. Backend, ABI, artifact,
termination, CPU status, and event-status details are exposed through
`ZxSpectrum48WasmMachine.getWasmDiagnostics()` for IDE diagnostics.

Do not introduce dynamic allocation in the C/WASM implementation. Machine state,
memory, timing tables, event traces, debug logs, and temporary buffers are
statically allocated with compile-time capacities; bounded buffers report
overflow through explicit event-status bits.
