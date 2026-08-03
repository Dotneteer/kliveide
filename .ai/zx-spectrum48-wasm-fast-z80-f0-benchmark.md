# ZX Spectrum 48K WASM fast Z80 F0 benchmark

Generated: 2026-08-03T11:21:32.722Z

- Current test artifact: /Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-test.wasm
- Current test artifact bytes: 72927
- Fast reference artifact: /Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-fast-z80-reference.wasm
- Fast reference artifact bytes: 173340
- Repeats: 9
- Default iterations: 10000

| Scenario | Correct | Current median ms | Fast median ms | Speedup | Mismatches |
| --- | --- | ---: | ---: | ---: | --- |
| standard-00-nop-jr | yes | 0.879 | 0.814 | 1.08x | - |
| standard-40-7f-register-ld | yes | 0.909 | 0.811 | 1.12x | - |
| standard-80-bf-register-alu | yes | 0.864 | 0.778 | 1.11x | - |
| memory-stack-call-ret | yes | 0.877 | 0.796 | 1.102x | - |
| cb-rotate-bit | yes | 1.463 | 1.298 | 1.127x | - |
| ed-block-io | yes | 1.418 | 1.373 | 1.033x | - |
| ix-iy-indexed | yes | 0.524 | 0.493 | 1.063x | - |
| z80n-ed-extension | yes | 1.344 | 1.314 | 1.023x | - |

This is a comparison-only F0 artifact. It is not linked into the production SP48 WASM backend.

