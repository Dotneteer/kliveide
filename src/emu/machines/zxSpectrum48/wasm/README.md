# ZX Spectrum 48K C/WASM core

`sp48_core.c` is a deliberately small, libc-free WebAssembly ABI. It establishes
the memory and ULA ownership boundary without prematurely duplicating the full
TypeScript machine. The generated `.wasm` is a build artifact and is not
committed.

Build with `npm run build:sp48-wasm`. The compiler defaults to `clang`; set
`SP48_WASM_CC` to select another C compiler. The build script uses the portable
`wasm32` target and `wasm-ld`, so it does not require Emscripten.

The current `wasm` machine selection is a compatibility facade that uses the
TypeScript execution path. Do not wire C exports into production execution until
the conformance milestones in the initial plan are complete.
