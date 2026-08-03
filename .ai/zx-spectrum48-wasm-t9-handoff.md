# ZX Spectrum 48K WASM performance tuning — T9 handoff

Generated: 2026-08-03

## Current rollout state

- The ZX Spectrum 48K default backend remains WASM.
- The rollout switch is centralized in
  `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`:
  `DEFAULT_SP48_IMPLEMENTATION`.
- Explicit config can still select `"typescript"` for fallback/comparison.
- Factory tests cover:
  - default selection,
  - explicit WASM,
  - explicit TypeScript fallback,
  - model-level WASM selection,
  - unknown-selection fallback to the centralized default,
  - explicit config opt-out from a model-level WASM selection.

## T9 smoke coverage

Added `test/zxSpectrum/sp48-wasm-rollout-smoke.test.ts`.

The smoke pack covers the user-facing paths most likely to reveal rollout
breakage:

- valid TAP bytes parsed into `TapeDataBlock`s and fast-loaded with
  TypeScript/WASM memory and tape-mode parity,
- valid TZX standard-speed bytes parsed into `TapeDataBlock`s and fast-loaded
  with TypeScript/WASM memory and tape-mode parity,
- border/audio FE writes with WASM trace checks,
- keyboard FE polling with TypeScript memory parity,
- debugger `StepInto` execution through the WASM backend.

## Latest benchmark reference

T8 benchmark note:
`.ai/zx-spectrum48-wasm-t8-benchmark.md`

Production artifact:

- `src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm`
- 71,312 bytes
- size ceiling: 85,000 bytes

T8 selected benchmark medians:

- idle ROM loop: 20.757 ms / 200 frames
- RAM-heavy loop: 21.453 ms / 200 frames
- contended-screen loop: 19.443 ms / 200 frames
- FE border/audio loop: 25.703 ms / 200 frames
- keyboard polling loop: 19.916 ms / 200 frames
- tape LOAD EAR loop: 20.349 ms / 200 frames
- floating-bus loop: 19.165 ms / 200 frames
- debug-step NOP loop: 0.651 ms / 10,000 steps

## Tradeoffs and rejected optimizations

- Keep tape parsing, unbounded tape storage, media policy, and fast-load policy
  in TypeScript. WASM receives bounded static tables/traces only.
- Keep the production artifact on the speed profile (`-O3`,
  `-ffreestanding`, `-fno-builtin`, `-nostdlib`). `-Oz` is much smaller but
  slower in hot frame paths; LTO did not provide enough benefit on this
  toolchain.
- Do not remove the TypeScript backend fallback.
- Do not introduce dynamic allocation in the C/WASM implementation.
- Do not move test-only Z80 ABI exports back into the packaged production
  artifact.

## T9 benchmark confirmation

No performance-code changes were made in T9; the benchmark was rerun as a
rollout safety check.

- Artifact size: 71,312 bytes
- idle ROM loop: 21.450 ms / 200 frames
- RAM-heavy loop: 21.593 ms / 200 frames
- contended-screen loop: 19.667 ms / 200 frames
- FE border/audio loop: 26.482 ms / 200 frames
- keyboard polling loop: 20.545 ms / 200 frames
- tape LOAD EAR loop: 20.688 ms / 200 frames
- floating-bus loop: 19.709 ms / 200 frames
- debug-step NOP loop: 0.661 ms / 10,000 steps

## Last known T9 gates

- T9 focused gate:
  `npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts test/zxSpectrum/sp48-wasm-rollout-smoke.test.ts`
- `npm run build:sp48-wasm`
- Expanded WASM rollout suite:
  `npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-rollout-smoke.test.ts test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/ula-contention.test.ts`
- Z80 suite:
  `npx vitest run --config build/vitest.config.ts --project node test/z80`
- Static allocation audit:
  `rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm`
- `npm run check:sp48-wasm-size`
- `npm run benchmark:sp48-wasm`
- `npm run build:check`
- `npx electron-vite build --config build/electron.vite.config.ts`
- `npm run test`
- `git diff --check`
