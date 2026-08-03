# ZX Spectrum 48K WASM Fast Z80 F4 Benchmark

Generated: 2026-08-03

## Summary

F4 routes production SP48 frame/debug execution through the vendored fast Z80
core via `fast_z80_sp48_adapter.c`. The adapter keeps the existing SP48 bus,
contention, ULA, tape, dirty-range, and debug-log behavior in `sp48_core.c`.

Production artifact:

- Path: `src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm`
- Size: 226,153 bytes
- Size guard: 240,000 bytes

## Benchmark

Command:

```sh
npm run benchmark:sp48-wasm
```

Median WASM timings:

| Scenario | Iterations | WASM median |
| --- | ---: | ---: |
| idle-rom-loop | 200 frames | 37.576 ms |
| ram-heavy-loop | 200 frames | 33.424 ms |
| contended-screen-loop | 200 frames | 28.768 ms |
| fe-border-audio-loop | 200 frames | 38.867 ms |
| keyboard-polling-loop | 200 frames | 30.991 ms |
| tape-load-ear-loop | 200 frames | 31.388 ms |
| floating-bus-loop | 200 frames | 31.632 ms |
| debug-step-nop-loop | 10000 steps | 0.830 ms |

The benchmark now measures the production SP48 path using the fast core, not
only the standalone cloned Z80 artifact.

## Verification

- `npm run build:sp48-wasm`
- `npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-rollout-smoke.test.ts test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/ula-contention.test.ts`
- `npm run validate:z80-wasm-fast-core`
- `npx vitest run --config build/vitest.config.ts --project node test/z80`
- `npm run check:sp48-wasm-size`
