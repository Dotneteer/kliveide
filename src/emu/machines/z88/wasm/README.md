# Cambridge Z88 WASM Core

The Cambridge Z88 WASM implementation is the full-machine C core under this folder. It builds to
`dist/cambridge-z88.wasm` and is loaded by `Z88WasmV2Loader.ts`. The migration is planned and
tracked in `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.

**Status: scaffolding (Step 1).** The core has its buffers, reset, the LCD shape and the CPU register
getters, and it includes the shared Z80 core. It does not emulate a Z88 yet: the TypeScript
`Z88Machine` is the only working backend.

## Layout

- `z88/z88.c`: the translation unit: machine state, the Z88 parts, the shared Z80 core
  (`src/emu/z80/wasm/z80.c`) wired through the `Z80_*` hook macros, and the exports.
- `z88/z88-memory.c`: the CPU's view of memory (a placeholder until Step 4).
- `dist/`: the generated artifact (git-ignored).

The Z88 includes none of the ZX Spectrum device sources (`zxSpectrum/wasm/common/`): its Blink,
LCD, keyboard and beeper are Z88-specific. `check-wasm-cpu-contract.cjs` enforces both the shared
Z80 core and the absence of the Spectrum devices.

## Building

`npm run build:z88-wasm` (compiler: `clang`, or `Z88_WASM_CC`; profile: `Z88_WASM_OPTIMIZATION`
= `speed` (default), `size` or `lto`). `npm run check:z88-wasm-size` checks the size ceiling. The
build uses the portable `wasm32` target and `wasm-ld`, not Emscripten. Builds of the production
artifact are serialized with a lock file (`scripts/wasm-build-lock.cjs`), because test workers build
it in parallel.

## Behaviour pinned from the TypeScript oracle

Ported verbatim for parity, and fixed in both cores later (follow-ups of the migration plan):

- **F1:** the Blink's interrupt check tests `INT & STA`, whose bits do not line up everywhere
  (STA.TIME meets INT.GINT, STA.FLAPOPEN meets INT.KWAIT).
- A row of LORES cells leaves the last 4 pixels of a 640-pixel row unpainted.
- A snoozing `$B2` keyboard read answers `$FF` at once (the hardware holds the read).
