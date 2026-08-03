# ZX Spectrum 48K WASM T8 benchmark notes

Generated: 2026-08-03

Phase T8 focused on JavaScript/WASM adapter overhead:

- Cached keyboard row, tape mode, and tape EAR default values in
  `ZxSpectrum48WasmMachine`, so unchanged input bytes are not rewritten before
  every frame/port read.
- Added adapter sync diagnostics for focused tests without reading C-side
  diagnostics during normal execution.
- Added a cached `eventBufferView` to `Sp48WasmRuntime` and replaced per-event
  `new DataView(...)` allocations in border/audio/tape trace readers.
- Skipped audio/tape event-buffer decoding from replay paths when the WASM trace
  count is zero.
- Preserved the static-memory C/WASM implementation; the allocation audit found
  no dynamic allocation calls in the WASM C sources.

Production artifact:

```json
{
  "artifact": "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm",
  "artifactBytes": 71312,
  "maxBytes": 85000
}
```

Benchmark command:

```sh
npm run benchmark:sp48-wasm
```

Results:

| Scenario | Iterations | TS median ms | WASM median ms | Notes |
| --- | ---: | ---: | ---: | --- |
| idle-rom-loop | 200 frames | 826.740 | 20.757 | No trace events |
| ram-heavy-loop | 200 frames | 1107.251 | 21.453 | RAM read/write loop |
| contended-screen-loop | 200 frames | 1082.651 | 19.443 | Contention table active |
| fe-border-audio-loop | 200 frames | 1136.473 | 25.703 | 51,200 trace events |
| keyboard-polling-loop | 200 frames | 1096.464 | 19.916 | Repeated FE reads |
| tape-load-ear-loop | 200 frames | 1111.532 | 20.349 | Reused tape EAR table |
| floating-bus-loop | 200 frames | 1065.441 | 19.165 | 607,722 floating-bus reads |
| debug-step-nop-loop | 10,000 steps | 6.482 | 0.651 | One JS/WASM call per instruction |

Quality gates run during T8:

- `npm run build:sp48-wasm`
- Focused WASM integration test:
  `npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts`
- Focused WASM suite:
  `npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/ula-contention.test.ts`
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
