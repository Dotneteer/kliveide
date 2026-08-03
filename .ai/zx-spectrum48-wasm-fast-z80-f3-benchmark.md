# ZX Spectrum 48K WASM fast Z80 F3 benchmark

Generated: 2026-08-03T11:34:35.377Z

- Current test artifact: /Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-fast-z80-test.wasm
- Current test artifact bytes: 173545
- Current mode: fast-z80-test
- Fast reference artifact: /Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-fast-z80-reference.wasm
- Fast reference artifact bytes: 173640
- Repeats: 9
- Default iterations: 10000

| Scenario | Correct | Current median ms | Fast median ms | Speedup | Mismatches |
| --- | --- | ---: | ---: | ---: | --- |
| standard-00-nop-jr | yes | 0.823 | 0.837 | 0.983x | - |
| standard-40-7f-register-ld | yes | 0.788 | 0.826 | 0.954x | - |
| standard-80-bf-register-alu | yes | 0.778 | 0.806 | 0.965x | - |
| memory-stack-call-ret | yes | 0.795 | 0.825 | 0.964x | - |
| cb-rotate-bit | yes | 1.293 | 1.374 | 0.941x | - |
| ed-block-io | yes | 1.301 | 1.361 | 0.956x | - |
| ix-iy-indexed | yes | 0.485 | 0.516 | 0.939x | - |
| z80n-ed-extension | yes | 1.288 | 1.325 | 0.972x | - |

This validates the fast opcode core through the normal standalone Z80 test ABI.
It is not linked into the production SP48 WASM backend until F4.
