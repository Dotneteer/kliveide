# ZX Spectrum 48K WASM Fast Z80 F5 Handoff

Generated: 2026-08-03

## Summary

F5 removes the legacy hand-written C opcode executor from the WASM build path.
Production SP48 execution and the standalone Z80 WASM test ABI both use the
vendored fast Z80 core.

Removed legacy files:

- `src/emu/z80/wasm/z80_cpu.c`
- `src/emu/z80/wasm/z80_cpu.h`
- `src/emu/z80/wasm/z80_abi.c`

Current fast-core integration points:

- Production SP48 adapter:
  `src/emu/z80/wasm/reference/fast_z80_sp48_adapter.c`
- Standalone Z80 test adapter:
  `src/emu/z80/wasm/reference/fast_z80_test_adapter.c`
- Shared SP48 CPU state:
  `src/emu/z80/wasm/z80_state.c`

## Benchmark

Command:

```sh
npm run benchmark:sp48-wasm
```

Production artifact:

- `src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm`
- 226,153 bytes

Median WASM timings:

| Scenario | Iterations | WASM median |
| --- | ---: | ---: |
| idle-rom-loop | 200 frames | 37.395 ms |
| ram-heavy-loop | 200 frames | 33.352 ms |
| contended-screen-loop | 200 frames | 30.289 ms |
| fe-border-audio-loop | 200 frames | 39.228 ms |
| keyboard-polling-loop | 200 frames | 31.126 ms |
| tape-load-ear-loop | 200 frames | 31.493 ms |
| floating-bus-loop | 200 frames | 30.152 ms |
| debug-step-nop-loop | 10000 steps | 0.811 ms |

## Verification

- `npm run build:sp48-wasm`
- `SP48_WASM_BUILD_MODE=test npm run build:sp48-wasm`
- `npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts`
- `npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-cpu-integration.test.ts test/zxSpectrum/sp48-wasm-rollout-smoke.test.ts test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/ula-contention.test.ts`
- `npm run validate:z80-wasm-fast-core`
- `npx vitest run --config build/vitest.config.ts --project node test/z80`
- `npm run check:sp48-wasm-size`
- `npm run build:check`
- `npx electron-vite build --config build/electron.vite.config.ts`
- `npm run test`
- Static allocation scan over `src/emu/machines/zxSpectrum48/wasm` and
  `src/emu/z80/wasm`
